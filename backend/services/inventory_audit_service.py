"""Lịch sử chỉnh sửa Kho hàng + thông báo toàn công ty khi kho thay đổi.

Chính sách kho mở: mọi nhân viên đều thêm/sửa/xóa được sản phẩm, nên trách nhiệm
được truy vết bằng DẤU VẾT thay vì chặn quyền:

- Mỗi sản phẩm mang ``history`` (server-authoritative — client gửi lên bị bỏ qua):
  ai sửa, lúc nào, field nào đổi từ giá trị nào sang giá trị nào.
- ``inventoryAuditLog`` cấp toàn cục giữ cả sự kiện XÓA (bản ghi đã biến mất thì
  history theo sản phẩm không còn chỗ bám).
- Khi có sản phẩm MỚI hoặc SỐ LƯỢNG TỒN tăng/giảm: phát thông báo hệ thống
  (announcements — banner/ticker realtime), nhắn DOMIX cho mọi tài khoản và gửi
  email Gmail cho mọi nhân viên (gửi nền, không chặn request).
"""

import threading
import time
from datetime import datetime, timedelta, timezone

from db.state_store import update_state

# Giờ Việt Nam cố định — announcements được client so sánh theo giờ máy người xem.
_VN_TZ = timezone(timedelta(hours=7))

_HISTORY_LIMIT = 100
_AUDIT_LOG_LIMIT = 1000

# Field theo dõi diff + nhãn tiếng Việt hiển thị trong modal Lịch sử.
TRACKED_FIELDS = (
    ("name", "Tên sản phẩm"),
    ("sku", "SKU"),
    ("groupName", "Nhóm hàng"),
    ("unit", "Đơn vị"),
    ("stock", "Số lượng tồn"),
    ("minStock", "Tồn tối thiểu"),
    ("costPrice", "Giá vốn"),
    ("sellPrice", "Giá bán"),
    ("vatRate", "Thuế VAT (%)"),
    ("durationMonths", "Thời hạn (tháng)"),
    ("expiryDate", "Ngày hết hạn"),
    ("supplierName", "Nhà cung cấp"),
    ("assignedEmployeeId", "Nhân viên phụ trách"),
    ("discontinued", "Ngừng kinh doanh"),
)
_NUMERIC_FIELDS = {"stock", "minStock", "costPrice", "sellPrice", "vatRate", "durationMonths"}


def _now_vn():
    return datetime.now(_VN_TZ)


def _stamp():
    return _now_vn().strftime("%Y-%m-%d %H:%M:%S")


def _norm(field, value):
    if field == "discontinued":
        return bool(value)
    if field in _NUMERIC_FIELDS:
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0
    if field == "assignedEmployeeId":
        try:
            numeric = int(value)
            return numeric if numeric > 0 else None
        except (TypeError, ValueError):
            return None
    return str(value or "").strip()


def _display(field, value):
    normalized = _norm(field, value)
    if field == "discontinued":
        return "Có" if normalized else "Không"
    if normalized in (None, ""):
        return "—"
    if field in _NUMERIC_FIELDS:
        # 10.0 hiển thị "10", 10.5 giữ "10.5".
        return str(int(normalized)) if float(normalized) == int(normalized) else str(normalized)
    return str(normalized)


def _key(value):
    return str(value)


def _products_by_id(data):
    return {
        _key(item.get("id")): item
        for item in (data or {}).get("inventory") or []
        if isinstance(item, dict) and item.get("id") is not None
    }


