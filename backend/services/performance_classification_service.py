"""Phân loại hiệu suất dùng chung cho header, dashboard và bảng chi tiết."""

from __future__ import annotations


def _number(value):
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def classify_employee(employee):
    if not isinstance(employee, dict) or employee.get("status") == "inactive":
        return "insufficient"
    role = str(employee.get("roleType") or "").lower()
    if role in {"sale", "sales"}:
        target = _number(employee.get("salesTarget"))
        actual = _number(employee.get("salesActual"))
        if target <= 0:
            return "insufficient"
        ratio = actual / target
    elif role in {"ads", "marketing"}:
        target = _number(employee.get("adSpend"))
        actual = _number(employee.get("adRevenue"))
        if target <= 0 and actual <= 0:
            return "insufficient"
        ratio = actual / max(1.0, target)
        if ratio >= 3:
            return "good"
        if ratio < 1:
            return "improve"
        return "warning"
    else:
        assigned = _number(employee.get("tasksAssigned"))
        completed = _number(employee.get("tasksCompleted"))
        on_time = _number(employee.get("tasksOnTime"))
        if assigned <= 0:
            score = _number(employee.get("customScore"))
            if score <= 0:
                return "insufficient"
            ratio = score / 100
        else:
            completion = completed / assigned
            punctual = on_time / max(1.0, completed)
            ratio = completion * 0.7 + punctual * 0.3
    if ratio >= 0.9:
        return "good"
    if ratio < 0.6:
        return "improve"
    return "warning"


def summarize_performance(employees):
    counts = {"good": 0, "warning": 0, "improve": 0, "insufficient": 0}
    employee_ids = {key: [] for key in counts}
    for employee in employees or []:
        if not isinstance(employee, dict) or employee.get("status") == "inactive":
            continue
        category = classify_employee(employee)
        counts[category] += 1
        employee_ids[category].append(employee.get("id"))
    return {"counts": counts, "employee_ids": employee_ids}
