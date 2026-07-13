import json

from db.connection import connect


STATE_KEY = "app_state"


def read_state(db_path):
    with connect(db_path) as conn:
        row = conn.execute(
            "SELECT payload, updated_at FROM app_state WHERE key = ?",
            (STATE_KEY,),
        ).fetchone()
    if not row:
        return None
    return {"data": json.loads(row["payload"]), "updatedAt": row["updated_at"]}


def write_state(db_path, data):
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    with connect(db_path) as conn:
        conn.execute(
            """
            INSERT INTO app_state (key, payload, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
                payload = excluded.payload,
                updated_at = CURRENT_TIMESTAMP
            """,
            (STATE_KEY, payload),
        )
