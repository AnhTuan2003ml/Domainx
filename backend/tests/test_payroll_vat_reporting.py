# -*- coding: utf-8 -*-
"""Chi phí lương theo bảng lương ĐÃ CHỐT + Sổ VAT chỉ đếm chứng từ hiện hành.

Phủ các quy tắc:
  - Duyệt bảng lương → Nợ 642 / Có 334 ngay cả khi CHƯA thanh toán; sync lặp lại idempotent.
  - Thanh toán lương → chỉ Nợ 334 / Có 112, KHÔNG ghi chi phí 642 lần thứ hai.
  - financial_summary trừ đúng chi phí lương đã duyệt vào lợi nhuận kế toán.
  - Sổ VAT: mỗi chứng từ nguồn đúng MỘT dòng — bút toán gốc đã đảo và bút toán đảo
    được giữ nguyên trong nhật ký nhưng không được đếm là chứng từ hiện hành.
"""

from __future__ import annotations

import sys
import unittest
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlparse

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from db.connection import connect
from db.schema import init_db
from db.state_store import read_state, update_state, write_state
from routes import accounting as accounting_route
from services import posting_service
from services.financial_summary_service import get_financial_summary
from services.ledger_sync_service import sync_ledger
from tests.postgres_test_case import PostgresTestCase

PAYROLL_NET = 2363462


class StubHandler:
    def __init__(self, db_path):
        self.db_path = db_path
        self.response = None
        self.status = None

    def require_user(self, roles=None):
        return {"email": "admin@test.vn", "role": "admin"}

    def send_json(self, payload, status=200):
        self.response = payload
        self.status = status


def _account_total(db_path, code, side):
    column = "debit" if side == "no" else "credit"
    with connect(db_path) as conn:
        row = conn.execute(
            f"SELECT COALESCE(SUM(l.{column}), 0) AS total FROM journal_entry_lines l "
            "JOIN journal_entries e ON e.id = l.journal_entry_id "
            "WHERE l.account_code = ? AND e.status = 'posted'",
            (code,),
        ).fetchone()
    return Decimal(str(row["total"]))


class PayrollAccrualLedgerTests(PostgresTestCase):
    def setUp(self):
        super().setUp()
        init_db(self.db_path)
        posting_service.ensure_schema(self.db_path)
        write_state(self.db_path, {
            "payrollApprovals": [{
                "id": "appr-1", "employeeId": 7, "employeeName": "Hoàng Ngọc Hiệp",
                "year": 2026, "month": 8,
                "approval_status": "director_approved",
                "approvedAmountOverride": PAYROLL_NET,
            }],
            "payrollPayments": [],
            "transactions": [],
            "orders": [],
        })

    def test_approved_payroll_posts_642_334_before_payment(self):
        result = sync_ledger(self.db_path, mode="commit", actor="test")
        self.assertEqual(result.get("errors"), [])
        self.assertEqual(_account_total(self.db_path, "642", "no"), Decimal(PAYROLL_NET))
        self.assertEqual(_account_total(self.db_path, "334", "co"), Decimal(PAYROLL_NET))
        # Chưa thanh toán: 334 chưa bị tất toán, tiền chưa ra khỏi 112.
        self.assertEqual(_account_total(self.db_path, "334", "no"), Decimal(0))
        self.assertEqual(_account_total(self.db_path, "112", "co"), Decimal(0))

    def test_sync_is_idempotent(self):
        sync_ledger(self.db_path, mode="commit", actor="test")
        second = sync_ledger(self.db_path, mode="commit", actor="test")
        self.assertEqual(int(second.get("posted") or 0), 0)
        self.assertEqual(_account_total(self.db_path, "642", "no"), Decimal(PAYROLL_NET))

    def test_payment_settles_334_without_double_expense(self):
        sync_ledger(self.db_path, mode="commit", actor="test")

        def add_payment(data):
            result = dict(data or {})
            result["payrollPayments"] = [{
                "id": "pay-1", "employeeId": 7, "amount": PAYROLL_NET,
                "paidDate": "2026-08-31", "paymentMethod": "chuyen_khoan",
                "approvalId": "appr-1", "year": 2026, "month": 8,
            }]
            return result

        update_state(self.db_path, add_payment)
        sync_ledger(self.db_path, mode="commit", actor="test")
        # Chi phí 642 GIỮ NGUYÊN một lần; thanh toán chỉ tất toán 334 và ghi Có 112.
        self.assertEqual(_account_total(self.db_path, "642", "no"), Decimal(PAYROLL_NET))
        self.assertEqual(_account_total(self.db_path, "334", "no"), Decimal(PAYROLL_NET))
        self.assertEqual(_account_total(self.db_path, "112", "co"), Decimal(PAYROLL_NET))

    def test_financial_summary_subtracts_approved_payroll(self):
        summary = get_financial_summary(self.db_path, 2026, 8)
        self.assertEqual(int(summary["payroll_expense_accrued"]), PAYROLL_NET)
        # Không doanh thu/chi phí khác → lợi nhuận kế toán = -chi phí lương.
        self.assertEqual(int(summary["accounting_profit"]), -PAYROLL_NET)

    def test_draft_payroll_not_counted(self):
        def make_draft(data):
            result = dict(data or {})
            approvals = [dict(a) for a in result.get("payrollApprovals") or []]
            for approval in approvals:
                approval["approval_status"] = "submitted"
            result["payrollApprovals"] = approvals
            return result

        update_state(self.db_path, make_draft)
        summary = get_financial_summary(self.db_path, 2026, 8)
        self.assertEqual(int(summary["payroll_expense_accrued"]), 0)


