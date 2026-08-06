"""Kiểm thử migration luồng bán hàng (expand-and-contract) + bất biến nghiệp vụ.

Phủ 10 kiểm thử bắt buộc:
  1. Không tạo đơn nếu thiếu số lượng.
  2. Đơn hoàn thành vẫn có thể CHƯA thanh toán (không suy paid từ completed).
  3. Đơn đã thanh toán vẫn có thể CHƯA xuất hóa đơn (không suy issued từ đã bán).
  4. Thanh toán một phần cập nhật đúng số còn phải thu (backend tự tính).
  5. Thu công nợ không tăng doanh thu.
  6. Xuất bán tạo giá vốn đúng MỘT lần (sync lặp không nhân đôi).
  7. Retry không sinh payment/journal trùng.
  8. Hủy đơn CHƯA xuất kho: không tạo hoàn kho.
  9. Hủy đơn ĐÃ xuất kho: có hoàn kho + chứng từ đảo trên sổ cái.
 10. Dữ liệu cũ vẫn đọc được trong thời gian chuyển đổi (legacy giữ nguyên, rollback sạch).
"""

from __future__ import annotations

import sys
import unittest
from decimal import Decimal
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from db.connection import connect
from db.schema import init_db
from db.state_store import read_state, write_state
from services.business_sync_service import create_crm_order, reconcile_company_data
from services.ledger_sync_service import sync_ledger
from services.sales_migration_service import (
    TransitionError,
    migrate_orders,
    rollback_orders,
    validate_transition,
)
from tests.postgres_test_case import PostgresTestCase


def _base_data():
    return {
        "inventory": [
            {"id": "SP-A", "name": "Gói phần mềm A", "unit": "gói", "costPrice": 500000, "stock": 10, "vatRate": 8},
        ],
        "orders": [],
        "stockMovements": [
            {"id": "mv-open", "productId": "SP-A", "movementType": "opening", "delta": 10, "quantity": 10, "date": "2026-07-01"},
        ],
        "debts": [], "paymentLedger": [], "transactions": [],
    }


