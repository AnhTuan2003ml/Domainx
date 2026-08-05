from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from services.business_sync_service import create_crm_order
from services.support_service import (
    append_support_assignment,
    build_support_case,
    confirm_support_assignment,
)
from routes import company_data as company_data_route
from routes import support as support_route


class FakeHandler:
    def __init__(self, user, body, employees, current_employee, state, full_admin=False):
        self.user = user
        self.body = body
        self.employees = employees
        self.current_employee = current_employee
        self.state = state
        self.full_admin = full_admin
        self.db_path = "test-db"
        self.response = None
        self.status = None

    def require_user(self):
        return self.user

    def read_json(self):
        return self.body

    def employee_context(self, _user):
        return self.employees, self.current_employee, False

    @staticmethod
    def employee_position_role(employee):
        return (employee or {}).get("roleType") or ""

    def is_full_admin(self, _user):
        return self.full_admin

    @staticmethod
    def support_assignable_roles():
        return {"ky_thuat", "it", "cskh"}

    @staticmethod
    def employee_contact_email(employee):
        return employee.get("email") or ""

    @staticmethod
    def support_assignment_message(_data, _sender_name, _recipient_name):
        return "Yêu cầu hỗ trợ kiểm thử"

    @staticmethod
    def support_type_label(_value):
        return "Xử lý sự cố"

    @staticmethod
    def support_channel_label(_value):
        return "Hỗ trợ từ xa"

    @staticmethod
    def filter_state(state, _user):
        return state

    def send_json(self, payload, status=200):
        self.response = payload
        self.status = status


