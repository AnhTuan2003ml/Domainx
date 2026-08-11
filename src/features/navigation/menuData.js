// ---------------------------------------------------------------------------
// CẤU HÌNH MENU TẬP TRUNG — nguồn sự thật DUY NHẤT cho sidebar, thanh tab ngang,
// tiêu đề trang và tìm kiếm chức năng (Ctrl+K + ô "Tìm chức năng" ở sidebar).
//
// - `id` là khóa điều hướng nội bộ (DOMIX là SPA theo tab id, không có URL router)
//   nên GIỮ NGUYÊN 100% id cũ = giữ nguyên "route", deep-link nội bộ (nút "Mở",
//   thông báo, setTab từ mọi component) và phân quyền (allowedTabsForRole theo id).
// - `keywords` chứa TÊN CŨ + từ khóa liên quan để người dùng tìm bằng tên trước
//   tái cấu trúc vẫn ra đúng chức năng mới (VD: "Trung tâm doanh thu" → Bán hàng).
// - KHÔNG lưu số badge ở đây — chỉ khai báo `badgeKey`, giá trị lấy từ dữ liệu thật.
// - File này KHÔNG import icon/React để unit-test chạy thẳng bằng node:test;
//   icon gắn ở features/navigation/config.jsx.
// ---------------------------------------------------------------------------

