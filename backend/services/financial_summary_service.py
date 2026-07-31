"""Nguồn tổng hợp tài chính duy nhất cho Tổng quan và các báo cáo.

Dịch vụ này chỉ đọc. Mọi bút toán phải được đồng bộ vào các sổ chuẩn hoá trong
transaction ghi dữ liệu. Nếu sổ chuẩn hoá lỗi hoặc lệch với dữ liệu nghiệp vụ,
API phải báo lỗi rõ ràng thay vì âm thầm trả các số 0.
"""

from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime

from db.connection import connect, table_exists
from db.employee_store import list_employees
from db.state_store import read_state
from services.business_sync_service import reconcile_company_data
from services.invoice_status_service import summarize_invoices
from services.performance_classification_service import summarize_performance


_CANCELLED = {"cancelled", "canceled", "deleted", "huy", "đã hủy", "da_huy", "rejected", "reversed"}
_PAYROLL_SOURCES = {"payroll", "payroll_payment", "bangluong", "salary_payment"}


class FinancialSummaryError(RuntimeError):
    """Sổ tài chính không thể tổng hợp an toàn."""


def _as_list(value):
    return value if isinstance(value, list) else []


def _number(value, default=0.0):
    try:
        return float(value if value is not None else default)
    except (TypeError, ValueError):
        return float(default)


def _date_only(value):
    if isinstance(value, (date, datetime)):
        return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()
    text = str(value or "").strip()
    return text[:10] if len(text) >= 10 else text


def _period_bounds(year=None, month=None):
    if year and month:
        year, month = int(year), int(month)
        return f"{year:04d}-{month:02d}-01", f"{year:04d}-{month:02d}-{monthrange(year, month)[1]:02d}"
    return None, None


def _in_period(value, start, end):
    if not start:
        return True
    current = _date_only(value)
    return bool(current and start <= current <= end)


def _valid_status(item):
    return str((item or {}).get("orderStatus") or (item or {}).get("status") or "").strip().lower() not in _CANCELLED


def _recognized_revenue(data, start, end):
    """Doanh thu phát sinh, không phải tiền đã thu."""
    orders = [item for item in _as_list(data.get("orders")) if isinstance(item, dict)]
    sales = sum(
        max(0.0, _number(item.get("amount")))
        for item in orders
        if _valid_status(item) and _in_period(item.get("date"), start, end)
    )
    distribution = sum(
        max(0.0, _number(item.get("revenue")))
        for item in _as_list(data.get("distributionOrders"))
        if isinstance(item, dict)
        and _valid_status(item)
        and _in_period(item.get("date"), start, end)
        and item.get("orderKind") != "purchase"
        and item.get("countsAsRevenue") is not False
        and not item.get("sourceCrmOrderId")
    )
    return round(sales + distribution), {
        "sales": round(sales),
        "distribution": round(distribution),
        "marketing": 0,
        "other": 0,
    }


def _receivables(data):
    total = 0.0
    for debt in _as_list(data.get("debts")):
        if not isinstance(debt, dict) or debt.get("type") != "thu":
            continue
        if str(debt.get("status") or "").lower() in _CANCELLED | {"paid"}:
            continue
        total += max(0.0, _number(debt.get("remainingAmount"), _number(debt.get("amount"))))
    return round(total)


def _payables(data):
    total = 0.0
    for debt in _as_list(data.get("debts")):
        if not isinstance(debt, dict) or debt.get("type") != "tra":
            continue
        if str(debt.get("status") or "").lower() in _CANCELLED | {"paid"}:
            continue
        total += max(0.0, _number(debt.get("remainingAmount"), _number(debt.get("amount"))))
    return round(total)


