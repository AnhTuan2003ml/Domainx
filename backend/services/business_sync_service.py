"""Đồng bộ các quan hệ nghiệp vụ cốt lõi trong cùng transaction.

DOMIX vẫn giữ các collection nghiệp vụ trong ``app_state`` để tương thích dữ liệu cũ,
nhưng quan hệ giữa Đơn hàng → Kho → Công nợ → Thu/Chi → Phân phối được máy chủ
chuẩn hóa sau mỗi lần ghi. Frontend không còn là nơi duy nhất quyết định các bút toán
liên kết, nhờ đó tải lại trang hoặc hai người thao tác gần nhau không làm lệch số liệu.
"""

from datetime import date, datetime, timedelta, timezone
import re
import uuid

from security import password_hash

from services.payment_ledger_service import append_payment, normalise_payment_ledger, reverse_payment


SYNC_FIELDS = {
    "orders",
    "inventory",
    "stockMovements",
    "distributionOrders",
    "distributionSettlements",
    "debts",
    "transactions",
    "customers",
    "paymentLedger",
    "payrollPayments",
    "payrollApprovals",
}


PRESERVED_RECORD_FIELDS = {
    # Ngày pháp lý/hạn dùng và khóa liên kết phải sống qua các form cũ hoặc request
    # gửi object chưa đủ field. Chỉ bổ sung khi key bị thiếu; giá trị rỗng được gửi
    # chủ động vẫn được tôn trọng để người dùng có thể xóa hạn/vô thời hạn.
    "inventory": ("expiryDate", "createdAt", "inventoryLedgerVersion"),
    "debts": ("paymentHistory", "directPaidAmount", "paidAmount", "remainingAmount", "status", "updatedAt"),
    "orders": (
        "customerId", "productId", "productName", "quantity", "serviceStartDate",
        "expiryDate", "distributionOrderId", "cashCollector", "customerInvoiceIssuer",
        "inventoryStatus", "inventoryShortage", "createdAt", "createdBy",
    ),
    "distributionOrders": (
        "sourceCrmOrderId", "partnerId", "productId", "productName", "quantity",
        "recognitionMode", "countsAsRevenue", "createdAt", "createdBy",
    ),
    "contracts": ("signDate", "startDate", "expiryDate", "endDate"),
    "capitalContributions": ("date", "contributionDate", "certificationDate", "certificateDate"),
    "fixedAssets": ("purchaseDate", "startDate", "warrantyExpiryDate"),
}


def preserve_missing_record_fields(existing_data, incoming_data):
    """Giữ field liên kết/ngày đã lưu khi client cũ gửi object thiếu key.

    Hàm không phục hồi giá trị mà người dùng đã chủ động gửi thành chuỗi rỗng; vì vậy
    thao tác xóa ngày hết hạn hoặc chuyển hợp đồng sang vô thời hạn vẫn hoạt động.
    """
    if not isinstance(existing_data, dict) or not isinstance(incoming_data, dict):
        return incoming_data
    result = dict(incoming_data)
    for collection_name, fields in PRESERVED_RECORD_FIELDS.items():
        incoming_collection = result.get(collection_name)
        if not isinstance(incoming_collection, list):
            continue
        existing_collection = _as_list(existing_data.get(collection_name))
        existing_by_id = {
            _key(item.get("id")): item
            for item in existing_collection
            if isinstance(item, dict) and item.get("id") is not None
        }
        merged_collection = []
        for raw in incoming_collection:
            if not isinstance(raw, dict):
                continue
            item = dict(raw)
            old = existing_by_id.get(_key(item.get("id")))
            if old:
                for field in fields:
                    if field not in item and field in old:
                        item[field] = old.get(field)
            merged_collection.append(item)
        result[collection_name] = merged_collection
    return result


def _as_list(value):
    return value if isinstance(value, list) else []


def _key(value):
    return str(value) if value is not None else ""


def _number(value, default=0.0):
    try:
        return float(value if value is not None else default)
    except (TypeError, ValueError):
        return float(default)


def _quantity(value):
    return max(0.0, abs(_number(value, 1)))


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _date_only(value):
    """Chuẩn hóa ngày ở một tầng dùng chung, không dịch ngày do múi giờ.

    Chấp nhận ``YYYY-MM-DD``, ISO datetime và định dạng Việt Nam ``DD/MM/YYYY``
    hoặc ``DD-MM-YYYY``. Chuỗi rỗng luôn được giữ rỗng để người dùng có thể chủ
    động bỏ hạn/vô thời hạn.
    """
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = str(value).strip()
    if not text:
        return ""
    iso_match = re.match(r"^(\d{4})-(\d{2})-(\d{2})", text)
    if iso_match:
        candidate = "-".join(iso_match.groups())
        try:
            return date.fromisoformat(candidate).isoformat()
        except ValueError:
            return text
    vn_match = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$", text)
    if vn_match:
        day_value, month_value, year_value = (int(part) for part in vn_match.groups())
        try:
            return date(year_value, month_value, day_value).isoformat()
        except ValueError:
            return text
    return text


def _plus_days(value, days=7):
    try:
        return (datetime.fromisoformat(_date_only(value)) + timedelta(days=days)).date().isoformat()
    except (TypeError, ValueError):
        return ""


def _is_cancelled(order):
    status = str(order.get("orderStatus") or order.get("status") or "").strip().lower()
    return status in {"cancelled", "canceled", "deleted", "huy", "đã hủy", "da_huy"}


