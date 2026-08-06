"""Lõi hạch toán kép DOMIX — bảng tài khoản, chứng từ và dòng bút toán.

Nguyên tắc:
  - Chạy SONG SONG với dữ liệu nghiệp vụ cũ (app_state) — không sửa/xóa dữ liệu cũ.
  - Migration idempotent theo convention dự án (CREATE IF NOT EXISTS + ALTER khi thiếu cột),
    có ``downgrade_accounting_tables`` để rollback trên môi trường phát triển.
  - Tiền lưu NUMERIC(18,2), tầng service dùng Decimal — tuyệt đối không dùng float.
"""

from decimal import Decimal

from db.connection import connect, table_exists

# (code, name, parent, level, kind, balance_side, postable)
DEFAULT_ACCOUNTS = [
    ("111", "Tiền mặt", None, 1, "asset", "no", 1),
    ("112", "Tiền gửi ngân hàng", None, 1, "asset", "no", 1),
    ("131", "Phải thu của khách hàng", None, 1, "asset", "no", 1),
    ("133", "Thuế GTGT được khấu trừ", None, 1, "asset", "no", 1),
    ("156", "Hàng hóa", None, 1, "asset", "no", 1),
    ("331", "Phải trả cho người bán", None, 1, "liability", "co", 1),
    ("333", "Thuế và các khoản phải nộp Nhà nước", None, 1, "liability", "co", 0),
    ("3331", "Thuế GTGT phải nộp", "333", 2, "liability", "co", 1),
    ("334", "Phải trả người lao động", None, 1, "liability", "co", 1),
    ("338", "Phải trả, phải nộp khác (BHXH, BHYT, BHTN)", None, 1, "liability", "co", 1),
    ("411", "Vốn đầu tư của chủ sở hữu", None, 1, "equity", "co", 1),
    ("511", "Doanh thu bán hàng và cung cấp dịch vụ", None, 1, "revenue", "co", 1),
    ("515", "Doanh thu hoạt động tài chính", None, 1, "revenue", "co", 1),
    ("632", "Giá vốn hàng bán", None, 1, "expense", "no", 1),
    ("641", "Chi phí bán hàng", None, 1, "expense", "no", 1),
    ("642", "Chi phí quản lý doanh nghiệp", None, 1, "expense", "no", 1),
    ("711", "Thu nhập khác", None, 1, "revenue", "co", 1),
]

JOURNAL_STATUSES = ("draft", "pending_approval", "posted", "rejected", "reversed")


