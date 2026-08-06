from db.state_store import read_state, update_state
from services import chat_service, email_service
from services.support_service import (
    append_support_assignment,
    approve_support_case,
    build_support_case,
    confirm_support_assignment,
    reject_support_case,
    report_support_case,
    validate_support_links,
)


SUPPORT_WORKFLOW_ROUTES = {
    "/api/support/assign",
    "/api/support/confirm",
    "/api/support/report",
    "/api/support/approve",
    "/api/support/reject",
}


def _visible_support_data(handler, saved_state, user):
    visible_state = handler.filter_state(saved_state, user) or {}
    visible_data = visible_state.get("data") if isinstance(visible_state.get("data"), dict) else {}
    return {
        key: visible_data.get(key)
        for key in ("supportCases", "orders")
        if key in visible_data
    }


def _support_workflow_response(handler, saved_state, user, support_case, extra=None):
    payload = {
        "ok": True,
        "case": support_case,
        "data": _visible_support_data(handler, saved_state, user),
        "updatedAt": saved_state.get("updatedAt"),
        "version": saved_state.get("version", 0),
    }
    payload.update(extra or {})
    handler.send_json(payload)
    return True


def _handle_completion_workflow(handler, route, user, data):
    """Kỹ thuật báo hoàn tất → người GIAO ca duyệt (hoặc trả về). Nhân viên thường không ghi được
    ``supportCases`` qua autosave chung, nên hai bước này phải đi qua endpoint riêng."""
    case_id = data.get("caseId")
    if case_id in {None, ""}:
        handler.send_json({"error": "Thiếu mã yêu cầu hỗ trợ."}, 400)
        return True

    employees, actor_employee, is_accountant = handler.employee_context(user)
    is_privileged = handler.is_full_admin(user) or is_accountant
    actor_email = str(user.get("email") or "").strip().lower()
    actor_name = (actor_employee or {}).get("name") or actor_email
    outcome = {}

    def mutate(existing_data):
        if route == "/api/support/report":
            saved, support_case, counterpart = report_support_case(
                existing_data, case_id, data.get("resultNote"), actor_employee, actor_email, actor_name,
            )
        elif route == "/api/support/approve":
            saved, support_case, counterpart = approve_support_case(
                existing_data, case_id, actor_email, actor_name, is_privileged,
            )
        else:
            saved, support_case, counterpart = reject_support_case(
                existing_data, case_id, data.get("reason"), actor_email, actor_name, is_privileged,
            )
        outcome.update({"case": support_case, "counterpart": counterpart})
        return saved

    saved_state = update_state(handler.db_path, mutate)
    support_case = outcome.get("case") or {}
    counterpart = outcome.get("counterpart")

    if route == "/api/support/report":
        message = "\n".join([
            "[YÊU CẦU DUYỆT HOÀN TẤT YÊU CẦU HỖ TRỢ]",
            f"{actor_name} đã xử lý xong yêu cầu hỗ trợ bạn giao và xin duyệt hoàn tất.",
            f"Khách hàng: {support_case.get('customerName') or '—'} · {support_case.get('phone') or '—'}",
            f"Vấn đề: {support_case.get('issue') or '—'}",
            f"Kết quả xử lý: {support_case.get('resultNote') or '—'}",
            f"Báo lúc: {support_case.get('reportedAt') or '—'}",
            "Mở DOMIX > Hỗ trợ khách hàng và bấm Duyệt hoàn tất để chốt yêu cầu này.",
        ])
    elif route == "/api/support/approve":
        message = "\n".join([
            "[YÊU CẦU HỖ TRỢ ĐÃ ĐƯỢC DUYỆT HOÀN TẤT]",
            f"{actor_name} đã kiểm tra và duyệt hoàn tất yêu cầu hỗ trợ.",
            f"Khách hàng: {support_case.get('customerName') or '—'} · {support_case.get('phone') or '—'}",
            f"Kết quả: {support_case.get('resultNote') or '—'}",
            f"Duyệt lúc: {support_case.get('completedAt') or '—'}",
        ])
    else:
        message = "\n".join([
            "[YÊU CẦU HỖ TRỢ CHƯA ĐƯỢC DUYỆT HOÀN TẤT]",
            f"{actor_name} chưa duyệt hoàn tất yêu cầu hỗ trợ và trả lại để xử lý tiếp.",
            f"Khách hàng: {support_case.get('customerName') or '—'} · {support_case.get('phone') or '—'}",
            f"Lý do: {support_case.get('reviewNote') or '—'}",
            f"Trả lại lúc: {support_case.get('reviewedAt') or '—'}",
        ])

    notification_sent = False
    notification_error = ""
    if counterpart:
        try:
            chat_service.send_message(handler.db_path, user, counterpart, message)
            notification_sent = True
        except ValueError as exc:
            notification_error = str(exc)

    return _support_workflow_response(handler, saved_state, user, support_case, {
        "notificationSent": notification_sent,
        "notificationError": notification_error,
    })


