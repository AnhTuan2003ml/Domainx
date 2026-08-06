"""Chạy bộ test lõi kế toán trên DATABASE TEST riêng (an toàn với dữ liệu chính).

Cách dùng (trong container backend — đã có psycopg và biến DOMIX_DB_*):
    docker exec domix_company-backend-1 python tests/run_accounting_tests.py
Tự tạo database ``domix_accounting_test`` nếu chưa có.
"""

import os
import subprocess
import sys
from urllib.parse import quote

user = os.environ.get("DOMIX_DB_USER", "domix")
password = os.environ.get("DOMIX_DB_PASSWORD", "")
host = os.environ.get("DOMIX_DB_HOST", "database")
port = os.environ.get("DOMIX_DB_PORT", "5432")

admin_url = f"postgresql://{quote(user, safe='')}:{quote(password, safe='')}@{host}:{port}/postgres"
test_url = f"postgresql://{quote(user, safe='')}:{quote(password, safe='')}@{host}:{port}/domix_accounting_test"

try:
    import psycopg
    with psycopg.connect(admin_url, autocommit=True) as conn:
        exists = conn.execute(
            "SELECT 1 FROM pg_database WHERE datname = 'domix_accounting_test'"
        ).fetchone()
        if not exists:
            conn.execute("CREATE DATABASE domix_accounting_test")
except Exception as exc:  # noqa: BLE001
    print(f"Không chuẩn bị được database test: {exc}")
    sys.exit(2)

os.environ["DOMIX_ACCOUNTING_TEST_DB"] = test_url
sys.exit(subprocess.call([
    sys.executable, "-m", "unittest",
    "tests.test_accounting_core", "tests.test_opening_inventory", "-v",
]))
