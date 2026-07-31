from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import argparse
import json
import mimetypes
import ssl
import calendar
import traceback
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from config import CORS_ORIGIN, DEFAULT_DB_TARGET, DIST_DIR, MAX_REQUEST_BODY_BYTES
from db.connection import database_backend, database_identity, require_postgres_target
from db.schema import init_db
from db.state_store import read_state, update_state
from routes import dispatch
from services import auth_service, chat_service, email_service, employee_service, inventory_expiry_service, password_reset_service, registration_service, user_service
from services.business_sync_service import reconcile_company_data


def _query_int(query, key, default=0):
    try:
        return int(query.get(key, [default])[0] or default)
    except (TypeError, ValueError):
        return default


def _task_visible_to_user(task, employee_emails, user):
    if not isinstance(task, dict):
        return False
    if task.get("visibility") != "private":
        return True
    employee_email = employee_emails.get(str(task.get("employeeId")), "")
    return employee_email == (user.get("email") or "").strip().lower()


PAYROLL_WORKFLOW_FIELDS = ("payrollApprovals", "midMonthRequests", "payrollPayments")
# Ma trận dữ liệu theo 3 quyền chuẩn lưu tại users.role trong PostgreSQL:
# admin và accountant = toàn quyền vận hành; user = khu vực cá nhân.
# accountant vẫn tách riêng để lưu đúng cấp thẩm định trong luồng lương.
ACCOUNTANT_WRITABLE_STATE_FIELDS = {
    "transactions", "orders", "customers", "debts", "fixedAssets", "capitalContributions",
    "distributionPartners", "distributionOrders", "distributionSettlements",
    "inventory", "stockMovements", "contracts", "marketingLogs", "marketingPages",
    "supportCases", "leads", "payrollApprovals", "midMonthRequests", "payrollPayments",
    "paymentLedger",
}
USER_READABLE_STATE_FIELDS = {
    "lang", "company", "announcements", "unlockedMonths", "tasks",
    "payrollApprovals", "midMonthRequests", "payrollPayments", "kpiTiers",
    # Nhân viên được xem toàn bộ danh mục Kho hàng ở chế độ chỉ đọc.
    "inventory", "attendanceRequests",
    # Chỉ các bản ghi thuộc chính nhân viên được giữ lại để tính lương tham chiếu.
    "transactions", "orders", "marketingLogs", "supportCases",
}
SAFE_COMPANY_FIELDS = {
    "name", "address", "phone", "email", "taxCode", "representative",
    "establishedDate", "registeredCharterCapital", "openingCashBalance", "taskReminderIntervalHours",
    "directorPasswordConfigured", "directorPasswordConfiguredAt",
}
APPROVED_PAYROLL_STATUSES = {"cho_ke_toan_chi_tra", "da_duyet_cho_thanh_toan"}
PAYROLL_PROPOSAL_NUMBER_FIELDS = {
    "requestedWorkDays", "requestedBaseSalary", "requestedDailySalary",
    "requestedSalaryByDays", "requestedBonus", "requestedAllowance",
    "requestedInsuranceDeduction", "requestedTaxDeduction",
    "requestedAdvanceDeduction", "requestedOtherDeduction", "requestedDeduction",
}
PAYROLL_PROPOSAL_TEXT_FIELDS = {"proposalReason", "proposalDetails", "proposalNote", "varianceReason"}
SELF_PROFILE_FIELDS = {"avatarData", "avatarName", "avatarType"}
EMPLOYEE_PRIVATE_FIELDS = {
    "baseSalary", "dailySalary", "bonusTarget", "kpi", "contractType", "probationRate", "dependents",
    "mealAllowance", "attendanceBonus", "otherBonus", "advance", "attendance",
    "salesTarget", "salesActual", "dealsClosed", "leadsHandled", "adSpend", "adRevenue",
    "conversions", "ctr", "tasksAssigned", "tasksCompleted", "tasksOnTime", "bugsFixed",
    "upsaleValue", "dob", "hometown", "bankName", "bankAccount", "phone", "idNumber",
    "attendanceTimes",
    "education", "major", "resumeSummary", "idFrontData", "idFrontName", "idFrontType",
    "idBackData", "idBackName", "idBackType", "resumeFileData", "resumeFileName",
    "resumeFileType",
}


def _normalized_email(value):
    return (value or "").strip().lower()


def _normalized_account_role(role):
    value = str(role or "").strip().lower()
    if value in {"admin", "boss"}:
        return "admin"
    if value == "accountant":
        return "accountant"
    return "user"


def _is_admin(user):
    return _normalized_account_role(user.get("role")) == "admin"


def _is_accountant_account(user):
    return _normalized_account_role(user.get("role")) == "accountant"


def _is_full_admin(user):
    return _normalized_account_role(user.get("role")) in {"admin", "accountant"}


def _normalized_role_text(value):
    import unicodedata

    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    text = text.replace("đ", "d").replace("Đ", "D").lower()
    return " ".join("".join(char if char.isalnum() else " " for char in text).split())


def _employee_is_accountant(employee):
    if not employee or employee.get("status") == "inactive":
        return False
    role_token = _normalized_role_text(employee.get("roleType")).replace(" ", "_")
    if role_token in {"ke_toan", "ketoan", "accountant", "accounting", "finance"}:
        return True
    description = _normalized_role_text(
        f"{employee.get('position') or ''} {employee.get('dept') or ''}"
    )
    return any(token in description for token in ("ke toan", "tai chinh", "accountant", "accounting", "finance"))


POSITION_PERMISSIONS = {
    "ads": {"marketing_write": True, "inventory_scope": "assigned", "inventory_write": True},
    "sale": {"marketing_write": True, "inventory_scope": "assigned", "inventory_write": True},
    "ky_thuat": {"inventory_scope": "assigned", "inventory_write": True},
    "it": {"inventory_scope": "assigned", "inventory_write": True},
    "ke_toan": {"inventory_scope": "all", "inventory_write": True},
    "nhan_su": {"inventory_scope": "none", "inventory_write": False},
    "van_hanh": {"inventory_scope": "assigned", "inventory_write": True},
    "cskh": {"inventory_scope": "all_read", "inventory_write": False},
    "quan_ly": {"inventory_scope": "all_read", "inventory_write": False},
    "khac": {"inventory_scope": "none", "inventory_write": False},
}

LEAD_SOURCES = {"marketing_ads", "pancake", "tu_tim", "gioi_thieu", "khac"}
LEAD_STATUSES = {"dang_cham_soc", "tu_choi"}
LEAD_CONTACT_TYPES = {"call", "message", "facebook", "zalo", "shopee", "instagram", "support"}


def _employee_position_role(employee):
    if not employee or employee.get("status") == "inactive":
        return "khac"
    token = _normalized_role_text(employee.get("roleType")).replace(" ", "_")
    aliases = {
        "marketing": "ads", "marketing_ads": "ads", "ads": "ads",
        "sale": "sale", "kinh_doanh": "sale",
        "ky_thuat": "ky_thuat", "ho_tro_ky_thuat": "ky_thuat",
        "it": "it", "phat_trien_phan_mem": "it",
        "ke_toan": "ke_toan", "tai_chinh": "ke_toan",
        "nhan_su": "nhan_su", "hr": "nhan_su",
        "van_hanh": "van_hanh", "cskh": "cskh", "cham_soc_khach_hang": "cskh",
        "quan_ly": "quan_ly", "ban_giam_doc": "quan_ly", "khac": "khac",
    }
    return aliases.get(token, token if token in POSITION_PERMISSIONS else "khac")


def _employee_position_permissions(employee):
    return POSITION_PERMISSIONS.get(_employee_position_role(employee), POSITION_PERMISSIONS["khac"])


def _employee_context(db_path, user):
    email = _normalized_email(user.get("email"))
    user_id = user.get("id")
    employees = employee_service.list_employees(db_path)
    employee = None
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        user_id = None
    if user_id is not None:
        employee = next(
            (
                item for item in employees
                if item.get("account_id") is not None and int(item.get("account_id")) == user_id
            ),
            None,
        )
    if employee is None:
        employee = next((item for item in employees if _normalized_email(item.get("email")) == email), None)
    return employees, employee, (_is_accountant_account(user) or _employee_is_accountant(employee))


def _effective_user(db_path, user, persist=True):
    """Trả quyền chuẩn admin/accountant/user và đồng bộ tài khoản Kế toán cũ.

    users.role là nguồn quyền chính. Tài khoản user liên kết với hồ sơ thuộc
    Kế toán/Tài chính được nâng thành accountant để database và giao diện thống nhất.
    """
    if not user:
        return user
    effective = dict(user)
    normalized_role = _normalized_account_role(effective.get("role"))
    if normalized_role == "admin":
        effective["role"] = "admin"
        return effective
    if normalized_role == "accountant":
        effective["role"] = "accountant"
        return effective

    try:
        _employees, employee, profile_is_accountant = _employee_context(db_path, effective)
    except Exception:
        employee, profile_is_accountant = None, False

    if profile_is_accountant or _employee_is_accountant(employee):
        effective["role"] = "accountant"
        if persist and effective.get("email"):
            try:
                user_service.update_role(db_path, effective.get("email"), "accountant")
            except (ValueError, OSError):
                pass
    else:
        effective["role"] = "user"
        if persist and effective.get("email") and normalized_role != "user":
            try:
                user_service.update_role(db_path, effective.get("email"), "user")
            except (ValueError, OSError):
                pass
    return effective


