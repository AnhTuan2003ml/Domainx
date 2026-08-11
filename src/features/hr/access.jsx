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
// CHÍNH SÁCH KHO MỞ: mọi nhóm vị trí đều xem TOÀN BỘ kho và được thêm/sửa/xóa sản phẩm —
// trách nhiệm truy vết bằng lịch sử chỉnh sửa từng sản phẩm, không chặn quyền.
export const POSITION_ACCESS_META = {
  ads: {
    tabs: ["marketing", "kho"], marketingWrite: true,
    inventoryScope: "all", inventoryWrite: true,
    summary: "Ghi nhận/cập nhật Marketing hằng ngày; toàn quyền xem và thao tác Kho hàng.",
  },
  sale: {
    tabs: ["khachhang", "crm", "donhang", "marketing", "kho", "hotro"], marketingWrite: true,
    inventoryScope: "all", inventoryWrite: true,
    summary: "Quản lý đơn CRM của mình; cập nhật Marketing hằng ngày; toàn quyền Kho hàng.",
  },
  ky_thuat: {
    tabs: ["crm", "kho", "hotro", "hotro-donhang", "hotro-lichsu"], inventoryScope: "all", inventoryWrite: true,
    summary: "Xử lý hỗ trợ/upsale, tra cứu đơn đã bán của yêu cầu hỗ trợ; toàn quyền Kho hàng.",
  },
  it: {
    tabs: ["kho"], inventoryScope: "all", inventoryWrite: true,
    summary: "Toàn quyền xem và thao tác Kho hàng.",
  },
  ke_toan: {
    tabs: [], inventoryScope: "all", inventoryWrite: true,
    summary: "Tài khoản được đồng bộ thành quyền Kế toán và có toàn quyền vận hành.",
  },
  nhan_su: {
    tabs: ["nhansu", "tuyendung", "chamcong", "hieusuat"], inventoryScope: "all", inventoryWrite: true,
    summary: "Theo dõi nhân sự, tuyển dụng, chấm công và hiệu suất; toàn quyền Kho hàng; không truy cập tài chính.",
  },
  van_hanh: {
    tabs: ["kho", "hopdong", "hotro"], inventoryScope: "all", inventoryWrite: true,
    summary: "Theo dõi vận hành; toàn quyền Kho hàng.",
  },
  cskh: {
    // CSKH đi trọn luồng trong mục Hỗ trợ khách hàng: yêu cầu → khách → đơn đã mua →
    // công nợ cần nhắc → lịch sử.
    tabs: ["kho", "hotro", "hotro-donhang", "hotro-khach", "hotro-congno", "hotro-lichsu"],
    inventoryScope: "all", inventoryWrite: true,
    summary: "Toàn quyền Kho hàng để tư vấn khách; theo luồng hỗ trợ tra được khách, đơn đã mua và công nợ cần nhắc.",
  },
  quan_ly: {
    tabs: ["dashboard", "crm", "marketing", "kho", "hopdong", "hotro", "nhansu", "hieusuat"],
    inventoryScope: "all", inventoryWrite: true,
    summary: "Xem báo cáo vận hành tổng hợp; toàn quyền Kho hàng; các thay đổi nhạy cảm vẫn dành cho Admin/Kế toán.",
  },
  khac: {
    tabs: [], inventoryScope: "all", inventoryWrite: true,
    summary: "Dùng chức năng cá nhân và toàn quyền Kho hàng; quyền bổ sung cần Admin đổi nhóm vị trí.",
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

export const ACCOUNT_ROLE_META = {
  admin: { label: "Quản trị/Admin", description: "Toàn quyền quản trị hệ thống và duyệt cuối." },
  accountant: { label: "Kế toán", description: "Toàn quyền vận hành tương đương Admin; vẫn tách riêng trong luồng duyệt lương." },
  user: { label: "Nhân viên", description: "Nhận việc, chat, toàn quyền Kho hàng, xem Hiệu suất, chấm công và tạo đề xuất lương cá nhân." },
};

export const ROLE_TAB_ACCESS = {
  admin: [
    "dashboard", "dieuhanh", "thuchi", "congno", "vongop", "taisan", "quy", "hoachdinh", "socai",
    "khachhang", "leads", "crm", "donhang", "marketing", "hoptac", "kho", "hopdong",
    "hotro", "hotro-donhang", "hotro-khach", "hotro-congno", "hotro-lichsu",
    "giaoviec", "chat", "nhansu", "tuyendung", "chamcong", "hieusuat", "luong",
    "ai", "phaply", "task-reminder-settings", "settings", "taikhoan",
  ],
  accountant: [
    "dashboard", "dieuhanh", "thuchi", "congno", "vongop", "taisan", "quy", "hoachdinh", "socai",
    "khachhang", "leads", "crm", "donhang", "marketing", "hoptac", "kho", "hopdong",
    "hotro", "hotro-donhang", "hotro-khach", "hotro-congno", "hotro-lichsu",
    "giaoviec", "chat", "nhansu", "tuyendung", "chamcong", "hieusuat", "luong",
    "ai", "phaply", "settings", "taikhoan",
  ],
  // Chính sách mở: mọi nhân viên đều có Kho hàng (toàn quyền), Hiệu suất nhân viên,
  // Danh sách khách hàng và trọn luồng Chăm sóc khách hàng (yêu cầu → đơn đã bán →
  // khách → công nợ cần nhắc → lịch sử).
  user: [
    "crm", "giaoviec", "chat", "chamcong", "luong", "taikhoan", "kho", "hieusuat",
    "khachhang", "leads", "hotro", "hotro-donhang", "hotro-khach", "hotro-congno", "hotro-lichsu",
    // Mọi nhân viên xem được Bảng hiệu suất Marketing theo ngày (ghi vẫn theo quyền vị trí).
    "marketing",
  ],
};

export function normalizeAccountEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

export function normalizeAccountRole(role = "user") {
  return normalizeAccountRoleValue(role);
}

export function isAdminRole(role) {
  return normalizeAccountRole(role) === "admin";
}

export function isAccountantRole(role) {
  return normalizeAccountRole(role) === "accountant";
}

export function accountRoleLabel(role) {
  return ACCOUNT_ROLE_META[normalizeAccountRole(role)]?.label || "Nhân viên";
}

export function allowedTabsForRole(role, employee = null) {
  const normalizedRole = normalizeAccountRole(role);
  if (normalizedRole !== "user") return ROLE_TAB_ACCESS[normalizedRole] || ROLE_TAB_ACCESS.user;
  const positionTabs = positionAccessFor(employee, normalizedRole).tabs || [];
  return Array.from(new Set([...ROLE_TAB_ACCESS.user, ...positionTabs]));
}

export function defaultTabForRole(role, employee = null) {
  const normalizedRole = normalizeAccountRole(role);
  if (normalizedRole !== "user") return "dashboard";
  const allowed = allowedTabsForRole(normalizedRole, employee);
  return allowed.includes("giaoviec") ? "giaoviec" : (allowed[0] || "taikhoan");
}

export function normalizePayrollRoleText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function employeeIsAccountant(employee) {
  if (!employee || employee.status === "inactive") return false;
  const roleToken = normalizePayrollRoleText(employee.roleType).replace(/\s+/g, "_");
  if (["ke_toan", "ketoan", "accountant", "accounting", "finance"].includes(roleToken)) return true;
  const description = normalizePayrollRoleText(`${employee.position || ""} ${employee.dept || ""}`);
  return ["ke toan", "tai chinh", "accountant", "accounting", "finance"]
    .some((token) => description.includes(token));
}

export function employeeProfileForEmail(employees = [], email = "") {
  const normalized = normalizeAccountEmail(email);
  return (employees || []).find((employee) => normalizeAccountEmail(employee.email) === normalized) || null;
}

export function employeeForAuthUser(employees = [], authUser = null) {
  const accountId = Number(authUser?.id);
  const linkedByAccountId = Number.isFinite(accountId)
    ? (employees || []).find((employee) => Number(employee.account_id) === accountId)
    : null;
  return linkedByAccountId || employeeProfileForEmail(employees, authUser?.email);
}

export function accountDisplayName(employee, email = "") {
  return employee?.name?.trim() || String(email || "").trim() || "Nhân viên";
}

export function accountPositionLabel(employee, accountRole = "user") {
  return employee?.position?.trim()
    || ROLE_META[employee?.roleType]?.label
    || accountRoleLabel(accountRole);
}

export function accountInitials(value = "") {
  const source = String(value || "").split("@")[0].replace(/[^a-zA-Z0-9À-ỹ]+/g, " ").trim();
  if (!source) return "NV";
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : source.slice(0, 2)).toUpperCase();
}