class SupportAndSalesWorkflowTests(unittest.TestCase):
    @staticmethod
    def _atomic_update(handler):
        def update(_db_path, updater):
            handler.state = {"data": updater(handler.state.get("data") or {}), "updatedAt": "2026-08-05T08:00:00Z"}
            return handler.state
        return update

    def test_out_of_stock_order_is_saved_without_negative_inventory(self):
        data = {
            "inventory": [{"id": 3, "name": "AI auto generate", "stock": 0, "unit": "mã"}],
            "orders": [], "customers": [], "transactions": [], "debts": [],
            "paymentLedger": [], "stockMovements": [], "distributionOrders": [],
        }
        saved, order_id = create_crm_order(data, {
            "order": {
                "id": "order-pending-stock", "date": "2026-08-05",
                "customerName": "Khách kiểm thử", "amount": 2_470_000,
                "quantity": 1, "productId": 3, "customerPaidAmount": 2_470_000,
                "customerPaymentStatus": "paid", "cashCollector": "company",
                "saleEmployeeId": 101,
            }
        }, actor_email="sale@example.com", actor_employee_id=101)

        self.assertEqual(order_id, "order-pending-stock")
        order = saved["orders"][0]
        self.assertEqual(order["inventoryStatus"], "pending_stock")
        self.assertEqual(order["inventoryShortage"], 1)
        self.assertEqual(saved["inventory"][0]["stock"], 0)
        self.assertFalse(any(item.get("movementType") == "sale_out" for item in saved["stockMovements"]))
        self.assertEqual(order["recognizedRevenue"], 2_470_000)
        self.assertEqual(sum(item.get("amount", 0) for item in saved["transactions"] if item.get("kind") == "thu"), 2_470_000)

    def test_in_stock_order_deducts_inventory_once(self):
        data = {
            "inventory": [{"id": 3, "name": "AI auto generate", "stock": 2, "unit": "mã"}],
            "orders": [], "transactions": [], "debts": [], "paymentLedger": [],
            "stockMovements": [], "distributionOrders": [],
        }
        saved, _ = create_crm_order(data, {
            "order": {
                "id": "order-fulfilled", "date": "2026-08-05",
                "customerName": "Khách đủ tồn", "amount": 2_470_000,
                "quantity": 1, "productId": 3, "customerPaidAmount": 0,
                "customerPaymentStatus": "unpaid", "saleEmployeeId": 101,
            }
        }, actor_email="sale@example.com", actor_employee_id=101)

        self.assertEqual(saved["orders"][0]["inventoryStatus"], "fulfilled")
        self.assertEqual(saved["inventory"][0]["stock"], 1)
        sales = [item for item in saved["stockMovements"] if item.get("movementType") == "sale_out"]
        self.assertEqual(len(sales), 1)

    def test_only_assigned_technician_can_confirm_and_sale_is_notification_target(self):
        payload = {
            "caseId": "support-case-1", "orderId": "order-1",
            "customerName": "Khách A", "customerPhone": "0900000000",
            "issue": "Không đăng nhập được", "details": "Cần kiểm tra tài khoản",
        }
        sale = {"email": "sale@example.com"}
        sale_employee = {"id": 10, "name": "Sale A"}
        technician = {"id": 20, "name": "Kỹ thuật A"}
        support_case = build_support_case(
            payload, sale, sale_employee, technician, "tech@example.com",
            now="2026-08-05T08:00:00+00:00",
        )
        assigned = append_support_assignment(
            {"supportCases": [], "orders": [{"id": "order-1", "contactLog": []}]},
            support_case, "Xử lý sự cố", "Hỗ trợ từ xa",
        )
        self.assertEqual(assigned["supportCases"][0]["status"], "cho_xac_nhan")
        self.assertEqual(assigned["orders"][0]["supportStatus"], "cho_xac_nhan")

        with self.assertRaisesRegex(ValueError, "đúng tài khoản kỹ thuật"):
            confirm_support_assignment(
                assigned, "support-case-1", {"id": 21, "name": "Sai người"},
                "other@example.com",
            )
        with self.assertRaisesRegex(ValueError, "đúng tài khoản kỹ thuật"):
            confirm_support_assignment(
                assigned, "support-case-1", technician,
                "other-account@example.com",
            )

        confirmed, updated_case, sale_email, already = confirm_support_assignment(
            assigned, "support-case-1", technician, "tech@example.com", "Kỹ thuật A",
            now="2026-08-05T08:05:00+00:00",
        )
        self.assertFalse(already)
        self.assertEqual(sale_email, "sale@example.com")
        self.assertEqual(updated_case["status"], "dang_ho_tro")
        self.assertEqual(confirmed["orders"][0]["supportStatus"], "dang_ho_tro")
        self.assertIn("đã xác nhận", confirmed["orders"][0]["contactLog"][-1]["note"])

    def test_support_routes_assign_then_confirm_and_notify_sale(self):
        sale = {"id": 10, "name": "Sale A", "email": "sale@example.com", "roleType": "sale"}
        technician = {"id": 20, "name": "Kỹ thuật A", "email": "tech@example.com", "roleType": "ky_thuat"}
        state = {"data": {"supportCases": [], "orders": [{"id": "order-1", "saleEmployeeId": 10, "contactLog": []}]}}
        assignment_body = {
            "caseId": "route-case-1", "orderId": "order-1", "recipientEmployeeId": 20,
            "customerName": "Khách route", "customerPhone": "0900000000",
            "issue": "Lỗi đăng nhập", "details": "Kiểm tra tài khoản",
            "supportType": "su_co", "supportChannel": "remote",
        }
        sale_handler = FakeHandler(
            {"email": "sale@example.com", "role": "user"}, assignment_body,
            [sale, technician], sale, state,
        )
        with patch.object(support_route, "update_state", side_effect=self._atomic_update(sale_handler)), \
             patch.object(support_route.chat_service, "send_message") as send_chat, \
             patch.object(support_route.email_service, "send_support_assignment_email"):
            self.assertTrue(support_route.handle_post(sale_handler, "/api/support/assign", None))
        self.assertEqual(sale_handler.status, 200)
        self.assertEqual(sale_handler.response["case"]["status"], "cho_xac_nhan")
        send_chat.assert_called_once_with("test-db", sale_handler.user, "tech@example.com", "Yêu cầu hỗ trợ kiểm thử")

        tech_handler = FakeHandler(
            {"email": "tech@example.com", "role": "user"}, {"caseId": "route-case-1"},
            [sale, technician], technician, sale_handler.state,
        )
        with patch.object(support_route, "update_state", side_effect=self._atomic_update(tech_handler)), \
             patch.object(support_route.chat_service, "send_message") as confirm_chat:
            self.assertTrue(support_route.handle_post(tech_handler, "/api/support/confirm", None))
        self.assertEqual(tech_handler.status, 200)
        self.assertTrue(tech_handler.response["notificationSent"])
        self.assertEqual(tech_handler.response["case"]["status"], "dang_ho_tro")
        self.assertEqual(confirm_chat.call_args.args[2], "sale@example.com")

    def test_sale_order_route_persists_pending_stock_order(self):
        sale = {"id": 101, "name": "Sale Route", "email": "sale@example.com", "roleType": "sale"}
        state = {"data": {
            "inventory": [{"id": 3, "name": "AI auto generate", "stock": 0, "unit": "mã"}],
            "orders": [], "transactions": [], "debts": [], "paymentLedger": [],
            "stockMovements": [], "distributionOrders": [],
        }}
        body = {"order": {
            "id": "route-order-1", "date": "2026-08-05", "customerName": "Khách route",
            "amount": 2_470_000, "quantity": 1, "productId": 3,
            "customerPaidAmount": 2_470_000, "customerPaymentStatus": "paid",
        }}
        handler = FakeHandler({"email": "sale@example.com", "role": "user"}, body, [sale], sale, state)
        with patch.object(company_data_route, "update_state", side_effect=self._atomic_update(handler)):
            self.assertTrue(company_data_route.handle_post(handler, "/api/company-data/crm-orders", None))
        self.assertEqual(handler.status, 200)
        self.assertEqual(handler.response["inventoryStatus"], "pending_stock")
        self.assertEqual(handler.response["order"]["saleEmployeeId"], 101)
        self.assertEqual(handler.response["data"]["inventory"][0]["stock"], 0)

    def test_api_permission_matrix_rejects_position_role_mismatches(self):
        sale = {"id": 10, "name": "Sale", "email": "sale@example.com", "roleType": "sale"}
        technician = {"id": 20, "name": "Kỹ thuật", "email": "tech@example.com", "roleType": "ky_thuat"}
        hr = {"id": 30, "name": "Nhân sự", "email": "hr@example.com", "roleType": "nhan_su"}
        state = {"data": {"supportCases": [], "orders": [], "inventory": [], "transactions": [], "debts": [], "paymentLedger": [], "stockMovements": [], "distributionOrders": []}}

        assign_body = {
            "caseId": "permission-case", "recipientEmployeeId": 20,
            "issue": "Kiểm thử quyền", "details": "Không được vượt qua API",
        }
        hr_assign = FakeHandler(
            {"email": "hr@example.com", "role": "user"}, assign_body,
            [sale, technician, hr], hr, state,
        )
        self.assertTrue(support_route.handle_post(hr_assign, "/api/support/assign", None))
        self.assertEqual(hr_assign.status, 403)

        sale_confirm = FakeHandler(
            {"email": "sale@example.com", "role": "user"}, {"caseId": "permission-case"},
            [sale, technician, hr], sale, state,
        )
        self.assertTrue(support_route.handle_post(sale_confirm, "/api/support/confirm", None))
        self.assertEqual(sale_confirm.status, 403)

        crm_body = {"order": {"id": "forbidden-order", "customerName": "Khách", "amount": 1000}}
        hr_crm = FakeHandler(
            {"email": "hr@example.com", "role": "user"}, crm_body,
            [sale, technician, hr], hr, state,
        )
        self.assertTrue(company_data_route.handle_post(hr_crm, "/api/company-data/crm-orders", None))
        self.assertEqual(hr_crm.status, 403)

    def test_api_account_role_can_grant_broader_access_than_position(self):
        hr = {"id": 30, "name": "Nhân sự", "email": "admin@example.com", "roleType": "nhan_su"}
        state = {"data": {
            "inventory": [], "orders": [], "customers": [], "transactions": [], "debts": [],
            "paymentLedger": [], "stockMovements": [], "distributionOrders": [],
        }}
        handler = FakeHandler(
            {"email": "admin@example.com", "role": "admin"},
            {"order": {"id": "admin-order", "date": "2026-08-05", "customerName": "Khách", "amount": 1000}},
            [hr], hr, state, full_admin=True,
        )
        with patch.object(company_data_route, "update_state", side_effect=self._atomic_update(handler)):
            self.assertTrue(company_data_route.handle_post(handler, "/api/company-data/crm-orders", None))
        self.assertEqual(handler.status, 200)
        self.assertEqual(handler.response["orderId"], "admin-order")


if __name__ == "__main__":
    unittest.main(verbosity=2)
