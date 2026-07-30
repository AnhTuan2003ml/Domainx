"""Đồng bộ các sổ nghiệp vụ chuẩn hoá từ trạng thái tương thích cũ.

Các collection trong ``app_state`` vẫn được giữ để không phá vỡ giao diện hiện tại,
nhưng các nghiệp vụ tiền, công nợ, lương và kho được phản chiếu sang bảng riêng.
Các báo cáo mới chỉ đọc từ những bảng này và dữ liệu nguồn đơn hàng/công nợ đã
được máy chủ đối soát.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def _as_list(value):
    return value if isinstance(value, list) else []


def _key(value):
    return "" if value is None else str(value)


def _number(value, default=0.0):
    try:
        return float(value if value is not None else default)
    except (TypeError, ValueError):
        return float(default)


def _date_only(value):
    text = str(value or "").strip()
    return text[:10] if len(text) >= 10 else text


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _status_is_cancelled(value):
    return str(value or "").strip().lower() in {
        "cancelled", "canceled", "rejected", "deleted", "huy", "đã hủy", "da_huy", "reversed"
    }


def _unique_value(conn, table, column, preferred, record_id):
    """Giữ mã legacy khi chưa trùng; nếu trùng thì thêm hậu tố theo ID."""
    base = str(preferred or "").strip()
    if not base:
        base = str(record_id)
    row = conn.execute(
        f"SELECT id FROM {table} WHERE {column} = ? AND id <> ?",
        (base, str(record_id)),
    ).fetchone()
    if not row:
        return base
    suffix = str(record_id).replace(" ", "-")[-16:]
    return f"{base}-{suffix}"


def _safe_idempotency_key(conn, key, payment_id):
    value = str(key or "").strip()
    if not value:
        return None
    row = conn.execute(
        "SELECT id FROM debt_payments WHERE idempotency_key = ? AND id <> ?",
        (value, str(payment_id)),
    ).fetchone()
    return None if row else value


def _upsert_cash_transaction(conn, tx: dict[str, Any]):
    tx_id = _key(tx.get("id"))
    if not tx_id or tx.get("kind") not in {"thu", "chi"}:
        return
    source_type = str(tx.get("sourceModule") or tx.get("source") or "manual").strip().lower() or "manual"
    source_id = _key(tx.get("sourceId") or tx.get("sourceOrderId") or tx.get("orderId") or tx_id)
    status = "reversed" if _status_is_cancelled(tx.get("status")) else "posted"
    conn.execute(
        """
        INSERT INTO cash_transactions (
            id, transaction_code, transaction_type, category, amount, transaction_date,
            status, source_type, source_id, description, payment_method, reference_no,
            created_by, created_at, reversed_at, reversed_by, reversal_reason, sync_origin
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            transaction_type = excluded.transaction_type,
            category = excluded.category,
            amount = excluded.amount,
            transaction_date = excluded.transaction_date,
            status = excluded.status,
            source_type = excluded.source_type,
            source_id = excluded.source_id,
            description = excluded.description,
            payment_method = excluded.payment_method,
            reference_no = excluded.reference_no,
            reversed_at = excluded.reversed_at,
            reversed_by = excluded.reversed_by,
            reversal_reason = excluded.reversal_reason,
            sync_origin = excluded.sync_origin
        """,
        (
            tx_id,
            str(tx.get("transactionCode") or tx.get("code") or tx_id),
            tx.get("kind"),
            str(tx.get("category") or ""),
            max(0.0, _number(tx.get("amount"))),
            _date_only(tx.get("date")),
            status,
            source_type,
            source_id,
            str(tx.get("desc") or tx.get("description") or ""),
            str(tx.get("paymentMethod") or ""),
            str(tx.get("paymentReference") or tx.get("referenceNo") or ""),
            str(tx.get("createdBy") or ""),
            str(tx.get("createdAt") or _now_iso()),
            str(tx.get("reversedAt") or "") or None,
            str(tx.get("reversedBy") or ""),
            str(tx.get("reversalReason") or ""),
            "app_state",
        ),
    )


def _sync_cash_transactions(conn, data):
    current_ids = []
    for tx in _as_list(data.get("transactions")):
        if not isinstance(tx, dict) or tx.get("kind") not in {"thu", "chi"}:
            continue
        tx_id = _key(tx.get("id"))
        if not tx_id:
            continue
        current_ids.append(tx_id)
        _upsert_cash_transaction(conn, tx)

    # Một khoản bị xóa khỏi app_state không được biến mất khỏi sổ kiểm toán.
    # Chỉ đánh dấu đảo với các bản ghi do app_state đồng bộ; bảng giữ nguyên dấu vết.
    if current_ids:
        placeholders = ",".join("?" for _ in current_ids)
        conn.execute(
            f"""
            UPDATE cash_transactions
            SET status = 'reversed', reversed_at = ?,
                reversal_reason = CASE WHEN reversal_reason = '' THEN 'Không còn trong trạng thái nghiệp vụ nguồn' ELSE reversal_reason END
            WHERE sync_origin = 'app_state' AND status = 'posted' AND id NOT IN ({placeholders})
            """,
            [_now_iso(), *current_ids],
        )
    else:
        conn.execute(
            """
            UPDATE cash_transactions
            SET status = 'reversed', reversed_at = ?,
                reversal_reason = CASE WHEN reversal_reason = '' THEN 'Không còn trong trạng thái nghiệp vụ nguồn' ELSE reversal_reason END
            WHERE sync_origin = 'app_state' AND status = 'posted'
            """,
            (_now_iso(),),
        )


def _sync_debt_payments(conn, data):
    ledger = [dict(item) for item in _as_list(data.get("paymentLedger")) if isinstance(item, dict)]
    reversals = {
        _key(item.get("reversalOf")): item
        for item in ledger
        if str(item.get("entryType") or "").lower() == "reversal" and item.get("reversalOf") is not None
    }
    debts = {
        _key(item.get("id")): item
        for item in _as_list(data.get("debts"))
        if isinstance(item, dict) and item.get("id") is not None
    }
    current_ids = []
    for entry in ledger:
        if str(entry.get("entryType") or "payment").lower() != "payment":
            continue
        payment_id = _key(entry.get("id"))
        amount = _number(entry.get("amount"))
        if not payment_id or amount <= 0:
            continue
        current_ids.append(payment_id)
        debt = debts.get(_key(entry.get("debtId")), {})
        reversal = reversals.get(payment_id)
        receipt_id = _key(entry.get("receiptTransactionId")) or f"tx:{payment_id}"
        payment_code = _unique_value(
            conn,
            "debt_payments",
            "payment_code",
            entry.get("paymentCode") or f"THU-{payment_id[-12:].upper()}",
            payment_id,
        )
        idempotency_key = _safe_idempotency_key(conn, entry.get("idempotencyKey"), payment_id)
        status = "reversed" if reversal else "posted"
        paid_at = _date_only(entry.get("date") or entry.get("paidAt") or entry.get("createdAt")) or "1970-01-01"
        conn.execute(
            """
            INSERT INTO debt_payments (
                id, payment_code, idempotency_key, debt_id, customer_id, order_id, amount,
                payment_method, paid_at, note, receipt_transaction_id, created_by, created_at,
                status, reversed_at, reversed_by, reversal_reason
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                payment_code = excluded.payment_code,
                idempotency_key = excluded.idempotency_key,
                debt_id = excluded.debt_id,
                customer_id = excluded.customer_id,
                order_id = excluded.order_id,
                amount = excluded.amount,
                payment_method = excluded.payment_method,
                paid_at = excluded.paid_at,
                note = excluded.note,
                receipt_transaction_id = excluded.receipt_transaction_id,
                status = excluded.status,
                reversed_at = excluded.reversed_at,
                reversed_by = excluded.reversed_by,
                reversal_reason = excluded.reversal_reason
            """,
            (
                payment_id,
                payment_code,
                idempotency_key,
                _key(entry.get("debtId")),
                _key(debt.get("counterpartyId")) or None,
                _key(entry.get("orderId") or debt.get("orderId") or debt.get("sourceId")) or None,
                amount,
                str(entry.get("paymentMethod") or "chuyen_khoan"),
                paid_at,
                str(entry.get("note") or ""),
                receipt_id,
                str(entry.get("createdBy") or ""),
                str(entry.get("createdAt") or _now_iso()),
                status,
                str((reversal or {}).get("createdAt") or "") or None,
                str((reversal or {}).get("createdBy") or ""),
                str((reversal or {}).get("note") or ""),
            ),
        )

        # Một debt_payment luôn phải trỏ tới đúng một bút toán tiền. Với dữ liệu
        # legacy đã đảo, app_state không còn dòng Thu/Chi đang hiệu lực, vì vậy tạo
        # lại chứng từ kiểm toán ở trạng thái reversed thay vì để lịch sử bị rỗng.
        transaction_kind = "chi" if str(debt.get("type") or "thu").lower() == "tra" else "thu"
        _upsert_cash_transaction(conn, {
            "id": receipt_id,
            "transactionCode": entry.get("paymentCode") or payment_code,
            "kind": transaction_kind,
            "category": "Thanh toán công nợ",
            "amount": amount,
            "date": paid_at,
            "status": "reversed" if reversal else "approved",
            "source": "congno_payment",
            "sourceModule": "congno_payment",
            "sourceId": payment_id,
            "debtId": entry.get("debtId"),
            "orderId": entry.get("orderId"),
            "desc": entry.get("note") or f"Thanh toán công nợ {entry.get('debtId') or ''}",
            "paymentMethod": entry.get("paymentMethod") or "chuyen_khoan",
            "paymentReference": entry.get("referenceNo") or "",
            "createdBy": entry.get("createdBy") or "",
            "createdAt": entry.get("createdAt") or _now_iso(),
            "reversedAt": (reversal or {}).get("createdAt"),
            "reversedBy": (reversal or {}).get("createdBy") or "",
            "reversalReason": (reversal or {}).get("note") or "",
        })

    # Không xóa chứng từ tài chính đã từng tồn tại. Nếu dữ liệu nguồn legacy làm
    # mất payment khỏi app_state, bảng chuẩn hoá giữ bản ghi nhưng đánh dấu reversed.
    if current_ids:
        placeholders = ",".join("?" for _ in current_ids)
        conn.execute(
            f"""
            UPDATE debt_payments
            SET status = 'reversed', reversed_at = ?,
                reversal_reason = CASE WHEN reversal_reason = '' THEN 'Không còn trong sổ thanh toán nguồn' ELSE reversal_reason END
            WHERE status = 'posted' AND id NOT IN ({placeholders})
            """,
            [_now_iso(), *current_ids],
        )
    else:
        conn.execute(
            """
            UPDATE debt_payments
            SET status = 'reversed', reversed_at = ?,
                reversal_reason = CASE WHEN reversal_reason = '' THEN 'Không còn trong sổ thanh toán nguồn' ELSE reversal_reason END
            WHERE status = 'posted'
            """,
            (_now_iso(),),
        )


def _validate_debt_payment_integrity(conn, data):
    """Chặn transaction nếu lịch sử công nợ và sổ Thu/Chi không liên kết 1-1."""
    ledger = [item for item in _as_list(data.get("paymentLedger")) if isinstance(item, dict)]
    reversal_ids = {
        _key(item.get("reversalOf"))
        for item in ledger
        if str(item.get("entryType") or "").lower() == "reversal"
    }
    payment_entries = [
        item for item in ledger
        if str(item.get("entryType") or "payment").lower() == "payment"
        and item.get("id") is not None and _number(item.get("amount")) > 0
    ]
    expected_by_debt = {}
    for entry in payment_entries:
        payment_id = _key(entry.get("id"))
        debt_id = _key(entry.get("debtId"))
        receipt_id = _key(entry.get("receiptTransactionId")) or f"tx:{payment_id}"
        expected_status = "reversed" if payment_id in reversal_ids else "posted"
        row = conn.execute(
            "SELECT id, debt_id, amount, receipt_transaction_id, status FROM debt_payments WHERE id = ?",
            (payment_id,),
        ).fetchone()
        if not row:
            raise ValueError(f"Sổ công nợ thiếu chứng từ thanh toán {payment_id}.")
        if _key(row["debt_id"]) != debt_id or abs(_number(row["amount"]) - _number(entry.get("amount"))) > 0.5:
            raise ValueError(f"Chứng từ thanh toán {payment_id} không khớp công nợ nguồn.")
        if _key(row["receipt_transaction_id"]) != receipt_id or str(row["status"]) != expected_status:
            raise ValueError(f"Chứng từ thanh toán {payment_id} chưa liên kết đúng sổ Thu–Chi.")
        cash = conn.execute(
            "SELECT id, amount, status, source_id FROM cash_transactions WHERE id = ?",
            (receipt_id,),
        ).fetchone()
        if not cash:
            raise ValueError(f"Thiếu bút toán tiền liên kết cho thanh toán {payment_id}.")
        if abs(_number(cash["amount"]) - _number(entry.get("amount"))) > 0.5 or str(cash["status"]) != expected_status:
            raise ValueError(f"Bút toán tiền {receipt_id} không khớp chứng từ công nợ.")
        if _key(cash["source_id"]) != payment_id:
            raise ValueError(f"Bút toán tiền {receipt_id} không trỏ về debt_payment {payment_id}.")
        if expected_status == "posted" and debt_id:
            expected_by_debt[debt_id] = expected_by_debt.get(debt_id, 0.0) + _number(entry.get("amount"))

    for debt in _as_list(data.get("debts")):
        if not isinstance(debt, dict) or debt.get("id") is None:
            continue
        debt_id = _key(debt.get("id"))
        expected = round(expected_by_debt.get(debt_id, 0.0), 2)
        row = conn.execute(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM debt_payments WHERE debt_id = ? AND status = 'posted'",
            (debt_id,),
        ).fetchone()
        actual = round(_number(row["total"] if row else 0), 2)
        if abs(expected - actual) > 0.5:
            raise ValueError(
                f"Sổ thanh toán công nợ {debt_id} không cân: paymentLedger={expected:g}đ, debt_payments={actual:g}đ."
            )


def _sync_payroll_payments(conn, data):
    for item in _as_list(data.get("payrollPayments")):
        if not isinstance(item, dict) or item.get("id") is None:
            continue
        payment_id = _key(item.get("id"))
        employee_id = _key(item.get("employeeId"))
        year = int(item.get("year") or 0)
        month = int(item.get("month") or 0)
        amount = _number(item.get("amount"))
        if not payment_id or not employee_id or year <= 0 or not 1 <= month <= 12 or amount <= 0:
            continue

        base_payroll_key = f"{employee_id}:{year}:{month}"
        status = "reversed" if item.get("reversedAt") else "posted"
        payroll_key = base_payroll_key
        owner = conn.execute(
            "SELECT id, status FROM payroll_payment_ledger WHERE payroll_key = ? AND id <> ?",
            (base_payroll_key, payment_id),
        ).fetchone()
        if owner:
            if status == "reversed":
                payroll_key = f"{base_payroll_key}:reversed:{payment_id}"
            else:
                # Dữ liệu legacy có hai khoản chi cùng kỳ: không làm sập toàn bộ
                # hệ thống. Giữ chứng từ đầu tiên đang hiệu lực, bản sau có khóa
                # riêng để vẫn còn dấu vết và được đánh dấu đảo.
                payroll_key = f"{base_payroll_key}:duplicate:{payment_id}"
                status = "reversed"

        expense_transaction_id = _key(item.get("linkedTxId") or item.get("expenseTransactionId"))
        if not expense_transaction_id:
            expense_transaction_id = f"salary-tx:{payment_id}"
        expense_transaction_id = _unique_value(
            conn,
            "payroll_payment_ledger",
            "expense_transaction_id",
            expense_transaction_id,
            payment_id,
        )

        conn.execute(
            """
            INSERT INTO payroll_payment_ledger (
                id, payroll_key, employee_id, payroll_year, payroll_month, amount,
                payment_method, paid_at, cash_account, reference_no, note,
                expense_transaction_id, status, created_by, created_at,
                reversed_at, reversed_by, reversal_reason
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                payroll_key = excluded.payroll_key,
                amount = excluded.amount,
                payment_method = excluded.payment_method,
                paid_at = excluded.paid_at,
                cash_account = excluded.cash_account,
                reference_no = excluded.reference_no,
                note = excluded.note,
                expense_transaction_id = excluded.expense_transaction_id,
                status = excluded.status,
                reversed_at = excluded.reversed_at,
                reversed_by = excluded.reversed_by,
                reversal_reason = excluded.reversal_reason
            """,
            (
                payment_id,
                payroll_key,
                employee_id,
                year,
                month,
                amount,
                str(item.get("paymentMethod") or "chuyen_khoan"),
                _date_only(item.get("paidDate") or item.get("paidAt") or item.get("createdAt")) or "1970-01-01",
                str(item.get("cashAccount") or item.get("account") or "quy_cong_ty"),
                str(item.get("referenceNo") or ""),
                str(item.get("note") or ""),
                expense_transaction_id,
                status,
                str(item.get("paidByEmail") or item.get("createdBy") or ""),
                str(item.get("paidAt") or item.get("createdAt") or _now_iso()),
                str(item.get("reversedAt") or "") or None,
                str(item.get("reversedBy") or ""),
                str(item.get("reversalReason") or ("Trùng khoản chi lương legacy" if status == "reversed" and owner else "")),
            ),
        )


def _sync_inventory_movements(conn, data):
    for item in _as_list(data.get("stockMovements")):
        if not isinstance(item, dict) or item.get("id") is None:
            continue
        movement_id = _key(item.get("id"))
        delta = _number(item.get("delta"), _number(item.get("quantityChange")))
        conn.execute(
            """
            INSERT INTO inventory_movements (
                id, product_id, product_name, movement_type, quantity_change, quantity_before,
                quantity_after, movement_date, source_type, source_id, reason,
                created_by, created_at, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                product_id = excluded.product_id,
                product_name = excluded.product_name,
                movement_type = excluded.movement_type,
                quantity_change = excluded.quantity_change,
                quantity_before = excluded.quantity_before,
                quantity_after = excluded.quantity_after,
                movement_date = excluded.movement_date,
                source_type = excluded.source_type,
                source_id = excluded.source_id,
                reason = excluded.reason,
                status = excluded.status
            """,
            (
                movement_id,
                _key(item.get("productId")),
                str(item.get("productName") or ""),
                str(item.get("movementType") or "adjustment"),
                delta,
                _number(item.get("quantityBefore"), 0),
                _number(item.get("quantityAfter"), 0),
                _date_only(item.get("date")),
                str(item.get("sourceModule") or "manual"),
                _key(item.get("sourceId")) or None,
                str(item.get("note") or item.get("reason") or ""),
                str(item.get("createdBy") or ""),
                str(item.get("createdAt") or _now_iso()),
                "reversed" if item.get("reversedAt") else "posted",
            ),
        )


def _sync_audit_logs(conn, data):
    for item in _as_list(data.get("securityAuditLog")):
        if not isinstance(item, dict) or item.get("id") is None:
            continue
        conn.execute(
            """
            INSERT INTO audit_logs (id, action, entity_type, entity_id, actor_email, detail, success, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET detail = excluded.detail, success = excluded.success
            """,
            (
                _key(item.get("id")),
                str(item.get("action") or ""),
                str(item.get("entityType") or "system"),
                _key(item.get("entityId")) or None,
                str(item.get("actorEmail") or ""),
                str(item.get("detail") or ""),
                1 if item.get("success", True) else 0,
                str(item.get("createdAt") or _now_iso()),
            ),
        )


def sync_operational_ledgers(conn, data):
    """Đồng bộ tất cả sổ chuẩn hoá trong chính transaction ghi app_state."""
    if not isinstance(data, dict):
        return
    _sync_cash_transactions(conn, data)
    _sync_debt_payments(conn, data)
    _sync_payroll_payments(conn, data)
    _sync_inventory_movements(conn, data)
    _sync_audit_logs(conn, data)
    _validate_debt_payment_integrity(conn, data)


def list_debt_payments(db_path, debt_id):
    from db.connection import connect
    with connect(db_path) as conn:
        rows = conn.execute(
            """
            SELECT id, payment_code, debt_id, customer_id, order_id, amount,
                   payment_method, paid_at, note, receipt_transaction_id,
                   created_by, created_at, status, reversed_at, reversed_by, reversal_reason
            FROM debt_payments
            WHERE debt_id = ?
            ORDER BY paid_at ASC, created_at ASC
            """,
            (_key(debt_id),),
        ).fetchall()
    return [dict(row) for row in rows]


def list_inventory_movements(db_path, product_id=None):
    from db.connection import connect
    with connect(db_path) as conn:
        if product_id is None:
            rows = conn.execute(
                """
                SELECT id, product_id, product_name, movement_type, quantity_change, quantity_before,
                       quantity_after, movement_date, source_type, source_id, reason,
                       created_by, created_at, status
                FROM inventory_movements
                ORDER BY movement_date DESC, created_at DESC
                LIMIT 1000
                """
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, product_id, product_name, movement_type, quantity_change, quantity_before,
                       quantity_after, movement_date, source_type, source_id, reason,
                       created_by, created_at, status
                FROM inventory_movements
                WHERE product_id = ?
                ORDER BY movement_date DESC, created_at DESC
                LIMIT 1000
                """,
                (_key(product_id),),
            ).fetchall()
    return [dict(row) for row in rows]