def _proposal_amount(approval):
    override = _number((approval or {}).get("approvedAmountOverride"), 0)
    if override > 0:
        return override
    work_days = max(0.0, _number((approval or {}).get("requestedWorkDays")))
    daily_salary = max(0.0, _number(
        (approval or {}).get("requestedDailySalary", (approval or {}).get("requestedBaseSalary"))
    ))
    bonus = max(0.0, _number((approval or {}).get("requestedBonus")))
    allowance = max(0.0, _number((approval or {}).get("requestedAllowance")))
    deductions = sum(max(0.0, _number((approval or {}).get(field))) for field in (
        "requestedInsuranceDeduction", "requestedTaxDeduction", "requestedAdvanceDeduction", "requestedOtherDeduction",
    ))
    if deductions <= 0:
        deductions = max(0.0, _number((approval or {}).get("requestedDeduction")))
    return max(0.0, work_days * daily_salary + bonus + allowance - deductions)


def _payroll_accrual(data, year, month):
    """Chi phí lương đã được duyệt của kỳ, tách khỏi dòng tiền chi lương."""
    if not year or not month:
        return 0, 0
    payroll = 0.0
    employer_insurance = 0.0
    for approval in _as_list(data.get("payrollApprovals")):
        if not isinstance(approval, dict):
            continue
        if int(approval.get("year") or 0) != int(year) or int(approval.get("month") or 0) != int(month):
            continue
        status = str(approval.get("approval_status") or approval.get("status") or "").lower()
        if status not in {"director_approved", "ready_for_payment", "paid", "da_duyet_cho_thanh_toan", "cho_ke_toan_chi_tra", "da_chi_tra"}:
            continue
        payroll += _proposal_amount(approval)
        employer_insurance += max(0.0, _number(
            approval.get("employer_insurance_snapshot", approval.get("employerInsuranceSnapshot", approval.get("employerInsurance")))
        ))
    return round(payroll), round(employer_insurance)


def _cash_from_state(data, start=None, end=None):
    """Tính đối chiếu từ app_state; không dùng để che lỗi sổ chuẩn hoá."""
    period = {"thu": 0.0, "chi": 0.0}
    cumulative = {"thu": 0.0, "chi": 0.0}
    for item in _as_list(data.get("transactions")):
        if not isinstance(item, dict):
            continue
        kind = str(item.get("kind") or "").strip().lower()
        if kind not in period:
            continue
        status = str(item.get("status") or "").strip().lower()
        if status in _CANCELLED:
            continue
        amount = max(0.0, _number(item.get("amount")))
        tx_date = _date_only(item.get("date"))
        if not end or (tx_date and tx_date <= end):
            cumulative[kind] += amount
        if _in_period(tx_date, start, end):
            period[kind] += amount
    return period, cumulative


def _date_expression(conn, column_name):
    """Ép kiểu ngày trực tiếp trên PostgreSQL cho cả cột TEXT và TIMESTAMP lịch sử."""
    return f"CAST({column_name} AS DATE)"


def _ledger_totals(conn, start, end):
    if not table_exists(conn, "cash_transactions"):
        raise FinancialSummaryError("Chưa có sổ giao dịch cash_transactions.")

    tx_date = _date_expression(conn, "transaction_date")
    period_sql = """
        SELECT transaction_type, COALESCE(source_type, '') AS source_type,
               COALESCE(SUM(amount), 0.0) AS total
        FROM cash_transactions
        WHERE status = 'posted'
    """
    period_params = []
    if start:
        period_sql += f" AND {tx_date} >= ? AND {tx_date} <= ?"
        period_params.extend([start, end])
    period_sql += " GROUP BY transaction_type, source_type"
    period_rows = conn.execute(period_sql, period_params).fetchall()

    cumulative_sql = """
        SELECT transaction_type, COALESCE(SUM(amount), 0.0) AS total
        FROM cash_transactions
        WHERE status = 'posted'
    """
    cumulative_params = []
    if end:
        cumulative_sql += f" AND {tx_date} <= ?"
        cumulative_params.append(end)
    cumulative_sql += " GROUP BY transaction_type"
    cumulative_rows = conn.execute(cumulative_sql, cumulative_params).fetchall()

    period = {"thu": 0.0, "chi": 0.0}
    payroll_cash_spent = 0.0
    operating_cash_spent = 0.0
    for row in period_rows:
        kind = str(row["transaction_type"] or "").lower()
        source = str(row["source_type"] or "").lower()
        amount = _number(row["total"])
        if kind in period:
            period[kind] += amount
        if kind == "chi":
            if source in _PAYROLL_SOURCES:
                payroll_cash_spent += amount
            else:
                operating_cash_spent += amount

    cumulative = {"thu": 0.0, "chi": 0.0}
    for row in cumulative_rows:
        kind = str(row["transaction_type"] or "").lower()
        if kind in cumulative:
            cumulative[kind] = _number(row["total"])
    return period, cumulative, operating_cash_spent, payroll_cash_spent


