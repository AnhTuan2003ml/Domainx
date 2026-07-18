import secrets

from config import SESSION_HOURS
from db.connection import connect
from db.user_store import public_user
from security import hash_token


def create_session(db_path, user_id):
    token = secrets.token_urlsafe(32)
    with connect(db_path) as conn:
        conn.execute(
            """
            INSERT INTO sessions (token_hash, user_id, expires_at)
            VALUES (?, ?, datetime('now', ?))
            """,
            (hash_token(token), user_id, f"+{SESSION_HOURS} hours"),
        )
    return token


def get_user_by_token(db_path, token):
    if not token:
        return None
    with connect(db_path) as conn:
        row = conn.execute(
            """
            SELECT users.*
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token_hash = ?
              AND sessions.expires_at > datetime('now')
              AND users.active = 1
            """,
            (hash_token(token),),
        ).fetchone()
    return public_user(row) if row else None


def logout_token(db_path, token):
    if not token:
        return
    with connect(db_path) as conn:
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (hash_token(token),))


def prune_other_sessions(db_path, user_id):
    with connect(db_path) as conn:
        conn.execute(
            """
            DELETE FROM sessions
            WHERE user_id = ? AND token_hash NOT IN (
                SELECT token_hash FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1
            )
            """,
            (user_id, user_id),
        )


def logout_user_sessions(db_path, user_id):
    with connect(db_path) as conn:
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
