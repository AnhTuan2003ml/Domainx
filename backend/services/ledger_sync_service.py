"""Đồng bộ SỔ CÁI hạch toán kép từ dữ liệu nghiệp vụ (app_state) — chạy SONG SONG.

Mỗi bản ghi nghiệp vụ sinh đúng MỘT sự kiện có mã ổn định rồi đi qua Posting Service:

  ORDER_SALE        Bán hàng (ghi nhận doanh thu):  Nợ 131 / Có 511 + Có 3331 (VAT đầu ra)
  ORDER_COGS        Giá vốn xuất bán:               Nợ 632 / Có 156 (bình quân gia quyền)
  DEBT_COLLECTED    Thu công nợ khách:              Nợ 111|112 / Có 131  (KHÔNG chạm 511)
  SUPPLIER_PAID     Trả nợ nhà cung cấp:            Nợ 331 / Có 111|112
  PURCHASE_IN       Nhập hàng chưa thanh toán:      Nợ 156 + Nợ 133 / Có 331
  MANUAL_EXPENSE    Chi phí hoạt động ghi tay:      Nợ 641|642 + Nợ 133 / Có 111|112
  MANUAL_INCOME     Thu ghi tay ngoài đơn hàng:     Nợ 111|112 / Có 511|711 + Có 3331
  PAYROLL_ACCRUAL   Ghi nhận lương phải trả:        Nợ 642 / Có 334
  PAYROLL_PAID      Chi trả lương:                  Nợ 334 / Có 111|112
  CAPITAL_IN        Góp vốn:                        Nợ 112 / Có 411

Idempotent tuyệt đối theo (source_type, source_id, event_type) — chạy lại không sinh trùng.
Thanh toán từng phần: ``source_id`` là ID CỦA TỪNG LẦN THANH TOÁN, không dùng ID công nợ.
Bút toán đỏ/khoản hủy ở dữ liệu cũ được ánh xạ thành BÚT TOÁN ĐẢO liên kết chứng từ gốc.
"""

from __future__ import annotations

from calendar import monthrange
from decimal import Decimal

from db.accounting_store import to_money
from db.connection import connect
from db.state_store import read_state
from services.posting_service import (
    PostingError,
    accounting_core_enabled,
    ensure_schema,
    post_entry_conn,
    reverse_entry_conn,
)

VAT_INVOICE_TYPES = {"Hóa đơn GTGT (VAT)"}

_LABEL_TO_CATEGORY = {
    "doanh thu bán hàng": "doanh_thu_ban_hang",
    "doanh thu marketing": "doanh_thu_marketing",
    "thu công nợ": "thu_cong_no",
    "thu dịch vụ": "thu_dich_vu",
    "thu khác": "thu_khac",
    "marketing / quảng cáo": "marketing_ads",
    "ăn uống / tiếp khách": "an_uong_tiep_khach",
}

_EXPENSE_ACCOUNT_BY_CATEGORY = {
    "marketing_ads": "641",
    "an_uong_tiep_khach": "642",
}
_INCOME_ACCOUNT_BY_CATEGORY = {
    "doanh_thu_ban_hang": "511",
    "doanh_thu_marketing": "511",
    "thu_dich_vu": "511",
    "thu_khac": "711",
    "tai_chinh": "515",
}


def _category_id(value):
    raw = str(value or "").strip()
    if not raw:
        return "khac"
    lowered = raw.lower()
    return _LABEL_TO_CATEGORY.get(lowered, raw if " " not in raw else "khac")


def _cash_account(payment_method):
    return "111" if str(payment_method or "") == "tien_mat" else "112"


def _split_vat(gross, vat_rate):
    """Tách VAT khỏi giá đã gồm thuế — VND làm tròn VỀ ĐỒNG theo từng chứng từ
    (không giữ số lẻ xu) để tổng các dòng luôn khớp thẻ tổng và sổ cái."""
    from decimal import ROUND_HALF_UP
    gross = to_money(gross)
    rate = Decimal(str(vat_rate or 0))
    if rate <= 0:
        return gross, to_money(0)
    vat = (gross - gross / (Decimal("1") + rate / Decimal("100"))).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return to_money(gross - vat), to_money(vat)


def _num(value):
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal("0")


# ---------------------------------------------------------------------------
# Giá vốn bình quân gia quyền sau mỗi lần nhập
# ---------------------------------------------------------------------------

