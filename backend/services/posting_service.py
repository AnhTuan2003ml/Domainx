"""Posting Service — cổng ghi sổ hạch toán kép DUY NHẤT của DOMIX.

Mọi phân hệ muốn sinh bút toán phải đi qua ``post_entry``/các hàm sự kiện tại đây.
Không màn hình nào được tự dựng logic Nợ/Có riêng; mapping tài khoản theo MÃ SỰ KIỆN
(event_type) ổn định, tuyệt đối không dò từ khóa trong diễn giải.

Bảo đảm:
  - Tổng Nợ = tổng Có (kiểm ở service, CHECK từng dòng ở database).
  - Idempotent theo ``idempotency_key`` và (source_type, source_id, event_type).
  - Chứng từ đã posted bất biến — sai sót xử lý bằng bút toán đảo có liên kết gốc.
  - Kỳ đã khóa (accounting_periods) không nhận nghiệp vụ mới/đảo.
  - Người lập không được tự duyệt chứng từ tay (maker–checker).
  - Tiền dùng Decimal; NUMERIC trong database — không float.
"""

from __future__ import annotations

import json
import os
import uuid
from decimal import Decimal, InvalidOperation

from db.accounting_store import account_exists, create_accounting_tables, to_money
from db.connection import DatabaseIntegrityError, connect


class PostingError(Exception):
    """Lỗi nghiệp vụ kế toán — thông điệp tiếng Việt, trả thẳng cho người dùng."""


def accounting_core_enabled() -> bool:
    return os.environ.get("DOMIX_ACCOUNTING_CORE", "1").strip() not in {"0", "false", "off"}


def ensure_schema(db_path):
    with connect(db_path) as conn:
        create_accounting_tables(conn)


# ---------------------------------------------------------------------------
# Khóa kỳ kế toán
# ---------------------------------------------------------------------------

def _period_key(date_str: str) -> str:
    return str(date_str or "")[:7]


def period_is_locked(conn, date_str: str) -> bool:
    row = conn.execute(
        "SELECT status FROM accounting_periods WHERE period_key = ?",
        (_period_key(date_str),),
    ).fetchone()
    return bool(row and row["status"] == "locked")


def lock_period(db_path, period_key: str, locked_by: str):
    with connect(db_path) as conn:
        conn.execute(
            """
            INSERT INTO accounting_periods (period_key, status, locked_by, locked_at, updated_at)
            VALUES (?, 'locked', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (period_key) DO UPDATE SET
                status = 'locked', locked_by = EXCLUDED.locked_by,
                locked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            """,
            (period_key, locked_by),
        )
        _audit(conn, "period_lock", period_key, locked_by, f"Khóa kỳ {period_key}")


def unlock_period(db_path, period_key: str, reopened_by: str, reason: str):
    if not str(reason or "").strip():
        raise PostingError("Mở lại kỳ đã khóa bắt buộc phải có lý do.")
    with connect(db_path) as conn:
        conn.execute(
            """
            INSERT INTO accounting_periods (period_key, status, reopen_reason, reopened_by, updated_at)
            VALUES (?, 'open', ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT (period_key) DO UPDATE SET
                status = 'open', reopen_reason = EXCLUDED.reopen_reason,
                reopened_by = EXCLUDED.reopened_by, updated_at = CURRENT_TIMESTAMP
            """,
            (period_key, reason.strip(), reopened_by),
        )
        _audit(conn, "period_unlock", period_key, reopened_by, f"Mở lại kỳ {period_key}: {reason.strip()}")


def list_periods(db_path):
    with connect(db_path) as conn:
        return conn.execute(
            "SELECT period_key, status, locked_by, locked_at, reopen_reason, reopened_by, updated_at"
            " FROM accounting_periods ORDER BY period_key DESC"
        ).fetchall()


def _audit(conn, action, entity_id, actor, detail):
    conn.execute(
        "INSERT INTO audit_logs (id, action, entity_type, entity_id, actor_email, detail)"
        " VALUES (?, ?, 'accounting', ?, ?, ?)",
        (f"acc:{uuid.uuid4().hex}", action, str(entity_id), actor or "", detail or ""),
    )


# ---------------------------------------------------------------------------
# Ghi sổ
# ---------------------------------------------------------------------------

