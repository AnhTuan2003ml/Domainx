"""API sổ cái hạch toán kép — /api/accounting/*.

Quyền: xem = admin/kế toán; thao tác (đảo, duyệt, khóa kỳ, đồng bộ) = admin/kế toán,
duyệt bắt buộc khác người lập (maker–checker do Posting Service cưỡng chế).
"""

from decimal import Decimal
from urllib.parse import parse_qs

from db.accounting_store import list_accounts, to_money
from db.connection import connect
from db.state_store import read_state
from services import opening_inventory_service, posting_service
from services.ledger_sync_service import sync_ledger
from services.posting_service import PostingError


def _role(user):
    value = str((user or {}).get("role") or "").strip().lower()
    return "admin" if value in {"admin", "boss"} else "accountant" if value == "accountant" else "user"


def _require_accountant(handler, user):
    if _role(user) not in {"admin", "accountant"}:
        handler.send_json({"error": "Chỉ Sếp/Kế toán được truy cập sổ kế toán."}, 403)
        return False
    return True


def _query(parsed):
    return parse_qs(parsed.query or "")


def _one(query, name, default=""):
    return (query.get(name, [default]) or [default])[0]


def handle_get(handler, route, parsed):
    if not route.startswith("/api/accounting/"):
        return False
    user = handler.require_user()
    if not user:
        return True
    if not _require_accountant(handler, user):
        return True
    posting_service.ensure_schema(handler.db_path)
    query = _query(parsed)

    if route == "/api/accounting/accounts":
        with connect(handler.db_path) as conn:
            handler.send_json({"accounts": list_accounts(conn)})
        return True

    if route == "/api/accounting/journal":
        handler.send_json({
            "entries": posting_service.list_journal(
                handler.db_path,
                date_from=_one(query, "from") or None,
                date_to=_one(query, "to") or None,
                status=_one(query, "status") or None,
                account=_one(query, "account") or None,
            ),
        })
        return True

    if route == "/api/accounting/trial-balance":
        handler.send_json({
            "rows": posting_service.trial_balance(
                handler.db_path,
                date_from=_one(query, "from") or None,
                date_to=_one(query, "to") or None,
            ),
        })
        return True

    if route == "/api/accounting/vat-books":
        date_from = _one(query, "from") or None
        date_to = _one(query, "to") or None
        entries = posting_service.list_journal(handler.db_path, date_from=date_from, date_to=date_to, limit=2000)
        # SỔ VAT chỉ gồm CHỨNG TỪ HIỆN HÀNH — mỗi chứng từ nguồn (source_type + source_id)
        # đúng MỘT lần, lấy bút toán posted mới nhất. Bút toán gốc đã bị đảo (status=reversed)
        # và bút toán đảo (reversal_of) vẫn nằm nguyên trong nhật ký để kiểm toán, nhưng không
        # phải chứng từ VAT — trước đây đếm cả 3 lớp (gốc + đảo + ghi lại) nên 10 đơn ra 30 dòng.
        current_by_source = {}
        for entry in entries:
            if entry["status"] != "posted" or entry["reversal_of"]:
                continue
            key = (entry["source_type"], str(entry["source_id"]))
            kept = current_by_source.get(key)
            if kept is None or int(entry["id"]) > int(kept["id"]):
                current_by_source[key] = entry
        current_entries = sorted(
            current_by_source.values(),
            key=lambda e: (str(e["posting_date"] or ""), int(e["id"])),
            reverse=True,
        )
        output_rows, input_rows = [], []
        for entry in current_entries:
            vat_out = sum(Decimal(l["credit"]) - Decimal(l["debit"]) for l in entry["lines"] if l["account"] == "3331")
            vat_in = sum(Decimal(l["debit"]) - Decimal(l["credit"]) for l in entry["lines"] if l["account"] == "133")
            net_out = sum(Decimal(l["credit"]) - Decimal(l["debit"]) for l in entry["lines"] if l["account"] in {"511", "515", "711"})
            net_in = sum(Decimal(l["debit"]) - Decimal(l["credit"]) for l in entry["lines"] if l["account"] in {"641", "642", "156", "632"})
            base = {
                "entryNo": entry["entry_no"], "date": entry["posting_date"],
                "description": entry["description"], "status": entry["status"],
                "sourceType": entry["source_type"], "sourceId": entry["source_id"],
            }
            if vat_out != 0:
                output_rows.append({**base, "net": str(to_money(net_out)), "vat": str(to_money(vat_out)), "gross": str(to_money(net_out + vat_out))})
            if vat_in != 0:
                input_rows.append({**base, "net": str(to_money(net_in)), "vat": str(to_money(vat_in)), "gross": str(to_money(net_in + vat_in))})
        handler.send_json({"output": output_rows, "input": input_rows})
        return True

    if route == "/api/accounting/periods":
        handler.send_json({"periods": posting_service.list_periods(handler.db_path)})
        return True

    if route == "/api/accounting/opening-inventory":
        handler.send_json({"batches": opening_inventory_service.list_batches(handler.db_path)})
        return True

    if route == "/api/accounting/opening-inventory/suggest":
        handler.send_json(opening_inventory_service.suggest_from_state(handler.db_path))
        return True

    if route == "/api/accounting/inventory-reconciliation":
        handler.send_json(opening_inventory_service.inventory_reconciliation(
            handler.db_path,
            date_from=_one(query, "from") or None,
            date_to=_one(query, "to") or None,
        ))
        return True

    if route == "/api/accounting/reconciliation":
        date_from = _one(query, "from") or None
        date_to = _one(query, "to") or None
        balance = {row["code"]: row for row in posting_service.trial_balance(handler.db_path, date_from, date_to)}

        def _ledger(code, field="balance"):
            row = balance.get(code)
            return str(to_money(Decimal(row[field]))) if row else "0.00"

        state = read_state(handler.db_path) or {}
        data = state.get("data") if isinstance(state.get("data"), dict) else {}

        def _in_range(value):
            date = str(value or "")[:10]
            if date_from and date < date_from:
                return False
            if date_to and date > date_to:
                return False
            return bool(date)

        legacy_orders = sum(float(o.get("amount") or 0) for o in data.get("orders") or [] if _in_range(o.get("date")))
        legacy_thu = sum(float(t.get("amount") or 0) for t in data.get("transactions") or [] if t.get("kind") == "thu" and _in_range(t.get("date")))
        legacy_chi = sum(float(t.get("amount") or 0) for t in data.get("transactions") or [] if t.get("kind") == "chi" and _in_range(t.get("date")))
        handler.send_json({
            "ledger": {
                "revenue511": _ledger("511"),
                "financial515": _ledger("515"),
                "otherIncome711": _ledger("711"),
                "vatOut3331": _ledger("3331"),
                "receivable131": _ledger("131"),
                "payable331": _ledger("331"),
                "cogs632": _ledger("632"),
                "expense641": _ledger("641"),
                "expense642": _ledger("642"),
                "cash111": _ledger("111"),
                "bank112": _ledger("112"),
            },
            "legacy": {
                "ordersGross": round(legacy_orders),
                "cashIn": round(legacy_thu),
                "cashOut": round(legacy_chi),
            },
            "note": "Doanh thu sổ cái (511) là số CHƯA VAT nên thấp hơn tổng đơn hàng (gồm VAT) đúng bằng số dư 3331.",
        })
        return True

    return False