def _build_costing(data):
    """Chạy lại dòng thời gian kho theo bình quân gia quyền.

    Trả về (valuation_rows, sale_costs) — sale_costs: movement_id -> (qty, unit_cost, assumed).
    Giá nhập lấy từ ĐƠN NHẬP lịch sử (distributionOrders.purchase, giá chưa VAT); tồn đầu
    dùng costPrice hồ sơ và đánh dấu ``cost_assumed`` để minh bạch giả định chuyển đổi.
    """
    products = {str(p.get("id")): p for p in (data.get("inventory") or []) if isinstance(p, dict)}
    purchase_cost = {}
    for order in data.get("distributionOrders") or []:
        if not isinstance(order, dict) or order.get("orderKind") != "purchase":
            continue
        net_unit, _vat = _split_vat(_num(order.get("unitCost")), order.get("vatRate"))
        purchase_cost[str(order.get("id"))] = net_unit

    movements = [m for m in (data.get("stockMovements") or []) if isinstance(m, dict)]
    # Tồn đầu (opening) phải đứng TRƯỚC mọi nghiệp vụ cùng ngày — nếu sort thuần theo id,
    # đơn bán cùng ngày có thể bị replay khi tồn = 0 làm thẻ kho lệch với tồn thật.
    _OPENING_TYPES = {"opening", "initial", "opening_balance"}

    def _movement_sort_key(m):
        mtype = str(m.get("movementType") or "")
        return (
            str(m.get("date") or m.get("createdAt") or ""),
            0 if mtype in _OPENING_TYPES else 1,
            str(m.get("id")),
        )

    movements.sort(key=_movement_sort_key)

    state = {}
    rows = []
    sale_costs = {}
    for movement in movements:
        pid = str(movement.get("productId"))
        qty = _num(movement.get("quantity"))
        delta = _num(movement.get("delta") if movement.get("delta") is not None else movement.get("quantity"))
        if qty <= 0 and delta == 0:
            continue
        current = state.setdefault(pid, {"qty": Decimal("0"), "value": Decimal("0")})
        mtype = str(movement.get("movementType") or "")
        assumed = 0
        if delta > 0:
            if mtype in {"purchase", "purchase_in"} and str(movement.get("sourceId")) in purchase_cost:
                unit_cost = purchase_cost[str(movement.get("sourceId"))]
            else:
                unit_cost = to_money(_num(products.get(pid, {}).get("costPrice")))
                assumed = 1
            qty_in = delta
            before_qty, before_value = current["qty"], current["value"]
            current["qty"] += qty_in
            current["value"] += qty_in * unit_cost
        else:
            qty_out = -delta
            before_qty, before_value = current["qty"], current["value"]
            avg = to_money(current["value"] / current["qty"]) if current["qty"] > 0 else to_money(_num(products.get(pid, {}).get("costPrice")))
            if current["qty"] <= 0:
                assumed = 1
            unit_cost = avg
            current["qty"] = current["qty"] - qty_out
            current["value"] = current["value"] - qty_out * avg
            if current["qty"] <= 0:
                current["qty"] = max(current["qty"], Decimal("0"))
                current["value"] = max(current["value"], Decimal("0"))
            # Tên movement thật của app: sale_out (bán CRM) và distribution_out (xuất phân phối).
            if mtype in {"sale", "sale_out", "distribution_sale", "distribution_out"}:
                sale_costs[str(movement.get("id"))] = (qty_out, avg, assumed)
        avg_after = to_money(current["value"] / current["qty"]) if current["qty"] > 0 else to_money(0)
        rows.append({
            "product_id": pid,
            "movement_key": f"val:{movement.get('id')}",
            "movement_date": str(movement.get("date") or movement.get("createdAt") or "")[:10],
            "movement_type": mtype,
            "quantity": str(delta),
            "unit_cost": str(to_money(unit_cost)),
            "qty_before": str(before_qty), "value_before": str(to_money(before_value)),
            "qty_after": str(current["qty"]), "value_after": str(to_money(current["value"])),
            "avg_cost_after": str(avg_after), "cost_assumed": assumed,
            "source_note": str(movement.get("note") or ""),
        })
    return rows, sale_costs


# ---------------------------------------------------------------------------
# Sinh danh sách sự kiện từ app_state
# ---------------------------------------------------------------------------

_CANCELLED_ORDER_TOKENS = {"cancelled", "canceled", "deleted", "huy", "đã hủy", "da_huy"}


def _order_cancelled(order):
    return str(order.get("status") or "").strip().lower() in _CANCELLED_ORDER_TOKENS


