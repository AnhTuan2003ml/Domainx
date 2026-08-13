from urllib.parse import parse_qs

from services import chat_service


def _query_int(query, key, default=0):
    try:
        return int(query.get(key, [default])[0] or default)
    except (TypeError, ValueError):
        return default


def _value_error_response(handler, action):
    try:
        handler.send_json(action())
    except ValueError as exc:
        handler.send_json({"error": str(exc)}, 400)


def handle_get(handler, route, parsed):
    if not route.startswith("/api/chat/"):
        return False
    user = handler.require_user()
    if not user:
        return True

    if user.get("pending"):
        # Tài khoản tạm thời: không thấy danh bạ, nhóm hay tin nhắn nào.
        empty_by_route = {
            "/api/chat/conversations": {"contacts": [], "unread": 0},
            "/api/chat/groups": {"groups": [], "unread": 0},
            "/api/chat/unread": {"unread": 0},
            "/api/chat/messages": {"messages": []},
            "/api/chat/group-messages": {"messages": []},
            "/api/chat/messages/read-receipts": {"receipts": []},
        }
        payload = empty_by_route.get(route)
        if payload is None:
            return False
        handler.send_json(payload)
        return True

    if route == "/api/chat/conversations":
        handler.send_json(chat_service.conversations(handler.db_path, user))
        return True
    if route == "/api/chat/unread":
        handler.send_json(chat_service.unread(handler.db_path, user))
        return True
    if route == "/api/chat/groups":
        handler.send_json(chat_service.groups(handler.db_path, user))
        return True

    query = parse_qs(parsed.query)
    if route == "/api/chat/messages":
        _value_error_response(handler, lambda: chat_service.messages(
            handler.db_path,
            user,
            query.get("peer", [""])[0],
            _query_int(query, "limit", 40),
            _query_int(query, "beforeId", 0),
            _query_int(query, "afterId", 0),
        ))
        return True
    if route == "/api/chat/messages/read-receipts":
        _value_error_response(handler, lambda: chat_service.read_receipts(
            handler.db_path,
            user,
            query.get("peer", [""])[0],
            _query_int(query, "afterId", 0),
        ))
        return True
    if route == "/api/chat/group-messages":
        _value_error_response(handler, lambda: chat_service.group_messages(
            handler.db_path,
            user,
            query.get("groupId", ["0"])[0],
            _query_int(query, "limit", 40),
            _query_int(query, "beforeId", 0),
            _query_int(query, "afterId", 0),
        ))
        return True
    return False


def handle_post(handler, route, _parsed):
    if not route.startswith("/api/chat/"):
        return False
    user = handler.require_user()
    if not user:
        return True
    data = handler.read_json()
    if data is None:
        return True

    actions = {
        "/api/chat/messages": lambda: chat_service.send_message(
            handler.db_path, user, data.get("recipientEmail", ""), data.get("body", "")
        ),
        "/api/chat/messages/delete": lambda: chat_service.delete_message(
            handler.db_path, user, data.get("messageId", 0)
        ),
        "/api/chat/messages/clear": lambda: chat_service.clear_conversation(
            handler.db_path, user, data.get("peerEmail", "")
        ),
        "/api/chat/group-messages": lambda: chat_service.send_group_message(
            handler.db_path, user, data.get("groupId", 0), data.get("body", "")
        ),
        "/api/chat/group-messages/delete": lambda: chat_service.delete_group_message(
            handler.db_path, user, data.get("messageId", 0)
        ),
        "/api/chat/group-messages/clear": lambda: chat_service.clear_group_conversation(
            handler.db_path, user, data.get("groupId", 0)
        ),
        "/api/chat/read": lambda: chat_service.mark_read(
            handler.db_path, user, data.get("peerEmail", "")
        ),
        "/api/chat/group-read": lambda: chat_service.mark_group_read(
            handler.db_path, user, data.get("groupId", 0)
        ),
        "/api/chat/groups": lambda: chat_service.create_group(
            handler.db_path, user, data.get("name", ""), data.get("memberEmails", [])
        ),
        "/api/chat/groups/members": lambda: chat_service.update_group_members(
            handler.db_path,
            user,
            data.get("groupId", 0),
            data.get("name", ""),
            data.get("memberEmails", []),
        ),
        "/api/chat/groups/delete": lambda: chat_service.delete_group(
            handler.db_path, user, data.get("groupId", 0)
        ),
    }
    action = actions.get(route)
    if action is None:
        return False
    _value_error_response(handler, action)
    return True