export const NAV_SECTIONS = [
  {
    id: "section-overview",
    label: { vi: "Tổng quan", en: "Overview" },
    items: [
      {
        id: "hub-overview",
        label: { vi: "Tổng quan", en: "Overview" },
        keywords: ["dashboard", "bảng điều hành", "tổng quan"],
        children: [
          { id: "dashboard", label: { vi: "Bảng điều hành", en: "Dashboard" }, keywords: ["tổng quan", "dashboard", "kpi", "số dư quỹ"] },
          {
            id: "dieuhanh",
            label: { vi: "Việc cần xử lý", en: "Action Items" },
            badgeKey: "opsActionable",
            keywords: ["trung tâm vận hành", "operations center", "cần xử lý", "cảnh báo", "việc tồn đọng"],
          },
        ],
      },
      // Nhiệm vụ đứng cấp một ngay trên Tin nhắn — việc được giao/đã giao là thứ mọi vai trò
      // mở hằng ngày, không phải đi vòng qua nhóm Nhân sự & Tiền lương.
      {
        id: "giaoviec",
        label: { vi: "Nhiệm vụ", en: "Tasks" },
        badgeKey: "taskPending",
        keywords: ["giao việc", "công việc", "nhiệm vụ được giao", "nhiệm vụ đã giao"],
      },
      { id: "chat", label: { vi: "Tin nhắn", en: "Messages" }, badgeKey: "chatUnread", keywords: ["chat", "nhắn tin", "hội thoại"] },
    ],
  },
  {
    id: "section-operations",
    label: { vi: "Vận hành", en: "Operations" },
    items: [
      {
        id: "hub-sales",
        label: { vi: "Bán hàng", en: "Sales" },
        keywords: ["trung tâm doanh thu", "doanh thu", "bán hàng", "sales"],
        children: [
          { id: "donhang", label: { vi: "Đơn hàng", en: "Orders" }, keywords: ["đơn hàng", "orders", "tạo đơn"] },
          {
            id: "crm",
            label: { vi: "Doanh thu & Thanh toán", en: "Revenue & Payments" },
            keywords: ["trung tâm doanh thu", "crm", "thanh toán", "hóa đơn bán hàng", "doanh thu theo page"],
          },
          { id: "hoptac", label: { vi: "Hợp tác phân phối", en: "Distribution" }, keywords: ["đối tác", "phân phối", "quyết toán"] },
          { id: "hopdong", label: { vi: "Hợp đồng", en: "Contracts" }, keywords: ["hợp đồng", "contracts"] },
        ],
      },
      {
        id: "hub-customer",
        label: { vi: "Khách hàng & CSKH", en: "Customers & Care" },
        keywords: ["crm", "chăm sóc khách hàng", "cskh", "hỗ trợ"],
        children: [
          { id: "khachhang", label: { vi: "Danh sách khách hàng", en: "Customers" }, keywords: ["khách hàng", "customers", "danh bạ khách"] },
          // Khách tiềm năng thuộc vòng đời KHÁCH HÀNG (chưa mua → chăm sóc → mua) nên đặt ở
          // nhóm Khách hàng & CSKH, không nằm trong Doanh thu (nơi chỉ có đơn/tiền đã bán).
          {
            id: "leads",
            label: { vi: "Khách hàng tiềm năng", en: "Leads" },
            keywords: ["lead", "khách tiềm năng", "khách cần gọi", "marketing đẩy số", "số điện thoại khách", "chăm sóc khách tiềm năng"],
          },
          {
            id: "hotro",
            label: { vi: "Yêu cầu hỗ trợ", en: "Support Requests" },
            keywords: ["hỗ trợ", "ca hỗ trợ", "mã ca", "giao ca", "danh sách ca", "support", "bảo hành", "tư vấn trước bán"],
          },
          { id: "hotro-donhang", label: { vi: "Đơn hàng đã bán", en: "Sold Orders" }, keywords: ["đơn đã bán", "tra cứu đơn"] },
          { id: "hotro-khach", label: { vi: "Khách hàng (CSKH)", en: "Customers (Care)" }, keywords: ["khách hàng cskh"] },
          { id: "hotro-congno", label: { vi: "Doanh thu & Phải thu", en: "Revenue & Receivables" }, keywords: ["phải thu cskh"] },
          { id: "hotro-lichsu", label: { vi: "Lịch sử tương tác", en: "Interaction History" }, keywords: ["lịch sử chăm sóc", "chi tiết ca", "lịch sử hỗ trợ"] },
        ],
      },
      {
        id: "kho",
        label: { vi: "Sản phẩm & Kho", en: "Products & Inventory" },
        keywords: ["quản lý hàng hóa", "quản lý kho", "sản phẩm", "tồn kho", "nhập kho", "xuất kho", "giao dịch kho", "nhập – xuất kho"],
      },
      {
        id: "marketing",
        label: { vi: "Marketing", en: "Marketing" },
        keywords: ["marketing hàng ngày", "nhật ký marketing", "page bán hàng", "chi phí quảng cáo", "ads", "roas"],
      },
    ],
  },
  {
    id: "section-admin",
    label: { vi: "Quản trị", en: "Administration" },
    items: [
      {
        id: "hub-hr",
        label: { vi: "Nhân sự & Tiền lương", en: "HR & Payroll" },
        keywords: ["nhân sự", "tiền lương", "hr"],
        children: [
          { id: "nhansu", label: { vi: "Nhân sự", en: "Employees" }, keywords: ["hồ sơ nhân viên", "thêm nhân sự"] },
          { id: "chamcong", label: { vi: "Chấm công", en: "Attendance" }, badgeKey: "attendancePending", keywords: ["vào ca", "ra ca", "ngày công", "bảng công"] },
          { id: "luong", label: { vi: "Bảng lương", en: "Payroll" }, badgeKey: "payrollAction", keywords: ["lương", "chốt lương", "thanh toán lương", "hoa hồng", "thưởng", "kỳ lương"] },
          { id: "hieusuat", label: { vi: "Hiệu suất nhân viên", en: "Performance" }, keywords: ["kpi", "xếp hạng", "đánh giá"] },
          { id: "tuyendung", label: { vi: "Tuyển dụng AI", en: "AI Recruitment" }, beta: true, keywords: ["cv", "ứng viên", "tuyển dụng"] },
        ],
      },
      {
        id: "hub-finance",
        label: { vi: "Tài chính & Kế toán", en: "Finance & Accounting" },
        keywords: ["kế toán", "tài chính", "finance"],
        children: [
          {
            id: "thuchi",
            label: { vi: "Thu – Chi", en: "Cash In – Out" },
            keywords: ["giao dịch", "sổ vat", "hóa đơn & vat", "vat đầu ra", "vat đầu vào", "phiếu thu", "phiếu chi", "tạo khoản thu", "tạo khoản chi"],
          },
          { id: "congno", label: { vi: "Công nợ tổng hợp", en: "Receivables & Payables" }, keywords: ["công nợ", "phải thu", "phải trả", "quá hạn"] },
          { id: "vongop", label: { vi: "Vốn góp", en: "Capital" }, keywords: ["vốn điều lệ", "góp vốn"] },
          { id: "taisan", label: { vi: "Tài sản & CCDC", en: "Fixed Assets" }, keywords: ["khấu hao", "tài sản cố định", "ccdc"] },
          {
            id: "socai",
            label: { vi: "Sổ cái", en: "General Ledger" },
            keywords: ["sổ kế toán", "hạch toán kép", "bút toán", "hệ thống tài khoản", "tài khoản kế toán", "cân đối phát sinh", "nhật ký chung"],
          },
        ],
      },
      {
        id: "hub-reports",
        label: { vi: "Báo cáo & Phân tích", en: "Reports & Analytics" },
        keywords: ["báo cáo", "phân tích", "reports"],
        children: [
          {
            id: "quy",
            label: { vi: "Báo cáo quý & Thuế TNDN", en: "Quarterly Report & CIT" },
            keywords: ["báo cáo theo quý", "thuế tndn", "kết quả kinh doanh", "báo cáo lợi nhuận", "phát sinh tài khoản"],
          },
          { id: "hoachdinh", label: { vi: "Hoạch định ngân sách", en: "Budget Planning" }, beta: true, keywords: ["ngân sách", "hoạch định", "nhân sự kế hoạch"] },
        ],
      },
    ],
  },
  {
    id: "section-system",
    label: { vi: "Hệ thống", en: "System" },
    items: [
      {
        id: "hub-ai",
        label: { vi: "Trợ lý AI", en: "AI Assistants" },
        keywords: ["ai", "trợ lý"],
        children: [
          { id: "ai", label: { vi: "Trợ lý AI kế toán", en: "AI Accountant" }, beta: true, keywords: ["hỏi đáp kế toán"] },
          { id: "phaply", label: { vi: "Trợ lý Pháp lý", en: "AI Legal" }, beta: true, keywords: ["pháp lý", "luật"] },
        ],
      },
      {
        id: "hub-settings",
        label: { vi: "Thiết lập", en: "Settings" },
        keywords: ["cài đặt", "settings", "cấu hình"],
        children: [
          { id: "task-reminder-settings", label: { vi: "Cấu hình thông báo", en: "Notifications" }, keywords: ["nhắc việc", "email", "chuông báo"] },
          {
            id: "settings",
            label: { vi: "Thông tin doanh nghiệp", en: "Company Settings" },
            keywords: ["cài đặt công ty", "thông tin công ty", "sao lưu dữ liệu", "người dùng", "phân quyền", "tài khoản đăng nhập"],
          },
        ],
      },
    ],
  },
];