class VatBooksCurrentDocumentTests(PostgresTestCase):
    def setUp(self):
        super().setUp()
        init_db(self.db_path)
        posting_service.ensure_schema(self.db_path)
        write_state(self.db_path, {"orders": [], "transactions": []})

    def _sale_lines(self, gross, net, vat):
        return [
            {"account": "131", "debit": gross},
            {"account": "511", "credit": net},
            {"account": "3331", "credit": vat},
        ]

    def test_vat_books_dedupe_reversed_and_replaced_entries(self):
        original = posting_service.post_entry(
            self.db_path, event_type="ORDER_SALE", source_type="order", source_id="ord-1",
            document_date="2026-08-06", description="Bán hàng lần đầu",
            lines=self._sale_lines("1080000", "1000000.22", "79999.78"), created_by="test@domix.vn",
        )
        posting_service.reverse_entry(self.db_path, original["id"], "admin@test.vn", "Chuẩn hóa VAT")
        replacement = posting_service.post_entry(
            self.db_path, event_type="ORDER_SALE_VATFIX", source_type="order", source_id="ord-1",
            document_date="2026-08-06", description="Bán hàng — VAT tròn đồng",
            lines=self._sale_lines("1080000", "1000000", "80000"), created_by="test@domix.vn",
        )

        handler = StubHandler(self.db_path)
        self.assertTrue(accounting_route.handle_get(handler, "/api/accounting/vat-books", urlparse("/api/accounting/vat-books")))
        output = handler.response["output"]
        # 3 bút toán trong nhật ký (gốc reversed + đảo + ghi lại) nhưng SỔ VAT chỉ 1 chứng từ hiện hành.
        self.assertEqual(len(output), 1)
        self.assertEqual(output[0]["entryNo"], replacement["entry_no"])
        self.assertEqual(output[0]["vat"], "80000.00")
        # Nhật ký vẫn giữ nguyên 3 bút toán (gốc + đảo "ord-1:rev:*" + ghi lại) — audit trail không bị xóa.
        with connect(self.db_path) as conn:
            count = conn.execute(
                "SELECT COUNT(*) AS n FROM journal_entries WHERE source_type = 'order' AND source_id LIKE 'ord-1%'"
            ).fetchone()
        self.assertEqual(int(count["n"]), 3)


if __name__ == "__main__":
    unittest.main()