def _validate_lines(conn, lines):
    if not isinstance(lines, list) or len(lines) < 2:
        raise PostingError("Chứng từ phải có tối thiểu 2 dòng bút toán.")
    total_debit = Decimal("0")
    total_credit = Decimal("0")
    cleaned = []
    for index, raw in enumerate(lines, start=1):
        account = str(raw.get("account") or "").strip()
        if not account_exists(conn, account):
            raise PostingError(f"Dòng {index}: tài khoản {account or '(trống)'} không tồn tại hoặc không được hạch toán chi tiết.")
        try:
            debit = to_money(raw.get("debit") or 0)
            credit = to_money(raw.get("credit") or 0)
        except (InvalidOperation, ValueError):
            raise PostingError(f"Dòng {index}: số tiền không hợp lệ.")
        if debit < 0 or credit < 0:
            raise PostingError(f"Dòng {index}: số tiền không được âm.")
        if debit > 0 and credit > 0:
            raise PostingError(f"Dòng {index}: một dòng không được vừa Nợ vừa Có.")
        if debit == 0 and credit == 0:
            raise PostingError(f"Dòng {index}: phải có đúng một phía Nợ hoặc Có lớn hơn 0.")
        total_debit += debit
        total_credit += credit
        cleaned.append({
            "account": account,
            "description": str(raw.get("description") or ""),
            "debit": debit,
            "credit": credit,
            "customer_id": raw.get("customer_id"),
            "supplier_id": raw.get("supplier_id"),
            "employee_id": raw.get("employee_id"),
            "product_id": raw.get("product_id"),
        })
    if total_debit != total_credit:
        raise PostingError(
            f"Tổng Nợ ({total_debit}) khác tổng Có ({total_credit}) — không được ghi sổ."
        )
    if total_debit <= 0:
        raise PostingError("Tổng phát sinh phải lớn hơn 0.")
    return cleaned


def _next_entry_no(conn, posting_date):
    prefix = f"JE-{_period_key(posting_date).replace('-', '')}"
    row = conn.execute(
        "SELECT COUNT(*) AS n FROM journal_entries WHERE entry_no LIKE ?",
        (f"{prefix}-%",),
    ).fetchone()
    return f"{prefix}-{int(row['n']) + 1:05d}"


def _existing_entry(conn, idempotency_key, source_type, source_id, event_type):
    row = conn.execute(
        "SELECT id, entry_no, status FROM journal_entries WHERE idempotency_key = ?",
        (idempotency_key,),
    ).fetchone()
    if row:
        return row
    if source_type and source_id and event_type:
        return conn.execute(
            "SELECT id, entry_no, status FROM journal_entries"
            " WHERE source_type = ? AND source_id = ? AND event_type = ?",
            (source_type, str(source_id), event_type),
        ).fetchone()
    return None