def _order_events(data, sale_costs):
    events = []
    reversals = []
    movements_by_order = {}
    for movement in data.get("stockMovements") or []:
        if isinstance(movement, dict) and str(movement.get("movementType")) in {"sale", "sale_out"}:
            movements_by_order.setdefault(str(movement.get("sourceId")), []).append(movement)
    products = {str(p.get("id")): p for p in (data.get("inventory") or []) if isinstance(p, dict)}
    for order in data.get("orders") or []:
        if not isinstance(order, dict):
            continue
        # Đơn ĐÃ HỦY: không sinh chứng từ mới; nếu doanh thu/giá vốn đã ghi sổ
        # thì tạo BÚT TOÁN ĐẢO liên kết chứng từ gốc (không xóa).
        if _order_cancelled(order):
            reversals.append({
                "target_source": ("order", str(order.get("id"))),
                "reason": "Đơn hàng đã hủy — đảo doanh thu ghi nhận",
                "date": str(order.get("date") or "")[:10],
            })
            for movement in movements_by_order.get(str(order.get("id")), []):
                reversals.append({
                    "target_source": ("stock_movement", str(movement.get("id"))),
                    "reason": "Đơn hàng đã hủy — đảo giá vốn xuất bán (hoàn kho)",
                    "date": str(order.get("date") or "")[:10],
                })
            continue
        amount = to_money(_num(order.get("amount")))
        if amount <= 0:
            continue
        # VAT ĐẦU RA: đơn NHIỀU DÒNG tính VAT THEO TỪNG DÒNG rồi cộng lại (mỗi dòng làm tròn
        # riêng) — sổ cái, sổ VAT và bảng chi tiết luôn khớp nhau từng đồng, không lệch làm tròn.
        items = order.get("items") if isinstance(order.get("items"), list) else None
        vat_rate = _num(order.get("vatRate"))
        if items:
            vat = Decimal("0")
            max_rate = Decimal("0")
            for line in items:
                if not isinstance(line, dict):
                    continue
                line_rate = _num(line.get("vatRate"))
                line_total = to_money(_num(line.get("lineTotal")))
                if line_rate > 0 and line_total > 0:
                    _line_net, line_vat = _split_vat(line_total, line_rate)
                    vat += line_vat
                    max_rate = max(max_rate, line_rate)
            vat = to_money(vat)
            net = to_money(amount - vat)
            vat_rate = max_rate
        else:
            if vat_rate <= 0 and order.get("productId") is not None:
                vat_rate = _num(products.get(str(order.get("productId")), {}).get("vatRate"))
            vat_rate = vat_rate if vat_rate > 0 else 0
            net, vat = _split_vat(amount, vat_rate)
        lines = [
            {"account": "131", "debit": amount, "description": f"Phải thu {order.get('customerName') or ''}", "customer_id": str(order.get("customerId") or "")},
            {"account": "511", "credit": net, "description": "Doanh thu chưa VAT"},
        ]
        if vat > 0:
            lines.append({"account": "3331", "credit": vat, "description": f"VAT đầu ra {vat_rate}%"})
        events.append({
            "event_type": "ORDER_SALE", "source_type": "order", "source_id": str(order.get("id")),
            "document_date": str(order.get("date") or "")[:10], "description": f"Bán hàng — {order.get('customerName') or ''} ({order.get('productName') or 'dịch vụ'})",
            "business_type": "sales", "lines": lines,
            "metadata": {"invoiceNo": order.get("invoiceNo") or "", "gross": str(amount), "net": str(net), "vat": str(vat)},
        })
        for movement in movements_by_order.get(str(order.get("id")), []):
            cost_info = sale_costs.get(str(movement.get("id")))
            if not cost_info:
                continue
            qty, unit_cost, _assumed = cost_info
            cogs = to_money(qty * unit_cost)
            if cogs <= 0:
                continue
            events.append({
                "event_type": "ORDER_COGS", "source_type": "stock_movement", "source_id": str(movement.get("id")),
                "document_date": str(order.get("date") or "")[:10],
                "description": f"Giá vốn xuất bán đơn #{order.get('id')}",
                "business_type": "cogs",
                "lines": [
                    {"account": "632", "debit": cogs, "product_id": str(movement.get("productId"))},
                    {"account": "156", "credit": cogs, "product_id": str(movement.get("productId"))},
                ],
            })
    return events, reversals


