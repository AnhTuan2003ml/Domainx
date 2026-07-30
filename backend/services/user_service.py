import os
import secrets
import string

from config import APP_ENV, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD
from db import user_store


def ensure_admin_from_env(db_path):
    if user_store.has_admin(db_path):
        return False

    configured_email = os.environ.get("DOMIX_ADMIN_EMAIL", "").strip().lower()
    configured_password = os.environ.get("DOMIX_ADMIN_PASSWORD", "")
    if APP_ENV == "production" and (not configured_email or len(configured_password) < 10):
        raise RuntimeError(
            "Môi trường production chưa có DOMIX_ADMIN_EMAIL hoặc DOMIX_ADMIN_PASSWORD đủ mạnh."
        )

    email = configured_email or DEFAULT_ADMIN_EMAIL
    password = configured_password or DEFAULT_ADMIN_PASSWORD
    user_store.create_or_update_user(db_path, email, password, "admin", 1)
    return True


def setup_message_if_needed(db_path):
    if user_store.has_admin(db_path):
        return ""
    return (
        "No admin account exists. Set DOMIX_ADMIN_EMAIL and DOMIX_ADMIN_PASSWORD, "
        "or run: python backend/server.py --create-user your@gmail.com STRONG_PASSWORD admin"
    )


def create_or_update_user(db_path, email, password, role, active=1):
    return user_store.create_or_update_user(db_path, email, password, role, active)


def list_users(db_path):
    return user_store.list_users(db_path)


def update_role(db_path, email, role):
    return user_store.update_role(db_path, email, role)


def delete_user(db_path, email):
    return user_store.delete_user(db_path, email)


def user_exists(db_path, email):
    return bool(user_store.get_user_by_email(db_path, email))


_TEMP_PASSWORD_SYMBOLS = "!@#$%^&*-_"


def generate_temporary_password(length=18):
    """Sinh mật khẩu tạm ngẫu nhiên (chữ hoa, chữ thường, số, ký tự đặc biệt).

    Trước đây hàm này luôn trả về cùng một chuỗi cố định ("Domain123@") cho MỌI
    tài khoản mới — nghĩa là ai biết chuỗi này có thể đăng nhập vào bất kỳ tài
    khoản nhân sự/kế toán nào chưa kịp đổi mật khẩu lần đầu. Dùng `secrets`
    (CSPRNG) thay vì chuỗi cố định hay `random` để mật khẩu không đoán được.
    """
    length = max(12, int(length or 18))
    groups = [string.ascii_uppercase, string.ascii_lowercase, string.digits, _TEMP_PASSWORD_SYMBOLS]
    all_chars = "".join(groups)
    chars = [secrets.choice(group) for group in groups]
    chars += [secrets.choice(all_chars) for _ in range(length - len(chars))]
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)