def _record_employee_id(record):
    if not isinstance(record, dict):
        return None
    try:
        return int(record.get("employeeId"))
    except (TypeError, ValueError):
        return None


def _record_period_key(record):
    employee_id = _record_employee_id(record)
    if employee_id is None or not isinstance(record, dict):
        return None
    try:
        return employee_id, int(record.get("year")), int(record.get("month"))
    except (TypeError, ValueError):
        return None


def _own_records(records, employee_id):
    if not isinstance(records, list) or employee_id is None:
        return []
    return [item for item in records if _record_employee_id(item) == employee_id]


def _filter_payroll_data_for_user(db_path, data, user):
    if not isinstance(data, dict) or _is_admin(user):
        return data
    _, employee, is_accountant = _employee_context(db_path, user)
    if is_accountant:
        return data
    employee_id = int(employee["id"]) if employee else None
    filtered = dict(data)
    for field in PAYROLL_WORKFLOW_FIELDS:
        filtered[field] = _own_records(data.get(field), employee_id)

    # Phiếu chi lương cũng là dữ liệu lương. Tài khoản user chỉ nhận phiếu của chính mình;
    # giao dịch khác vẫn giữ nguyên để không làm thay đổi các quyền vận hành hiện có.
    own_mid_ids = {
        int(item.get("id")) for item in filtered.get("midMonthRequests", [])
        if isinstance(item, dict) and item.get("id") is not None
    }
    transactions = data.get("transactions")
    if isinstance(transactions, list):
        visible_transactions = []
        for tx in transactions:
            # Nhân viên không nhận dữ liệu Thu Chi chung của công ty. Chỉ phiếu/giao dịch
            # lương và khoản thu/chi được gắn trực tiếp với chính họ mới được trả về.
            if not isinstance(tx, dict):
                continue
            source_id = tx.get("sourceOrderId")
            try:
                source_id = int(source_id)
            except (TypeError, ValueError):
                source_id = None
            is_own_payroll = tx.get("source") == "bangluong" and (source_id == employee_id or source_id in own_mid_ids)
            is_own_operating_entry = _record_belongs_to_employee(
                tx, employee_id, "employeeId", "assignedEmployeeId", "sourceEmployeeId"
            )
            if is_own_payroll or is_own_operating_entry:
                visible_transactions.append(tx)
        filtered["transactions"] = visible_transactions
    return filtered


def filter_employees_for_user(db_path, employees, user):
    if _is_full_admin(user):
        return employees
    _, current_employee, is_accountant = _employee_context(db_path, user)
    if is_accountant:
        return employees
    current_id = int(current_employee["id"]) if current_employee else None
    result = []
    for employee in employees:
        if current_id is not None and int(employee.get("id", -1)) == current_id:
            result.append(employee)
            continue
        redacted = dict(employee)
        for field in EMPLOYEE_PRIVATE_FIELDS:
            value = redacted.get(field)
            redacted[field] = {} if field == "attendance" else ("" if isinstance(value, str) else 0)
        result.append(redacted)
    return result


def _safe_company(company):
    if not isinstance(company, dict):
        return company
    return {key: company.get(key) for key in SAFE_COMPANY_FIELDS if key in company}


def _public_company_for_admin(company):
    """Admin được xem cấu hình công ty nhưng tuyệt đối không nhận hash mật khẩu."""
    if not isinstance(company, dict):
        return company
    result = dict(company)
    result.pop("directorPassword", None)
    result.pop("directorPasswordHash", None)
    result["directorPasswordConfigured"] = bool(company.get("directorPasswordHash") or company.get("directorPasswordConfigured"))
    return result


def _record_belongs_to_employee(record, employee_id, *field_names):
    if employee_id is None or not isinstance(record, dict):
        return False
    for field in field_names:
        try:
            if int(record.get(field)) == int(employee_id):
                return True
        except (TypeError, ValueError):
            continue
    return False


def _user_visible_data(db_path, data, user):
    _, employee, _ = _employee_context(db_path, user)
    employee_id = int(employee["id"]) if employee else None
    position_role = _employee_position_role(employee)
    permissions = _employee_position_permissions(employee)

    readable_fields = set(USER_READABLE_STATE_FIELDS)
    if position_role in {"ads", "sale", "quan_ly"}:
        readable_fields.update({"marketingLogs", "marketingPages", "leads"})
    if position_role in {"nhan_su", "quan_ly"}:
        readable_fields.update({"cvReviews", "supportCases"})
    if position_role in {"van_hanh", "quan_ly"}:
        readable_fields.update({"contracts"})
    if position_role in {"cskh", "ky_thuat", "van_hanh", "sale", "quan_ly"}:
        readable_fields.update({"supportCases"})
    if position_role == "quan_ly":
        readable_fields.update({"customers", "debts"})

    filtered = {field: data.get(field) for field in readable_fields if field in data}
    filtered = _filter_payroll_data_for_user(db_path, filtered, user)
    if "company" in filtered:
        filtered["company"] = _safe_company(filtered.get("company"))

    employee_emails = employee_service.employee_emails_by_id(db_path)
    tasks = data.get("tasks")
    if isinstance(tasks, list):
        filtered["tasks"] = [
            task for task in tasks
            if _record_belongs_to_employee(task, employee_id, "employeeId")
            or (employee_id is None and _task_visible_to_user(task, employee_emails, user))
        ]

    inventory = data.get("inventory")
    if isinstance(inventory, list):
        scope = permissions.get("inventory_scope", "none")
        if scope in {"all", "all_read"}:
            filtered["inventory"] = inventory
        elif scope == "assigned" and employee_id is not None:
            filtered["inventory"] = [
                item for item in inventory
                if _record_belongs_to_employee(item, employee_id, "assignedEmployeeId")
            ]
        else:
            filtered["inventory"] = []

    orders = data.get("orders")
    if isinstance(orders, list):
        if position_role in {"ads", "quan_ly"}:
            filtered["orders"] = orders
        else:
            filtered["orders"] = [item for item in orders if _record_belongs_to_employee(item, employee_id, "saleEmployeeId", "employeeId")]

    marketing_logs = data.get("marketingLogs")
    if isinstance(marketing_logs, list):
        if position_role in {"ads", "sale", "quan_ly"}:
            filtered["marketingLogs"] = marketing_logs
        else:
            filtered["marketingLogs"] = [item for item in marketing_logs if _record_belongs_to_employee(item, employee_id, "employeeId")]

    leads = data.get("leads")
    if isinstance(leads, list):
        if position_role == "quan_ly":
            filtered["leads"] = leads
        elif position_role == "ads":
            filtered["leads"] = [
                item for item in leads
                if isinstance(item, dict) and str(item.get("source") or "") in {"marketing_ads", "pancake"}
            ]
        elif position_role == "sale":
            filtered["leads"] = [
                item for item in leads
                if _record_belongs_to_employee(item, employee_id, "saleEmployeeId")
            ]

    support_cases = data.get("supportCases")
    if isinstance(support_cases, list):
        if position_role in {"cskh", "quan_ly"}:
            filtered["supportCases"] = support_cases
        else:
            filtered["supportCases"] = [item for item in support_cases if _record_belongs_to_employee(item, employee_id, "employeeId", "assignedEmployeeId", "supportEmployeeId")]

    attendance_requests = data.get("attendanceRequests")
    if isinstance(attendance_requests, list):
        filtered["attendanceRequests"] = [
            item for item in attendance_requests
            if _record_belongs_to_employee(item, employee_id, "employeeId")
        ]
    return filtered


def filter_state_for_user(db_path, state, user):
    if not state:
        return state
    data = state.get("data")
    if not isinstance(data, dict):
        return state

    role = _normalized_account_role(user.get("role"))
    if role in {"admin", "accountant"}:
        filtered_data = dict(data)
        if "company" in filtered_data:
            filtered_data["company"] = _public_company_for_admin(filtered_data.get("company"))
        if role == "accountant":
            filtered_data.pop("securityAuditLog", None)
    elif _employee_context(db_path, user)[2]:
        # Hồ sơ nhân sự Kế toán/Tài chính được đồng bộ về role accountant:
        # chỉ được đọc dữ liệu nghiệp vụ, không nhận cấu hình quản trị nhạy cảm.
        filtered_data = dict(data)
        if "company" in filtered_data:
            filtered_data["company"] = _safe_company(filtered_data.get("company"))
    else:
        filtered_data = _user_visible_data(db_path, data, user)

    filtered_state = dict(state)
    filtered_state["data"] = filtered_data
    return filtered_state

def _index_records(records):
    result = {}
    for item in records if isinstance(records, list) else []:
        if not isinstance(item, dict) or item.get("id") is None:
            continue
        result[str(item.get("id"))] = item
    return result


TASK_COMPLETION_META_FIELDS = {
    "completionSubmittedAt", "completionSubmittedByEmail", "completionSubmittedByName",
    "completionReviewedAt", "completionReviewedByEmail", "completionReviewedByName",
    "completionReturnReason", "completionReturnedAt", "completionReturnedByEmail", "completionReturnedByName",
}


