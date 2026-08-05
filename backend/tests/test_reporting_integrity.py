from __future__ import annotations

import sys
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.invoice_status_service import summarize_invoices
from services.operational_ledger_service import _unique_value
from db.connection import connect
from tests.postgres_test_case import PostgresTestCase


class ReportingIntegrityTests(PostgresTestCase):
    def test_duplicate_legacy_payment_suffix_gets_unique_hashed_codes(self):
        with connect(self.db_path) as conn:
            conn.execute("CREATE TABLE debt_payments (id TEXT PRIMARY KEY, payment_code TEXT UNIQUE)")
            base = "THU-NG-PAYMENT"
            first_id = "legacy:order:first:opening-payment"
            second_id = "legacy:order:second:opening-payment"
            third_id = "legacy:order:third:opening-payment"
            conn.execute("INSERT INTO debt_payments VALUES (?, ?)", (first_id, base))

            second_code = _unique_value(conn, "debt_payments", "payment_code", base, second_id)
            conn.execute("INSERT INTO debt_payments VALUES (?, ?)", (second_id, second_code))
            third_code = _unique_value(conn, "debt_payments", "payment_code", base, third_id)

        self.assertNotEqual(second_code, base)
        self.assertNotEqual(third_code, base)
        self.assertNotEqual(second_code, third_code)
        self.assertNotIn(":opening-payment", second_code)

    def test_invoice_summary_only_counts_requested_month(self):
        orders = [
            {"id": 7, "date": "2026-07-20", "invoiceStatus": "pending"},
            {"id": 8, "date": "2026-08-05", "invoiceStatus": "missing"},
            {"id": 9, "date": "2026-09-01", "invoiceStatus": "missing"},
        ]

        august = summarize_invoices(orders, "2026-08-01", "2026-08-05")

        self.assertEqual(august["counts"]["missing"], 1)
        self.assertEqual(august["counts"]["pending"], 0)
        self.assertEqual(august["order_ids"]["missing"], [8])


if __name__ == "__main__":
    unittest.main(verbosity=2)
