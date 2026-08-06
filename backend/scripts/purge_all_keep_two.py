# -*- coding: utf-8 -*-
"""LÀM SẠCH TOÀN BỘ dữ liệu (kể cả nhân sự) — chỉ giữ lại 2 tài khoản:

  - tuankkffdnc@gmail.com  (admin · Phạm Anh Tuấn)
  - hoangngochiep62@gmail.com  (user · Hoàng Ngọc Hiệp)

Hai hồ sơ nhân sự tương ứng được GIỮ nhưng làm sạch dữ liệu phát sinh
(chấm công, phụ cấp, KPI, bảo hiểm cố định, tạm ứng...).
Giữ nguyên: cấu hình công ty, vạch KPI chung, danh mục 4 sản phẩm (tồn 0).
Chỉ chạy trong môi trường thử:  DOMIX_ALLOW_TEST_SEED=1 python scripts/purge_all_keep_two.py
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import APP_ENV, DEFAULT_DB_TARGET  # noqa: E402
from db import connection  # noqa: E402
from db.state_store import read_state, update_state  # noqa: E402
from services.business_sync_service import reconcile_company_data  # noqa: E402

DB = DEFAULT_DB_TARGET
KEEP_EMAILS = {"tuankkffdnc@gmail.com", "hoangngochiep62@gmail.com"}
ADMIN = "tuankkffdnc@gmail.com"

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

STATE_RESET_FIELDS = [
    "orders", "customers", "debts", "transactions", "stockMovements", "supportCases",
    "distributionOrders", "distributionSettlements", "distributionPartners", "paymentLedger",
    "leads", "marketingLogs", "marketingPages", "tasks", "contracts", "fixedAssets",
    "capitalContributions", "payrollApprovals", "payrollPayments", "midMonthRequests",
    "attendanceRequests", "cvReviews", "announcements", "securityAuditLog",
    "inventoryLedgerIssues",
]

DERIVED_TABLES = [
    "journal_entry_lines", "journal_entries", "inventory_valuation_ledger",
    "accounting_periods", "opening_inventory_batch_lines", "opening_inventory_batches",
    "debt_payments", "inventory_movements", "cash_transactions", "payroll_payment_ledger",
    "chat_group_reads", "chat_group_messages", "chat_group_members", "chat_groups",
    "chat_messages", "email_alert_log",
]

EMPLOYEE_RESET_SQL = (
    "UPDATE employees SET attendance = '{}', attendance_times = '{}', allowances = '[]', "
    "other_bonus = 0, advance = 0, kpi = 100, kpi_note = '', "
    "kpi_revenue_threshold = 0, kpi_revenue_pct = 0, "
    "insurance_fixed_mode = 0, insurance_employee_amount = 0, insurance_employer_amount = 0"
)


def main():
    if APP_ENV == "production" and os.environ.get("DOMIX_ALLOW_TEST_SEED") != "1":
        print("TỪ CHỐI: production — cần DOMIX_ALLOW_TEST_SEED=1 nếu đây là môi trường thử.")
        sys.exit(2)

    # 1) Sổ phụ/sổ cái/chat — xóa sạch (2 lượt tránh vướng khóa ngoại).
    for _ in range(2):
        for table in DERIVED_TABLES:
            try:
                with connection.connect(DB) as conn:
                    conn.execute(f"DELETE FROM {table}")
            except Exception as exc:
                print(f"skip {table}: {exc}")
    print("Đã xóa sổ phụ, sổ cái, chat, log email.")

    # 2) Tài khoản + nhân sự: chỉ giữ 2 email; hồ sơ giữ lại được reset dữ liệu phát sinh.
    with connection.connect(DB) as conn:
        users = conn.execute("SELECT id, username FROM users").fetchall()
        drop_users = [u for u in users if str(u["username"]).strip().lower() not in KEEP_EMAILS]
        for u in drop_users:
            conn.execute("DELETE FROM sessions WHERE user_id = ?", (u["id"],))
            conn.execute("UPDATE employees SET account_id = NULL WHERE account_id = ?", (u["id"],))
            conn.execute("DELETE FROM users WHERE id = ?", (u["id"],))
        print(f"Đã xóa {len(drop_users)} tài khoản:", [u["username"] for u in drop_users])

        emps = conn.execute("SELECT id, name, email FROM employees").fetchall()
        drop_emps = [e for e in emps if str(e["email"] or "").strip().lower() not in KEEP_EMAILS]
        for e in drop_emps:
            conn.execute("DELETE FROM employees WHERE id = ?", (e["id"],))
        print(f"Đã xóa {len(drop_emps)} hồ sơ nhân sự:", [e["name"] for e in drop_emps])

        conn.execute(EMPLOYEE_RESET_SQL)
        print("Đã reset chấm công/phụ cấp/KPI/bảo hiểm của 2 hồ sơ giữ lại.")

    # 3) State: mọi collection nghiệp vụ về rỗng; danh mục 4 sản phẩm tồn 0 giữ lại.
    def updater(data):
        d = dict(data or {})
        for field in STATE_RESET_FIELDS:
            d[field] = []
        d["inventory"] = [dict(p) for p in PRODUCTS]
        return reconcile_company_data(d)

    update_state(DB, updater)

    d = read_state(DB).get("data") or {}
    with connection.connect(DB) as conn:
        n_users = conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]
        n_emps = conn.execute("SELECT COUNT(*) AS n FROM employees").fetchone()["n"]
    print(f"Còn lại: {n_users} tài khoản · {n_emps} nhân sự.")
    print("Đơn:", len(d.get("orders") or []), "· Khách:", len(d.get("customers") or []),
          "· Thu chi:", len(d.get("transactions") or []), "· Nhiệm vụ:", len(d.get("tasks") or []),
          "· Hỗ trợ:", len(d.get("supportCases") or []), "· Vốn góp:", len(d.get("capitalContributions") or []))
    print("Kho:", {p["name"]: p.get("stock") for p in d.get("inventory") or []})


if __name__ == "__main__":
    main()