def _merge_task_review_updates(old_tasks, incoming_tasks, user, employee, is_accountant):
    if not isinstance(old_tasks, list):
        return old_tasks
    incoming_by_id = _index_records(incoming_tasks)
    try:
        employee_id = int(employee.get("id")) if employee else None
    except (TypeError, ValueError):
        employee_id = None
    reviewer = is_accountant or _is_admin(user)
    merged = []
    for old in old_tasks:
        if not isinstance(old, dict) or old.get("id") is None:
            merged.append(old)
            continue
        candidate = incoming_by_id.get(str(old.get("id")))
        if not isinstance(candidate, dict):
            merged.append(old)
            continue
        updated = dict(old)
        next_status = str(candidate.get("completionStatus") or "").strip()
        if reviewer and next_status in {"approved", "returned"}:
            updated["completionStatus"] = next_status
            updated["doneManual"] = next_status == "approved"
            for field in TASK_COMPLETION_META_FIELDS:
                if field in candidate:
                    updated[field] = candidate[field]
        elif employee_id is not None and _record_employee_id(old) == employee_id and next_status == "submitted":
            updated["completionStatus"] = "submitted"
            updated["doneManual"] = False
            for field in ("completionSubmittedAt", "completionSubmittedByEmail", "completionSubmittedByName"):
                if field in candidate:
                    updated[field] = candidate[field]
            for field in ("completionReviewedAt", "completionReviewedByEmail", "completionReviewedByName"):
                updated.pop(field, None)
        merged.append(updated)
    return merged


ATTENDANCE_CODE_VALUES = {"X": 1.0, "P": 0.5, "N": 0.0, "K": 0.0, "L": 1.0, "O": 1.0, "CN": 0.0}


def _standard_work_days(year, month):
    try:
        year, month = int(year), int(month)
        days = calendar.monthrange(year, month)[1]
    except (TypeError, ValueError, calendar.IllegalMonthError):
        return 0
    return sum(1 for day in range(1, days + 1) if calendar.weekday(year, month, day) != 6)


def _employee_system_payroll_inputs(employee, year, month):
    if not isinstance(employee, dict):
        return {"requestedWorkDays": 0.0, "requestedDailySalary": 0.0}
    try:
        year, month = int(year), int(month)
    except (TypeError, ValueError):
        return {"requestedWorkDays": 0.0, "requestedDailySalary": 0.0}
    month_key = f"{year}-{month:02d}"
    attendance = employee.get("attendance") if isinstance(employee.get("attendance"), dict) else {}
    month_record = attendance.get(month_key) if isinstance(attendance.get(month_key), dict) else {}
    work_days = 0.0
    for code in month_record.values():
        work_days += ATTENDANCE_CODE_VALUES.get(str(code or "").upper(), 0.0)
    try:
        daily_salary = max(0.0, float(employee.get("dailySalary") or 0))
    except (TypeError, ValueError):
        daily_salary = 0.0
    if daily_salary <= 0:
        try:
            base_salary = max(0.0, float(employee.get("baseSalary") or 0))
        except (TypeError, ValueError):
            base_salary = 0.0
        standard_days = _standard_work_days(year, month)
        daily_salary = base_salary / standard_days if standard_days > 0 else 0.0
    return {"requestedWorkDays": work_days, "requestedDailySalary": daily_salary}


def _proposal_fields(record, old=None):
    """Chuẩn hóa đúng công thức hồ sơ do nhân viên nhập.

    Lương kỳ = số ngày công đề nghị × đơn giá một ngày.
    Tổng thực nhận = lương kỳ + thưởng + phụ cấp - các khoản khấu trừ.
    """
    fallback = old or {}
    source = record if isinstance(record, dict) else {}

    def non_negative_number(field, default=0):
        value = source.get(field, fallback.get(field, default))
        try:
            return max(0.0, float(value or 0))
        except (TypeError, ValueError):
            try:
                return max(0.0, float(fallback.get(field, default) or 0))
            except (TypeError, ValueError):
                return max(0.0, float(default or 0))

    requested_work_days = non_negative_number("requestedWorkDays")
    # requestedBaseSalary là tên cũ. Từ bản này nó chỉ còn là alias của đơn giá/ngày
    # để dữ liệu đã lưu ở các phiên bản trước vẫn đọc được.
    daily_raw = source.get(
        "requestedDailySalary",
        source.get(
            "requestedBaseSalary",
            fallback.get("requestedDailySalary", fallback.get("requestedBaseSalary", 0)),
        ),
    )
    try:
        requested_daily_salary = max(0.0, float(daily_raw or 0))
    except (TypeError, ValueError):
        requested_daily_salary = 0.0
    requested_salary_by_days = requested_work_days * requested_daily_salary
    requested_bonus = non_negative_number("requestedBonus")
    requested_allowance = non_negative_number("requestedAllowance")

    deduction_breakdown_fields = (
        "requestedInsuranceDeduction",
        "requestedTaxDeduction",
        "requestedAdvanceDeduction",
        "requestedOtherDeduction",
    )
    has_breakdown = any(
        field in source or field in fallback
        for field in deduction_breakdown_fields
    )
    requested_insurance = non_negative_number("requestedInsuranceDeduction") if has_breakdown else 0.0
    requested_tax = non_negative_number("requestedTaxDeduction") if has_breakdown else 0.0
    requested_advance = non_negative_number("requestedAdvanceDeduction") if has_breakdown else 0.0
    requested_other = (
        non_negative_number("requestedOtherDeduction")
        if has_breakdown
        else non_negative_number("requestedDeduction")
    )
    requested_deduction = requested_insurance + requested_tax + requested_advance + requested_other

    result = {
        "requestedWorkDays": requested_work_days,
        "requestedDailySalary": requested_daily_salary,
        "requestedBaseSalary": requested_daily_salary,
        "requestedSalaryByDays": requested_salary_by_days,
        "requestedBonus": requested_bonus,
        "requestedAllowance": requested_allowance,
        "requestedInsuranceDeduction": requested_insurance,
        "requestedTaxDeduction": requested_tax,
        "requestedAdvanceDeduction": requested_advance,
        "requestedOtherDeduction": requested_other,
        "requestedDeduction": requested_deduction,
    }
    for field in PAYROLL_PROPOSAL_TEXT_FIELDS:
        value = source.get(field, fallback.get(field, ""))
        result[field] = str(value or "").strip()[:5000]
    result["amount"] = max(
        0.0,
        requested_salary_by_days
        + requested_bonus
        + requested_allowance
        - requested_deduction,
    )
    return result


def _sanitize_employee_submission(record, user, employee, old=None):
    now_record = old or {}
    employee_id = int(employee["id"])
    year = int(record.get("year") or now_record.get("year") or 0)
    month = int(record.get("month") or now_record.get("month") or 0)
    proposal = _proposal_fields(record, now_record)
    system_inputs = _employee_system_payroll_inputs(employee, year, month)
    proposal["requestedWorkDays"] = system_inputs["requestedWorkDays"]
    proposal["requestedDailySalary"] = system_inputs["requestedDailySalary"]
    proposal["requestedBaseSalary"] = system_inputs["requestedDailySalary"]
    proposal["requestedSalaryByDays"] = system_inputs["requestedWorkDays"] * system_inputs["requestedDailySalary"]
    proposal["amount"] = max(0.0, proposal["requestedSalaryByDays"] + proposal["requestedBonus"] + proposal["requestedAllowance"] - proposal["requestedDeduction"])
    return {
        **now_record,
        **proposal,
        "id": record.get("id") if old is None else old.get("id"),
        "employeeId": employee_id,
        "year": year,
        "month": month,
        "systemWorkDaysAtSubmit": system_inputs["requestedWorkDays"],
        "systemDailySalaryAtSubmit": system_inputs["requestedDailySalary"],
        "systemReferenceAtSubmit": max(0.0, float(record.get("systemReferenceAtSubmit") or proposal["amount"] or 0)),
        "systemReferenceCapturedAt": str(record.get("systemReferenceCapturedAt") or datetime.now(timezone.utc).isoformat()),
        "status": "cho_ke_toan_duyet",
        "submittedAt": record.get("submittedAt") or now_record.get("submittedAt"),
        "submittedByEmail": _normalized_email(user.get("email")),
        "submittedByName": record.get("submittedByName") or now_record.get("submittedByName") or user.get("email"),
        "accountantApprovedAt": None,
        "accountantApprovedByEmail": None,
        "accountantApprovedByName": None,
        "accountantSignature": None,
        "bossApprovedAt": None,
        "bossApprovedByEmail": None,
        "bossApprovedByName": None,
        "bossSignature": None,
        "returnedByBoss": False,
        "returnReason": "",
        "approvalHistory": record.get("approvalHistory") if isinstance(record.get("approvalHistory"), list) else now_record.get("approvalHistory", []),
    }