def apply_inventory_audit(existing_data, new_data, actor_email="", actor_name="", events_box=None):
    """Chạy TRONG transaction update_state, SAU reconcile — so sánh kho cũ/mới,
    gắn history server-authoritative cho từng sản phẩm và gom sự kiện cần thông báo.

    ``events_box`` là list bên ngoài closure: được CLEAR mỗi lần chạy để an toàn khi
    update_state retry vì xung đột phiên bản.
    """
    if events_box is not None:
        events_box.clear()
    if not isinstance(new_data, dict):
        return new_data

    old_products = _products_by_id(existing_data if isinstance(existing_data, dict) else {})
    new_inventory = new_data.get("inventory")
    if not isinstance(new_inventory, list):
        return new_data

    stamp = _stamp()
    actor_email = str(actor_email or "").strip()
    actor_name = str(actor_name or "").strip() or actor_email or "Hệ thống"
    audit_entries = []
    rebuilt_inventory = []

    for item in new_inventory:
        if not isinstance(item, dict) or item.get("id") is None:
            rebuilt_inventory.append(item)
            continue
        old = old_products.get(_key(item.get("id")))
        # History là dữ liệu MÁY CHỦ quản lý: luôn lấy bản đã lưu làm gốc, bỏ qua
        # bất kỳ history nào client gửi lên (chống ghi đè/xóa dấu vết).
        base_history = old.get("history") if isinstance(old, dict) and isinstance(old.get("history"), list) else []
        product = dict(item)

        if old is None:
            initial = [
                {"field": field, "label": label, "from": None, "to": _display(field, product.get(field))}
                for field, label in TRACKED_FIELDS
                if _norm(field, product.get(field)) not in (None, "", 0.0, False)
            ]
            entry = {
                "id": f"invh:{int(time.time() * 1000)}:{len(audit_entries)}",
                "at": stamp, "byEmail": actor_email, "byName": actor_name,
                "action": "create", "changes": initial,
            }
            product["history"] = [entry]
            audit_entries.append({**entry, "productId": product.get("id"), "productName": product.get("name") or ""})
            if events_box is not None:
                events_box.append({
                    "type": "created",
                    "name": str(product.get("name") or ""),
                    "sku": str(product.get("sku") or ""),
                    "unit": str(product.get("unit") or ""),
                    "stock": _norm("stock", product.get("stock")),
                })
        else:
            changes = []
            for field, label in TRACKED_FIELDS:
                before = _norm(field, old.get(field))
                after = _norm(field, product.get(field))
                if before != after:
                    changes.append({
                        "field": field, "label": label,
                        "from": _display(field, old.get(field)), "to": _display(field, product.get(field)),
                    })
            if changes:
                entry = {
                    "id": f"invh:{int(time.time() * 1000)}:{len(audit_entries)}",
                    "at": stamp, "byEmail": actor_email, "byName": actor_name,
                    "action": "update", "changes": changes,
                }
                product["history"] = (base_history + [entry])[-_HISTORY_LIMIT:]
                audit_entries.append({**entry, "productId": product.get("id"), "productName": product.get("name") or ""})
                stock_change = next((c for c in changes if c["field"] == "stock"), None)
                if stock_change and events_box is not None:
                    before_qty = _norm("stock", old.get("stock"))
                    after_qty = _norm("stock", product.get("stock"))
                    events_box.append({
                        "type": "stock",
                        "name": str(product.get("name") or ""),
                        "sku": str(product.get("sku") or ""),
                        "unit": str(product.get("unit") or ""),
                        "from": before_qty, "to": after_qty, "delta": after_qty - before_qty,
                    })
            else:
                product["history"] = base_history
        rebuilt_inventory.append(product)

    # Sản phẩm bị XÓA: history theo sản phẩm không còn — ghi vào sổ audit toàn cục.
    new_ids = {_key(item.get("id")) for item in new_inventory if isinstance(item, dict) and item.get("id") is not None}
    for pid, old in old_products.items():
        if pid in new_ids:
            continue
        entry = {
            "id": f"invh:{int(time.time() * 1000)}:{len(audit_entries)}",
            "at": stamp, "byEmail": actor_email, "byName": actor_name,
            "action": "delete", "changes": [],
            "productId": old.get("id"), "productName": old.get("name") or "",
        }
        audit_entries.append(entry)
        if events_box is not None:
            events_box.append({
                "type": "deleted",
                "name": str(old.get("name") or ""),
                "sku": str(old.get("sku") or ""),
                "unit": str(old.get("unit") or ""),
                "stock": _norm("stock", old.get("stock")),
            })

    result = dict(new_data)
    result["inventory"] = rebuilt_inventory
    if audit_entries:
        log = [item for item in (result.get("inventoryAuditLog") or []) if isinstance(item, dict)]
        result["inventoryAuditLog"] = (log + audit_entries)[-_AUDIT_LOG_LIMIT:]
    return result


