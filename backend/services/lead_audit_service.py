"""Đóng dấu NGƯỜI THU THẬP cho khách hàng tiềm năng (leads).

Chính sách mở: mọi nhân viên đều thêm/sửa/xóa được lead. Câu hỏi "khách này do ai
lấy được thông tin" phải trả lời được bằng dữ liệu MÁY CHỦ ghi, không tin client:

- Lead MỚI xuất hiện trong một lần lưu → đóng dấu collectedByEmail/collectedByName/
  collectedAt theo đúng tài khoản đang gửi request.
- Lead ĐÃ CÓ → giữ nguyên bộ dấu gốc từ bản đã lưu, bỏ qua mọi giá trị client gửi lên
  (không cho sửa lại lịch sử thu thập). Lead cũ chưa từng có dấu thì để trống — không
  bịa người thu thập cho dữ liệu lịch sử.
"""

from datetime import datetime, timedelta, timezone

_VN_TZ = timezone(timedelta(hours=7))
_COLLECT_FIELDS = ("collectedByEmail", "collectedByName", "collectedAt")


def stamp_lead_collectors(existing_data, new_data, actor_email="", actor_name=""):
    """Chạy TRONG transaction update_state, sau các bước hợp nhất/kiểm tra khác."""
    if not isinstance(new_data, dict) or not isinstance(new_data.get("leads"), list):
        return new_data

    existing_by_id = {
        str(lead.get("id")): lead
        for lead in (existing_data or {}).get("leads") or []
        if isinstance(lead, dict) and lead.get("id") is not None
    }
    actor_email = str(actor_email or "").strip()
    actor_name = str(actor_name or "").strip() or actor_email
    stamp = datetime.now(_VN_TZ).strftime("%Y-%m-%d %H:%M:%S")

    stamped_leads = []
    for lead in new_data["leads"]:
        if not isinstance(lead, dict) or lead.get("id") is None:
            stamped_leads.append(lead)
            continue
        old = existing_by_id.get(str(lead.get("id")))
        item = dict(lead)
        if old is None:
            item["collectedByEmail"] = actor_email
            item["collectedByName"] = actor_name
            item["collectedAt"] = stamp
        else:
            for field in _COLLECT_FIELDS:
                if old.get(field) is not None:
                    item[field] = old.get(field)
                else:
                    item.pop(field, None)
        stamped_leads.append(item)

    result = dict(new_data)
    result["leads"] = stamped_leads
    return result
