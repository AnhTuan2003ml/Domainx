import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

from config import (
    OTP_EXPIRY_MINUTES,
    OTP_MAX_ATTEMPTS,
    OTP_MAX_REQUESTS_PER_HOUR,
    OTP_RESEND_SECONDS,
)
from db import password_reset_store, session_store, user_store
from services import email_service


_PROCESS_OTP_SECRET = secrets.token_bytes(32)


def _utcnow():
    return datetime.now(timezone.utc)


def _parse_db_time(value):
    if not value:
        return None
    parsed = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
    return parsed.replace(tzinfo=timezone.utc)


def _otp_secret():
    configured = os.environ.get("DOMIX_OTP_SECRET", "").encode("utf-8")
    return configured or _PROCESS_OTP_SECRET


def _hash_otp(email, otp_code):
    payload = f"password-reset:{email}:{otp_code}".encode("utf-8")
    return hmac.new(_otp_secret(), payload, hashlib.sha256).hexdigest()


def request_password_reset_otp(db_path, email):
    email = user_store.normalize_email(email)
    if not user_store.is_email(email):
        raise ValueError("Email không hợp lệ")

    # Trả cùng một thông báo cho email có hoặc không có tài khoản để tránh lộ danh sách tài khoản.
    account = user_store.get_user_by_email(db_path, email, active_only=True)
    if not account:
        return {
            "ok": True,
            "email": email,
            "expiresIn": OTP_EXPIRY_MINUTES * 60,
            "resendAfter": OTP_RESEND_SECONDS,
        }

    now = _utcnow()
    existing = password_reset_store.get_pending_reset(db_path, email)
    request_count = 1
    window_started_at = now

    if existing:
        last_sent_at = _parse_db_time(existing["last_sent_at"])
        if last_sent_at:
            elapsed = int((now - last_sent_at).total_seconds())
            if elapsed < OTP_RESEND_SECONDS:
                raise ValueError(f"Vui lòng chờ {OTP_RESEND_SECONDS - elapsed} giây trước khi gửi lại OTP")

        previous_window = _parse_db_time(existing["window_started_at"])
        if previous_window and (now - previous_window) < timedelta(hours=1):
            request_count = int(existing["request_count"] or 0) + 1
            window_started_at = previous_window
            if request_count > OTP_MAX_REQUESTS_PER_HOUR:
                raise ValueError("Bạn đã gửi OTP quá nhiều lần. Vui lòng thử lại sau 1 giờ")

    otp_code = f"{secrets.randbelow(1_000_000):06d}"
    expires_at = now + timedelta(minutes=OTP_EXPIRY_MINUTES)
    password_reset_store.save_pending_reset(
        db_path,
        email,
        _hash_otp(email, otp_code),
        expires_at,
        now,
        request_count,
        window_started_at,
    )

    try:
        email_service.send_password_reset_otp(email, otp_code, OTP_EXPIRY_MINUTES)
    except Exception:
        password_reset_store.delete_pending_reset(db_path, email)
        raise

    return {
        "ok": True,
        "email": email,
        "expiresIn": OTP_EXPIRY_MINUTES * 60,
        "resendAfter": OTP_RESEND_SECONDS,
    }


def reset_password_with_otp(db_path, email, otp_code, new_password, confirm_password):
    email = user_store.normalize_email(email)
    otp_code = (otp_code or "").strip()
    if not user_store.is_email(email):
        raise ValueError("Email không hợp lệ")
    if len(otp_code) != 6 or not otp_code.isdigit():
        raise ValueError("Mã OTP phải gồm 6 chữ số")
    if not new_password or len(new_password) < 8:
        raise ValueError("Mật khẩu mới phải có ít nhất 8 ký tự")
    if new_password != confirm_password:
        raise ValueError("Mật khẩu xác nhận không khớp")

    account = user_store.get_user_by_email(db_path, email, active_only=True)
    pending = password_reset_store.get_pending_reset(db_path, email)
    if not account or not pending:
        raise ValueError("Mã OTP không hợp lệ hoặc đã hết hạn")

    now = _utcnow()
    expires_at = _parse_db_time(pending["expires_at"])
    if not expires_at or now >= expires_at:
        password_reset_store.delete_pending_reset(db_path, email)
        raise ValueError("Mã OTP đã hết hạn. Vui lòng gửi mã mới")

    attempts = int(pending["attempts"] or 0)
    if attempts >= OTP_MAX_ATTEMPTS:
        password_reset_store.delete_pending_reset(db_path, email)
        raise ValueError("Bạn đã nhập sai OTP quá nhiều lần. Vui lòng gửi mã mới")

    if not hmac.compare_digest(_hash_otp(email, otp_code), pending["otp_hash"]):
        attempts = password_reset_store.increment_attempts(db_path, email)
        remaining = max(OTP_MAX_ATTEMPTS - attempts, 0)
        if remaining <= 0:
            password_reset_store.delete_pending_reset(db_path, email)
            raise ValueError("Bạn đã nhập sai OTP quá nhiều lần. Vui lòng gửi mã mới")
        raise ValueError(f"Mã OTP không đúng. Bạn còn {remaining} lần thử")

    user_store.update_password(db_path, email, new_password)
    session_store.logout_user_sessions(db_path, account["id"])
    password_reset_store.delete_pending_reset(db_path, email)

    refreshed = user_store.get_user_by_email(db_path, email, active_only=True)
    token = session_store.create_session(db_path, refreshed["id"])
    return {"token": token, "user": user_store.public_user(refreshed)}