def _movement_key(item):
    return (
        _key(item.get("sourceModule")),
        _key(item.get("sourceId")),
        _key(item.get("movementType")),
    )


def _payment_status(paid, amount):
    if amount > 0 and paid >= amount:
        return "paid"
    if paid > 0:
        return "partial"
    return "unpaid"


def _crm_source_id(record):
    if not isinstance(record, dict):
        return ""
    source = str(record.get("sourceModule") or record.get("source") or "").strip().lower()
    if source not in {"crm", "crm_order", "congno", "congno_payment"}:
        return ""
    for field in ("sourceId", "sourceOrderId", "orderId"):
        if record.get(field) is not None:
            return _key(record.get(field))
    return ""


def _normalise_payment_history(debt):
    """Chuẩn hóa lịch sử thanh toán và loại bản ghi trùng theo id.

    ``paymentHistory`` là nguồn sự thật của từng lần thu/trả công nợ. ``paidAmount``
    chỉ là giá trị dẫn xuất, tuyệt đối không được dùng để hồi sinh một lần thanh toán
    đã bị xóa.
    """
    result = []
    seen = set()
    debt_id = _key((debt or {}).get("id"))
    for index, raw in enumerate(_as_list((debt or {}).get("paymentHistory"))):
        if not isinstance(raw, dict) or raw.get("reversed"):
            continue
        item = dict(raw)
        payment_id = item.get("id")
        if payment_id is None:
            payment_id = item.get("linkedTransactionId") or f"legacy:{debt_id}:{index}"
        key = _key(payment_id)
        if not key or key in seen:
            continue
        amount = max(0.0, _number(item.get("amount")))
        if amount <= 0:
            continue
        seen.add(key)
        item.update({
            "id": payment_id,
            "amount": amount,
            "date": _date_only(item.get("date")),
            "paymentMethod": item.get("paymentMethod") or "chuyen_khoan",
            "referenceNo": item.get("referenceNo") or "",
            "note": item.get("note") or "",
            "createdBy": item.get("createdBy") or "",
        })
        item["linkedTransactionId"] = item.get("linkedTransactionId") or f"tx:{key}"
        result.append(item)
    return result


def _payment_history_total(debt):
    return sum(item["amount"] for item in _normalise_payment_history(debt))


def _build_debt_payment_transaction(debt, payment, existing=None):
    transaction = dict(existing or {})
    payment_id = payment.get("id")
    is_crm_debt = str(debt.get("sourceModule") or "").lower() == "crm"
    transaction.update({
        "id": payment.get("linkedTransactionId") or transaction.get("id") or f"tx:{_key(payment_id)}",
        "date": _date_only(payment.get("date")),
        "kind": "thu" if debt.get("type") == "thu" else "chi",
        "category": "Thu công nợ" if debt.get("type") == "thu" else "Trả công nợ",
        "desc": (
            f"{'Thu nợ từ' if debt.get('type') == 'thu' else 'Trả nợ cho'} "
            f"{debt.get('counterpartyName') or debt.get('partner') or 'đối tác'}"
            f"{' — ' + str(debt.get('settlementCode')) if debt.get('settlementCode') else ''}"
            f"{' — ' + str(payment.get('note')) if payment.get('note') else ''}"
        ),
        "amount": max(0.0, _number(payment.get("amount"))),
        "partnerName": debt.get("counterpartyName") or debt.get("partner") or "",
        "paymentMethod": payment.get("paymentMethod") or "chuyen_khoan",
        "source": "congno_payment",
        "sourceModule": "congno_payment",
        "sourceId": payment_id,
        "debtId": debt.get("id"),
        "settlementId": debt.get("settlementId"),
        "orderId": debt.get("orderId") or (debt.get("sourceId") if is_crm_debt else None),
        "paymentReference": payment.get("referenceNo") or "",
        "createdAutomatically": True,
        "updatedAt": _now_iso(),
    })
    transaction.setdefault("createdAt", payment.get("createdAt") or _now_iso())
    transaction.setdefault("createdBy", payment.get("createdBy") or "server-sync")
    return transaction


def _transaction_is_crm_collection(transaction):
    return (
        isinstance(transaction, dict)
        and transaction.get("kind") == "thu"
        and _crm_source_id(transaction)
        and str(transaction.get("sourceModule") or transaction.get("source") or "").lower() == "crm"
    )


def _build_crm_transaction(order, paid_amount, existing=None):
    transaction = dict(existing or {})
    order_id = order.get("id")
    employee_id = order.get("saleEmployeeId") or order.get("employeeId")
    product_label = order.get("productName") or "Sản phẩm/dịch vụ"
    transaction.update({
        "id": transaction.get("id") or f"sync:crm:{_key(order_id)}:collection",
        "date": _date_only(order.get("date")),
        "kind": "thu",
        "category": "Upsale Kỹ thuật (CRM)" if str(order.get("dealType") or "").lower() == "upsale" else "Bán hàng (CRM)",
        "desc": transaction.get("desc") or f"Thu tiền đơn CRM #{order_id} — {order.get('customerName') or 'Khách hàng'} — {product_label}",
        "amount": max(0.0, paid_amount),
        "employeeId": employee_id,
        "employeeName": order.get("saleEmployeeName") or transaction.get("employeeName", ""),
        "partnerName": order.get("customerName") or "",
        "partnerTaxCode": order.get("customerTaxCode") or "",
        "partnerPhone": order.get("phone") or "",
        "partnerEmail": order.get("email") or "",
        "paymentMethod": transaction.get("paymentMethod") or order.get("paymentMethod") or "chuyen_khoan",
        "invoiceType": order.get("invoiceType") or transaction.get("invoiceType") or "Chưa xác định",
        "invoiceNo": order.get("invoiceNo") or transaction.get("invoiceNo") or "",
        "vatRate": _number(order.get("vatRate"), _number(transaction.get("vatRate"), 0)),
        "status": transaction.get("status") or "pending",
        "source": "crm",
        "sourceModule": "crm",
        "sourceId": order_id,
        "sourceOrderId": order_id,
        "orderId": order_id,
        "createdAutomatically": True,
        "collectionScope": "direct",
        "updatedAt": _now_iso(),
    })
    transaction.setdefault("createdAt", order.get("createdAt") or _now_iso())
    transaction.setdefault("createdBy", order.get("createdBy") or order.get("importedBy") or "server-sync")
    return transaction


