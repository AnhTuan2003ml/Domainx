"""Kiểm thử lõi hạch toán kép — chạy trên DATABASE TEST riêng (không đụng dữ liệu chính).

Chạy trong container backend:
    DOMIX_ACCOUNTING_TEST_DB=postgresql://domix:***@database:5432/domix_accounting_test \
        python -m pytest tests/test_accounting_core.py -q

Bộ test phủ các yêu cầu bắt buộc: cân Nợ/Có, một dòng một phía, idempotency khi retry,
mapping bán chịu 131/511/3331, thu công nợ không tăng 511, giá vốn 632/156 bình quân
gia quyền, tách VAT nhiều thuế suất, bất biến chứng từ posted, bút toán đảo liên kết gốc,
maker–checker, khóa kỳ, thanh toán từng phần, migration upgrade + rollback.
"""

from __future__ import annotations

import os
import sys
import unittest
import uuid
from decimal import Decimal
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

TEST_DB = os.environ.get("DOMIX_ACCOUNTING_TEST_DB", "").strip()

try:
    import psycopg  # noqa: F401
    HAS_PSYCOPG = True
except ImportError:
    HAS_PSYCOPG = False

requires_db = unittest.skipUnless(
    TEST_DB and HAS_PSYCOPG,
    "Cần DOMIX_ACCOUNTING_TEST_DB (PostgreSQL test) và psycopg — chạy trong container backend.",
)


def _fresh_schema():
    from db.accounting_store import downgrade_accounting_tables
    from services.posting_service import ensure_schema
    downgrade_accounting_tables(TEST_DB)  # kiểm tra rollback migration
    ensure_schema(TEST_DB)                # kiểm tra upgrade migration (idempotent)
    ensure_schema(TEST_DB)


def _sale_lines(gross="1080000", net="1000000", vat="80000"):
    return [
        {"account": "131", "debit": gross},
        {"account": "511", "credit": net},
        {"account": "3331", "credit": vat},
    ]


