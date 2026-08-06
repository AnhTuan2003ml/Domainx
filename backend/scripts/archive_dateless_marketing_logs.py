# -*- coding: utf-8 -*-
"""Migration: LƯU TRỮ (không xóa) các bản ghi Marketing thiếu ngày là BẢN TRÙNG chắc chắn.

Quy tắc an toàn:
  - Chỉ xét bản ghi có ``date`` rỗng/sai định dạng và CHƯA archived.
  - Chỉ lưu trữ khi tồn tại một bản ghi hợp lệ TRÙNG HOÀN TOÀN các chỉ số
    (employeeId, pageId, adSpend, revenue, customersReached, conversions) —
    tức bản ghi lỗi là lần tạo hỏng đã được nhập lại.
  - Không chắc chắn → GIỮ NGUYÊN để người dùng tự sửa ngày trên giao diện
    (mục cảnh báo "bản ghi có ngày bất thường" ở tab Nhật ký).
  - Idempotent: chạy lại không đổi gì thêm. Log đầy đủ: tìm thấy/sửa/bỏ qua + lý do.

Chạy:  python scripts/archive_dateless_marketing_logs.py
"""
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from config import DEFAULT_DB_TARGET  # noqa: E402
from db.state_store import update_state, read_state  # noqa: E402

DATE_ONLY = re.compile(r"^\d{4}-\d{2}-\d{2}$")
DUPLICATE_KEYS = ("employeeId", "pageId", "adSpend", "revenue", "customersReached", "conversions")


def _dup_key(log):
    return tuple(str(log.get(field)) for field in DUPLICATE_KEYS)


def main():
    report = {"found": 0, "archived": 0, "skipped": []}

    def updater(data):
        result = dict(data or {})
        logs = [dict(item) for item in (result.get("marketingLogs") or []) if isinstance(item, dict)]
        valid_keys = {}
        for log in logs:
            if not log.get("archived") and DATE_ONLY.match(str(log.get("date") or "")):
                valid_keys.setdefault(_dup_key(log), []).append(log.get("id"))
        now = datetime.now(timezone.utc).isoformat()
        for log in logs:
            if log.get("archived") or DATE_ONLY.match(str(log.get("date") or "")):
                continue
            report["found"] += 1
            twins = valid_keys.get(_dup_key(log)) or []
            if twins:
                log["archived"] = True
                log["archivedAt"] = now
                log["archivedReason"] = (
                    f"Bản trùng của bản ghi hợp lệ #{twins[0]} — lần tạo đầu lưu lỗi trường ngày; "
                    "lưu trữ bằng migration archive_dateless_marketing_logs, không xóa."
                )
                report["archived"] += 1
            else:
                report["skipped"].append({
                    "id": log.get("id"),
                    "reason": "Không tìm thấy bản ghi hợp lệ trùng chỉ số — giữ lại cho người dùng tự sửa ngày.",
                })
        result["marketingLogs"] = logs
        return result

    update_state(DEFAULT_DB_TARGET, updater)

    print(f"Tìm thấy {report['found']} bản ghi thiếu ngày.")
    print(f"Đã lưu trữ {report['archived']} bản trùng chắc chắn (giữ nguyên trong DB, gắn archived + lý do).")
    for item in report["skipped"]:
        print(f"Bỏ qua #{item['id']}: {item['reason']}")

    data = read_state(DEFAULT_DB_TARGET).get("data") or {}
    logs = data.get("marketingLogs") or []
    active = [item for item in logs if not item.get("archived")]
    bad = [item for item in active if not DATE_ONLY.match(str(item.get("date") or ""))]
    print(f"Sau migration: {len(active)} bản ghi hiệu lực · {len(logs) - len(active)} đã lưu trữ · {len(bad)} còn thiếu ngày.")


if __name__ == "__main__":
    main()
