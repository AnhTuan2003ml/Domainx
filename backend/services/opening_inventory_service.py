"""Tồn kho đầu kỳ (Opening Inventory Batch) + đối soát thẻ kho với TK 156.

Nguyên tắc:
  - Tồn đầu là CHỨNG TỪ có vòng đời draft → reviewed → posted → (reversed):
    người lập khác người duyệt, đợt đã posted bất biến — muốn sửa phải ĐẢO có lý do.
  - Backend tự tính thành tiền = số lượng × giá vốn (Decimal); không tin số client gửi.
  - Tài khoản đối ứng KHÔNG hard-code: kế toán chọn khi lập đợt (mặc định gợi ý theo
    biến môi trường DOMIX_OPENING_INVENTORY_COUNTER nếu có, ví dụ "411").
  - Ghi kho (inventory_valuation_ledger) và sổ cái (journal) trong CÙNG transaction.
  - API idempotent: tạo đợt theo idempotency_key; ghi sổ retry không sinh chứng từ trùng.
  - Không tự backfill dữ liệu cũ: chỉ GỢI Ý từ movement `opening` trong app_state,
    kế toán xem, sửa và duyệt trước khi ghi sổ.

Đối soát theo công thức: Tồn đầu kỳ + Nhập − Xuất ± Điều chỉnh = Tồn cuối kỳ.
"""

from __future__ import annotations

import os
import uuid
from decimal import Decimal, InvalidOperation

from db.accounting_store import account_exists, to_money
from db.connection import connect
from db.state_store import read_state
from services.posting_service import (
    PostingError,
    ensure_schema,
    post_entry_conn,
    reverse_entry_conn,
)

OPENING_MOVEMENT_TYPES = {"opening", "initial", "opening_balance"}
IN_MOVEMENT_TYPES = {"purchase", "purchase_in"}
OUT_MOVEMENT_TYPES = {"sale", "sale_out", "distribution_sale", "distribution_out"}
ADJUST_IN_TYPES = {"adjustment_in"}
ADJUST_OUT_TYPES = {"adjustment_out"}

EVENT_OPENING_STOCK = "OPENING_STOCK"


def default_counter_account():
    """Gợi ý tài khoản đối ứng từ cấu hình — kế toán vẫn được đổi khi lập đợt."""
    return os.environ.get("DOMIX_OPENING_INVENTORY_COUNTER", "411").strip() or "411"


def _qty(value):
    try:
        result = Decimal(str(value or 0))
    except (InvalidOperation, ValueError):
        raise PostingError("Số lượng không hợp lệ.")
    return result


def _batch_row(row, lines):
    return {
        "id": row["id"], "batchCode": row["batch_code"], "effectiveDate": row["effective_date"],
        "warehouse": row["warehouse"], "counterAccount": row["counter_account_code"],
        "status": row["status"], "sourceDocument": row["source_document"], "note": row["note"],
        "createdBy": row["created_by"], "reviewedBy": row["reviewed_by"], "postedBy": row["posted_by"],
        "postedEntryId": row["posted_entry_id"], "reversalEntryId": row["reversal_entry_id"],
        "reversalReason": row["reversal_reason"], "createdAt": str(row["created_at"] or ""),
        "totalAmount": str(to_money(sum(Decimal(str(l["amount"])) for l in lines) if lines else 0)),
        "lines": [
            {
                "productId": l["product_id"], "productName": l["product_name"], "uom": l["uom"],
                "quantity": str(l["quantity"]), "unitCost": str(l["unit_cost"]),
                "amount": str(l["amount"]), "note": l["note"],
            }
            for l in lines
        ],
    }


def _load_batch(conn, batch_id):
    row = conn.execute("SELECT * FROM opening_inventory_batches WHERE id = ?", (int(batch_id),)).fetchone()
    if not row:
        raise PostingError("Không tìm thấy đợt tồn đầu kỳ.")
    lines = conn.execute(
        "SELECT * FROM opening_inventory_batch_lines WHERE batch_id = ? ORDER BY id", (row["id"],)
    ).fetchall()
    return row, lines


def list_batches(db_path):
    ensure_schema(db_path)
    with connect(db_path) as conn:
        rows = conn.execute("SELECT * FROM opening_inventory_batches ORDER BY id DESC").fetchall()
        result = []
        for row in rows:
            lines = conn.execute(
                "SELECT * FROM opening_inventory_batch_lines WHERE batch_id = ? ORDER BY id", (row["id"],)
            ).fetchall()
            result.append(_batch_row(row, lines))
        return result


