"""Sổ giao dịch thanh toán bất biến cho Công nợ và Đơn bán.

Mỗi lần thu/trả tiền là một bút toán ``posted`` có mã riêng. Khi người dùng hủy,
hệ thống thêm một bút toán ``reversal`` tham chiếu giao dịch gốc thay vì xóa dấu
vết. ``debts.paymentHistory``, ``paidAmount`` và các dòng Thu/Chi chỉ là dữ liệu
dẫn xuất từ sổ này.
"""

from datetime import date, datetime, timezone
import uuid


def _as_list(value):
    return value if isinstance(value, list) else []


def _key(value):
    return str(value) if value is not None else ""


def _number(value, default=0.0):
    try:
        return float(value if value is not None else default)
    except (TypeError, ValueError):
        return float(default)


def _date_only(value):
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = str(value).strip()
    return text[:10] if len(text) >= 10 else text


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _append_audit(result, action, entity_type, entity_id, actor_email, detail):
    events = [dict(item) for item in _as_list(result.get("securityAuditLog")) if isinstance(item, dict)]
    events.append({
        "id": f"audit:{uuid.uuid4().hex}",
        "action": action,
        "entityType": entity_type,
        "entityId": _key(entity_id),
        "actorEmail": actor_email or "",
        "detail": str(detail or ""),
        "success": True,
        "createdAt": _now_iso(),
    })
    result["securityAuditLog"] = events[-1000:]


def _source_order_id(debt):
    if not isinstance(debt, dict):
        return None
    return debt.get("orderId") or (
        debt.get("sourceId") if str(debt.get("sourceModule") or "").lower() == "crm" else None
    )


def _normalise_entry(raw):
    if not isinstance(raw, dict):
        return None
    item = dict(raw)
    item_id = item.get("id") or f"ledger:{uuid.uuid4().hex}"
    entry_type = str(item.get("entryType") or item.get("type") or "payment").lower()
    if entry_type not in {"payment", "reversal"}:
        entry_type = "payment"
    amount = max(0.0, _number(item.get("amount")))
    if amount <= 0:
        return None
    item.update({
        "id": item_id,
        "entryType": entry_type,
        "amount": amount,
        "date": _date_only(item.get("date") or date.today().isoformat()),
        "paymentMethod": item.get("paymentMethod") or "chuyen_khoan",
        "referenceNo": item.get("referenceNo") or "",
        "note": item.get("note") or "",
        "createdBy": item.get("createdBy") or "",
        "createdAt": item.get("createdAt") or _now_iso(),
        "debtId": item.get("debtId"),
        "orderId": item.get("orderId"),
        "reversalOf": item.get("reversalOf"),
        "origin": item.get("origin") or "manual",
        "receiptTransactionId": item.get("receiptTransactionId") or f"tx:{_key(item_id)}",
        "paymentCode": item.get("paymentCode") or f"THU-{_key(item_id)[-10:].upper()}",
    })
    return item


def active_payment_entries(ledger):
    normalised = [entry for entry in (_normalise_entry(item) for item in _as_list(ledger)) if entry]
    reversed_ids = {
        _key(entry.get("reversalOf"))
        for entry in normalised
        if entry.get("entryType") == "reversal" and entry.get("reversalOf") is not None
    }
    return [
        entry for entry in normalised
        if entry.get("entryType") == "payment" and _key(entry.get("id")) not in reversed_ids
    ]


def _entry_to_history(entry):
    return {
        "id": entry.get("id"),
        "date": entry.get("date"),
        "amount": entry.get("amount"),
        "paymentMethod": entry.get("paymentMethod") or "chuyen_khoan",
        "referenceNo": entry.get("referenceNo") or "",
        "linkedTransactionId": entry.get("receiptTransactionId") or f"tx:{_key(entry.get('id'))}",
        "debtPaymentId": entry.get("id"),
        "paymentCode": entry.get("paymentCode") or "",
        "note": entry.get("note") or "",
        "createdBy": entry.get("createdBy") or "",
        "createdAt": entry.get("createdAt") or _now_iso(),
        "origin": entry.get("origin") or "manual",
    }


