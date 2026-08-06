"""Migration luồng bán hàng — EXPAND-AND-CONTRACT, giữ tương thích dữ liệu cũ.

Giai đoạn EXPAND (vòng này):
  - Mỗi đơn nhận 4 TRẠNG THÁI ĐỘC LẬP: orderStatus / inventoryStatus /
    paymentStatus / invoiceStatus — completed KHÔNG suy ra paid hay issued.
  - items[] chuẩn hóa (product_id, quantity, uom, unit_price, discount, vat_rate,
    subtotal, vat_amount, total_amount, historical_unit_cost khi xuất kho).
  - legacy status KHÔNG bị xóa (giữ ở ``legacyStatus`` + trường cũ nguyên vẹn).
  - Chỉ backfill khi xác định CHẮC CHẮN từ dữ liệu nguồn (tiền thật trong
    paymentLedger, movement kho thật, số hóa đơn thật); mơ hồ → ``needsReview``.
  - Có dry-run (báo cáo đếm theo kết quả mapping), commit và rollback tương đương.

Tiền do backend tính bằng Decimal: subtotal (chưa VAT), vat_amount, total_amount,
collected (đã thu), remaining (còn phải thu) — không tin tổng client gửi lên.
"""

from __future__ import annotations

from decimal import Decimal

from db.accounting_store import to_money

MIGRATION_VERSION = 1

ORDER_STATUSES = {"draft", "pending_confirmation", "confirmed", "processing", "completed", "cancelled"}
INVENTORY_STATUSES = {"not_reserved", "reserved", "partially_issued", "fully_issued", "returned"}
PAYMENT_STATUSES = {"unpaid", "partially_paid", "paid", "partially_refunded", "fully_refunded"}
INVOICE_STATUSES = {"not_issued", "pending_issue", "issued", "adjusted", "cancelled"}

# Ma trận chuyển trạng thái hợp lệ — mọi nghiệp vụ đổi trạng thái phải đi qua đây.
_TRANSITIONS = {
    "order": {
        "draft": {"pending_confirmation", "confirmed", "cancelled"},
        "pending_confirmation": {"confirmed", "cancelled"},
        "confirmed": {"processing", "completed", "cancelled"},
        "processing": {"completed", "cancelled"},
        "completed": {"cancelled"},
        "cancelled": set(),
    },
    "inventory": {
        "not_reserved": {"reserved", "partially_issued", "fully_issued"},
        "reserved": {"not_reserved", "partially_issued", "fully_issued"},
        "partially_issued": {"fully_issued", "returned"},
        "fully_issued": {"returned"},
        "returned": set(),
    },
    "payment": {
        "unpaid": {"partially_paid", "paid"},
        "partially_paid": {"paid", "partially_refunded", "fully_refunded"},
        "paid": {"partially_refunded", "fully_refunded"},
        "partially_refunded": {"fully_refunded"},
        "fully_refunded": set(),
    },
    "invoice": {
        "not_issued": {"pending_issue", "issued"},
        "pending_issue": {"issued", "cancelled"},
        "issued": {"adjusted", "cancelled"},
        "adjusted": {"cancelled"},
        "cancelled": set(),
    },
}

_CANCELLED_TOKENS = {"cancelled", "canceled", "deleted", "huy", "đã hủy", "da_huy"}
_COMPLETED_TOKENS = {"completed", "done", "hoan_thanh", "hoàn thành"}


class TransitionError(ValueError):
    pass


def validate_transition(kind, current, new):
    """Kiểm tra chuyển trạng thái hợp lệ — sai thì raise, không âm thầm ghi đè."""
    matrix = _TRANSITIONS.get(kind)
    if matrix is None:
        raise TransitionError(f"Loại trạng thái không hợp lệ: {kind}")
    current = str(current or "")
    new = str(new or "")
    if new == current:
        return new
    if current not in matrix:
        raise TransitionError(f"Trạng thái hiện tại không hợp lệ: {kind}={current}")
    if new not in matrix[current]:
        raise TransitionError(
            f"Không được chuyển {kind} từ '{current}' sang '{new}'. Được phép: {sorted(matrix[current]) or '—'}"
        )
    return new


def _num(value):
    try:
        return Decimal(str(value or 0))
    except Exception:  # noqa: BLE001
        return Decimal("0")


def _key(value):
    return str(value or "").strip()


def _split_vat(gross, vat_rate):
    gross = to_money(gross)
    rate = _num(vat_rate)
    if rate <= 0:
        return gross, to_money(0)
    net = to_money(gross / (Decimal("1") + rate / Decimal("100")))
    return net, to_money(gross - net)


