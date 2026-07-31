import json
from threading import RLock
from typing import Callable

from db.connection import connect


STATE_KEY = "app_state"
_STATE_LOCK = RLock()


def _decode_payload(row):
    if not row:
        return None
    payload = row.get("payload") if isinstance(row, dict) else row[0]
    updated_at = row.get("updated_at") if isinstance(row, dict) else row[1]
    try:
        data = json.loads(payload) if payload else {}
    except (TypeError, json.JSONDecodeError):
        data = {}
    return {"data": data, "updatedAt": updated_at}


def read_state(db_path):
    with connect(db_path) as conn:
        row = conn.execute(
            "SELECT payload, updated_at FROM app_state WHERE key = ?",
            (STATE_KEY,),
        ).fetchone()
    return _decode_payload(row)


def _write_state_with_connection(conn, data):
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
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
    # Phản chiếu các nghiệp vụ tiền/công nợ/lương/kho vào bảng chuẩn hoá ngay
    # trong cùng transaction với app_state. Import đặt tại đây để tránh vòng lặp.
    from services.operational_ledger_service import sync_operational_ledgers
    sync_operational_ledgers(conn, data)


def write_state(db_path, data):
    # Khóa tiến trình kết hợp transaction PostgreSQL để tuần tự hóa thao tác ghi trong một backend.
    with _STATE_LOCK:
        with connect(db_path) as conn:
            _write_state_with_connection(conn, data)


def update_state(db_path, updater: Callable[[dict], dict]):
    """Đọc-sửa-ghi app_state trong một transaction duy nhất.

    PostgreSQL khóa đúng hàng bằng FOR UPDATE để các request đồng thời không ghi đè nhau.
    """
    with _STATE_LOCK:
        with connect(db_path) as conn:
            row = conn.execute(
                "SELECT payload, updated_at FROM app_state WHERE key = ? FOR UPDATE",
                (STATE_KEY,),
            ).fetchone()
            current_state = _decode_payload(row) or {"data": {}, "updatedAt": None}
            current_data = current_state.get("data") if isinstance(current_state.get("data"), dict) else {}
            next_data = updater(dict(current_data))
            if not isinstance(next_data, dict):
                raise ValueError("Dữ liệu ứng dụng sau cập nhật phải là object")
            _write_state_with_connection(conn, next_data)
            saved_row = conn.execute(
                "SELECT payload, updated_at FROM app_state WHERE key = ?",
                (STATE_KEY,),
            ).fetchone()
            return _decode_payload(saved_row) or {"data": next_data, "updatedAt": None}