def _insert_entry(conn, *, event_type, source_type, source_id, document_date, posting_date,
                  description, business_type, lines, created_by, approved_by, status,
                  metadata, idempotency_key, reversal_of, reversal_reason=""):
    key = idempotency_key or f"{source_type}:{source_id}:{event_type}"
    existing = _existing_entry(conn, key, source_type, source_id, event_type)
    if existing:
        return {"id": existing["id"], "entry_no": existing["entry_no"], "created": False}
    if status == "posted" and period_is_locked(conn, posting_date):
        raise PostingError(f"Kỳ {_period_key(posting_date)} đã KHÓA SỔ — không được ghi thêm nghiệp vụ.")
    cleaned = _validate_lines(conn, lines)
    entry_no = _next_entry_no(conn, posting_date)
    posted_clause = "CURRENT_TIMESTAMP" if status == "posted" else "NULL"
    try:
        row = conn.execute(
            f"""
            INSERT INTO journal_entries (
                entry_no, document_date, posting_date, description, business_type,
                source_type, source_id, event_type, idempotency_key, status,
                created_by, approved_by, posted_at, reversal_of, reversal_reason, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, {posted_clause}, ?, ?, ?)
            RETURNING id
            """,
            (
                entry_no, document_date, posting_date, description, business_type,
                source_type, str(source_id), event_type, key, status,
                created_by or "", approved_by or "", reversal_of, reversal_reason,
                json.dumps(metadata or {}, ensure_ascii=False),
            ),
        ).fetchone()
    except DatabaseIntegrityError:
        # API retry đúng lúc — chứng từ đã được ghi bởi request song song.
        existing = _existing_entry(conn, key, source_type, source_id, event_type)
        if existing:
            return {"id": existing["id"], "entry_no": existing["entry_no"], "created": False}
        raise
    entry_id = row["id"]
    for line in cleaned:
        conn.execute(
            """
            INSERT INTO journal_entry_lines (
                journal_entry_id, account_code, line_description, debit, credit,
                customer_id, supplier_id, employee_id, product_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                entry_id, line["account"], line["description"],
                str(line["debit"]), str(line["credit"]),
                line["customer_id"], line["supplier_id"], line["employee_id"], line["product_id"],
            ),
        )
    _audit(conn, "journal_post" if status == "posted" else f"journal_{status}", entry_no,
           created_by, f"{event_type}: {description}")
    return {"id": entry_id, "entry_no": entry_no, "created": True}


def post_entry(db_path, **kwargs):
    """Ghi sổ một chứng từ đã cân — dùng cho sự kiện hệ thống (posted ngay)."""
    with connect(db_path) as conn:
        return _insert_entry(
            conn,
            event_type=kwargs["event_type"],
            source_type=kwargs.get("source_type", "manual"),
            source_id=kwargs.get("source_id", uuid.uuid4().hex),
            document_date=kwargs["document_date"],
            posting_date=kwargs.get("posting_date") or kwargs["document_date"],
            description=kwargs.get("description", ""),
            business_type=kwargs.get("business_type", kwargs["event_type"]),
            lines=kwargs["lines"],
            created_by=kwargs.get("created_by", ""),
            approved_by=kwargs.get("approved_by", "system"),
            status=kwargs.get("status", "posted"),
            metadata=kwargs.get("metadata"),
            idempotency_key=kwargs.get("idempotency_key"),
            reversal_of=kwargs.get("reversal_of"),
        )


def post_entry_conn(conn, **kwargs):
    """Ghi sổ TRONG transaction đang mở của nghiệp vụ nguồn (cùng commit/rollback)."""
    return _insert_entry(
        conn,
        event_type=kwargs["event_type"],
        source_type=kwargs.get("source_type", "manual"),
        source_id=kwargs.get("source_id", uuid.uuid4().hex),
        document_date=kwargs["document_date"],
        posting_date=kwargs.get("posting_date") or kwargs["document_date"],
        description=kwargs.get("description", ""),
        business_type=kwargs.get("business_type", kwargs["event_type"]),
        lines=kwargs["lines"],
        created_by=kwargs.get("created_by", ""),
        approved_by=kwargs.get("approved_by", "system"),
        status=kwargs.get("status", "posted"),
        metadata=kwargs.get("metadata"),
        idempotency_key=kwargs.get("idempotency_key"),
        reversal_of=kwargs.get("reversal_of"),
    )


# ---------------------------------------------------------------------------
# Quy trình lập → duyệt chứng từ tay (maker–checker)
# ---------------------------------------------------------------------------

def create_manual_draft(db_path, *, document_date, description, lines, created_by, metadata=None):
    with connect(db_path) as conn:
        return _insert_entry(
            conn,
            event_type="MANUAL_JOURNAL",
            source_type="manual",
            source_id=uuid.uuid4().hex,
            document_date=document_date,
            posting_date=document_date,
            description=description,
            business_type="manual",
            lines=lines,
            created_by=created_by,
            approved_by="",
            status="pending_approval",
            metadata=metadata,
            idempotency_key=None,
            reversal_of=None,
        )


def approve_entry(db_path, entry_id, approver_email):
    with connect(db_path) as conn:
        row = conn.execute(
            "SELECT id, status, created_by, posting_date FROM journal_entries WHERE id = ?",
            (entry_id,),
        ).fetchone()
        if not row:
            raise PostingError("Không tìm thấy chứng từ.")
        if row["status"] != "pending_approval":
            raise PostingError("Chỉ chứng từ ở trạng thái Chờ duyệt mới được duyệt.")
        if str(row["created_by"] or "").strip().lower() == str(approver_email or "").strip().lower():
            raise PostingError("Người lập không được tự duyệt chứng từ của chính mình.")
        if period_is_locked(conn, row["posting_date"]):
            raise PostingError("Kỳ hạch toán của chứng từ đã khóa sổ — không thể duyệt.")
        conn.execute(
            "UPDATE journal_entries SET status = 'posted', approved_by = ?,"
            " approved_at = CURRENT_TIMESTAMP, posted_at = CURRENT_TIMESTAMP,"
            " updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (approver_email, entry_id),
        )
        _audit(conn, "journal_approve", entry_id, approver_email, "Duyệt và ghi sổ chứng từ")
        return {"id": entry_id, "status": "posted"}


def reject_entry(db_path, entry_id, approver_email, reason):
    if not str(reason or "").strip():
        raise PostingError("Từ chối chứng từ bắt buộc phải nhập lý do.")
    with connect(db_path) as conn:
        row = conn.execute(
            "SELECT id, status, created_by FROM journal_entries WHERE id = ?", (entry_id,)
        ).fetchone()
        if not row:
            raise PostingError("Không tìm thấy chứng từ.")
        if row["status"] != "pending_approval":
            raise PostingError("Chỉ chứng từ Chờ duyệt mới được từ chối.")
        if str(row["created_by"] or "").strip().lower() == str(approver_email or "").strip().lower():
            raise PostingError("Người lập không được tự xử lý chứng từ của chính mình.")
        conn.execute(
            "UPDATE journal_entries SET status = 'rejected', reject_reason = ?,"
            " approved_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (reason.strip(), approver_email, entry_id),
        )
        _audit(conn, "journal_reject", entry_id, approver_email, reason.strip())
        return {"id": entry_id, "status": "rejected"}


# ---------------------------------------------------------------------------
# Bút toán đảo
# ---------------------------------------------------------------------------

def reverse_entry(db_path, entry_id, reversed_by, reason, posting_date=None):
    if not str(reason or "").strip():
        raise PostingError("Đảo bút toán bắt buộc phải có lý do.")
    with connect(db_path) as conn:
        return reverse_entry_conn(conn, entry_id, reversed_by, reason, posting_date)


def reverse_entry_conn(conn, entry_id, reversed_by, reason, posting_date=None):
    entry = conn.execute(
        "SELECT * FROM journal_entries WHERE id = ?", (entry_id,)
    ).fetchone()
    if not entry:
        raise PostingError("Không tìm thấy chứng từ gốc để đảo.")
    # Retry đảo một chứng từ đã đảo → trả về đúng bút toán đảo cũ, không sinh trùng.
    existing_rev = conn.execute(
        "SELECT id, entry_no FROM journal_entries WHERE reversal_of = ? AND status = 'posted'",
        (entry_id,),
    ).fetchone()
    if existing_rev:
        return {"id": existing_rev["id"], "entry_no": existing_rev["entry_no"], "created": False}
    if entry["status"] != "posted":
        raise PostingError("Chỉ chứng từ đã ghi sổ mới được đảo.")
    target_date = posting_date or entry["posting_date"]
    if period_is_locked(conn, target_date) or period_is_locked(conn, entry["posting_date"]):
        raise PostingError("Kỳ liên quan đã khóa sổ — không thể đảo bút toán.")
    lines = conn.execute(
        "SELECT account_code, line_description, debit, credit, customer_id, supplier_id,"
        " employee_id, product_id FROM journal_entry_lines WHERE journal_entry_id = ? ORDER BY id",
        (entry_id,),
    ).fetchall()
    reversed_lines = [{
        "account": line["account_code"],
        "description": f"Đảo: {line['line_description']}",
        "debit": to_money(line["credit"]),
        "credit": to_money(line["debit"]),
        "customer_id": line["customer_id"],
        "supplier_id": line["supplier_id"],
        "employee_id": line["employee_id"],
        "product_id": line["product_id"],
    } for line in lines]
    result = _insert_entry(
        conn,
        event_type=f"REVERSAL:{entry['event_type']}",
        source_type=entry["source_type"],
        source_id=f"{entry['source_id']}:rev:{entry_id}",
        document_date=target_date,
        posting_date=target_date,
        description=f"BÚT TOÁN ĐẢO {entry['entry_no']} — {reason.strip()}",
        business_type=entry["business_type"],
        lines=reversed_lines,
        created_by=reversed_by,
        approved_by=reversed_by,
        status="posted",
        metadata={"reversalOf": entry["entry_no"]},
        idempotency_key=f"rev:{entry['idempotency_key']}",
        reversal_of=entry_id,
        reversal_reason=reason.strip(),
    )
    conn.execute(
        "UPDATE journal_entries SET status = 'reversed', reversal_reason = ?,"
        " updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (reason.strip(), entry_id),
    )
    _audit(conn, "journal_reverse", entry["entry_no"], reversed_by, reason.strip())
    return result


# ---------------------------------------------------------------------------
# Truy vấn sổ
# ---------------------------------------------------------------------------

def trial_balance(db_path, date_from=None, date_to=None):
    """Bảng cân đối phát sinh — CHỈ bút toán posted (kể cả cặp đảo, tự triệt tiêu)."""
    where = ["e.status IN ('posted', 'reversed')"]
    params = []
    if date_from:
        where.append("e.posting_date >= ?")
        params.append(date_from)
    if date_to:
        where.append("e.posting_date <= ?")
        params.append(date_to)
    sql = f"""
        SELECT l.account_code AS code, a.name, a.balance_side,
               COALESCE(SUM(l.debit), 0) AS total_debit,
               COALESCE(SUM(l.credit), 0) AS total_credit
        FROM journal_entry_lines l
        JOIN journal_entries e ON e.id = l.journal_entry_id
        LEFT JOIN accounting_accounts a ON a.code = l.account_code
        WHERE {' AND '.join(where)}
        GROUP BY l.account_code, a.name, a.balance_side
        ORDER BY l.account_code
    """
    with connect(db_path) as conn:
        rows = conn.execute(sql, params).fetchall()
    output = []
    for row in rows:
        debit = to_money(row["total_debit"])
        credit = to_money(row["total_credit"])
        side = row["balance_side"] or "no"
        balance = debit - credit if side == "no" else credit - debit
        output.append({
            "code": row["code"], "name": row["name"] or "",
            "debit": str(debit), "credit": str(credit),
            "balance": str(balance), "balanceSide": side,
        })
    return output


def account_balance(db_path, code, date_from=None, date_to=None):
    for row in trial_balance(db_path, date_from, date_to):
        if row["code"] == code:
            return Decimal(row["balance"])
    return Decimal("0")


def list_journal(db_path, date_from=None, date_to=None, status=None, account=None, limit=300):
    where = ["1=1"]
    params = []
    if date_from:
        where.append("e.posting_date >= ?")
        params.append(date_from)
    if date_to:
        where.append("e.posting_date <= ?")
        params.append(date_to)
    if status:
        where.append("e.status = ?")
        params.append(status)
    if account:
        where.append("EXISTS (SELECT 1 FROM journal_entry_lines x WHERE x.journal_entry_id = e.id AND x.account_code = ?)")
        params.append(account)
    params.append(int(limit))
    with connect(db_path) as conn:
        entries = conn.execute(
            f"""
            SELECT e.id, e.entry_no, e.document_date, e.posting_date, e.description,
                   e.business_type, e.source_type, e.source_id, e.event_type, e.status,
                   e.created_by, e.approved_by, e.reversal_of, e.reject_reason, e.reversal_reason
            FROM journal_entries e
            WHERE {' AND '.join(where)}
            ORDER BY e.posting_date DESC, e.id DESC
            LIMIT ?
            """,
            params,
        ).fetchall()
        ids = [row["id"] for row in entries]
        lines_by_entry = {}
        if ids:
            placeholders = ",".join("?" for _ in ids)
            for line in conn.execute(
                f"SELECT journal_entry_id, account_code, line_description, debit, credit"
                f" FROM journal_entry_lines WHERE journal_entry_id IN ({placeholders}) ORDER BY id",
                ids,
            ).fetchall():
                lines_by_entry.setdefault(line["journal_entry_id"], []).append({
                    "account": line["account_code"],
                    "description": line["line_description"],
                    "debit": str(to_money(line["debit"])),
                    "credit": str(to_money(line["credit"])),
                })
    return [{**dict(entry), "lines": lines_by_entry.get(entry["id"], [])} for entry in entries]
