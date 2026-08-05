"""Nghiệp vụ giao và xác nhận hỗ trợ khách hàng.

Các hàm trong file này chỉ biến đổi ``app_state`` để route có thể chạy chúng bên
trong một transaction. Tin nhắn được gửi ở route, còn trạng thái ca và đơn CRM
luôn được cập nhật nguyên tử tại đây.
"""

from datetime import datetime, timezone
import uuid


def _now_iso(value=None):
    return value or datetime.now(timezone.utc).isoformat()


def _same_id(left, right):
    return str(left) == str(right)


def build_support_case(payload, sender_user, sender_employee, recipient, recipient_email, now=None):
    assigned_at = _now_iso(now)
    return {
        "id": payload.get("caseId") or f"support:{uuid.uuid4().hex}",
        "customerName": str(payload.get("customerName") or "").strip(),
        "phone": str(payload.get("customerPhone") or "").strip(),
        "email": str(payload.get("customerEmail") or "").strip(),
        "zalo": str(payload.get("customerPhone") or "").strip(),
        "issue": str(payload.get("issue") or "").strip(),
        "details": str(payload.get("details") or "").strip(),
        "supportType": str(payload.get("supportType") or "kich_hoat"),
        "supportChannel": str(payload.get("supportChannel") or "phone"),
        "employeeId": recipient.get("id"),
        "assignedToEmail": recipient_email,
        "assignedByEmployeeId": (sender_employee or {}).get("id"),
        "assignedBy": str((sender_user or {}).get("email") or "").strip().lower(),
        "assignedByName": (sender_employee or {}).get("name") or (sender_user or {}).get("email") or "DOMIX",
        "status": "cho_xac_nhan",
        "assignedAt": assigned_at,
        "startedAt": None,
        "confirmedAt": None,
        "completedAt": None,
        "note": "",
        "sourceCrmOrderId": payload.get("orderId"),
        "productName": str(payload.get("productName") or "").strip(),
        "durationLabel": str(payload.get("durationLabel") or "").strip(),
    }


def append_support_assignment(data, support_case, support_type_label, support_channel_label):
    result = dict(data or {})
    cases = [dict(item) for item in (result.get("supportCases") or []) if isinstance(item, dict)]
    if any(_same_id(item.get("id"), support_case.get("id")) for item in cases):
        raise ValueError("Yêu cầu hỗ trợ này đã tồn tại.")
    cases.append(dict(support_case))
    result["supportCases"] = cases

    order_id = support_case.get("sourceCrmOrderId")
    orders = []
    for raw in result.get("orders") or []:
        if not isinstance(raw, dict):
            continue
        order = dict(raw)
        if _same_id(order.get("id"), order_id):
            logs = [dict(item) for item in (order.get("contactLog") or []) if isinstance(item, dict)]
            logs.append({
                "id": f"{support_case['id']}:assigned",
                "date": support_case.get("assignedAt"),
                "type": "support",
                "note": (
                    f"Đã giao {support_type_label} cho nhân sự #{support_case.get('employeeId')} "
                    f"qua {support_channel_label}: {support_case.get('issue') or '—'}"
                ),
                "acknowledged": False,
            })
            order.update({
                "supportEmployeeId": support_case.get("employeeId"),
                "supportStatus": "cho_xac_nhan",
                "supportCaseId": support_case.get("id"),
                "contactLog": logs,
            })
        orders.append(order)
    result["orders"] = orders
    return result


def confirm_support_assignment(data, case_id, actor_employee, actor_email, actor_name="", now=None):
    if not actor_employee or actor_employee.get("id") is None:
        raise ValueError("Tài khoản chưa liên kết với hồ sơ nhân sự kỹ thuật.")
    confirmed_at = _now_iso(now)
    actor_email = str(actor_email or "").strip().lower()
    actor_id = actor_employee.get("id")
    updated_case = None
    already_confirmed = False
    cases = []

    for raw in (data or {}).get("supportCases") or []:
        if not isinstance(raw, dict):
            continue
        item = dict(raw)
        if not _same_id(item.get("id"), case_id):
            cases.append(item)
            continue
        if not _same_id(item.get("employeeId"), actor_id):
            raise ValueError("Chỉ đúng tài khoản kỹ thuật được giao mới có thể xác nhận ca này.")
        assigned_email = str(item.get("assignedToEmail") or "").strip().lower()
        if assigned_email and assigned_email != actor_email:
            raise ValueError("Chỉ đúng tài khoản kỹ thuật được giao mới có thể xác nhận ca này.")
        if item.get("status") == "dang_ho_tro" and item.get("confirmedAt"):
            already_confirmed = True
            updated_case = item
            cases.append(item)
            continue
        if item.get("status") != "cho_xac_nhan":
            raise ValueError("Ca hỗ trợ không còn ở trạng thái chờ xác nhận.")
        item.update({
            "status": "dang_ho_tro",
            "confirmedAt": confirmed_at,
            "confirmedByEmail": actor_email,
            "confirmedByName": actor_name or actor_employee.get("name") or actor_email,
            "startedAt": confirmed_at,
        })
        updated_case = item
        cases.append(item)

    if updated_case is None:
        raise ValueError("Không tìm thấy ca hỗ trợ cần xác nhận.")

    result = dict(data or {})
    result["supportCases"] = cases
    if not already_confirmed:
        orders = []
        for raw in result.get("orders") or []:
            if not isinstance(raw, dict):
                continue
            order = dict(raw)
            if _same_id(order.get("id"), updated_case.get("sourceCrmOrderId")):
                logs = [dict(item) for item in (order.get("contactLog") or []) if isinstance(item, dict)]
                logs.append({
                    "id": f"{updated_case['id']}:confirmed",
                    "date": confirmed_at,
                    "type": "support",
                    "note": f"{updated_case.get('confirmedByName')} đã xác nhận tiếp nhận ca hỗ trợ.",
                    "acknowledged": False,
                })
                order.update({
                    "supportStatus": "dang_ho_tro",
                    "supportConfirmedAt": confirmed_at,
                    "contactLog": logs,
                })
            orders.append(order)
        result["orders"] = orders

    return result, updated_case, str(updated_case.get("assignedBy") or "").strip().lower(), already_confirmed