def _merge_regular_payroll_approvals(existing_records, incoming_records, user, employee):
    employee_id = int(employee["id"]) if employee else None
    existing = _index_records(existing_records)
    incoming = _index_records(incoming_records)
    result = [item for item in existing.values() if _record_employee_id(item) != employee_id]
    own_existing = [item for item in existing.values() if _record_employee_id(item) == employee_id]
    handled = set()
    for old in own_existing:
        key = str(old.get("id"))
        new = incoming.get(key)
        handled.add(key)
        if not new:
            result.append(old)  # Nhân viên không được xóa hồ sơ lương.
            continue
        can_resubmit_returned = old.get("status") == "tra_ve_nhan_vien" and new.get("status") == "cho_ke_toan_duyet"
        can_update_before_accountant = (
            old.get("status") == "cho_ke_toan_duyet"
            and new.get("status") == "cho_ke_toan_duyet"
            and not old.get("returnedByBoss")
            and not old.get("accountantApprovedAt")
        )
        if can_resubmit_returned or can_update_before_accountant:
            result.append(_sanitize_employee_submission(new, user, employee, old))
        else:
            result.append(old)
    for key, new in incoming.items():
        if key in handled or _record_employee_id(new) != employee_id:
            continue
        if new.get("status") == "cho_ke_toan_duyet":
            result.append(_sanitize_employee_submission(new, user, employee))
    return result


def _merge_accountant_approvals(existing_records, incoming_records):
    existing = _index_records(existing_records)
    incoming = _index_records(incoming_records)
    result = []
    for key, old in existing.items():
        new = incoming.get(key)
        if not new:
            result.append(old)  # Kế toán không được xóa hồ sơ.
            continue
        old_status = old.get("status")
        new_status = new.get("status")
        if old_status == "cho_ke_toan_duyet" and new_status in {"cho_sep_xac_nhan", "tra_ve_nhan_vien"}:
            # Kế toán chỉ đổi trạng thái và ghi dấu người xử lý. Toàn bộ nội dung/số tiền
            # do nhân viên nhập trong form được giữ nguyên tuyệt đối.
            updated = {**old, **_proposal_fields(old, old)}
            if new_status == "cho_sep_xac_nhan":
                updated.update({
                    "status": "cho_sep_xac_nhan",
                    "returnedByBoss": False,
                    "returnReason": "",
                    "accountantApprovedAt": new.get("accountantApprovedAt"),
                    "accountantApprovedByEmail": new.get("accountantApprovedByEmail"),
                    "accountantApprovedByName": new.get("accountantApprovedByName"),
                    "accountantSignature": new.get("accountantSignature"),
                    "approvalHistory": new.get("approvalHistory") if isinstance(new.get("approvalHistory"), list) else old.get("approvalHistory", []),
                })
            else:
                reason = str(new.get("returnReason") or "").strip()
                if not reason:
                    result.append(old)
                    continue
                updated.update({
                    "status": "tra_ve_nhan_vien",
                    "returnedByBoss": False,
                    "returnReason": reason,
                    "returnedAt": new.get("returnedAt"),
                    "returnedByEmail": new.get("returnedByEmail"),
                    "returnedByName": new.get("returnedByName"),
                    "approvalHistory": new.get("approvalHistory") if isinstance(new.get("approvalHistory"), list) else old.get("approvalHistory", []),
                })
            result.append(updated)
        else:
            result.append(old)
    return result


def _merge_admin_approvals(existing_records, incoming_records):
    """Admin chỉ xử lý hồ sơ đã được Kế toán chuyển lên.

    Được phép:
    - cho_sep_xac_nhan -> da_duyet_cho_thanh_toan (duyệt và đóng dấu)
    - cho_sep_xac_nhan -> cho_ke_toan_duyet (không duyệt, trả Kế toán kèm lý do)
    - xóa hồ sơ đã đóng dấu.

    Không được tạo hồ sơ mới, sửa số tiền, duyệt thay Kế toán hoặc xóa hồ sơ đang chờ.
    """
    existing = _index_records(existing_records)
    incoming = _index_records(incoming_records)
    result = []
    for key, old in existing.items():
        new = incoming.get(key)
        old_status = old.get("status")
        if not new:
            if old_status in APPROVED_PAYROLL_STATUSES:
                continue  # Admin được xóa đề xuất đã đóng dấu.
            result.append(old)
            continue

        if old_status != "cho_sep_xac_nhan":
            result.append(old)
            continue

        new_status = new.get("status")
        if new_status == "da_duyet_cho_thanh_toan":
            updated = {**old, **_proposal_fields(old, old)}
            updated.update({
                "status": "da_duyet_cho_thanh_toan",
                "bossApprovedAt": new.get("bossApprovedAt"),
                "bossApprovedByEmail": new.get("bossApprovedByEmail"),
                "bossApprovedByName": new.get("bossApprovedByName"),
                "bossSignature": new.get("bossSignature"),
                "approvalHistory": new.get("approvalHistory") if isinstance(new.get("approvalHistory"), list) else old.get("approvalHistory", []),
            })
            result.append(updated)
            continue

        reason = str(new.get("returnReason") or "").strip()
        if new_status == "cho_ke_toan_duyet" and bool(new.get("returnedByBoss")) and reason:
            updated = {**old, **_proposal_fields(old, old)}
            updated.update({
                "status": "cho_ke_toan_duyet",
                "returnedByBoss": True,
                "returnReason": reason,
                "returnedAt": new.get("returnedAt"),
                "returnedByEmail": new.get("returnedByEmail"),
                "returnedByName": new.get("returnedByName"),
                "accountantApprovedAt": None,
                "accountantApprovedByEmail": None,
                "accountantApprovedByName": None,
                "accountantSignature": None,
                "approvalHistory": new.get("approvalHistory") if isinstance(new.get("approvalHistory"), list) else old.get("approvalHistory", []),
            })
            result.append(updated)
            continue

        result.append(old)
    return result


def _merge_regular_mid_month(existing_records, incoming_records, user, employee_id):
    existing = _index_records(existing_records)
    incoming = _index_records(incoming_records)
    result = [item for item in existing.values() if _record_employee_id(item) != employee_id]
    own_existing = [item for item in existing.values() if _record_employee_id(item) == employee_id]
    handled = set()
    for old in own_existing:
        key = str(old.get("id"))
        new = incoming.get(key)
        handled.add(key)
        if not new:
            # Được hủy yêu cầu khi Kế toán chưa xử lý; sau đó chỉ Admin mới được xóa.
            if old.get("status") == "cho_ke_toan_duyet" and not old.get("accountantApprovedAt"):
                continue
            result.append(old)
            continue
        if old.get("status") == "tra_ve_nhan_vien" and new.get("status") == "cho_ke_toan_duyet":
            updated = dict(old)
            updated.update({
                "amount": float(new.get("amount") or old.get("amount") or 0),
                "reason": new.get("reason") or old.get("reason"),
                "date": new.get("date") or old.get("date"),
                "status": "cho_ke_toan_duyet",
                "submittedAt": new.get("submittedAt") or old.get("submittedAt"),
                "submittedByEmail": _normalized_email(user.get("email")),
                "submittedByName": new.get("submittedByName") or old.get("submittedByName"),
                "returnedByBoss": False,
                "returnReason": "",
                "accountantApprovedAt": None,
                "bossApprovedAt": None,
                "paid": False,
                "linkedTxId": None,
                "approvalHistory": new.get("approvalHistory") if isinstance(new.get("approvalHistory"), list) else old.get("approvalHistory", []),
            })
            result.append(updated)
        else:
            result.append(old)
    for key, new in incoming.items():
        if key in handled or _record_employee_id(new) != employee_id or new.get("status") != "cho_ke_toan_duyet":
            continue
        created = dict(new)
        created.update({
            "employeeId": employee_id,
            "status": "cho_ke_toan_duyet",
            "submittedByEmail": _normalized_email(user.get("email")),
            "paid": False,
            "linkedTxId": None,
            "accountantApprovedAt": None,
            "bossApprovedAt": None,
        })
        result.append(created)
    return result


def _merge_accountant_mid_month(existing_records, incoming_records):
    existing = _index_records(existing_records)
    incoming = _index_records(incoming_records)
    result = []
    for key, old in existing.items():
        new = incoming.get(key)
        if not new:
            result.append(old)
            continue
        old_status = old.get("status")
        new_status = new.get("status")
        if old_status == "cho_ke_toan_duyet" and new_status in {"cho_sep_xac_nhan", "tra_ve_nhan_vien"}:
            updated = dict(new)
            updated["amount"] = old.get("amount")
            updated["employeeId"] = old.get("employeeId")
            result.append(updated)
        else:
            # Kế toán chỉ được duyệt & trình Admin hoặc không duyệt & trả nhân viên.
            # Không được tự ghi nhận chi trả hay sửa dữ liệu sau khi Admin đóng dấu.
            result.append(old)
    return result


