import test from "node:test";
import assert from "node:assert/strict";

import { NAV_SECTIONS, flattenNavEntries, searchNavEntries } from "./features/navigation/menuData.js";

const entries = flattenNavEntries("vi");

test("menu chia đúng 4 khu vực: Tổng quan · Vận hành · Quản trị · Hệ thống", () => {
  assert.deepEqual(NAV_SECTIONS.map((s) => s.label.vi), ["Tổng quan", "Vận hành", "Quản trị", "Hệ thống"]);
});

test("mỗi tab id chỉ xuất hiện đúng một lần — không lặp chức năng ở nhiều nhóm", () => {
  const ids = entries.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, `Trùng id: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`);
});

test("giữ nguyên 100% tab id cũ — không mất route/phân quyền nào", () => {
  const expected = [
    "dashboard", "dieuhanh", "chat", "donhang", "crm", "hoptac", "hopdong",
    "khachhang", "hotro", "hotro-donhang", "hotro-khach", "hotro-congno", "hotro-lichsu",
    "kho", "marketing", "nhansu", "chamcong", "giaoviec", "luong", "hieusuat", "tuyendung",
    "thuchi", "congno", "vongop", "taisan", "socai", "quy", "hoachdinh",
    "ai", "phaply", "task-reminder-settings", "settings",
  ];
  const ids = new Set(entries.map((e) => e.id));
  expected.forEach((id) => assert.ok(ids.has(id), `Thiếu tab id: ${id}`));
  assert.equal(ids.size, expected.length);
});

test("tìm bằng TÊN CŨ trả về đúng chức năng mới", () => {
  const first = (q) => searchNavEntries(entries, q)[0];
  assert.equal(first("Trung tâm doanh thu")?.parentLabel, "Bán hàng");
  assert.equal(first("Trung tâm vận hành")?.id, "dieuhanh");
  assert.equal(first("Trung tâm vận hành")?.label, "Việc cần xử lý");
  assert.equal(first("Sổ VAT")?.id, "thuchi");
  assert.equal(first("lead")?.id, "crm");
  assert.equal(first("mã ca")?.id, "hotro");
  assert.equal(first("quản lý hàng hóa")?.id, "kho");
  assert.equal(first("giao dịch kho")?.id, "kho");
  assert.equal(first("hệ thống tài khoản")?.id, "socai");
  assert.equal(first("báo cáo lợi nhuận")?.id, "quy");
});

test("tìm bằng tên mới cũng ra đúng và truy vấn rỗng trả toàn bộ", () => {
  assert.equal(searchNavEntries(entries, "Việc cần xử lý")[0]?.id, "dieuhanh");
  assert.equal(searchNavEntries(entries, "Khách hàng tiềm năng")[0]?.id, "crm");
  assert.equal(searchNavEntries(entries, "").length, entries.length);
  assert.equal(searchNavEntries(entries, "chuỗi-không-tồn-tại-xyz").length, 0);
});

test("badge không lưu số trong cấu hình — chỉ khai báo badgeKey", () => {
  entries.forEach((e) => {
    if (e.badgeKey !== null) assert.equal(typeof e.badgeKey, "string");
  });
  assert.equal(entries.find((e) => e.id === "dieuhanh")?.badgeKey, "opsActionable");
  assert.equal(entries.find((e) => e.id === "chat")?.badgeKey, "chatUnread");
});

test("mọi mục đều có nhãn ngắn gọn và nhóm cha để hiển thị breadcrumb/tìm kiếm", () => {
  entries.forEach((e) => {
    assert.ok(e.label.length > 0 && e.label.length <= 40, `Nhãn quá dài: ${e.id}`);
    assert.ok(e.sectionLabel.length > 0);
  });
});