def _assert_debt_payment_ledger(conn, data):
    """Đảm bảo công nợ, debt_payments và cash_transactions cùng một chuỗi chứng từ."""
    if not table_exists(conn, "debt_payments"):
        raise FinancialSummaryError("Chưa có sổ chứng từ thanh toán debt_payments.")
    totals = {}
    rows = conn.execute(
        """
        SELECT dp.debt_id, dp.id, dp.amount, dp.receipt_transaction_id, dp.status,
               ct.id AS cash_id, ct.amount AS cash_amount, ct.status AS cash_status, ct.source_id
        FROM debt_payments dp
        LEFT JOIN cash_transactions ct ON ct.id = dp.receipt_transaction_id
        """
    ).fetchall()
    for row in rows:
        if not row["cash_id"]:
            raise FinancialSummaryError(f"Thanh toán {row['id']} chưa có bút toán Thu/Chi liên kết.")
        if abs(_number(row["amount"]) - _number(row["cash_amount"])) > 0.5:
            raise FinancialSummaryError(f"Thanh toán {row['id']} lệch số tiền với sổ Thu–Chi.")
        if str(row["status"]) != str(row["cash_status"]):
            raise FinancialSummaryError(f"Thanh toán {row['id']} lệch trạng thái với sổ Thu–Chi.")
        if str(row["source_id"] or "") != str(row["id"]):
            raise FinancialSummaryError(f"Bút toán {row['receipt_transaction_id']} không trỏ về thanh toán {row['id']}.")
        if str(row["status"]) == "posted":
            key = str(row["debt_id"] or "")
            totals[key] = totals.get(key, 0.0) + _number(row["amount"])

    for debt in _as_list(data.get("debts")):
        if not isinstance(debt, dict) or debt.get("id") is None:
            continue
        debt_id = str(debt.get("id"))
        paid = round(max(0.0, _number(debt.get("paidAmount"))), 2)
        posted = round(totals.get(debt_id, 0.0), 2)
        if abs(paid - posted) > 0.5:
            raise FinancialSummaryError(
                f"Công nợ {debt_id} không cân: đã thanh toán {paid:,.0f}đ nhưng chứng từ hiệu lực {posted:,.0f}đ."
            )


def _assert_ledger_matches_state(ledger, state_values, label):
    for kind in ("thu", "chi"):
        db_value = round(_number(ledger.get(kind)))
        state_value = round(_number(state_values.get(kind)))
        if db_value != state_value:
            raise FinancialSummaryError(
                f"Sổ giao dịch không cân ở {label}: {kind} trong cash_transactions = {db_value:,.0f}đ, "
                f"nhưng dữ liệu nghiệp vụ = {state_value:,.0f}đ. Hãy chạy đối soát sổ trước khi xem báo cáo."
            )