def _payment_events(data):
    events = []
    reversals = []
    debts = {str(d.get("id")): d for d in (data.get("debts") or []) if isinstance(d, dict)}
    for entry in data.get("paymentLedger") or []:
        if not isinstance(entry, dict):
            continue
        entry_type = str(entry.get("entryType") or "payment")
        debt = debts.get(str(entry.get("debtId")))
        debt_type = str((debt or {}).get("type") or "thu")
        amount = to_money(abs(_num(entry.get("amount"))))
        if amount <= 0:
            continue
        cash = _cash_account(entry.get("paymentMethod"))
        date = str(entry.get("date") or entry.get("createdAt") or "")[:10]
        if entry_type == "reversal" and entry.get("reversalOf"):
            reversals.append({
                "target_source": ("debt_payment", str(entry.get("reversalOf"))),
                "reason": str(entry.get("note") or "Hủy thanh toán công nợ"),
                "date": date,
            })
            continue
        if debt_type == "thu":
            events.append({
                "event_type": "DEBT_COLLECTED", "source_type": "debt_payment", "source_id": str(entry.get("id")),
                "document_date": date, "description": f"Thu công nợ {(debt or {}).get('counterpartyName') or ''}",
                "business_type": "receivable",
                "lines": [
                    {"account": cash, "debit": amount},
                    {"account": "131", "credit": amount, "customer_id": str((debt or {}).get("counterpartyId") or "")},
                ],
            })
        else:
            events.append({
                "event_type": "SUPPLIER_PAID", "source_type": "debt_payment", "source_id": str(entry.get("id")),
                "document_date": date, "description": f"Trả nợ NCC {(debt or {}).get('counterpartyName') or ''}",
                "business_type": "payable",
                "lines": [
                    {"account": "331", "debit": amount, "supplier_id": str((debt or {}).get("counterpartyId") or "")},
                    {"account": cash, "credit": amount},
                ],
            })
    return events, reversals


def _is_manual_entry_tx(tx):
    """Giao dịch NHẬP TAY (kể cả legacy chưa gắn marker) — loại trừ mọi bản ghi tự sinh.

    Bản ghi tự sinh luôn mang dấu vết nguồn (source/sourceModule/sourceId/debtId/
    settlementId/payrollId) và đã được ghi sổ qua đúng sự kiện gốc (DEBT_COLLECTED,
    PAYROLL_PAID, ORDER_SALE...) — tuyệt đối không ghi trùng lần hai ở đây.
    """
    source = str(tx.get("source") or tx.get("sourceModule") or "").strip()
    if source == "manual_finance_hub":
        return True
    if source:
        return False
    return not any(tx.get(field) for field in ("sourceId", "sourceOrderId", "debtId", "settlementId", "payrollId", "linkedOrderId"))


def _manual_tx_events(data):
    events = []
    reversals = []
    for tx in data.get("transactions") or []:
        if not isinstance(tx, dict) or not _is_manual_entry_tx(tx):
            continue
        amount = _num(tx.get("amount"))
        date = str(tx.get("date") or "")[:10]
        if tx.get("reversalOf"):
            reversals.append({
                "target_source": ("manual_tx", str(tx.get("reversalOf"))),
                "reason": str(tx.get("desc") or "Bút toán đỏ"),
                "date": date,
            })
            continue
        if amount <= 0:
            continue
        gross = to_money(amount)
        category = _category_id(tx.get("category"))
        # Đầu vào 133 chỉ khấu trừ khi có hóa đơn GTGT; đầu ra 3331 tách theo thuế suất khai báo.
        input_vat_ok = str(tx.get("invoiceType") or "") in VAT_INVOICE_TYPES and _num(tx.get("vatRate")) > 0
        output_vat_ok = _num(tx.get("vatRate")) > 0
        vat_ok = input_vat_ok if str(tx.get("kind")) == "chi" else output_vat_ok
        net, vat = _split_vat(gross, tx.get("vatRate") if vat_ok else 0)
        cash = _cash_account(tx.get("paymentMethod"))
        if str(tx.get("kind")) == "chi":
            expense_account = _EXPENSE_ACCOUNT_BY_CATEGORY.get(category, "642")
            lines = [{"account": expense_account, "debit": net, "description": str(tx.get("desc") or "")}]
            if vat > 0:
                lines.append({"account": "133", "debit": vat, "description": f"VAT đầu vào {tx.get('vatRate')}%"})
            lines.append({"account": cash, "credit": gross})
            events.append({
                "event_type": "MANUAL_EXPENSE", "source_type": "manual_tx", "source_id": str(tx.get("id")),
                "document_date": date, "description": str(tx.get("desc") or "Chi phí hoạt động"),
                "business_type": "expense", "lines": lines,
                "metadata": {"invoiceNo": tx.get("invoiceNo") or "", "vatRate": str(tx.get("vatRate") or 0)},
            })
        else:
            income_account = _INCOME_ACCOUNT_BY_CATEGORY.get(category, "511")
            lines = [{"account": cash, "debit": gross}]
            lines.append({"account": income_account, "credit": net, "description": str(tx.get("desc") or "")})
            if vat > 0:
                lines.append({"account": "3331", "credit": vat, "description": f"VAT đầu ra {tx.get('vatRate')}%"})
            events.append({
                "event_type": "MANUAL_INCOME", "source_type": "manual_tx", "source_id": str(tx.get("id")),
                "document_date": date, "description": str(tx.get("desc") or "Khoản thu khác"),
                "business_type": "income", "lines": lines,
                "metadata": {"invoiceNo": tx.get("invoiceNo") or "", "vatRate": str(tx.get("vatRate") or 0)},
            })
    return events, reversals


