from datetime import datetime, timedelta, timezone

from db.connection import connect


def _utc_now(now=None):
    value = now or datetime.now(timezone.utc)
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def director_password_is_rate_limited(db_path, attempt_key, window_seconds, max_failures, now=None):
    cutoff = _utc_now(now) - timedelta(seconds=window_seconds)
    with connect(db_path) as conn:
        row = conn.execute(
            """
            SELECT COUNT(*) AS total
            FROM director_password_failures
            WHERE attempt_key = ? AND attempted_at >= ?
            """,
            (attempt_key, cutoff),
        ).fetchone()
    return int((row or {}).get("total") or 0) >= int(max_failures)


def record_director_password_failure(db_path, attempt_key, window_seconds, now=None):
    attempted_at = _utc_now(now)
    cutoff = attempted_at - timedelta(seconds=window_seconds)
    with connect(db_path) as conn:
        conn.execute(
            "INSERT INTO director_password_failures (attempt_key, attempted_at) VALUES (?, ?)",
            (attempt_key, attempted_at),
        )
        conn.execute(
            "DELETE FROM director_password_failures WHERE attempted_at < ?",
            (cutoff,),
        )


def clear_director_password_failures(db_path, attempt_key):
    with connect(db_path) as conn:
        conn.execute(
            "DELETE FROM director_password_failures WHERE attempt_key = ?",
            (attempt_key,),
        )


# ---------- Chống dò mật khẩu ở cửa đăng nhập (/api/auth/login) ----------

def _as_naive_utc(value):
    """Chuẩn hóa mốc thời gian đọc từ DB về datetime UTC không mang tzinfo."""
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value)
        except ValueError:
            return None
    if not isinstance(value, datetime):
        return None
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def login_failure_state(db_path, attempt_key, window_seconds, max_failures, now=None):
    """Trả (đang_khóa, số_giây_còn_phải_chờ) cho một attempt_key.

    Cửa sổ trượt: khóa khi số lần sai trong `window_seconds` vừa qua đạt ngưỡng, và
    tự mở khi lần sai CŨ NHẤT trong cửa sổ hết hạn — nhờ vậy người dùng thật chờ đúng
    phần thời gian còn lại chứ không bị phạt lại từ đầu.
    """
    current = _utc_now(now)
    cutoff = current - timedelta(seconds=window_seconds)
    with connect(db_path) as conn:
        row = conn.execute(
            """
            SELECT COUNT(*) AS total, MIN(attempted_at) AS oldest
            FROM login_failures
            WHERE attempt_key = ? AND attempted_at >= ?
            """,
            (attempt_key, cutoff),
        ).fetchone()
    total = int((row or {}).get("total") or 0)
    if total < int(max_failures):
        return False, 0
    oldest = _as_naive_utc((row or {}).get("oldest"))
    if oldest is None:
        return True, window_seconds
    remaining = int((oldest + timedelta(seconds=window_seconds) - current).total_seconds())
    return True, max(1, min(remaining, window_seconds))


def record_login_failure(db_path, attempt_keys, window_seconds, now=None):
    attempted_at = _utc_now(now)
    cutoff = attempted_at - timedelta(seconds=window_seconds)
    with connect(db_path) as conn:
        for attempt_key in attempt_keys:
            conn.execute(
                "INSERT INTO login_failures (attempt_key, attempted_at) VALUES (?, ?)",
                (attempt_key, attempted_at),
            )
        conn.execute("DELETE FROM login_failures WHERE attempted_at < ?", (cutoff,))


def clear_login_failures(db_path, attempt_keys):
    with connect(db_path) as conn:
        for attempt_key in attempt_keys:
            conn.execute("DELETE FROM login_failures WHERE attempt_key = ?", (attempt_key,))