def _qty(value):
    return str(int(value)) if float(value or 0) == int(value or 0) else str(value)


def _event_line(event):
    unit = str(event.get("unit") or "").strip()
    label = f"{event.get('name')}" + (f" ({event.get('sku')})" if event.get("sku") else "")
    if event.get("type") == "created":
        return f"Thêm sản phẩm mới: {label} — tồn đầu {_qty(event.get('stock'))} {unit}".rstrip()
    if event.get("type") == "deleted":
        return f"Xóa sản phẩm: {label} (tồn lúc xóa {_qty(event.get('stock'))} {unit})".rstrip()
    delta = float(event.get("delta") or 0)
    arrow = "tăng" if delta > 0 else "giảm"
    return (
        f"Số lượng {label} {arrow} {_qty(abs(delta))} {unit}: "
        f"{_qty(event.get('from'))} → {_qty(event.get('to'))}"
    ).rstrip()


def notify_inventory_events(db_path, actor_user, actor_name, events):
    """Thông báo hệ thống + tin nhắn DOMIX + email cho TOÀN BỘ nhân viên.

    Gọi SAU khi transaction chính đã lưu thành công. Mọi lỗi thông báo chỉ ghi log,
    không bao giờ làm hỏng thao tác kho vừa lưu.
    """
    events = [event for event in (events or []) if isinstance(event, dict)]
    if not events:
        return

    actor_name = str(actor_name or "").strip() or str((actor_user or {}).get("email") or "").strip() or "Hệ thống"
    lines = [_event_line(event) for event in events]
    # Thay đổi DỮ LIỆU (kho) KHÔNG lên thanh thông báo — chỉ nhắn DOMIX + email.
    # Thanh thông báo dành cho tin NGHIỆP VỤ theo module (notify_marketing_events...).

    body = "\n".join([
        "[CẬP NHẬT KHO HÀNG]",
        f"Người thao tác: {actor_name}",
        *[f"- {line}" for line in lines],
        "Mở DOMIX > Sản phẩm & Kho để xem chi tiết và lịch sử chỉnh sửa.",
    ])

    # 2) Tin nhắn DOMIX cho mọi tài khoản đang hoạt động (trừ chính người thao tác).
    try:
        from services import chat_service, user_service

        actor_email = str((actor_user or {}).get("email") or "").strip().lower()
        for account in user_service.list_users(db_path):
            try:
                if not account.get("active"):
                    continue
                email = str(account.get("email") or "").strip().lower()
                if not email or email == actor_email:
                    continue
                chat_service.send_message(db_path, actor_user, email, body)
            except Exception as exc:  # noqa: BLE001
                print(f"[INVENTORY NOTIFY] Không nhắn được cho {account.get('email')}: {exc}")
    except Exception as exc:  # noqa: BLE001
        print(f"[INVENTORY NOTIFY] Không gửi được tin nhắn DOMIX: {exc}")

    # 3) Email Gmail cho mọi nhân viên — chạy NỀN để request kho trả về ngay.
    thread = threading.Thread(
        target=_send_emails_background,
        args=(db_path, actor_name, lines),
        daemon=True,
    )
    thread.start()


def post_ticker_announcement(db_path, text):
    """Đăng một bản tin nghiệp vụ lên thanh thông báo (ticker) — mặc định chạy 24h."""
    ticker_text = str(text or "").strip()
    if not ticker_text:
        return
    if len(ticker_text) > 240:
        ticker_text = ticker_text[:237] + "…"

    def append_announcement(existing_data):
        result = dict(existing_data or {})
        announcements = [item for item in (result.get("announcements") or []) if isinstance(item, dict)]
        now = _now_vn()
        announcements.append({
            "id": int(time.time() * 1000),
            "text": ticker_text,
            "approved": True,
            "approvedAt": now.strftime("%Y-%m-%d %H:%M:%S"),
            "startAt": now.strftime("%Y-%m-%dT%H:%M"),
            "durationMinutes": 1440,
            "createdAt": now.strftime("%Y-%m-%d %H:%M:%S"),
            "source": "module",
        })
        result["announcements"] = announcements[-200:]
        return result

    update_state(db_path, append_announcement)


