"""Kiểm thử Delete Policy Ở BACKEND — gọi thẳng route handler, không qua frontend.

Phủ các quy tắc bắt buộc:
  - Bản nháp chưa liên kết: xóa được.
  - Bản ghi đã duyệt / đã ghi sổ: chặn (409 + mã cấu trúc).
  - Sản phẩm có lịch sử kho: chặn — chỉ được ngừng kinh doanh.
  - Nhân viên có bảng lương/đang làm việc: chặn — chỉ chuyển trạng thái.
  - Người không đủ quyền gọi DELETE: chặn.
  - Retry API đảo: không sinh hai chứng từ đảo.
  - Mọi lần chặn đều ghi audit log; vi phạm rollback toàn transaction.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from db.connection import connect
from db.schema import init_db
from db.state_store import read_state, write_state
from routes import company_data as company_data_route
from routes import employees as employees_route
from services import posting_service
from tests.postgres_test_case import PostgresTestCase


class ApiHandler:
    """Mô phỏng handler HTTP tối giản — route thật, quyền thật, response thật."""

    def __init__(self, db_path, body, role="admin", email="admin@example.com"):
        self.db_path = db_path
        self.body = body
        self.role = role
        self.email = email
        self.response = None
        self.status = None

    def require_user(self, roles=None):
        user = {"email": self.email, "role": self.role}
        if roles and self.role not in roles:
            self.send_json({"error": "Không đủ quyền."}, 403)
            return None
        return user

    def is_full_admin(self, user):
        return (user or {}).get("role") in {"admin", "accountant"}

    def read_json(self):
        return self.body

    @staticmethod
    def preserve_restricted_state(data, _user, _existing_data=None):
        return data

    @staticmethod
    def filter_state(state, _user):
        return state

    def send_json(self, payload, status=200):
        self.response = payload
        self.status = status


SEED = {
    "transactions": [
        {"id": "tx-draft", "kind": "chi", "amount": 50000, "desc": "Nháp chưa vào sổ", "date": "2026-08-01", "source": "manual_finance_hub"},
        {"id": "tx-posted", "kind": "chi", "amount": 200000, "desc": "Đã ghi sổ", "date": "2026-08-01", "source": "manual_finance_hub"},
    ],
    "tasks": [
        {"id": "task-approved", "title": "Việc đã nghiệm thu", "employeeId": 7, "completionStatus": "approved"},
        {"id": "task-draft", "title": "Việc thường", "employeeId": 7},
    ],
    "inventory": [
        {"id": "prod-hist", "name": "SP có lịch sử kho", "costPrice": 100000, "stock": 5},
        {"id": "prod-clean", "name": "SP chưa dùng", "costPrice": 100000, "stock": 0},
    ],
    "stockMovements": [
        {"id": "mv-open", "productId": "prod-hist", "movementType": "opening", "delta": 5, "date": "2026-08-01"},
    ],
    "payrollPayments": [
        {"id": "pay-1", "employeeId": 7, "amount": 5000000, "paidDate": "2026-07-31"},
    ],
    "debts": [
        {"id": "debt-1", "type": "thu", "orderId": "ord-1", "amount": 100000, "counterpartyName": "Khách"},
    ],
    "orders": [],
    "paymentLedger": [],
    "supportCases": [
        {"id": "case-draft", "status": "cho_xac_nhan", "customerName": "Khách hỗ trợ"},
    ],
}


class DeletePolicyApiTests(PostgresTestCase):
    def setUp(self):
        super().setUp()
        init_db(self.db_path)
        write_state(self.db_path, {key: [dict(x) for x in value] if isinstance(value, list) else value for key, value in SEED.items()})
        # Đánh dấu tx-posted đã vào sổ cái thật sự.
        posting_service.post_entry(
            self.db_path,
            event_type="MANUAL_EXPENSE", source_type="manual_tx", source_id="tx-posted",
            document_date="2026-08-01", description="Chi phí đã ghi sổ",
            lines=[{"account": "642", "debit": 200000}, {"account": "111", "credit": 200000}],
            created_by="seed@test.vn",
        )

    def _put_fields(self, patch, role="admin"):
        version = read_state(self.db_path)["version"]
        handler = ApiHandler(self.db_path, {"data": patch, "expectedVersion": version}, role=role)
        self.assertTrue(company_data_route.handle_put(handler, "/api/data/fields", None))
        return handler

    def _state_data(self):
        return read_state(self.db_path)["data"]

    def _audit_blocked_count(self):
        with connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'delete_blocked'"
            ).fetchone()
        return int(row["n"])

    # 1. Bản nháp chưa liên kết: xóa được theo policy.
    def test_delete_unlinked_draft_succeeds(self):
        data = self._state_data()
        patch = {"transactions": [tx for tx in data["transactions"] if tx["id"] != "tx-draft"]}
        handler = self._put_fields(patch)
        self.assertEqual(handler.status, 200)
        remaining = {tx["id"] for tx in self._state_data()["transactions"]}
        self.assertNotIn("tx-draft", remaining)
        self.assertIn("tx-posted", remaining)

    # 2. Bản ghi đã duyệt (việc đã nghiệm thu): NGƯỜI THƯỜNG bị chặn RECORD_LOCKED;
    #    RIÊNG ADMIN được chủ động xóa khỏi lịch sử.
    def test_delete_approved_task_blocked_for_non_admin(self):
        data = self._state_data()
        patch = {"tasks": [t for t in data["tasks"] if t["id"] != "task-approved"]}
        handler = self._put_fields(patch, role="user")
        self.assertEqual(handler.status, 409)
        self.assertEqual(handler.response["code"], "RECORD_LOCKED")
        self.assertEqual(handler.response["record"]["type"], "task")
        self.assertTrue(handler.response["allowedActions"])
        # Transaction rollback — dữ liệu còn nguyên.
        self.assertIn("task-approved", {t["id"] for t in self._state_data()["tasks"]})
        self.assertGreaterEqual(self._audit_blocked_count(), 1)

    def test_admin_can_delete_approved_task(self):
        data = self._state_data()
        patch = {"tasks": [t for t in data["tasks"] if t["id"] != "task-approved"]}
        handler = self._put_fields(patch, role="admin")
        self.assertEqual(handler.status, 200)
        self.assertNotIn("task-approved", {t["id"] for t in self._state_data()["tasks"]})

    # 2b. Yêu cầu hỗ trợ: KHÔNG xóa thật ở bất kỳ trạng thái nào (kể cả chờ xác nhận) —
    #     phải HỦY kèm lý do; riêng admin được hard-delete.
    def test_delete_support_case_blocked_for_non_admin(self):
        patch = {"supportCases": []}
        handler = self._put_fields(patch, role="user")
        self.assertEqual(handler.status, 409)
        self.assertEqual(handler.response["code"], "RECORD_LOCKED")
        self.assertEqual(handler.response["record"]["type"], "support_case")
        self.assertIn("cancel_with_reason", handler.response["allowedActions"])
        self.assertIn("case-draft", {c["id"] for c in self._state_data()["supportCases"]})

    def test_admin_can_delete_support_case(self):
        patch = {"supportCases": []}
        handler = self._put_fields(patch, role="admin")
        self.assertEqual(handler.status, 200)
        self.assertEqual(self._state_data()["supportCases"], [])

    # 3. Chứng từ đã ghi sổ: chặn REVERSAL_REQUIRED.
    def test_delete_posted_transaction_blocked(self):
        data = self._state_data()
        patch = {"transactions": [tx for tx in data["transactions"] if tx["id"] != "tx-posted"]}
        handler = self._put_fields(patch)
        self.assertEqual(handler.status, 409)
        self.assertEqual(handler.response["code"], "REVERSAL_REQUIRED")
        self.assertIn("red_entry_reversal", handler.response["allowedActions"])
        self.assertIn("tx-posted", {tx["id"] for tx in self._state_data()["transactions"]})

    # 4. Sản phẩm có stock movement: chặn RECORD_HAS_REFERENCES.
    def test_delete_product_with_stock_history_blocked(self):
        data = self._state_data()
        patch = {"inventory": [p for p in data["inventory"] if p["id"] != "prod-hist"]}
        handler = self._put_fields(patch)
        self.assertEqual(handler.status, 409)
        self.assertEqual(handler.response["code"], "RECORD_HAS_REFERENCES")
        self.assertIn("discontinue", handler.response["allowedActions"])
        # Sản phẩm CHƯA có lịch sử thì xóa được.
        data = self._state_data()
        patch = {"inventory": [p for p in data["inventory"] if p["id"] != "prod-clean"]}
        handler = self._put_fields(patch)
        self.assertEqual(handler.status, 200)

    # 5. Nhân viên đang làm việc / có bảng lương: chặn qua DELETE /api/employees.
    def test_delete_employee_blocked(self):
        from db.employee_store import replace_all
        replace_all(self.db_path, [{"id": 7, "name": "NV Test", "email": "nv7@test.vn", "status": "active"}])
        handler = ApiHandler(self.db_path, {"employeeId": 7})
        self.assertTrue(employees_route.handle_delete(handler, "/api/employees", None))
        self.assertEqual(handler.status, 409)
        self.assertEqual(handler.response["code"], "RECORD_LOCKED")
        self.assertIn("set_inactive", handler.response["allowedActions"])
        # Đã nghỉ việc nhưng còn bảng lương/nhiệm vụ tham chiếu → vẫn chặn.
        replace_all(self.db_path, [{"id": 7, "name": "NV Test", "email": "nv7@test.vn", "status": "inactive"}])
        handler = ApiHandler(self.db_path, {"employeeId": 7})
        self.assertTrue(employees_route.handle_delete(handler, "/api/employees", None))
        self.assertEqual(handler.status, 409)
        self.assertEqual(handler.response["code"], "RECORD_HAS_REFERENCES")

    # 6. Người không đủ quyền gọi DELETE: bị chặn 403.
    def test_delete_without_permission_blocked(self):
        handler = ApiHandler(self.db_path, {"employeeId": 7}, role="user", email="user@test.vn")
        self.assertTrue(employees_route.handle_delete(handler, "/api/employees", None))
        self.assertEqual(handler.status, 403)
        handler = ApiHandler(self.db_path, {"debtId": "debt-1", "paymentId": "p", "reason": "x"}, role="user", email="user@test.vn")
        self.assertTrue(company_data_route.handle_delete(handler, "/api/company-data/debt-payments", None))
        self.assertEqual(handler.status, 403)

    # 7. Retry API đảo: không sinh hai chứng từ đảo.
    def test_reverse_retry_no_duplicate(self):
        with connect(self.db_path) as conn:
            entry = conn.execute(
                "SELECT id FROM journal_entries WHERE source_type = 'manual_tx' AND source_id = 'tx-posted'"
            ).fetchone()
        first = posting_service.reverse_entry(self.db_path, entry["id"], "admin@example.com", "Test đảo")
        again = posting_service.reverse_entry(self.db_path, entry["id"], "admin@example.com", "Test đảo")
        self.assertTrue(first.get("created"))
        self.assertFalse(again.get("created"))
        self.assertEqual(first["id"], again["id"])
        with connect(self.db_path) as conn:
            count = conn.execute(
                "SELECT COUNT(*) AS n FROM journal_entries WHERE reversal_of = ?", (entry["id"],)
            ).fetchone()
        self.assertEqual(int(count["n"]), 1)


if __name__ == "__main__":
    unittest.main()
