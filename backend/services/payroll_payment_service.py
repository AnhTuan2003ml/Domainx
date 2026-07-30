"""Chi trả lương nguyên tử và có thể đối soát.

Một hồ sơ lương đã duyệt chỉ được tạo đúng một lần chi trả. Bút toán Chi và
``payrollPayments`` được ghi trong cùng transaction ``app_state``; tải lại hay
bấm lặp không thể tạo khoản Chi thứ hai.
"""

from datetime import date, datetime, timezone
import uuid


def _as_list(value):
    return value if isinstance(value, list) else []


def _key(value):
    return str(value) if value is not None else ""


def _number(value, default=0.0):
    try:
        return float(value if value is not None else default)
    except (TypeError, ValueError):
        return float(default)




_ATTENDANCE_VALUES = {"X": 1.0, "P": 0.5, "N": 0.0, "K": 0.0, "L": 1.0, "O": 1.0, "CN": 0.0}

def attendance_days_for_employee(employee, year, month):
    """Tính ngày công từ hồ sơ máy chủ, không tin số ngày do trình duyệt gửi lên."""
    attendance = (employee or {}).get("attendance")
    if not isinstance(attendance, dict):
        return 0.0
    month_record = attendance.get(f"{int(year):04d}-{int(month):02d}")
    if not isinstance(month_record, dict):
        return 0.0
    total = 0.0
    for code in month_record.values():
        total += _ATTENDANCE_VALUES.get(str(code or "").upper(), 0.0)
    return total

def payroll_server_context(employee, approval, year, month, fallback_amount=0.0):
    """Tạo dữ liệu đối soát từ hồ sơ nhân sự lưu trên máy chủ.

    Công thức số tiền ở đây chỉ dùng để phát hiện thay đổi nguồn ở các thành phần
    phổ quát (ngày công/đơn giá/thưởng/phụ cấp/khấu trừ). Quyền chi trả luôn bị
    chặn trước tiên khi ngày công máy chủ khác snapshot, kể cả client gửi số giả.
    """
    current_work_days = attendance_days_for_employee(employee, year, month)
    daily_salary = max(0.0, _number((employee or {}).get("dailySalary"), (approval or {}).get("requestedDailySalary")))
    bonus = max(0.0, _number((approval or {}).get("requestedBonus")))
    allowance = max(0.0, _number((approval or {}).get("requestedAllowance")))
    deductions = sum(max(0.0, _number((approval or {}).get(field))) for field in (
        "requestedInsuranceDeduction", "requestedTaxDeduction",
        "requestedAdvanceDeduction", "requestedOtherDeduction",
    ))
    if deductions <= 0:
        deductions = max(0.0, _number((approval or {}).get("requestedDeduction")))
    calculated = current_work_days * daily_salary + bonus + allowance - deductions
    current_system_amount = max(0.0, calculated) if daily_salary > 0 else max(0.0, _number(fallback_amount))
    return {
        "current_work_days": current_work_days,
        "current_system_amount": current_system_amount,
        "employee_id": (employee or {}).get("id"),
        "source": "employees.attendance",
    }

def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _append_audit(result, action, entity_type, entity_id, actor_email, detail):
    events = [dict(item) for item in _as_list(result.get("securityAuditLog")) if isinstance(item, dict)]
    events.append({
        "id": f"audit:{uuid.uuid4().hex}",
        "action": action,
        "entityType": entity_type,
        "entityId": _key(entity_id),
        "actorEmail": actor_email or "",
        "detail": str(detail or ""),
        "success": True,
        "createdAt": _now_iso(),
    })
    result["securityAuditLog"] = events[-1000:]


def _proposal_amount(approval):
    override = max(0.0, _number((approval or {}).get("approvedAmountOverride")))
    if override > 0:
        return override
    work_days = max(0.0, _number(approval.get("requestedWorkDays")))
    daily_salary = max(0.0, _number(
        approval.get("requestedDailySalary", approval.get("requestedBaseSalary"))
    ))
    bonus = max(0.0, _number(approval.get("requestedBonus")))
    allowance = max(0.0, _number(approval.get("requestedAllowance")))
    deductions = sum(max(0.0, _number(approval.get(field))) for field in (
        "requestedInsuranceDeduction",
        "requestedTaxDeduction",
        "requestedAdvanceDeduction",
        "requestedOtherDeduction",
    ))
    if deductions <= 0:
        deductions = max(0.0, _number(approval.get("requestedDeduction")))
    amount = work_days * daily_salary + bonus + allowance - deductions
    return max(0.0, amount)