const _norm = (value) => String(value || "").toLocaleLowerCase("vi-VN").trim();

// Danh sách phẳng mọi TAB điều hướng được (kèm nhãn nhóm cha) — sidebar/tab/breadcrumb/
// tìm kiếm cùng đọc từ đây, không nơi nào tự duy trì danh sách riêng.
export function flattenNavEntries(lang = "vi") {
  const pick = (label) => (lang === "vi" ? label.vi : label.en || label.vi);
  const entries = [];
  NAV_SECTIONS.forEach((section) => {
    section.items.forEach((item) => {
      if (item.children) {
        item.children.forEach((child) => {
          entries.push({
            id: child.id,
            label: pick(child.label),
            parentId: item.id,
            parentLabel: pick(item.label),
            sectionLabel: pick(section.label),
            badgeKey: child.badgeKey || null,
            beta: Boolean(child.beta),
            keywords: [...(child.keywords || []), ...(item.keywords || [])],
          });
        });
      } else {
        entries.push({
          id: item.id,
          label: pick(item.label),
          parentId: null,
          parentLabel: pick(section.label),
          sectionLabel: pick(section.label),
          badgeKey: item.badgeKey || null,
          beta: Boolean(item.beta),
          keywords: item.keywords || [],
        });
      }
    });
  });
  return entries;
}

// Tìm chức năng theo TÊN MỚI hoặc TÊN CŨ (keywords) — chỉ tìm chức năng, không tìm dữ liệu.
export function searchNavEntries(entries, query) {
  const needle = _norm(query);
  if (!needle) return entries;
  return entries.filter((entry) => (
    _norm(entry.label).includes(needle)
    || _norm(entry.parentLabel).includes(needle)
    || (entry.keywords || []).some((keyword) => _norm(keyword).includes(needle))
  ));
}