def suggest_from_state(db_path):
    """Gợi ý dòng tồn đầu từ movement `opening` CHƯA thuộc đợt posted nào — chỉ gợi ý,
    không tự ghi: kế toán phải xem, chỉnh và duyệt."""
    ensure_schema(db_path)
    state = read_state(db_path) or {}
    data = state.get("data") if isinstance(state.get("data"), dict) else {}
    products = {str(p.get("id")): p for p in (data.get("inventory") or []) if isinstance(p, dict)}
    with connect(db_path) as conn:
        covered = {
            str(row["product_id"])
            for row in conn.execute(
                "SELECT l.product_id FROM opening_inventory_batch_lines l"
                " JOIN opening_inventory_batches b ON b.id = l.batch_id WHERE b.status = 'posted'"
            ).fetchall()
        }
    suggestions = []
    for movement in data.get("stockMovements") or []:
        if not isinstance(movement, dict):
            continue
        if str(movement.get("movementType") or "") not in OPENING_MOVEMENT_TYPES:
            continue
        pid = str(movement.get("productId"))
        if pid in covered:
            continue
        product = products.get(pid, {})
        qty = _qty(movement.get("delta") if movement.get("delta") is not None else movement.get("quantity"))
        unit_cost = to_money(product.get("costPrice") or 0)
        suggestions.append({
            "productId": pid,
            "productName": str(product.get("name") or ""),
            "uom": str(product.get("unit") or "cái"),
            "quantity": str(qty),
            "unitCost": str(unit_cost),
            "amount": str(to_money(qty * unit_cost)),
            "effectiveDate": str(movement.get("date") or "")[:10],
            "sourceMovementId": str(movement.get("id")),
            "note": str(movement.get("note") or ""),
        })
    return {"suggestions": suggestions, "counterAccount": default_counter_account()}