def _append_history(approval, action, message, actor_email, actor_name, at):
    history = [dict(item) for item in _as_list(approval.get("approvalHistory")) if isinstance(item, dict)]
    history.append({
        "id": f"history:{uuid.uuid4().hex}",
        "action": action,
        "message": message,
        "actorEmail": actor_email or "",
        "actorName": actor_name or actor_email or "",
        "at": at,
    })
    return history


def _approval_status(approval):
    explicit = str((approval or {}).get("approval_status") or "").strip().lower()
    if explicit:
        return explicit
    legacy = str((approval or {}).get("status") or "").strip().lower()
    return {
        "cho_ke_toan_duyet": "submitted",
        "cho_sep_xac_nhan": "accounting_approved",
        "da_duyet_cho_thanh_toan": "director_approved",
        "cho_ke_toan_chi_tra": "director_approved",
        "da_chi_tra": "director_approved",
        "tra_ve_nhan_vien": "accounting_rejected",
    }.get(legacy, legacy or "draft")


def _payment_status(approval):
    explicit = str((approval or {}).get("payment_status") or "").strip().lower()
    if explicit:
        return explicit
    return "paid" if str((approval or {}).get("status") or "").lower() == "da_chi_tra" or (approval or {}).get("paidAt") else "unpaid"




def _reconciliation_state(approval, current_work_days, current_system_amount):
    snapshot_work_days = max(0.0, _number(
        approval.get("attendance_days_snapshot"),
        approval.get("systemWorkDaysAtSubmit", approval.get("requestedWorkDays")),
    ))
    snapshot_system_amount = max(0.0, _number(
        approval.get("system_salary_snapshot"),
        approval.get("systemReferenceAtSubmit", current_system_amount),
    ))
    approved_amount = _proposal_amount(approval)
    requested_work_days = max(0.0, _number(approval.get("requestedWorkDays")))
    variance_threshold = max(50000.0, current_system_amount * 0.05)
    stale_source = (
        abs(current_work_days - snapshot_work_days) > 0.25
        or abs(current_system_amount - snapshot_system_amount) > variance_threshold
    )
    significant_difference = (
        abs(requested_work_days - current_work_days) > 0.25
        or (current_system_amount > 0 and abs(approved_amount - current_system_amount) > variance_threshold)
    )
    required = stale_source or significant_difference
    status = str(approval.get("reconciliation_status") or "").strip().lower()
    return {
        "required": required,
        "status": status,
        "stale_source": stale_source,
        "significant_difference": significant_difference,
        "snapshot_work_days": snapshot_work_days,
        "snapshot_system_amount": snapshot_system_amount,
        "approved_amount": approved_amount,
        "variance_threshold": variance_threshold,
    }


def resolve_payroll_reconciliation(data, payload, actor_email="", actor_name="", employee=None):
    """Xử lý hồ sơ lệch trước khi chi trả.

    action: return | recalculate | keep_approved. Hai hướng sau đánh dấu resolved;
    giữ số đã duyệt bắt buộc có lý do. Trả lại nhân viên chuyển hồ sơ khỏi luồng chi.
    """
    result = dict(data or {})
    employee_id = (payload or {}).get("employeeId")
    try:
        year = int((payload or {}).get("year"))
        month = int((payload or {}).get("month"))
    except (TypeError, ValueError) as exc:
        raise ValueError("Kỳ lương không hợp lệ.") from exc
    action = str((payload or {}).get("action") or "").strip().lower()
    if action not in {"return", "recalculate", "keep_approved"}:
        raise ValueError("Cách xử lý đối soát không hợp lệ.")
    reason = str((payload or {}).get("reason") or "").strip()
    if action in {"return", "keep_approved"} and not reason:
        raise ValueError("Cần nhập lý do đối soát.")

    approvals = [dict(item) for item in _as_list(result.get("payrollApprovals")) if isinstance(item, dict)]
    target = next((item for item in approvals if (
        _key(item.get("employeeId")) == _key(employee_id)
        and int(item.get("year") or 0) == year
        and int(item.get("month") or 0) == month
    )), None)
    if not target:
        raise ValueError("Không tìm thấy đề xuất lương cần đối soát.")
    context = payroll_server_context(
        employee, target, year, month,
        fallback_amount=(payload or {}).get("currentSystemAmount"),
    ) if employee else {
        "current_work_days": max(0.0, _number((payload or {}).get("currentWorkDays"))),
        "current_system_amount": max(0.0, _number((payload or {}).get("currentSystemAmount"))),
    }
    current_work_days = context["current_work_days"]
    current_system_amount = context["current_system_amount"]
    if _payment_status(target) != "unpaid":
        raise ValueError("Hồ sơ đã chi trả nên không thể thay đổi đối soát.")

    now = _now_iso()
    if action == "return":
        target.update({
            "status": "tra_ve_nhan_vien",
            "approval_status": "accounting_rejected",
            "reconciliation_status": "returned",
            "reconciliation_action": action,
            "reconciliation_reason": reason,
            "varianceReason": reason,
            "reconciledAt": now,
            "reconciledByEmail": actor_email or "",
            "reconciledByName": actor_name or actor_email or "",
            "approvalHistory": _append_history(
                target, "reconciliation_return", f"Trả hồ sơ về nhân viên để cập nhật: {reason}", actor_email, actor_name, now
            ),
        })
    elif action == "recalculate":
        if current_system_amount <= 0:
            raise ValueError("Không có số lương hệ thống hợp lệ để tính lại.")
        target.update({
            "requestedWorkDays": current_work_days,
            "approvedAmountOverride": current_system_amount,
            "system_salary_snapshot": current_system_amount,
            "attendance_days_snapshot": current_work_days,
            "systemReferenceAtSubmit": current_system_amount,
            "systemWorkDaysAtSubmit": current_work_days,
            "reconciliation_status": "resolved",
            "reconciliation_action": action,
            "reconciliation_reason": reason or "Tính lại theo dữ liệu nguồn hiện tại",
            "varianceReason": reason or "Tính lại theo dữ liệu nguồn hiện tại",
            "reconciledAt": now,
            "reconciledByEmail": actor_email or "",
            "reconciledByName": actor_name or actor_email or "",
            "approvalHistory": _append_history(
                target, "reconciliation_recalculate", "Đã tính lại theo dữ liệu nguồn hiện tại.", actor_email, actor_name, now
            ),
        })
    else:
        target.update({
            "reconciliation_status": "resolved",
            "reconciliation_action": action,
            "reconciliation_reason": reason,
            "varianceReason": reason,
            "reconciledAt": now,
            "reconciledByEmail": actor_email or "",
            "reconciledByName": actor_name or actor_email or "",
            "approvalHistory": _append_history(
                target, "reconciliation_keep_approved", f"Giữ số đã duyệt sau đối soát: {reason}", actor_email, actor_name, now
            ),
        })

    result["payrollApprovals"] = approvals
    _append_audit(result, "payroll_reconciliation", "payroll_approval", target.get("id"), actor_email, f"{action}: {reason}")
    return result


