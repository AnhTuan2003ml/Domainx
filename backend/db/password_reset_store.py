from db.connection import connect


def get_pending_reset(db_path, email):
    with connect(db_path) as conn:
        return conn.execute(
            "SELECT * FROM password_reset_otps WHERE email = ?",
            (email,),
        ).fetchone()


def save_pending_reset(
    db_path,
    email,
    otp_hash,
    expires_at,
    last_sent_at,
    request_count,
    window_started_at,
):
    with connect(db_path) as conn:
        conn.execute(
            """
            INSERT INTO password_reset_otps (
                email, otp_hash, attempts, expires_at, last_sent_at,
                request_count, window_started_at
            ) VALUES (?, ?, 0, ?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
                otp_hash = excluded.otp_hash,
                attempts = 0,
                expires_at = excluded.expires_at,
                last_sent_at = excluded.last_sent_at,
                request_count = excluded.request_count,
                window_started_at = excluded.window_started_at,
                created_at = CURRENT_TIMESTAMP
            """,
            (
                email,
                otp_hash,
                expires_at.strftime("%Y-%m-%d %H:%M:%S"),
                last_sent_at.strftime("%Y-%m-%d %H:%M:%S"),
                request_count,
                window_started_at.strftime("%Y-%m-%d %H:%M:%S"),
            ),
        )


def increment_attempts(db_path, email):
    with connect(db_path) as conn:
        conn.execute(
            "UPDATE password_reset_otps SET attempts = attempts + 1 WHERE email = ?",
            (email,),
        )
        row = conn.execute(
            "SELECT attempts FROM password_reset_otps WHERE email = ?",
            (email,),
        ).fetchone()
        return int(row["attempts"] or 0) if row else 0


def delete_pending_reset(db_path, email):
    with connect(db_path) as conn:
        conn.execute("DELETE FROM password_reset_otps WHERE email = ?", (email,))
