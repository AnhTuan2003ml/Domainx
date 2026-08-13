"""Delete Policy dùng chung — vòng đời bản ghi và quy tắc chặn xóa Ở BACKEND.

Nguyên tắc (frontend ẩn nút KHÔNG được xem là biện pháp bảo vệ):
  - Chỉ bản nháp chưa có liên kết nghiệp vụ mới được xóa thật.
  - Bản ghi đã duyệt / đã ghi sổ là bất biến — sửa sai bằng bút toán đảo có lý do.
  - Giao dịch đã thanh toán → hủy/hoàn tiền; đã xuất kho → hoàn kho/đảo giao dịch.
  - Sản phẩm có lịch sử kho → ngừng kinh doanh; nhân viên có bảng lương/nhiệm vụ →
    chuyển trạng thái nghỉ việc; bản ghi đang được tham chiếu → không hard-delete.

Khi chặn, backend trả HTTP 409 với payload cấu trúc (mã lỗi + bản ghi + trạng thái +
hành động được phép) và ghi audit log. Mọi kiểm tra chạy TRONG transaction ghi dữ liệu
(raise trong updater của update_state sẽ rollback toàn bộ).
"""

from __future__ import annotations

import uuid

from db.connection import connect

RECORD_LOCKED = "RECORD_LOCKED"
RECORD_ALREADY_POSTED = "RECORD_ALREADY_POSTED"
RECORD_HAS_REFERENCES = "RECORD_HAS_REFERENCES"
REVERSAL_REQUIRED = "REVERSAL_REQUIRED"
PERMISSION_DENIED = "PERMISSION_DENIED"


class DeletePolicyError(Exception):
    """Vi phạm chính sách xóa — route bắt và trả HTTP 409 với payload cấu trúc."""

    def __init__(self, code, reason, *, record=None, current_status="", allowed_actions=None):
        super().__init__(reason)
        self.code = code
        self.reason = reason
        self.record = record or {}
        self.current_status = current_status
        self.allowed_actions = list(allowed_actions or [])

    def payload(self):
        return {
            "error": self.reason,
            "code": self.code,
            "record": self.record,
            "currentStatus": self.current_status,
            "reason": self.reason,
            "allowedActions": self.allowed_actions,
        }


def audit_blocked_delete(db_path, actor_email, error: DeletePolicyError):
    """Ghi lại mọi lần xóa bị chặn — dấu vết phục vụ kiểm toán quyền."""
    try:
        with connect(db_path) as conn:
            conn.execute(
                "INSERT INTO audit_logs (id, action, entity_type, entity_id, actor_email, detail, success)"
                " VALUES (?, 'delete_blocked', ?, ?, ?, ?, 0)",
                (
                    f"delpol:{uuid.uuid4().hex}",
                    str(error.record.get("type") or "record"),
                    str(error.record.get("id") or ""),
                    actor_email or "",
                    f"{error.code}: {error.reason}",
                ),
            )
    except Exception:  # noqa: BLE001 — audit không được làm hỏng response chính
        pass


def _ids(items):
    return {str(item.get("id")) for item in (items or []) if isinstance(item, dict) and item.get("id") is not None}


def _by_id(items):
    return {str(item.get("id")): item for item in (items or []) if isinstance(item, dict) and item.get("id") is not None}


def _posted_journal_sources(conn):
    rows = conn.execute(
        "SELECT source_type, source_id FROM journal_entries WHERE status IN ('posted', 'reversed')"
    ).fetchall()
    return {(row["source_type"], str(row["source_id"])) for row in rows}


