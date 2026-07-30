from services import user_service
from db import employee_store, user_store


def handle_get(handler, route, _parsed):
    if route != "/api/users":
        return False
    if handler.require_user({"admin", "accountant"}):
        handler.send_json({"users": user_service.list_users(handler.db_path)})
    return True


def handle_post(handler, route, _parsed):
    if route != "/api/users":
        return False
    current_user = handler.require_user({"admin"})
    if not current_user:
        return True
    data = handler.read_json()
    if data is None:
        return True
    email = (data.get("email") or "").strip().lower()
    password = data.get("password", "")
    target_role = str(data.get("role", "user") or "user").strip().lower()
    target_active = bool(data.get("active", 1))
    current_email = (current_user.get("email") or "").strip().lower()
    current_role = str(current_user.get("role") or "").strip().lower()
    if email == current_email and not target_active:
        handler.send_json({"error": "Không thể tự khóa tài khoản đang đăng nhập."}, 400)
        return True
    if email == current_email and current_role in {"admin", "boss"} and target_role not in {"admin", "boss"}:
        handler.send_json({"error": "Không thể tự hạ quyền tài khoản Sếp đang đăng nhập."}, 400)
        return True
    if current_role == "accountant" and target_role in {"admin", "boss"}:
        handler.send_json({"error": "Kế toán không được tạo hoặc thay đổi tài khoản Sếp."}, 403)
        return True
    temporary_password = ""
    if data.get("generatePassword") and not password and not user_service.user_exists(handler.db_path, email):
        temporary_password = user_service.generate_temporary_password()
        password = temporary_password
    try:
        user_service.create_or_update_user(
            handler.db_path,
            email,
            password,
            target_role,
            1 if target_active else 0,
        )
        employee_id = data.get("employeeId")
        if employee_id not in (None, ""):
            account = user_store.get_user_by_email(handler.db_path, email)
            if not account:
                raise ValueError("Không thể tìm lại tài khoản vừa tạo để liên kết hồ sơ.")
            account_id = account.get("id") if isinstance(account, dict) else account["id"]
            employee_store.link_account(handler.db_path, employee_id, account_id)
    except ValueError as exc:
        handler.send_json({"error": str(exc)}, 400)
    else:
        handler.send_json({
            "ok": True,
            "users": user_service.list_users(handler.db_path),
            "temporaryPassword": temporary_password or None,
        })
    return True


def handle_delete(handler, route, _parsed):
    if route != "/api/users":
        return False
    user = handler.require_user({"admin"})
    if not user:
        return True
    data = handler.read_json()
    if data is None:
        return True
    email = (data.get("email") or "").strip().lower()
    deleted_current_user = email == (user.get("email") or "").strip().lower()
    if deleted_current_user:
        handler.send_json({"error": "Không thể tự xóa tài khoản đang đăng nhập."}, 400)
        return True
    try:
        user_service.delete_user(handler.db_path, email)
    except ValueError as exc:
        handler.send_json({"error": str(exc)}, 400)
    else:
        handler.send_json({
            "ok": True,
            "users": user_service.list_users(handler.db_path),
            "deletedCurrentUser": deleted_current_user,
        })
    return True
