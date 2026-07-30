import { Briefcase, Calculator, Code, Crown, Headphones, Megaphone, Settings, Users, UserCog, Wrench } from "lucide-react";

function normalizeAccountRoleValue(value = "user") {
  const role = String(value || "user").trim().toLowerCase();
  if (role === "admin" || role === "boss") return "admin";
  if (role === "accountant") return "accountant";
  return "user";
}

export const ROLE_META = {
  ads: { label: "Marketing / Ads", icon: Megaphone },
  sale: { label: "Sale / Kinh doanh", icon: Briefcase },
  ky_thuat: { label: "Hỗ trợ kỹ thuật", icon: Wrench },
  it: { label: "IT / Phát triển phần mềm", icon: Code },
  ke_toan: { label: "Kế toán / Tài chính", icon: Calculator },
  nhan_su: { label: "Nhân sự / HR", icon: Users },
  van_hanh: { label: "Vận hành", icon: Settings },
  cskh: { label: "Chăm sóc khách hàng", icon: Headphones },
  quan_ly: { label: "Quản lý / Ban giám đốc", icon: Crown },
  khac: { label: "Khác (tự nhập ở ô Chức vụ bên dưới)", icon: UserCog },
};

// Quyền nghiệp vụ theo nhóm vị trí. users.role vẫn chỉ có admin/accountant/user;
// quyền dưới đây quyết định nhân viên user được mở thêm tab nào và được thao tác đến đâu.
export const POSITION_ACCESS_META = {
  ads: {
    tabs: ["marketing", "kho"], marketingWrite: true,
    inventoryScope: "assigned", inventoryWrite: true,
    summary: "Ghi nhận/cập nhật Marketing hằng ngày; xem và sửa sản phẩm được phân công.",
  },
  sale: {
    tabs: ["crm", "marketing", "kho", "hotro"], marketingWrite: true,
    inventoryScope: "assigned", inventoryWrite: true,
    summary: "Quản lý đơn CRM của mình; cập nhật Marketing hằng ngày; sửa sản phẩm được phân công.",
  },
  ky_thuat: {
    tabs: ["crm", "kho", "hotro"], inventoryScope: "assigned", inventoryWrite: true,
    summary: "Xử lý hỗ trợ/upsale và sửa sản phẩm được phân công.",
  },
  it: {
    tabs: ["kho"], inventoryScope: "assigned", inventoryWrite: true,
    summary: "Chỉ xem và sửa sản phẩm được giao phụ trách.",
  },
  ke_toan: {
    tabs: [], inventoryScope: "all", inventoryWrite: true,
    summary: "Tài khoản được đồng bộ thành quyền Kế toán và có toàn quyền vận hành.",
  },
  nhan_su: {
    tabs: ["nhansu", "tuyendung", "chamcong", "hieusuat"], inventoryScope: "none",
    summary: "Theo dõi nhân sự, tuyển dụng, chấm công và hiệu suất; không truy cập tài chính.",
  },
  van_hanh: {
    tabs: ["kho", "hopdong", "hotro"], inventoryScope: "assigned", inventoryWrite: true,
    summary: "Theo dõi vận hành và sửa sản phẩm được phân công.",
  },
  cskh: {
    tabs: ["kho", "hotro"], inventoryScope: "all-read", inventoryWrite: false,
    summary: "Xem toàn bộ kho để tư vấn khách hàng; không được thay đổi kho.",
  },
  quan_ly: {
    tabs: ["dashboard", "crm", "marketing", "kho", "hopdong", "hotro", "nhansu", "hieusuat"],
    inventoryScope: "all-read", inventoryWrite: false,
    summary: "Xem báo cáo vận hành tổng hợp; các thay đổi nhạy cảm vẫn dành cho Admin/Kế toán.",
  },
  khac: {
    tabs: [], inventoryScope: "none", inventoryWrite: false,
    summary: "Chỉ dùng chức năng cá nhân; quyền bổ sung cần Admin đổi nhóm vị trí.",
  },
};

export function positionAccessFor(employee, accountRole = "user") {
  const role = normalizeAccountRoleValue(accountRole);
  if (role === "admin" || role === "accountant") {
    return { full: true, tabs: [], marketingWrite: true, inventoryScope: "all", inventoryWrite: true };
  }
  const roleType = employee?.roleType || "khac";
  return { full: false, roleType, ...(POSITION_ACCESS_META[roleType] || POSITION_ACCESS_META.khac) };
}
