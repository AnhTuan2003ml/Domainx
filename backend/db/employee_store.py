import json
import unicodedata

from db.connection import DatabaseIntegrityError, connect, table_columns
from security import password_hash

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
    # Vạch doanh thu RIÊNG của nhân viên (chấm KPI): vượt vạch → hưởng % hoa hồng
    # trên toàn bộ doanh thu tháng; để 0/trống thì dùng vạch chung của công ty.
    ("kpiRevenueThreshold", "kpi_revenue_threshold", "real"),
    ("kpiRevenuePct", "kpi_revenue_pct", "real"),
    # Bảo hiểm theo SỐ TIỀN CỐ ĐỊNH cho từng nhân viên (mode=1 bật; NV đóng + DN đóng).
    ("insuranceFixedMode", "insurance_fixed_mode", "real"),
    ("insuranceEmployeeAmount", "insurance_employee_amount", "real"),
    ("insuranceEmployerAmount", "insurance_employer_amount", "real"),
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
    ("attendanceTimes", "attendance_times", "json"),
    # Phụ cấp khai báo thêm (danh sách khoản) + vết cập nhật — thiếu các cột này thì
    # frontend lưu xong bị server vứt bỏ, lần refetch sau phụ cấp "bốc hơi".
    ("allowances", "allowances", "json"),
    ("allowanceUpdatedAt", "allowance_updated_at", "text"),
    ("allowanceUpdatedByName", "allowance_updated_by_name", "text"),
    # Vết chấm KPI của kỳ (nằm trong ACCOUNTANT_EDITABLE_EMPLOYEE_FIELDS phía server).
    ("kpiNote", "kpi_note", "text"),
    ("kpiReviewedAt", "kpi_reviewed_at", "text"),
    ("kpiReviewedByName", "kpi_reviewed_by_name", "text"),
    # LƯƠNG HIỆU LỰC THEO THÁNG: mỗi lần Admin đổi lương/KPI có mốc "áp dụng từ tháng";
    # bảng lương tháng cũ tra lại snapshot cũ, không bị thay đổi hồi tố.
    ("compensationHistory", "compensation_history", "json"),
    # Bảng KPI riêng của từng nhân viên (mảng {minRevenue, pct}) — trống thì dùng bảng chung.
    ("kpiTiersOverride", "kpi_tiers_override", "json"),
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
                id BIGINT PRIMARY KEY,
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
    existing_columns = set(table_columns(conn, "employees"))
    # Frontend tạo mã hồ sơ bằng Date.now() (13 chữ số). PostgreSQL INTEGER chỉ có
    # 32-bit nên lần lưu hồ sơ trước đây có thể thất bại sau khi tài khoản đã được tạo,
    # để lại tài khoản mồ côi. BIGINT giữ nguyên mã cũ và an toàn cho nhiều năm vận hành.
    conn.execute("ALTER TABLE employees ALTER COLUMN id TYPE BIGINT")
    for _, db_col, kind in FIELD_SPEC:
        if db_col not in existing_columns:
            conn.execute(f"ALTER TABLE employees ADD COLUMN {db_col} {_SQL_TYPE[kind]}")

    conn.execute("UPDATE employees SET email = NULL WHERE email = ''")
    conn.execute("DROP INDEX IF EXISTS idx_employees_email")
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_email ON employees(email) WHERE email IS NOT NULL"
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_employees_account ON employees(account_id)")
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_account_unique "
        "ON employees(account_id) WHERE account_id IS NOT NULL"
    )


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
    result = {"id": row["id"], "account_id": row["account_id"], "user_id": row["account_id"]}
    for js_key, db_col, kind in FIELD_SPEC:
        result[js_key] = _from_db_value(kind, row[db_col])
    return result