def create_accounting_tables(conn):
    """Migration upgrade — chạy lặp lại an toàn mỗi lần khởi động."""
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS accounting_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            parent_code TEXT,
            level INTEGER NOT NULL DEFAULT 1,
            kind TEXT NOT NULL CHECK(kind IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
            balance_side TEXT NOT NULL CHECK(balance_side IN ('no', 'co')),
            postable INTEGER NOT NULL DEFAULT 1,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS journal_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entry_no TEXT NOT NULL UNIQUE,
            document_date TEXT NOT NULL,
            posting_date TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            business_type TEXT NOT NULL DEFAULT '',
            source_type TEXT NOT NULL DEFAULT '',
            source_id TEXT NOT NULL DEFAULT '',
            event_type TEXT NOT NULL DEFAULT '',
            idempotency_key TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL DEFAULT 'posted'
                CHECK(status IN ('draft', 'pending_approval', 'posted', 'rejected', 'reversed')),
            created_by TEXT NOT NULL DEFAULT '',
            approved_by TEXT NOT NULL DEFAULT '',
            submitted_at TEXT,
            approved_at TEXT,
            posted_at TEXT,
            reversal_of INTEGER REFERENCES journal_entries(id),
            reject_reason TEXT NOT NULL DEFAULT '',
            reversal_reason TEXT NOT NULL DEFAULT '',
            metadata TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(source_type, source_id, event_type)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS journal_entry_lines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            journal_entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
            account_code TEXT NOT NULL,
            line_description TEXT NOT NULL DEFAULT '',
            debit NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK(debit >= 0),
            credit NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK(credit >= 0),
            currency TEXT NOT NULL DEFAULT 'VND',
            customer_id TEXT,
            supplier_id TEXT,
            employee_id TEXT,
            product_id TEXT,
            cost_center TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CHECK (NOT (debit > 0 AND credit > 0)),
            CHECK (debit > 0 OR credit > 0)
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_journal_entries_posting ON journal_entries(posting_date, status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON journal_entries(source_type, source_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_entry_lines(journal_entry_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_entry_lines(account_code)")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS accounting_periods (
            period_key TEXT PRIMARY KEY,
            status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'locked')),
            locked_by TEXT NOT NULL DEFAULT '',
            locked_at TEXT,
            reopen_reason TEXT NOT NULL DEFAULT '',
            reopened_by TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    # Sổ kho theo bình quân gia quyền: lưu SL/giá trị trước và sau từng nghiệp vụ.
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS inventory_valuation_ledger (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id TEXT NOT NULL,
            movement_key TEXT NOT NULL UNIQUE,
            movement_date TEXT NOT NULL,
            movement_type TEXT NOT NULL,
            quantity NUMERIC(18, 3) NOT NULL,
            unit_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
            qty_before NUMERIC(18, 3) NOT NULL DEFAULT 0,
            value_before NUMERIC(18, 2) NOT NULL DEFAULT 0,
            qty_after NUMERIC(18, 3) NOT NULL DEFAULT 0,
            value_after NUMERIC(18, 2) NOT NULL DEFAULT 0,
            avg_cost_after NUMERIC(18, 2) NOT NULL DEFAULT 0,
            cost_assumed INTEGER NOT NULL DEFAULT 0,
            source_note TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_inventory_valuation_product ON inventory_valuation_ledger(product_id, movement_date, id)")
    # Đợt khai báo TỒN ĐẦU KỲ — chứng từ có duyệt, ghi kho + sổ cái trong cùng transaction.
    # Tài khoản đối ứng KHÔNG hard-code: kế toán chọn khi lập đợt (counter_account_code).
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS opening_inventory_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_code TEXT NOT NULL UNIQUE,
            effective_date TEXT NOT NULL,
            warehouse TEXT NOT NULL DEFAULT 'MAIN',
            counter_account_code TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'draft'
                CHECK(status IN ('draft', 'reviewed', 'posted', 'reversed')),
            source_document TEXT NOT NULL DEFAULT '',
            note TEXT NOT NULL DEFAULT '',
            idempotency_key TEXT NOT NULL UNIQUE,
            created_by TEXT NOT NULL DEFAULT '',
            reviewed_by TEXT NOT NULL DEFAULT '',
            posted_by TEXT NOT NULL DEFAULT '',
            posted_entry_id INTEGER REFERENCES journal_entries(id),
            reversal_entry_id INTEGER REFERENCES journal_entries(id),
            reversal_reason TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS opening_inventory_batch_lines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id INTEGER NOT NULL REFERENCES opening_inventory_batches(id) ON DELETE CASCADE,
            product_id TEXT NOT NULL,
            product_name TEXT NOT NULL DEFAULT '',
            uom TEXT NOT NULL DEFAULT 'cái',
            quantity NUMERIC(18, 3) NOT NULL CHECK(quantity > 0),
            unit_cost NUMERIC(18, 2) NOT NULL CHECK(unit_cost >= 0),
            amount NUMERIC(18, 2) NOT NULL CHECK(amount >= 0),
            note TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_opening_inventory_lines_batch ON opening_inventory_batch_lines(batch_id)")
    # Nhật ký kiểm toán dùng chung — tạo nếu database (VD database test) chưa có.
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
    seed_default_accounts(conn)


def seed_default_accounts(conn):
    for code, name, parent, level, kind, side, postable in DEFAULT_ACCOUNTS:
        conn.execute(
            """
            INSERT INTO accounting_accounts (code, name, parent_code, level, kind, balance_side, postable)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (code) DO NOTHING
            """,
            (code, name, parent, level, kind, side, postable),
        )


def downgrade_accounting_tables(db_path):
    """Rollback cho môi trường phát triển/test — KHÔNG chạy trên production."""
    with connect(db_path) as conn:
        for table in ("opening_inventory_batch_lines", "opening_inventory_batches",
                      "journal_entry_lines", "journal_entries", "accounting_accounts",
                      "accounting_periods", "inventory_valuation_ledger"):
            if table_exists(conn, table):
                conn.execute(f"DROP TABLE {table} CASCADE")


def list_accounts(conn):
    return conn.execute(
        "SELECT code, name, parent_code, level, kind, balance_side, postable, active"
        " FROM accounting_accounts WHERE active = 1 ORDER BY code"
    ).fetchall()


def account_exists(conn, code):
    row = conn.execute(
        "SELECT 1 AS found FROM accounting_accounts WHERE code = ? AND active = 1 AND postable = 1",
        (code,),
    ).fetchone()
    return bool(row)


def to_money(value):
    """Chuẩn hóa tiền về Decimal 2 chữ số — điểm duy nhất đổi kiểu, cấm float lọt vào sổ."""
    if value is None:
        return Decimal("0.00")
    return Decimal(str(value)).quantize(Decimal("0.01"))