def _build_crm_debt(order, paid_amount, existing=None):
    debt = dict(existing or {})
    amount = max(0.0, _number(order.get("amount")))
    status = _payment_status(paid_amount, amount)
    order_id = order.get("id")
    debt.update({
        "id": debt.get("id") or f"sync:crm:{_key(order_id)}:receivable",
        "type": "thu",
        "counterpartyType": "customer",
        "counterpartyId": order.get("customerId"),
        "counterpartyName": order.get("customerName") or debt.get("counterpartyName", ""),
        "counterpartyPhone": order.get("phone") or debt.get("counterpartyPhone", ""),
        "sourceModule": "crm",
        "sourceId": order_id,
        "orderId": order_id,
        "amount": amount,
        "paidAmount": paid_amount,
        "remainingAmount": max(0.0, amount - paid_amount),
        "issueDate": _date_only(order.get("date")),
        "dueDate": debt.get("dueDate") or _plus_days(order.get("date"), 7),
        "status": "paid" if status == "paid" else "partial" if status == "partial" else "open",
        "paymentHistory": _as_list(debt.get("paymentHistory")),
        "note": debt.get("note") or f"Phải thu đơn CRM #{order_id}",
        "updatedAt": _now_iso(),
    })
    debt.setdefault("createdAt", order.get("createdAt") or _now_iso())
    debt.setdefault("createdBy", order.get("createdBy") or order.get("importedBy") or "server-sync")
    return debt


