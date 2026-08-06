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


# Loại hỗ trợ KHÔNG cần đơn hàng — khách chưa mua. Mọi loại còn lại là hỗ trợ SAU BÁN,
# bắt buộc gắn customer_id + order_id (+ order_item_id khi đơn có dòng hàng).
PRESALE_SUPPORT_TYPES = {"tu_van_truoc_ban"}


def validate_support_links(data_state, payload):
    """Kiểm tra QUAN HỆ THẬT khách → đơn → dòng sản phẩm cho hỗ trợ sau bán.

    Backend không tin validation của trình duyệt: raise ValueError (route trả 400)
    khi thiếu liên kết hoặc liên kết không thuộc về nhau.
    """
    support_type = str((payload or {}).get("supportType") or "kich_hoat")
    if support_type in PRESALE_SUPPORT_TYPES:
        return
    customer_id = (payload or {}).get("customerId")
    order_id = (payload or {}).get("orderId")
    if customer_id in (None, ""):
        raise ValueError("Hỗ trợ sau bán bắt buộc chọn KHÁCH HÀNG từ danh sách khách đã có đơn (customer_id).")
    if order_id in (None, ""):
        raise ValueError(
            "Hỗ trợ sau bán bắt buộc gắn với một ĐƠN HÀNG cụ thể (order_id). "
            "Nếu khách chưa mua hàng, hãy chọn loại 'Tư vấn trước bán'."
        )
    orders = (data_state or {}).get("orders") or []
    order = next((o for o in orders if isinstance(o, dict) and _same_id(o.get("id"), order_id)), None)
    if order is None:
        raise ValueError("Đơn hàng gắn với yêu cầu hỗ trợ không tồn tại trên hệ thống.")
    if order.get("customerId") not in (None, "") and not _same_id(order.get("customerId"), customer_id):
        raise ValueError("Đơn hàng đã chọn không thuộc khách hàng này — hãy chọn lại đơn theo đúng khách.")
    items = order.get("items") if isinstance(order.get("items"), list) else []
    if items:
        item_id = (payload or {}).get("orderItemId")
        if item_id in (None, ""):
            raise ValueError("Hãy chọn đúng DÒNG SẢN PHẨM của đơn cần hỗ trợ (order_item_id).")
        if not any(_same_id(line.get("id"), item_id) for line in items if isinstance(line, dict)):
            raise ValueError("Dòng sản phẩm không thuộc đơn hàng đã chọn — chọn lại theo đơn.")


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
        # Liên kết khách bằng ID (không ghép bằng tên/SĐT).
        "customerId": payload.get("customerId"),
        "productName": str(payload.get("productName") or "").strip(),
        # Khóa sản phẩm theo ID khi yêu cầu gắn với đơn đã bán (không chỉ chuỗi tên).
        "productId": payload.get("productId"),
        "orderItemId": payload.get("orderItemId"),
        # Ưu tiên + hạn xử lý (SLA) của yêu cầu hỗ trợ.
        "priority": str(payload.get("priority") or "trung_binh").strip() or "trung_binh",
        "dueAt": str(payload.get("dueAt") or "").strip(),
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
            raise ValueError("Chỉ đúng tài khoản kỹ thuật được giao mới có thể xác nhận yêu cầu này.")
        assigned_email = str(item.get("assignedToEmail") or "").strip().lower()
        if assigned_email and assigned_email != actor_email:
            raise ValueError("Chỉ đúng tài khoản kỹ thuật được giao mới có thể xác nhận yêu cầu này.")
        if item.get("status") == "dang_ho_tro" and item.get("confirmedAt"):
            already_confirmed = True
            updated_case = item
            cases.append(item)
            continue
        if item.get("status") != "cho_xac_nhan":
            raise ValueError("Yêu cầu hỗ trợ không còn ở trạng thái chờ xác nhận.")
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
        raise ValueError("Không tìm thấy yêu cầu hỗ trợ cần xác nhận.")

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
                    "note": f"{updated_case.get('confirmedByName')} đã xác nhận tiếp nhận yêu cầu hỗ trợ.",
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


def _case_belongs_to_actor(item, actor_employee, actor_email):
    """Người được giao yêu cầu: khớp email tài khoản đã ghi khi giao, hoặc chính hồ sơ nhân sự."""
    assigned_email = str(item.get("assignedToEmail") or "").strip().lower()
    if assigned_email and actor_email and assigned_email == actor_email:
        return True
    actor_id = (actor_employee or {}).get("id")
    return actor_id is not None and _same_id(item.get("employeeId"), actor_id)


def _case_reviewer(item, actor_email, is_privileged):
    """Người duyệt hoàn tất là NGƯỜI GIAO ca; admin/kế toán được duyệt thay."""
    if is_privileged:
        return True
    assigner = str(item.get("assignedBy") or "").strip().lower()
    return bool(assigner) and assigner == actor_email


