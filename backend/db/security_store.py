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
