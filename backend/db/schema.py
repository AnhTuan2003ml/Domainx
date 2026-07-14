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
                role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
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
        create_employees_table(conn)
        conn.execute("DELETE FROM sessions WHERE expires_at <= datetime('now')")
        conn.execute("DELETE FROM registration_otps WHERE expires_at <= datetime('now')")
    migrate_users_schema(db_path)
    migrate_chat_schema(db_path)
    remove_non_email_users(db_path)


def migrate_users_schema(db_path):
    with connect(db_path) as conn:
        row = conn.execute("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").fetchone()
        if not row or ("'viewer'" not in row["sql"] and "'editor'" not in row["sql"]):
            return
        conn.execute(
            """
            CREATE TABLE users_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            INSERT INTO users_new (id, username, password_hash, role, active, created_at)
            SELECT id, username, password_hash,
                   CASE WHEN role = 'admin' THEN 'admin' ELSE 'user' END,
                   active, created_at
            FROM users
            """
        )
        conn.execute("DROP TABLE users")
        conn.execute("ALTER TABLE users_new RENAME TO users")


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