def _synchronise_sales_finance(orders, debts, transactions):
    """Chuẩn hóa Đơn CRM → Công nợ → từng lần Thu/Chi mà không ghi trùng.

    Quy tắc bất biến:
    - Một dòng ``paymentHistory`` tương ứng đúng một transaction ``congno_payment``.
    - Transaction CRM chỉ đại diện tiền đã thu trực tiếp lúc tạo/sửa đơn, không chứa
      tiền thu qua công nợ.
    - Xóa paymentHistory sẽ xóa transaction liên kết và giảm paidAmount; máy chủ
      không được phục hồi số đã xóa từ một field tổng cũ.
    """
    order_list = [dict(item) for item in orders if isinstance(item, dict)]
    debt_list = [dict(item) for item in debts if isinstance(item, dict)]
    tx_list = [dict(item) for item in transactions if isinstance(item, dict)]

    crm_debts = {}
    unrelated_debts = []
    for raw in debt_list:
        debt = dict(raw)
        debt["paymentHistory"] = _normalise_payment_history(debt)
        source_id = _crm_source_id(debt)
        if str(debt.get("sourceModule") or "").lower() == "crm" and source_id:
            crm_debts[source_id] = debt
        else:
            unrelated_debts.append(debt)

    crm_transactions = {}
    payment_transactions = {}
    unrelated_transactions = []
    for transaction in tx_list:
        source = str(transaction.get("sourceModule") or transaction.get("source") or "").lower()
        source_id = _crm_source_id(transaction)
        if _transaction_is_crm_collection(transaction) and source_id:
            crm_transactions.setdefault(source_id, []).append(transaction)
        elif source == "congno_payment" and transaction.get("sourceId") is not None:
            payment_transactions.setdefault(_key(transaction.get("sourceId")), transaction)
        else:
            unrelated_transactions.append(transaction)

    synced_debts = []
    synced_transactions = list(unrelated_transactions)

    def append_payment_transactions(debt):
        for payment in _normalise_payment_history(debt):
            payment_key = _key(payment.get("id"))
            synced_transactions.append(
                _build_debt_payment_transaction(debt, payment, payment_transactions.get(payment_key))
            )

    # Công nợ không thuộc CRM vẫn lấy lịch sử thanh toán làm nguồn sự thật.
    for debt in unrelated_debts:
        history = _normalise_payment_history(debt)
        history_total = sum(item["amount"] for item in history)
        if "directPaidAmount" in debt:
            direct_paid = max(0.0, _number(debt.get("directPaidAmount")))
        else:
            direct_paid = max(0.0, _number(debt.get("paidAmount")) - history_total)
        amount = max(0.0, _number(debt.get("amount")))
        paid = min(amount, direct_paid + history_total)
        debt.update({
            "paymentHistory": history,
            "directPaidAmount": min(amount, direct_paid),
            "paidAmount": paid,
            "remainingAmount": max(0.0, amount - paid),
            "status": "paid" if amount > 0 and paid >= amount else "partial" if paid > 0 else (
                "cancelled" if debt.get("status") == "cancelled" else "open"
            ),
            "updatedAt": _now_iso(),
        })
        synced_debts.append(debt)
        append_payment_transactions(debt)

    for order in order_list:
        if order.get("id") is None:
            continue
        order_id = _key(order.get("id"))
        amount = max(0.0, _number(order.get("amount")))
        order["amount"] = amount
        order["quantity"] = _quantity(order.get("quantity")) or 1.0
        order["date"] = _date_only(order.get("date"))
        if order.get("serviceStartDate"):
            order["serviceStartDate"] = _date_only(order.get("serviceStartDate"))
        if order.get("expiryDate"):
            order["expiryDate"] = _date_only(order.get("expiryDate"))

        existing_debt = crm_debts.get(order_id)
        existing_txs = crm_transactions.get(order_id, [])
        history = _normalise_payment_history(existing_debt or {})
        history_total = sum(item["amount"] for item in history)

        if existing_debt and "directPaidAmount" in existing_debt:
            direct_paid = max(0.0, _number(existing_debt.get("directPaidAmount")))
        elif existing_txs:
            crm_total = sum(max(0.0, _number(item.get("amount"))) for item in existing_txs)
            # Bản cũ dùng transaction CRM tổng hợp cả tiền thu qua công nợ. Nếu chưa
            # có marker mới, trừ paymentHistory để khôi phục đúng phần thu trực tiếp.
            if any(str(item.get("collectionScope") or "").lower() == "direct" for item in existing_txs):
                direct_paid = sum(
                    max(0.0, _number(item.get("amount")))
                    for item in existing_txs
                    if str(item.get("collectionScope") or "").lower() == "direct"
                )
            else:
                direct_paid = max(0.0, crm_total - history_total)
        elif not existing_debt and not history:
            direct_paid = max(0.0, _number(order.get("customerPaidAmount")))
        else:
            direct_paid = 0.0

        company_collects = str(order.get("cashCollector") or "company").lower() != "partner"
        if not company_collects:
            direct_paid = 0.0
            history = []
            history_total = 0.0

        direct_paid = min(amount, direct_paid)
        paid = min(amount, direct_paid + history_total)
        status = _payment_status(paid, amount)
        order.update({
            "customerPaidAmount": paid,
            "customerPaymentStatus": status,
            "recognizedRevenue": 0.0 if _is_cancelled(order) else amount,
            "remainingReceivable": max(0.0, amount - paid),
        })

        if _is_cancelled(order):
            if existing_debt and (paid > 0 or history):
                cancelled_debt = _build_crm_debt(order, paid, existing_debt)
                cancelled_debt.update({
                    "directPaidAmount": direct_paid,
                    "paymentHistory": history,
                    "sourceOrderCancelled": True,
                })
                synced_debts.append(cancelled_debt)
                append_payment_transactions(cancelled_debt)
            order["linkedTxId"] = existing_txs[0].get("id") if direct_paid > 0 and existing_txs else None
            continue

        if not company_collects:
            order["linkedTxId"] = None
            continue

        if direct_paid > 0:
            transaction = _build_crm_transaction(order, direct_paid, existing_txs[0] if existing_txs else None)
            synced_transactions.append(transaction)
            order["linkedTxId"] = transaction.get("id")
        else:
            order["linkedTxId"] = None

        if paid < amount or existing_debt or history:
            debt = _build_crm_debt(order, paid, existing_debt)
            debt.update({
                "directPaidAmount": direct_paid,
                "paymentHistory": history,
            })
            synced_debts.append(debt)
            append_payment_transactions(debt)

    return order_list, synced_debts, synced_transactions

def _normalise_distribution_orders(orders, distribution_orders):
    orders_by_id = {_key(order.get("id")): order for order in orders if isinstance(order, dict)}
    seen_crm_links = set()
    synced = []
    for raw in distribution_orders:
        if not isinstance(raw, dict):
            continue
        item = dict(raw)
        source_id = _key(item.get("sourceCrmOrderId"))
        if source_id:
            # Một đơn CRM chỉ có đúng một bản ghi phân phối liên kết.
            if source_id in seen_crm_links:
                continue
            seen_crm_links.add(source_id)
            source = orders_by_id.get(source_id)
            item["recognitionMode"] = "linked_crm"
            item["countsAsRevenue"] = False
            if source:
                item.update({
                    "date": source.get("date") or item.get("date"),
                    "productId": source.get("productId"),
                    "productName": source.get("productName") or item.get("productName", ""),
                    "quantity": source.get("quantity") or 1,
                    "revenue": source.get("amount") or 0,
                    "endCustomerName": source.get("customerName") or item.get("endCustomerName", ""),
                    "customerPaymentStatus": source.get("customerPaymentStatus") or "unpaid",
                    "customerPaidAmount": source.get("customerPaidAmount") or 0,
                    "sourceOrderCancelled": _is_cancelled(source),
                })
                source["distributionOrderId"] = item.get("id")
        else:
            item["recognitionMode"] = "standalone"
            item["countsAsRevenue"] = item.get("orderKind") != "purchase"
        if item.get("date"):
            item["date"] = _date_only(item.get("date"))
        synced.append(item)
    return synced


