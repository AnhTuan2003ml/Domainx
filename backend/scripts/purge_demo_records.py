# -*- coding: utf-8 -*-
"""Xóa các bản ghi DEMO/TEST còn sót: nhân sự demo, tài khoản demo, nhiệm vụ cũ.

Giữ nguyên: tài khoản quản trị thật + các nhân sự thật đang gắn tài khoản làm việc.
Chỉ chạy trong môi trường thử nghiệm (cùng guard với seed):
  DOMIX_ALLOW_TEST_SEED=1 python scripts/purge_demo_records.py
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import APP_ENV, DEFAULT_DB_TARGET  # noqa: E402
from db import connection  # noqa: E402
from db.state_store import update_state  # noqa: E402

DB = DEFAULT_DB_TARGET

# Nhận diện demo theo TÊN HỒ SƠ và EMAIL đã rà soát thủ công — không đoán mò.
DEMO_EMPLOYEE_NAMES = {"demo", "demotest"}
DEMO_USER_EMAILS = {
    "demo@gmail.com", "demo123@gmail.com", "hoangngochiepms@gmail.com",
    "test.qa2.accounting.20260729@example.com",
}


def main():
    if APP_ENV == "production" and os.environ.get("DOMIX_ALLOW_TEST_SEED") != "1":
        print("TỪ CHỐI: production — cần DOMIX_ALLOW_TEST_SEED=1 nếu đây là môi trường thử.")
        sys.exit(2)

    with connection.connect(DB) as conn:
        emp_rows = conn.execute("SELECT id, name, account_id FROM employees").fetchall()
        demo_emp_ids = [r["id"] for r in emp_rows if str(r["name"] or "").strip().lower() in DEMO_EMPLOYEE_NAMES]
        for emp_id in demo_emp_ids:
            conn.execute("DELETE FROM employees WHERE id = ?", (emp_id,))
        print(f"Đã xóa {len(demo_emp_ids)} hồ sơ nhân sự demo: {demo_emp_ids}")

        user_rows = conn.execute("SELECT id, username, role FROM users").fetchall()
        demo_user_ids = [r["id"] for r in user_rows
                         if str(r["username"] or "").strip().lower() in DEMO_USER_EMAILS
                         and str(r["role"]) != "admin"]
        for user_id in demo_user_ids:
            conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
            conn.execute("UPDATE employees SET account_id = NULL WHERE account_id = ?", (user_id,))
            conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        print(f"Đã xóa {len(demo_user_ids)} tài khoản demo/test: {demo_user_ids}")

    def updater(data):
        d = dict(data or {})
        # Nhiệm vụ cũ ("test"...) là dữ liệu thử — làm sạch để bảng nhiệm vụ trống.
        d["tasks"] = []
        return d

    update_state(DB, updater)
    print("Đã xóa nhiệm vụ demo cũ trong bảng Nhiệm vụ.")

    with connection.connect(DB) as conn:
        remain_emp = conn.execute("SELECT COUNT(*) AS n FROM employees").fetchone()["n"]
        remain_users = conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]
    print(f"Còn lại: {remain_emp} nhân sự thật · {remain_users} tài khoản.")


if __name__ == "__main__":
    main()

