from __future__ import annotations

import argparse
from pathlib import Path
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from config import DEFAULT_DB_TARGET  # noqa: E402
from db.connection import connect, table_columns  # noqa: E402
from db.schema import init_db  # noqa: E402


TABLE_ORDER = [
    "app_state",
    "users",
    "employees",
    "sessions",
    "registration_otps",
    "password_reset_otps",
    "email_alert_log",
    "chat_messages",
    "chat_groups",
    "chat_group_members",
    "chat_group_messages",
    "chat_group_reads",
]
IDENTITY_TABLES = ("users", "email_alert_log", "chat_messages", "chat_groups", "chat_group_messages")


def sqlite_columns(connection, table_name):
    return [row["name"] for row in connection.execute(f"PRAGMA table_info({table_name})").fetchall()]


def sqlite_table_exists(connection, table_name):
    return bool(connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table_name,)
    ).fetchone())


def migrate(sqlite_path: Path, postgres_url: str, replace: bool = False):
    if not sqlite_path.exists():
        raise FileNotFoundError(f"Không tìm thấy SQLite: {sqlite_path}")
    if not postgres_url.startswith(("postgresql://", "postgres://")):
        raise ValueError("Đích phải là URL PostgreSQL")

    init_db(postgres_url)
    source = sqlite3.connect(sqlite_path)
    source.row_factory = sqlite3.Row
    copied = {}
    try:
        with connect(postgres_url) as target:
            if replace:
                target.execute(
                    "TRUNCATE TABLE chat_group_reads, chat_group_messages, chat_group_members, "
                    "chat_groups, chat_messages, email_alert_log, password_reset_otps, "
                    "registration_otps, sessions, employees, users, app_state RESTART IDENTITY CASCADE"
                )

            for table_name in TABLE_ORDER:
                if not sqlite_table_exists(source, table_name):
                    copied[table_name] = 0
                    continue
                source_cols = sqlite_columns(source, table_name)
                target_cols = table_columns(target, table_name)
                columns = [column for column in source_cols if column in target_cols]
                if not columns:
                    copied[table_name] = 0
                    continue

                rows = source.execute(
                    f"SELECT {','.join(columns)} FROM {table_name}"
                ).fetchall()
                placeholders = ",".join("?" for _ in columns)
                column_sql = ",".join(columns)
                insert_sql = (
                    f"INSERT INTO {table_name} ({column_sql}) VALUES ({placeholders}) "
                    "ON CONFLICT DO NOTHING"
                )
                count = 0
                for row in rows:
                    cursor = target.execute(insert_sql, [row[column] for column in columns])
                    if cursor.rowcount > 0:
                        count += 1
                copied[table_name] = count

            for table_name in IDENTITY_TABLES:
                target.execute(
                    f"""
                    SELECT setval(
                        pg_get_serial_sequence('{table_name}', 'id'),
                        COALESCE((SELECT MAX(id) FROM {table_name}), 1),
                        EXISTS(SELECT 1 FROM {table_name})
                    ) AS sequence_value
                    """
                )
    finally:
        source.close()

    return copied


def main():
    parser = argparse.ArgumentParser(description="Chuyển dữ liệu DOMIX từ SQLite sang PostgreSQL")
    parser.add_argument("--sqlite", required=True, type=Path)
    parser.add_argument(
        "--postgres",
        default=str(DEFAULT_DB_TARGET),
        help="URL PostgreSQL; mặc định lấy từ biến môi trường DOMIX_DB_* hoặc DOMIX_DATABASE_URL",
    )
    parser.add_argument("--replace", action="store_true", help="Xóa dữ liệu PostgreSQL trước khi chuyển")
    args = parser.parse_args()

    result = migrate(args.sqlite.resolve(), args.postgres, replace=args.replace)
    total = sum(result.values())
    print(f"Đã chuyển {total} bản ghi.")
    for table_name, count in result.items():
        print(f"- {table_name}: {count}")


if __name__ == "__main__":
    main()
