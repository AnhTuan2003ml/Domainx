import json
import sqlite3
import unicodedata

from db.connection import connect

# ---------------------------------------------------------------------------
# Bảng nhân sự (employees) — TÁCH RIÊNG khỏi bảng tài khoản (users).
#   - users     : phục vụ ĐĂNG NHẬP (email + mật khẩu + quyền). Gọn, truy vấn nhanh.
#   - employees : hồ sơ NHÂN SỰ đầy đủ (lương, KPI, giấy tờ...). Phục vụ thêm/sửa/xóa.
# Hai bảng liên kết qua employees.account_id -> users.id (và qua email).
#
# Theo yêu cầu "mỗi trường một cột": mỗi field của object nhân sự phía frontend
# được ánh xạ thành MỘT cột riêng. FIELD_SPEC là nguồn sự thật duy nhất — dùng để
# sinh CREATE TABLE, INSERT và chuyển đổi row <-> dict, tránh lặp ~55 cột bằng tay.
# ---------------------------------------------------------------------------

# (js_key, db_column, kind) — kind: text | int | real | json
FIELD_SPEC = [
    ("email", "email", "text"),
    ("name", "name", "text"),
    ("position", "position", "text"),
    ("dept", "dept", "text"),
    ("baseSalary", "base_salary", "real"),
    ("dailySalary", "daily_salary", "real"),
    ("bonusTarget", "bonus_target", "real"),
    ("kpi", "kpi", "real"),
    ("joined", "joined", "text"),
    ("status", "status", "text"),
    ("resignedDate", "resigned_date", "text"),
    ("roleType", "role_type", "text"),
    ("accountRole", "account_role", "text"),
    ("contractType", "contract_type", "text"),
    ("probationRate", "probation_rate", "real"),
    ("dependents", "dependents", "int"),
    ("mealAllowance", "meal_allowance", "real"),
    ("attendanceBonus", "attendance_bonus", "real"),
    ("otherBonus", "other_bonus", "real"),
    ("advance", "advance", "real"),
    ("consecutiveLowKpiMonths", "consecutive_low_kpi_months", "int"),
    ("customScore", "custom_score", "real"),
    # Thông tin cá nhân / hồ sơ
    ("dob", "dob", "text"),
    ("hometown", "hometown", "text"),
    ("bankName", "bank_name", "text"),
    ("bankAccount", "bank_account", "text"),
    ("phone", "phone", "text"),
    ("idNumber", "id_number", "text"),
    ("education", "education", "text"),
    ("major", "major", "text"),
    ("resumeSummary", "resume_summary", "text"),
    # Chỉ số theo vai trò — Sale
    ("salesTarget", "sales_target", "real"),
    ("salesActual", "sales_actual", "real"),
    ("dealsClosed", "deals_closed", "int"),
    ("leadsHandled", "leads_handled", "int"),
    # Chỉ số theo vai trò — Ads/Marketing
    ("adSpend", "ad_spend", "real"),
    ("adRevenue", "ad_revenue", "real"),
    ("conversions", "conversions", "int"),
    ("ctr", "ctr", "real"),
    # Chỉ số theo vai trò — Kỹ thuật
    ("tasksAssigned", "tasks_assigned", "int"),
    ("tasksCompleted", "tasks_completed", "int"),
    ("tasksOnTime", "tasks_on_time", "int"),
    ("bugsFixed", "bugs_fixed", "int"),
    ("upsaleValue", "upsale_value", "real"),
    # Giấy tờ đính kèm (base64)
    ("idFrontData", "id_front_data", "text"),
    ("idFrontName", "id_front_name", "text"),
    ("idFrontType", "id_front_type", "text"),
    ("idBackData", "id_back_data", "text"),
    ("idBackName", "id_back_name", "text"),
    ("idBackType", "id_back_type", "text"),
    ("resumeFileData", "resume_file_data", "text"),
    ("resumeFileName", "resume_file_name", "text"),
    ("resumeFileType", "resume_file_type", "text"),
    # Ảnh đại diện tài khoản nhân viên (data URL đã được frontend thu nhỏ trước khi lưu).
    ("avatarData", "avatar_data", "text"),
    ("avatarName", "avatar_name", "text"),
    ("avatarType", "avatar_type", "text"),
    # Chấm công là map lồng nhau -> lưu JSON trong một cột riêng
    ("attendance", "attendance", "json"),
]