def normalise_payment_ledger(data):
    """Nâng dữ liệu cũ lên sổ giao dịch và dẫn xuất lại lịch sử thanh toán.

    Chỉ dùng ``paidAmount``/``customerPaidAmount`` để tạo một bút toán legacy khi
    chưa từng có bất kỳ bút toán nào cho đối tượng đó. Vì vậy một giao dịch đã bị
    đảo sẽ không bị trường tổng cũ "hồi sinh" sau khi tải lại.
    """
    result = dict(data or {})
    debts = [dict(item) for item in _as_list(result.get("debts")) if isinstance(item, dict)]
    orders = [dict(item) for item in _as_list(result.get("orders")) if isinstance(item, dict)]
    transactions = [dict(item) for item in _as_list(result.get("transactions")) if isinstance(item, dict)]

    ledger = []
    seen = set()

    def add_entry(raw):
        item = _normalise_entry(raw)
        if not item:
            return None
        key = _key(item.get("id"))
        if not key or key in seen:
            return None
        seen.add(key)
        ledger.append(item)
        return item

    for raw in _as_list(result.get("paymentLedger")):
        add_entry(raw)

    # Nhập từng lần thanh toán cũ vào sổ mới.
    for debt in debts:
        order_id = _source_order_id(debt)
        for index, payment in enumerate(_as_list(debt.get("paymentHistory"))):
            if not isinstance(payment, dict) or payment.get("reversed"):
                continue
            payment_id = payment.get("id") or payment.get("linkedTransactionId") or f"legacy:debt:{_key(debt.get('id'))}:{index}"
            add_entry({
                "id": payment_id,
                "entryType": "payment",
                "debtId": debt.get("id"),
                "orderId": order_id,
                "amount": payment.get("amount"),
                "date": payment.get("date") or debt.get("issueDate"),
                "paymentMethod": payment.get("paymentMethod"),
                "referenceNo": payment.get("referenceNo"),
                "note": payment.get("note"),
                "createdBy": payment.get("createdBy"),
                "createdAt": payment.get("createdAt"),
                "origin": payment.get("origin") or "legacy_history",
            })

    all_entries = lambda: [entry for entry in ledger if entry.get("entryType") in {"payment", "reversal"}]

    # Dữ liệu cũ đôi khi chỉ còn paidAmount + một dòng Thu CRM tổng hợp. Tạo đúng
    # một bút toán legacy để khôi phục lịch sử kiểm toán, không tạo nhiều dòng.
    for debt in debts:
        debt_key = _key(debt.get("id"))
        order_key = _key(_source_order_id(debt))
        has_any = any(
            _key(entry.get("debtId")) == debt_key
            or (order_key and _key(entry.get("orderId")) == order_key)
            for entry in all_entries()
        )
        if has_any:
            continue
        paid = max(0.0, _number(debt.get("paidAmount")))
        if paid <= 0:
            continue
        matched_tx = next((tx for tx in transactions if _key(tx.get("debtId")) == debt_key), None)
        if matched_tx is None and order_key:
            matched_tx = next((tx for tx in transactions if _key(tx.get("orderId") or tx.get("sourceOrderId") or tx.get("sourceId")) == order_key and tx.get("kind") == "thu"), None)
        add_entry({
            "id": f"legacy:debt:{debt_key}:opening-payment",
            "entryType": "payment",
            "debtId": debt.get("id"),
            "orderId": _source_order_id(debt),
            "amount": paid,
            "date": (matched_tx or {}).get("date") or debt.get("issueDate") or date.today().isoformat(),
            "paymentMethod": (matched_tx or {}).get("paymentMethod") or "chuyen_khoan",
            "referenceNo": (matched_tx or {}).get("paymentReference") or "",
            "note": "Khoản thanh toán tổng hợp được khôi phục khi nâng cấp sổ giao dịch",
            "createdBy": (matched_tx or {}).get("createdBy") or "server-migration",
            "origin": "legacy_paid_amount",
            "receiptTransactionId": (matched_tx or {}).get("id") or f"tx:legacy:debt:{debt_key}:opening-payment",
            "paymentCode": f"THU-LEGACY-{debt_key[-8:].upper()}",
        })

    # Đơn đã thu đủ nhưng bản cũ không tạo công nợ vẫn phải có giao dịch kiểm toán.
    for order in orders:
        order_key = _key(order.get("id"))
        if not order_key:
            continue
        has_any = any(_key(entry.get("orderId")) == order_key for entry in all_entries())
        if has_any:
            continue
        paid = max(0.0, _number(order.get("customerPaidAmount")))
        if paid <= 0:
            continue
        add_entry({
            "id": f"legacy:order:{order_key}:opening-payment",
            "entryType": "payment",
            "orderId": order.get("id"),
            "amount": paid,
            "date": order.get("date") or date.today().isoformat(),
            "paymentMethod": order.get("paymentMethod") or "chuyen_khoan",
            "note": "Khoản thu ban đầu của đơn bán được đưa vào sổ giao dịch",
            "createdBy": order.get("createdBy") or order.get("importedBy") or "server-migration",
            "origin": "order_initial_payment",
        })

    active = active_payment_entries(ledger)
    debt_by_order = {
        _key(_source_order_id(debt)): debt
        for debt in debts
        if _source_order_id(debt) is not None
    }

    # Tạo hồ sơ công nợ đã thanh toán cho đơn full-paid cũ để lịch sử không biến mất.
    for order in orders:
        order_key = _key(order.get("id"))
        order_entries = [entry for entry in active if _key(entry.get("orderId")) == order_key]
        if not order_entries or order_key in debt_by_order:
            continue
        debt = {
            "id": f"sync:crm:{order_key}:receivable",
            "type": "thu",
            "counterpartyType": "customer",
            "counterpartyId": order.get("customerId"),
            "counterpartyName": order.get("customerName") or "",
            "counterpartyPhone": order.get("phone") or "",
            "sourceModule": "crm",
            "sourceId": order.get("id"),
            "orderId": order.get("id"),
            "amount": max(0.0, _number(order.get("amount"))),
            "issueDate": _date_only(order.get("date")),
            "dueDate": _date_only(order.get("date")),
            "note": f"Phải thu đơn CRM #{order.get('id')}",
            "createdAt": order.get("createdAt") or _now_iso(),
            "createdBy": order.get("createdBy") or order.get("importedBy") or "server-migration",
        }
        debts.append(debt)
        debt_by_order[order_key] = debt

    # Gắn debtId cho các entry đơn bán và dẫn xuất paymentHistory từ ledger.
    debt_ids_by_order = {
        _key(_source_order_id(debt)): debt.get("id")
        for debt in debts
        if _source_order_id(debt) is not None
    }
    for entry in ledger:
        if entry.get("entryType") != "payment" or entry.get("debtId") is not None:
            continue
        debt_id = debt_ids_by_order.get(_key(entry.get("orderId")))
        if debt_id is not None:
            entry["debtId"] = debt_id

    active = active_payment_entries(ledger)
    for debt in debts:
        debt_key = _key(debt.get("id"))
        order_key = _key(_source_order_id(debt))
        entries = [
            entry for entry in active
            if _key(entry.get("debtId")) == debt_key
            or (order_key and _key(entry.get("orderId")) == order_key)
        ]
        entries.sort(key=lambda item: (item.get("date") or "", item.get("createdAt") or "", _key(item.get("id"))))
        debt["paymentHistory"] = [_entry_to_history(entry) for entry in entries]
        debt["directPaidAmount"] = 0

    # Loại các dòng thu CRM/công nợ cũ; business_sync_service sẽ dựng lại đúng một
    # dòng cho mỗi entry đang hiệu lực.
    cleaned_transactions = []
    for transaction in transactions:
        source = str(transaction.get("sourceModule") or transaction.get("source") or "").lower()
        if source in {"crm", "congno", "congno_payment", "payment_ledger"} and transaction.get("kind") in {"thu", "chi"}:
            continue
        cleaned_transactions.append(transaction)

    result["debts"] = debts
    result["orders"] = orders
    result["paymentLedger"] = ledger
    result["transactions"] = cleaned_transactions
    return result


