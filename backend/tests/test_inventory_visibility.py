from __future__ import annotations

import sys
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from server import _inventory_is_unassigned, _record_belongs_to_employee


def visible_for_employee(inventory, employee_id):
    """Đúng quy tắc lọc kho của _user_visible_data cho nhóm vị trí không có quyền xem toàn bộ."""
    return [
        item for item in inventory
        if _inventory_is_unassigned(item)
        or _record_belongs_to_employee(item, employee_id, "assignedEmployeeId")
    ]


class InventoryVisibilityTests(unittest.TestCase):
    def setUp(self):
        self.inventory = [
            {"id": 1, "name": "Hàng chung không gán"},
            {"id": 2, "name": "Hàng chung gán rỗng", "assignedEmployeeId": ""},
            {"id": 3, "name": "Hàng chung gán null", "assignedEmployeeId": None},
            {"id": 4, "name": "Hàng của nhân viên 10", "assignedEmployeeId": 10},
            {"id": 5, "name": "Hàng của nhân viên 20", "assignedEmployeeId": 20},
        ]

    def test_unassigned_products_are_visible_to_every_employee(self):
        names = [item["name"] for item in visible_for_employee(self.inventory, 10)]
        self.assertIn("Hàng chung không gán", names)
        self.assertIn("Hàng chung gán rỗng", names)
        self.assertIn("Hàng chung gán null", names)

    def test_assigned_product_is_visible_only_to_its_owner(self):
        for_ten = [item["id"] for item in visible_for_employee(self.inventory, 10)]
        for_twenty = [item["id"] for item in visible_for_employee(self.inventory, 20)]
        self.assertIn(4, for_ten)
        self.assertNotIn(5, for_ten)
        self.assertIn(5, for_twenty)
        self.assertNotIn(4, for_twenty)

    def test_employee_without_profile_still_sees_shared_products_only(self):
        result = [item["id"] for item in visible_for_employee(self.inventory, None)]
        self.assertEqual(result, [1, 2, 3])

    def test_zero_or_invalid_assignment_counts_as_shared(self):
        self.assertTrue(_inventory_is_unassigned({"assignedEmployeeId": 0}))
        self.assertTrue(_inventory_is_unassigned({"assignedEmployeeId": "0"}))
        self.assertTrue(_inventory_is_unassigned({"assignedEmployeeId": -3}))
        self.assertFalse(_inventory_is_unassigned({"assignedEmployeeId": 7}))
        self.assertFalse(_inventory_is_unassigned({"assignedEmployeeId": "7"}))


if __name__ == "__main__":
    unittest.main()
