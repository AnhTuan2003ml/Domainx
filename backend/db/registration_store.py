from datetime import datetime, timezone

from db.connection import connect


def _db_time(value):
    if isinstance(value, datetime):
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value.strftime("%Y-%m-%d %H:%M:%S")
    return value


def get_pending_registration(db_path, email):
    with connect(db_path) as conn:
        return conn.execute(
            "SELECT * FROM registration_otps WHERE email = ?",
            ((email or "").strip().lower(),),
        ).fetchone()


def save_pending_registration(
    db_path,
    email,
    otp_hash,
    pending_password_hash,
    expires_at,
    last_sent_at,
    request_count,
    window_started_at,
):
    email = (email or "").strip().lower()
    with connect(db_path) as conn:
        conn.execute(
            """
            INSERT INTO registration_otps (
                email, otp_hash, pending_password_hash, attempts,
                expires_at, last_sent_at, request_count, window_started_at
            ) VALUES (?, ?, ?, 0, ?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
                otp_hash = excluded.otp_hash,
                pending_password_hash = excluded.pending_password_hash,
                attempts = 0,
                expires_at = excluded.expires_at,
                last_sent_at = excluded.last_sent_at,
                request_count = excluded.request_count,
                window_started_at = excluded.window_started_at
            """,
            (
                email,
                otp_hash,
                pending_password_hash,
                _db_time(expires_at),
                _db_time(last_sent_at),
                int(request_count),
                _db_time(window_started_at),
            ),
        )


def increment_attempts(db_path, email):
    email = (email or "").strip().lower()
    with connect(db_path) as conn:
        conn.execute(
            "UPDATE registration_otps SET attempts = attempts + 1 WHERE email = ?",
            (email,),
        )
        row = conn.execute(
            "SELECT attempts FROM registration_otps WHERE email = ?",
            (email,),
        ).fetchone()
        return int(row["attempts"]) if row else 0


def delete_pending_registration(db_path, email):
    with connect(db_path) as conn:
        conn.execute(
            "DELETE FROM registration_otps WHERE email = ?",
            ((email or "").strip().lower(),),
        )


def prune_expired_registrations(db_path):
    with connect(db_path) as conn:
        conn.execute("DELETE FROM registration_otps WHERE expires_at <= datetime('now')")
