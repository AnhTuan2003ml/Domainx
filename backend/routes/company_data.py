from datetime import datetime, timezone
import time
import uuid
from urllib.parse import parse_qs

from db import user_store
from db.security_store import (
    clear_director_password_failures,
    director_password_is_rate_limited,
    record_director_password_failure,
)
from security import password_hash, verify_password

from db.state_store import StateConflictError, read_state, update_state
from db.employee_store import list_employees
from services.business_sync_service import (
    SYNC_FIELDS,
    create_crm_order,
    preserve_missing_record_fields,
    reconcile_company_data,
    record_debt_payment,
    remove_debt_payment,
    upsert_inventory_product,
)
from services.payroll_payment_service import record_payroll_payment, resolve_payroll_reconciliation
from services.financial_summary_service import FinancialSummaryError, get_financial_series, get_financial_summary
from services.operational_ledger_service import list_debt_payments, list_inventory_movements


_DIRECTOR_PASSWORD_WINDOW_SECONDS = 600
_DIRECTOR_PASSWORD_MAX_FAILURES = 5


def _role(user):
    value = str((user or {}).get("role") or "").strip().lower()
    return "admin" if value in {"admin", "boss"} else "accountant" if value == "accountant" else "user"


def _audit_event(data, action, user, success, detail="", handler=None):
    result = dict(data or {})
    events = [dict(item) for item in (result.get("securityAuditLog") or []) if isinstance(item, dict)]
    events.append({
        "id": f"audit:{int(time.time() * 1000)}:{len(events)}",
        "action": action,
        "success": bool(success),
        "detail": str(detail or ""),
        "actorEmail": (user or {}).get("email") or "",
        "ip": (handler.client_address[0] if handler and getattr(handler, "client_address", None) else ""),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })
    result["securityAuditLog"] = events[-500:]
    return result


def _attempt_key(handler, user):
    ip = handler.client_address[0] if getattr(handler, "client_address", None) else ""
    return f"{(user or {}).get('email') or ''}|{ip}"


def _is_rate_limited(handler, user):
    return director_password_is_rate_limited(
        handler.db_path,
        _attempt_key(handler, user),
        _DIRECTOR_PASSWORD_WINDOW_SECONDS,
        _DIRECTOR_PASSWORD_MAX_FAILURES,
    )


def _record_failed_attempt(handler, user):
    record_director_password_failure(
        handler.db_path,
        _attempt_key(handler, user),
        _DIRECTOR_PASSWORD_WINDOW_SECONDS,
    )


def _clear_attempts(handler, user):
    clear_director_password_failures(handler.db_path, _attempt_key(handler, user))


