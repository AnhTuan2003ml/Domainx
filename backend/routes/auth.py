from services import auth_service, password_reset_service, registration_service


def handle_get(handler, route, _parsed):
    if route != "/api/auth/me":
        return False
    # allow_pending: tài khoản tạm thời vẫn cần biết trạng thái của chính mình
    # để giao diện hiển thị màn hình "chờ cấp hồ sơ".
    user = handler.require_user(allow_pending=True)
    if user:
        handler.send_json({"user": user})
    return True


def handle_post(handler, route, _parsed):
    if not route.startswith("/api/auth/"):
        return False

    if route == "/api/auth/login":
        data = handler.read_json()
        if data is None:
            return True
        result = auth_service.login(handler.db_path, data.get("email", ""), data.get("password", ""))
        if not result:
            handler.send_json({"error": "Sai tài khoản hoặc mật khẩu"}, 401)
            return True
        result["user"] = handler.effective_user(result.get("user"), persist=True)
        handler.send_json(result)
        return True

    if route == "/api/auth/register/request-otp":
        data = handler.read_json()
        if data is None:
            return True
        try:
            result = registration_service.request_registration_otp(
                handler.db_path,
                data.get("email", ""),
                data.get("password", ""),
                data.get("confirmPassword", ""),
            )
        except ValueError as exc:
            handler.send_json({"error": str(exc)}, 400)
        except Exception as exc:
            print(f"[OTP EMAIL ERROR] {exc}")
            handler.send_json({"error": "Không gửi được OTP. Vui lòng kiểm tra cấu hình email gửi mã."}, 503)
        else:
            handler.send_json(result)
        return True

    if route == "/api/auth/register/verify":
        data = handler.read_json()
        if data is None:
            return True
        try:
            result = registration_service.verify_registration_otp(
                handler.db_path, data.get("email", ""), data.get("otp", "")
            )
        except ValueError as exc:
            handler.send_json({"error": str(exc)}, 400)
        else:
            result["user"] = handler.effective_user(result.get("user"), persist=False)
            handler.send_json(result)
        return True

    if route == "/api/auth/forgot-password/request-otp":
        data = handler.read_json()
        if data is None:
            return True
        try:
            result = password_reset_service.request_password_reset_otp(
                handler.db_path, data.get("email", "")
            )
        except ValueError as exc:
            handler.send_json({"error": str(exc)}, 400)
        except Exception as exc:
            print(f"[PASSWORD RESET OTP EMAIL ERROR] {exc}")
            handler.send_json({"error": "Không gửi được OTP. Vui lòng kiểm tra cấu hình email gửi mã."}, 503)
        else:
            handler.send_json(result)
        return True

    if route == "/api/auth/forgot-password/reset":
        data = handler.read_json()
        if data is None:
            return True
        try:
            result = password_reset_service.reset_password_with_otp(
                handler.db_path,
                data.get("email", ""),
                data.get("otp", ""),
                data.get("newPassword", ""),
                data.get("confirmPassword", ""),
            )
        except ValueError as exc:
            handler.send_json({"error": str(exc)}, 400)
        else:
            result["user"] = handler.effective_user(result.get("user"), persist=True)
            handler.send_json(result)
        return True

    if route == "/api/auth/logout":
        auth_service.logout(handler.db_path, handler.bearer_token())
        handler.send_json({"ok": True})
        return True

    if route == "/api/auth/password":
        user = handler.require_user(allow_pending=True)
        if not user:
            return True
        data = handler.read_json()
        if data is None:
            return True
        try:
            auth_service.change_password(
                handler.db_path,
                user["email"],
                data.get("currentPassword", ""),
                data.get("newPassword", ""),
            )
        except ValueError as exc:
            handler.send_json({"error": str(exc)}, 400)
        else:
            handler.send_json({"ok": True})
        return True

    return False
