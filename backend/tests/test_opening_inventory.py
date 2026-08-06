"""Kiểm thử Tồn kho đầu kỳ (Opening Inventory Batch) + đối soát TK 156.

Chạy trên DATABASE TEST riêng (DOMIX_ACCOUNTING_TEST_DB) — không đụng dữ liệu chính.

Kịch bản chuẩn (dữ liệu test, không đưa vào production):
  - Tồn đầu kỳ 8 sản phẩm × giá vốn 500.000đ = 4.000.000đ.
  - Xuất bán 6 sản phẩm → giá vốn xuất 3.000.000đ.
  - Tồn cuối kỳ 2 sản phẩm = 1.000.000đ.
  - Thẻ kho và số dư chi tiết TK 156 phải BẰNG NHAU sau khi ghi sổ đủ.

Các ràng buộc được phủ: backend tự tính thành tiền, không hard-code tài khoản đối ứng,
maker–checker, preview không ghi, idempotency khi retry, đợt posted bất biến,
đảo phải có lý do và không sinh hai chứng từ đảo.
"""

from __future__ import annotations

import os
import sys
import unittest
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

MAKER = "ketoan.lap@domix.vn"
CHECKER = "ketoan.duyet@domix.vn"

SCENARIO_DATA = {
    "inventory": [
        {"id": "SP-01", "name": "Sản phẩm test tồn đầu", "unit": "cái", "costPrice": 500000, "stock": 2, "vatRate": 8},
    ],
    "stockMovements": [
        {"id": "mv-opening", "productId": "SP-01", "movementType": "opening", "delta": 8, "quantity": 8,
         "date": "2026-07-01", "note": "Tồn đầu kỳ test"},
        {"id": "mv-sale", "productId": "SP-01", "movementType": "sale_out", "delta": -6, "quantity": 6,
         "date": "2026-07-10", "sourceId": "ORD-1", "note": "Xuất bán 6 sản phẩm"},
    ],
    "orders": [
        {"id": "ORD-1", "amount": 3240000, "vatRate": 8, "productId": "SP-01",
         "date": "2026-07-10", "customerName": "Khách test", "productName": "Sản phẩm test tồn đầu"},
    ],
}


