from db.connection import configure_database, connect, table_columns, table_exists
from db.employee_store import create_employees_table


def init_db(db_path):
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
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS cash_transactions (
                id TEXT PRIMARY KEY,
                transaction_code TEXT NOT NULL,
                transaction_type TEXT NOT NULL CHECK(transaction_type IN ('thu', 'chi')),
                category TEXT NOT NULL DEFAULT '',
                amount REAL NOT NULL CHECK(amount >= 0),
                transaction_date TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'posted' CHECK(status IN ('posted', 'reversed')),
                source_type TEXT NOT NULL DEFAULT 'manual',
                source_id TEXT,
                description TEXT NOT NULL DEFAULT '',
                payment_method TEXT NOT NULL DEFAULT '',
                reference_no TEXT NOT NULL DEFAULT '',
                created_by TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                reversed_at TEXT,
                reversed_by TEXT NOT NULL DEFAULT '',
                reversal_reason TEXT NOT NULL DEFAULT '',
                sync_origin TEXT NOT NULL DEFAULT 'app_state'
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_cash_transactions_date ON cash_transactions(transaction_date, transaction_type, status)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_cash_transactions_source ON cash_transactions(source_type, source_id)")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS debt_payments (
                id TEXT PRIMARY KEY,
                payment_code TEXT NOT NULL UNIQUE,
                idempotency_key TEXT UNIQUE,
                debt_id TEXT NOT NULL,
                customer_id TEXT,
                order_id TEXT,
                amount REAL NOT NULL CHECK(amount > 0),
                payment_method TEXT NOT NULL,
                paid_at TEXT NOT NULL,
                note TEXT NOT NULL DEFAULT '',
                receipt_transaction_id TEXT NOT NULL UNIQUE,
                created_by TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                status TEXT NOT NULL DEFAULT 'posted' CHECK(status IN ('posted', 'reversed')),
                reversed_at TEXT,
                reversed_by TEXT NOT NULL DEFAULT '',
                reversal_reason TEXT NOT NULL DEFAULT ''
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments(debt_id, paid_at, status)")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS payroll_payment_ledger (
                id TEXT PRIMARY KEY,
                payroll_key TEXT NOT NULL UNIQUE,
                employee_id TEXT NOT NULL,
                payroll_year INTEGER NOT NULL,
                payroll_month INTEGER NOT NULL,
                amount REAL NOT NULL CHECK(amount > 0),
                payment_method TEXT NOT NULL,
                paid_at TEXT NOT NULL,
                cash_account TEXT NOT NULL DEFAULT 'quy_cong_ty',
                reference_no TEXT NOT NULL DEFAULT '',
                note TEXT NOT NULL DEFAULT '',
                expense_transaction_id TEXT NOT NULL UNIQUE,
                status TEXT NOT NULL DEFAULT 'posted' CHECK(status IN ('posted', 'reversed')),
                created_by TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                reversed_at TEXT,
                reversed_by TEXT NOT NULL DEFAULT '',
                reversal_reason TEXT NOT NULL DEFAULT ''
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_payroll_payment_period ON payroll_payment_ledger(payroll_year, payroll_month, status)")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS inventory_movements (
                id TEXT PRIMARY KEY,
                product_id TEXT NOT NULL,
                product_name TEXT NOT NULL DEFAULT '',
                movement_type TEXT NOT NULL,
                quantity_change REAL NOT NULL,
                quantity_before REAL NOT NULL DEFAULT 0,
                quantity_after REAL NOT NULL DEFAULT 0,
                movement_date TEXT NOT NULL,
                source_type TEXT NOT NULL,
                source_id TEXT,
                reason TEXT NOT NULL DEFAULT '',
                created_by TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                status TEXT NOT NULL DEFAULT 'posted' CHECK(status IN ('posted', 'reversed'))
            )
            """
        )
        movement_columns = set(table_columns(conn, "inventory_movements"))
        if "product_name" not in movement_columns:
            conn.execute("ALTER TABLE inventory_movements ADD COLUMN product_name TEXT NOT NULL DEFAULT ''")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id, movement_date, created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_inventory_movements_source ON inventory_movements(source_type, source_id)")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                action TEXT NOT NULL,
                entity_type TEXT NOT NULL DEFAULT 'system',
                entity_id TEXT,
                actor_email TEXT NOT NULL DEFAULT '',
                detail TEXT NOT NULL DEFAULT '',
                success INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at)")
        create_employees_table(conn)
        conn.execute("DELETE FROM sessions WHERE expires_at <= datetime('now')")
        conn.execute("DELETE FROM registration_otps WHERE expires_at <= datetime('now')")
        conn.execute("DELETE FROM password_reset_otps WHERE expires_at <= datetime('now')")
    migrate_users_schema(db_path)
    migrate_chat_schema(db_path)
    remove_non_email_users(db_path)


def migrate_users_schema(db_path):
    """Chuẩn hóa vai trò và đồng bộ tài khoản với hồ sơ nhân sự trên PostgreSQL."""

    import unicodedata

    def normalize_text(value):
        text = unicodedata.normalize("NFD", str(value or ""))
        text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
        text = text.replace("đ", "d").replace("Đ", "D").lower()
        return " ".join("".join(ch if ch.isalnum() else " " for ch in text).split())

    def is_accounting_employee(row):
        role_token = normalize_text(row.get("role_type")).replace(" ", "_")
        if role_token in {"ke_toan", "ketoan", "accountant", "accounting", "finance"}:
            return True
        description = normalize_text(f"{row.get('position') or ''} {row.get('dept') or ''}")
        return any(token in description for token in ("ke toan", "tai chinh", "accountant", "accounting", "finance"))

    with connect(db_path) as conn:
        conn.execute(
            """
            UPDATE users
            SET role = CASE
                WHEN lower(trim(role)) IN ('admin', 'boss') THEN 'admin'
                WHEN lower(trim(role)) = 'accountant' THEN 'accountant'
                ELSE 'user'
            END
            """
        )
        if not table_exists(conn, "employees"):
            return
        employees = conn.execute(
            "SELECT id, account_id, email, role_type, position, dept, account_role FROM employees"
        ).fetchall()
        for employee in employees:
            account = None
            if employee.get("account_id") is not None:
                account = conn.execute(
                    "SELECT id, role FROM users WHERE id = ?", (employee["account_id"],)
                ).fetchone()
            if account is None and employee.get("email"):
                account = conn.execute(
                    "SELECT id, role FROM users WHERE lower(username) = lower(?)",
                    (employee["email"],),
                ).fetchone()
            if account is None:
                continue
            if account["role"] == "admin":
                desired_role = "admin"
            elif is_accounting_employee(employee) or str(employee.get("account_role") or "").strip().lower() == "accountant":
                desired_role = "accountant"
            else:
                desired_role = "user"
            conn.execute("UPDATE users SET role = ? WHERE id = ?", (desired_role, account["id"]))
            conn.execute(
                "UPDATE employees SET account_id = ?, account_role = ? WHERE id = ?",
                (account["id"], desired_role, employee["id"]),
            )


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
        message_columns = set(table_columns(conn, "chat_messages"))
        if "deleted_at" not in message_columns:
            conn.execute("ALTER TABLE chat_messages ADD COLUMN deleted_at TEXT")
        group_message_columns = set(table_columns(conn, "chat_group_messages"))
        if "deleted_at" not in group_message_columns:
            conn.execute("ALTER TABLE chat_group_messages ADD COLUMN deleted_at TEXT")
        read_columns = set(table_columns(conn, "chat_group_reads"))
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