_SQL_TYPE = {"text": "TEXT", "int": "INTEGER", "real": "REAL", "json": "TEXT"}


def _normalize_account_role(value):
    role = str(value or "").strip().lower()
    if role in {"admin", "boss"}:
        return "admin"
    if role == "accountant":
        return "accountant"
    return "user"


def _normalize_role_text(value):
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.replace("đ", "d").replace("Đ", "D").lower()
    return " ".join("".join(ch if ch.isalnum() else " " for ch in text).split())


def _employee_is_accountant(emp):
    role_token = _normalize_role_text(emp.get("roleType")).replace(" ", "_")
    if role_token in {"ke_toan", "ketoan", "accountant", "accounting", "finance"}:
        return True
    description = _normalize_role_text(f"{emp.get('position') or ''} {emp.get('dept') or ''}")
    return any(token in description for token in ("ke toan", "tai chinh", "accountant", "accounting", "finance"))


def _column_defs():
    return ",\n                ".join(
        f"{db_col} {_SQL_TYPE[kind]}" for _, db_col, kind in FIELD_SPEC
    )


def create_employees_table(conn):
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS employees (
                id INTEGER PRIMARY KEY,
                account_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                {_column_defs()},
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    # Email rỗng lưu thành NULL để nhân sự thêm nhanh (chưa có email) không đụng
    # ràng buộc UNIQUE — chỉ email THẬT mới phải duy nhất. Dòng UPDATE + DROP dưới
    # đây migrate DB cũ (từng lưu '' và dùng index UNIQUE toàn cột).
    # Migrate DB đang dùng: CREATE TABLE IF NOT EXISTS không tự bổ sung cột mới.
    # Mỗi lần khởi động, tự thêm các cột trong FIELD_SPEC còn thiếu để bản vá có thể
    # ghi đè trực tiếp mà không cần người dùng chạy lệnh migrate thủ công.
    existing_columns = {row["name"] for row in conn.execute("PRAGMA table_info(employees)").fetchall()}
    for _, db_col, kind in FIELD_SPEC:
        if db_col not in existing_columns:
            conn.execute(f"ALTER TABLE employees ADD COLUMN {db_col} {_SQL_TYPE[kind]}")

    conn.execute("UPDATE employees SET email = NULL WHERE email = ''")
    conn.execute("DROP INDEX IF EXISTS idx_employees_email")
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_email ON employees(email) WHERE email IS NOT NULL"
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_employees_account ON employees(account_id)")


def _to_db_value(kind, value):
    if kind == "json":
        return json.dumps(value if value is not None else {}, ensure_ascii=False)
    if kind == "int":
        try:
            return int(value or 0)
        except (TypeError, ValueError):
            return 0
    if kind == "real":
        try:
            return float(value or 0)
        except (TypeError, ValueError):
            return 0.0
    return value if value is None else str(value)


def _from_db_value(kind, value):
    if kind == "json":
        if not value:
            return {}
        try:
            return json.loads(value)
        except (TypeError, ValueError):
            return {}
    if kind == "int":
        return int(value) if value is not None else 0
    if kind == "real":
        return float(value) if value is not None else 0
    # Trả "" thay vì null cho cột chữ (email NULL trong DB) — frontend luôn nhận chuỗi.
    return value if value is not None else ""


def row_to_dict(row):
    result = {"id": row["id"], "account_id": row["account_id"]}
    for js_key, db_col, kind in FIELD_SPEC:
        result[js_key] = _from_db_value(kind, row[db_col])
    return result


def list_employees(db_path):
    with connect(db_path) as conn:
        rows = conn.execute("SELECT * FROM employees ORDER BY name COLLATE NOCASE").fetchall()
    return [row_to_dict(row) for row in rows]


def _normalize_email(value):
    return (value or "").strip().lower()


def _account_id_for_email(conn, email):
    if not email:
        return None
    row = conn.execute("SELECT id FROM users WHERE username = ?", (email,)).fetchone()
    return row["id"] if row else None


def replace_all(db_path, employees):
    """Ghi đè bảng nhân sự và đồng bộ users.role theo 3 quyền chuẩn.

    - admin được giữ nguyên hoặc được chọn rõ trong hồ sơ
    - Kế toán/Tài chính -> accountant
    - các nhân viên còn lại -> user
    """
    if not isinstance(employees, list):
        raise ValueError("employees phải là danh sách")

    db_columns = [db_col for _, db_col, _ in FIELD_SPEC]
    insert_cols = ["id", "account_id"] + db_columns
    placeholders = ",".join("?" for _ in insert_cols)

    with connect(db_path) as conn:
        conn.execute("DELETE FROM employees")
        for emp in employees:
            if not isinstance(emp, dict) or emp.get("id") is None:
                continue
            emp_id = int(emp["id"])
            email = _normalize_email(emp.get("email"))
            account_id = _account_id_for_email(conn, email)
            account = conn.execute("SELECT id, role FROM users WHERE id = ?", (account_id,)).fetchone() if account_id is not None else None
            requested_role = _normalize_account_role(emp.get("accountRole"))
            current_role = _normalize_account_role(account["role"]) if account else "user"
            if current_role == "admin" or requested_role == "admin":
                desired_role = "admin"
            elif requested_role == "accountant" or _employee_is_accountant(emp):
                desired_role = "accountant"
            else:
                desired_role = "user"
            normalized_emp = dict(emp)
            normalized_emp["accountRole"] = desired_role
            values = [emp_id, account_id]
            for js_key, _, kind in FIELD_SPEC:
                raw = (email or None) if js_key == "email" else normalized_emp.get(js_key)
                values.append(_to_db_value(kind, raw))
            try:
                conn.execute(
                    f"INSERT INTO employees ({','.join(insert_cols)}) VALUES ({placeholders})",
                    values,
                )
            except sqlite3.IntegrityError:
                raise ValueError(f"Email nhân sự bị trùng: {email or '(trống)'}")
            if account_id is not None:
                conn.execute("UPDATE users SET role = ? WHERE id = ?", (desired_role, account_id))
    return list_employees(db_path)


def employee_emails_by_id(db_path):
    """Map {str(id): email} — dùng để lọc quyền xem task theo nhân sự."""
    with connect(db_path) as conn:
        rows = conn.execute("SELECT id, email FROM employees").fetchall()
    return {str(row["id"]): _normalize_email(row["email"]) for row in rows if row["email"]}

def delete_employee(db_path, employee_id, current_user_email=""):
    """Xóa hồ sơ nhân sự và tài khoản đăng nhập liên kết trong cùng một giao dịch."""
    try:
        employee_id = int(employee_id)
    except (TypeError, ValueError):
        raise ValueError("Mã nhân sự không hợp lệ")

    # Tham số current_user_email được giữ để tương thích API cũ; quyền xóa
    # được kiểm soát bằng quy tắc luôn phải còn ít nhất một Admin hoạt động.
    with connect(db_path) as conn:
        row = conn.execute(
            "SELECT id, email, account_id FROM employees WHERE id = ?",
            (employee_id,),
        ).fetchone()
        if not row:
            raise ValueError("Nhân sự không tồn tại hoặc đã bị xóa")

        account_id = row["account_id"]
        if account_id is not None:
            account = conn.execute(
                "SELECT id, role, active FROM users WHERE id = ?",
                (account_id,),
            ).fetchone()
            if account and _normalize_account_role(account["role"]) == "admin" and bool(account["active"]):
                other_active_admins = conn.execute(
                    "SELECT COUNT(*) FROM users WHERE role = 'admin' AND active = 1 AND id <> ?",
                    (account_id,),
                ).fetchone()[0]
                if other_active_admins < 1:
                    raise ValueError("Không thể xóa Sếp đang hoạt động cuối cùng. Hãy tạo hoặc mở khóa một tài khoản Sếp khác trước.")

        conn.execute("DELETE FROM employees WHERE id = ?", (employee_id,))
        if account_id is not None:
            # Các bảng chat/sessions có ON DELETE CASCADE; xóa tài khoản sẽ dọn dữ liệu liên kết.
            conn.execute("DELETE FROM users WHERE id = ?", (account_id,))

    return list_employees(db_path)