def _reset_all():
    import json

    from db.accounting_store import downgrade_accounting_tables
    from db.connection import connect
    from services.posting_service import ensure_schema

    downgrade_accounting_tables(TEST_DB)
    ensure_schema(TEST_DB)
    with connect(TEST_DB) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS app_state (
                key TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        # Ghi trực tiếp app_state (DB test tối giản — không kéo theo sổ vận hành đầy đủ).
        payload = json.dumps(SCENARIO_DATA, ensure_ascii=False)
        conn.execute(
            """
            INSERT INTO app_state (key, payload, version) VALUES ('app_state', ?, 1)
            ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload,
                version = app_state.version + 1, updated_at = CURRENT_TIMESTAMP
            """,
            (payload,),
        )


@requires_db
class OpeningInventoryBatchTests(unittest.TestCase):
    """Chạy TUẦN TỰ theo tên test — mô phỏng đúng vòng đời một đợt tồn đầu."""

    @classmethod
    def setUpClass(cls):
        _reset_all()
        cls.batch_id = None

    def _service(self):
        from services import opening_inventory_service
        return opening_inventory_service

    def test_01_suggest_from_state(self):
        result = self._service().suggest_from_state(TEST_DB)
        self.assertEqual(len(result["suggestions"]), 1)
        suggestion = result["suggestions"][0]
        self.assertEqual(suggestion["productId"], "SP-01")
        self.assertEqual(Decimal(suggestion["quantity"]), Decimal("8"))
        self.assertEqual(Decimal(suggestion["amount"]), Decimal("4000000.00"))
        self.assertTrue(result["counterAccount"])

    def test_02_create_batch_backend_computes_amount(self):
        # Client cố tình gửi amount sai 999đ — backend phải tính lại 8 × 500.000 = 4.000.000.
        result = self._service().create_batch(
            TEST_DB,
            effective_date="2026-07-01",
            counter_account="411",
            lines=[{"productId": "SP-01", "productName": "Sản phẩm test tồn đầu", "uom": "cái",
                    "quantity": "8", "unitCost": "500000", "amount": "999"}],
            source_document="Biên bản kiểm kê 01/07",
            note="Khai tồn đầu kỳ test",
            created_by=MAKER,
            idempotency_key="test-opening-batch-1",
        )
        self.assertTrue(result["created"])
        batch = result["batch"]
        type(self).batch_id = batch["id"]
        self.assertEqual(batch["status"], "draft")
        self.assertEqual(Decimal(batch["totalAmount"]), Decimal("4000000.00"))
        self.assertEqual(Decimal(batch["lines"][0]["amount"]), Decimal("4000000.00"))

    def test_03_create_batch_idempotent_retry(self):
        retry = self._service().create_batch(
            TEST_DB,
            effective_date="2026-07-01",
            counter_account="411",
            lines=[{"productId": "SP-01", "quantity": "8", "unitCost": "500000"}],
            created_by=MAKER,
            idempotency_key="test-opening-batch-1",
        )
        self.assertFalse(retry["created"])
        self.assertEqual(retry["batch"]["id"], self.batch_id)

    def test_04_invalid_inputs_rejected(self):
        from services.posting_service import PostingError
        service = self._service()
        with self.assertRaises(PostingError):  # đối ứng không được là chính 156
            service.create_batch(TEST_DB, effective_date="2026-07-01", counter_account="156",
                                 lines=[{"productId": "X", "quantity": "1", "unitCost": "1"}], created_by=MAKER)
        with self.assertRaises(PostingError):  # tài khoản không tồn tại
            service.create_batch(TEST_DB, effective_date="2026-07-01", counter_account="999",
                                 lines=[{"productId": "X", "quantity": "1", "unitCost": "1"}], created_by=MAKER)
        with self.assertRaises(PostingError):  # số lượng phải > 0
            service.create_batch(TEST_DB, effective_date="2026-07-01", counter_account="411",
                                 lines=[{"productId": "X", "quantity": "0", "unitCost": "1"}], created_by=MAKER)

    def test_05_maker_checker_enforced(self):
        from services.posting_service import PostingError
        with self.assertRaises(PostingError):
            self._service().review_batch(TEST_DB, self.batch_id, MAKER)
        result = self._service().review_batch(TEST_DB, self.batch_id, CHECKER)
        self.assertEqual(result["batch"]["status"], "reviewed")

    def test_06_preview_does_not_write(self):
        from db.connection import connect
        preview = self._service().post_batch(TEST_DB, self.batch_id, CHECKER, mode="preview")
        self.assertEqual(preview["mode"], "preview")
        self.assertEqual(Decimal(preview["totalAmount"]), Decimal("4000000.00"))
        with connect(TEST_DB) as conn:
            count = conn.execute(
                "SELECT COUNT(*) AS n FROM journal_entries WHERE event_type = 'OPENING_STOCK'"
            ).fetchone()
        self.assertEqual(int(count["n"]), 0)

    def test_07_post_commit_writes_journal_and_stock_in_one_tx(self):
        from db.connection import connect
        result = self._service().post_batch(TEST_DB, self.batch_id, CHECKER, mode="commit")
        self.assertEqual(result["batch"]["status"], "posted")
        with connect(TEST_DB) as conn:
            lines = conn.execute(
                "SELECT l.account_code, l.debit, l.credit FROM journal_entry_lines l"
                " JOIN journal_entries e ON e.id = l.journal_entry_id"
                " WHERE e.event_type = 'OPENING_STOCK' AND e.status = 'posted' ORDER BY l.id"
            ).fetchall()
            valuation = conn.execute(
                "SELECT COUNT(*) AS n FROM inventory_valuation_ledger WHERE movement_type = 'opening'"
            ).fetchone()
        self.assertEqual(len(lines), 2)
        self.assertEqual(lines[0]["account_code"], "156")
        self.assertEqual(Decimal(str(lines[0]["debit"])), Decimal("4000000.00"))
        self.assertEqual(lines[1]["account_code"], "411")
        self.assertEqual(Decimal(str(lines[1]["credit"])), Decimal("4000000.00"))
        self.assertGreaterEqual(int(valuation["n"]), 1)

    def test_08_post_retry_no_duplicate(self):
        from db.connection import connect
        retry = self._service().post_batch(TEST_DB, self.batch_id, CHECKER, mode="commit")
        self.assertFalse(retry.get("created", True))
        with connect(TEST_DB) as conn:
            count = conn.execute(
                "SELECT COUNT(*) AS n FROM journal_entries WHERE event_type = 'OPENING_STOCK'"
            ).fetchone()
        self.assertEqual(int(count["n"]), 1)

    def test_09_posted_batch_immutable(self):
        from services.posting_service import PostingError
        with self.assertRaises(PostingError):
            self._service().delete_draft_batch(TEST_DB, self.batch_id, MAKER)

    def test_10_sync_cogs_then_reconciliation_balances(self):
        from services.ledger_sync_service import sync_ledger
        sync_ledger(TEST_DB, mode="commit", actor="tester")
        report = self._service().inventory_reconciliation(TEST_DB)
        self.assertEqual(len(report["products"]), 1)
        row = report["products"][0]
        # Tồn đầu 8 (4tr) + Nhập 0 − Xuất 6 (3tr) ± 0 = Tồn cuối 2 (1tr)
        self.assertEqual(Decimal(row["opening"]["qty"]), Decimal("8"))
        self.assertEqual(Decimal(row["opening"]["value"]), Decimal("4000000.00"))
        self.assertEqual(Decimal(row["stockOut"]["qty"]), Decimal("6"))
        self.assertEqual(Decimal(row["stockOut"]["value"]), Decimal("3000000.00"))
        self.assertEqual(Decimal(row["closing"]["qty"]), Decimal("2"))
        self.assertEqual(Decimal(row["closing"]["value"]), Decimal("1000000.00"))
        # Sổ cái 156: Nợ 4tr (tồn đầu) − Có 3tr (giá vốn) = 1tr = thẻ kho
        self.assertEqual(Decimal(row["ledger156"]["balance"]), Decimal("1000000.00"))
        self.assertTrue(row["balanced"])
        self.assertTrue(report["totals"]["balanced"])
        self.assertEqual(report["unpostedMovements"], [])

    def test_11_reverse_requires_reason_and_is_idempotent(self):
        from db.connection import connect
        from services.posting_service import PostingError
        with self.assertRaises(PostingError):
            self._service().reverse_batch(TEST_DB, self.batch_id, CHECKER, "")
        first = self._service().reverse_batch(TEST_DB, self.batch_id, CHECKER, "Khai sai kỳ — lập lại")
        self.assertEqual(first["batch"]["status"], "reversed")
        retry = self._service().reverse_batch(TEST_DB, self.batch_id, CHECKER, "Khai sai kỳ — lập lại")
        self.assertFalse(retry["created"])
        with connect(TEST_DB) as conn:
            reversals = conn.execute(
                "SELECT COUNT(*) AS n FROM journal_entries WHERE reversal_of IS NOT NULL"
            ).fetchone()
        self.assertEqual(int(reversals["n"]), 1)

    def test_12_reconciliation_flags_missing_opening(self):
        # Sau khi đảo, tồn đầu không còn được ghi sổ → báo cáo phải CHỈ RA chênh lệch,
        # tuyệt đối không âm thầm cân bằng.
        report = self._service().inventory_reconciliation(TEST_DB)
        self.assertFalse(report["totals"]["balanced"])
        reasons = [item["reason"] for item in report["unpostedMovements"]]
        self.assertTrue(any("Opening Inventory Batch" in reason for reason in reasons))


if __name__ == "__main__":
    unittest.main()