def repair_account_links(conn):
    """Sửa quan hệ employees.account_id bằng khóa tài khoản thật.

    Ưu tiên email chuẩn hoá. Với dữ liệu legacy thiếu email, chỉ tự liên kết Kế toán
    khi cả hai phía đều có đúng một ứng viên duy nhất; không suy đoán mơ hồ.
    """
    conn.execute(
        """
        UPDATE employees
        SET account_id = (
            SELECT users.id FROM users
            WHERE LOWER(TRIM(users.username)) = LOWER(TRIM(employees.email))
            LIMIT 1
        ), updated_at = CURRENT_TIMESTAMP
        WHERE account_id IS NULL
          AND COALESCE(TRIM(email), '') <> ''
          AND EXISTS (
            SELECT 1 FROM users
            WHERE LOWER(TRIM(users.username)) = LOWER(TRIM(employees.email))
          )
        """
    )

    unlinked_accountants = conn.execute(
        """
        SELECT id FROM employees
        WHERE account_id IS NULL
          AND (
            LOWER(COALESCE(account_role, '')) = 'accountant'
            OR LOWER(COALESCE(role_type, '')) IN ('ke_toan', 'ketoan', 'accountant', 'finance')
            OR LOWER(COALESCE(position, '')) LIKE '%kế toán%'
            OR LOWER(COALESCE(dept, '')) LIKE '%tài chính%'
          )
        """
    ).fetchall()
    free_accounts = conn.execute(
        """
        SELECT u.id, u.username FROM users u
        LEFT JOIN employees e ON e.account_id = u.id
        WHERE u.role = 'accountant' AND u.active = 1 AND e.id IS NULL
        """
    ).fetchall()
    if len(unlinked_accountants) == 1 and len(free_accounts) == 1:
        employee_id = unlinked_accountants[0]["id"]
        account_id = free_accounts[0]["id"]
        email = str(free_accounts[0]["username"] or "").strip().lower()
        conn.execute(
            "UPDATE employees SET account_id = ?, email = COALESCE(NULLIF(email, ''), ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (account_id, email, employee_id),
        )


def list_employees(db_path):
    with connect(db_path) as conn:
        repair_account_links(conn)
        # Sắp xếp ổn định trực tiếp trên PostgreSQL để mọi màn hình dùng cùng một thứ tự.
        rows = conn.execute("SELECT * FROM employees ORDER BY LOWER(COALESCE(name, '')), id").fetchall()
    return [row_to_dict(row) for row in rows]


def _normalize_email(value):
    return (value or "").strip().lower()


def _account_id_for_email(conn, email):
    if not email:
        return None
    row = conn.execute("SELECT id FROM users WHERE username = ?", (email,)).fetchone()
    return row["id"] if row else None


def upsert_with_account(db_path, employee, password="", create_password=False):
    """Tạo/cập nhật hồ sơ và tài khoản liên kết trong cùng một DB transaction."""
    if not isinstance(employee, dict) or employee.get("id") is None:
        raise ValueError("Hồ sơ nhân sự không hợp lệ.")
    emp_id = int(employee["id"])
    email = _normalize_email(employee.get("email"))
    if not email:
        raise ValueError("Email đăng nhập là bắt buộc.")
    desired_role = _normalize_account_role(employee.get("accountRole"))
    if desired_role == "user" and _employee_is_accountant(employee):
        desired_role = "accountant"
    active = 0 if employee.get("status") == "inactive" else 1

    db_columns = [db_col for _, db_col, _ in FIELD_SPEC]
    insert_cols = ["id", "account_id"] + db_columns
    placeholders = ",".join("?" for _ in insert_cols)
    update_cols = ["account_id"] + db_columns
    update_clause = ",".join(f"{column} = ?" for column in update_cols)

    with connect(db_path) as conn:
        existing_user = conn.execute("SELECT * FROM users WHERE username = ?", (email,)).fetchone()
        if existing_user:
            account_id = existing_user["id"]
            if password:
                conn.execute(
                    "UPDATE users SET password_hash = ?, role = ?, active = ? WHERE id = ?",
                    (password_hash(password), desired_role, active, account_id),
                )
            else:
                conn.execute(
                    "UPDATE users SET role = ?, active = ? WHERE id = ?",
                    (desired_role, active, account_id),
                )
        else:
            if not password:
                raise ValueError("Cần mật khẩu tạm khi tạo tài khoản mới.")
            conn.execute(
                "INSERT INTO users (username, password_hash, role, active) VALUES (?, ?, ?, ?)",
                (email, password_hash(password), desired_role, active),
            )
            account_id = conn.execute("SELECT id FROM users WHERE username = ?", (email,)).fetchone()["id"]

        linked = conn.execute(
            "SELECT id FROM employees WHERE account_id = ? AND id <> ?",
            (account_id, emp_id),
        ).fetchone()
        if linked:
            raise ValueError("Tài khoản này đã liên kết với một hồ sơ nhân sự khác.")
        email_owner = conn.execute(
            "SELECT id FROM employees WHERE LOWER(COALESCE(email, '')) = ? AND id <> ?",
            (email, emp_id),
        ).fetchone()
        if email_owner:
            raise ValueError("Email này đang thuộc một hồ sơ nhân sự khác.")

        normalized_emp = dict(employee)
        normalized_emp["email"] = email
        normalized_emp["accountRole"] = desired_role
        db_values = []
        for js_key, _, kind in FIELD_SPEC:
            raw = email if js_key == "email" else normalized_emp.get(js_key)
            db_values.append(_to_db_value(kind, raw))
        exists = conn.execute("SELECT id FROM employees WHERE id = ?", (emp_id,)).fetchone()
        try:
            if exists:
                conn.execute(
                    f"UPDATE employees SET {update_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    [account_id, *db_values, emp_id],
                )
            else:
                conn.execute(
                    f"INSERT INTO employees ({','.join(insert_cols)}) VALUES ({placeholders})",
                    [emp_id, account_id, *db_values],
                )
        except DatabaseIntegrityError as exc:
            raise ValueError(f"Không thể lưu hồ sơ hoặc liên kết tài khoản: {exc}") from exc
    return list_employees(db_path)