def detect_marketing_daily_events(existing_data, new_data, events_box):
    """Bản ghi Ghi nhận hiệu suất ngày MỚI → sự kiện nghiệp vụ cho thanh thông báo."""
    events_box.clear()
    if not isinstance(new_data, dict) or not isinstance(new_data.get("marketingLogs"), list):
        return
    old_ids = {str(l.get("id")) for l in (existing_data or {}).get("marketingLogs") or [] if isinstance(l, dict)}
    for log in new_data["marketingLogs"]:
        if not isinstance(log, dict) or log.get("archived") or str(log.get("id")) in old_ids:
            continue
        customers = [c for c in (log.get("customers") or []) if isinstance(c, dict)]
        events_box.append({
            "employeeId": log.get("employeeId"),
            "date": str(log.get("date") or ""),
            "reached": int(float(log.get("customersReached") or 0)),
            "conversions": int(float(log.get("conversions") or 0)),
            "bought": sum(1 for c in customers if c.get("orderId") or c.get("outcome") == "da_mua"),
            "leads": sum(1 for c in customers if c.get("leadId")),
        })


def notify_marketing_events(db_path, events):
    """Ticker chạy tin NGHIỆP VỤ: 'Nguyễn Văn A chốt được 10 khách ngày ...'."""
    events = [event for event in (events or []) if isinstance(event, dict)]
    if not events:
        return
    try:
        from services import employee_service
        names = {str(e.get("id")): e.get("name") for e in employee_service.list_employees(db_path)}
    except Exception:  # noqa: BLE001
        names = {}
    for event in events:
        name = names.get(str(event.get("employeeId"))) or "Nhân viên"
        parts = [f"📣 MARKETING · {name} chốt được {event['reached']} khách ngày {event['date']}"]
        if event["conversions"]:
            parts.append(f"{event['conversions']} chuyển đổi")
        if event["bought"]:
            parts.append(f"{event['bought']} khách ĐÃ MUA HÀNG")
        if event["leads"]:
            parts.append(f"{event['leads']} khách tiềm năng mới")
        try:
            post_ticker_announcement(db_path, " · ".join(parts))
        except Exception as exc:  # noqa: BLE001
            print(f"[MARKETING NOTIFY] Không đăng được thông báo: {exc}")


_PAYMENT_LABELS = {
    "paid": "Đã thanh toán đủ",
    "partial": "Thanh toán một phần",
    "unpaid": "Chưa thanh toán",
}
_INVENTORY_STATUS_LABELS = {
    "fulfilled": "Đã xuất kho",
    "pending_stock": "Chờ hàng (vượt tồn)",
    "not_applicable": "Dịch vụ — không quản kho",
}


def _fmt_vnd(value):
    try:
        return f"{int(round(float(value))):,}".replace(",", ".") + "đ"
    except (TypeError, ValueError):
        return "—"


