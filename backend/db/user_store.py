from config import ROLES
from db.connection import connect
from security import password_hash


def normalize_role(role):
    value = str(role or "").strip().lower()
    if value in {"admin", "boss"}:
        return "admin"
    if value == "accountant":
        return "accountant"
    return "user"


def public_user(row):
    return {"id": row["id"], "email": row["username"], "role": normalize_role(row["role"]), "active": bool(row["active"])}


def is_email(value):
    return isinstance(value, str) and "@" in value and "." in value.split("@", 1)[-1]


def normalize_email(email):
    return (email or "").strip().lower()


def get_user_by_email(db_path, email, active_only=False):
    email = normalize_email(email)
    query = "SELECT * FROM users WHERE username = ?"
    params = [email]
    if active_only:
        query += " AND active = 1"
    with connect(db_path) as conn:
        return conn.execute(query, params).fetchone()


def user_count(db_path):
    with connect(db_path) as conn:
        return conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]


def has_admin(db_path):
    with connect(db_path) as conn:
        return bool(conn.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1").fetchone())


def list_users(db_path):
    with connect(db_path) as conn:
        rows = conn.execute(
            "SELECT id, username, role, active FROM users ORDER BY username"
        ).fetchall()
    return [public_user(row) for row in rows]


def create_or_update_user(db_path, email, password, role, active=1):
    role = normalize_role(role)
    if role not in ROLES:
        raise ValueError("Role không hợp lệ")
    email = normalize_email(email)
    if not is_email(email):
        raise ValueError("Email/Gmail không hợp lệ")
    with connect(db_path) as conn:
        existing = conn.execute("SELECT id FROM users WHERE username = ?", (email,)).fetchone()
        if existing and password:
            conn.execute(
                "UPDATE users SET password_hash = ?, role = ?, active = ? WHERE username = ?",
                (password_hash(password), role, 1 if active else 0, email),
            )
            return public_user(conn.execute("SELECT * FROM users WHERE username = ?", (email,)).fetchone())
        if existing:
            conn.execute(
                "UPDATE users SET role = ?, active = ? WHERE username = ?",
                (role, 1 if active else 0, email),
            )
            return public_user(conn.execute("SELECT * FROM users WHERE username = ?", (email,)).fetchone())
        if not password:
            raise ValueError("Mật khẩu là bắt buộc khi tạo tài khoản mới")
        conn.execute(
            """
            INSERT INTO users (username, password_hash, role, active)
            VALUES (?, ?, ?, ?)
            """,
            (email, password_hash(password), role, 1 if active else 0),
        )
        return public_user(conn.execute("SELECT * FROM users WHERE username = ?", (email,)).fetchone())


def create_user_with_password_hash(db_path, email, stored_password_hash, role="user", active=1):
    role = normalize_role(role)
    if role not in ROLES:
        raise ValueError("Role không hợp lệ")
    email = normalize_email(email)
    if not is_email(email):
        raise ValueError("Email/Gmail không hợp lệ")
    if not stored_password_hash:
        raise ValueError("Mật khẩu đăng ký không hợp lệ")
    with connect(db_path) as conn:
        if conn.execute("SELECT id FROM users WHERE username = ?", (email,)).fetchone():
            raise ValueError("Email này đã có tài khoản")
        conn.execute(
            """
            INSERT INTO users (username, password_hash, role, active)
            VALUES (?, ?, ?, ?)
            """,
            (email, stored_password_hash, role, 1 if active else 0),
        )
        return conn.execute("SELECT * FROM users WHERE username = ?", (email,)).fetchone()


def update_password(db_path, email, new_password):
    with connect(db_path) as conn:
        conn.execute(
            "UPDATE users SET password_hash = ? WHERE username = ?",
            (password_hash(new_password), normalize_email(email)),
        )


def update_role(db_path, email, role):
    role = normalize_role(role)
    if role not in ROLES:
        raise ValueError("Role không hợp lệ")
    email = normalize_email(email)
    with connect(db_path) as conn:
        row = conn.execute("SELECT * FROM users WHERE username = ?", (email,)).fetchone()
        if not row:
            raise ValueError("Tài khoản không tồn tại")
        conn.execute("UPDATE users SET role = ? WHERE username = ?", (role, email))
        return public_user(conn.execute("SELECT * FROM users WHERE username = ?", (email,)).fetchone())


def delete_user(db_path, email):
    email = normalize_email(email)
    with connect(db_path) as conn:
        row = conn.execute("SELECT id, role, active FROM users WHERE username = ?", (email,)).fetchone()
        if not row:
            raise ValueError("Tài khoản không tồn tại")
        if normalize_role(row["role"]) == "admin" and row["active"]:
            remaining_active_admin = conn.execute(
                "SELECT COUNT(*) FROM users WHERE role = 'admin' AND active = 1 AND username <> ?",
                (email,),
            ).fetchone()[0]
            if remaining_active_admin < 1:
                raise ValueError("Phải còn ít nhất 1 tài khoản Sếp đang hoạt động")
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (row["id"],))
        conn.execute("DELETE FROM users WHERE id = ?", (row["id"],))