def handle_post(handler, route, _parsed):
    if not route.startswith("/api/accounting/"):
        return False
    user = handler.require_user()
    if not user:
        return True
    if not _require_accountant(handler, user):
        return True
    posting_service.ensure_schema(handler.db_path)
    body = handler.read_json() or {}
    email = (user or {}).get("email") or ""

    try:
        if route == "/api/accounting/sync":
            mode = str(body.get("mode") or "preview")
            handler.send_json(sync_ledger(handler.db_path, mode="commit" if mode == "commit" else "preview", actor=email))
            return True

        if route == "/api/accounting/journal":
            result = posting_service.create_manual_draft(
                handler.db_path,
                document_date=str(body.get("date") or ""),
                description=str(body.get("description") or ""),
                lines=body.get("lines") or [],
                created_by=email,
            )
            handler.send_json({"entry": result, "status": "pending_approval"})
            return True

        if route == "/api/accounting/journal/approve":
            handler.send_json(posting_service.approve_entry(handler.db_path, int(body.get("entryId")), email))
            return True

        if route == "/api/accounting/journal/reject":
            handler.send_json(posting_service.reject_entry(handler.db_path, int(body.get("entryId")), email, str(body.get("reason") or "")))
            return True

        if route == "/api/accounting/journal/reverse":
            handler.send_json(posting_service.reverse_entry(
                handler.db_path, int(body.get("entryId")), email, str(body.get("reason") or ""),
                posting_date=str(body.get("postingDate") or "") or None,
            ))
            return True

        if route == "/api/accounting/opening-inventory":
            result = opening_inventory_service.create_batch(
                handler.db_path,
                effective_date=str(body.get("effectiveDate") or ""),
                counter_account=str(body.get("counterAccount") or ""),
                lines=body.get("lines") or [],
                warehouse=str(body.get("warehouse") or "MAIN"),
                source_document=str(body.get("sourceDocument") or ""),
                note=str(body.get("note") or ""),
                created_by=email,
                idempotency_key=str(body.get("idempotencyKey") or ""),
            )
            handler.send_json(result)
            return True

        if route == "/api/accounting/opening-inventory/review":
            handler.send_json(opening_inventory_service.review_batch(handler.db_path, int(body.get("batchId")), email))
            return True

        if route == "/api/accounting/opening-inventory/post":
            mode = "commit" if str(body.get("mode") or "preview") == "commit" else "preview"
            handler.send_json(opening_inventory_service.post_batch(handler.db_path, int(body.get("batchId")), email, mode=mode))
            return True

        if route == "/api/accounting/opening-inventory/reverse":
            handler.send_json(opening_inventory_service.reverse_batch(
                handler.db_path, int(body.get("batchId")), email, str(body.get("reason") or ""),
            ))
            return True

        if route == "/api/accounting/opening-inventory/delete-draft":
            handler.send_json(opening_inventory_service.delete_draft_batch(handler.db_path, int(body.get("batchId")), email))
            return True

        if route == "/api/accounting/periods/lock":
            if _role(user) != "admin":
                handler.send_json({"error": "Chỉ Sếp/Admin được khóa kỳ kế toán."}, 403)
                return True
            posting_service.lock_period(handler.db_path, str(body.get("period") or ""), email)
            handler.send_json({"ok": True})
            return True

        if route == "/api/accounting/periods/unlock":
            if _role(user) != "admin":
                handler.send_json({"error": "Chỉ Sếp/Admin được mở lại kỳ kế toán."}, 403)
                return True
            posting_service.unlock_period(handler.db_path, str(body.get("period") or ""), email, str(body.get("reason") or ""))
            handler.send_json({"ok": True})
            return True
    except PostingError as exc:
        handler.send_json({"error": str(exc)}, 400)
        return True
    except (TypeError, ValueError):
        handler.send_json({"error": "Dữ liệu gửi lên không hợp lệ."}, 400)
        return True

    return False