_PAYROLL_APPROVED_STATUSES = {
    "director_approved", "ready_for_payment", "paid",
    "da_duyet_cho_thanh_toan", "cho_ke_toan_chi_tra", "da_chi_tra",
}


def _payroll_approval_amount(approval):
    """Số lương đã duyệt — cùng công thức _proposal_amount của payroll_payment_service."""
    override = _num(approval.get("approvedAmountOverride"))
    if override > 0:
        return override
    work_days = max(Decimal("0"), _num(approval.get("requestedWorkDays")))
    daily = max(Decimal("0"), _num(approval.get("requestedDailySalary", approval.get("requestedBaseSalary"))))
    bonus = max(Decimal("0"), _num(approval.get("requestedBonus")))
    allowance = max(Decimal("0"), _num(approval.get("requestedAllowance")))
    deductions = sum(max(Decimal("0"), _num(approval.get(field))) for field in (
        "requestedInsuranceDeduction", "requestedTaxDeduction",
        "requestedAdvanceDeduction", "requestedOtherDeduction",
    ))
    if deductions <= 0:
        deductions = max(Decimal("0"), _num(approval.get("requestedDeduction")))
    return max(Decimal("0"), work_days * daily + bonus + allowance - deductions)


def _payroll_events(data):
    """CHỐT bảng lương (Sếp duyệt) = ghi nhận CHI PHÍ ngay: Nợ 642 / Có 334 — dù chưa trả tiền.
    THANH TOÁN chỉ tất toán khoản phải trả: Nợ 334 / Có 111·112 — không ghi chi phí lần hai."""
    events = []
    accrued_approval_ids = set()
    for approval in data.get("payrollApprovals") or []:
        if not isinstance(approval, dict):
            continue
        status = str(approval.get("approval_status") or approval.get("status") or "").strip().lower()
        if status not in _PAYROLL_APPROVED_STATUSES:
            continue
        amount = to_money(_payroll_approval_amount(approval))
        if amount <= 0:
            continue
        year = int(_num(approval.get("year")) or 0)
        month = int(_num(approval.get("month")) or 0)
        if not (1 <= month <= 12) or year < 2000:
            continue
        aid = str(approval.get("id") or f"{approval.get('employeeId')}:{year}-{month}")
        accrued_approval_ids.add(aid)
        employee = str(approval.get("employeeId") or "")
        # Chi phí thuộc KỲ LƯƠNG — ghi vào ngày cuối tháng của kỳ để báo cáo tháng/quý khớp.
        last_day = monthrange(year, month)[1]
        events.append({
            "event_type": "PAYROLL_ACCRUAL", "source_type": "payroll_approval", "source_id": aid,
            "document_date": f"{year:04d}-{month:02d}-{last_day:02d}",
            "description": f"Chốt bảng lương {month}/{year} — {approval.get('employeeName') or f'NV #{employee}'}",
            "business_type": "payroll",
            "lines": [
                {"account": "642", "debit": amount, "employee_id": employee},
                {"account": "334", "credit": amount, "employee_id": employee},
            ],
        })
    for payment in data.get("payrollPayments") or []:
        if not isinstance(payment, dict):
            continue
        amount = to_money(_num(payment.get("amount")))
        if amount <= 0 or str(payment.get("status") or "posted") == "reversed" or payment.get("reversedAt"):
            continue
        pid = str(payment.get("id") or f"{payment.get('employeeId')}:{payment.get('paidDate')}")
        date = str(payment.get("paidDate") or payment.get("paidAt") or "")[:10]
        cash = _cash_account(payment.get("paymentMethod"))
        employee = str(payment.get("employeeId") or "")
        has_accrued_approval = str(payment.get("approvalId") or "") in accrued_approval_ids
        if not has_accrued_approval:
            # Khoản chi lương cũ không gắn hồ sơ duyệt — giữ hành vi cũ (accrual + paid cùng lúc)
            # để dữ liệu lịch sử không mất chi phí lương.
            events.append({
                "event_type": "PAYROLL_ACCRUAL", "source_type": "payroll_payment", "source_id": pid,
                "document_date": date, "description": f"Ghi nhận lương phải trả NV #{employee}",
                "business_type": "payroll",
                "lines": [
                    {"account": "642", "debit": amount, "employee_id": employee},
                    {"account": "334", "credit": amount, "employee_id": employee},
                ],
            })
        events.append({
            "event_type": "PAYROLL_PAID", "source_type": "payroll_payment", "source_id": f"{pid}:paid",
            "document_date": date, "description": f"Chi trả lương NV #{employee}",
            "business_type": "payroll",
            "lines": [
                {"account": "334", "debit": amount, "employee_id": employee},
                {"account": cash, "credit": amount},
            ],
        })
    return events