def handle_get(handler, route, parsed):
    if route not in {
        "/api/payroll/workflow", "/api/tasks", "/api/data/fields", "/api/data",
        "/api/financial-summary", "/api/financial-summary/series", "/api/company-data/debt-payments",
        "/api/company-data/inventory-movements",
    }:
        return False
    user = handler.require_user()
    if not user:
        return True

    if route in {"/api/financial-summary", "/api/financial-summary/series"}:
        query = parse_qs(parsed.query)
        try:
            year = int(query.get("year", [0])[0] or 0) or None
            month = int(query.get("month", [0])[0] or 0) or None
            if month is not None and not 1 <= month <= 12:
                raise ValueError
        except (TypeError, ValueError):
            handler.send_json({"error": "Kỳ báo cáo không hợp lệ."}, 400)
            return True
        periods = None
        if route == "/api/financial-summary/series":
            try:
                months = int(query.get("months", [6])[0] or 6)
            except (TypeError, ValueError):
                months = 0
            if not year or not month or not 1 <= months <= 12:
                handler.send_json({"error": "Khoảng báo cáo không hợp lệ."}, 400)
                return True
            periods = []
            cursor_year, cursor_month = year, month
            for _ in range(months):
                periods.append({"year": cursor_year, "month": cursor_month})
                cursor_month -= 1
                if cursor_month == 0:
                    cursor_month = 12
                    cursor_year -= 1
            periods.reverse()
        try:
            summary = (
                {"series": get_financial_series(handler.db_path, periods)}
                if periods is not None
                else get_financial_summary(handler.db_path, year=year, month=month)
            )
        except FinancialSummaryError as exc:
            incident_id = f"FIN-{uuid.uuid4().hex[:10].upper()}"
            print(f"[{incident_id}] Financial summary reconciliation failed: {exc}")
            handler.send_json({
                "error": "Không thể tải tổng hợp tài chính.",
                "detail": str(exc),
                "requestId": incident_id,
            }, 500)
            return True
        except Exception as exc:
            incident_id = f"FIN-{uuid.uuid4().hex[:10].upper()}"
            print(f"[{incident_id}] Financial summary failed: {exc}")
            handler.send_json({
                "error": "Không thể tải tổng hợp tài chính.",
                "detail": "Máy chủ không thể đối soát sổ Thu–Chi. Hãy kiểm tra log backend.",
                "requestId": incident_id,
            }, 500)
            return True
        handler.send_json(summary)
        return True

    if route == "/api/company-data/debt-payments":
        query = parse_qs(parsed.query)
        debt_id = query.get("debtId", [""])[0]
        if not debt_id:
            handler.send_json({"error": "Thiếu mã công nợ."}, 400)
            return True
        handler.send_json({"payments": list_debt_payments(handler.db_path, debt_id)})
        return True

    if route == "/api/company-data/inventory-movements":
        query = parse_qs(parsed.query)
        product_id = query.get("productId", [None])[0]
        state = read_state(handler.db_path) or {"data": {}}
        data = state.get("data") if isinstance(state.get("data"), dict) else {}
        handler.send_json({
            "movements": list_inventory_movements(handler.db_path, product_id),
            "ledgerBalanced": bool(data.get("inventoryLedgerBalanced", True)),
            "ledgerIssues": data.get("inventoryLedgerIssues") if isinstance(data.get("inventoryLedgerIssues"), list) else [],
        })
        return True

    state = read_state(handler.db_path)
    if route == "/api/payroll/workflow":
        state = state or {}
        data = state.get("data") if isinstance(state.get("data"), dict) else {}
        visible = handler.filter_payroll_data(data, user)
        handler.send_json({
            "payrollApprovals": visible.get("payrollApprovals", []),
            "midMonthRequests": visible.get("midMonthRequests", []),
            "payrollPayments": visible.get("payrollPayments", []),
            "updatedAt": state.get("updatedAt"),
            "version": state.get("version", 0),
        })
        return True

    if route == "/api/tasks":
        state = state or {}
        visible_state = handler.filter_state(state, user)
        data = visible_state.get("data") if isinstance(visible_state.get("data"), dict) else {}
        handler.send_json({
            "tasks": data.get("tasks", []),
            "updatedAt": state.get("updatedAt"),
            "version": state.get("version", 0),
        })
        return True

    if route == "/api/data/fields":
        if not state or not isinstance(state.get("data"), dict):
            handler.send_json({"exists": False, "data": {}, "updatedAt": None, "version": 0})
            return True
        visible_state = handler.filter_state(state, user)
        visible_data = visible_state.get("data") if isinstance(visible_state.get("data"), dict) else {}
        query = parse_qs(parsed.query)
        names = []
        for raw_name in query.get("names", []):
            names.extend(part.strip() for part in str(raw_name).split(",") if part.strip())
        selected = {name: visible_data.get(name) for name in dict.fromkeys(names)}
        handler.send_json({
            "exists": True,
            "data": selected,
            "updatedAt": state.get("updatedAt"),
            "version": state.get("version", 0),
        })
        return True

    handler.send_json(handler.filter_state(state, user) or {"data": None, "updatedAt": None, "version": 0})
    return True


