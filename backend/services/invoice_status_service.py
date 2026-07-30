"""Chuẩn hóa trạng thái hóa đơn để mọi cảnh báo dùng cùng một quy tắc."""

from __future__ import annotations

CANCELLED = {"cancelled", "canceled", "deleted", "huy", "đã hủy", "da_huy", "rejected"}


def normalize_invoice_status(order):
    if not isinstance(order, dict):
        return "missing"
    if order.get("invoiceRequired") is False:
        return "not_required"
    raw = str(order.get("invoiceStatus") or "").strip().lower()
    if raw in {"verified", "da_xac_minh"}:
        return "verified"
    if raw in {"issued", "provided", "da_bo_sung"}:
        return "provided"
    if raw in {"pending", "cho_bo_sung"}:
        return "pending"
    if raw in {"not_required", "khong_yeu_cau"}:
        return "not_required"
    return "missing"


def summarize_invoices(orders):
    counts = {"missing": 0, "pending": 0, "provided": 0, "verified": 0, "not_required": 0}
    order_ids = {key: [] for key in counts}
    for order in orders or []:
        if not isinstance(order, dict):
            continue
        status = str(order.get("orderStatus") or order.get("status") or "").strip().lower()
        if status in CANCELLED:
            continue
        category = normalize_invoice_status(order)
        counts[category] += 1
        order_ids[category].append(order.get("id"))
    return {"counts": counts, "order_ids": order_ids}