def handle_post(handler, route, _parsed):
    if route not in SUPPORT_WORKFLOW_ROUTES:
        return False
    user = handler.require_user()
    if not user:
        return True
    data = handler.read_json()
    if data is None:
        return True

    if route in {"/api/support/report", "/api/support/approve", "/api/support/reject"}:
        return _handle_completion_workflow(handler, route, user, data)

    if route == "/api/support/confirm":
        employees, actor_employee, _ = handler.employee_context(user)
        if not actor_employee or handler.employee_position_role(actor_employee) not in handler.support_assignable_roles():
            handler.send_json({"error": "Chỉ tài khoản kỹ thuật được giao mới có thể xác nhận yêu cầu hỗ trợ."}, 403)
            return True
        case_id = data.get("caseId")
        if case_id in {None, ""}:
            handler.send_json({"error": "Thiếu mã yêu cầu hỗ trợ cần xác nhận."}, 400)
            return True

        confirmation = {}

        def confirm_case(existing_data):
            saved, support_case, sale_email, already_confirmed = confirm_support_assignment(
                existing_data,
                case_id,
                actor_employee,
                user.get("email"),
                actor_employee.get("name") or user.get("email"),
            )
            confirmation.update({
                "case": support_case,
                "saleEmail": sale_email,
                "alreadyConfirmed": already_confirmed,
            })
            return saved

        saved_state = update_state(handler.db_path, confirm_case)
        notification_sent = False
        notification_error = ""
        sale_email = confirmation.get("saleEmail")
        if sale_email and not confirmation.get("alreadyConfirmed"):
            support_case = confirmation["case"]
            message = "\n".join([
                "[ĐÃ XÁC NHẬN HỖ TRỢ KHÁCH HÀNG]",
                f"{actor_employee.get('name') or user.get('email')} đã xác nhận tiếp nhận yêu cầu hỗ trợ.",
                f"Đơn hàng: #{support_case.get('sourceCrmOrderId') or '—'}",
                f"Khách hàng: {support_case.get('customerName') or '—'} · {support_case.get('phone') or '—'}",
                f"Vấn đề: {support_case.get('issue') or '—'}",
                "Trạng thái hiện tại: Đang hỗ trợ.",
            ])
            try:
                chat_service.send_message(handler.db_path, user, sale_email, message)
                notification_sent = True
            except ValueError as exc:
                notification_error = str(exc)
        elif confirmation.get("alreadyConfirmed"):
            notification_sent = True

        handler.send_json({
            "ok": True,
            "case": confirmation.get("case"),
            "alreadyConfirmed": bool(confirmation.get("alreadyConfirmed")),
            "notificationSent": notification_sent,
            "notificationError": notification_error,
            "data": _visible_support_data(handler, saved_state, user),
            "updatedAt": saved_state.get("updatedAt"),
            "version": saved_state.get("version", 0),
        })
        return True

    employees, sender_employee, is_accountant = handler.employee_context(user)
    sender_role = handler.employee_position_role(sender_employee)
    if not (handler.is_full_admin(user) or is_accountant or sender_role in {"sale", "ky_thuat", "it", "cskh", "van_hanh"}):
        handler.send_json({"error": "Tài khoản không có quyền giao yêu cầu hỗ trợ khách hàng."}, 403)
        return True
    try:
        recipient_employee_id = int(data.get("recipientEmployeeId"))
    except (TypeError, ValueError):
        handler.send_json({"error": "Nhân sự tiếp nhận không hợp lệ."}, 400)
        return True

    recipient = next((
        employee for employee in employees
        if int(employee.get("id", -1)) == recipient_employee_id and employee.get("status") != "inactive"
    ), None)
    if not recipient or handler.employee_position_role(recipient) not in handler.support_assignable_roles():
        handler.send_json({"error": "Nhân sự được chọn không thuộc nhóm được phép tiếp nhận hỗ trợ."}, 400)
        return True
    recipient_email = handler.employee_contact_email(recipient)
    if not recipient_email:
        handler.send_json({"error": "Nhân sự tiếp nhận chưa có email hoặc tài khoản đăng nhập liên kết."}, 400)
        return True

    issue = str(data.get("issue") or "").strip()
    details = str(data.get("details") or "").strip()
    if not issue:
        handler.send_json({"error": "Vấn đề cần hỗ trợ không được để trống."}, 400)
        return True
    if not details:
        handler.send_json({"error": "Nội dung cần hỗ trợ không được để trống."}, 400)
        return True

    # Hỗ trợ SAU BÁN phải gắn đúng khách → đơn → dòng sản phẩm — kiểm tra quan hệ thật
    # trên dữ liệu máy chủ, không tin validation của trình duyệt.
    try:
        current_state = read_state(handler.db_path) or {}
        validate_support_links(
            current_state.get("data") if isinstance(current_state.get("data"), dict) else {},
            data,
        )
    except ValueError as exc:
        handler.send_json({"error": str(exc)}, 400)
        return True

    sender_name = (sender_employee or {}).get("name") or user.get("email") or "DOMIX"
    recipient_name = recipient.get("name") or recipient_email
    # Dựng hồ sơ ca TRƯỚC khi nhắn tin để tin nhắn mang theo mã ca — người nhận bấm xác nhận
    # ngay trong tab Tin nhắn mà không phải mở tab khác.
    support_case = build_support_case(data, user, sender_employee, recipient, recipient_email)
    message_body = handler.support_assignment_message(data, sender_name, recipient_name, support_case.get("id"))
    try:
        chat_service.send_message(handler.db_path, user, recipient_email, message_body)
    except ValueError as exc:
        handler.send_json({"error": f"Không gửi được tin nhắn DOMIX: {exc}"}, 400)
        return True

    support_type_label = handler.support_type_label(data.get("supportType"))
    support_channel_label = handler.support_channel_label(data.get("supportChannel"))
    email_sent = False
    email_error = ""
    try:
        email_service.send_support_assignment_email(
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            sender_name=sender_name,
            order_id=data.get("orderId"),
            order_date=data.get("orderDate"),
            customer_name=data.get("customerName"),
            customer_phone=data.get("customerPhone"),
            customer_email=data.get("customerEmail"),
            product_name=data.get("productName"),
            duration_label=data.get("durationLabel"),
            support_type_label=support_type_label,
            support_channel_label=support_channel_label,
            issue=issue,
            details=details,
        )
        email_sent = True
    except Exception as exc:
        email_error = str(exc)
        print(f"[SUPPORT ASSIGNMENT EMAIL ERROR] {exc}")

    support_case["chatSent"] = True
    support_case["emailSent"] = email_sent

    def save_assignment(existing_data):
        return append_support_assignment(
            existing_data,
            support_case,
            support_type_label,
            support_channel_label,
        )

    saved_state = update_state(handler.db_path, save_assignment)
    handler.send_json({
        "ok": True,
        "chatSent": True,
        "emailSent": email_sent,
        "emailError": email_error,
        "case": support_case,
        "data": _visible_support_data(handler, saved_state, user),
        "updatedAt": saved_state.get("updatedAt"),
        "version": saved_state.get("version", 0),
        "recipient": {
            "employeeId": recipient_employee_id,
            "name": recipient_name,
            "email": recipient_email,
            "roleType": handler.employee_position_role(recipient),
        },
    })
    return True