def append_payment(data, debt_id, payment_fields, created_by=""):
    result = normalise_payment_ledger(data)
    debts = [item for item in _as_list(result.get("debts")) if isinstance(item, dict)]
    debt = next((item for item in debts if _key(item.get("id")) == _key(debt_id)), None)
    if not debt:
        raise ValueError("Không tìm thấy khoản công nợ.")

    idempotency_key = str((payment_fields or {}).get("idempotencyKey") or "").strip()
    if idempotency_key:
        existing = next((
            item for item in _as_list(result.get("paymentLedger"))
            if isinstance(item, dict)
            and item.get("entryType", "payment") == "payment"
            and str(item.get("idempotencyKey") or "") == idempotency_key
            and _key(item.get("debtId")) == _key(debt_id)
        ), None)
        if existing:
            return result, existing.get("id")

    amount = max(0.0, _number((payment_fields or {}).get("amount")))
    remaining = max(0.0, _number(debt.get("amount")) - sum(_number(item.get("amount")) for item in _as_list(debt.get("paymentHistory"))))
    if amount <= 0:
        raise ValueError("Số tiền thanh toán phải lớn hơn 0.")
    if amount > remaining + 1e-9:
        raise ValueError(f"Số tiền vượt quá còn nợ ({remaining:g}đ).")

    payment_id = f"pay:{uuid.uuid4().hex}"
    entry = {
        "id": payment_id,
        "entryType": "payment",
        "debtId": debt.get("id"),
        "orderId": _source_order_id(debt),
        "amount": amount,
        "date": _date_only((payment_fields or {}).get("date") or date.today().isoformat()),
        "paymentMethod": (payment_fields or {}).get("paymentMethod") or "chuyen_khoan",
        "referenceNo": (payment_fields or {}).get("referenceNo") or "",
        "note": (payment_fields or {}).get("note") or "",
        "createdBy": created_by or "",
        "createdAt": _now_iso(),
        "origin": "debt_payment",
        "idempotencyKey": idempotency_key or None,
        "paymentCode": (payment_fields or {}).get("paymentCode") or f"THU-{payment_id[-10:].upper()}",
        "receiptTransactionId": f"tx:{payment_id}",
    }
    result["paymentLedger"] = [*_as_list(result.get("paymentLedger")), entry]
    _append_audit(
        result,
        "debt_payment_posted",
        "debt_payment",
        payment_id,
        created_by,
        f"Ghi nhận thanh toán {amount:g}đ cho công nợ {_key(debt_id)}.",
    )
    return result, payment_id