def _normalise_inventory_and_movements(inventory, orders, movements):
    """Chuẩn hoá sổ kho để mỗi sản phẩm có một tồn đầu và chuỗi trước/sau liên tục.

    Không cộng hai lần các dòng tồn đầu legacy. Tồn hiện tại luôn được dẫn xuất từ
    một opening hợp lệ cộng các movement hiệu lực. Bán/hủy đơn sinh movement theo
    source_type/source_id ổn định nên tải lại không làm thay đổi tồn lần nữa.
    """
    products = [dict(item) for item in inventory if isinstance(item, dict)]
    product_by_id = {_key(item.get("id")): item for item in products if item.get("id") is not None}
    product_ids = set(product_by_id)
    issues = []

    existing = []
    seen_ids = set()
    seen_business_keys = set()
    opening_by_product = {}
    existing_nonopening_delta = {}

    for raw in movements:
        if not isinstance(raw, dict) or raw.get("id") is None:
            continue
        item = dict(raw)
        movement_id = _key(item.get("id"))
        if movement_id in seen_ids:
            continue
        seen_ids.add(movement_id)
        product_key = _key(item.get("productId"))
        if product_key not in product_ids:
            issues.append({"type": "unknown_product", "movementId": movement_id, "productId": product_key})
            continue
        item["date"] = _date_only(item.get("date") or item.get("movementDate") or item.get("createdAt"))
        item["movementType"] = str(item.get("movementType") or "adjustment")
        item["delta"] = _number(item.get("delta"), _number(item.get("quantityChange")))
        item["quantity"] = abs(_number(item.get("quantity"), item["delta"]))
        item["sourceModule"] = str(item.get("sourceModule") or item.get("sourceType") or "manual")
        item["sourceId"] = item.get("sourceId")
        item["status"] = str(item.get("status") or "posted")
        item["productName"] = product_by_id[product_key].get("name") or product_by_id[product_key].get("groupName") or ""

        is_opening = item["movementType"] in {"opening", "initial", "opening_balance"}
        if is_opening:
            # Dữ liệu cũ có thể có hai dòng +10 với ID khác nhau. Chỉ giữ dòng
            # opening đầu tiên; các dòng sau là bản sao, không được cộng vào tồn.
            if product_key in opening_by_product:
                issues.append({"type": "duplicate_opening_removed", "movementId": movement_id, "productId": product_key})
                continue
            item["movementType"] = "opening"
            item["sourceModule"] = "kho"
            item["sourceId"] = item.get("sourceId") or product_by_id[product_key].get("id")
            opening_by_product[product_key] = item
            existing.append(item)
            continue

        business_key = _movement_key(item)
        if business_key != ("", "", "") and business_key in seen_business_keys:
            issues.append({"type": "duplicate_movement_removed", "movementId": movement_id, "productId": product_key})
            continue
        if business_key != ("", "", ""):
            seen_business_keys.add(business_key)
        if item["status"] != "reversed":
            existing_nonopening_delta[product_key] = existing_nonopening_delta.get(product_key, 0.0) + item["delta"]
        existing.append(item)

    # Sản phẩm chưa có opening: suy ngược tồn đầu từ tồn hiện tại và các movement
    # đã có trước request này. Sau đó movement đơn mới được thêm vào và trừ đúng 1 lần.
    for product_key, product in product_by_id.items():
        if product_key in opening_by_product:
            continue
        opening_quantity = _number(product.get("stock")) - existing_nonopening_delta.get(product_key, 0.0)
        opening = {
            "id": f"sync:kho:{product_key}:opening",
            "productId": product.get("id"),
            "productName": product.get("name") or product.get("groupName") or "",
            "movementType": "opening",
            "quantity": abs(opening_quantity),
            "delta": opening_quantity,
            "date": _date_only(product.get("createdAt")) or date.today().isoformat(),
            "sourceModule": "kho",
            "sourceId": product.get("id"),
            "note": "Tồn đầu được chuẩn hóa khi nâng cấp sổ kho",
            "createdBy": "server-sync",
            "createdAt": product.get("createdAt") or _now_iso(),
            "status": "posted",
        }
        opening_by_product[product_key] = opening
        existing.append(opening)
        product["inventoryLedgerVersion"] = 2

    by_business_key = {}
    for index, item in enumerate(existing):
        key = _movement_key(item)
        if key != ("", "", ""):
            by_business_key[key] = index

    active_order_ids = set()
    for order in orders:
        if not isinstance(order, dict) or order.get("id") is None or not order.get("productId"):
            continue
        order_id = _key(order.get("id"))
        product_id = _key(order.get("productId"))
        if product_id not in product_ids:
            order["inventorySyncStatus"] = "product_missing"
            issues.append({"type": "order_product_missing", "orderId": order_id, "productId": product_id})
            continue
        if str(order.get("inventoryStatus") or "").strip().lower() == "pending_stock":
            order["inventorySyncStatus"] = "pending_stock"
            issues.append({
                "type": "pending_stock",
                "orderId": order_id,
                "productId": product_id,
                "shortage": max(0.0, _number(order.get("quantity"), 1) - _number(product_by_id[product_id].get("stock"))),
            })
            continue
        sale_key = ("crm", order_id, "sale_out")
        reverse_key = ("crm", order_id, "cancel_reverse")
        if not _is_cancelled(order):
            active_order_ids.add(order_id)
            quantity = _quantity(order.get("quantity")) or 1.0
            movement = {
                "id": f"sync:crm:{order_id}:sale_out",
                "productId": order.get("productId"),
                "productName": product_by_id[product_id].get("name") or "",
                "movementType": "sale_out",
                "quantity": quantity,
                "delta": -quantity,
                "date": _date_only(order.get("date")),
                "sourceModule": "crm",
                "sourceId": order.get("id"),
                "note": f"Bán cho {order.get('customerName') or 'khách hàng'}",
                "createdBy": order.get("createdBy") or order.get("importedBy") or "server-sync",
                "createdAt": order.get("createdAt") or order.get("importedAt") or _now_iso(),
                "status": "posted",
            }
            if sale_key in by_business_key:
                existing[by_business_key[sale_key]].update(movement)
            else:
                by_business_key[sale_key] = len(existing)
                existing.append(movement)
            if reverse_key in by_business_key:
                existing[by_business_key[reverse_key]]["status"] = "reversed"

    # Đơn bị hủy/xóa phải có một movement hoàn tồn; không xóa movement bán cũ.
    for item in list(existing):
        if not isinstance(item, dict) or item.get("sourceModule") != "crm" or item.get("movementType") != "sale_out":
            continue
        source_id = _key(item.get("sourceId"))
        if source_id in active_order_ids:
            continue
        reverse_key = ("crm", source_id, "cancel_reverse")
        if reverse_key in by_business_key:
            existing[by_business_key[reverse_key]]["status"] = "posted"
            continue
        quantity = _quantity(item.get("quantity")) or abs(_number(item.get("delta"))) or 1.0
        product_key = _key(item.get("productId"))
        reverse = {
            "id": f"sync:crm:{source_id}:cancel_reverse",
            "productId": item.get("productId"),
            "productName": product_by_id.get(product_key, {}).get("name") or "",
            "movementType": "cancel_reverse",
            "quantity": quantity,
            "delta": quantity,
            "date": _date_only(item.get("date")),
            "sourceModule": "crm",
            "sourceId": item.get("sourceId"),
            "note": "Hoàn tồn tự động vì đơn CRM đã hủy hoặc bị xóa",
            "createdBy": "server-sync",
            "createdAt": _now_iso(),
            "status": "posted",
        }
        by_business_key[reverse_key] = len(existing)
        existing.append(reverse)

    def movement_sort_key(item):
        opening_rank = 0 if item.get("movementType") == "opening" else 1
        return (_key(item.get("productId")), opening_rank, item.get("date") or "", item.get("createdAt") or "", _key(item.get("id")))

    existing.sort(key=movement_sort_key)
    running_stock = {}
    sold = {}
    for item in existing:
        product_key = _key(item.get("productId"))
        before = running_stock.get(product_key, 0.0)
        delta = 0.0 if item.get("status") == "reversed" else _number(item.get("delta"))
        after = before + delta
        item["quantityBefore"] = before
        item["quantityAfter"] = after
        item["quantityChange"] = _number(item.get("delta"))
        item["productName"] = item.get("productName") or product_by_id.get(product_key, {}).get("name") or ""
        running_stock[product_key] = after
        if item.get("status") != "reversed":
            if item.get("movementType") == "sale_out":
                sold[product_key] = sold.get(product_key, 0.0) + _quantity(item.get("quantity"))
            elif item.get("movementType") == "cancel_reverse":
                sold[product_key] = max(0.0, sold.get(product_key, 0.0) - _quantity(item.get("quantity")))
        if after < -1e-9:
            issues.append({"type": "negative_stock", "movementId": item.get("id"), "productId": product_key, "quantityAfter": after})

    for product in products:
        product_key = _key(product.get("id"))
        stock = running_stock.get(product_key, _number(product.get("stock")))
        if stock < -1e-9:
            raise ValueError(
                f"Tồn kho không đủ cho sản phẩm '{product.get('name') or product.get('groupName') or product_key}'. "
                f"Sổ kho đang âm {abs(stock):g} đơn vị. Hãy bổ sung tồn hoặc giảm số lượng đơn hàng."
            )
        product["stock"] = max(0.0, stock)
        product["soldQuantity"] = max(0.0, sold.get(product_key, 0.0))
        product["inventoryLedgerVersion"] = 2
        if product.get("expiryDate"):
            product["expiryDate"] = _date_only(product.get("expiryDate"))

    return products, existing, issues

