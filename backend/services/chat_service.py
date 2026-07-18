from db import chat_store


def _require_admin(user):
    if user["role"] not in {"admin", "accountant"}:
        raise ValueError("Chỉ Sếp hoặc Kế toán mới có quyền quản trị nhóm")


def conversations(db_path, user):
    return {
        "contacts": chat_store.list_conversations(db_path, user["id"]),
        "unread": chat_store.unread_total(db_path, user["id"]),
    }


def groups(db_path, user):
    return {
        "groups": chat_store.list_groups(db_path, user["id"]),
        "unread": chat_store.unread_total(db_path, user["id"]),
    }


def unread(db_path, user):
    return {"unread": chat_store.unread_total(db_path, user["id"])}


def messages(db_path, user, peer_email, limit=40, before_id=0, after_id=0):
    return chat_store.list_messages(db_path, user["id"], peer_email, limit, before_id, after_id)


def read_receipts(db_path, user, peer_email, after_id=0):
    return {"receipts": chat_store.list_read_receipts(db_path, user["id"], peer_email, after_id)}


def group_messages(db_path, user, group_id, limit=40, before_id=0, after_id=0):
    return chat_store.list_group_messages(db_path, user["id"], int(group_id), limit, before_id, after_id)


def send_message(db_path, user, recipient_email, body):
    return {"message": chat_store.send_message(db_path, user["id"], recipient_email, body)}


def send_group_message(db_path, user, group_id, body):
    return {"message": chat_store.send_group_message(db_path, user["id"], int(group_id), body)}


def mark_read(db_path, user, peer_email=""):
    chat_store.mark_read(db_path, user["id"], peer_email)
    return unread(db_path, user)


def mark_group_read(db_path, user, group_id):
    chat_store.mark_group_read(db_path, user["id"], int(group_id))
    return unread(db_path, user)


def create_group(db_path, user, name, member_emails):
    _require_admin(user)
    group_id = chat_store.create_group(db_path, name, member_emails, user["id"])
    return {"ok": True, "groupId": group_id, **groups(db_path, user)}


def update_group_members(db_path, user, group_id, name, member_emails):
    _require_admin(user)
    chat_store.update_group_members(db_path, int(group_id), name, member_emails, user["id"])
    return {"ok": True, **groups(db_path, user)}


def delete_group(db_path, user, group_id):
    _require_admin(user)
    chat_store.delete_group(db_path, int(group_id))
    return {"ok": True, **groups(db_path, user)}


def delete_message(db_path, user, message_id):
    _require_admin(user)
    chat_store.delete_message(db_path, user["id"], int(message_id), user["role"] in {"admin", "accountant"})
    return unread(db_path, user)


def clear_conversation(db_path, user, peer_email):
    _require_admin(user)
    chat_store.clear_conversation(db_path, user["id"], peer_email, user["role"] in {"admin", "accountant"})
    return unread(db_path, user)


def delete_group_message(db_path, user, message_id):
    _require_admin(user)
    chat_store.delete_group_message(db_path, user["id"], int(message_id), user["role"] in {"admin", "accountant"})
    return unread(db_path, user)


def clear_group_conversation(db_path, user, group_id):
    _require_admin(user)
    chat_store.clear_group_conversation(db_path, user["id"], int(group_id), user["role"] in {"admin", "accountant"})
    return unread(db_path, user)