def handle_put(handler, route, _parsed):
    if route not in {"/api/data/fields", "/api/data"}:
        return False
    user = handler.require_user()
    if not user:
        return True
    body = handler.read_json()
    if body is None:
        return True
    if not isinstance(body, dict) or "expectedVersion" not in body:
        handler.send_json({
            "error": "Thiếu phiên bản dữ liệu. Hãy tải lại trước khi lưu.",
            "code": "STATE_VERSION_REQUIRED",
        }, 428)
        return True
    try:
        expected_version = int(body.get("expectedVersion"))
        if expected_version < 0:
            raise ValueError
    except (TypeError, ValueError):
        handler.send_json({"error": "Phiên bản dữ liệu không hợp lệ."}, 400)
        return True

    def send_conflict(error):
        current = error.current_state or {}
        handler.send_json({
            "error": "Dữ liệu vừa được tài khoản khác cập nhật. Thay đổi này chưa được ghi; hãy tải lại và thực hiện lại.",
            "code": "STATE_VERSION_CONFLICT",
            "updatedAt": current.get("updatedAt"),
            "version": current.get("version", 0),
        }, 409)

    if route == "/api/data/fields":
        patch = body.get("data") if isinstance(body, dict) else None
        if not isinstance(patch, dict):
            handler.send_json({"error": "Dữ liệu cập nhật không hợp lệ"}, 400)
            return True
        def apply_patch(existing_data):
            merged_data = dict(existing_data)
            merged_data.update(patch)
            merged_data = preserve_missing_record_fields(existing_data, merged_data)
            preserved = handler.preserve_restricted_state(merged_data, user, existing_data)
            return reconcile_company_data(preserved)

        try:
            saved_state = update_state(handler.db_path, apply_patch, expected_version=expected_version)
        except StateConflictError as error:
            send_conflict(error)
            return True
        visible_state = handler.filter_state(saved_state, user) or {}
        visible_data = visible_state.get("data") if isinstance(visible_state.get("data"), dict) else {}
        response_keys = set(patch.keys())
        # Khi một mắt xích đơn hàng/kho/công nợ thay đổi, backend có thể đồng bộ thêm
        # các collection liên quan trong cùng transaction. Trả lại toàn bộ nhóm này để
        # tab hiện tại cập nhật ngay, không phải F5 hoặc đợi polling.
        if response_keys & SYNC_FIELDS:
            response_keys.update(SYNC_FIELDS)
        handler.send_json({
            "ok": True,
            "data": {key: visible_data.get(key) for key in response_keys if key in visible_data},
            "updatedAt": visible_state.get("updatedAt"),
            "version": visible_state.get("version", 0),
        })
        return True

    replacement = body.get("data")
    if not isinstance(replacement, dict):
        handler.send_json({"error": "Dữ liệu cập nhật không hợp lệ"}, 400)
        return True

    def replace_state(existing_data):
        merged_body = preserve_missing_record_fields(existing_data, replacement)
        preserved = handler.preserve_restricted_state(merged_body, user, existing_data)
        return reconcile_company_data(preserved)

    try:
        saved_state = update_state(handler.db_path, replace_state, expected_version=expected_version)
    except StateConflictError as error:
        send_conflict(error)
        return True
    handler.send_json({
        "ok": True,
        "updatedAt": saved_state.get("updatedAt"),
        "version": saved_state.get("version", 0),
    })
    return True

def _send_synced_fields(handler, saved_state, user, fields, extra=None):
    visible_state = handler.filter_state(saved_state, user) or {}
    visible_data = visible_state.get("data") if isinstance(visible_state.get("data"), dict) else {}
    payload = {
        "ok": True,
        "data": {field: visible_data.get(field) for field in fields if field in visible_data},
        "updatedAt": visible_state.get("updatedAt"),
        "version": visible_state.get("version", 0),
    }
    if extra:
        payload.update(extra)
    handler.send_json(payload)


