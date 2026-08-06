from services import employee_service, user_service
from services.delete_policy_service import DeletePolicyError, audit_blocked_delete, check_employee_delete


def handle_get(handler, route, _parsed):
    if route != "/api/employees":
        return False
    user = handler.require_user()
    if not user:
        return True
    employees = employee_service.list_employees(handler.db_path)
    handler.send_json({"employees": handler.filter_employees(employees, user)})
    return True


def handle_put(handler, route, _parsed):
    if route != "/api/employees":
        return False
    user = handler.require_user()
    if not user:
        return True
    data = handler.read_json()
    if data is None:
        return True
    try:
        employees = handler.update_employees(data.get("employees", []), user)
    except ValueError as exc:
        handler.send_json({"error": str(exc)}, 400)
    else:
        handler.send_json({"ok": True, "employees": handler.filter_employees(employees, user)})
    return True



def handle_post(handler, route, _parsed):
    if route != "/api/employees/upsert":
        return False
    user = handler.require_user({"admin"})
    if not user:
        return True
    body = handler.read_json()
    if body is None:
        return True
    employee = body.get("employee") if isinstance(body, dict) else None
    if not isinstance(employee, dict):
        handler.send_json({"error": "Hồ sơ nhân sự không hợp lệ."}, 400)
        return True
    email = str(employee.get("email") or "").strip().lower()
    existing_users = {item.get("email"): item for item in user_service.list_users(handler.db_path)}
    temporary_password = ""
    supplied_password = str(body.get("password") or "")
    if email not in existing_users and not supplied_password:
        temporary_password = user_service.generate_temporary_password()
        supplied_password = temporary_password
    try:
        employees = employee_service.upsert_with_account(handler.db_path, employee, supplied_password)
    except ValueError as exc:
        handler.send_json({"error": str(exc)}, 400)
    else:
        handler.send_json({
            "ok": True,
            "employees": handler.filter_employees(employees, user),
            "users": user_service.list_users(handler.db_path),
            "temporaryPassword": temporary_password or None,
        })
    return True

def handle_delete(handler, route, _parsed):
    if route != "/api/employees":
        return False
    user = handler.require_user({"admin"})
    if not user:
        return True
    data = handler.read_json()
    if data is None:
        return True
    try:
        # Delete Policy backend: nhân sự đang làm việc hoặc còn liên kết lương/nhiệm vụ/
        # giao dịch không được hard-delete — trả 409 kèm hành động được phép.
        check_employee_delete(handler.db_path, data.get("employeeId"))
        employee_service.delete_employee(handler.db_path, data.get("employeeId"), user.get("email", ""))
    except DeletePolicyError as exc:
        audit_blocked_delete(handler.db_path, user.get("email", ""), exc)
        handler.send_json(exc.payload(), 409)
    except ValueError as exc:
        handler.send_json({"error": str(exc)}, 400)
    else:
        handler.send_json({"ok": True, "employees": employee_service.list_employees(handler.db_path)})
    return True