def _dedupe_auto_transactions(transactions):
    """Chống một nguồn nghiệp vụ tạo cùng bút toán tự động nhiều lần."""
    result = []
    seen = set()
    for raw in transactions:
        if not isinstance(raw, dict):
            continue
        item = dict(raw)
        source = str(item.get("sourceModule") or item.get("source") or "").lower()
        source_id = item.get("sourceId")
        if source_id is None:
            source_id = item.get("sourceOrderId")
        auto = bool(item.get("createdAutomatically")) or source in {
            "crm", "congno", "congno_payment", "distribution_settlement", "hoptac", "hoptac_muahang", "payroll"
        }
        key = (source, _key(source_id), str(item.get("kind") or ""), _key(item.get("debtId")), _key(item.get("settlementId")))
        if auto and source_id is not None and key in seen:
            continue
        if auto and source_id is not None:
            seen.add(key)
        result.append(item)
    return result


def _normalise_preserved_dates(result):
    """Chuẩn hóa mọi trường ngày nghiệp vụ qua cùng một quy tắc."""
    field_map = {
        "contracts": ("signDate", "startDate", "expiryDate", "endDate", "renewalDate"),
        "capitalContributions": ("date", "contributionDate", "certificationDate", "certificateDate"),
        "fixedAssets": ("purchaseDate", "startDate", "warrantyExpiryDate", "expiryDate"),
        "inventory": ("expiryDate",),
        "orders": ("date", "serviceStartDate", "expiryDate", "invoiceDate"),
        "debts": ("issueDate", "dueDate", "closedDate"),
        "transactions": ("date",),
        "distributionOrders": ("date", "invoiceDate", "paymentDate"),
        "distributionSettlements": ("date", "dueDate", "paidDate"),
        "payrollPayments": ("paidDate",),
        "midMonthRequests": ("date",),
        "attendanceRequests": ("date",),
    }
    for collection_name, date_fields in field_map.items():
        collection = _as_list(result.get(collection_name))
        normalised = []
        for raw in collection:
            if not isinstance(raw, dict):
                continue
            item = dict(raw)
            for field in date_fields:
                if field in item:
                    item[field] = _date_only(item.get(field))
            normalised.append(item)
        if collection_name in result:
            result[collection_name] = normalised

    company = result.get("company")
    if isinstance(company, dict):
        company = dict(company)
        for field in ("establishedDate",):
            if field in company:
                company[field] = _date_only(company.get(field))
        result["company"] = company


