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
from db import registration_store, session_store, user_store
from security import password_hash
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
    payload = f"{email}:{otp_code}".encode("utf-8")
    return hmac.new(_otp_secret(), payload, hashlib.sha256).hexdigest()


def _normalize_and_validate(email, password, confirm_password):
    email = user_store.normalize_email(email)
    if not user_store.is_email(email):
        raise ValueError("Email không hợp lệ")
    if not password or len(password) < 8:
        raise ValueError("Mật khẩu phải có ít nhất 8 ký tự")
    if password != confirm_password:
        raise ValueError("Mật khẩu xác nhận không khớp")
    return email


def request_registration_otp(db_path, email, password, confirm_password):
    email = _normalize_and_validate(email, password, confirm_password)
    if user_store.get_user_by_email(db_path, email):
        raise ValueError("Email này đã có tài khoản")

    now = _utcnow()
    existing = registration_store.get_pending_registration(db_path, email)
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
    registration_store.save_pending_registration(
        db_path,
        email,
        _hash_otp(email, otp_code),
        password_hash(password),
        expires_at,
        now,
        request_count,
        window_started_at,
    )

    try:
        email_service.send_registration_otp(email, otp_code, OTP_EXPIRY_MINUTES)
    except Exception:
        registration_store.delete_pending_registration(db_path, email)
        raise

    return {
        "ok": True,
        "email": email,
        "expiresIn": OTP_EXPIRY_MINUTES * 60,
        "resendAfter": OTP_RESEND_SECONDS,
    }


def verify_registration_otp(db_path, email, otp_code):
    email = user_store.normalize_email(email)
    otp_code = (otp_code or "").strip()
    if not user_store.is_email(email):
        raise ValueError("Email không hợp lệ")
    if len(otp_code) != 6 or not otp_code.isdigit():
        raise ValueError("Mã OTP phải gồm 6 chữ số")
    if user_store.get_user_by_email(db_path, email):
        registration_store.delete_pending_registration(db_path, email)
        raise ValueError("Email này đã có tài khoản")

    pending = registration_store.get_pending_registration(db_path, email)
    if not pending:
        raise ValueError("Chưa có yêu cầu OTP hoặc mã đã hết hạn")

    now = _utcnow()
    expires_at = _parse_db_time(pending["expires_at"])
    if not expires_at or now >= expires_at:
        registration_store.delete_pending_registration(db_path, email)
        raise ValueError("Mã OTP đã hết hạn. Vui lòng gửi mã mới")

    attempts = int(pending["attempts"] or 0)
    if attempts >= OTP_MAX_ATTEMPTS:
        registration_store.delete_pending_registration(db_path, email)
        raise ValueError("Bạn đã nhập sai OTP quá nhiều lần. Vui lòng gửi mã mới")

    expected_hash = pending["otp_hash"]
    if not hmac.compare_digest(_hash_otp(email, otp_code), expected_hash):
        attempts = registration_store.increment_attempts(db_path, email)
        remaining = max(OTP_MAX_ATTEMPTS - attempts, 0)
        if remaining <= 0:
            registration_store.delete_pending_registration(db_path, email)
            raise ValueError("Bạn đã nhập sai OTP quá nhiều lần. Vui lòng gửi mã mới")
        raise ValueError(f"Mã OTP không đúng. Bạn còn {remaining} lần thử")

    user = user_store.create_user_with_password_hash(
        db_path,
        email,
        pending["pending_password_hash"],
        role="user",
        active=1,
    )
    registration_store.delete_pending_registration(db_path, email)
    token = session_store.create_session(db_path, user["id"])
    return {"token": token, "user": user_store.public_user(user)}