class SalesMigrationUnitTests(unittest.TestCase):
    """Phần thuần logic — không cần database."""

    def _data_with_order(self, order, **extra):
        data = _base_data()
        data["orders"] = [order]
        for key, value in extra.items():
            data[key] = value
        return data

    # 1. Thiếu số lượng → chặn ngay từ backend.
    def test_create_order_requires_quantity(self):
        with self.assertRaises(ValueError):
            create_crm_order(
                _base_data(),
                {"order": {"customerName": "Khách", "amount": 1000000, "quantity": 0}},
                "sale@test.vn", actor_employee_id=1,
            )
        with self.assertRaises(ValueError):
            create_crm_order(
                _base_data(),
                {"order": {"customerName": "Khách", "amount": 1000000}},
                "sale@test.vn", actor_employee_id=1,
            )

    def test_backend_computes_amount_from_unit_price(self):
        # Client gửi amount bịa 1đ nhưng có đơn giá — backend tự tính 3 × 400.000 − 50.000.
        data, order_id = create_crm_order(
            _base_data(),
            {"order": {"customerName": "Khách", "amount": 1, "quantity": 3, "unitPrice": 400000, "discount": 50000}},
            "sale@test.vn", actor_employee_id=1,
        )
        order = next(o for o in data["orders"] if str(o["id"]) == str(order_id))
        self.assertEqual(order["amount"], 1150000)
        self.assertEqual(order["paymentStatus"], "unpaid")

    # 2. completed KHÔNG suy ra paid.
    def test_completed_order_can_be_unpaid(self):
        data = self._data_with_order(
            {"id": "o-1", "customerName": "K", "amount": 1080000, "quantity": 1, "productId": "SP-A", "status": "completed", "date": "2026-08-01"},
        )
        report = migrate_orders(data, mode="commit")
        order = data["orders"][0]
        self.assertEqual(order["orderStatus"], "completed")
        self.assertEqual(order["paymentStatus"], "unpaid")
        self.assertEqual(report["counts"]["paymentStatus"].get("unpaid"), 1)

    # 3. paid KHÔNG suy ra issued.
    def test_paid_order_can_be_not_issued(self):
        data = self._data_with_order(
            {"id": "o-2", "customerName": "K", "amount": 1000000, "quantity": 1, "status": "completed", "date": "2026-08-01"},
            debts=[{"id": "d-2", "type": "thu", "orderId": "o-2", "amount": 1000000}],
            paymentLedger=[{"id": "p-2", "debtId": "d-2", "amount": 1000000, "entryType": "payment"}],
        )
        migrate_orders(data, mode="commit")
        order = data["orders"][0]
        self.assertEqual(order["paymentStatus"], "paid")
        self.assertEqual(order["invoiceStatus"], "not_issued")

    # 4. Thanh toán một phần → còn phải thu do backend tính.
    def test_partial_payment_updates_remaining(self):
        data = self._data_with_order(
            {"id": "o-3", "customerName": "K", "amount": 2000000, "quantity": 1, "date": "2026-08-01"},
            debts=[{"id": "d-3", "type": "thu", "orderId": "o-3", "amount": 2000000}],
            paymentLedger=[
                {"id": "p-3a", "debtId": "d-3", "amount": 600000, "entryType": "payment"},
                {"id": "p-3b", "debtId": "d-3", "amount": 400000, "entryType": "payment"},
                {"id": "p-3c", "debtId": "d-3", "amount": 999999, "entryType": "reversal", "reversalOf": "p-x"},
            ],
        )
        migrate_orders(data, mode="commit")
        order = data["orders"][0]
        self.assertEqual(order["paymentStatus"], "partially_paid")
        self.assertEqual(Decimal(order["amountBreakdown"]["collected"]), Decimal("1000000.00"))
        self.assertEqual(Decimal(order["amountBreakdown"]["remaining"]), Decimal("1000000.00"))

    # 10a. Dữ liệu cũ vẫn đọc được: legacy giữ nguyên, rollback gỡ sạch trường mới.
    def test_legacy_kept_and_rollback_clean(self):
        legacy_order = {"id": "o-4", "customerName": "K", "amount": 500000, "quantity": 1, "status": "weird_status", "date": "2026-08-01"}
        data = self._data_with_order(dict(legacy_order))
        report = migrate_orders(data, mode="commit")
        order = data["orders"][0]
        self.assertEqual(order["status"], "weird_status")          # legacy KHÔNG bị xóa
        self.assertEqual(order["legacyStatus"], "weird_status")
        self.assertTrue(order["needsReview"])                       # mơ hồ → cần rà tay
        self.assertEqual(report["needsReviewCount"], 1)
        rollback = rollback_orders(data)
        self.assertEqual(rollback["rolledBack"], 1)
        self.assertNotIn("orderStatus", data["orders"][0])
        self.assertEqual(data["orders"][0]["status"], "weird_status")

    def test_dry_run_does_not_write(self):
        data = self._data_with_order(
            {"id": "o-5", "customerName": "K", "amount": 500000, "quantity": 1, "date": "2026-08-01"},
        )
        report = migrate_orders(data, mode="dry-run")
        self.assertEqual(report["orders"], 1)
        self.assertEqual(report["migrated"], 0)
        self.assertNotIn("orderStatus", data["orders"][0])

    def test_transition_matrix(self):
        self.assertEqual(validate_transition("order", "confirmed", "completed"), "completed")
        with self.assertRaises(TransitionError):
            validate_transition("order", "cancelled", "confirmed")
        with self.assertRaises(TransitionError):
            validate_transition("payment", "unpaid", "fully_refunded")
        with self.assertRaises(TransitionError):
            validate_transition("invoice", "not_issued", "adjusted")

    # 8. Hủy đơn CHƯA xuất kho: không sinh hoàn kho.
    def test_cancel_unshipped_order_no_stock_return(self):
        data = _base_data()
        # Đơn dịch vụ (không sản phẩm) đã hủy — không có movement nào.
        data["orders"] = [{"id": "o-6", "customerName": "K", "amount": 500000, "quantity": 1, "status": "cancelled", "date": "2026-08-01"}]
        result = reconcile_company_data(data)
        returns = [m for m in result["stockMovements"] if m.get("movementType") == "cancel_reverse"]
        self.assertEqual(returns, [])

    # 9a. Hủy đơn ĐÃ xuất kho: sinh hoàn kho.
    def test_cancel_shipped_order_creates_stock_return(self):
        data = _base_data()
        data["orders"] = [{"id": "o-7", "customerName": "K", "amount": 1080000, "quantity": 2, "productId": "SP-A", "inventoryStatus": "fulfilled", "date": "2026-08-01"}]
        result = reconcile_company_data(data)  # sinh movement sale_out
        sale_moves = [m for m in result["stockMovements"] if m.get("movementType") == "sale_out" and str(m.get("sourceId")) == "o-7"]
        self.assertEqual(len(sale_moves), 1)
        result["orders"][0]["status"] = "cancelled"
        result = reconcile_company_data(result)
        returns = [m for m in result["stockMovements"] if m.get("movementType") == "cancel_reverse" and str(m.get("sourceId")) == "o-7"]
        self.assertEqual(len(returns), 1)
        self.assertEqual(returns[0]["delta"], 2)