def _secure_company_settings(result):
    """Không để mật khẩu Giám đốc tồn tại dạng rõ trong app_state."""
    company = result.get("company")
    if not isinstance(company, dict):
        return
    company = dict(company)
    plaintext = str(company.pop("directorPassword", "") or "").strip()
    if plaintext and not company.get("directorPasswordHash"):
        company["directorPasswordHash"] = password_hash(plaintext)
        company["directorPasswordConfiguredAt"] = _now_iso()
    company["directorPasswordConfigured"] = bool(company.get("directorPasswordHash"))
    result["company"] = company



def _synchronise_settlement_balances(result):
    """Đồng bộ trạng thái quyết toán từ công nợ sau mỗi lần thanh toán/hủy."""
    debts_by_settlement = {
        _key(debt.get("settlementId")): debt
        for debt in _as_list(result.get("debts"))
        if isinstance(debt, dict) and debt.get("settlementId") is not None
    }
    settlements = []
    for raw in _as_list(result.get("distributionSettlements")):
        if not isinstance(raw, dict):
            continue
        item = dict(raw)
        debt = debts_by_settlement.get(_key(item.get("id")))
        if debt:
            paid = max(0.0, _number(debt.get("paidAmount")))
            remaining = max(0.0, _number(debt.get("remainingAmount"), _number(item.get("netAmount")) - paid))
            item.update({
                "paidAmount": paid,
                "remainingAmount": remaining,
                "paymentStatus": "paid" if remaining <= 0 and _number(item.get("netAmount")) > 0 else "partial" if paid > 0 else "unpaid",
                "debtId": debt.get("id"),
            })
        settlements.append(item)
    if "distributionSettlements" in result:
        result["distributionSettlements"] = settlements

    settlement_status = {
        _key(item.get("id")): item.get("paymentStatus")
        for item in settlements
        if item.get("id") is not None
    }
    orders = []
    for raw in _as_list(result.get("distributionOrders")):
        if not isinstance(raw, dict):
            continue
        item = dict(raw)
        payment_status = settlement_status.get(_key(item.get("settlementId")))
        if payment_status:
            item["settlementStatus"] = "settled" if payment_status == "paid" else "partially_paid" if payment_status == "partial" else "approved"
        orders.append(item)
    if "distributionOrders" in result:
        result["distributionOrders"] = orders


def record_debt_payment(data, debt_id, payment_fields, created_by=""):
    """Ghi một giao dịch vào sổ thanh toán bất biến rồi dẫn xuất lại Công nợ/Thu Chi."""
    prepared, payment_id = append_payment(data, debt_id, payment_fields, created_by=created_by)
    return reconcile_company_data(prepared), payment_id


def remove_debt_payment(data, debt_id, payment_id, reversed_by="", reversal_reason=""):
    """Đảo giao dịch thay vì xóa dấu vết; số dư và Thu/Chi được tính lại từ ledger."""
    prepared = reverse_payment(
        data, debt_id, payment_id, reversed_by=reversed_by, reversal_reason=reversal_reason
    )
    return reconcile_company_data(prepared)

def upsert_inventory_product(data, product_fields, opening_stock=0):
    """Tạo/sửa sản phẩm kho, gồm ngày hết hạn, trong một transaction máy chủ."""
    if not isinstance(product_fields, dict):
        raise ValueError("Dữ liệu sản phẩm không hợp lệ.")
    product_id = product_fields.get("id")
    if product_id is None:
        raise ValueError("Sản phẩm thiếu mã định danh.")
    name = str(product_fields.get("name") or "").strip()
    if not name:
        raise ValueError("Tên sản phẩm không được để trống.")
    expiry_date = _date_only(product_fields.get("expiryDate"))
    if expiry_date:
        try:
            date.fromisoformat(expiry_date)
        except ValueError as exc:
            raise ValueError("Ngày hết hạn kho không hợp lệ.") from exc

    result = dict(data or {})
    inventory = [dict(item) for item in _as_list(result.get("inventory")) if isinstance(item, dict)]
    movements = [dict(item) for item in _as_list(result.get("stockMovements")) if isinstance(item, dict)]
    existing = next((item for item in inventory if _key(item.get("id")) == _key(product_id)), None)

    clean = dict(product_fields)
    clean["id"] = product_id
    clean["name"] = name
    clean["expiryDate"] = expiry_date
    clean.pop("openingStock", None)

    if existing:
        # Tồn là số dẫn xuất từ sổ kho; form sửa thông tin không được ghi đè trực tiếp.
        clean.pop("stock", None)
        updated = dict(existing)
        updated.update(clean)
        inventory = [updated if _key(item.get("id")) == _key(product_id) else item for item in inventory]
    else:
        clean["stock"] = 0
        clean.setdefault("createdAt", _now_iso())
        inventory.append(clean)
        quantity = max(0.0, _number(opening_stock))
        if quantity > 0:
            movements.append({
                "id": f"sync:kho:{_key(product_id)}:opening",
                "productId": product_id,
                "movementType": "opening",
                "quantity": quantity,
                "delta": quantity,
                "date": date.today().isoformat(),
                "sourceModule": "kho",
                "sourceId": product_id,
                "note": "Tồn đầu khi tạo sản phẩm",
                "createdBy": product_fields.get("createdBy") or "",
                "createdAt": _now_iso(),
            })

    result["inventory"] = inventory
    result["stockMovements"] = movements
    return reconcile_company_data(result)


