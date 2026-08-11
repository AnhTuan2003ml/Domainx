"""Chính sách kho mở: mọi nhân viên toàn quyền kho + lịch sử chỉnh sửa + sự kiện thông báo."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from server import POSITION_PERMISSIONS, _merge_append_only_stock_movements
from services.inventory_audit_service import apply_inventory_audit


class OpenInventoryPermissionTests(unittest.TestCase):
    def test_every_position_has_full_inventory_access(self):
        for role, permissions in POSITION_PERMISSIONS.items():
            self.assertEqual(permissions.get("inventory_scope"), "all", role)
            self.assertTrue(permissions.get("inventory_write"), role)

    def test_stock_movements_append_only(self):
        existing = [{"id": 1, "productId": 10, "delta": 5}]
        incoming = [
            {"id": 1, "productId": 10, "delta": 999},  # sửa bản cũ → bị bỏ qua
            {"id": 2, "productId": 20, "delta": -2},   # movement mới → nhận
        ]
        merged = _merge_append_only_stock_movements(existing, incoming)
        self.assertEqual(len(merged), 2)
        self.assertEqual(merged[0]["delta"], 5)
        self.assertEqual(merged[1]["id"], 2)


class InventoryAuditTests(unittest.TestCase):
    def test_create_product_writes_history_and_event(self):
        events = []
        result = apply_inventory_audit(
            {"inventory": []},
            {"inventory": [{"id": 1, "name": "Khóa vân tay", "sku": "KV01", "unit": "cái", "stock": 10}]},
            actor_email="a@domix.vn", actor_name="An", events_box=events,
        )
        product = result["inventory"][0]
        self.assertEqual(len(product["history"]), 1)
        entry = product["history"][0]
        self.assertEqual(entry["action"], "create")
        self.assertEqual(entry["byEmail"], "a@domix.vn")
        self.assertEqual(entry["byName"], "An")
        self.assertTrue(entry["at"])
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["type"], "created")
        self.assertEqual(events[0]["stock"], 10.0)
        self.assertEqual(len(result["inventoryAuditLog"]), 1)

    def test_stock_change_and_field_change_tracked(self):
        existing = {"inventory": [{
            "id": 1, "name": "Khóa vân tay", "sku": "KV01", "unit": "cái",
            "stock": 10, "sellPrice": 500000,
            "history": [{"id": "invh:old", "at": "2026-08-01 09:00:00", "action": "create", "changes": []}],
        }]}
        events = []
        result = apply_inventory_audit(
            existing,
            {"inventory": [{"id": 1, "name": "Khóa vân tay", "sku": "KV01", "unit": "cái",
                            "stock": 7, "sellPrice": 550000,
                            # client cố ghi đè history → phải bị bỏ qua
                            "history": []}]},
            actor_email="b@domix.vn", actor_name="Bình", events_box=events,
        )
        product = result["inventory"][0]
        self.assertEqual(len(product["history"]), 2)
        self.assertEqual(product["history"][0]["id"], "invh:old")
        changed_fields = {change["field"] for change in product["history"][1]["changes"]}
        self.assertEqual(changed_fields, {"stock", "sellPrice"})
        stock_events = [event for event in events if event["type"] == "stock"]
        self.assertEqual(len(stock_events), 1)
        self.assertEqual(stock_events[0]["from"], 10.0)
        self.assertEqual(stock_events[0]["to"], 7.0)
        self.assertEqual(stock_events[0]["delta"], -3.0)

    def test_unchanged_product_appends_nothing(self):
        existing = {"inventory": [{"id": 1, "name": "Khóa", "stock": 4, "history": []}]}
        events = ["cũ phải bị clear"]
        result = apply_inventory_audit(
            existing, {"inventory": [{"id": 1, "name": "Khóa", "stock": 4}]},
            actor_email="c@domix.vn", actor_name="Chi", events_box=events,
        )
        self.assertEqual(result["inventory"][0]["history"], [])
        self.assertEqual(events, [])
        self.assertNotIn("inventoryAuditLog", result)

    def test_delete_product_logged_globally(self):
        existing = {"inventory": [{"id": 9, "name": "Cảm biến cũ", "stock": 0}]}
        events = []
        result = apply_inventory_audit(
            existing, {"inventory": []},
            actor_email="d@domix.vn", actor_name="Dũng", events_box=events,
        )
        self.assertEqual(result["inventory"], [])
        self.assertEqual(len(result["inventoryAuditLog"]), 1)
        self.assertEqual(result["inventoryAuditLog"][0]["action"], "delete")
        self.assertEqual(events[0]["type"], "deleted")


if __name__ == "__main__":
    unittest.main()
