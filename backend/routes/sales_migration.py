"""API migration luồng bán hàng — /api/sales/migration (chỉ Admin).

POST body {"mode": "dry-run" | "commit" | "rollback"}:
  - dry-run: KHÔNG ghi gì — trả báo cáo đếm bản ghi theo từng kết quả mapping.
  - commit: ghi 4 trạng thái mới + items chuẩn hóa CẠNH dữ liệu cũ (expand);
    legacy status giữ nguyên, bản ghi mơ hồ mang needsReview.
  - rollback: gỡ toàn bộ trường mới (contract ngược), legacy còn nguyên.
"""

from db.state_store import update_state
from services.sales_migration_service import migrate_orders, rollback_orders


def _role(user):
    value = str((user or {}).get("role") or "").strip().lower()
    return "admin" if value in {"admin", "boss"} else "accountant" if value == "accountant" else "user"


def handle_post(handler, route, _parsed):
    if route != "/api/sales/migration":
        return False
    user = handler.require_user()
    if not user:
        return True
    if _role(user) != "admin":
        handler.send_json({"error": "Chỉ Admin được chạy migration luồng bán hàng.", "code": "PERMISSION_DENIED"}, 403)
        return True
    body = handler.read_json() or {}
    mode = str(body.get("mode") or "dry-run")
    if mode not in {"dry-run", "commit", "rollback"}:
        handler.send_json({"error": "mode phải là dry-run, commit hoặc rollback."}, 400)
        return True

    report = {}

    def apply(existing_data):
        nonlocal report
        data = dict(existing_data)
        if mode == "rollback":
            report = rollback_orders(data)
        else:
            report = migrate_orders(data, mode=mode)
        return data

    if mode == "dry-run":
        # dry-run đọc trạng thái hiện tại, tuyệt đối không ghi.
        from db.state_store import read_state
        state = read_state(handler.db_path) or {}
        data = state.get("data") if isinstance(state.get("data"), dict) else {}
        handler.send_json(migrate_orders(dict(data), mode="dry-run"))
        return True

    update_state(handler.db_path, apply)
    handler.send_json(report)
    return True
