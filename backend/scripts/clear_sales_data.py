# -*- coding: utf-8 -*-
"""Xóa sạch dữ liệu để kiểm thử: MỌI số liệu tài chính chỉ sinh từ thao tác mới.

Giữ lại: hồ sơ nhân sự + tài khoản đăng nhập (nền tảng phân quyền/tạo đơn),
thông tin công ty, và DANH MỤC 4 SẢN PHẨM với TỒN = 0 (không nhật ký tồn đầu —
tự nhập kho bằng nút +/- có lý do rồi mới bán được).
Xóa: đơn hàng, khách hàng, công nợ, thu chi, movement kho, hỗ trợ, VỐN GÓP,
chấm công + dữ liệu lương phát sinh, sổ cái kép, sổ phụ.

Chạy trong container backend:  python scripts/clear_sales_data.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import DEFAULT_DB_TARGET  # noqa: E402
from db import connection  # noqa: E402
from db.state_store import read_state, update_state  # noqa: E402
from services.business_sync_service import reconcile_company_data  # noqa: E402

DB = DEFAULT_DB_TARGET
ADMIN = "tuankkffdnc@gmail.com"

# Danh mục sản phẩm giữ lại — TỒN = 0, người kiểm thử tự nhập kho trước khi bán.
PRODUCTS = [
    {"id": 9101, "sku": "SP-VIDEO-01", "name": "Phần mềm tạo video AI VideoMax", "groupName": "Phần mềm",
     "unit": "gói", "minStock": 3, "costPrice": 2500000, "sellPrice": 6000000, "durationMonths": 2,
     "vatRate": 8, "expiryDate": "", "stock": 0.0, "supplierName": "", "createdBy": ADMIN,
     "createdAt": "2026-06-01T08:00:00+07:00"},
    {"id": 9102, "sku": "SP-KETOAN-01", "name": "Phần mềm kế toán DOMIX Pro", "groupName": "Phần mềm",
     "unit": "gói", "minStock": 2, "costPrice": 5000000, "sellPrice": 12000000, "durationMonths": 12,
     "vatRate": 8, "expiryDate": "", "stock": 0.0, "supplierName": "", "createdBy": ADMIN,
     "createdAt": "2026-06-01T08:00:00+07:00"},
    {"id": 9103, "sku": "SP-CAM-01", "name": "Camera AI an ninh SmartCam", "groupName": "Thiết bị",
     "unit": "bộ", "minStock": 5, "costPrice": 2800000, "sellPrice": 4500000, "durationMonths": 0,
     "vatRate": 10, "expiryDate": "", "stock": 0.0, "supplierName": "Công ty thiết bị Anh Quân",
     "createdBy": ADMIN, "createdAt": "2026-06-01T08:00:00+07:00"},
    {"id": 9104, "sku": "SP-WIN-01", "name": "USB bản quyền Windows 11 Pro", "groupName": "Bản quyền",
     "unit": "chiếc", "minStock": 4, "costPrice": 1900000, "sellPrice": 3200000, "durationMonths": 0,
     "vatRate": 10, "expiryDate": "", "stock": 0.0, "supplierName": "Nhà phân phối SoftKey",
     "createdBy": ADMIN, "createdAt": "2026-06-01T08:00:00+07:00"},
]


def updater(data):
    d = dict(data or {})
    d["inventory"] = [dict(p) for p in PRODUCTS]
    d["stockMovements"] = []
    d["orders"] = []
    d["customers"] = []
    d["debts"] = []
    d["transactions"] = []
    d["supportCases"] = []
    d["distributionOrders"] = []
    d["distributionSettlements"] = []
    d["paymentLedger"] = []
    d["leads"] = []
    d["inventoryLedgerIssues"] = []
    # Vốn góp + dữ liệu lương/chấm công phát sinh cũng phải sạch — mọi bút toán
    # trong sổ cái sau reset chỉ được sinh từ thao tác kiểm thử mới.
    d["capitalContributions"] = []
    d["payrollApprovals"] = []
    d["payrollPayments"] = []
    d["midMonthRequests"] = []
    d["attendanceRequests"] = []
    return reconcile_company_data(d)


def truncate_derived_ledgers():
    tables = [
        "journal_entry_lines", "journal_entries", "inventory_valuation_ledger",
        "accounting_periods", "opening_inventory_batch_lines", "opening_inventory_batches",
        "debt_payments", "inventory_movements", "cash_transactions",
        "payroll_payment_ledger",
    ]
    for table in tables:
        try:
            with connection.connect(DB) as conn:
                conn.execute(f"DELETE FROM {table}")
            print(f"cleared {table}")
        except Exception as exc:
            print(f"skip {table}: {exc}")


def clear_employee_attendance():
    """Xóa chấm công/giờ vào-ra đã tích của nhân viên — hồ sơ nhân sự giữ nguyên."""
    try:
        with connection.connect(DB) as conn:
            conn.execute("UPDATE employees SET attendance = '{}', attendance_times = '{}'")
        print("cleared employees.attendance / attendance_times")
    except Exception as exc:
        print(f"skip employee attendance: {exc}")


def main():
    # Xóa bảng con trước để tránh vướng khóa ngoại, lặp 2 lượt cho chắc.
    truncate_derived_ledgers()
    truncate_derived_ledgers()
    clear_employee_attendance()
    update_state(DB, updater)
    state = read_state(DB)
    d = state.get("data") or {}
    print("Đơn hàng:", len(d.get("orders") or []),
          "· Khách:", len(d.get("customers") or []),
          "· Công nợ:", len(d.get("debts") or []),
          "· Thu chi:", len(d.get("transactions") or []),
          "· Vốn góp:", len(d.get("capitalContributions") or []),
          "· Movement kho:", len(d.get("stockMovements") or []))
    print("Tồn kho (chờ tự nhập):", {p["name"]: p.get("stock") for p in d.get("inventory") or []})


if __name__ == "__main__":
    main()
