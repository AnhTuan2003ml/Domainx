# -*- coding: utf-8 -*-
"""Chẩn đoán vì sao một nhân viên KHÔNG phát sinh bảo hiểm trong kỳ.

Dùng khi cùng một bản code chạy đúng trên máy này nhưng sai trên máy khác: khác biệt
gần như luôn nằm ở DỮ LIỆU hồ sơ, không phải ở code. Script đọc thẳng hồ sơ nhân sự
trong DB và soi lại đúng những điều kiện mà engine lương (computePayroll trong
src/App.jsx) dùng để quyết định có tính bảo hiểm hay không:

  1. Loại hợp đồng có thuộc diện BH bắt buộc không  (chỉ "chinh_thuc").
  2. Có bật chế độ SỐ TIỀN CỐ ĐỊNH mà để mức 0đ không  (bẫy hay gặp nhất).
  3. Lương làm căn cứ đóng BH có > 0 không.
  4. Ngày vào làm / ngày nghỉ việc có nằm ngoài kỳ đang xem không.

Chạy trong container backend:
    python scripts/check_insurance.py            # kỳ tháng hiện tại
    python scripts/check_insurance.py 2026 9     # kỳ chỉ định
"""
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import DEFAULT_DB_TARGET  # noqa: E402
from db import employee_store  # noqa: E402

CONTRACT_HAS_INSURANCE = {"chinh_thuc": True, "thu_viec": False, "ctv": False}
CONTRACT_LABEL = {"chinh_thuc": "Chính thức", "thu_viec": "Thử việc", "ctv": "Cộng tác viên"}


def _number(value):
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _date_parts(value):
    text = str(value or "").strip()[:10]
    if len(text) != 10:
        return None
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def diagnose(employee, year, month):
    """Trả danh sách lý do khiến nhân viên này không phát sinh bảo hiểm."""
    reasons = []
    contract_type = str(employee.get("contractType") or "chinh_thuc")
    if not CONTRACT_HAS_INSURANCE.get(contract_type, True):
        reasons.append(
            f"loại hợp đồng '{CONTRACT_LABEL.get(contract_type, contract_type)}' không thuộc diện BH bắt buộc"
        )

    fixed_mode = int(_number(employee.get("insuranceFixedMode")))
    declared = _number(employee.get("insuranceEmployeeAmount")) + _number(employee.get("insuranceEmployerAmount"))
    if fixed_mode == 1 and declared <= 0:
        reasons.append(
            "BẬT chế độ 'số tiền cố định' nhưng mức khai là 0đ "
            "(vào tab Bảo hiểm > Sửa bảo hiểm để khai mức thật hoặc chọn '% theo luật')"
        )

    base = _number(employee.get("insuranceSalary")) or _number(employee.get("baseSalary"))
    if base <= 0:
        reasons.append("lương làm căn cứ đóng BH đang là 0đ (chưa khai lương cơ bản)")

    joined = _date_parts(employee.get("joined"))
    if joined and (joined.year, joined.month) > (year, month):
        reasons.append(f"ngày vào làm {joined.isoformat()} nằm SAU kỳ {month}/{year}")

    if str(employee.get("status") or "") == "inactive":
        resigned = _date_parts(employee.get("resignedDate"))
        if resigned and (resigned.year, resigned.month) < (year, month):
            reasons.append(f"đã nghỉ việc từ {resigned.isoformat()}, trước kỳ {month}/{year}")

    return contract_type, fixed_mode, declared, base, reasons


def main():
    today = date.today()
    year = int(sys.argv[1]) if len(sys.argv) > 2 else today.year
    month = int(sys.argv[2]) if len(sys.argv) > 2 else today.month

    employees = employee_store.list_employees(DEFAULT_DB_TARGET)
    print(f"Kỳ {month}/{year} · {len(employees)} nhân sự\n")

    problems = 0
    for employee in employees:
        contract_type, fixed_mode, declared, base, reasons = diagnose(employee, year, month)
        name = str(employee.get("name") or "(chưa đặt tên)")
        head = (
            f"{name}  ·  HĐ {CONTRACT_LABEL.get(contract_type, contract_type)}"
            f"  ·  lương đóng BH {base:,.0f}đ"
            f"  ·  cơ chế {'CỐ ĐỊNH' if fixed_mode == 1 else '% theo luật'}"
        )
        if not reasons:
            expected = base * 0.105
            print(f"  OK    {head}  ->  NV đóng ~{expected:,.0f}đ")
            continue
        problems += 1
        print(f"  LỖI   {head}")
        for reason in reasons:
            print(f"          - {reason}")

    print()
    if problems:
        print(f"=> {problems} nhân sự KHÔNG phát sinh bảo hiểm. Xem lý do ở trên.")
    else:
        print("=> Mọi nhân sự thuộc diện đóng BH đều đang được tính bình thường.")


if __name__ == "__main__":
    main()
