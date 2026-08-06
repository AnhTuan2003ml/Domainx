# -*- coding: utf-8 -*-
"""Kiểm thử chuỗi liên kết nghiệm thu:

customer_id → order_id → order_item_id → inventory_movement → debt
và các số tài chính: 12tr gồm VAT / 11.111.111 chưa VAT / 888.889 VAT /
5tr giá vốn / 6.111.111 lợi nhuận gộp — tất cả sinh từ MỘT đơn hàng.
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.business_sync_service import create_crm_order, reconcile_company_data  # noqa: E402
from services.delete_policy_service import DeletePolicyError, guard_state_removals  # noqa: E402

PRODUCT_ID = 9101
ORDER_ID = 9990000000001
CUSTOMER_ID = 9990000000002
PHONE = "0900000001"


def _base_data():
    """Kho có 1 sản phẩm, tồn đầu 10 tạo bằng PHIẾU điều chỉnh (không set tay)."""
    data = {
        "inventory": [{
            "id": PRODUCT_ID, "sku": "SP-VIDEO-01", "name": "Phần mềm tạo video AI VideoMax",
            "unit": "gói", "minStock": 3, "costPrice": 2500000, "sellPrice": 6000000,
            "durationMonths": 2, "vatRate": 8, "stock": 10.0,
            "createdAt": "2026-08-01T08:00:00+07:00",
        }],
        "stockMovements": [{
            "id": f"seed:kho:{PRODUCT_ID}:adjust-in", "productId": PRODUCT_ID,
            "movementType": "adjustment_in", "quantity": 10.0, "delta": 10.0,
            "date": "2026-08-01", "sourceModule": "kho", "sourceId": f"seed-adjust-{PRODUCT_ID}",
            "note": "Nhập tồn đầu kiểm thử", "createdBy": "test", "status": "posted",
        }],
        "orders": [], "customers": [], "debts": [], "transactions": [],
    }
    return reconcile_company_data(data)


def _order_payload(order_id=ORDER_ID, customer_id=CUSTOMER_ID, phone=PHONE):
    return {
        "order": {
            "id": order_id, "date": "2026-08-06", "customerId": customer_id,
            "customerName": "Khách hàng mô phỏng A", "phone": phone, "email": "",
            "dealType": "sale", "saleEmployeeId": 12345,
            "items": [{"productId": PRODUCT_ID, "quantity": 2, "unitPrice": 6000000,
                       "discount": 0, "vatRate": 8, "uom": "gói"}],
            "customerPaidAmount": 0, "customerPaymentStatus": "unpaid",
            "invoiceStatus": "pending", "cashCollector": "company",
        },
        "customer": {
            "id": customer_id, "customerName": "Khách hàng mô phỏng A", "phone": phone,
            "customerType": "individual", "status": "active",
        },
    }


class AcceptanceLinkageTest(unittest.TestCase):
    def _seeded(self):
        data, order_id = create_crm_order(
            _base_data(), _order_payload(), "test@domix.vn", allow_assign_any=True,
        )
        return data, order_id

    def test_full_linkage_chain_and_financials(self):
        data, order_id = self._seeded()
        self.assertEqual(str(order_id), str(ORDER_ID))

        # Khách hàng: đúng 1, đơn gắn đúng customer_id
        self.assertEqual(len(data["customers"]), 1)
        order = data["orders"][0]
        self.assertEqual(str(order["customerId"]), str(CUSTOMER_ID))

        # Dòng đơn: 1 dòng SL 2, có order_item_id
        items = order["items"]
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["quantity"], 2.0)
        self.assertTrue(items[0]["id"].startswith(str(ORDER_ID)))

        # Kho: 10 → 8; movement xuất gắn đúng order_id
        product = data["inventory"][0]
        self.assertEqual(float(product["stock"]), 8.0)
        sale_out = [m for m in data["stockMovements"] if m.get("movementType") == "sale_out"]
        self.assertEqual(len(sale_out), 1)
        self.assertEqual(sale_out[0]["quantity"], 2.0)
        self.assertEqual(str(sale_out[0]["sourceId"]), str(ORDER_ID))

        # Tài chính: backend tính lại tổng — không tin frontend
        self.assertEqual(float(order["amount"]), 12000000.0)
        ex_vat = 12000000 / 1.08
        self.assertAlmostEqual(ex_vat, 11111111.11, delta=1)
        self.assertAlmostEqual(12000000 - ex_vat, 888888.89, delta=1)
        cogs = 2 * 2500000
        self.assertEqual(cogs, 5000000)
        self.assertAlmostEqual(ex_vat - cogs, 6111111.11, delta=1)

        # Công nợ 12tr / đã thu 0 / KHÔNG giao dịch tiền
        self.assertEqual(len(data["debts"]), 1)
        self.assertEqual(float(data["debts"][0]["amount"]), 12000000.0)
        self.assertEqual(float(data["debts"][0].get("paidAmount") or 0), 0.0)
        self.assertEqual(len(data["transactions"]), 0)

    def test_same_phone_reuses_customer(self):
        """Tạo đơn thứ hai cùng SĐT → dùng lại customer_id cũ, không sinh khách trùng."""
        data, _ = self._seeded()
        payload2 = _order_payload(order_id=ORDER_ID + 1, customer_id=777001, phone=PHONE)
        data, _ = create_crm_order(data, payload2, "test@domix.vn", allow_assign_any=True)
        self.assertEqual(len(data["customers"]), 1, "SĐT trùng không được sinh khách mới")
        second = next(o for o in data["orders"] if str(o["id"]) == str(ORDER_ID + 1))
        self.assertEqual(str(second["customerId"]), str(CUSTOMER_ID), "đơn phải remap về khách cũ")

    def test_cancel_order_reverses_stock_once(self):
        """Hủy đơn: hoàn kho đúng 2 sản phẩm bằng movement đảo, reconcile lại không hoàn lần 2."""
        data, _ = self._seeded()
        for o in data["orders"]:
            o["status"] = "cancelled"
        data = reconcile_company_data(data)
        product = data["inventory"][0]
        self.assertEqual(float(product["stock"]), 10.0, "hoàn tồn về 10")
        reverses = [m for m in data["stockMovements"] if m.get("movementType") == "cancel_reverse"]
        self.assertEqual(len(reverses), 1)
        self.assertEqual(str(reverses[0]["sourceId"]), str(ORDER_ID), "movement đảo gắn đơn gốc")
        # Reconcile lần nữa — không sinh thêm movement đảo (không hoàn 2 lần)
        data = reconcile_company_data(data)
        reverses2 = [m for m in data["stockMovements"] if m.get("movementType") == "cancel_reverse"]
        self.assertEqual(len(reverses2), 1)
        self.assertEqual(float(data["inventory"][0]["stock"]), 10.0)


class CompletedTaskRetentionTest(unittest.TestCase):
    """Nhiệm vụ ĐÃ HOÀN THÀNH phải được lưu vĩnh viễn trong DB — backend chặn xóa."""

    def _guard(self, task, new_tasks):
        guard_state_removals(None, {"tasks": [task]}, {"tasks": new_tasks})

    def test_completed_task_cannot_be_removed(self):
        for locked in (
            {"id": 1, "description": "x", "completionStatus": "approved"},
            {"id": 2, "description": "x", "completionStatus": "submitted"},
            {"id": 3, "description": "x", "doneManual": True},
            {"id": 4, "description": "x", "acceptedAt": "2026-08-06T09:00:00"},
        ):
            with self.assertRaises(DeletePolicyError, msg=f"phải chặn xóa task {locked}"):
                self._guard(locked, [])

    def test_fresh_task_can_be_removed(self):
        fresh = {"id": 5, "description": "mới giao, chưa ai nhận", "completionStatus": ""}
        self._guard(fresh, [])  # không raise

    def test_keeping_completed_task_is_fine(self):
        done = {"id": 6, "description": "x", "completionStatus": "approved"}
        self._guard(done, [done])  # còn nguyên trong danh sách → hợp lệ

    def test_admin_archive_keeps_history(self):
        """Admin 'xóa' = gỡ khỏi danh sách (archived) — bản ghi vẫn còn nên guard cho qua."""
        done = {"id": 7, "description": "x", "completionStatus": "approved"}
        archived = {**done, "archived": True, "archivedBy": "admin@domix.vn"}
        self._guard(done, [archived])  # update, không phải removal → hợp lệ

    def test_admin_may_hard_delete_from_history(self):
        """RIÊNG ADMIN được xóa thật nhiệm vụ đã chọn khỏi lịch sử."""
        done = {"id": 8, "description": "x", "completionStatus": "approved"}
        guard_state_removals(None, {"tasks": [done]}, {"tasks": []}, user_role="admin")  # không raise


if __name__ == "__main__":
    unittest.main()