class SalesLedgerIntegrationTests(PostgresTestCase):
    """Phần tích hợp sổ cái — cần PostgreSQL."""

    def setUp(self):
        super().setUp()
        init_db(self.db_path)

    def _seed(self, data):
        write_state(self.db_path, reconcile_company_data(data))

    def _journal(self, where=""):
        with connect(self.db_path) as conn:
            return conn.execute(
                f"SELECT event_type, source_type, source_id, status FROM journal_entries {where}"
            ).fetchall()

    # 5 + 6 + 7: thu công nợ không tăng 511; COGS đúng một lần; sync lặp không sinh trùng.
    def test_debt_collection_cogs_and_idempotent_sync(self):
        data = _base_data()
        data["orders"] = [{"id": "o-8", "customerName": "K", "amount": 1080000, "quantity": 2, "productId": "SP-A", "vatRate": 8, "inventoryStatus": "fulfilled", "date": "2026-08-01"}]
        data["debts"] = [{"id": "d-8", "type": "thu", "orderId": "o-8", "amount": 1080000}]
        data["paymentLedger"] = [{"id": "p-8", "debtId": "d-8", "amount": 500000, "entryType": "payment", "date": "2026-08-02"}]
        self._seed(data)
        sync_ledger(self.db_path, mode="commit", actor="test")
        sync_ledger(self.db_path, mode="commit", actor="test")  # retry toàn bộ

        cogs = [r for r in self._journal() if r["event_type"] == "ORDER_COGS"]
        self.assertEqual(len(cogs), 1)  # giá vốn đúng MỘT lần dù sync 2 lần
        debt_events = [r for r in self._journal() if r["event_type"] == "DEBT_COLLECTED"]
        self.assertEqual(len(debt_events), 1)  # retry không sinh payment-journal trùng

        with connect(self.db_path) as conn:
            rev511 = conn.execute(
                "SELECT COALESCE(SUM(l.credit - l.debit), 0) AS v FROM journal_entry_lines l"
                " JOIN journal_entries e ON e.id = l.journal_entry_id"
                " WHERE l.account_code = '511' AND e.status IN ('posted','reversed')"
            ).fetchone()["v"]
        self.assertEqual(Decimal(str(rev511)), Decimal("1000000.00"))  # 1.080.000 gồm 8% VAT → 511 = 1tr; thu 500k KHÔNG tăng 511

    # 9b. Hủy đơn đã xuất kho + đã ghi sổ → chứng từ đảo trên sổ cái.
    def test_cancel_shipped_posted_order_creates_reversals(self):
        data = _base_data()
        data["orders"] = [{"id": "o-9", "customerName": "K", "amount": 1080000, "quantity": 2, "productId": "SP-A", "vatRate": 8, "inventoryStatus": "fulfilled", "date": "2026-08-01"}]
        self._seed(data)
        sync_ledger(self.db_path, mode="commit", actor="test")
        posted_sale = [r for r in self._journal() if r["event_type"] == "ORDER_SALE" and r["status"] == "posted"]
        self.assertEqual(len(posted_sale), 1)

        state = read_state(self.db_path)["data"]
        state["orders"][0]["status"] = "cancelled"
        self._seed(state)
        sync_ledger(self.db_path, mode="commit", actor="test")
        sync_ledger(self.db_path, mode="commit", actor="test")  # retry đảo — không sinh 2 chứng từ đảo

        reversal_entries = [r for r in self._journal() if r["event_type"].startswith("REVERSAL:")]
        kinds = sorted(r["event_type"] for r in reversal_entries)
        self.assertIn("REVERSAL:ORDER_SALE", kinds)
        self.assertIn("REVERSAL:ORDER_COGS", kinds)
        self.assertEqual(len(kinds), len(set((r["event_type"], r["source_id"]) for r in reversal_entries)))
        # Hoàn kho có mặt trong app_state.
        moves = read_state(self.db_path)["data"]["stockMovements"]
        self.assertTrue(any(m.get("movementType") == "cancel_reverse" and str(m.get("sourceId")) == "o-9" for m in moves))


if __name__ == "__main__":
    unittest.main()
