from __future__ import annotations

import os
import unittest
from urllib.parse import quote, urlparse, urlunparse
from uuid import uuid4


def _base_test_url() -> str:
    explicit = os.getenv("DOMIX_TEST_DATABASE_URL", "").strip()
    if explicit:
        return explicit
    host = os.getenv("DOMIX_DB_HOST", "127.0.0.1")
    port = os.getenv("DOMIX_DB_PORT", "5432")
    user = quote(os.getenv("DOMIX_DB_USER", "domix"), safe="")
    password = quote(os.getenv("DOMIX_DB_PASSWORD", ""), safe="")
    auth = f"{user}:{password}" if password else user
    return f"postgresql://{auth}@{host}:{port}/postgres"


def _database_url(base_url: str, database_name: str) -> str:
    parsed = urlparse(base_url)
    return urlunparse(parsed._replace(path=f"/{database_name}", query="", fragment=""))


class PostgresTestCase(unittest.TestCase):
    """Mỗi test dùng một database PostgreSQL thật và xóa sạch sau khi chạy."""

    db_path: str
    _admin_url: str
    _database_name: str

    def setUp(self):
        import psycopg
        from psycopg import sql

        self._admin_url = _base_test_url()
        self._database_name = f"domix_test_{uuid4().hex}"
        with psycopg.connect(self._admin_url, autocommit=True) as conn:
            conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(self._database_name)))
        self.db_path = _database_url(self._admin_url, self._database_name)

    def tearDown(self):
        import psycopg
        from psycopg import sql

        with psycopg.connect(self._admin_url, autocommit=True) as conn:
            conn.execute(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = %s AND pid <> pg_backend_pid()",
                (self._database_name,),
            )
            conn.execute(sql.SQL("DROP DATABASE IF EXISTS {}").format(sql.Identifier(self._database_name)))