def get_financial_summary(db_path, year=None, month=None):
    state = read_state(db_path) or {"data": {}}
    data = reconcile_company_data(state.get("data") if isinstance(state.get("data"), dict) else {})
    start, end = _period_bounds(year, month)
    state_period, state_cumulative = _cash_from_state(data, start, end)

    try:
        with connect(db_path) as conn:
            cash, cumulative_cash, operating_cash_spent, payroll_cash_spent = _ledger_totals(conn, start, end)
            _assert_debt_payment_ledger(conn, data)
    except FinancialSummaryError:
        raise
    except Exception as exc:
        raise FinancialSummaryError(f"Không thể đọc sổ Thu–Chi chuẩn hoá: {exc}") from exc

    # Không âm thầm dùng 0 hoặc fallback khi sổ chuẩn hoá đang lệch.
    _assert_ledger_matches_state(cash, state_period, "kỳ báo cáo")
    _assert_ledger_matches_state(cumulative_cash, state_cumulative, "lũy kế")

    revenue, breakdown = _recognized_revenue(data, start, end)
    cash_received = round(cash.get("thu", 0.0))
    cash_spent = round(cash.get("chi", 0.0))
    company = data.get("company") if isinstance(data.get("company"), dict) else {}
    opening = round(_number(company.get("openingCashBalance")))
    cash_balance = opening + round(cumulative_cash.get("thu", 0.0)) - round(cumulative_cash.get("chi", 0.0))
    receivable = _receivables(data)
    inventory = [item for item in _as_list(data.get("inventory")) if isinstance(item, dict)]
    employees = list_employees(db_path)
    performance = summarize_performance(employees)
    invoices = summarize_invoices(_as_list(data.get("orders")))
    payroll_accrued, employer_insurance_accrued = _payroll_accrual(data, year, month)
    accounting_profit = revenue - round(operating_cash_spent) - payroll_accrued - employer_insurance_accrued

    return {
        "period": {"year": int(year) if year else None, "month": int(month) if month else None, "start": start, "end": end},
        "recognized_revenue": revenue,
        "cash_received": cash_received,
        "accounts_receivable": receivable,
        "accounts_payable": _payables(data),
        "cash_spent": cash_spent,
        "operating_cash_spent": round(operating_cash_spent),
        "payroll_cash_spent": round(payroll_cash_spent),
        "payroll_expense_accrued": payroll_accrued,
        "employer_insurance_accrued": employer_insurance_accrued,
        "opening_cash_balance": opening,
        "cash_balance": cash_balance,
        "net_cash_flow": cash_received - cash_spent,
        "accounting_profit": accounting_profit,
        # Giữ tên cũ để frontend cũ không vỡ; giá trị nay là lợi nhuận kế toán đúng định nghĩa.
        "operating_profit": accounting_profit,
        "revenue_breakdown": breakdown,
        "inventory_product_count": len(inventory),
        "inventory_stock_total": round(sum(max(0.0, _number(item.get("stock"))) for item in inventory)),
        "inventory_ledger_balanced": bool(data.get("inventoryLedgerBalanced", True)),
        "inventory_ledger_issues": _as_list(data.get("inventoryLedgerIssues")),
        "performance_counts": performance["counts"],
        "performance_employee_ids": performance["employee_ids"],
        "invoice_counts": invoices["counts"],
        "invoice_order_ids": invoices["order_ids"],
        "ledger_source": "cash_transactions",
        "ledger_warning": None,
        "updated_at": state.get("updatedAt"),
        "data_quality": {
            "cash_ledger_balanced": True,
            "inventory_ledger_balanced": bool(data.get("inventoryLedgerBalanced", True)),
            "debt_payment_ledger_balanced": True,
        },
    }


def get_financial_series(db_path, periods):
    """Tổng hợp nhiều kỳ bằng đúng cùng một dịch vụ, không dùng phép cộng frontend."""
    result = []
    for raw in periods or []:
        try:
            year = int((raw or {}).get("year"))
            month = int((raw or {}).get("month"))
        except (TypeError, ValueError) as exc:
            raise FinancialSummaryError("Danh sách kỳ báo cáo không hợp lệ.") from exc
        if year < 2000 or not 1 <= month <= 12:
            raise FinancialSummaryError("Danh sách kỳ báo cáo không hợp lệ.")
        result.append(get_financial_summary(db_path, year=year, month=month))
    return result