def _payment_evidence(data):
    """(order_id -> Decimal đã thu) — CHỈ từ bản ghi tiền thật, không suy đoán."""
    debts_by_order = {}
    debt_to_order = {}
    for debt in data.get("debts") or []:
        if not isinstance(debt, dict) or str(debt.get("type") or "thu") != "thu":
            continue
        oid = _key(debt.get("orderId"))
        if oid:
            debts_by_order[oid] = debt
            debt_to_order[_key(debt.get("id"))] = oid
    collected = {}
    for entry in data.get("paymentLedger") or []:
        if not isinstance(entry, dict):
            continue
        if str(entry.get("status") or "posted") == "reversed":
            continue
        if str(entry.get("entryType") or "payment") == "reversal":
            continue
        oid = debt_to_order.get(_key(entry.get("debtId")))
        if not oid:
            continue
        collected[oid] = collected.get(oid, Decimal("0")) + abs(_num(entry.get("amount")))
    # Khoản thu ngay gắn trực tiếp đơn (legacy): transactions có orderId/sourceId đơn.
    # CHỈ dùng khi đơn KHÔNG có công nợ — nếu có, tiền đã được đếm qua paymentLedger;
    # đếm thêm transaction mirror của cùng dòng tiền sẽ nhân đôi số "đã thu".
    for tx in data.get("transactions") or []:
        if not isinstance(tx, dict) or str(tx.get("kind")) != "thu":
            continue
        if tx.get("reversalOf") or tx.get("reversedByEntryId"):
            continue
        oid = _key(tx.get("orderId") or "")
        if not oid and str(tx.get("source") or tx.get("sourceModule") or "") == "crm":
            oid = _key(tx.get("sourceId"))
        if oid and oid not in debts_by_order:
            collected[oid] = collected.get(oid, Decimal("0")) + abs(_num(tx.get("amount")))
    return collected, debts_by_order


def _inventory_evidence(data):
    """(order_id -> {'issued': qty, 'returned': qty}) từ movement kho thật."""
    result = {}
    for movement in data.get("stockMovements") or []:
        if not isinstance(movement, dict):
            continue
        oid = _key(movement.get("sourceId"))
        if not oid:
            continue
        mtype = str(movement.get("movementType") or "")
        reversed_flag = str(movement.get("status") or "posted") == "reversed"
        qty = abs(_num(movement.get("delta") if movement.get("delta") is not None else movement.get("quantity")))
        bucket = result.setdefault(oid, {"issued": Decimal("0"), "returned": Decimal("0")})
        if mtype in {"sale", "sale_out"} and not reversed_flag:
            bucket["issued"] += qty
        elif mtype in {"cancel_reverse", "sale_return", "return_in"} and not reversed_flag:
            bucket["returned"] += qty
    return result


def derive_order_statuses(order, *, collected_map, debts_by_order, inventory_map, products):
    """Suy trạng thái từ DỮ LIỆU NGUỒN — trả (fields, needs_review, review_reasons)."""
    oid = _key(order.get("id"))
    review = []
    legacy_status = str(order.get("status") or "").strip().lower()
    quantity = _num(order.get("quantity")) or Decimal("1")
    gross = to_money(_num(order.get("amount")))
    vat_rate = _num(order.get("vatRate"))
    if vat_rate <= 0 and order.get("productId") is not None:
        vat_rate = _num((products.get(_key(order.get("productId"))) or {}).get("vatRate"))
    subtotal, vat_amount = _split_vat(gross, vat_rate)

    # payment: từ tiền thật.
    collected = to_money(collected_map.get(oid, Decimal("0")))
    if collected <= 0:
        payment_status = "unpaid"
    elif collected + Decimal("0.5") >= gross:
        payment_status = "paid"
    else:
        payment_status = "partially_paid"
    remaining = to_money(max(gross - collected, Decimal("0")))

    # inventory: từ movement kho thật.
    inv = inventory_map.get(oid, {"issued": Decimal("0"), "returned": Decimal("0")})
    if order.get("productId") in {None, ""}:
        inventory_status = "not_reserved"  # đơn dịch vụ — không giữ hàng
    elif inv["returned"] > 0 and inv["returned"] + Decimal("0.001") >= inv["issued"]:
        inventory_status = "returned"
    elif inv["issued"] + Decimal("0.001") >= quantity:
        inventory_status = "fully_issued"
    elif inv["issued"] > 0:
        inventory_status = "partially_issued"
    elif str(order.get("inventoryStatus") or "") == "pending_stock":
        inventory_status = "not_reserved"
    else:
        inventory_status = "not_reserved"
        review.append("Không tìm thấy movement xuất kho cho đơn có sản phẩm.")

    # invoice: chỉ 'issued' khi có SỐ hóa đơn thật — KHÔNG suy từ việc đã bán.
    if _key(order.get("invoiceNo")):
        invoice_status = "issued"
    elif legacy_status in _CANCELLED_TOKENS:
        invoice_status = "cancelled" if _key(order.get("invoiceNo")) else "not_issued"
    else:
        invoice_status = "not_issued"

    # order: cancelled/completed rõ ràng từ legacy; còn lại là confirmed (đơn đã
    # ghi nhận) — KHÔNG suy completed ⇒ paid/issued ở bất kỳ đâu.
    if legacy_status in _CANCELLED_TOKENS:
        order_status = "cancelled"
        if collected > 0 and payment_status in {"paid", "partially_paid"}:
            review.append("Đơn đã hủy nhưng còn tiền đã thu chưa hoàn — cần quyết định hoàn tiền.")
    elif legacy_status in _COMPLETED_TOKENS:
        order_status = "completed"
    elif legacy_status in {"", "active", "open", "new", "pending"}:
        order_status = "confirmed"
        if legacy_status in {"new", "pending"}:
            order_status = "pending_confirmation"
    else:
        order_status = "confirmed"
        review.append(f"Trạng thái cũ '{legacy_status}' không thuộc bộ mapping — cần rà tay.")

    item_unit_price = to_money(gross / quantity) if quantity > 0 else gross
    fields = {
        "orderStatus": order_status,
        "inventoryStatus2": inventory_status,
        "paymentStatus": payment_status,
        "invoiceStatus": invoice_status,
        "legacyStatus": str(order.get("status") or ""),
        "amountBreakdown": {
            "subtotal": str(subtotal),
            "vatRate": str(vat_rate),
            "vatAmount": str(vat_amount),
            "totalAmount": str(gross),
            "collected": str(collected),
            "remaining": str(remaining),
        },
        "itemsNormalized": [{
            "product_id": _key(order.get("productId")) or None,
            "quantity": str(quantity),
            "uom": str((products.get(_key(order.get("productId"))) or {}).get("unit") or "cái"),
            "unit_price": str(item_unit_price),
            "discount": "0.00",
            "vat_rate": str(vat_rate),
            "subtotal": str(subtotal),
            "vat_amount": str(vat_amount),
            "total_amount": str(gross),
            "historical_unit_cost": order.get("historicalUnitCost"),
        }],
        "salesMigrationVersion": MIGRATION_VERSION,
    }
    return fields, bool(review), review