def handle_post(handler, route, _parsed):
    if route not in {
        "/api/company-data/debt-payments",
        "/api/company-data/inventory-product",
        "/api/company-data/crm-orders",
        "/api/company-data/payroll-payments",
        "/api/company-data/payroll-reconciliation",
        "/api/company-data/director-password",
        "/api/company-data/director-password/verify",
    }:
        return False
    user = handler.require_user()
    if not user:
        return True
    body = handler.read_json()
    if body is None:
        return True

    if route == "/api/company-data/director-password":
        if _role(user) != "admin":
            handler.send_json({"error": "Chỉ Sếp/Admin được thay đổi mật khẩu Giám đốc."}, 403)
            return True
        current_password = str(body.get("currentPassword") or "")
        new_password = str(body.get("newPassword") or "")
        if len(new_password) < 10:
            handler.send_json({"error": "Mật khẩu Giám đốc phải có ít nhất 10 ký tự."}, 400)
            return True
        account = user_store.get_user_by_email(handler.db_path, user.get("email"), active_only=True)
        if not account or not verify_password(current_password, account.get("password_hash") if isinstance(account, dict) else account["password_hash"]):
            handler.send_json({"error": "Mật khẩu tài khoản Admin hiện tại không đúng."}, 403)
            return True

        def set_director_password(existing_data):
            result = dict(existing_data)
            company = dict(result.get("company") or {})
            company.pop("directorPassword", None)
            company["directorPasswordHash"] = password_hash(new_password)
            company["directorPasswordConfigured"] = True
            company["directorPasswordConfiguredAt"] = datetime.now(timezone.utc).isoformat()
            result["company"] = company
            return _audit_event(result, "director_password_changed", user, True, handler=handler)

        saved_state = update_state(handler.db_path, set_director_password)
        _send_synced_fields(handler, saved_state, user, ("company", "securityAuditLog"), {"configured": True})
        return True

    if route == "/api/company-data/director-password/verify":
        if _role(user) not in {"admin", "accountant"}:
            handler.send_json({"error": "Chỉ Sếp/Admin hoặc Kế toán được mở khóa sổ."}, 403)
            return True
        if _is_rate_limited(handler, user):
            handler.send_json({"error": "Bạn đã nhập sai quá nhiều lần. Hãy thử lại sau 10 phút."}, 429)
            return True
        supplied = str(body.get("password") or "")
        success_box = {"ok": False, "configured": False}

        def verify_director_password(existing_data):
            result = dict(existing_data)
            company = dict(result.get("company") or {})
            stored_hash = company.get("directorPasswordHash") or ""
            success_box["configured"] = bool(stored_hash)
            success_box["ok"] = bool(stored_hash and verify_password(supplied, stored_hash))
            return _audit_event(
                result,
                "director_password_verify",
                user,
                success_box["ok"],
                "Mở khóa sổ chấm công" if success_box["ok"] else "Sai mật khẩu hoặc chưa cấu hình",
                handler,
            )

        verification_state = update_state(handler.db_path, verify_director_password)
        if not success_box["configured"]:
            handler.send_json({
                "error": "Chưa cấu hình mật khẩu Giám đốc trong Cài đặt.",
                "version": verification_state.get("version", 0),
            }, 409)
            return True
        if not success_box["ok"]:
            _record_failed_attempt(handler, user)
            handler.send_json({
                "error": "Mật khẩu Giám đốc không đúng.",
                "version": verification_state.get("version", 0),
            }, 403)
            return True
        _clear_attempts(handler, user)
        handler.send_json({"ok": True, "version": verification_state.get("version", 0)})
        return True

    if route == "/api/company-data/crm-orders":
        _, employee, _ = handler.employee_context(user)
        position_role = handler.employee_position_role(employee)
        full_access = handler.is_full_admin(user)
        if not (full_access or position_role in {"sale", "ky_thuat"}):
            handler.send_json({"error": "Chỉ Sale, Kỹ thuật upsale, Kế toán hoặc Sếp/Admin được thêm đơn CRM."}, 403)
            return True

        result_box = {}

        def add_order(existing_data):
            saved, order_id = create_crm_order(
                existing_data,
                body,
                actor_email=user.get("email") or "",
                actor_employee_id=(employee or {}).get("id"),
                allow_assign_any=full_access,
            )
            result_box["orderId"] = order_id
            return saved

        saved_state = update_state(handler.db_path, add_order)
        visible_state = handler.filter_state(saved_state, user) or {}
        visible_data = visible_state.get("data") if isinstance(visible_state.get("data"), dict) else {}
        response_data = {
            field: visible_data.get(field)
            for field in SYNC_FIELDS
            if field in visible_data
        }
        created_order = next((
            item for item in (visible_data.get("orders") or [])
            if str(item.get("id")) == str(result_box.get("orderId"))
        ), None)
        handler.send_json({
            "ok": True,
            "orderId": result_box.get("orderId"),
            "order": created_order,
            "inventoryStatus": (created_order or {}).get("inventoryStatus"),
            "data": response_data,
            "updatedAt": visible_state.get("updatedAt"),
            "version": visible_state.get("version", 0),
        })
        return True

    if not handler.is_full_admin(user):
        handler.send_json({"error": "Chỉ Sếp/Admin hoặc Kế toán được thực hiện thao tác này."}, 403)
        return True

    if route == "/api/company-data/payroll-reconciliation":
        current_role = _role(user)
        if current_role not in {"accountant", "admin"}:
            handler.send_json({"error": "Chỉ Kế toán hoặc Sếp/Admin được xử lý đối soát lương."}, 403)
            return True

        employee_id = body.get("employeeId")
        employee = next((item for item in list_employees(handler.db_path) if str(item.get("id")) == str(employee_id)), None)
        if not employee:
            handler.send_json({"error": "Không tìm thấy hồ sơ nhân sự để đối soát lương."}, 404)
            return True

        def reconcile_payroll(existing_data):
            saved = resolve_payroll_reconciliation(
                existing_data,
                body,
                actor_email=user.get("email") or "",
                actor_name=body.get("actorName") or user.get("email") or "",
                employee=employee,
            )
            return reconcile_company_data(saved)

        saved_state = update_state(handler.db_path, reconcile_payroll)
        _send_synced_fields(handler, saved_state, user, ("payrollApprovals", "payrollPayments", "transactions"))
        return True

    if route == "/api/company-data/payroll-payments":
        current_role = _role(user)
        state_for_permission = read_state(handler.db_path) or {"data": {}}
        permission_data = state_for_permission.get("data") if isinstance(state_for_permission.get("data"), dict) else {}
        company_settings = permission_data.get("company") if isinstance(permission_data.get("company"), dict) else {}
        admin_can_pay = current_role == "admin" and bool(company_settings.get("allowAdminPayrollPayment"))
        if current_role != "accountant" and not admin_can_pay:
            handler.send_json({"error": "Chỉ Kế toán hoặc Admin được cấp quyền đặc biệt mới có thể chi trả lương."}, 403)
            return True
        employee_id = body.get("employeeId")
        employee = next((item for item in list_employees(handler.db_path) if str(item.get("id")) == str(employee_id)), None)
        if not employee:
            handler.send_json({"error": "Không tìm thấy hồ sơ nhân sự để chi trả lương."}, 404)
            return True
        meta = {}

        def pay_salary(existing_data):
            saved, payment_id = record_payroll_payment(
                existing_data,
                body,
                actor_email=user.get("email") or "",
                actor_name=body.get("actorName") or user.get("email") or "",
                employee=employee,
            )
            meta["paymentId"] = payment_id
            return reconcile_company_data(saved)

        saved_state = update_state(handler.db_path, pay_salary)
        _send_synced_fields(
            handler, saved_state, user,
            ("payrollApprovals", "payrollPayments", "transactions"),
            meta,
        )
        return True

    if route == "/api/company-data/debt-payments":
        debt_id = body.get("debtId")
        payment = body.get("payment") if isinstance(body.get("payment"), dict) else {}
        payment = dict(payment)
        payment["idempotencyKey"] = (
            payment.get("idempotencyKey")
            or body.get("idempotencyKey")
            or handler.headers.get("Idempotency-Key")
            or ""
        )
        result_meta = {}

        def apply_payment(existing_data):
            saved, payment_id = record_debt_payment(
                existing_data,
                debt_id,
                payment,
                created_by=user.get("email") or "",
            )
            result_meta["paymentId"] = payment_id
            return saved

        saved_state = update_state(handler.db_path, apply_payment)
        _send_synced_fields(
            handler,
            saved_state,
            user,
            ("debts", "transactions", "orders", "distributionOrders", "distributionSettlements", "paymentLedger"),
            result_meta,
        )
        return True

    product = body.get("product") if isinstance(body.get("product"), dict) else {}
    opening_stock = body.get("openingStock")

    def save_product(existing_data):
        return upsert_inventory_product(existing_data, product, opening_stock)

    saved_state = update_state(handler.db_path, save_product)
    _send_synced_fields(handler, saved_state, user, ("inventory", "stockMovements", "orders"))
    return True


def handle_delete(handler, route, _parsed):
    if route != "/api/company-data/debt-payments":
        return False
    user = handler.require_user()
    if not user:
        return True
    if not handler.is_full_admin(user):
        handler.send_json({"error": "Chỉ Sếp/Admin hoặc Kế toán được xóa lần thanh toán."}, 403)
        return True
    body = handler.read_json()
    if body is None:
        return True
    debt_id = body.get("debtId")
    payment_id = body.get("paymentId")

    reversal_reason = str(body.get("reason") or body.get("reversalReason") or "").strip()
    if not reversal_reason:
        handler.send_json({"error": "Cần nhập lý do đảo giao dịch."}, 400)
        return True

    def delete_payment(existing_data):
        return remove_debt_payment(
            existing_data,
            debt_id,
            payment_id,
            reversed_by=user.get("email") or "",
            reversal_reason=reversal_reason,
        )

    saved_state = update_state(handler.db_path, delete_payment)
    _send_synced_fields(
        handler,
        saved_state,
        user,
        ("debts", "transactions", "orders", "distributionOrders", "distributionSettlements", "paymentLedger"),
    )
    return True