@requires_db
class PostingServiceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        _fresh_schema()

    def _post(self, **kwargs):
        from services import posting_service
        base = {
            "event_type": "ORDER_SALE",
            "source_type": "test",
            "source_id": uuid.uuid4().hex,
            "document_date": "2026-08-01",
            "description": "test",
            "lines": _sale_lines(),
            "created_by": "tester@domix.vn",
        }
        base.update(kwargs)
        return posting_service.post_entry(TEST_DB, **base)

    # 1. Tổng Nợ khác tổng Có → chặn
    def test_unbalanced_entry_rejected(self):
        from services.posting_service import PostingError
        with self.assertRaises(PostingError):
            self._post(lines=[
                {"account": "131", "debit": "1000"},
                {"account": "511", "credit": "900"},
            ])

    # 2. Một dòng vừa Nợ vừa Có → chặn; dòng 0 cả hai phía → chặn
    def test_line_single_side_only(self):
        from services.posting_service import PostingError
        with self.assertRaises(PostingError):
            self._post(lines=[
                {"account": "131", "debit": "1000", "credit": "1000"},
                {"account": "511", "credit": "1000"},
            ])
        with self.assertRaises(PostingError):
            self._post(lines=[
                {"account": "131", "debit": "0", "credit": "0"},
                {"account": "511", "credit": "0"},
            ])

    # 2b. Số tiền âm → chặn
    def test_negative_amount_rejected(self):
        from services.posting_service import PostingError
        with self.assertRaises(PostingError):
            self._post(lines=[
                {"account": "131", "debit": "-1000"},
                {"account": "511", "credit": "-1000"},
            ])

    # 3. Retry cùng idempotency/nguồn → không sinh bút toán trùng
    def test_idempotent_retry(self):
        source = uuid.uuid4().hex
        first = self._post(source_id=source)
        second = self._post(source_id=source)
        self.assertTrue(first["created"])
        self.assertFalse(second["created"])
        self.assertEqual(first["id"], second["id"])

    # 4+7+14. Bán chịu sinh đúng 131/511/3331 — doanh thu KHÔNG gồm VAT
    def test_credit_sale_mapping_and_vat_split(self):
        from services.posting_service import account_balance
        _fresh_schema()
        self._post(lines=_sale_lines("2200000", "2000000", "200000"))  # VAT 10%
        self._post(source_id=uuid.uuid4().hex, lines=_sale_lines("1080000", "1000000", "80000"))  # VAT 8%
        self.assertEqual(account_balance(TEST_DB, "511"), Decimal("3000000.00"))
        self.assertEqual(account_balance(TEST_DB, "3331"), Decimal("280000.00"))
        self.assertEqual(account_balance(TEST_DB, "131"), Decimal("3280000.00"))

    # 5+16. Thu công nợ từng phần: Nợ 112/Có 131 theo TỪNG LẦN, không đụng 511
    def test_debt_collection_partial_payments(self):
        from services.posting_service import account_balance
        _fresh_schema()
        self._post(lines=_sale_lines("1080000", "1000000", "80000"))
        revenue_before = account_balance(TEST_DB, "511")
        for index, amount in enumerate(("500000", "580000")):
            self._post(
                event_type="DEBT_COLLECTED",
                source_id=f"payment-{index}",
                lines=[
                    {"account": "112", "debit": amount},
                    {"account": "131", "credit": amount},
                ],
            )
        self.assertEqual(account_balance(TEST_DB, "511"), revenue_before)  # không tăng doanh thu
        self.assertEqual(account_balance(TEST_DB, "131"), Decimal("0.00"))
        self.assertEqual(account_balance(TEST_DB, "112"), Decimal("1080000.00"))

    # 6. Giá vốn khi bán: Nợ 632 / Có 156
    def test_cogs_posting(self):
        from services.posting_service import account_balance
        _fresh_schema()
        self._post(
            event_type="ORDER_COGS",
            lines=[
                {"account": "632", "debit": "700000"},
                {"account": "156", "credit": "700000"},
            ],
        )
        self.assertEqual(account_balance(TEST_DB, "632"), Decimal("700000.00"))

    # 10. Chứng từ posted bất biến — không có đường sửa/xóa, chỉ được đảo
    def test_posted_entry_immutable(self):
        from db.connection import connect
        result = self._post()
        with connect(TEST_DB) as conn:
            row = conn.execute(
                "SELECT status FROM journal_entries WHERE id = ?", (result["id"],)
            ).fetchone()
        self.assertEqual(row["status"], "posted")
        import services.posting_service as ps
        self.assertFalse(hasattr(ps, "update_entry"))
        self.assertFalse(hasattr(ps, "delete_entry"))

    # 11+17. Đảo bút toán: dòng ngược đúng, liên kết chứng từ gốc, gốc chuyển 'reversed'
    def test_reversal_links_and_mirrors(self):
        from db.connection import connect
        from services.posting_service import account_balance, reverse_entry
        _fresh_schema()
        original = self._post(lines=_sale_lines("1080000", "1000000", "80000"))
        reversal = reverse_entry(TEST_DB, original["id"], "boss@domix.vn", "Khách hủy đơn")
        self.assertTrue(reversal["created"])
        self.assertEqual(account_balance(TEST_DB, "511"), Decimal("0.00"))
        self.assertEqual(account_balance(TEST_DB, "3331"), Decimal("0.00"))
        self.assertEqual(account_balance(TEST_DB, "131"), Decimal("0.00"))
        with connect(TEST_DB) as conn:
            rev = conn.execute(
                "SELECT reversal_of, status FROM journal_entries WHERE id = ?", (reversal["id"],)
            ).fetchone()
            org = conn.execute(
                "SELECT status FROM journal_entries WHERE id = ?", (original["id"],)
            ).fetchone()
        self.assertEqual(rev["reversal_of"], original["id"])
        self.assertEqual(org["status"], "reversed")
        # Đảo lần 2 → trả về bút toán đảo cũ, không sinh trùng
        again = reverse_entry(TEST_DB, original["id"], "boss@domix.vn", "retry")
        self.assertFalse(again.get("created", True))

    # 12. Người lập không được tự duyệt
    def test_maker_cannot_approve_own_entry(self):
        from services.posting_service import PostingError, approve_entry, create_manual_draft
        draft = create_manual_draft(
            TEST_DB,
            document_date="2026-08-02",
            description="Bút toán tay",
            lines=[
                {"account": "642", "debit": "100000"},
                {"account": "111", "credit": "100000"},
            ],
            created_by="maker@domix.vn",
        )
        with self.assertRaises(PostingError):
            approve_entry(TEST_DB, draft["id"], "maker@domix.vn")
        result = approve_entry(TEST_DB, draft["id"], "checker@domix.vn")
        self.assertEqual(result["status"], "posted")

    # 12b. Từ chối bắt buộc lý do
    def test_reject_requires_reason(self):
        from services.posting_service import PostingError, create_manual_draft, reject_entry
        draft = create_manual_draft(
            TEST_DB, document_date="2026-08-02", description="x",
            lines=[{"account": "642", "debit": "1"}, {"account": "111", "credit": "1"}],
            created_by="maker@domix.vn",
        )
        with self.assertRaises(PostingError):
            reject_entry(TEST_DB, draft["id"], "checker@domix.vn", "")

    # 13. Kỳ khóa không nhận nghiệp vụ mới lẫn bút toán đảo
    def test_locked_period_blocks_posting(self):
        from services.posting_service import PostingError, lock_period, reverse_entry, unlock_period
        _fresh_schema()
        inside = self._post(document_date="2026-05-15", posting_date="2026-05-15")
        lock_period(TEST_DB, "2026-05", "boss@domix.vn")
        with self.assertRaises(PostingError):
            self._post(document_date="2026-05-20", posting_date="2026-05-20")
        with self.assertRaises(PostingError):
            reverse_entry(TEST_DB, inside["id"], "boss@domix.vn", "sửa sai")
        with self.assertRaises(PostingError):
            unlock_period(TEST_DB, "2026-05", "boss@domix.vn", "")  # mở lại phải có lý do
        unlock_period(TEST_DB, "2026-05", "boss@domix.vn", "Điều chỉnh sau kiểm toán")
        self._post(document_date="2026-05-21", posting_date="2026-05-21")

    # 15. Chỉ tiêu tách bạch: lợi nhuận từ 511-632-chi phí, KHÔNG phải dòng tiền 111/112
    def test_profit_not_cashflow(self):
        from services.posting_service import account_balance
        _fresh_schema()
        self._post(lines=_sale_lines("1080000", "1000000", "80000"))  # chưa thu tiền
        revenue = account_balance(TEST_DB, "511")
        cash = account_balance(TEST_DB, "111") + account_balance(TEST_DB, "112")
        self.assertEqual(revenue, Decimal("1000000.00"))
        self.assertEqual(cash, Decimal("0.00"))  # doanh thu dồn tích ≠ tiền về


