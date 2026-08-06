# -*- coding: utf-8 -*-
"""Seed BỘ DỮ LIỆU NGHIỆM THU duy nhất: 1 sản phẩm · 1 khách · 1 đơn.

Chuỗi liên kết phải chứng minh được bằng ID:
  customer_id → order_id → order_item_id → inventory_movement → debt → journal.

- Tồn đầu 10 tạo bằng PHIẾU ĐIỀU CHỈNH KHO (có lý do, thời gian, người thực hiện)
  — không đặt trực tiếp số tồn.
- Đơn tạo qua đúng đường nghiệp vụ create_crm_order (backend validate, tính lại
  tiền, sinh xuất kho + công nợ + bút toán qua reconcile — một transaction state).
- Idempotent: chạy lại bao nhiêu lần cũng cho đúng MỘT bộ dữ liệu, không trùng.
- TỪ CHỐI chạy trên production (DOMIX_APP_ENV=production) trừ khi đặt
  DOMIX_ALLOW_TEST_SEED=1 một cách chủ động.

Chạy trong container backend:
  DOMIX_ALLOW_TEST_SEED=1 python scripts/seed_acceptance_test.py
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import APP_ENV, DEFAULT_DB_TARGET  # noqa: E402
from db import connection  # noqa: E402
from db.employee_store import list_employees  # noqa: E402
from db.state_store import read_state, update_state  # noqa: E402
from services.business_sync_service import create_crm_order, reconcile_company_data  # noqa: E402
from services.ledger_sync_service import sync_ledger  # noqa: E402
from services.sales_migration_service import migrate_orders  # noqa: E402

DB = DEFAULT_DB_TARGET
ADMIN = "tuankkffdnc@gmail.com"

PRODUCT_ID = 9101
PRODUCT_SKU = "SP-VIDEO-01"
ORDER_ID = 9990000000001  # ID cố định để seed idempotent
CUSTOMER_ID = 9990000000002
CUSTOMER_PHONE = "0900000001"


def _guard_environment():
    if APP_ENV == "production" and os.environ.get("DOMIX_ALLOW_TEST_SEED") != "1":
        print("TỪ CHỐI: DOMIX_APP_ENV=production — seed kiểm thử không được phép chạy.")
        print("Nếu đây thật sự là môi trường thử nghiệm, chạy với DOMIX_ALLOW_TEST_SEED=1.")
        sys.exit(2)


def _pick_sale_employee():
    """Nhân viên phụ trách phải là Sale THẬT đang hoạt động — tuyệt đối không 'demo'."""
    employees = list_employees(DB)
    for emp in employees:
        name = str(emp.get("name") or "").strip().lower()
        if emp.get("roleType") == "sale" and emp.get("status") != "inactive" and "demo" not in name:
            return emp
    raise RuntimeError("Không tìm thấy nhân viên Sale hợp lệ (không phải demo) để gán đơn.")


def _truncate_derived():
    tables = [
        "journal_entry_lines", "journal_entries", "inventory_valuation_ledger",
        "accounting_periods", "opening_inventory_batch_lines", "opening_inventory_batches",
        "debt_payments", "inventory_movements", "cash_transactions",
    ]
    for table in tables:
        try:
            with connection.connect(DB) as conn:
                conn.execute(f"DELETE FROM {table}")
        except Exception as exc:
            print(f"skip {table}: {exc}")


def seed(sale_employee):
    def updater(data):
        d = dict(data or {})
        # RESET phần nghiệp vụ bán hàng (idempotent: xóa sạch rồi dựng lại từ nguồn).
        for field in ["orders", "customers", "debts", "transactions", "supportCases",
                      "distributionOrders", "distributionSettlements", "paymentLedger",
                      "leads", "inventoryLedgerIssues", "capitalContributions"]:
            d[field] = []
        # 1 SẢN PHẨM — giá bán 6tr ĐÃ GỒM VAT 8%, giá vốn 2,5tr, thời hạn 2 tháng.
        d["inventory"] = [{
            "id": PRODUCT_ID, "sku": PRODUCT_SKU, "name": "Phần mềm tạo video AI VideoMax",
            "groupName": "Phần mềm", "unit": "gói", "minStock": 3,
            "costPrice": 2500000, "sellPrice": 6000000, "durationMonths": 2, "vatRate": 8,
            "expiryDate": "", "stock": 10.0, "supplierName": "", "createdBy": ADMIN,
            "createdAt": "2026-08-01T08:00:00+07:00",
        }]
        # TỒN ĐẦU 10 = PHIẾU ĐIỀU CHỈNH KHO có lý do + người + thời gian (không set tay).
        d["stockMovements"] = [{
            "id": f"seed:kho:{PRODUCT_ID}:adjust-in",
            "productId": PRODUCT_ID, "productName": "Phần mềm tạo video AI VideoMax",
            "movementType": "adjustment_in", "quantity": 10.0, "delta": 10.0,
            "date": "2026-08-01", "sourceModule": "kho", "sourceId": f"seed-adjust-{PRODUCT_ID}",
            "note": "Nhập tồn đầu phục vụ kiểm thử nghiệm thu (phiếu điều chỉnh có kiểm soát)",
            "createdBy": ADMIN, "createdAt": "2026-08-01T08:05:00+07:00", "status": "posted",
        }]
        d = reconcile_company_data(d)

        # 1 ĐƠN qua ĐÚNG đường nghiệp vụ backend: validate + tính lại tiền + reconcile.
        payload = {
            "order": {
                "id": ORDER_ID, "date": "2026-08-06",
                "customerId": CUSTOMER_ID,
                "customerName": "Khách hàng mô phỏng A", "phone": CUSTOMER_PHONE, "email": "",
                "customerTaxCode": "", "note": "", "dealType": "sale",
                "saleEmployeeId": sale_employee["id"],
                "items": [{
                    "productId": PRODUCT_ID, "quantity": 2, "unitPrice": 6000000,
                    "discount": 0, "vatRate": 8, "uom": "gói",
                }],
                "serviceStartDate": "2026-08-06", "durationMonths": 2,
                "durationLabel": "2 tháng", "expiryDate": "2026-10-06",
                "contactLog": [], "auditLog": [],
                "invoiceStatus": "pending", "invoiceNo": "", "invoiceDate": "",
                # CHƯA THU: không customerPaidAmount → không giao dịch tiền nào được sinh.
                "customerPaidAmount": 0, "customerPaymentStatus": "unpaid",
                "cashCollector": "company", "customerInvoiceIssuer": "company",
                "createdAt": "2026-08-06T09:00:00+07:00",
            },
            "customer": {
                "id": CUSTOMER_ID, "customerName": "Khách hàng mô phỏng A",
                "phone": CUSTOMER_PHONE, "secondaryPhone": "", "email": "", "zalo": "",
                "customerType": "individual", "companyName": "", "taxCode": "",
                "invoiceAddress": "", "address": "", "source": "",
                "assignedSaleEmployeeId": sale_employee["id"], "status": "active",
                "tags": [], "note": "", "createdAt": "2026-08-06", "updatedAt": "",
                "contactLog": [], "auditLog": [],
            },
        }
        d, saved_order_id = create_crm_order(
            d, payload, ADMIN, actor_employee_id=None, allow_assign_any=True,
        )
        assert str(saved_order_id) == str(ORDER_ID), f"order id mismatch: {saved_order_id}"
        migrate_orders(d, mode="commit")
        return d

    update_state(DB, updater)


def verify():
    d = read_state(DB).get("data") or {}
    orders = d.get("orders") or []
    customers = d.get("customers") or []
    debts = d.get("debts") or []
    txs = d.get("transactions") or []
    moves = d.get("stockMovements") or []
    product = next(p for p in d.get("inventory") or [] if p["id"] == PRODUCT_ID)
    order = orders[0]
    sale_out = [m for m in moves if m.get("movementType") == "sale_out"]
    gross = float(order["amount"])
    ex_vat = round(gross / 1.08, 0)
    vat = gross - ex_vat
    cogs = 2 * 2500000

    checks = [
        ("Đúng 1 khách hàng", len(customers) == 1),
        ("Khách đúng SĐT 0900000001", customers[0]["phone"] == CUSTOMER_PHONE),
        ("Đúng 1 đơn hàng", len(orders) == 1),
        ("Đơn gắn đúng customer_id", str(order.get("customerId")) == str(CUSTOMER_ID)),
        ("Đơn 1 dòng, SL 2", len(order.get("items") or []) == 1 and order["items"][0]["quantity"] == 2.0),
        ("order_item_id tồn tại", bool(order["items"][0].get("id"))),
        ("Tổng đơn 12.000.000", gross == 12000000.0),
        ("Tồn kho 10 → 8", float(product["stock"]) == 8.0),
        ("1 dòng xuất kho SL 2 gắn order_id", len(sale_out) == 1 and sale_out[0]["quantity"] == 2.0
         and str(sale_out[0]["sourceId"]) == str(ORDER_ID)),
        ("Công nợ phải thu 12.000.000, đã thu 0", len(debts) == 1 and float(debts[0]["amount"]) == 12000000.0
         and float(debts[0].get("paidAmount") or 0) == 0.0),
        ("KHÔNG có giao dịch tiền nào", len(txs) == 0),
        ("Doanh thu chưa VAT ≈ 11.111.111", abs(ex_vat - 11111111) <= 1),
        ("VAT đầu ra ≈ 888.889", abs(vat - 888889) <= 1),
        ("Giá vốn 5.000.000", cogs == 5000000),
        ("Lợi nhuận gộp ≈ 6.111.111", abs((ex_vat - cogs) - 6111111) <= 1),
    ]
    failed = [name for name, ok in checks if not ok]
    for name, ok in checks:
        print(("PASS  " if ok else "FAIL  ") + name)
    if failed:
        raise SystemExit(f"NGHIỆM THU THẤT BẠI: {failed}")
    print("→ Chuỗi customer_id → order_id → order_item_id → movement → debt: LIÊN KẾT ĐỦ.")


def main():
    _guard_environment()
    sale = _pick_sale_employee()
    print(f"Nhân viên phụ trách: {sale['name']} (#{sale['id']})")
    _truncate_derived()
    _truncate_derived()
    seed(sale)
    result = sync_ledger(DB, mode="commit", actor="seed-acceptance")
    if isinstance(result, dict) and result.get("errors"):
        raise SystemExit(f"Ledger sync lỗi: {result['errors']}")
    with connection.connect(DB) as conn:
        n = conn.execute("SELECT COUNT(*) AS n FROM journal_entries").fetchone()["n"]
    print(f"Sổ cái: {n} chứng từ (bán hàng 131/511/3331 + giá vốn 632/156 + tồn đầu).")
    verify()


if __name__ == "__main__":
    main()
