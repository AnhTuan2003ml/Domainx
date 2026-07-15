from db.connection import connect
from db import user_store


def _message_from_row(row):
    return {
        "id": row["id"],
        "senderEmail": row["sender_email"],
        "recipientEmail": row["recipient_email"],
        "body": row["body"],
        "readAt": row["read_at"],
        "createdAt": row["created_at"],
    }


def _group_message_from_row(row):
    return {
        "id": row["id"],
        "groupId": row["group_id"],
        "senderEmail": row["sender_email"],
        "body": row["body"],
        "createdAt": row["created_at"],
    }


def unread_total(db_path, user_id):
    with connect(db_path) as conn:
        direct = conn.execute(
            """
            SELECT COUNT(*)
            FROM chat_messages
            WHERE recipient_id = ?
              AND read_at IS NULL
              AND deleted_at IS NULL
            """,
            (user_id,),
        ).fetchone()[0]
        groups = conn.execute(
            """
            SELECT COUNT(*)
            FROM chat_group_messages m
            JOIN chat_group_members member ON member.group_id = m.group_id AND member.user_id = ?
            JOIN chat_groups g ON g.id = m.group_id AND g.deleted_at IS NULL
            LEFT JOIN chat_group_reads r ON r.group_id = m.group_id AND r.user_id = ?
            WHERE m.sender_id != ?
              AND m.deleted_at IS NULL
              AND m.id > COALESCE(r.last_read_message_id, 0)
            """,
            (user_id, user_id, user_id),
        ).fetchone()[0]
    return direct + groups


def list_conversations(db_path, user_id):
    with connect(db_path) as conn:
        rows = conn.execute(
            """
            SELECT
                u.id,
                u.username AS email,
                u.role,
                u.active,
                (
                    SELECT body
                    FROM chat_messages m
                    WHERE m.deleted_at IS NULL
                      AND ((m.sender_id = ? AND m.recipient_id = u.id)
                        OR (m.sender_id = u.id AND m.recipient_id = ?))
                    ORDER BY m.id DESC
                    LIMIT 1
                ) AS last_body,
                (
                    SELECT created_at
                    FROM chat_messages m
                    WHERE m.deleted_at IS NULL
                      AND ((m.sender_id = ? AND m.recipient_id = u.id)
                        OR (m.sender_id = u.id AND m.recipient_id = ?))
                    ORDER BY m.id DESC
                    LIMIT 1
                ) AS last_at,
                (
                    SELECT COUNT(*)
                    FROM chat_messages m
                    WHERE m.sender_id = u.id
                      AND m.recipient_id = ?
                      AND m.read_at IS NULL
                      AND m.deleted_at IS NULL
                ) AS unread_count
            FROM users u
            WHERE u.active = 1 AND u.id != ?
            ORDER BY COALESCE(last_at, '') DESC, u.username ASC
            """,
            (user_id, user_id, user_id, user_id, user_id, user_id),
        ).fetchall()
    return [
        {
            "id": row["id"],
            "email": row["email"],
            "role": row["role"],
            "active": bool(row["active"]),
            "lastMessage": row["last_body"] or "",
            "lastAt": row["last_at"],
            "unreadCount": row["unread_count"],
        }
        for row in rows
    ]


def list_messages(db_path, user_id, peer_email, limit=100):
    peer = user_store.get_user_by_email(db_path, peer_email, active_only=True)
    if not peer:
        raise ValueError("Không tìm thấy người nhận")
    with connect(db_path) as conn:
        rows = conn.execute(
            """
            SELECT
                m.id,
                sender.username AS sender_email,
                recipient.username AS recipient_email,
                m.body,
                m.read_at,
                m.created_at
            FROM chat_messages m
            JOIN users sender ON sender.id = m.sender_id
            JOIN users recipient ON recipient.id = m.recipient_id
            WHERE m.deleted_at IS NULL
              AND ((m.sender_id = ? AND m.recipient_id = ?)
                OR (m.sender_id = ? AND m.recipient_id = ?))
            ORDER BY m.id DESC
            LIMIT ?
            """,
            (user_id, peer["id"], peer["id"], user_id, limit),
        ).fetchall()
    return [_message_from_row(row) for row in reversed(rows)]