def create_crm_order(data, payload, actor_email, actor_employee_id=None, allow_assign_any=False):
    """Ghi một đơn CRM nguyên tử và để tầng đối soát sinh kho/công nợ/Thu Chi.

    Đơn vượt tồn vẫn được ghi nhận nhưng mang ``pending_stock`` và chưa sinh movement
    xuất kho. Nhờ vậy Sale không mất đơn trong lúc chờ bổ sung mã/hàng, còn sổ kho
    không bao giờ bị âm.
    """
    if not isinstance(payload, dict) or not isinstance(payload.get("order"), dict):
        raise ValueError("Dữ liệu đơn hàng không hợp lệ.")
    result = dict(data or {})
    order = dict(payload["order"])
    customer_name = str(order.get("customerName") or "").strip()
    if not customer_name:
        raise ValueError("Vui lòng nhập tên khách hàng.")
    amount = max(0.0, _number(order.get("amount")))
    if amount <= 0:
        raise ValueError("Số tiền đơn hàng phải lớn hơn 0.")
    quantity = _quantity(order.get("quantity"))
    if quantity <= 0:
        raise ValueError("Số lượng bán phải lớn hơn 0.")

    order_id = order.get("id") or f"crm:{uuid.uuid4().hex}"
    existing_orders = [dict(item) for item in _as_list(result.get("orders")) if isinstance(item, dict)]
    if any(_key(item.get("id")) == _key(order_id) for item in existing_orders):
        raise ValueError("Đơn hàng đã tồn tại. Hãy tải lại dữ liệu trước khi lưu tiếp.")

    if not allow_assign_any:
        if actor_employee_id is None:
            raise ValueError("Tài khoản chưa liên kết với hồ sơ Sale/Kỹ thuật.")
        order["saleEmployeeId"] = actor_employee_id
    elif str(order.get("saleEmployeeId") or "") == "none":
        order["saleEmployeeId"] = None

    product = None
    if order.get("productId") not in {None, ""}:
        product = next((
            item for item in _as_list(result.get("inventory"))
            if isinstance(item, dict) and _key(item.get("id")) == _key(order.get("productId"))
        ), None)
        if not product:
            raise ValueError("Sản phẩm đã chọn không còn tồn tại trong kho. Hãy chọn lại sản phẩm.")
        available = max(0.0, _number(product.get("stock")))
        shortage = max(0.0, quantity - available)
        order["inventoryStatus"] = "pending_stock" if shortage > 1e-9 else "fulfilled"
        order["inventoryShortage"] = shortage
        order["productName"] = order.get("productName") or product.get("name") or ""
    else:
        order["productId"] = None
        order["inventoryStatus"] = "not_applicable"
        order["inventoryShortage"] = 0

    order.update({
        "id": order_id,
        "customerName": customer_name,
        "amount": amount,
        "quantity": quantity,
        "createdBy": str(actor_email or "").strip().lower(),
        "createdAt": order.get("createdAt") or _now_iso(),
    })
    existing_orders.append(order)
    result["orders"] = existing_orders

    customer = payload.get("customer")
    if isinstance(customer, dict) and customer.get("id") is not None:
        customers = [dict(item) for item in _as_list(result.get("customers")) if isinstance(item, dict)]
        if not any(_key(item.get("id")) == _key(customer.get("id")) for item in customers):
            customers.append(dict(customer))
        result["customers"] = customers

    distribution_order = payload.get("distributionOrder")
    if isinstance(distribution_order, dict):
        distribution_orders = [dict(item) for item in _as_list(result.get("distributionOrders")) if isinstance(item, dict)]
        linked = dict(distribution_order)
        linked["sourceCrmOrderId"] = order_id
        distribution_orders.append(linked)
        result["distributionOrders"] = distribution_orders

    return reconcile_company_data(result), order_id


def reconcile_company_data(data):
    if not isinstance(data, dict):
        return data

    result = normalise_payment_ledger(dict(data))
    orders, debts, transactions = _synchronise_sales_finance(
        _as_list(result.get("orders")),
        _as_list(result.get("debts")),
        _as_list(result.get("transactions")),
    )

    inventory, movements, inventory_issues = _normalise_inventory_and_movements(
        _as_list(result.get("inventory")),
        orders,
        _as_list(result.get("stockMovements")),
    )

    distribution_orders = _normalise_distribution_orders(
        orders,
        _as_list(result.get("distributionOrders")),
    )

    result["orders"] = orders
    result["debts"] = debts
    result["inventory"] = inventory
    result["stockMovements"] = movements
    result["inventoryLedgerIssues"] = inventory_issues
    result["inventoryLedgerBalanced"] = not any(issue.get("type") in {"negative_stock", "unknown_product", "order_product_missing"} for issue in inventory_issues)
    result["distributionOrders"] = distribution_orders
    result["transactions"] = _dedupe_auto_transactions(transactions)
    _normalise_preserved_dates(result)
    _secure_company_settings(result)
    _synchronise_settlement_balances(result)
    return result