def replace_all(db_path, employees):
    """Upsert hồ sơ nhân sự và đồng bộ users.role theo 3 quyền chuẩn.

    API cũ gửi toàn bộ danh sách từ frontend, nhưng máy chủ KHÔNG xóa những hồ sơ vắng
    mặt trong payload. Quy tắc này ngăn một tab trình duyệt cũ hoặc request tải lỗi xóa
    nhân sự vừa được người khác thêm. Xóa thật luôn đi qua delete_employee().
    """
    if not isinstance(employees, list):
        raise ValueError("employees phải là danh sách")

    db_columns = [db_col for _, db_col, _ in FIELD_SPEC]
    insert_cols = ["id", "account_id"] + db_columns
    placeholders = ",".join("?" for _ in insert_cols)
    update_cols = ["account_id"] + db_columns
    update_clause = ",".join(f"{column} = ?" for column in update_cols)

    with connect(db_path) as conn:
        existing_count = conn.execute("SELECT COUNT(*) AS total FROM employees").fetchone()["total"]
        if existing_count > 0 and len(employees) == 0:
            raise ValueError("Từ chối ghi danh sách nhân sự rỗng vì máy chủ đang có dữ liệu. Hãy xóa từng hồ sơ bằng chức năng Xóa nhân sự.")

        for emp in employees:
            if not isinstance(emp, dict) or emp.get("id") is None:
                continue
            emp_id = int(emp["id"])
            email = _normalize_email(emp.get("email"))
            explicit_account_id = emp.get("user_id", emp.get("account_id"))
            try:
                explicit_account_id = int(explicit_account_id) if explicit_account_id not in (None, "") else None
            except (TypeError, ValueError):
                explicit_account_id = None
            account_id = explicit_account_id or _account_id_for_email(conn, email)
            account = conn.execute("SELECT id, username, role FROM users WHERE id = ?", (account_id,)).fetchone() if account_id is not None else None
            if explicit_account_id is not None and not account:
                raise ValueError(f"Tài khoản liên kết không tồn tại cho hồ sơ {emp_id}.")
            if account:
                linked = conn.execute(
                    "SELECT id FROM employees WHERE account_id = ? AND id <> ?",
                    (account_id, emp_id),
                ).fetchone()
                if linked:
                    raise ValueError("Một tài khoản không thể liên kết với hai hồ sơ nhân sự.")
                account_email = _normalize_email(account["username"])
                if not email:
                    email = account_email
                elif account_email and email != account_email:
                    raise ValueError("Email hồ sơ không khớp tài khoản đã liên kết.")
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
            db_values = []
            for js_key, _, kind in FIELD_SPEC:
                raw = (email or None) if js_key == "email" else normalized_emp.get(js_key)
                db_values.append(_to_db_value(kind, raw))

            try:
                exists = conn.execute("SELECT id FROM employees WHERE id = ?", (emp_id,)).fetchone()
                if exists:
                    conn.execute(
                        f"UPDATE employees SET {update_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                        [account_id, *db_values, emp_id],
                    )
                else:
                    conn.execute(
                        f"INSERT INTO employees ({','.join(insert_cols)}) VALUES ({placeholders})",
                        [emp_id, account_id, *db_values],
                    )
            except DatabaseIntegrityError:
                raise ValueError(f"Email nhân sự bị trùng: {email or '(trống)'}")

            if account_id is not None:
                conn.execute("UPDATE users SET role = ? WHERE id = ?", (desired_role, account_id))

    return list_employees(db_path)