def detect_new_sale_orders(existing_data, new_data, events_box):
    """Đơn bán hàng MỚI trong ``orders`` → sự kiện email cho Sếp/Admin:
    ai bán, cho khách nào, món gì, số lượng, tiền, tình trạng thanh toán/kho."""
    events_box.clear()
    if not isinstance(new_data, dict) or not isinstance(new_data.get("orders"), list):
        return
    old_ids = {
        str(o.get("id")) for o in (existing_data or {}).get("orders") or []
        if isinstance(o, dict) and o.get("id") is not None
    }
    for order in new_data["orders"]:
        if not isinstance(order, dict) or order.get("id") is None or str(order.get("id")) in old_ids:
            continue
        items = [it for it in (order.get("items") or []) if isinstance(it, dict)]
        if items:
            product_summary = "; ".join(
                f"{it.get('description') or '—'} × {_qty(it.get('quantity') or 0)}"
                + (f" × {_fmt_vnd(it.get('unitPrice'))}" if it.get("unitPrice") else "")
                for it in items
            )
            quantity_text = _qty(sum(float(it.get("quantity") or 0) for it in items))
        else:
            product_summary = str(order.get("productName") or order.get("product") or "—")
            quantity_text = _qty(float(order.get("quantity") or 1))
        events_box.append({
            "orderId": order.get("id"),
            "date": str(order.get("date") or ""),
            "customerName": str(order.get("customerName") or order.get("customer") or "Khách hàng"),
            "productSummary": product_summary,
            "quantityText": quantity_text,
            "amountText": _fmt_vnd(order.get("amount")),
            "paymentLabel": _PAYMENT_LABELS.get(str(order.get("customerPaymentStatus") or "unpaid"), "Chưa thanh toán"),
            "inventoryLabel": _INVENTORY_STATUS_LABELS.get(str(order.get("inventoryStatus") or ""), "—"),
            "sellerEmployeeId": order.get("saleEmployeeId") or order.get("employeeId"),
        })


def notify_sale_events(db_path, actor_user, actor_name, events):
    """Email ĐƠN BÁN HÀNG MỚI về cho các tài khoản Sếp/Admin — chạy nền, lỗi chỉ ghi log."""
    events = [event for event in (events or []) if isinstance(event, dict)]
    if not events:
        return
    actor_name = str(actor_name or "").strip() or str((actor_user or {}).get("email") or "").strip() or "Nhân viên"
    thread = threading.Thread(
        target=_send_sale_emails_background,
        args=(db_path, actor_name, events),
        daemon=True,
    )
    thread.start()


def _send_sale_emails_background(db_path, actor_name, events):
    try:
        from services import email_service, employee_service, user_service

        employee_names = {}
        try:
            employee_names = {
                str(e.get("id")): str(e.get("name") or "").strip()
                for e in employee_service.list_employees(db_path)
            }
        except Exception:  # noqa: BLE001
            pass

        # Người nhận: các tài khoản QUẢN TRỊ (Sếp/Admin) đang hoạt động có email.
        recipients = {}
        for account in user_service.list_users(db_path):
            if not isinstance(account, dict) or not account.get("active"):
                continue
            if str(account.get("role") or "").strip().lower() != "admin":
                continue
            email = str(account.get("email") or "").strip().lower()
            if "@" in email:
                recipients.setdefault(email, str(account.get("name") or "").strip() or email)

        for event in events:
            seller_name = employee_names.get(str(event.get("sellerEmployeeId"))) or actor_name
            for email, name in recipients.items():
                try:
                    email_service.send_sale_order_alert(email, name, seller_name, event)
                except RuntimeError as exc:
                    print(f"[SALE NOTIFY] Bỏ qua email đơn hàng: {exc}")
                    return
                except Exception as exc:  # noqa: BLE001
                    print(f"[SALE NOTIFY] Không gửi được email cho {email}: {exc}")
    except Exception as exc:  # noqa: BLE001
        print(f"[SALE NOTIFY] Lỗi gửi email nền: {exc}")


def _send_emails_background(db_path, actor_name, lines):
    try:
        from services import email_service, employee_service

        recipients = {}
        for employee in employee_service.list_employees(db_path):
            if not isinstance(employee, dict) or employee.get("status") == "inactive":
                continue
            email = str(employee.get("email") or "").strip().lower()
            if "@" in email:
                recipients.setdefault(email, str(employee.get("name") or "").strip())
        for email, name in recipients.items():
            try:
                email_service.send_inventory_change_alert(email, name, actor_name, lines)
            except RuntimeError as exc:
                # SMTP chưa cấu hình — báo một lần rồi dừng, không lặp vô ích.
                print(f"[INVENTORY NOTIFY] Bỏ qua email kho: {exc}")
                break
            except Exception as exc:  # noqa: BLE001
                print(f"[INVENTORY NOTIFY] Không gửi được email cho {email}: {exc}")
    except Exception as exc:  # noqa: BLE001
        print(f"[INVENTORY NOTIFY] Lỗi gửi email nền: {exc}")