def _capital_events(data):
    events = []
    for contribution in data.get("capitalContributions") or []:
        if not isinstance(contribution, dict):
            continue
        amount = to_money(_num(contribution.get("value")))
        if amount <= 0 or str(contribution.get("assetType") or "") != "tien_mat":
            continue
        events.append({
            "event_type": "CAPITAL_IN", "source_type": "capital", "source_id": str(contribution.get("id")),
            "document_date": str(contribution.get("contributionDate") or "")[:10],
            "description": f"Góp vốn — {contribution.get('contributorName') or ''}",
            "business_type": "equity",
            "lines": [
                {"account": "112", "debit": amount},
                {"account": "411", "credit": amount},
            ],
        })
    return events


def _purchase_events(data):
    events = []
    for order in data.get("distributionOrders") or []:
        if not isinstance(order, dict) or order.get("orderKind") != "purchase":
            continue
        qty = _num(order.get("quantity")) or Decimal("1")
        gross = to_money(_num(order.get("totalCost") or (_num(order.get("unitCost")) * qty)))
        if gross <= 0:
            continue
        net, vat = _split_vat(gross, order.get("vatRate"))
        lines = [{"account": "156", "debit": net, "product_id": str(order.get("productId") or "")}]
        if vat > 0:
            lines.append({"account": "133", "debit": vat, "description": f"VAT đầu vào {order.get('vatRate')}%"})
        lines.append({"account": "331", "credit": gross, "supplier_id": str(order.get("partnerId") or "")})
        events.append({
            "event_type": "PURCHASE_IN", "source_type": "purchase_order", "source_id": str(order.get("id")),
            "document_date": str(order.get("date") or "")[:10],
            "description": f"Nhập hàng {order.get('productName') or ''} từ đối tác",
            "business_type": "purchase", "lines": lines,
            "metadata": {"invoiceNo": order.get("invoiceNo") or "", "vatRate": str(order.get("vatRate") or 0)},
        })
    return events


_STOCK_INTAKE_TYPES = {"opening", "initial", "opening_balance", "adjustment_in"}
_STOCK_INTAKE_LABELS = {
    "opening": "Tồn đầu kỳ", "initial": "Tồn đầu kỳ", "opening_balance": "Tồn đầu kỳ",
    "adjustment_in": "Nhập điều chỉnh kho",
}


def _stock_intake_events(data, valuation_rows):
    """Tồn đầu / nhập điều chỉnh kho phải có bút toán Nợ 156 — nếu không, TK 156 chỉ
    có phát sinh Có (giá vốn xuất bán) và số dư hiển thị âm dù kho đầy hàng."""
    import os as _os
    counter = (_os.environ.get("DOMIX_OPENING_INVENTORY_COUNTER", "411").strip() or "411")
    value_by_movement = {}
    for row in valuation_rows:
        if row.get("movement_type") in _STOCK_INTAKE_TYPES:
            qty = _num(row.get("quantity"))
            unit_cost = _num(row.get("unit_cost"))
            if qty > 0 and unit_cost >= 0:
                value_by_movement[str(row.get("movement_key") or "")[4:]] = (qty, to_money(qty * unit_cost))
    products = {str(p.get("id")): p for p in (data.get("inventory") or []) if isinstance(p, dict)}
    events = []
    for movement in data.get("stockMovements") or []:
        if not isinstance(movement, dict):
            continue
        mid = str(movement.get("id"))
        if mid not in value_by_movement or str(movement.get("status") or "posted") == "reversed":
            continue
        qty, value = value_by_movement[mid]
        if value <= 0:
            continue
        mtype = str(movement.get("movementType") or "")
        product = products.get(str(movement.get("productId")), {})
        label = _STOCK_INTAKE_LABELS.get(mtype, "Nhập kho")
        events.append({
            "event_type": "STOCK_INTAKE", "source_type": "stock_movement", "source_id": mid,
            "document_date": str(movement.get("date") or movement.get("createdAt") or "")[:10],
            "description": f"{label} — {product.get('name') or movement.get('productName') or ''} (SL {qty})",
            "business_type": "inventory",
            "lines": [
                {"account": "156", "debit": value, "product_id": str(movement.get("productId"))},
                {"account": counter, "credit": value, "description": f"Đối ứng {label.lower()}"},
            ],
            "metadata": {"movementType": mtype, "note": str(movement.get("note") or "")},
        })
    return events


