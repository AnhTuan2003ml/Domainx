"""Chống dò mật khẩu ở cửa đăng nhập.

Trước đây `/api/auth/login` không có bất kỳ giới hạn nào: kẻ tấn công gọi API bao
nhiêu lần cũng được, trong khi OTP đăng ký/quên mật khẩu thì đã chặn 5 lần. Module
này bịt đúng lỗ hổng đó, dùng lại nguyên pattern của mật khẩu Sếp
(`director_password_failures`) để không phát sinh cách làm thứ hai trong dự án.

Hai lớp đếm độc lập:
  - Theo TÀI KHOẢN: bảo vệ một email cụ thể dù kẻ tấn công đổi IP liên tục.
  - Theo IP: chặn kiểu rải mật khẩu phổ biến lên hàng loạt email khác nhau.

Lớp theo tài khoản là lớp phòng thủ chính vì nó không phụ thuộc X-Forwarded-For —
header này về nguyên tắc giả mạo được nếu ai đó gọi thẳng backend trong mạng nội bộ
Docker mà không qua Nginx.
"""

from config import (
    LOGIN_FAILURE_WINDOW_SECONDS,
    LOGIN_MAX_FAILURES_PER_ACCOUNT,
    LOGIN_MAX_FAILURES_PER_IP,
)
from db.security_store import (
    clear_login_failures,
    login_failure_state,
    record_login_failure,
)


class LoginBlocked(Exception):
    """Đăng nhập bị tạm khóa — kèm số giây còn phải chờ để trả về Retry-After."""

    def __init__(self, message, retry_after):
        super().__init__(message)
        self.retry_after = max(1, int(retry_after))


def _account_key(email):
    return f"account:{(email or '').strip().lower()}"


def _ip_key(ip):
    return f"ip:{(ip or '').strip()}"


def _attempt_keys(email, ip):
    keys = [_account_key(email)]
    if (ip or "").strip():
        keys.append(_ip_key(ip))
    return keys


def _format_wait(seconds):
    minutes = max(1, round(int(seconds) / 60))
    return f"{minutes} phút"


def ensure_allowed(db_path, email, ip):
    """Ném LoginBlocked nếu tài khoản hoặc IP đang trong thời gian tạm khóa."""
    locked, retry_after = login_failure_state(
        db_path, _account_key(email), LOGIN_FAILURE_WINDOW_SECONDS, LOGIN_MAX_FAILURES_PER_ACCOUNT
    )
    if locked:
        raise LoginBlocked(
            f"Tài khoản này đã nhập sai mật khẩu quá {LOGIN_MAX_FAILURES_PER_ACCOUNT} lần. "
            f"Vui lòng thử lại sau {_format_wait(retry_after)} hoặc dùng chức năng Quên mật khẩu.",
            retry_after,
        )

    if (ip or "").strip():
        locked, retry_after = login_failure_state(
            db_path, _ip_key(ip), LOGIN_FAILURE_WINDOW_SECONDS, LOGIN_MAX_FAILURES_PER_IP
        )
        if locked:
            raise LoginBlocked(
                "Thiết bị của bạn đã đăng nhập sai quá nhiều lần. "
                f"Vui lòng thử lại sau {_format_wait(retry_after)}.",
                retry_after,
            )


def record_failure(db_path, email, ip):
    record_login_failure(db_path, _attempt_keys(email, ip), LOGIN_FAILURE_WINDOW_SECONDS)


def record_success(db_path, email, ip):
    # Đăng nhập đúng thì xóa lịch sử sai của chính tài khoản đó. KHÔNG xóa theo IP:
    # một máy văn phòng có nhiều người dùng chung, nếu xóa theo IP thì kẻ tấn công chỉ
    # cần một lần đăng nhập đúng bằng tài khoản rác là reset được bộ đếm của cả IP.
    clear_login_failures(db_path, [_account_key(email)])
