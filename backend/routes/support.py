from services import chat_service, email_service


def handle_post(handler, route, _parsed):
    if route != "/api/support/assign":
        return False
    user = handler.require_user()
    if not user:
        return True
    data = handler.read_json()
    if data is None:
        return True

    employees, sender_employee, is_accountant = handler.employee_context(user)
    sender_role = handler.employee_position_role(sender_employee)
    if not (handler.is_full_admin(user) or is_accountant or sender_role in {"sale", "ky_thuat", "cskh", "van_hanh"}):
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

    sender_name = (sender_employee or {}).get("name") or user.get("email") or "DOMIX"
    recipient_name = recipient.get("name") or recipient_email
    message_body = handler.support_assignment_message(data, sender_name, recipient_name)
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

    handler.send_json({
        "ok": True,
        "chatSent": True,
        "emailSent": email_sent,
        "emailError": email_error,
        "recipient": {
            "employeeId": recipient_employee_id,
            "name": recipient_name,
            "email": recipient_email,
            "roleType": handler.employee_position_role(recipient),
        },
    })
    return True