def report_support_case(data, case_id, result_note, actor_employee, actor_email, actor_name="", now=None):
    """Kỹ thuật được giao báo kết quả: ca chuyển sang chờ người giao duyệt, CHƯA hoàn tất."""
    reported_at = _now_iso(now)
    actor_email = str(actor_email or "").strip().lower()
    result_note = str(result_note or "").strip()
    if not result_note:
        raise ValueError("Kết quả hỗ trợ không được để trống.")

    updated_case = None
    cases = []
    for raw in (data or {}).get("supportCases") or []:
        if not isinstance(raw, dict):
            continue
        item = dict(raw)
        if not _same_id(item.get("id"), case_id):
            cases.append(item)
            continue
        if not _case_belongs_to_actor(item, actor_employee, actor_email):
            raise ValueError("Chỉ đúng nhân sự được giao yêu cầu mới được báo hoàn tất.")
        if item.get("status") not in {"dang_ho_tro", "cho_duyet_hoan_tat"}:
            raise ValueError("Ca hỗ trợ chưa được tiếp nhận hoặc đã đóng nên không thể báo hoàn tất.")
        item.update({
            "status": "cho_duyet_hoan_tat",
            "resultNote": result_note,
            "reportedAt": reported_at,
            "reportedByEmail": actor_email,
            "reportedByName": actor_name or actor_email,
            "reviewNote": "",
        })
        updated_case = item
        cases.append(item)

    if updated_case is None:
        raise ValueError("Không tìm thấy yêu cầu hỗ trợ cần báo hoàn tất.")

    result = dict(data or {})
    result["supportCases"] = cases
    orders = []
    for raw in result.get("orders") or []:
        if not isinstance(raw, dict):
            continue
        order = dict(raw)
        if _same_id(order.get("id"), updated_case.get("sourceCrmOrderId")):
            order.update({"supportStatus": "cho_duyet_hoan_tat"})
        orders.append(order)
    result["orders"] = orders
    return result, updated_case, str(updated_case.get("assignedBy") or "").strip().lower()


def approve_support_case(data, case_id, actor_email, actor_name="", is_privileged=False, now=None):
    """Người giao yêu cầu duyệt: lúc này yêu cầu mới đóng và kết quả được ghi vào nhật ký đơn CRM."""
    completed_at = _now_iso(now)
    actor_email = str(actor_email or "").strip().lower()
    updated_case = None
    cases = []
    for raw in (data or {}).get("supportCases") or []:
        if not isinstance(raw, dict):
            continue
        item = dict(raw)
        if not _same_id(item.get("id"), case_id):
            cases.append(item)
            continue
        if not _case_reviewer(item, actor_email, is_privileged):
            raise ValueError("Chỉ người giao yêu cầu (hoặc quản trị) mới được duyệt hoàn tất.")
        if item.get("status") == "hoan_tat":
            updated_case = item
            cases.append(item)
            continue
        if item.get("status") != "cho_duyet_hoan_tat":
            raise ValueError("Ca hỗ trợ chưa được kỹ thuật báo hoàn tất.")
        item.update({
            "status": "hoan_tat",
            "completedAt": completed_at,
            "approvedByEmail": actor_email,
            "approvedByName": actor_name or actor_email,
        })
        updated_case = item
        cases.append(item)

    if updated_case is None:
        raise ValueError("Không tìm thấy yêu cầu hỗ trợ cần duyệt.")

    result = dict(data or {})
    result["supportCases"] = cases
    orders = []
    for raw in result.get("orders") or []:
        if not isinstance(raw, dict):
            continue
        order = dict(raw)
        if _same_id(order.get("id"), updated_case.get("sourceCrmOrderId")):
            logs = [dict(entry) for entry in (order.get("contactLog") or []) if isinstance(entry, dict)]
            log_id = f"{updated_case['id']}:approved"
            if not any(str(entry.get("id")) == log_id for entry in logs):
                logs.append({
                    "id": log_id,
                    "date": completed_at,
                    "type": "support",
                    "note": f"[Kết quả hỗ trợ kỹ thuật — đã duyệt] {updated_case.get('resultNote') or '—'}",
                    "acknowledged": False,
                })
            order.update({
                "supportStatus": "hoan_tat",
                "supportCompletedAt": completed_at,
                "contactLog": logs,
            })
        orders.append(order)
    result["orders"] = orders
    return result, updated_case, str(updated_case.get("assignedToEmail") or "").strip().lower()


def reject_support_case(data, case_id, reason, actor_email, actor_name="", is_privileged=False, now=None):
    """Người giao yêu cầu thấy chưa đạt: trả yêu cầu về cho kỹ thuật xử lý tiếp."""
    reviewed_at = _now_iso(now)
    actor_email = str(actor_email or "").strip().lower()
    reason = str(reason or "").strip()
    if not reason:
        raise ValueError("Cần ghi rõ điểm chưa đạt để kỹ thuật xử lý tiếp.")

    updated_case = None
    cases = []
    for raw in (data or {}).get("supportCases") or []:
        if not isinstance(raw, dict):
            continue
        item = dict(raw)
        if not _same_id(item.get("id"), case_id):
            cases.append(item)
            continue
        if not _case_reviewer(item, actor_email, is_privileged):
            raise ValueError("Chỉ người giao yêu cầu (hoặc quản trị) mới được trả yêu cầu về.")
        if item.get("status") != "cho_duyet_hoan_tat":
            raise ValueError("Ca hỗ trợ không ở trạng thái chờ duyệt hoàn tất.")
        item.update({
            "status": "dang_ho_tro",
            "reviewNote": reason,
            "reviewedAt": reviewed_at,
            "reviewedByEmail": actor_email,
            "reviewedByName": actor_name or actor_email,
        })
        updated_case = item
        cases.append(item)

    if updated_case is None:
        raise ValueError("Không tìm thấy yêu cầu hỗ trợ cần trả về.")

    result = dict(data or {})
    result["supportCases"] = cases
    orders = []
    for raw in result.get("orders") or []:
        if not isinstance(raw, dict):
            continue
        order = dict(raw)
        if _same_id(order.get("id"), updated_case.get("sourceCrmOrderId")):
            order.update({"supportStatus": "dang_ho_tro"})
        orders.append(order)
    result["orders"] = orders
    return result, updated_case, str(updated_case.get("assignedToEmail") or "").strip().lower()
