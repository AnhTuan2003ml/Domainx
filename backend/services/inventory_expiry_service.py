import threading
from datetime import date

from config import ALERT_CHECK_INTERVAL_SECONDS, ALERT_DAYS_BEFORE_EXPIRY
from db.connection import connect
from db.state_store import read_state
from services import email_service, employee_service


_STOP_EVENT = threading.Event()


def _as_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _parse_date(value):
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _active_employees(db_path):
    employees = employee_service.list_employees(db_path)
    result = []
    for employee in employees:
        if employee.get("status") == "inactive":
            continue
        email = str(employee.get("email") or "").strip().lower()
        if not email or "@" not in email:
            continue
        result.append({
            "id": _as_int(employee.get("id")),
            "name": str(employee.get("name") or email).strip(),
            "email": email,
        })
    return result


def _recipients_for_product(product, employees):
    """Có người phụ trách thì chỉ gửi người đó; không có thì gửi toàn bộ nhân viên."""
    assigned_id = _as_int(product.get("assignedEmployeeId"))
    if assigned_id is not None:
        assigned = next((employee for employee in employees if employee.get("id") == assigned_id), None)
        if assigned:
            return [assigned]
    # Không phân công hoặc hồ sơ phụ trách không còn email: tránh bỏ sót bằng cách gửi toàn bộ.
    return employees


def _claim_alert(db_path, alert_key, recipient_email, entity_id, expiry_date):
    """Giữ chỗ trước khi gửi để các luồng quét không gửi trùng.

    Một cảnh báo đã gửi thành công sẽ không gửi lại cho cùng email. Bản ghi pending/failed
    quá một giờ được phép thử lại để phục hồi khi SMTP hoặc mạng gặp lỗi.
    """
    with connect(db_path) as conn:
        row = conn.execute(
            "SELECT status, created_at FROM email_alert_log WHERE alert_key = ? AND recipient_email = ?",
            (alert_key, recipient_email),
        ).fetchone()
        if row and row["status"] == "sent":
            return False
        if row and row["status"] == "pending":
            stale = conn.execute(
                "SELECT datetime(?) <= datetime('now', '-1 hour') AS stale",
                (row["created_at"],),
            ).fetchone()
            if not stale or not stale["stale"]:
                return False
        conn.execute(
            """
            INSERT INTO email_alert_log (
                alert_key, recipient_email, entity_type, entity_id, expiry_date,
                status, error_message, created_at, sent_at
            ) VALUES (?, ?, 'inventory', ?, ?, 'pending', '', CURRENT_TIMESTAMP, NULL)
            ON CONFLICT(alert_key, recipient_email) DO UPDATE SET
                entity_type = 'inventory',
                entity_id = excluded.entity_id,
                expiry_date = excluded.expiry_date,
                status = 'pending',
                error_message = '',
                created_at = CURRENT_TIMESTAMP,
                sent_at = NULL
            """,
            (alert_key, recipient_email, str(entity_id), expiry_date.isoformat()),
        )
    return True


def _finish_alert(db_path, alert_key, recipient_email, ok, error=""):
    with connect(db_path) as conn:
        conn.execute(
            """
            UPDATE email_alert_log
            SET status = ?, error_message = ?,
                sent_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END
            WHERE alert_key = ? AND recipient_email = ?
            """,
            ("sent" if ok else "failed", str(error or "")[:1000], 1 if ok else 0, alert_key, recipient_email),
        )


def build_inventory_expiry_alerts(db_path, today=None, days_before=None):
    today = today or date.today()
    days_before = ALERT_DAYS_BEFORE_EXPIRY if days_before is None else max(0, int(days_before))
    state = read_state(db_path) or {}
    data = state.get("data") if isinstance(state.get("data"), dict) else {}
    inventory = data.get("inventory") if isinstance(data.get("inventory"), list) else []
    employees = _active_employees(db_path)
    alerts = []

    for index, product in enumerate(inventory):
        if not isinstance(product, dict):
            continue
        expiry_date = _parse_date(product.get("expiryDate"))
        if not expiry_date:
            continue
        days_left = (expiry_date - today).days
        if not (0 <= days_left <= days_before):
            continue
        recipients = _recipients_for_product(product, employees)
        if not recipients:
            continue
        product_id = product.get("id") or product.get("sku") or f"row-{index}"
        alerts.append({
            "alertKey": f"inventory:{product_id}:{expiry_date.isoformat()}:D{days_before}",
            "entityId": product_id,
            "expiryDate": expiry_date,
            "daysLeft": days_left,
            "title": str(product.get("name") or product.get("sku") or "Sản phẩm trong kho"),
            "sku": str(product.get("sku") or "—"),
            "stock": product.get("stock") or 0,
            "unit": str(product.get("unit") or "").strip(),
            "assignedEmployeeId": _as_int(product.get("assignedEmployeeId")),
            "recipients": recipients,
        })
    return alerts


def run_inventory_expiry_alerts(db_path, today=None, days_before=None):
    alerts = build_inventory_expiry_alerts(db_path, today=today, days_before=days_before)
    result = {"alerts": len(alerts), "sent": 0, "failed": 0, "skipped": 0}
    for alert in alerts:
        broadcast = alert["assignedEmployeeId"] is None
        for recipient in alert["recipients"]:
            email = recipient["email"]
            if not _claim_alert(
                db_path,
                alert["alertKey"],
                email,
                alert["entityId"],
                alert["expiryDate"],
            ):
                result["skipped"] += 1
                continue
            try:
                email_service.send_inventory_expiry_alert(
                    recipient_email=email,
                    recipient_name=recipient.get("name") or email,
                    product_name=alert["title"],
                    sku=alert["sku"],
                    stock=alert["stock"],
                    unit=alert["unit"],
                    expiry_date=alert["expiryDate"].isoformat(),
                    days_left=alert["daysLeft"],
                    broadcast=broadcast,
                )
            except Exception as exc:
                _finish_alert(db_path, alert["alertKey"], email, False, str(exc))
                result["failed"] += 1
            else:
                _finish_alert(db_path, alert["alertKey"], email, True)
                result["sent"] += 1
    return result


def _worker_loop(db_path, interval_seconds):
    # Chờ server khởi động xong, quét lần đầu rồi tiếp tục mỗi giờ (có thể chỉnh bằng .env).
    if _STOP_EVENT.wait(8):
        return
    while not _STOP_EVENT.is_set():
        try:
            result = run_inventory_expiry_alerts(db_path)
            if result["sent"] or result["failed"]:
                print(
                    "DOMIX inventory expiry alerts: "
                    f"sent={result['sent']}, failed={result['failed']}, skipped={result['skipped']}"
                )
        except Exception as exc:
            print(f"DOMIX inventory expiry alerts error: {exc}")
        _STOP_EVENT.wait(max(60, int(interval_seconds)))


def start_inventory_expiry_worker(db_path, interval_seconds=None):
    interval = interval_seconds or ALERT_CHECK_INTERVAL_SECONDS
    thread = threading.Thread(
        target=_worker_loop,
        args=(db_path, interval),
        name="domix-inventory-expiry-alerts",
        daemon=True,
    )
    thread.start()
    return thread
