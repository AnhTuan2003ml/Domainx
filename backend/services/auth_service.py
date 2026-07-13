from db import session_store, user_store
from security import verify_password


def login(db_path, email, password):
    if not user_store.is_email(email):
        return None
    row = user_store.get_user_by_email(db_path, email, active_only=True)
    if not row or not verify_password(password, row["password_hash"]):
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