def guard_state_removals(db_path, existing_data, new_data, user_role=None):
    """Chặn XÓA-QUA-GHI-ĐÈ trên PUT /api/data(/fields): client gửi mảng thiếu phần tử
    nghĩa là xóa phần tử đó — backend đối chiếu từng collection được bảo vệ."""
    if not isinstance(existing_data, dict) or not isinstance(new_data, dict):
        return

    posted = None

    def _posted():
        nonlocal posted
        if posted is None:
            with connect(db_path) as conn:
                try:
                    posted = _posted_journal_sources(conn)
                except Exception:  # noqa: BLE001 — DB test tối giản chưa có bảng sổ cái
                    posted = set()
        return posted

    # 1) Sản phẩm có lịch sử kho → chỉ được ngừng kinh doanh.
    if "inventory" in new_data:
        removed = _ids(existing_data.get("inventory")) - _ids(new_data.get("inventory"))
        if removed:
            movements_by_product = {}
            for movement in existing_data.get("stockMovements") or []:
                if isinstance(movement, dict):
                    movements_by_product.setdefault(str(movement.get("productId")), []).append(movement)
            products = _by_id(existing_data.get("inventory"))
            for pid in removed:
                if movements_by_product.get(pid):
                    raise DeletePolicyError(
                        RECORD_HAS_REFERENCES,
                        "Sản phẩm đã có lịch sử nhập/xuất kho — không được xóa vì mất dấu vết đối chiếu 156/632. Hãy chuyển sang NGỪNG KINH DOANH.",
                        record={"type": "product", "id": pid, "name": (products.get(pid) or {}).get("name") or ""},
                        current_status="has_stock_history",
                        allowed_actions=["discontinue"],
                    )

    # 2) Nhiệm vụ ĐÃ PHÁT SINH LỊCH SỬ (đã nhận việc, đã báo/duyệt hoàn tất, đã tick
    #    hoàn thành): người thường KHÔNG được xóa khỏi DB — giữ làm dấu vết đánh giá/
    #    lương. RIÊNG ADMIN được chủ động xóa nhiệm vụ đã chọn khỏi lịch sử.
    if "tasks" in new_data and str(user_role or "") != "admin":
        removed = _ids(existing_data.get("tasks")) - _ids(new_data.get("tasks"))
        tasks = _by_id(existing_data.get("tasks"))
        for tid in removed:
            task = tasks.get(tid) or {}
            completion = str(task.get("completionStatus") or "")
            has_history = (
                completion in {"approved", "submitted"}
                or bool(task.get("doneManual"))
                or bool(task.get("acceptedAt"))
            )
            if has_history:
                raise DeletePolicyError(
                    RECORD_LOCKED,
                    "Nhiệm vụ đã phát sinh lịch sử — bản ghi phải được LƯU LẠI để đối chiếu đánh giá hiệu suất/lương. "
                    "Admin muốn bỏ khỏi danh sách hãy dùng GỠ KHỎI DANH SÁCH (archived) — lịch sử giữ nguyên.",
                    record={"type": "task", "id": tid, "name": str(task.get("title") or task.get("name") or task.get("description") or "")},
                    current_status=completion or ("done" if task.get("doneManual") else "accepted"),
                    allowed_actions=["archive"],
                )

    # 3) Giao dịch thu/chi đã vào sổ cái → phải dùng bút toán đỏ/đảo.
    if "transactions" in new_data:
        removed = _ids(existing_data.get("transactions")) - _ids(new_data.get("transactions"))
        transactions = _by_id(existing_data.get("transactions"))
        for tx_id in removed:
            tx = transactions.get(tx_id) or {}
            # ADMIN xóa đơn CRM sẽ kéo theo giao dịch thu sinh từ đơn đó — cho phép,
            # vì bút toán gốc + bút toán đảo (khi hủy đơn) đã triệt tiêu nhau trên sổ cái.
            tx_source = str(tx.get("sourceModule") or tx.get("source") or "").lower()
            if str(user_role or "") == "admin" and tx_source == "crm":
                continue
            if ("manual_tx", tx_id) in _posted():
                raise DeletePolicyError(
                    REVERSAL_REQUIRED,
                    "Giao dịch đã được ghi vào sổ cái — không xóa được. Hãy dùng BÚT TOÁN ĐỎ (đảo) kèm lý do.",
                    record={"type": "transaction", "id": tx_id, "name": str(tx.get("desc") or "")},
                    current_status="posted",
                    allowed_actions=["red_entry_reversal"],
                )

    # 4) Đơn hàng đã ghi sổ / đã có thanh toán / đã xuất kho → hủy hoặc đảo, không xóa.
    if "orders" in new_data:
        removed = _ids(existing_data.get("orders")) - _ids(new_data.get("orders"))
        if removed:
            orders = _by_id(existing_data.get("orders"))
            paid_debt_ids = {
                str(entry.get("debtId"))
                for entry in (existing_data.get("paymentLedger") or [])
                if isinstance(entry, dict) and entry.get("debtId") is not None
            }
            debts_by_order = {
                str(debt.get("orderId")): debt
                for debt in (existing_data.get("debts") or [])
                if isinstance(debt, dict) and debt.get("orderId") is not None
            }
            shipped_orders = {
                str(movement.get("sourceId"))
                for movement in (existing_data.get("stockMovements") or [])
                if isinstance(movement, dict) and str(movement.get("movementType") or "") in {"sale", "sale_out"}
            }
            _cancelled_statuses = {"cancelled", "canceled", "deleted", "huy", "da_huy", "đã hủy"}
            for oid in removed:
                order = orders.get(oid) or {}
                record = {"type": "order", "id": oid, "name": str(order.get("customerName") or "")}
                # ADMIN được xóa VĨNH VIỄN đơn ĐÃ HỦY (dọn đơn test): lúc hủy, kho đã tự
                # hoàn tồn và sổ cái đã tạo bút toán đảo (gốc + đảo triệt tiêu nhau, vẫn
                # nằm nguyên trong journal làm dấu vết) — xóa bản ghi đơn không làm lệch số.
                is_cancelled = str(order.get("status") or "").strip().lower() in _cancelled_statuses
                if is_cancelled and str(user_role or "") == "admin":
                    continue
                if ("order", oid) in _posted():
                    raise DeletePolicyError(
                        REVERSAL_REQUIRED,
                        "Đơn hàng đã ghi nhận doanh thu trên sổ cái — không xóa được. Hãy HỦY ĐƠN để hệ thống tạo bút toán đảo.",
                        record=record, current_status="posted", allowed_actions=["cancel_order"],
                    )
                if oid in shipped_orders:
                    raise DeletePolicyError(
                        REVERSAL_REQUIRED,
                        "Đơn hàng đã XUẤT KHO — không xóa được. Hãy hủy đơn kèm hoàn kho để giữ chuỗi tồn kho liên tục.",
                        record=record, current_status="stock_issued", allowed_actions=["cancel_with_stock_return"],
                    )
                linked_debt = debts_by_order.get(oid)
                if linked_debt:
                    is_paid = str(linked_debt.get("id")) in paid_debt_ids
                    raise DeletePolicyError(
                        RECORD_HAS_REFERENCES,
                        "Đơn hàng đang được công nợ"
                        + (" (đã có thanh toán)" if is_paid else "")
                        + " tham chiếu — không xóa được. Hãy hủy đơn/hoàn tiền các khoản liên quan trước.",
                        record=record, current_status="referenced",
                        allowed_actions=["cancel_order", "refund_payments"] if is_paid else ["cancel_order"],
                    )

    # 5) Kỳ trả lương đã ghi sổ → đảo, không xóa.
    if "payrollPayments" in new_data:
        removed = _ids(existing_data.get("payrollPayments")) - _ids(new_data.get("payrollPayments"))
        for pid in removed:
            if ("payroll_payment", pid) in _posted() or ("payroll_payment", f"{pid}:paid") in _posted():
                raise DeletePolicyError(
                    REVERSAL_REQUIRED,
                    "Kỳ chi lương đã được ghi sổ (642/334, 334/111·112) — không xóa được. Hãy tạo bút toán đảo kèm lý do.",
                    record={"type": "payroll_payment", "id": pid},
                    current_status="posted", allowed_actions=["red_entry_reversal"],
                )

    # 6) Công nợ đã có lần thanh toán → xử lý từng lần thanh toán trước.
    if "debts" in new_data:
        removed = _ids(existing_data.get("debts")) - _ids(new_data.get("debts"))
        if removed:
            paid_debts = {
                str(entry.get("debtId"))
                for entry in (existing_data.get("paymentLedger") or [])
                if isinstance(entry, dict) and entry.get("debtId") is not None
            }
            debts = _by_id(existing_data.get("debts"))
            for did in removed:
                if did in paid_debts:
                    raise DeletePolicyError(
                        RECORD_HAS_REFERENCES,
                        "Công nợ đã có lần thanh toán — không xóa được. Hãy đảo từng lần thanh toán (kèm lý do) trước.",
                        record={"type": "debt", "id": did, "name": str((debts.get(did) or {}).get("counterpartyName") or "")},
                        current_status="has_payments", allowed_actions=["reverse_payments_first"],
                    )

    # 7) Yêu cầu hỗ trợ: KHÔNG xóa thật ở BẤT KỲ trạng thái nào (kể cả "chờ xác nhận") —
    #    thay bằng HỦY kèm lý do (soft-delete có nhật ký cancelReason/cancelledBy/cancelledAt).
    #    Riêng ADMIN được hard-delete (nhất quán với chính sách nhiệm vụ). Đồng thời chặn cả
    #    sự cố client đẩy nhầm mảng rỗng (từng xóa sạch toàn bộ ca hỗ trợ trên server).
    if "supportCases" in new_data and str(user_role or "") != "admin":
        removed = _ids(existing_data.get("supportCases")) - _ids(new_data.get("supportCases"))
        cases = _by_id(existing_data.get("supportCases"))
        for case_id in removed:
            case = cases.get(case_id) or {}
            status = str(case.get("status") or "")
            raise DeletePolicyError(
                RECORD_LOCKED,
                "Yêu cầu hỗ trợ không được xóa trực tiếp — hãy dùng HỦY kèm lý do; bản ghi được giữ lại trong Lịch sử để thống kê.",
                record={"type": "support_case", "id": case_id, "name": str(case.get("customerName") or "")},
                current_status=status, allowed_actions=["cancel_with_reason"],
            )

    # 8) Movement kho đã có bút toán (giá vốn/điều chỉnh/tồn đầu) → bất biến.
    if "stockMovements" in new_data:
        removed = _ids(existing_data.get("stockMovements")) - _ids(new_data.get("stockMovements"))
        for mid in removed:
            if ("stock_movement", mid) in _posted():
                raise DeletePolicyError(
                    RECORD_ALREADY_POSTED,
                    "Chuyển động kho đã có chứng từ trên sổ cái — không xóa được. Hãy dùng phiếu điều chỉnh/hoàn kho mới.",
                    record={"type": "stock_movement", "id": mid},
                    current_status="posted", allowed_actions=["counter_movement"],
                )


