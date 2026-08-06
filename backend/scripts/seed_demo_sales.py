# -*- coding: utf-8 -*-
"""Seed bộ dữ liệu bán hàng MÔ PHỎNG cho DOMIX — mọi bảng dẫn xuất từ ĐƠN HÀNG.

Nguyên tắc: chỉ khai báo SẢN PHẨM (tồn đầu) + ĐƠN HÀNG + 2 khoản chi thủ công.
Toàn bộ phần còn lại là số DẪN XUẤT do tầng đối soát/reconcile sinh ra:
  - Kho: movement xuất kho theo từng dòng đơn, tồn = tồn đầu − đã bán.
  - Khách hàng: danh bạ gom từ đơn (khách mua 2 đơn thì doanh thu cộng dồn 2 đơn).
  - Thu Chi: transaction thu sinh từ tiền đã thu của đơn; Công nợ sinh từ phần chưa thu.
  - Sổ cái kép + Sổ VAT: sync_ledger dựng lại từ chính các đơn/kho/thu chi ở trên.

Chạy trong container backend:  python scripts/seed_demo_sales.py
KHÔNG dùng cho môi trường thật — script xóa dữ liệu nghiệp vụ bán hàng hiện có.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import DEFAULT_DB_TARGET  # noqa: E402
from db import connection  # noqa: E402
from db.state_store import update_state, read_state  # noqa: E402
from services.business_sync_service import reconcile_company_data  # noqa: E402
from services.sales_migration_service import migrate_orders  # noqa: E402
from services.ledger_sync_service import sync_ledger  # noqa: E402

DB = DEFAULT_DB_TARGET
ADMIN = "tuankkffdnc@gmail.com"
SALE_AN = 1785415870938      # Nguyễn Văn An — Sale
KT_HIEP = 1785416979874      # Hoàng Ngọc Hiệp — Kỹ thuật (upsale)

# ====== SẢN PHẨM KHO (stock = TỒN ĐẦU; reconcile tự suy movement tồn đầu) ======
PRODUCTS = [
    {"id": 9101, "sku": "SP-VIDEO-01", "name": "Phần mềm tạo video AI VideoMax", "groupName": "Phần mềm",
     "unit": "gói", "minStock": 3, "costPrice": 2500000, "sellPrice": 6000000, "durationMonths": 2,
     "vatRate": 8, "expiryDate": "", "stock": 15.0, "supplierName": "", "createdBy": ADMIN,
     "createdAt": "2026-06-01T08:00:00+07:00"},
    {"id": 9102, "sku": "SP-KETOAN-01", "name": "Phần mềm kế toán DOMIX Pro", "groupName": "Phần mềm",
     "unit": "gói", "minStock": 2, "costPrice": 5000000, "sellPrice": 12000000, "durationMonths": 12,
     "vatRate": 8, "expiryDate": "", "stock": 10.0, "supplierName": "", "createdBy": ADMIN,
     "createdAt": "2026-06-01T08:00:00+07:00"},
    {"id": 9103, "sku": "SP-CAM-01", "name": "Camera AI an ninh SmartCam", "groupName": "Thiết bị",
     "unit": "bộ", "minStock": 5, "costPrice": 2800000, "sellPrice": 4500000, "durationMonths": 0,
     "vatRate": 10, "expiryDate": "", "stock": 20.0, "supplierName": "Công ty thiết bị Anh Quân",
     "createdBy": ADMIN, "createdAt": "2026-06-01T08:00:00+07:00"},
    {"id": 9104, "sku": "SP-WIN-01", "name": "USB bản quyền Windows 11 Pro", "groupName": "Bản quyền",
     "unit": "chiếc", "minStock": 4, "costPrice": 1900000, "sellPrice": 3200000, "durationMonths": 0,
     "vatRate": 10, "expiryDate": "", "stock": 12.0, "supplierName": "Nhà phân phối SoftKey",
     "createdBy": ADMIN, "createdAt": "2026-06-01T08:00:00+07:00"},
]
PRODUCT_BY_ID = {p["id"]: p for p in PRODUCTS}

# ====== KHÁCH HÀNG (hồ sơ gắn ID vào đơn; danh bạ hiển thị dẫn xuất từ đơn) ======
CUSTOMERS = [
    {"id": 8001, "customerName": "Nguyễn Thảo Vy", "phone": "0901111222", "email": "thaovy@gmail.com",
     "customerType": "individual", "taxCode": "", "assignedSaleEmployeeId": SALE_AN},
    {"id": 8002, "customerName": "Công ty TNHH Minh Long", "phone": "0902333444", "email": "ketoan@minhlong.vn",
     "customerType": "company", "taxCode": "0101234567", "assignedSaleEmployeeId": SALE_AN},
    {"id": 8003, "customerName": "Trần Quốc Đạt", "phone": "0903555666", "email": "",
     "customerType": "individual", "taxCode": "", "assignedSaleEmployeeId": SALE_AN},
    {"id": 8004, "customerName": "Shop Hoa Mai", "phone": "0904777888", "email": "hoamai.shop@gmail.com",
     "customerType": "individual", "taxCode": "", "assignedSaleEmployeeId": SALE_AN},
    {"id": 8005, "customerName": "Lê Hồng Phúc", "phone": "0905999000", "email": "",
     "customerType": "individual", "taxCode": "", "assignedSaleEmployeeId": SALE_AN},
    {"id": 8006, "customerName": "Công ty CP Song Toàn", "phone": "0906121212", "email": "mua-hang@songtoan.com",
     "customerType": "company", "taxCode": "0109876543", "assignedSaleEmployeeId": SALE_AN},
    {"id": 8007, "customerName": "Phạm Duy Anh", "phone": "0907343434", "email": "",
     "customerType": "individual", "taxCode": "", "assignedSaleEmployeeId": KT_HIEP},
    {"id": 8008, "customerName": "Vũ Ngọc Hà", "phone": "0908565656", "email": "ngocha88@gmail.com",
     "customerType": "individual", "taxCode": "", "assignedSaleEmployeeId": SALE_AN},
    {"id": 8009, "customerName": "Cà phê Sáng", "phone": "0909787878", "email": "",
     "customerType": "individual", "taxCode": "", "assignedSaleEmployeeId": SALE_AN},
]
CUSTOMER_BY_ID = {c["id"]: c for c in CUSTOMERS}


def _customer_records():
    out = []
    for c in CUSTOMERS:
        out.append({
            "id": c["id"], "customerName": c["customerName"], "phone": c["phone"],
            "secondaryPhone": "", "email": c["email"], "zalo": "",
            "customerType": c["customerType"], "companyName": c["customerName"] if c["customerType"] == "company" else "",
            "taxCode": c["taxCode"], "invoiceAddress": "", "address": "", "source": "",
            "assignedSaleEmployeeId": c["assignedSaleEmployeeId"], "status": "active",
            "tags": [], "note": "", "createdAt": "2026-06-01", "updatedAt": "",
            "contactLog": [], "auditLog": [],
        })
    return out


def _add_months(date_str, months):
    y, m, d = [int(x) for x in date_str.split("-")]
    m += months
    y += (m - 1) // 12
    m = (m - 1) % 12 + 1
    return f"{y:04d}-{m:02d}-{d:02d}"


def make_order(oid, date, customer_id, lines, paid, sale_id, deal_type,
               invoice_no="", invoice_date=""):
    """lines: list of (productId hoặc None, description dịch vụ, qty, unitPrice, vatRate)."""
    cust = CUSTOMER_BY_ID[customer_id]
    items = []
    total = 0.0
    for idx, (pid, desc, qty, price, vat) in enumerate(lines, 1):
        product = PRODUCT_BY_ID.get(pid)
        description = product["name"] if product else desc
        uom = product["unit"] if product else ""
        line_total = float(qty) * float(price)
        items.append({
            "id": f"{oid}:L{idx}", "productId": pid, "description": description, "uom": uom,
            "quantity": float(qty), "unitPrice": float(price), "discount": 0.0,
            "vatRate": float(vat), "lineTotal": line_total,
        })
        total += line_total
    stock_lines = [it for it in items if it["productId"] is not None]
    first = stock_lines[0] if stock_lines else None
    first_product = PRODUCT_BY_ID.get(first["productId"]) if first else None
    duration = int(first_product["durationMonths"]) if first_product else 0
    product_name = items[0]["description"] + (f" +{len(items) - 1} dòng khác" if len(items) > 1 else "")
    issued = bool(invoice_no)
    return {
        "id": oid, "date": date, "customerId": customer_id,
        "customerName": cust["customerName"], "phone": cust["phone"], "email": cust["email"],
        "customerTaxCode": cust["taxCode"], "note": "",
        "saleEmployeeId": sale_id, "dealType": deal_type, "receivedAt": "",
        "issuedKeyCode": "", "pageId": None,
        "items": items,
        "productId": first["productId"] if first else None,
        "productName": product_name,
        "quantity": first["quantity"] if first else sum(it["quantity"] for it in items),
        "amount": total,
        "serviceStartDate": date, "durationMonths": duration, "durationDays": 0,
        "durationLabel": f"{duration} tháng" if duration else "",
        "expiryDate": _add_months(date, duration) if duration else "",
        "contactLog": [], "auditLog": [],
        "createdAt": f"{date}T09:00:00+07:00", "createdBy": ADMIN,
        "inventoryStatus": "fulfilled" if stock_lines else "not_applicable",
        "inventoryShortage": 0,
        # Tiền ĐÃ THU trực tiếp khi bán — reconcile sinh transaction thu tương ứng
        # và tự tạo công nợ "Phải thu khách hàng" cho phần còn lại.
        "customerPaidAmount": float(paid),
        "customerPaymentStatus": "paid" if paid >= total else ("partial" if paid > 0 else "unpaid"),
        "cashCollector": "company", "customerInvoiceIssuer": "company",
        "invoiceStatus": "issued" if issued else "pending",
        "invoiceNo": invoice_no, "invoiceDate": invoice_date,
        "linkedTxId": None,
    }


# ====== BỘ ĐƠN HÀNG MÔ PHỎNG (10 đơn · 9 khách · T6–T8/2026) ======
# Khách 8001 Nguyễn Thảo Vy mua 2 ĐƠN VideoMax → kho VideoMax phải trừ 2,
# danh bạ phải hiện doanh thu cộng dồn 12.000.000đ — đúng kịch bản kiểm thử.
ORDERS = [
    make_order(9210605001, "2026-06-05", 8001, [(9101, "", 1, 6000000, 8)], 6000000, SALE_AN, "sale",
               invoice_no="HD-2026-0001", invoice_date="2026-06-06"),
    make_order(9210615002, "2026-06-15", 8002, [(9102, "", 1, 12000000, 8)], 7000000, SALE_AN, "sale",
               invoice_no="HD-2026-0002", invoice_date="2026-06-16"),
    make_order(9210620003, "2026-06-20", 8003, [(9103, "", 2, 4500000, 10)], 9000000, SALE_AN, "sale"),
    make_order(9210702004, "2026-07-02", 8004,
               [(9101, "", 1, 6000000, 8), (None, "Thiết kế intro video quảng cáo", 1, 1500000, 0)],
               7500000, SALE_AN, "sale", invoice_no="HD-2026-0003", invoice_date="2026-07-03"),
    make_order(9210708005, "2026-07-08", 8005, [(9104, "", 3, 3200000, 10)], 0, SALE_AN, "sale"),
    make_order(9210710006, "2026-07-10", 8001, [(9101, "", 1, 6000000, 8)], 6000000, KT_HIEP, "upsale",
               invoice_no="HD-2026-0004", invoice_date="2026-07-11"),
    make_order(9210718007, "2026-07-18", 8006,
               [(9102, "", 1, 12000000, 8), (9103, "", 4, 4500000, 10)],
               20000000, SALE_AN, "sale", invoice_no="HD-2026-0005", invoice_date="2026-07-20"),
    make_order(9210801008, "2026-08-01", 8007, [(9101, "", 1, 6000000, 8)], 6000000, KT_HIEP, "upsale"),
    make_order(9210804009, "2026-08-04", 8008,
               [(9103, "", 1, 4500000, 10), (9104, "", 1, 3200000, 10)], 0, SALE_AN, "sale"),
    make_order(9210805010, "2026-08-05", 8009, [(None, "Gói quảng cáo fanpage 1 tháng", 1, 2500000, 0)],
               2500000, SALE_AN, "sale"),
]

# ====== KHOẢN CHI THỦ CÔNG (để Thu Chi có cả 2 chiều; không dính đơn hàng) ======
MANUAL_TXS = [
    {"id": 9300705001, "date": "2026-07-05", "kind": "chi", "category": "chi_van_hanh",
     "desc": "Thuê văn phòng tháng 7", "amount": 8000000, "paymentMethod": "chuyen_khoan",
     "invoiceType": "Hóa đơn GTGT", "invoiceNo": "VP-0707", "vatRate": 0, "status": "approved",
     "source": "manual_finance_hub", "createdAt": "2026-07-05T10:00:00+07:00", "createdBy": ADMIN},
    {"id": 9300715002, "date": "2026-07-15", "kind": "chi", "category": "chi_van_hanh",
     "desc": "Chi phí quảng cáo Facebook tháng 7", "amount": 5000000, "paymentMethod": "chuyen_khoan",
     "invoiceType": "Chưa xác định", "invoiceNo": "", "vatRate": 0, "status": "approved",
     "source": "manual_finance_hub", "createdAt": "2026-07-15T10:00:00+07:00", "createdBy": ADMIN},
]


def updater(data):
    d = dict(data or {})
    # Làm sạch các bảng NGHIỆP VỤ BÁN HÀNG (demo) — nhân sự/chấm công/lương/công ty giữ nguyên.
    d["inventory"] = [dict(p) for p in PRODUCTS]
    d["stockMovements"] = []
    d["orders"] = [dict(o) for o in ORDERS]
    d["customers"] = _customer_records()
    d["debts"] = []
    d["transactions"] = [dict(t) for t in MANUAL_TXS]
    d["supportCases"] = []
    d["distributionOrders"] = []
    d["distributionSettlements"] = []
    d["paymentLedger"] = []
    d["leads"] = []
    d["inventoryLedgerIssues"] = []
    # Đối soát: sinh movement kho theo từng dòng, công nợ, transaction thu, amountBreakdown...
    d = reconcile_company_data(d)
    # Chuẩn hóa 4 trạng thái đơn (orderStatus/inventoryStatus2/paymentStatus/invoiceStatus).
    report = migrate_orders(d, mode="commit")
    print("Migration:", report["counts"], "needsReview:", report["needsReviewCount"])
    return d


def truncate_derived_ledgers():
    """Xóa sổ phụ/sổ cái cũ — sync_ledger sẽ dựng lại từ bộ dữ liệu mới."""
    tables = [
        "journal_entry_lines", "journal_entries", "inventory_valuation_ledger",
        "accounting_periods", "opening_inventory_batch_lines", "opening_inventory_batches",
        "debt_payments", "inventory_movements", "cash_transactions",
    ]
    for table in tables:
        try:
            with connection.connect(DB) as conn:
                conn.execute(f"DELETE FROM {table}")
            print(f"cleared {table}")
        except Exception as exc:  # bảng có thể chưa tồn tại ở schema cũ
            print(f"skip {table}: {exc}")


def main():
    truncate_derived_ledgers()
    update_state(DB, updater)
    result = sync_ledger(DB, mode="commit", actor="seed-demo")
    if isinstance(result, dict):
        print("Ledger sync:", {k: result.get(k) for k in ("created", "skipped", "errors") if k in result})
    # In số liệu kiểm chứng chéo
    state = read_state(DB)
    d = state.get("data") or {}
    stock = {p["name"]: p.get("stock") for p in d.get("inventory") or []}
    print("Tồn kho sau bán:", stock)
    total = sum(o.get("amount") or 0 for o in d.get("orders") or [])
    paid = sum(o.get("customerPaidAmount") or 0 for o in d.get("orders") or [])
    print(f"Doanh thu {total:,.0f} · Đã thu {paid:,.0f} · Còn phải thu {total - paid:,.0f}")
    print("Công nợ mở:", [(x.get('partner') or x.get('counterpartyName'), x.get('amount'), x.get('paidAmount')) for x in d.get('debts') or []])
    print("Số transaction:", len(d.get("transactions") or []))
    print("Số movement kho:", len(d.get("stockMovements") or []))


if __name__ == "__main__":
    main()