def migrate_orders(data, mode="dry-run"):
    """dry-run: chỉ đếm; commit: ghi trường mới cạnh trường cũ (không xóa legacy)."""
    if not isinstance(data, dict):
        return {"mode": mode, "orders": 0}
    products = {_key(p.get("id")): p for p in (data.get("inventory") or []) if isinstance(p, dict)}
    collected_map, debts_by_order = _payment_evidence(data)
    inventory_map = _inventory_evidence(data)

    counts = {
        "orderStatus": {}, "inventoryStatus": {}, "paymentStatus": {}, "invoiceStatus": {},
    }
    needs_review = []
    migrated = 0
    orders = data.get("orders") or []
    for order in orders:
        if not isinstance(order, dict):
            continue
        fields, review, reasons = derive_order_statuses(
            order, collected_map=collected_map, debts_by_order=debts_by_order,
            inventory_map=inventory_map, products=products,
        )
        counts["orderStatus"][fields["orderStatus"]] = counts["orderStatus"].get(fields["orderStatus"], 0) + 1
        counts["inventoryStatus"][fields["inventoryStatus2"]] = counts["inventoryStatus"].get(fields["inventoryStatus2"], 0) + 1
        counts["paymentStatus"][fields["paymentStatus"]] = counts["paymentStatus"].get(fields["paymentStatus"], 0) + 1
        counts["invoiceStatus"][fields["invoiceStatus"]] = counts["invoiceStatus"].get(fields["invoiceStatus"], 0) + 1
        if review:
            needs_review.append({"orderId": _key(order.get("id")), "reasons": reasons})
        if mode == "commit":
            order.update(fields)
            order["needsReview"] = review
            if review:
                order["reviewReasons"] = reasons
            migrated += 1

    return {
        "mode": mode,
        "orders": len([o for o in orders if isinstance(o, dict)]),
        "migrated": migrated if mode == "commit" else 0,
        "counts": counts,
        "needsReview": needs_review,
        "needsReviewCount": len(needs_review),
        "version": MIGRATION_VERSION,
    }


def rollback_orders(data):
    """Rollback tương đương: gỡ toàn bộ trường mới, legacy giữ nguyên."""
    removed = 0
    for order in (data or {}).get("orders") or []:
        if not isinstance(order, dict) or "salesMigrationVersion" not in order:
            continue
        for field in ("orderStatus", "inventoryStatus2", "paymentStatus", "invoiceStatus",
                      "legacyStatus", "amountBreakdown", "itemsNormalized",
                      "salesMigrationVersion", "needsReview", "reviewReasons"):
            order.pop(field, None)
        removed += 1
    return {"mode": "rollback", "rolledBack": removed}