def check_employee_delete(db_path, employee_id):
    """Nhân viên đang làm việc hoặc đã có bảng lương/nhiệm vụ/giao dịch → chỉ chuyển trạng thái."""
    from db.state_store import read_state

    try:
        normalized_id = int(employee_id)
    except (TypeError, ValueError):
        return  # id không hợp lệ — để tầng store trả 400 như hành vi cũ

    with connect(db_path) as conn:
        row = conn.execute(
            "SELECT id, name, status FROM employees WHERE id = ?", (normalized_id,)
        ).fetchone()
    if not row:
        return  # không tồn tại — để tầng store trả lỗi nghiệp vụ như cũ
    record = {"type": "employee", "id": str(row["id"]), "name": row["name"] or ""}
    if str(row["status"] or "active") == "active":
        raise DeletePolicyError(
            RECORD_LOCKED,
            "Nhân sự đang LÀM VIỆC — không xóa được. Hãy chuyển 'Nghỉ việc' trước; chỉ hồ sơ đã nghỉ và không còn liên kết mới xóa được.",
            record=record, current_status="active", allowed_actions=["set_inactive"],
        )

    state = read_state(db_path) or {}
    data = state.get("data") if isinstance(state.get("data"), dict) else {}
    employee_key = str(normalized_id)
    references = []
    if any(str(p.get("employeeId")) == employee_key for p in (data.get("payrollPayments") or []) if isinstance(p, dict)):
        references.append("bảng lương")
    if any(str(t.get("employeeId")) == employee_key for t in (data.get("tasks") or []) if isinstance(t, dict)):
        references.append("nhiệm vụ được giao")
    if any(str(t.get("employeeId") or "") == employee_key for t in (data.get("transactions") or []) if isinstance(t, dict)):
        references.append("giao dịch thu/chi")
    if references:
        raise DeletePolicyError(
            RECORD_HAS_REFERENCES,
            f"Hồ sơ đang được tham chiếu bởi: {', '.join(references)} — không hard-delete được. Giữ hồ sơ ở trạng thái nghỉ việc để bảo toàn lịch sử.",
            record=record, current_status="inactive_referenced", allowed_actions=["keep_inactive"],
        )