def create_batch(db_path, *, effective_date, counter_account, lines, warehouse="MAIN",
                 source_document="", note="", created_by="", idempotency_key=""):
    ensure_schema(db_path)
    effective_date = str(effective_date or "")[:10]
    if len(effective_date) != 10:
        raise PostingError("Ngày hiệu lực không hợp lệ (YYYY-MM-DD).")
    counter = str(counter_account or "").strip()
    if not counter:
        raise PostingError("Phải chọn tài khoản đối ứng cho tồn đầu kỳ (ví dụ 411).")
    if not isinstance(lines, list) or not lines:
        raise PostingError("Đợt tồn đầu phải có ít nhất 1 dòng sản phẩm.")
    key = str(idempotency_key or "").strip() or f"opening-batch:{uuid.uuid4().hex}"

    cleaned = []
    for index, raw in enumerate(lines, start=1):
        pid = str(raw.get("productId") or "").strip()
        if not pid:
            raise PostingError(f"Dòng {index}: thiếu mã sản phẩm.")
        quantity = _qty(raw.get("quantity"))
        if quantity <= 0:
            raise PostingError(f"Dòng {index}: số lượng phải lớn hơn 0.")
        unit_cost = to_money(raw.get("unitCost") or 0)
        if unit_cost < 0:
            raise PostingError(f"Dòng {index}: giá vốn không được âm.")
        # Thành tiền do backend tính lại — bỏ qua amount client gửi.
        cleaned.append({
            "product_id": pid,
            "product_name": str(raw.get("productName") or ""),
            "uom": str(raw.get("uom") or "cái"),
            "quantity": quantity,
            "unit_cost": unit_cost,
            "amount": to_money(quantity * unit_cost),
            "note": str(raw.get("note") or ""),
        })

    with connect(db_path) as conn:
        if counter == "156" or not account_exists(conn, counter):
            raise PostingError(f"Tài khoản đối ứng {counter} không hợp lệ.")
        existing = conn.execute(
            "SELECT id FROM opening_inventory_batches WHERE idempotency_key = ?", (key,)
        ).fetchone()
        if existing:
            row, line_rows = _load_batch(conn, existing["id"])
            return {"batch": _batch_row(row, line_rows), "created": False}
        # CHẶN TRÙNG NGUỒN: sản phẩm đã có đợt tồn đầu GHI SỔ thì không được khai thêm —
        # muốn sửa phải đảo đợt cũ (kèm lý do) rồi lập đợt mới.
        already_posted = {
            str(r["product_id"])
            for r in conn.execute(
                "SELECT l.product_id FROM opening_inventory_batch_lines l"
                " JOIN opening_inventory_batches b ON b.id = l.batch_id WHERE b.status = 'posted'"
            ).fetchall()
        }
        duplicated = [line["product_id"] for line in cleaned if line["product_id"] in already_posted]
        if duplicated:
            raise PostingError(
                "Sản phẩm sau đã có đợt tồn đầu ĐÃ GHI SỔ: "
                + ", ".join(duplicated[:5])
                + " — không được khai trùng. Hãy đảo đợt cũ (kèm lý do) trước khi lập đợt mới."
            )
        seq = conn.execute("SELECT COUNT(*) AS n FROM opening_inventory_batches").fetchone()
        batch_code = f"OB-{effective_date.replace('-', '')}-{int(seq['n']) + 1:04d}"
        row = conn.execute(
            """
            INSERT INTO opening_inventory_batches (
                batch_code, effective_date, warehouse, counter_account_code, status,
                source_document, note, idempotency_key, created_by
            ) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?) RETURNING id
            """,
            (batch_code, effective_date, str(warehouse or "MAIN"), counter,
             str(source_document or ""), str(note or ""), key, created_by or ""),
        ).fetchone()
        for line in cleaned:
            conn.execute(
                """
                INSERT INTO opening_inventory_batch_lines (
                    batch_id, product_id, product_name, uom, quantity, unit_cost, amount, note
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (row["id"], line["product_id"], line["product_name"], line["uom"],
                 str(line["quantity"]), str(line["unit_cost"]), str(line["amount"]), line["note"]),
            )
        batch_row, line_rows = _load_batch(conn, row["id"])
        return {"batch": _batch_row(batch_row, line_rows), "created": True}


def review_batch(db_path, batch_id, reviewer):
    ensure_schema(db_path)
    with connect(db_path) as conn:
        row, lines = _load_batch(conn, batch_id)
        if row["status"] != "draft":
            raise PostingError(f"Chỉ đợt ở trạng thái nháp mới được duyệt (hiện tại: {row['status']}).")
        if reviewer and reviewer == row["created_by"]:
            raise PostingError("Người duyệt phải khác người lập (maker–checker).")
        conn.execute(
            "UPDATE opening_inventory_batches SET status = 'reviewed', reviewed_by = ?,"
            " updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (reviewer or "", row["id"]),
        )
        row, lines = _load_batch(conn, batch_id)
        return {"batch": _batch_row(row, lines)}


def _journal_lines_for_batch(row, lines):
    total = to_money(sum(Decimal(str(l["quantity"])) * Decimal(str(l["unit_cost"])) for l in lines))
    journal_lines = [
        {
            "account": "156",
            "debit": to_money(Decimal(str(l["quantity"])) * Decimal(str(l["unit_cost"]))),
            "description": f"Tồn đầu {l['product_name'] or l['product_id']} ({l['quantity']} {l['uom']})",
            "product_id": str(l["product_id"]),
        }
        for l in lines
    ]
    journal_lines.append({
        "account": row["counter_account_code"],
        "credit": total,
        "description": f"Đối ứng tồn đầu kỳ đợt {row['batch_code']}",
    })
    return journal_lines, total


def post_batch(db_path, batch_id, actor, mode="preview"):
    """`preview` chỉ trả bút toán dự kiến; `commit` ghi kho + sổ cái trong 1 transaction."""
    ensure_schema(db_path)
    with connect(db_path) as conn:
        row, lines = _load_batch(conn, batch_id)
        if row["status"] == "posted":
            # Retry-safe: đã ghi sổ thì trả lại kết quả cũ, không sinh chứng từ mới.
            return {"batch": _batch_row(row, lines), "created": False, "entryId": row["posted_entry_id"]}
        if row["status"] == "reversed":
            raise PostingError("Đợt đã bị đảo — lập đợt mới thay vì ghi lại.")
        if row["status"] != "reviewed":
            raise PostingError("Đợt phải được DUYỆT trước khi ghi sổ (draft → reviewed → posted).")
        if not lines:
            raise PostingError("Đợt không có dòng sản phẩm nào.")
        journal_lines, total = _journal_lines_for_batch(row, lines)
        if mode != "commit":
            return {
                "mode": "preview", "batchCode": row["batch_code"], "totalAmount": str(total),
                "journalLines": [
                    {"account": l["account"], "debit": str(l.get("debit") or ""), "credit": str(l.get("credit") or ""),
                     "description": l.get("description") or ""}
                    for l in journal_lines
                ],
            }
        result = post_entry_conn(
            conn,
            event_type=EVENT_OPENING_STOCK,
            source_type="opening_batch",
            source_id=row["batch_code"],
            document_date=row["effective_date"],
            description=f"Tồn kho đầu kỳ đợt {row['batch_code']} (kho {row['warehouse']})",
            business_type="opening_stock",
            lines=journal_lines,
            created_by=row["created_by"] or actor,
            approved_by=row["reviewed_by"] or actor,
            metadata={"batchCode": row["batch_code"], "counterAccount": row["counter_account_code"]},
            idempotency_key=f"opening_batch:{row['batch_code']}",
        )
        # Ghi kho trong CÙNG transaction: thẻ kho nhận dòng tồn đầu theo đợt.
        # Nếu sản phẩm đã có dòng opening từ replay app_state thì không chèn trùng —
        # đợt chỉ bổ sung thẻ kho cho sản phẩm chưa được app theo dõi.
        for line in lines:
            quantity = Decimal(str(line["quantity"]))
            unit_cost = Decimal(str(line["unit_cost"]))
            existing_opening = conn.execute(
                "SELECT 1 AS found FROM inventory_valuation_ledger"
                " WHERE product_id = ? AND movement_type = 'opening' LIMIT 1",
                (str(line["product_id"]),),
            ).fetchone()
            if existing_opening:
                continue
            conn.execute(
                """
                INSERT INTO inventory_valuation_ledger (
                    product_id, movement_key, movement_date, movement_type, quantity, unit_cost,
                    qty_before, value_before, qty_after, value_after, avg_cost_after, cost_assumed, source_note
                ) VALUES (?, ?, ?, 'opening', ?, ?, 0, 0, ?, ?, ?, 0, ?)
                ON CONFLICT (movement_key) DO NOTHING
                """,
                (
                    str(line["product_id"]), f"opening_batch:{row['batch_code']}:{line['product_id']}",
                    row["effective_date"], str(quantity), str(to_money(unit_cost)),
                    str(quantity), str(to_money(quantity * unit_cost)), str(to_money(unit_cost)),
                    f"Tồn đầu kỳ đợt {row['batch_code']}",
                ),
            )
        conn.execute(
            "UPDATE opening_inventory_batches SET status = 'posted', posted_by = ?,"
            " posted_entry_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (actor or "", result["id"], row["id"]),
        )
        row, lines = _load_batch(conn, batch_id)
        return {"batch": _batch_row(row, lines), "created": result.get("created", False), "entryId": result["id"]}


def reverse_batch(db_path, batch_id, actor, reason):
    ensure_schema(db_path)
    if not str(reason or "").strip():
        raise PostingError("Đảo đợt tồn đầu bắt buộc phải có lý do.")
    with connect(db_path) as conn:
        row, lines = _load_batch(conn, batch_id)
        if row["status"] == "reversed":
            return {"batch": _batch_row(row, lines), "created": False}
        if row["status"] != "posted" or not row["posted_entry_id"]:
            raise PostingError("Chỉ đợt đã ghi sổ mới cần đảo — đợt nháp thì xóa/sửa trực tiếp.")
        reversal = reverse_entry_conn(conn, row["posted_entry_id"], actor, str(reason), row["effective_date"])
        conn.execute(
            "UPDATE opening_inventory_batches SET status = 'reversed', reversal_entry_id = ?,"
            " reversal_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (reversal.get("id"), str(reason), row["id"]),
        )
        for line in lines:
            conn.execute(
                "DELETE FROM inventory_valuation_ledger WHERE movement_key = ?",
                (f"opening_batch:{row['batch_code']}:{line['product_id']}",),
            )
        row, lines = _load_batch(conn, batch_id)
        return {"batch": _batch_row(row, lines), "created": True, "reversalEntryId": reversal.get("id")}


def delete_draft_batch(db_path, batch_id, actor):
    """Chỉ bản NHÁP chưa duyệt mới được xóa — đợt posted phải dùng reverse_batch."""
    ensure_schema(db_path)
    with connect(db_path) as conn:
        row, _lines = _load_batch(conn, batch_id)
        if row["status"] not in {"draft", "reviewed"}:
            raise PostingError("Đợt đã ghi sổ không được xóa — hãy dùng bút toán đảo kèm lý do.")
        conn.execute("DELETE FROM opening_inventory_batch_lines WHERE batch_id = ?", (row["id"],))
        conn.execute("DELETE FROM opening_inventory_batches WHERE id = ?", (row["id"],))
        return {"deleted": True, "batchCode": row["batch_code"]}


# ---------------------------------------------------------------------------
# Đối soát: Tồn đầu + Nhập − Xuất ± Điều chỉnh = Tồn cuối, so với TK 156
# ---------------------------------------------------------------------------

def inventory_reconciliation(db_path, date_from=None, date_to=None):
    from services.ledger_sync_service import _build_costing  # tránh import vòng ở module load

    ensure_schema(db_path)
    state = read_state(db_path) or {}
    data = state.get("data") if isinstance(state.get("data"), dict) else {}
    products = {str(p.get("id")): p for p in (data.get("inventory") or []) if isinstance(p, dict)}
    valuation_rows, _sale_costs = _build_costing(data)

    def _in_range(date_str):
        date = str(date_str or "")[:10]
        if date_from and date < str(date_from):
            return False
        if date_to and date > str(date_to):
            return False
        return True

    per_product = {}

    def _bucket(pid):
        return per_product.setdefault(pid, {
            "opening": {"qty": Decimal("0"), "value": Decimal("0")},
            "stockIn": {"qty": Decimal("0"), "value": Decimal("0")},
            "stockOut": {"qty": Decimal("0"), "value": Decimal("0")},
            "adjust": {"qty": Decimal("0"), "value": Decimal("0")},
            "closing": {"qty": Decimal("0"), "value": Decimal("0")},
        })

    for row in valuation_rows:
        if not _in_range(row["movement_date"]):
            continue
        pid = row["product_id"]
        bucket = _bucket(pid)
        quantity = Decimal(str(row["quantity"]))
        value = Decimal(str(row["value_after"])) - Decimal(str(row["value_before"]))
        mtype = row["movement_type"]
        if mtype in OPENING_MOVEMENT_TYPES:
            bucket["opening"]["qty"] += quantity
            bucket["opening"]["value"] += value
        elif mtype in IN_MOVEMENT_TYPES:
            bucket["stockIn"]["qty"] += quantity
            bucket["stockIn"]["value"] += value
        elif mtype in ADJUST_IN_TYPES or mtype in ADJUST_OUT_TYPES:
            bucket["adjust"]["qty"] += quantity
            bucket["adjust"]["value"] += value
        else:
            bucket["stockOut"]["qty"] += -quantity
            bucket["stockOut"]["value"] += -value
        bucket["closing"]["qty"] = Decimal(str(row["qty_after"]))
        bucket["closing"]["value"] = Decimal(str(row["value_after"]))

    with connect(db_path) as conn:
        ledger_rows = conn.execute(
            """
            SELECT COALESCE(l.product_id, '') AS product_id,
                   SUM(l.debit) AS debit, SUM(l.credit) AS credit
            FROM journal_entry_lines l
            JOIN journal_entries e ON e.id = l.journal_entry_id
            WHERE e.status IN ('posted', 'reversed') AND l.account_code = '156'
            GROUP BY COALESCE(l.product_id, '')
            """
        ).fetchall()
        entry_causes = conn.execute(
            """
            SELECT e.entry_no, e.event_type, e.description, e.posting_date,
                   l.product_id, l.debit, l.credit
            FROM journal_entry_lines l
            JOIN journal_entries e ON e.id = l.journal_entry_id
            WHERE e.status IN ('posted', 'reversed') AND l.account_code = '156'
            ORDER BY e.posting_date, e.id
            """
        ).fetchall()
        covered_products = {
            str(r["product_id"])
            for r in conn.execute(
                "SELECT l.product_id FROM opening_inventory_batch_lines l"
                " JOIN opening_inventory_batches b ON b.id = l.batch_id WHERE b.status = 'posted'"
            ).fetchall()
        }
        covered_movements = {
            str(r["source_id"])
            for r in conn.execute(
                "SELECT source_id FROM journal_entries"
                " WHERE status = 'posted' AND source_type = 'stock_movement'"
            ).fetchall()
        }

    ledger_by_product = {str(r["product_id"]): r for r in ledger_rows}
    ledger_total = sum(Decimal(str(r["debit"])) - Decimal(str(r["credit"])) for r in ledger_rows)

    # Giao dịch kho chưa có bút toán tương ứng — nguồn gây chênh lệch phổ biến nhất.
    unposted = []
    for movement in data.get("stockMovements") or []:
        if not isinstance(movement, dict) or not _in_range(movement.get("date")):
            continue
        mid = str(movement.get("id"))
        mtype = str(movement.get("movementType") or "")
        pid = str(movement.get("productId"))
        delta = Decimal(str(movement.get("delta") if movement.get("delta") is not None else movement.get("quantity") or 0))
        unit_cost = to_money(products.get(pid, {}).get("costPrice") or 0)
        if mtype in OPENING_MOVEMENT_TYPES:
            if pid not in covered_products:
                unposted.append({
                    "movementId": mid, "productId": pid, "type": mtype, "date": str(movement.get("date") or "")[:10],
                    "qty": str(delta), "estimatedValue": str(to_money(delta * unit_cost)),
                    "reason": "Tồn đầu chưa có đợt khai báo được ghi sổ (Opening Inventory Batch).",
                })
        elif mtype in ADJUST_IN_TYPES or mtype in ADJUST_OUT_TYPES:
            if mid not in covered_movements:
                unposted.append({
                    "movementId": mid, "productId": pid, "type": mtype, "date": str(movement.get("date") or "")[:10],
                    "qty": str(delta), "estimatedValue": str(to_money(delta * unit_cost)),
                    "reason": "Điều chỉnh kho chưa có bút toán kế toán (lập chứng từ tay Nợ/Có 156).",
                })
        elif mtype in OUT_MOVEMENT_TYPES:
            if mid not in covered_movements:
                unposted.append({
                    "movementId": mid, "productId": pid, "type": mtype, "date": str(movement.get("date") or "")[:10],
                    "qty": str(delta), "estimatedValue": str(to_money(-delta * unit_cost)),
                    "reason": "Xuất kho chưa có bút toán giá vốn (chạy Đồng bộ sổ cái).",
                })

    product_rows = []
    stock_total = Decimal("0")
    for pid, bucket in sorted(per_product.items()):
        ledger = ledger_by_product.get(pid)
        ledger_balance = (Decimal(str(ledger["debit"])) - Decimal(str(ledger["credit"]))) if ledger else Decimal("0")
        closing_value = bucket["closing"]["value"]
        stock_total += closing_value
        diff = closing_value - ledger_balance
        product_rows.append({
            "productId": pid,
            "productName": str(products.get(pid, {}).get("name") or ""),
            "uom": str(products.get(pid, {}).get("unit") or "cái"),
            "opening": {"qty": str(bucket["opening"]["qty"]), "value": str(to_money(bucket["opening"]["value"]))},
            "stockIn": {"qty": str(bucket["stockIn"]["qty"]), "value": str(to_money(bucket["stockIn"]["value"]))},
            "stockOut": {"qty": str(bucket["stockOut"]["qty"]), "value": str(to_money(bucket["stockOut"]["value"]))},
            "adjust": {"qty": str(bucket["adjust"]["qty"]), "value": str(to_money(bucket["adjust"]["value"]))},
            "closing": {"qty": str(bucket["closing"]["qty"]), "value": str(to_money(closing_value))},
            "ledger156": {
                "debit": str(to_money(Decimal(str(ledger["debit"])) if ledger else 0)),
                "credit": str(to_money(Decimal(str(ledger["credit"])) if ledger else 0)),
                "balance": str(to_money(ledger_balance)),
            },
            "diffValue": str(to_money(diff)),
            "balanced": abs(diff) <= Decimal("0.5"),
        })

    unlinked_ledger = ledger_by_product.get("")
    total_diff = stock_total - ledger_total
    return {
        "formula": "Tồn đầu kỳ + Nhập kho − Xuất kho ± Điều chỉnh = Tồn cuối kỳ",
        "range": {"from": date_from or "", "to": date_to or ""},
        "products": product_rows,
        "totals": {
            "stockCardValue": str(to_money(stock_total)),
            "ledger156Balance": str(to_money(ledger_total)),
            "diff": str(to_money(total_diff)),
            "balanced": abs(total_diff) <= Decimal("0.5"),
        },
        "unlinkedLedger156": {
            "debit": str(to_money(Decimal(str(unlinked_ledger["debit"])))) if unlinked_ledger else "0.00",
            "credit": str(to_money(Decimal(str(unlinked_ledger["credit"])))) if unlinked_ledger else "0.00",
        },
        "unpostedMovements": unposted,
        "ledgerEntries156": [
            {
                "entryNo": r["entry_no"], "eventType": r["event_type"], "description": r["description"],
                "date": str(r["posting_date"] or "")[:10], "productId": str(r["product_id"] or ""),
                "debit": str(to_money(Decimal(str(r["debit"])))), "credit": str(to_money(Decimal(str(r["credit"])))),
            }
            for r in entry_causes
        ],
    }