def _merge_admin_mid_month(existing_records, incoming_records):
    existing = _index_records(existing_records)
    incoming = _index_records(incoming_records)
    result = []
    for key, old in existing.items():
        new = incoming.get(key)
        old_status = old.get("status")
        if not new:
            if old_status in APPROVED_PAYROLL_STATUSES:
                continue
            result.append(old)
            continue

        if old_status != "cho_sep_xac_nhan":
            result.append(old)
            continue

        new_status = new.get("status")
        if new_status == "da_duyet_cho_thanh_toan":
            updated = dict(old)
            updated.update({
                "status": "da_duyet_cho_thanh_toan",
                "bossApprovedAt": new.get("bossApprovedAt"),
                "bossApprovedByEmail": new.get("bossApprovedByEmail"),
                "bossApprovedByName": new.get("bossApprovedByName"),
                "bossSignature": new.get("bossSignature"),
                "approvalHistory": new.get("approvalHistory") if isinstance(new.get("approvalHistory"), list) else old.get("approvalHistory", []),
            })
            result.append(updated)
            continue

        reason = str(new.get("returnReason") or "").strip()
        if new_status == "cho_ke_toan_duyet" and bool(new.get("returnedByBoss")) and reason:
            updated = dict(old)
            updated.update({
                "status": "cho_ke_toan_duyet",
                "returnedByBoss": True,
                "returnReason": reason,
                "returnedAt": new.get("returnedAt"),
                "returnedByEmail": new.get("returnedByEmail"),
                "returnedByName": new.get("returnedByName"),
                "accountantApprovedAt": None,
                "accountantApprovedByEmail": None,
                "accountantApprovedByName": None,
                "accountantSignature": None,
                "approvalHistory": new.get("approvalHistory") if isinstance(new.get("approvalHistory"), list) else old.get("approvalHistory", []),
            })
            result.append(updated)
            continue

        result.append(old)
    return result


def _approved_employee_ids(approvals):
    return {
        _record_employee_id(item) for item in approvals if isinstance(item, dict)
        and item.get("status") == "da_duyet_cho_thanh_toan"
    }


def _merge_employee_owned_records(existing_records, incoming_records, employee_id, employee_field="employeeId"):
    if employee_id is None:
        return existing_records if isinstance(existing_records, list) else []
    existing_records = existing_records if isinstance(existing_records, list) else []
    incoming_records = incoming_records if isinstance(incoming_records, list) else []
    untouched = [item for item in existing_records if not _record_belongs_to_employee(item, employee_id, employee_field)]
    own_incoming = [item for item in incoming_records if _record_belongs_to_employee(item, employee_id, employee_field)]
    return untouched + own_incoming


def _lead_key(value):
    return str(value) if value is not None else ""


def _lead_phone(value):
    raw = str(value or "").strip()[:40]
    digits = "".join(char for char in raw if char.isdigit())
    return raw if 8 <= len(digits) <= 15 else ""