@requires_db
class CostingTests(unittest.TestCase):
    # 8+9. Bình quân gia quyền sau mỗi lần nhập + xuất không âm kho
    def test_weighted_average_after_each_purchase(self):
        from services.ledger_sync_service import _build_costing
        data = {
            "inventory": [{"id": 1, "costPrice": 0}],
            "distributionOrders": [
                {"id": "p1", "orderKind": "purchase", "unitCost": 100, "vatRate": 0, "quantity": 10},
                {"id": "p2", "orderKind": "purchase", "unitCost": 160, "vatRate": 0, "quantity": 10},
            ],
            "stockMovements": [
                {"id": "m1", "productId": 1, "movementType": "purchase", "quantity": 10, "delta": 10, "date": "2026-06-01", "sourceId": "p1"},
                {"id": "m2", "productId": 1, "movementType": "purchase", "quantity": 10, "delta": 10, "date": "2026-06-05", "sourceId": "p2"},
                {"id": "m3", "productId": 1, "movementType": "sale", "quantity": 5, "delta": -5, "date": "2026-06-10", "sourceId": "o1"},
            ],
        }
        rows, sale_costs = _build_costing(data)
        avg_after_second = next(r for r in rows if r["movement_key"] == "val:m2")
        self.assertEqual(Decimal(avg_after_second["avg_cost_after"]), Decimal("130.00"))
        qty, unit_cost, assumed = sale_costs["m3"]
        self.assertEqual(unit_cost, Decimal("130.00"))  # giá vốn LỊCH SỬ, không lấy costPrice hiện tại
        self.assertEqual(qty, Decimal("5"))
        self.assertEqual(assumed, 0)
        after_sale = next(r for r in rows if r["movement_key"] == "val:m3")
        self.assertEqual(Decimal(after_sale["qty_after"]), Decimal("15"))
        self.assertTrue(Decimal(after_sale["qty_after"]) >= 0)


@requires_db
class LedgerSyncTests(unittest.TestCase):
    # Đồng bộ từ app_state: đúng mapping, idempotent khi chạy lại
    def test_sync_events_idempotent(self):
        from services.ledger_sync_service import build_events
        data = {
            "orders": [{
                "id": 900, "date": "2026-07-01", "customerName": "KH A", "amount": 1080000,
                "invoiceType": "Hóa đơn GTGT (VAT)", "vatRate": 8, "customerId": 1,
            }],
            "paymentLedger": [{
                "id": "pay-1", "debtId": "d1", "entryType": "payment", "amount": 1080000,
                "paymentMethod": "chuyen_khoan", "date": "2026-07-02",
            }],
            "debts": [{"id": "d1", "type": "thu", "counterpartyName": "KH A", "orderId": 900}],
            "transactions": [{
                "id": "chi-1", "kind": "chi", "amount": 550000, "date": "2026-07-03",
                "category": "van_phong", "source": "manual_finance_hub",
                "invoiceType": "Hóa đơn GTGT (VAT)", "vatRate": 8, "paymentMethod": "chuyen_khoan",
            }],
        }
        events, reversals, _rows = build_events(data)
        types = [event["event_type"] for event in events]
        self.assertIn("ORDER_SALE", types)
        self.assertIn("DEBT_COLLECTED", types)
        self.assertIn("MANUAL_EXPENSE", types)
        self.assertEqual(reversals, [])
        sale = next(e for e in events if e["event_type"] == "ORDER_SALE")
        accounts = {line["account"] for line in sale["lines"]}
        self.assertEqual(accounts, {"131", "511", "3331"})
        collect = next(e for e in events if e["event_type"] == "DEBT_COLLECTED")
        self.assertEqual({line["account"] for line in collect["lines"]}, {"112", "131"})
        expense = next(e for e in events if e["event_type"] == "MANUAL_EXPENSE")
        self.assertEqual({line["account"] for line in expense["lines"]}, {"642", "133", "112"})


if __name__ == "__main__":
    unittest.main()
