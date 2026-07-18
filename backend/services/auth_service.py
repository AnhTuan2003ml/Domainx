import unicodedata

from db import session_store, user_store
from security import verify_password


def _password_candidates(password):
    raw = password if isinstance(password, str) else ""
    candidates = [raw]
    # Một số bàn phím/clipboard trên trình duyệt chèn BOM, zero-width hoặc xuống dòng.
    # Chỉ dùng bản làm sạch như phương án dự phòng; mật khẩu gốc luôn được thử trước.
    cleaned = unicodedata.normalize("NFKC", raw)
    cleaned = cleaned.replace("\ufeff", "").replace("\u200b", "").replace("\u200c", "").replace("\u200d", "")
    cleaned = cleaned.strip("\r\n\t ")
    if cleaned and cleaned not in candidates:
        candidates.append(cleaned)
    return candidates


def login(db_path, email, password):
    if not user_store.is_email(email):
        return None
    row = user_store.get_user_by_email(db_path, email, active_only=True)
    if not row or not any(verify_password(candidate, row["password_hash"]) for candidate in _password_candidates(password)):
        return None
    token = session_store.create_session(db_path, row["id"])
    return {"token": token, "user": user_store.public_user(row)}


def current_user(db_path, token):
    return session_store.get_user_by_token(db_path, token)


def logout(db_path, token):
    session_store.logout_token(db_path, token)


def change_password(db_path, email, current_password, new_password):
    if not new_password or len(new_password) < 8:
        raise ValueError("Mật khẩu mới phải có ít nhất 8 ký tự")
    row = user_store.get_user_by_email(db_path, email, active_only=True)
    if not row or not verify_password(current_password, row["password_hash"]):
        raise ValueError("Mật khẩu hiện tại không đúng")
    user_store.update_password(db_path, email, new_password)
    session_store.prune_other_sessions(db_path, row["id"])