def _lead_sale_id(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _lead_date(value, fallback=""):
    raw = str(value or fallback or "").strip()[:10]
    try:
        return date.fromisoformat(raw).isoformat()
    except (TypeError, ValueError):
        return str(fallback or date.today().isoformat())[:10]


def _lead_assignee_is_active_sale(employees, employee_id):
    employee_id = _lead_sale_id(employee_id)
    if employee_id is None:
        return False
    for item in employees:
        if not isinstance(item, dict) or item.get("status") == "inactive":
            continue
        if _lead_sale_id(item.get("id")) == employee_id and _employee_position_role(item) == "sale":
            return True
    return False


def _lead_created_by(record, user, employee_id):
    if _record_belongs_to_employee(record, employee_id, "createdByEmployeeId"):
        return True
    return _normalized_email(record.get("createdByEmail")) == _normalized_email((user or {}).get("email"))


def _sanitize_new_lead_contact(entry, user, employee):
    if not isinstance(entry, dict):
        return None
    note = str(entry.get("note") or "").strip()[:3000]
    if not note and not entry.get("nextFollowUpDate"):
        return None
    contact_type = str(entry.get("type") or "call").strip()
    if contact_type not in LEAD_CONTACT_TYPES:
        contact_type = "call"
    employee_id = int(employee["id"]) if employee and employee.get("id") is not None else None
    return {
        "id": entry.get("id") or f"lead-contact:{uuid.uuid4().hex}",
        "date": str(entry.get("date") or datetime.now(timezone.utc).isoformat())[:64],
        "type": contact_type,
        "note": note or "(không ghi chú)",
        "employeeId": employee_id,
        "employeeName": str((employee or {}).get("name") or (user or {}).get("email") or "")[:200],
        "employeeEmail": _normalized_email((user or {}).get("email")),
    }


def _merge_lead_contact_log(old_entries, incoming_entries, user, employee):
    old_entries = [dict(item) for item in (old_entries if isinstance(old_entries, list) else []) if isinstance(item, dict)]
    incoming_entries = incoming_entries if isinstance(incoming_entries, list) else []
    old_ids = {_lead_key(item.get("id")) for item in old_entries if item.get("id") is not None}
    old_signatures = {
        (str(item.get("date") or ""), str(item.get("type") or ""), str(item.get("note") or ""))
        for item in old_entries
    }
    result = list(old_entries)
    for item in incoming_entries:
        if not isinstance(item, dict):
            continue
        item_id = _lead_key(item.get("id"))
        signature = (str(item.get("date") or ""), str(item.get("type") or ""), str(item.get("note") or ""))
        if (item_id and item_id in old_ids) or signature in old_signatures:
            continue
        clean = _sanitize_new_lead_contact(item, user, employee)
        if clean:
            result.append(clean)
            old_ids.add(_lead_key(clean.get("id")))
            old_signatures.add((str(clean.get("date") or ""), str(clean.get("type") or ""), str(clean.get("note") or "")))
    return result[-500:]


def _sanitize_employee_lead(record, user, employee, position_role, employees, old=None):
    if not isinstance(record, dict) or not employee:
        return None
    employee_id = int(employee["id"])
    now = datetime.now(timezone.utc).isoformat()
    previous = dict(old or {})
    phone = _lead_phone(record.get("phone", previous.get("phone")))
    if not phone:
        return None

    if old is None:
        requested_assignee = employee_id if position_role == "sale" else record.get("saleEmployeeId")
        if not _lead_assignee_is_active_sale(employees, requested_assignee):
            return None
        sale_employee_id = int(requested_assignee)
        created_at = now
        created_by_employee_id = employee_id
        created_by_email = _normalized_email((user or {}).get("email"))
        created_by_name = str(employee.get("name") or created_by_email)[:200]
        old_contacts = []
    else:
        if position_role == "sale":
            sale_employee_id = _lead_sale_id(previous.get("saleEmployeeId"))
        else:
            requested_assignee = record.get("saleEmployeeId", previous.get("saleEmployeeId"))
            sale_employee_id = _lead_sale_id(requested_assignee) if _lead_assignee_is_active_sale(employees, requested_assignee) else _lead_sale_id(previous.get("saleEmployeeId"))
        if sale_employee_id is None:
            return None
        created_at = previous.get("createdAt") or now
        created_by_employee_id = previous.get("createdByEmployeeId")
        created_by_email = previous.get("createdByEmail") or ""
        created_by_name = previous.get("createdByName") or ""
        old_contacts = previous.get("contactLog", [])

    source = str(record.get("source", previous.get("source", "marketing_ads")) or "marketing_ads")
    if source not in LEAD_SOURCES:
        source = "marketing_ads"
    status = str(record.get("status", previous.get("status", "dang_cham_soc")) or "dang_cham_soc")
    if status not in LEAD_STATUSES:
        status = "dang_cham_soc"

    clean = {
        **previous,
        "id": record.get("id") or previous.get("id") or f"lead:{uuid.uuid4().hex}",
        "date": _lead_date(record.get("date"), previous.get("date")),
        "customerName": str(record.get("customerName", previous.get("customerName", "")) or "(Chưa rõ tên)").strip()[:300],
        "phone": phone,
        "email": str(record.get("email", previous.get("email", "")) or "").strip()[:320],
        "note": str(record.get("note", previous.get("note", "")) or "").strip()[:5000],
        "source": source,
        "status": status,
        "saleEmployeeId": sale_employee_id,
        "nextFollowUpDate": _lead_date(record.get("nextFollowUpDate"), previous.get("nextFollowUpDate")) if record.get("nextFollowUpDate", previous.get("nextFollowUpDate")) else "",
        "contactLog": _merge_lead_contact_log(old_contacts, record.get("contactLog", []), user, employee),
        "createdAt": created_at,
        "createdByEmployeeId": created_by_employee_id,
        "createdByEmail": created_by_email,
        "createdByName": created_by_name,
        "assignedAt": previous.get("assignedAt") or now,
        "updatedAt": now,
        "updatedByEmployeeId": employee_id,
        "updatedByEmail": _normalized_email((user or {}).get("email")),
    }
    return clean


def _merge_employee_leads(existing_records, incoming_records, user, employee, position_role, employees):
    if not employee or position_role not in {"sale", "ads"}:
        return existing_records if isinstance(existing_records, list) else []
    existing_records = [item for item in (existing_records if isinstance(existing_records, list) else []) if isinstance(item, dict)]
    incoming_records = [item for item in (incoming_records if isinstance(incoming_records, list) else []) if isinstance(item, dict)]
    employee_id = int(employee["id"])
    employees = employees if isinstance(employees, list) else []
    incoming_by_id = {_lead_key(item.get("id")): item for item in incoming_records if item.get("id") is not None}
    existing_ids = {_lead_key(item.get("id")) for item in existing_records if item.get("id") is not None}
    result = []

    for old in existing_records:
        editable = (
            _record_belongs_to_employee(old, employee_id, "saleEmployeeId")
            if position_role == "sale"
            else _lead_created_by(old, user, employee_id)
        )
        candidate = incoming_by_id.get(_lead_key(old.get("id")))
        if editable and candidate:
            clean = _sanitize_employee_lead(candidate, user, employee, position_role, employees, old=old)
            result.append(clean or old)
        else:
            # Nhân viên không được xóa lead qua autosave; chuyển trạng thái "Từ chối"
            # hoặc Admin xử lý mới là thao tác hợp lệ và có thể truy vết.
            result.append(old)

    for candidate in incoming_records:
        if _lead_key(candidate.get("id")) in existing_ids:
            continue
        clean = _sanitize_employee_lead(candidate, user, employee, position_role, employees, old=None)
        if clean:
            result.append(clean)
    return result


def _merge_assigned_inventory(existing_inventory, incoming_inventory, employee_id):
    existing_inventory = existing_inventory if isinstance(existing_inventory, list) else []
    incoming_by_id = {
        str(item.get("id")): item for item in (incoming_inventory if isinstance(incoming_inventory, list) else [])
        if isinstance(item, dict) and item.get("id") is not None
    }
    merged = []
    for old in existing_inventory:
        if not isinstance(old, dict):
            merged.append(old)
            continue
        if not _record_belongs_to_employee(old, employee_id, "assignedEmployeeId"):
            merged.append(old)
            continue
        candidate = incoming_by_id.get(str(old.get("id")))
        if not isinstance(candidate, dict):
            merged.append(old)
            continue
        updated = dict(old)
        updated.update(candidate)
        # Nhân viên chỉ sửa sản phẩm đã được giao; không được chuyển người phụ trách/xóa/tạo mới.
        updated["id"] = old.get("id")
        updated["assignedEmployeeId"] = old.get("assignedEmployeeId")
        merged.append(updated)
    return merged


def _merge_assigned_stock_movements(existing_movements, incoming_movements, assigned_product_ids):
    existing_movements = existing_movements if isinstance(existing_movements, list) else []
    incoming_movements = incoming_movements if isinstance(incoming_movements, list) else []
    existing_ids = {str(item.get("id")) for item in existing_movements if isinstance(item, dict) and item.get("id") is not None}
    allowed_new = []
    for item in incoming_movements:
        if not isinstance(item, dict) or str(item.get("id")) in existing_ids:
            continue
        try:
            product_id = int(item.get("productId"))
        except (TypeError, ValueError):
            continue
        if product_id in assigned_product_ids:
            allowed_new.append(item)
    return existing_movements + allowed_new


def _merge_regular_attendance_requests(old_requests, incoming_requests, employee_id):
    """Nhân viên chỉ được tạo yêu cầu chấm công của chính mình cho ngày hiện tại.

    Bản ghi đã duyệt/từ chối hoặc của người khác luôn được giữ nguyên. Việc cập nhật
    attendance chính thức chỉ do Admin/Kế toán thực hiện sau khi duyệt trên giao diện.
    """
    old_list = [item for item in (old_requests or []) if isinstance(item, dict)]
    if employee_id is None or not isinstance(incoming_requests, list):
        return old_list

    today_text = date.today().isoformat()
    result = list(old_list)
    existing_keys = {
        (str(item.get("employeeId")), str(item.get("date"))): item
        for item in old_list
    }
    old_ids = {str(item.get("id")) for item in old_list if item.get("id") is not None}
    for item in incoming_requests:
        if not isinstance(item, dict):
            continue
        if item.get("id") is not None and str(item.get("id")) in old_ids:
            # Đây chỉ là bản ghi lịch sử frontend gửi lại; không tạo trùng.
            continue
        try:
            item_employee_id = int(item.get("employeeId"))
        except (TypeError, ValueError):
            continue
        if item_employee_id != int(employee_id) or str(item.get("date") or "") != today_text:
            continue
        key = (str(employee_id), today_text)
        existing = existing_keys.get(key)
        if existing and existing.get("status") != "rejected":
            # Nhân viên không thể sửa trạng thái hoặc giờ của yêu cầu đang chờ/đã duyệt.
            continue
        request_id = item.get("id") or int(datetime.now(timezone.utc).timestamp() * 1000)
        clean = {
            "id": request_id,
            "employeeId": int(employee_id),
            "employeeName": str(item.get("employeeName") or "").strip(),
            "date": today_text,
            "code": str(item.get("code") or "X").strip().upper() if str(item.get("code") or "X").strip().upper() in {"X", "P", "N", "K", "L", "O"} else "X",
            "status": "pending",
            "checkInAt": datetime.now(timezone.utc).isoformat(),
            "submittedAt": datetime.now(timezone.utc).isoformat(),
            "submittedByEmail": str(item.get("submittedByEmail") or "").strip().lower(),
        }
        result.append(clean)
        existing_keys[key] = clean
    return result


def preserve_restricted_state_fields(db_path, incoming_data, user, existing_data_override=None):
    if not isinstance(incoming_data, dict):
        return incoming_data
    if existing_data_override is None:
        existing = read_state(db_path)
        existing_data = existing.get("data") if existing else None
    else:
        existing_data = existing_data_override
    if not isinstance(existing_data, dict):
        return incoming_data

    merged = dict(incoming_data)
    # Các sổ bất biến chỉ được thay đổi qua endpoint nghiệp vụ nguyên tử. Không cho
    # request autosave chung từ trình duyệt ghi đè bằng bản cũ khi nhiều người cùng làm.
    merged["paymentLedger"] = existing_data.get("paymentLedger", [])
    merged["securityAuditLog"] = existing_data.get("securityAuditLog", [])
    old_approvals = existing_data.get("payrollApprovals", [])
    old_mid = existing_data.get("midMonthRequests", [])
    old_payments = existing_data.get("payrollPayments", [])
    old_attendance_requests = existing_data.get("attendanceRequests", [])

    if _is_admin(user):
        merged["attendanceRequests"] = incoming_data.get("attendanceRequests", old_attendance_requests)
        incoming_approvals = incoming_data.get("payrollApprovals", [])
        incoming_mid = incoming_data.get("midMonthRequests", [])
        incoming_approval_ids = set(_index_records(incoming_approvals))
        incoming_mid_ids = set(_index_records(incoming_mid))

        # Phiếu chi là chứng từ bất biến. Kỳ lương đã phát sinh thanh toán không được
        # phép mất hồ sơ duyệt chỉ vì một tab Admin đang giữ snapshot cũ hoặc xóa dòng.
        paid_period_keys = {
            _record_period_key(item)
            for item in old_payments if isinstance(item, dict)
            and not item.get("reversedAt")
            and _record_period_key(item) is not None
        }

        # Việc một hồ sơ biến mất khỏi dữ liệu Admin chỉ được chấp nhận khi hồ sơ cũ
        # đã được duyệt/đóng dấu VÀ chưa phát sinh chi trả. Hồ sơ đang chờ hoặc đã chi
        # luôn được giữ để đối soát với sổ Chi.
        deleted_approval_keys = {
            _record_period_key(item)
            for item in old_approvals if isinstance(item, dict)
            and item.get("status") in APPROVED_PAYROLL_STATUSES
            and str(item.get("id")) not in incoming_approval_ids
            and _record_period_key(item) is not None
            and _record_period_key(item) not in paid_period_keys
        }
        deleted_mid_ids = {
            int(item.get("id"))
            for item in old_mid if isinstance(item, dict)
            and item.get("status") in APPROVED_PAYROLL_STATUSES
            and item.get("id") is not None
            and str(item.get("id")) not in incoming_mid_ids
        }

        merged["payrollApprovals"] = _merge_admin_approvals(old_approvals, incoming_approvals)
        # Phòng vệ thêm cho dữ liệu legacy: nếu đã có phiếu chi nhưng trạng thái hồ sơ
        # chưa kịp chuyển sang ``da_chi_tra``, vẫn phải giữ hồ sơ duyệt nguồn.
        merged_period_keys = {
            _record_period_key(item)
            for item in merged["payrollApprovals"] if isinstance(item, dict)
            and _record_period_key(item) is not None
        }
        for old_item in old_approvals if isinstance(old_approvals, list) else []:
            period_key = _record_period_key(old_item)
            if period_key in paid_period_keys and period_key not in merged_period_keys:
                merged["payrollApprovals"].append(old_item)
                merged_period_keys.add(period_key)
        merged["midMonthRequests"] = _merge_admin_mid_month(old_mid, incoming_mid)

        # Admin không tạo/đổi phiếu chi. Khi Admin xóa một đề xuất đã đóng dấu thì
        # chỉ phiếu chi và giao dịch lương liên kết với đúng đề xuất đó mới bị xóa.
        deleted_linked_tx_ids = set()
        kept_payments = []
        for payment in old_payments if isinstance(old_payments, list) else []:
            if _record_period_key(payment) in deleted_approval_keys:
                try:
                    deleted_linked_tx_ids.add(int(payment.get("linkedTxId")))
                except (TypeError, ValueError):
                    pass
                continue
            kept_payments.append(payment)
        # Phiếu chi lương là sổ giao dịch máy chủ; không xóa qua autosave chung.
        merged["payrollPayments"] = old_payments

        for request in old_mid if isinstance(old_mid, list) else []:
            try:
                request_id = int(request.get("id"))
            except (TypeError, ValueError):
                continue
            if request_id in deleted_mid_ids:
                try:
                    deleted_linked_tx_ids.add(int(request.get("linkedTxId")))
                except (TypeError, ValueError):
                    pass

        kept_salary_transactions = []
        for transaction in existing_data.get("transactions", []):
            if not isinstance(transaction, dict) or transaction.get("source") != "bangluong":
                continue
            try:
                tx_id = int(transaction.get("id"))
            except (TypeError, ValueError):
                tx_id = None
            if tx_id in deleted_linked_tx_ids:
                continue
            try:
                source_id = int(transaction.get("sourceOrderId"))
            except (TypeError, ValueError):
                source_id = None
            if source_id in deleted_mid_ids:
                continue
            try:
                tx_year, tx_month = [int(part) for part in str(transaction.get("date") or "").split("-")[:2]]
            except (TypeError, ValueError):
                tx_year, tx_month = None, None
            if any(source_id == employee_id and tx_year == year and tx_month == month for employee_id, year, month in deleted_approval_keys):
                continue
            kept_salary_transactions.append(transaction)

        server_payroll_transactions = [
            item for item in existing_data.get("transactions", [])
            if isinstance(item, dict) and str(item.get("sourceModule") or item.get("source") or "").lower() == "payroll_payment"
        ]
        incoming_non_salary = [
            item for item in incoming_data.get("transactions", [])
            if not isinstance(item, dict) or (
                item.get("source") != "bangluong"
                and str(item.get("sourceModule") or item.get("source") or "").lower() != "payroll_payment"
            )
        ]
        merged["transactions"] = incoming_non_salary + kept_salary_transactions + server_payroll_transactions
        return merged

    if "tasks" in existing_data:
        merged["tasks"] = existing_data["tasks"]

    employees, employee, is_accountant = _employee_context(db_path, user)
    employee_id = int(employee["id"]) if employee else None
    if is_accountant:
        merged["attendanceRequests"] = incoming_data.get("attendanceRequests", old_attendance_requests)
        # Tài khoản role accountant có toàn quyền với dữ liệu hệ thống giống Sếp/Admin.
        # Riêng hồ sơ lương vẫn đi qua bộ trộn Kế toán để không thể tự ghi luôn chữ ký Sếp
        # và vẫn giữ đúng lịch sử hai cấp thẩm định.
        merged["payrollApprovals"] = _merge_accountant_approvals(old_approvals, incoming_data.get("payrollApprovals", []))
        merged["midMonthRequests"] = _merge_accountant_mid_month(old_mid, incoming_data.get("midMonthRequests", []))
        merged["payrollPayments"] = old_payments
        # Bút toán chi lương chỉ được ghi bởi endpoint /payroll-payments.
        existing_payroll_tx = [item for item in existing_data.get("transactions", []) if isinstance(item, dict) and str(item.get("sourceModule") or item.get("source") or "").lower() == "payroll_payment"]
        incoming_non_payroll_tx = [item for item in incoming_data.get("transactions", []) if not isinstance(item, dict) or str(item.get("sourceModule") or item.get("source") or "").lower() != "payroll_payment"]
        merged["transactions"] = incoming_non_payroll_tx + existing_payroll_tx
        merged["tasks"] = incoming_data.get("tasks", existing_data.get("tasks", []))
    else:
        # Nhân viên mặc định chỉ sửa dữ liệu cá nhân. Một số nhóm vị trí được cấp thêm quyền
        # nghiệp vụ có giới hạn: Sale/Marketing sửa nhật ký của chính mình; người được phân kho
        # chỉ sửa đúng sản phẩm đã giao, không thể xem/sửa sản phẩm của người khác.
        for field, value in existing_data.items():
            if field not in PAYROLL_WORKFLOW_FIELDS:
                merged[field] = value

        position_role = _employee_position_role(employee)
        position_permissions = _employee_position_permissions(employee)
        if position_permissions.get("marketing_write") and "marketingLogs" in incoming_data:
            merged["marketingLogs"] = _merge_employee_owned_records(
                existing_data.get("marketingLogs", []), incoming_data.get("marketingLogs", []), employee_id, "employeeId"
            )
        if position_role in {"sale", "ads"} and "leads" in incoming_data:
            merged["leads"] = _merge_employee_leads(
                existing_data.get("leads", []), incoming_data.get("leads", []), user, employee, position_role, employees
            )
        if position_permissions.get("inventory_write") and "inventory" in incoming_data and employee_id is not None:
            merged["inventory"] = _merge_assigned_inventory(
                existing_data.get("inventory", []), incoming_data.get("inventory", []), employee_id
            )
            assigned_ids = {
                int(item.get("id")) for item in existing_data.get("inventory", [])
                if isinstance(item, dict) and item.get("id") is not None
                and _record_belongs_to_employee(item, employee_id, "assignedEmployeeId")
            }
            if "stockMovements" in incoming_data:
                merged["stockMovements"] = _merge_assigned_stock_movements(
                    existing_data.get("stockMovements", []), incoming_data.get("stockMovements", []), assigned_ids
                )

        merged["attendanceRequests"] = _merge_regular_attendance_requests(
            old_attendance_requests, incoming_data.get("attendanceRequests", []), employee_id
        )
        merged["payrollApprovals"] = _merge_regular_payroll_approvals(old_approvals, incoming_data.get("payrollApprovals", []), user, employee)
        merged["midMonthRequests"] = _merge_regular_mid_month(old_mid, incoming_data.get("midMonthRequests", []), user, employee_id)
        merged["payrollPayments"] = old_payments
        merged["transactions"] = existing_data.get("transactions", [])
        merged["tasks"] = _merge_task_review_updates(existing_data.get("tasks"), incoming_data.get("tasks"), user, employee, is_accountant)
    return merged


def update_employees_for_user(db_path, incoming_employees, user):
    existing = employee_service.list_employees(db_path)
    account_role = _normalized_account_role((user or {}).get("role"))
    if account_role == "admin":
        # Chỉ Sếp/Admin được sửa hồ sơ nhân sự. Kế toán chỉ đọc để xử lý lương.
        return employee_service.replace_all(db_path, incoming_employees)
    if account_role == "accountant":
        raise ValueError("Kế toán không được thêm, sửa hoặc xóa hồ sơ nhân sự.")

    _, current_employee, is_accountant = _employee_context(db_path, user)
    current_employee_id = int(current_employee["id"]) if current_employee else None
    incoming_by_id = {
        int(item.get("id")): item
        for item in incoming_employees
        if isinstance(item, dict) and item.get("id") is not None
    } if isinstance(incoming_employees, list) else {}

    merged = []
    for employee in existing:
        updated = dict(employee)
        if current_employee_id is None or int(employee.get("id", -1)) != current_employee_id:
            merged.append(updated)
            continue

        candidate = incoming_by_id.get(current_employee_id, {})
        for field in SELF_PROFILE_FIELDS:
            if field in candidate:
                updated[field] = candidate[field]

        # Nhân viên thường không được ghi thẳng vào attendance. Họ chỉ tạo
        # attendanceRequests; ngày công chính thức chỉ được Admin/Kế toán ghi sau khi duyệt.
        # Vì vậy giữ nguyên attendance và attendanceTimes đang có trong database.

        merged.append(updated)
    return employee_service.replace_all(db_path, merged)


SUPPORT_ASSIGNABLE_POSITION_ROLES = {"ky_thuat", "it", "nhan_su", "van_hanh", "cskh", "sale"}
SUPPORT_TYPE_LABELS = {
    "kich_hoat": "Kích hoạt / Setup mới",
    "su_co": "Xử lý sự cố",
    "cham_soc": "Chăm sóc định kỳ",
    "upsale": "Tư vấn nâng cấp / Upsale",
}
SUPPORT_CHANNEL_LABELS = {
    "phone": "Gọi điện",
    "zalo": "Zalo / Nhắn tin",
    "email": "Email",
    "remote": "Hỗ trợ từ xa / Họp online",
    "onsite": "Hỗ trợ trực tiếp",
}


def _employee_contact_email(db_path, employee):
    account_id = (employee or {}).get("account_id")
    try:
        account_id = int(account_id)
    except (TypeError, ValueError):
        account_id = None
    if account_id is not None:
        for account in user_service.list_users(db_path):
            try:
                if int(account.get("id")) == account_id and account.get("active"):
                    account_email = _normalized_email(account.get("email"))
                    if account_email:
                        return account_email
            except (TypeError, ValueError):
                continue
    return _normalized_email((employee or {}).get("email"))


def _support_assignment_message(data, sender_name, recipient_name):
    support_type = SUPPORT_TYPE_LABELS.get(str(data.get("supportType") or ""), "Yêu cầu hỗ trợ")
    support_channel = SUPPORT_CHANNEL_LABELS.get(str(data.get("supportChannel") or ""), "Theo trao đổi")
    order_id = str(data.get("orderId") or "—")
    customer_name = str(data.get("customerName") or "—").strip()
    customer_phone = str(data.get("customerPhone") or "—").strip()
    customer_email = str(data.get("customerEmail") or "—").strip()
    product_name = str(data.get("productName") or "—").strip()
    duration_label = str(data.get("durationLabel") or "—").strip()
    issue = str(data.get("issue") or "").strip()
    details = str(data.get("details") or "").strip()
    lines = [
        "[YÊU CẦU HỖ TRỢ KHÁCH HÀNG]",
        f"Người tiếp nhận: {recipient_name}",
        f"Người giao: {sender_name}",
        f"Loại yêu cầu: {support_type}",
        f"Cách thức hỗ trợ: {support_channel}",
        f"Đơn hàng: #{order_id} · ngày {str(data.get('orderDate') or '—')}",
        f"Khách hàng: {customer_name}",
        f"Liên hệ khách: {customer_phone} · {customer_email}",
        f"Sản phẩm: {product_name}",
        f"Thời hạn: {duration_label}",
        f"Vấn đề cần hỗ trợ: {issue}",
        f"Nội dung cần hỗ trợ: {details}",
        "Vui lòng mở DOMIX để kiểm tra và cập nhật kết quả xử lý.",
    ]
    return "\n".join(lines)



class DomixHandler(BaseHTTPRequestHandler):
    db_path = DEFAULT_DB_TARGET
    static_dir = DIST_DIR

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", CORS_ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def _dispatch_request(self, method, route, parsed):
        """Không để exception của API làm Nginx nhận upstream đóng kết nối và trả 502.

        Mọi lỗi nghiệp vụ được trả JSON 400; lỗi máy chủ có mã đối soát và được ghi
        traceback trong log container. Frontend nhờ đó hiển thị đúng nguyên nhân thay
        vì mất hồ sơ cục bộ hoặc chỉ báo Bad Gateway chung chung.
        """
        try:
            return dispatch(method, self, route, parsed)
        except ValueError as exc:
            self.send_json({"error": str(exc)}, 400)
            return True
        except Exception as exc:
            request_id = uuid.uuid4().hex[:12]
            print(f"[DOMIX API ERROR] request_id={request_id} method={method} route={route}")
            traceback.print_exc()
            try:
                self.send_json({
                    "error": "Máy chủ không thể hoàn tất thao tác. Dữ liệu chưa được ghi.",
                    "detail": str(exc),
                    "requestId": request_id,
                }, 500)
            except (BrokenPipeError, ConnectionResetError):
                pass
            return True

    def do_GET(self):
        parsed = urlparse(self.path)
        route = parsed.path
        if self._dispatch_request("GET", route, parsed):
            return
        if route.startswith("/api/"):
            return self.send_json({"error": "API không tồn tại"}, 404)
        return self.serve_static()

    def do_POST(self):
        parsed = urlparse(self.path)
        route = parsed.path
        if self._dispatch_request("POST", route, parsed):
            return
        self.send_json({"error": "API không tồn tại"}, 404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        route = parsed.path
        if self._dispatch_request("DELETE", route, parsed):
            return
        self.send_json({"error": "API không tồn tại"}, 404)

    def do_PUT(self):
        parsed = urlparse(self.path)
        route = parsed.path
        if self._dispatch_request("PUT", route, parsed):
            return
        self.send_json({"error": "API không tồn tại"}, 404)

    def database_backend(self):
        return database_backend(self.db_path)

    def database_identity(self):
        return database_identity(self.db_path)

    def effective_user(self, user, persist=True):
        return _effective_user(self.db_path, user, persist=persist)

    def filter_employees(self, employees, user):
        return filter_employees_for_user(self.db_path, employees, user)

    def update_employees(self, employees, user):
        return update_employees_for_user(self.db_path, employees, user)

    def filter_payroll_data(self, data, user):
        return _filter_payroll_data_for_user(self.db_path, data, user)

    def filter_state(self, state, user):
        return filter_state_for_user(self.db_path, state, user)

    def preserve_restricted_state(self, data, user, existing_data=None):
        return preserve_restricted_state_fields(self.db_path, data, user, existing_data)

    def employee_context(self, user):
        return _employee_context(self.db_path, user)

    def employee_position_role(self, employee):
        return _employee_position_role(employee)

    def is_full_admin(self, user):
        return _is_full_admin(user)

    def support_assignable_roles(self):
        return SUPPORT_ASSIGNABLE_POSITION_ROLES

    def employee_contact_email(self, employee):
        return _employee_contact_email(self.db_path, employee)

    def support_assignment_message(self, data, sender_name, recipient_name):
        return _support_assignment_message(data, sender_name, recipient_name)

    def support_type_label(self, value):
        return SUPPORT_TYPE_LABELS.get(str(value or ""), "Yêu cầu hỗ trợ")

    def support_channel_label(self, value):
        return SUPPORT_CHANNEL_LABELS.get(str(value or ""), "Theo trao đổi")

    def bearer_token(self):
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return ""
        return auth.removeprefix("Bearer ").strip()

    def require_user(self, roles=None):
        user = auth_service.current_user(self.db_path, self.bearer_token())
        if not user:
            self.send_json({"error": "Chưa đăng nhập"}, 401)
            return None
        user = _effective_user(self.db_path, user, persist=True)
        if roles:
            allowed = {_normalized_account_role(role) for role in ({roles} if isinstance(roles, str) else set(roles))}
            if _normalized_account_role(user.get("role")) not in allowed:
                self.send_json({"error": "Không đủ quyền"}, 403)
                return None
        return user

    def read_json(self):
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length < 0 or content_length > MAX_REQUEST_BODY_BYTES:
                self.send_json({"error": "Dữ liệu gửi lên vượt quá giới hạn cho phép."}, 413)
                return None
            body = self.rfile.read(content_length).decode("utf-8")
            return json.loads(body or "{}")
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            self.send_json({"error": f"JSON không hợp lệ: {exc}"}, 400)
            return None

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def serve_static(self):
        if not self.static_dir.exists():
            return self.send_json({"error": "Chưa có dist. Chạy npm.cmd run build trước."}, 404)
        request_path = unquote(self.path.split("?", 1)[0]).lstrip("/")
        relative = Path(request_path or "index.html")
        candidate = (self.static_dir / relative).resolve()
        static_root = self.static_dir.resolve()
        try:
            candidate.relative_to(static_root)
        except ValueError:
            return self.send_error(403, "Forbidden")
        if not candidate.exists() or candidate.is_dir():
            candidate = static_root / "index.html"
        content = candidate.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(candidate.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def log_message(self, format, *args):
        return


def _reconcile_existing_company_state(db_path):
    """Chuẩn hóa dữ liệu doanh nghiệp đã có khi backend khởi động.

    Việc này giúp các bản ghi được tạo trước bản vá lập tức có quan hệ Kho → Đơn
    hàng → Công nợ/Thu Chi và loại doanh thu phân phối liên kết bị tính hai lần.
    Dữ liệu không hợp lệ (ví dụ tồn kho âm) không làm server ngừng chạy; lỗi được
    ghi rõ để quản trị viên sửa từ giao diện.
    """
    state = read_state(db_path)
    current = state.get("data") if isinstance(state, dict) else None
    if not isinstance(current, dict) or not current:
        return
    try:
        update_state(db_path, reconcile_company_data)
        print("Business data relationships reconciled successfully.")
    except ValueError as exc:
        print(f"WARNING: Business data reconciliation skipped: {exc}")
    except Exception:
        print("WARNING: Unexpected error while reconciling business data:")
        traceback.print_exc()


def main():
    parser = argparse.ArgumentParser(description="DOMIX company server")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--db", default=str(DEFAULT_DB_TARGET))
    parser.add_argument("--certfile", default="")
    parser.add_argument("--keyfile", default="")
    parser.add_argument("--create-user", nargs=3, metavar=("EMAIL", "PASSWORD", "ROLE"))
    args = parser.parse_args()

    try:
        DomixHandler.db_path = require_postgres_target(args.db)
    except RuntimeError as exc:
        parser.error(str(exc))
    init_db(DomixHandler.db_path)

    if args.create_user:
        email, password, role = args.create_user
        user_service.create_or_update_user(DomixHandler.db_path, email, password, role)
        print(f"Saved user {email} with role {role}.")
        return

    user_service.ensure_admin_from_env(DomixHandler.db_path)
    setup_message = user_service.setup_message_if_needed(DomixHandler.db_path)
    if setup_message:
        print(setup_message)

    _reconcile_existing_company_state(DomixHandler.db_path)
    inventory_expiry_service.start_inventory_expiry_worker(DomixHandler.db_path)
    server = ThreadingHTTPServer((args.host, args.port), DomixHandler)
    protocol = "http"
    if args.certfile and args.keyfile:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(args.certfile, args.keyfile)
        server.socket = context.wrap_socket(server.socket, server_side=True)
        protocol = "https"
    print(f"DOMIX server running at {protocol}://{args.host}:{args.port}")
    print(f"Database ({database_backend(DomixHandler.db_path)}): {database_identity(DomixHandler.db_path)}")
    print("Build frontend with: npm.cmd run build")
    server.serve_forever()


if __name__ == "__main__":
    main()