def send_message(db_path, sender_id, recipient_email, body):
    body = (body or "").strip()
    if not body:
        raise ValueError("Tin nhắn không được để trống")
    if len(body) > 5000:
        raise ValueError("Tin nhắn quá dài")
    recipient = user_store.get_user_by_email(db_path, recipient_email, active_only=True)
    if not recipient:
        raise ValueError("Không tìm thấy người nhận")
    if recipient["id"] == sender_id:
        raise ValueError("Không thể tự nhắn cho chính mình")
    with connect(db_path) as conn:
        # Khi người dùng trả lời, các tin trước đó của đúng người nhận được xem là đã đọc.
        # Điều này ngăn badge chưa đọc còn treo dù người dùng đang ở trong luồng và vừa phản hồi.
        conn.execute(
            """
            UPDATE chat_messages
            SET read_at = CURRENT_TIMESTAMP
            WHERE sender_id = ?
              AND recipient_id = ?
              AND read_at IS NULL
              AND deleted_at IS NULL
            """,
            (recipient["id"], sender_id),
        )
        cursor = conn.execute(
            "INSERT INTO chat_messages (sender_id, recipient_id, body) VALUES (?, ?, ?)",
            (sender_id, recipient["id"], body),
        )
        row = conn.execute(
            """
            SELECT
                m.id,
                sender.username AS sender_email,
                recipient.username AS recipient_email,
                m.body,
                m.read_at,
                m.created_at
            FROM chat_messages m
            JOIN users sender ON sender.id = m.sender_id
            JOIN users recipient ON recipient.id = m.recipient_id
            WHERE m.id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()
    return _message_from_row(row)


def delete_message(db_path, user_id, message_id, is_admin=False):
    with connect(db_path) as conn:
        row = conn.execute(
            "SELECT sender_id, recipient_id FROM chat_messages WHERE id = ? AND deleted_at IS NULL",
            (message_id,),
        ).fetchone()
        if not row:
            raise ValueError("Tin nhắn không tồn tại")
        if not is_admin:
            raise ValueError("Chỉ admin mới có quyền xóa tin nhắn")
        conn.execute("UPDATE chat_messages SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", (message_id,))


def mark_read(db_path, user_id, peer_email=""):
    params = [user_id]
    clause = ""
    if peer_email:
        peer = user_store.get_user_by_email(db_path, peer_email, active_only=True)
        if not peer:
            raise ValueError("Không tìm thấy người gửi")
        clause = " AND sender_id = ?"
        params.append(peer["id"])
    with connect(db_path) as conn:
        conn.execute(
            f"""
            UPDATE chat_messages
            SET read_at = CURRENT_TIMESTAMP
            WHERE recipient_id = ?
              AND read_at IS NULL
              AND deleted_at IS NULL
              {clause}
            """,
            params,
        )


def _active_user_ids_by_email(db_path, emails):
    clean = sorted({(email or "").strip().lower() for email in emails if email})
    if not clean:
        return []
    placeholders = ",".join("?" for _ in clean)
    with connect(db_path) as conn:
        rows = conn.execute(
            f"SELECT id FROM users WHERE active = 1 AND username IN ({placeholders})",
            clean,
        ).fetchall()
    return [row["id"] for row in rows]


def _ensure_group_member(conn, group_id, user_id):
    row = conn.execute(
        """
        SELECT 1
        FROM chat_group_members member
        JOIN chat_groups g ON g.id = member.group_id AND g.deleted_at IS NULL
        WHERE member.group_id = ? AND member.user_id = ?
        """,
        (group_id, user_id),
    ).fetchone()
    if not row:
        raise ValueError("Bạn không thuộc nhóm này")


def _group_members(conn, group_id):
    rows = conn.execute(
        """
        SELECT u.id, u.username AS email, u.role
        FROM chat_group_members member
        JOIN users u ON u.id = member.user_id
        WHERE member.group_id = ? AND u.active = 1
        ORDER BY u.username
        """,
        (group_id,),
    ).fetchall()
    return [{"id": row["id"], "email": row["email"], "role": row["role"]} for row in rows]


def list_groups(db_path, user_id):
    with connect(db_path) as conn:
        rows = conn.execute(
            """
            SELECT
                g.id,
                g.name,
                creator.username AS created_by_email,
                g.created_at,
                (
                    SELECT body
                    FROM chat_group_messages m
                    WHERE m.group_id = g.id AND m.deleted_at IS NULL
                    ORDER BY m.id DESC
                    LIMIT 1
                ) AS last_body,
                (
                    SELECT created_at
                    FROM chat_group_messages m
                    WHERE m.group_id = g.id AND m.deleted_at IS NULL
                    ORDER BY m.id DESC
                    LIMIT 1
                ) AS last_at,
                (
                    SELECT COUNT(*)
                    FROM chat_group_messages m
                    LEFT JOIN chat_group_reads r ON r.group_id = g.id AND r.user_id = ?
                    WHERE m.group_id = g.id
                      AND m.sender_id != ?
                      AND m.deleted_at IS NULL
                      AND m.id > COALESCE(r.last_read_message_id, 0)
                ) AS unread_count
            FROM chat_groups g
            JOIN chat_group_members member ON member.group_id = g.id AND member.user_id = ?
            JOIN users creator ON creator.id = g.created_by
            WHERE g.deleted_at IS NULL
            ORDER BY COALESCE(last_at, g.created_at) DESC, g.name ASC
            """,
            (user_id, user_id, user_id),
        ).fetchall()
        groups = []
        for row in rows:
            members = _group_members(conn, row["id"])
            groups.append({
                "id": row["id"],
                "name": row["name"],
                "createdByEmail": row["created_by_email"],
                "createdAt": row["created_at"],
                "lastMessage": row["last_body"] or "",
                "lastAt": row["last_at"],
                "unreadCount": row["unread_count"],
                "members": members,
            })
    return groups


def create_group(db_path, name, member_emails, admin_user_id):
    name = (name or "").strip()
    if not name:
        raise ValueError("Tên nhóm không được để trống")
    member_ids = set(_active_user_ids_by_email(db_path, member_emails))
    member_ids.add(admin_user_id)
    with connect(db_path) as conn:
        cursor = conn.execute(
            "INSERT INTO chat_groups (name, created_by) VALUES (?, ?)",
            (name, admin_user_id),
        )
        group_id = cursor.lastrowid
        for user_id in member_ids:
            conn.execute(
                "INSERT OR IGNORE INTO chat_group_members (group_id, user_id) VALUES (?, ?)",
                (group_id, user_id),
            )
    return group_id


def update_group_members(db_path, group_id, name, member_emails, admin_user_id):
    name = (name or "").strip()
    if not name:
        raise ValueError("Tên nhóm không được để trống")
    member_ids = set(_active_user_ids_by_email(db_path, member_emails))
    member_ids.add(admin_user_id)
    with connect(db_path) as conn:
        group = conn.execute("SELECT id FROM chat_groups WHERE id = ? AND deleted_at IS NULL", (group_id,)).fetchone()
        if not group:
            raise ValueError("Nhóm không tồn tại")
        conn.execute("UPDATE chat_groups SET name = ? WHERE id = ?", (name, group_id))
        conn.execute("DELETE FROM chat_group_members WHERE group_id = ?", (group_id,))
        for user_id in member_ids:
            conn.execute(
                "INSERT OR IGNORE INTO chat_group_members (group_id, user_id) VALUES (?, ?)",
                (group_id, user_id),
            )


def delete_group(db_path, group_id):
    with connect(db_path) as conn:
        row = conn.execute("SELECT id FROM chat_groups WHERE id = ? AND deleted_at IS NULL", (group_id,)).fetchone()
        if not row:
            raise ValueError("Nhóm không tồn tại")
        conn.execute("UPDATE chat_groups SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", (group_id,))


def list_group_messages(db_path, user_id, group_id, limit=150):
    with connect(db_path) as conn:
        _ensure_group_member(conn, group_id, user_id)
        rows = conn.execute(
            """
            SELECT
                m.id,
                m.group_id,
                sender.username AS sender_email,
                m.body,
                m.created_at
            FROM chat_group_messages m
            JOIN users sender ON sender.id = m.sender_id
            WHERE m.group_id = ?
              AND m.deleted_at IS NULL
            ORDER BY m.id DESC
            LIMIT ?
            """,
            (group_id, limit),
        ).fetchall()
    return [_group_message_from_row(row) for row in reversed(rows)]


def send_group_message(db_path, user_id, group_id, body):
    body = (body or "").strip()
    if not body:
        raise ValueError("Tin nhắn không được để trống")
    if len(body) > 5000:
        raise ValueError("Tin nhắn quá dài")
    with connect(db_path) as conn:
        _ensure_group_member(conn, group_id, user_id)
        cursor = conn.execute(
            "INSERT INTO chat_group_messages (group_id, sender_id, body) VALUES (?, ?, ?)",
            (group_id, user_id, body),
        )
        # Gửi phản hồi trong nhóm đồng nghĩa người dùng đã đọc toàn bộ luồng đến tin vừa gửi.
        conn.execute(
            """
            INSERT INTO chat_group_reads (group_id, user_id, last_read_at, last_read_message_id)
            VALUES (?, ?, CURRENT_TIMESTAMP, ?)
            ON CONFLICT(group_id, user_id) DO UPDATE SET
                last_read_at = CURRENT_TIMESTAMP,
                last_read_message_id = excluded.last_read_message_id
            """,
            (group_id, user_id, cursor.lastrowid),
        )
        row = conn.execute(
            """
            SELECT
                m.id,
                m.group_id,
                sender.username AS sender_email,
                m.body,
                m.created_at
            FROM chat_group_messages m
            JOIN users sender ON sender.id = m.sender_id
            WHERE m.id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()
    return _group_message_from_row(row)


def mark_group_read(db_path, user_id, group_id):
    with connect(db_path) as conn:
        _ensure_group_member(conn, group_id, user_id)
        last_message_id = conn.execute(
            """
            SELECT COALESCE(MAX(id), 0)
            FROM chat_group_messages
            WHERE group_id = ?
              AND deleted_at IS NULL
            """,
            (group_id,),
        ).fetchone()[0]
        conn.execute(
            """
            INSERT INTO chat_group_reads (group_id, user_id, last_read_at, last_read_message_id)
            VALUES (?, ?, CURRENT_TIMESTAMP, ?)
            ON CONFLICT(group_id, user_id) DO UPDATE SET
                last_read_at = CURRENT_TIMESTAMP,
                last_read_message_id = excluded.last_read_message_id
            """,
            (group_id, user_id, last_message_id),
        )


def delete_group_message(db_path, user_id, message_id, is_admin=False):
    with connect(db_path) as conn:
        row = conn.execute(
            """
            SELECT m.sender_id, m.group_id
            FROM chat_group_messages m
            JOIN chat_groups g ON g.id = m.group_id AND g.deleted_at IS NULL
            WHERE m.id = ? AND m.deleted_at IS NULL
            """,
            (message_id,),
        ).fetchone()
        if not row:
            raise ValueError("Tin nhắn không tồn tại")
        _ensure_group_member(conn, row["group_id"], user_id)
        if not is_admin:
            raise ValueError("Chỉ admin mới có quyền xóa tin nhắn")
        conn.execute("UPDATE chat_group_messages SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", (message_id,))
