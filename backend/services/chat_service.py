from db import chat_store


def _require_admin(user):
    if user["role"] != "admin":
        raise ValueError("Chỉ admin mới có quyền quản trị nhóm")


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


def messages(db_path, user, peer_email):
    return {"messages": chat_store.list_messages(db_path, user["id"], peer_email)}


def group_messages(db_path, user, group_id):
    return {"messages": chat_store.list_group_messages(db_path, user["id"], int(group_id))}


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
    chat_store.delete_message(db_path, user["id"], int(message_id), user["role"] == "admin")
    return unread(db_path, user)


def delete_group_message(db_path, user, message_id):
    _require_admin(user)
    chat_store.delete_group_message(db_path, user["id"], int(message_id), user["role"] == "admin")
    return unread(db_path, user)
