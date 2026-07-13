import os

from config import DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD
from db import user_store


def ensure_admin_from_env(db_path):
    if user_store.user_count(db_path) > 0:
        return False
    email = os.environ.get("DOMIX_ADMIN_EMAIL", DEFAULT_ADMIN_EMAIL).strip().lower()
    password = os.environ.get("DOMIX_ADMIN_PASSWORD", DEFAULT_ADMIN_PASSWORD)
    user_store.create_or_update_user(db_path, email, password, "admin", 1)
    return True


def setup_message_if_needed(db_path):
    if user_store.user_count(db_path) > 0:
        return ""
    return (
        "No admin account exists. Restart the server to create the default admin, "
        "or run: python backend/server.py --create-user your@gmail.com STRONG_PASSWORD admin"
    )


def create_or_update_user(db_path, email, password, role, active=1):
    return user_store.create_or_update_user(db_path, email, password, role, active)


def list_users(db_path):
    return user_store.list_users(db_path)


def delete_user(db_path, email):
    return user_store.delete_user(db_path, email)
