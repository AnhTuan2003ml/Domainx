from db.connection import configure_database, connect
from db.employee_store import create_employees_table


def init_db(db_path):
    db_path.parent.mkdir(parents=True, exist_ok=True)
    configure_database(db_path)
    with connect(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS app_state (
                key TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('admin', 'accountant', 'user')),
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS registration_otps (
                email TEXT PRIMARY KEY,
                otp_hash TEXT NOT NULL,
                pending_password_hash TEXT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                expires_at TEXT NOT NULL,
                last_sent_at TEXT NOT NULL,
                request_count INTEGER NOT NULL DEFAULT 1,
                window_started_at TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_registration_otps_expires ON registration_otps(expires_at)")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS password_reset_otps (
                email TEXT PRIMARY KEY,
                otp_hash TEXT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                expires_at TEXT NOT NULL,
                last_sent_at TEXT NOT NULL,
                request_count INTEGER NOT NULL DEFAULT 1,
                window_started_at TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_password_reset_otps_expires ON password_reset_otps(expires_at)")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS email_alert_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alert_key TEXT NOT NULL,
                recipient_email TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                expiry_date TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
                error_message TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                sent_at TEXT,
                UNIQUE(alert_key, recipient_email)
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_email_alert_log_status ON email_alert_log(status, created_at)")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                body TEXT NOT NULL,
                read_at TEXT,
                deleted_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_chat_pair_created ON chat_messages(sender_id, recipient_id, created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_chat_sender_recipient_id ON chat_messages(sender_id, recipient_id, id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_chat_recipient_sender_id ON chat_messages(recipient_id, sender_id, id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_chat_unread ON chat_messages(recipient_id, read_at)")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                deleted_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_group_members (
                group_id INTEGER NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (group_id, user_id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_group_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id INTEGER NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
                sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                body TEXT NOT NULL,
                deleted_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_group_reads (
                group_id INTEGER NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                last_read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_read_message_id INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (group_id, user_id)
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_chat_group_messages ON chat_group_messages(group_id, created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_chat_group_messages_id ON chat_group_messages(group_id, id)")
        create_employees_table(conn)
        conn.execute("DELETE FROM sessions WHERE expires_at <= datetime('now')")
        conn.execute("DELETE FROM registration_otps WHERE expires_at <= datetime('now')")
        conn.execute("DELETE FROM password_reset_otps WHERE expires_at <= datetime('now')")
    migrate_users_schema(db_path)
    migrate_chat_schema(db_path)
    remove_non_email_users(db_path)


def migrate_users_schema(db_path):
    """Chuẩn hóa bảng users chỉ còn 3 quyền: admin, accountant, user.

    - boss/admin cũ -> admin
    - accountant giữ nguyên
    - staff/user/giá trị khác -> user

    Giữ nguyên users.id để sessions, chat và employees.account_id không mất liên kết.
    Sau khi đổi cấu trúc, hồ sơ nhân sự thuộc Kế toán/Tài chính được đồng bộ sang
    role accountant; tài khoản admin luôn được giữ nguyên.
    """
    import sqlite3
    import unicodedata

    def normalize_text(value):
        text = unicodedata.normalize("NFD", str(value or ""))
        text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
        text = text.replace("đ", "d").replace("Đ", "D").lower()
        return " ".join("".join(ch if ch.isalnum() else " " for ch in text).split())

    def is_accounting_employee(row):
        role_token = normalize_text(row["role_type"]).replace(" ", "_")
        if role_token in {"ke_toan", "ketoan", "accountant", "accounting", "finance"}:
            return True
        description = normalize_text(f"{row['position'] or ''} {row['dept'] or ''}")
        return any(token in description for token in ("ke toan", "tai chinh", "accountant", "accounting", "finance"))

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").fetchone()
        if not row:
            return
        sql = row["sql"] or ""
        canonical_schema = (
            "'admin'" in sql and "'accountant'" in sql and "'user'" in sql
            and "'boss'" not in sql and "'staff'" not in sql
        )
        if not canonical_schema:
            conn.execute("PRAGMA foreign_keys = OFF")
            conn.execute("BEGIN")
            conn.execute(
                """
                CREATE TABLE users_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL CHECK(role IN ('admin', 'accountant', 'user')),
                    active INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute(
                """
                INSERT INTO users_new (id, username, password_hash, role, active, created_at)
                SELECT id, username, password_hash,
                       CASE
                         WHEN lower(trim(role)) IN ('admin', 'boss') THEN 'admin'
                         WHEN lower(trim(role)) = 'accountant' THEN 'accountant'
                         ELSE 'user'
                       END,
                       active, created_at
                FROM users
                """
            )
            conn.execute("DROP TABLE users")
            conn.execute("ALTER TABLE users_new RENAME TO users")
            conn.commit()
            conn.execute("PRAGMA foreign_keys = ON")
        else:
            conn.execute("UPDATE users SET role = CASE WHEN role = 'accountant' THEN 'accountant' WHEN role = 'admin' THEN 'admin' ELSE 'user' END")
            conn.commit()

        # Đồng bộ tài khoản đã liên kết hồ sơ Kế toán/Tài chính. Admin không bị hạ quyền.
        employee_table = conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='employees'").fetchone()
        if employee_table:
            employees = conn.execute(
                "SELECT id, account_id, email, role_type, position, dept, account_role FROM employees"
            ).fetchall()
            for employee in employees:
                account = None
                if employee["account_id"] is not None:
                    account = conn.execute("SELECT id, role FROM users WHERE id = ?", (employee["account_id"],)).fetchone()
                if account is None and employee["email"]:
                    account = conn.execute("SELECT id, role FROM users WHERE lower(username) = lower(?)", (employee["email"],)).fetchone()
                if account is None:
                    continue
                if account["role"] == "admin":
                    desired_role = "admin"
                elif is_accounting_employee(employee) or str(employee["account_role"] or "").strip().lower() == "accountant":
                    desired_role = "accountant"
                else:
                    desired_role = "user"
                conn.execute("UPDATE users SET role = ? WHERE id = ?", (desired_role, account["id"]))
                conn.execute(
                    "UPDATE employees SET account_id = ?, account_role = ? WHERE id = ?",
                    (account["id"], desired_role, employee["id"]),
                )
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        try:
            conn.execute("PRAGMA foreign_keys = ON")
        except Exception:
            pass
        conn.close()


def remove_non_email_users(db_path):
    with connect(db_path) as conn:
        rows = conn.execute("SELECT id, username FROM users").fetchall()
        invalid_ids = [
            row["id"]
            for row in rows
            if "@" not in row["username"] or "." not in row["username"].split("@", 1)[-1]
        ]
        if not invalid_ids:
            return
        placeholders = ",".join("?" for _ in invalid_ids)
        conn.execute(f"DELETE FROM sessions WHERE user_id IN ({placeholders})", invalid_ids)
        conn.execute(f"DELETE FROM users WHERE id IN ({placeholders})", invalid_ids)


def migrate_chat_schema(db_path):
    with connect(db_path) as conn:
        message_columns = [row["name"] for row in conn.execute("PRAGMA table_info(chat_messages)").fetchall()]
        if "deleted_at" not in message_columns:
            conn.execute("ALTER TABLE chat_messages ADD COLUMN deleted_at TEXT")
        group_message_columns = [row["name"] for row in conn.execute("PRAGMA table_info(chat_group_messages)").fetchall()]
        if "deleted_at" not in group_message_columns:
            conn.execute("ALTER TABLE chat_group_messages ADD COLUMN deleted_at TEXT")
        read_columns = [row["name"] for row in conn.execute("PRAGMA table_info(chat_group_reads)").fetchall()]
        if "last_read_message_id" not in read_columns:
            conn.execute("ALTER TABLE chat_group_reads ADD COLUMN last_read_message_id INTEGER NOT NULL DEFAULT 0")
            conn.execute(
                """
                UPDATE chat_group_reads
                SET last_read_message_id = COALESCE((
                    SELECT MAX(m.id)
                    FROM chat_group_messages m
                    WHERE m.group_id = chat_group_reads.group_id
                      AND m.created_at <= chat_group_reads.last_read_at
                ), 0)
                """
            )