def record_payroll_payment(data, payload, actor_email="", actor_name="", employee=None):
    """Ghi một khoản chi lương sau khi Sếp đã duyệt.

    Trả về ``(data, payment_id)``. Nếu kỳ lương đã có payment hiệu lực, hàm báo
    lỗi thay vì tạo thêm giao dịch trùng.
    """
    result = dict(data or {})
    employee_id = (payload or {}).get("employeeId")
    try:
        year = int((payload or {}).get("year"))
        month = int((payload or {}).get("month"))
    except (TypeError, ValueError) as exc:
        raise ValueError("Kỳ lương không hợp lệ.") from exc
    if employee_id is None or not (1 <= month <= 12):
        raise ValueError("Thiếu nhân viên hoặc kỳ lương.")

    approvals = [dict(item) for item in _as_list(result.get("payrollApprovals")) if isinstance(item, dict)]
    approval = next((item for item in approvals if (
        _key(item.get("employeeId")) == _key(employee_id)
        and int(item.get("year") or 0) == year
        and int(item.get("month") or 0) == month
    )), None)
    if not approval:
        raise ValueError("Không tìm thấy đề xuất lương của kỳ này.")
    payments = [dict(item) for item in _as_list(result.get("payrollPayments")) if isinstance(item, dict)]
    existing = next((item for item in payments if (
        _key(item.get("employeeId")) == _key(employee_id)
        and int(item.get("year") or 0) == year
        and int(item.get("month") or 0) == month
        and not item.get("reversedAt")
    )), None)
    if existing:
        raise ValueError("Kỳ lương này đã được chi trả; hệ thống không cho thanh toán lần hai.")
    if _approval_status(approval) != "director_approved":
        raise ValueError("Hồ sơ lương chưa được Sếp duyệt và đóng dấu.")
    if _payment_status(approval) != "unpaid":
        raise ValueError("Hồ sơ lương này đã có trạng thái thanh toán; không thể chi lần hai.")

    approved_amount = _proposal_amount(approval)
    context = payroll_server_context(
        employee, approval, year, month,
        fallback_amount=(payload or {}).get("currentSystemAmount", approval.get("systemReferenceAtSubmit")),
    ) if employee else {
        "current_work_days": max(0.0, _number((payload or {}).get("currentWorkDays"), approval.get("requestedWorkDays"))),
        "current_system_amount": max(0.0, _number((payload or {}).get("currentSystemAmount"), approval.get("systemReferenceAtSubmit"))),
    }
    current_work_days = context["current_work_days"]
    current_system_amount = context["current_system_amount"]
    reconciliation = _reconciliation_state(approval, current_work_days, current_system_amount)
    if reconciliation["required"] and reconciliation["status"] != "resolved":
        raise ValueError(
            "Hồ sơ lương chưa đối soát xong. Kế toán phải trả lại nhân viên, "
            "tính lại theo dữ liệu mới hoặc giữ số đã duyệt kèm lý do trước khi chi trả."
        )
    if not approval.get("bossApprovedAt") and str(approval.get("status") or "") != "cho_ke_toan_chi_tra":
        raise ValueError("Hồ sơ chưa có dấu duyệt của Sếp/Admin.")
    requested_amount = max(0.0, _number((payload or {}).get("amount"), approved_amount))
    amount = approved_amount if approved_amount > 0 else requested_amount
    if amount <= 0:
        raise ValueError("Số tiền lương được duyệt phải lớn hơn 0.")
    if requested_amount > 0 and abs(requested_amount - amount) > 0.5:
        raise ValueError("Số tiền chi trả không khớp số tiền đã được duyệt.")

    paid_at = _now_iso()
    paid_date = str((payload or {}).get("date") or date.today().isoformat())[:10]
    payment_id = f"payroll:{uuid.uuid4().hex}"
    tx_id = f"tx:{payment_id}"
    employee_name = str((payload or {}).get("employeeName") or approval.get("employeeName") or "Nhân viên")
    payment = {
        "id": payment_id,
        "employeeId": employee_id,
        "employeeName": employee_name,
        "year": year,
        "month": month,
        "amount": amount,
        "linkedTxId": tx_id,
        "paidAt": paid_at,
        "paidDate": paid_date,
        "paymentMethod": (payload or {}).get("paymentMethod") or "chuyen_khoan",
        "cashAccount": (payload or {}).get("cashAccount") or "quy_cong_ty",
        "referenceNo": (payload or {}).get("referenceNo") or (payload or {}).get("bankReference") or "",
        "note": (payload or {}).get("note") or "",
        "paidByEmail": actor_email or "",
        "paidByName": actor_name or actor_email or "",
        "approvalId": approval.get("id"),
    }
    payments.append(payment)

    transactions = [dict(item) for item in _as_list(result.get("transactions")) if isinstance(item, dict)]
    # Dòng chi cũ chỉ bị loại khi mang đúng khóa kỳ lương. Không xóa các khoản
    # điều chỉnh thủ công hoặc các kỳ khác.
    transactions = [item for item in transactions if not (
        str(item.get("sourceModule") or item.get("source") or "").lower() in {"payroll", "payroll_payment", "bangluong"}
        and _key(item.get("employeeId") or item.get("sourceOrderId")) == _key(employee_id)
        and int(item.get("payrollYear") or 0) == year
        and int(item.get("payrollMonth") or 0) == month
        and bool(item.get("createdAutomatically"))
    )]
    transactions.append({
        "id": tx_id,
        "date": paid_date,
        "kind": "chi",
        "category": "Lương nhân viên",
        "desc": f"Chi lương tháng {month}/{year} — {employee_name}",
        "amount": amount,
        "employeeId": employee_id,
        "employeeName": employee_name,
        "partnerName": employee_name,
        "paymentMethod": payment["paymentMethod"],
        "cashAccount": payment["cashAccount"],
        "paymentReference": payment["referenceNo"],
        "invoiceType": "Phiếu chi lương nội bộ",
        "status": "approved",
        "source": "payroll_payment",
        "sourceModule": "payroll_payment",
        "sourceId": payment_id,
        "payrollYear": year,
        "payrollMonth": month,
        "approvalId": approval.get("id"),
        "createdAutomatically": True,
        "createdAt": paid_at,
        "createdBy": actor_email or "",
    })

    for item in approvals:
        if item.get("id") != approval.get("id"):
            continue
        item.update({
            "status": "da_chi_tra",
            "approval_status": "director_approved",
            "payment_status": "paid",
            "paidAt": paid_at,
            "paidByEmail": actor_email or "",
            "paidByName": actor_name or actor_email or "",
            "paymentId": payment_id,
            "linkedTxId": tx_id,
            "approvalHistory": _append_history(
                item,
                "paid",
                f"Kế toán đã chi trả {amount:,.0f}đ và tạo một bút toán Chi liên kết.",
                actor_email,
                actor_name,
                paid_at,
            ),
        })

    result["payrollApprovals"] = approvals
    result["payrollPayments"] = payments
    result["transactions"] = transactions
    _append_audit(
        result,
        "payroll_payment_posted",
        "payroll_payment",
        payment_id,
        actor_email,
        f"Chi lương {amount:g}đ cho nhân viên {_key(employee_id)} kỳ {month}/{year}.",
    )
    return result, payment_id