def link_account(db_path, employee_id, account_id):
    """Liên kết một tài khoản với đúng một hồ sơ nhân sự trong transaction."""
    try:
        employee_id = int(employee_id)
        account_id = int(account_id)
    except (TypeError, ValueError) as exc:
        raise ValueError("Mã hồ sơ hoặc tài khoản không hợp lệ.") from exc
    with connect(db_path) as conn:
        employee = conn.execute("SELECT id, email FROM employees WHERE id = ?", (employee_id,)).fetchone()
        account = conn.execute("SELECT id, username, role FROM users WHERE id = ?", (account_id,)).fetchone()
        if not employee:
            raise ValueError("Không tìm thấy hồ sơ nhân sự cần liên kết.")
        if not account:
            raise ValueError("Không tìm thấy tài khoản cần liên kết.")
        duplicate = conn.execute(
            "SELECT id FROM employees WHERE account_id = ? AND id <> ?",
            (account_id, employee_id),
        ).fetchone()
        if duplicate:
            raise ValueError("Tài khoản này đã liên kết với một hồ sơ nhân sự khác.")
        email = _normalize_email(account["username"])
        email_owner = conn.execute(
            "SELECT id FROM employees WHERE LOWER(COALESCE(email, '')) = ? AND id <> ?",
            (email, employee_id),
        ).fetchone()
        if email_owner:
            raise ValueError("Email tài khoản đang thuộc một hồ sơ nhân sự khác.")
        conn.execute(
            "UPDATE employees SET account_id = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (account_id, email or None, employee_id),
        )
    return list_employees(db_path)


def unlink_account(db_path, employee_id):
    try:
        employee_id = int(employee_id)
    except (TypeError, ValueError) as exc:
        raise ValueError("Mã hồ sơ không hợp lệ.") from exc
    with connect(db_path) as conn:
        conn.execute(
            "UPDATE employees SET account_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (employee_id,),
        )
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
                "SELECT id, username, role, active FROM users WHERE id = ?",
                (account_id,),
            ).fetchone()
            if account and _normalize_email(account["username"]) == _normalize_email(current_user_email):
                raise ValueError("Không thể tự xóa hồ sơ và tài khoản đang dùng để đăng nhập.")

            if account and _normalize_account_role(account["role"]) == "admin" and bool(account["active"]):
                other_active_admins = conn.execute(
                    "SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND active = 1 AND id <> ?",
                    (account_id,),
                ).fetchone()["total"]
                if other_active_admins < 1:
                    raise ValueError("Không thể xóa Sếp đang hoạt động cuối cùng. Hãy tạo hoặc mở khóa một tài khoản Sếp khác trước.")

        conn.execute("DELETE FROM employees WHERE id = ?", (employee_id,))
        if account_id is not None:
            # Các bảng chat/sessions có ON DELETE CASCADE; xóa tài khoản sẽ dọn dữ liệu liên kết.
            conn.execute("DELETE FROM users WHERE id = ?", (account_id,))

    return list_employees(db_path)