def build_events(data):
    _valuation_rows, sale_costs = _build_costing(data)
    events = []
    order_events, order_reversals = _order_events(data, sale_costs)
    events += order_events
    payment_events, payment_reversals = _payment_events(data)
    events += payment_events
    manual_events, manual_reversals = _manual_tx_events(data)
    events += manual_events
    events += _payroll_events(data)
    events += _capital_events(data)
    events += _purchase_events(data)
    # Nợ 156 cho tồn đầu/nhập điều chỉnh — cân với giá vốn xuất bán (Có 156).
    events += _stock_intake_events(data, _valuation_rows)
    return events, order_reversals + payment_reversals + manual_reversals, _valuation_rows


# ---------------------------------------------------------------------------
# Preview / commit
# ---------------------------------------------------------------------------

def sync_ledger(db_path, mode="commit", actor="system"):
    """Đối chiếu app_state với sổ cái; ``preview`` chỉ đếm — KHÔNG ghi gì."""
    ensure_schema(db_path)
    state = read_state(db_path) or {}
    data = state.get("data") if isinstance(state.get("data"), dict) else {}
    events, reversals, valuation_rows = build_events(data)

    posted, skipped, errors = 0, 0, []
    reversed_count = 0
    with connect(db_path) as conn:
        existing = {
            (row["source_type"], row["source_id"], row["event_type"])
            for row in conn.execute(
                "SELECT source_type, source_id, event_type FROM journal_entries"
            ).fetchall()
        }
        # Chống ghi ĐÔI tồn đầu: sản phẩm đã có ĐỢT TỒN ĐẦU (Opening Inventory Batch)
        # ghi sổ Nợ 156 thì movement "opening" của nó KHÔNG sinh thêm STOCK_INTAKE.
        batch_covered_products = {
            str(row["product_id"])
            for row in conn.execute(
                "SELECT DISTINCT l.product_id FROM journal_entry_lines l"
                " JOIN journal_entries e ON e.id = l.journal_entry_id"
                " WHERE e.source_type = 'opening_batch' AND e.status = 'posted'"
                " AND l.account_code = '156' AND l.product_id IS NOT NULL"
            ).fetchall()
        }
        events = [
            event for event in events
            if not (
                event["event_type"] == "STOCK_INTAKE"
                and str((event.get("metadata") or {}).get("movementType")) in {"opening", "initial", "opening_balance"}
                and str(event["lines"][0].get("product_id")) in batch_covered_products
            )
        ]
        pending = [
            event for event in events
            if (event["source_type"], str(event["source_id"]), event["event_type"]) not in existing
        ]
        if mode == "preview":
            total = sum(
                sum(_num(line.get("debit") or 0) for line in event["lines"])
                for event in pending
            )
            return {
                "mode": "preview",
                "pendingEntries": len(pending),
                "pendingReversals": len(reversals),
                "alreadyPosted": len(events) - len(pending),
                "totalDebit": str(to_money(total)),
                "valuationRows": len(valuation_rows),
            }

        for row in valuation_rows:
            conn.execute(
                """
                INSERT INTO inventory_valuation_ledger (
                    product_id, movement_key, movement_date, movement_type, quantity, unit_cost,
                    qty_before, value_before, qty_after, value_after, avg_cost_after, cost_assumed, source_note
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (movement_key) DO UPDATE SET
                    movement_date = EXCLUDED.movement_date,
                    movement_type = EXCLUDED.movement_type,
                    quantity = EXCLUDED.quantity,
                    unit_cost = EXCLUDED.unit_cost,
                    qty_before = EXCLUDED.qty_before,
                    value_before = EXCLUDED.value_before,
                    qty_after = EXCLUDED.qty_after,
                    value_after = EXCLUDED.value_after,
                    avg_cost_after = EXCLUDED.avg_cost_after,
                    cost_assumed = EXCLUDED.cost_assumed,
                    source_note = EXCLUDED.source_note
                """,
                (
                    row["product_id"], row["movement_key"], row["movement_date"], row["movement_type"],
                    row["quantity"], row["unit_cost"], row["qty_before"], row["value_before"],
                    row["qty_after"], row["value_after"], row["avg_cost_after"], row["cost_assumed"],
                    row["source_note"],
                ),
            )

        for event in pending:
            try:
                result = post_entry_conn(conn, created_by=actor, approved_by="system", **event)
                posted += 1 if result.get("created") else 0
                skipped += 0 if result.get("created") else 1
            except PostingError as exc:
                errors.append({"event": event["event_type"], "source": str(event["source_id"]), "error": str(exc)})

        for reversal in reversals:
            source_type, source_id = reversal["target_source"]
            target = conn.execute(
                "SELECT id, status FROM journal_entries WHERE source_type = ? AND source_id = ? AND status = 'posted'",
                (source_type, source_id),
            ).fetchone()
            if not target:
                continue
            try:
                reverse_entry_conn(conn, target["id"], actor, reversal["reason"], reversal["date"])
                reversed_count += 1
            except PostingError as exc:
                errors.append({"event": "REVERSAL", "source": source_id, "error": str(exc)})

        # ĐỐI SOÁT VAT chứng từ cũ: bút toán bán hàng đã ghi sổ trước khi biết thuế suất
        # (thiếu 3331) không được âm thầm để VAT = 0 — tự tạo BÚT TOÁN ĐẢO + chứng từ đúng,
        # dấu vết đầy đủ, idempotent (chỉ chạy một lần cho mỗi đơn nhờ event ORDER_SALE_VATFIX).
        import json as _json
        for event in events:
            if event["event_type"] != "ORDER_SALE":
                continue
            computed_vat = sum(_num(line.get("credit") or 0) for line in event["lines"] if line["account"] == "3331")
            if computed_vat <= 0:
                continue
            existing_entry = conn.execute(
                "SELECT id, status, metadata FROM journal_entries"
                " WHERE source_type = 'order' AND source_id = ? AND event_type = 'ORDER_SALE'",
                (str(event["source_id"]),),
            ).fetchone()
            if not existing_entry or existing_entry["status"] != "posted":
                continue
            try:
                old_vat = _num((_json.loads(existing_entry["metadata"] or "{}") or {}).get("vat"))
            except Exception:  # noqa: BLE001
                old_vat = Decimal("0")
            # VND ghi sổ nguyên đồng — lệch từ nửa xu trở lên là chuẩn hóa lại (đảo + ghi mới,
            # dấu vết đầy đủ); sau chuẩn hóa computed == stored nên không lặp vô hạn.
            if abs(old_vat - computed_vat) < Decimal("0.005"):
                continue
            already_fixed = conn.execute(
                "SELECT 1 AS found FROM journal_entries"
                " WHERE source_type = 'order' AND source_id = ? AND event_type = 'ORDER_SALE_VATFIX'",
                (str(event["source_id"]),),
            ).fetchone()
            if already_fixed:
                continue
            try:
                reverse_entry_conn(
                    conn, existing_entry["id"], actor,
                    "Đối soát VAT đầu ra: chứng từ cũ chưa tách 3331 theo thuế suất sản phẩm",
                    event["document_date"],
                )
                fix_event = dict(event)
                fix_event["event_type"] = "ORDER_SALE_VATFIX"
                fix_event["description"] = f"{event['description']} (ghi lại sau đối soát VAT)"
                post_entry_conn(conn, created_by=actor, approved_by="system", **fix_event)
                reversed_count += 1
                posted += 1
            except PostingError as exc:
                errors.append({"event": "ORDER_SALE_VATFIX", "source": str(event["source_id"]), "error": str(exc)})

    return {
        "mode": "commit", "posted": posted, "skipped": skipped,
        "reversed": reversed_count, "errors": errors[:20],
        "valuationRows": len(valuation_rows),
    }


def sync_after_save(db_path, actor="system"):
    """Gọi sau mỗi lần lưu nghiệp vụ (best-effort, có cờ tắt DOMIX_ACCOUNTING_CORE=0)."""
    if not accounting_core_enabled():
        return None
    try:
        return sync_ledger(db_path, mode="commit", actor=actor)
    except Exception as exc:  # noqa: BLE001 — sổ song song không được làm hỏng nghiệp vụ chính
        print(f"[ACCOUNTING] Đồng bộ sổ cái thất bại (sẽ thử lại lần lưu sau): {exc}")
        return None