def reverse_payment(data, debt_id, payment_id, reversed_by="", reversal_reason=""):
    result = normalise_payment_ledger(data)
    active = active_payment_entries(result.get("paymentLedger"))
    target = next((entry for entry in active if _key(entry.get("id")) == _key(payment_id)), None)
    if not target:
        raise ValueError("Không tìm thấy lần thanh toán hoặc giao dịch đã được đảo.")
    if debt_id is not None and _key(target.get("debtId")) != _key(debt_id):
        raise ValueError("Lần thanh toán không thuộc khoản công nợ này.")
    reversal = {
        "id": f"reversal:{uuid.uuid4().hex}",
        "entryType": "reversal",
        "reversalOf": target.get("id"),
        "debtId": target.get("debtId"),
        "orderId": target.get("orderId"),
        "amount": target.get("amount"),
        "date": date.today().isoformat(),
        "paymentMethod": target.get("paymentMethod") or "chuyen_khoan",
        "referenceNo": target.get("referenceNo") or "",
        "note": str(reversal_reason or f"Đảo giao dịch {target.get('id')}"),
        "createdBy": reversed_by or "",
        "createdAt": _now_iso(),
        "origin": "payment_reversal",
    }
    result["paymentLedger"] = [*_as_list(result.get("paymentLedger")), reversal]
    _append_audit(
        result,
        "debt_payment_reversed",
        "debt_payment",
        target.get("id"),
        reversed_by,
        f"Đảo thanh toán {target.get('amount')}đ. Lý do: {reversal_reason}",
    )
    return result
