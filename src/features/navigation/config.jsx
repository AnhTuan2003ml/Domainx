import {
  AlertTriangle,
  Archive,
  Banknote,
  BarChart3,
  BellRing,
  Bot,
  CalendarCheck,
  Coins,
  CreditCard,
  FileSignature,
  FileSpreadsheet,
  FileText,
  Gauge,
  Handshake,
  Headphones,
  History,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Package,
  PieChart,
  Scale,
  Settings,
  ShoppingCart,
  UserPlus,
  Users,
  ClipboardList,
} from "lucide-react";

// Điều hướng kiểu TailAdmin: sidebar là các MỤC CẤP MỘT theo đúng luồng làm việc hằng ngày;
// các bảng con bên trong mỗi mục hiển thị bằng thanh menu ngang ở đầu vùng làm việc (children).
// Quyền truy cập vẫn tính theo từng tab con — mục lớn chỉ hiện khi còn ít nhất 1 tab con được phép.
export function buildNavigationGroups({ lang, t }) {
  const vi = lang === "vi";
  return [
    {
      label: vi ? "Vận hành" : "Operations",
      items: [
        { id: "dashboard", label: t("nav_dashboard"), icon: LayoutDashboard },
        // Trung tâm vận hành = bảng CẦN XỬ LÝ HÔM NAY của quản lý: gom việc tồn đọng từ
        // mọi phân hệ, thao tác ngay trên dòng (mở nguồn, giao việc) — không phải dashboard ngắm.
        { id: "dieuhanh", label: vi ? "Trung tâm vận hành" : "Operations Center", icon: AlertTriangle },
        {
          // Kinh doanh & khách hàng mở MẶC ĐỊNH vào bảng KHÁCH HÀNG — doanh thu là tab con.
          // Marketing KHÔNG nằm ở đây: đó là hoạt động quảng bá, có mục cấp một riêng bên dưới.
          id: "hub-crm",
          label: vi ? "Kinh doanh & Khách hàng" : "Sales & Customers",
          icon: Users,
          children: [
            { id: "khachhang", label: vi ? "Khách hàng" : "Customers", icon: Users },
            { id: "crm", label: vi ? "Trung tâm doanh thu" : "Revenue Center", icon: BarChart3 },
            { id: "hoptac", label: t("nav_hoptac"), icon: Handshake },
            { id: "hopdong", label: vi ? "Hợp đồng" : "Contracts", icon: FileSignature },
          ],
        },
        // Đơn hàng đứng riêng cấp một — Sale/vận hành vào thẳng bảng đơn, không đi vòng.
        { id: "donhang", label: vi ? "Đơn hàng" : "Orders", icon: ShoppingCart },
        // Marketing đứng riêng cấp một: theo dõi chi phí quảng cáo, hiệu suất từng thành viên.
        { id: "marketing", label: vi ? "Marketing" : "Marketing", icon: Megaphone },
        { id: "kho", label: vi ? "Kho & Sản phẩm" : "Inventory & Products", icon: Package },
        {
          id: "hub-hr",
          label: vi ? "Nhân sự & Tiền lương" : "HR & Payroll",
          icon: Users,
          children: [
            { id: "nhansu", label: t("nav_nhansu"), icon: Users },
            { id: "luong", label: t("nav_luong"), icon: Banknote },
            { id: "hieusuat", label: t("nav_hieusuat"), icon: Gauge },
            { id: "tuyendung", label: vi ? "Tuyển dụng AI" : "AI Recruitment", icon: UserPlus, beta: true },
          ],
        },
        { id: "chamcong", label: t("nav_chamcong"), icon: CalendarCheck },
        {
          id: "hub-finance",
          label: vi ? "Tài chính & Kế toán" : "Finance & Accounting",
          icon: FileText,
          children: [
            // Người vận hành vào Thu–Chi/Công nợ trước; Sổ kế toán (hạch toán kép) dành cho
            // Kế toán đứng cuối — không đổi logic, chỉ đổi thứ tự ưu tiên sử dụng.
            { id: "thuchi", label: t("nav_thuchi"), icon: FileText },
            { id: "congno", label: t("nav_congno"), icon: CreditCard },
            { id: "vongop", label: t("nav_vongop"), icon: Coins },
            { id: "taisan", label: vi ? "Tài sản & CCDC" : "Fixed Assets", icon: Archive },
            { id: "socai", label: vi ? "Sổ kế toán" : "Accounting Books", icon: Scale },
          ],
        },
        {
          id: "hub-reports",
          label: vi ? "Báo cáo & Thuế" : "Reports & Tax",
          icon: PieChart,
          children: [
            { id: "quy", label: vi ? "Báo cáo quý & Thuế TNDN" : "Quarterly Report & CIT", icon: FileSpreadsheet },
            { id: "hoachdinh", label: t("nav_hoachdinh"), icon: PieChart, beta: true },
          ],
        },
      ],
    },
    {
      // NHÓM CỘNG TÁC — như cấu trúc cũ: các nghiệp vụ xuyên phòng ban, một chạm.
      label: vi ? "Cộng tác" : "Collaboration",
      items: [
        {
          // Hỗ trợ khách hàng: CSKH đi từ yêu cầu → khách → đơn đã mua → công nợ → lịch sử
          // trong CÙNG một mục, không phải mở nhiều module rồi tự tìm lại một khách hàng.
          id: "hub-support",
          label: vi ? "Hỗ trợ khách hàng" : "Customer Support",
          icon: Headphones,
          children: [
            { id: "hotro", label: vi ? "Yêu cầu hỗ trợ" : "Support Requests", icon: Headphones },
            { id: "hotro-donhang", label: vi ? "Đơn hàng đã bán" : "Sold Orders", icon: ShoppingCart },
            { id: "hotro-khach", label: vi ? "Khách hàng / CRM" : "Customers / CRM", icon: Users },
            { id: "hotro-congno", label: vi ? "Doanh thu & Phải thu" : "Revenue & Receivables", icon: CreditCard },
            { id: "hotro-lichsu", label: vi ? "Lịch sử chăm sóc" : "Care History", icon: History },
          ],
        },
        { id: "giaoviec", label: vi ? "Nhiệm vụ" : "Tasks", icon: ClipboardList },
        { id: "chat", label: vi ? "Tin nhắn" : "Messages", icon: MessageCircle },
      ],
    },
    {
      label: vi ? "Hệ thống" : "System",
      items: [
        {
          id: "hub-ai",
          label: vi ? "Trợ lý AI" : "AI Assistants",
          icon: Bot,
          children: [
            { id: "ai", label: t("nav_ai"), icon: Bot, beta: true },
            { id: "phaply", label: t("nav_phaply"), icon: Scale, beta: true },
          ],
        },
        {
          id: "hub-settings",
          label: t("nav_settings"),
          icon: Settings,
          children: [
            { id: "task-reminder-settings", label: vi ? "Cấu hình thông báo" : "Notifications", icon: BellRing },
            { id: "settings", label: vi ? "Cài đặt công ty" : "Company Settings", icon: Settings },
          ],
        },
      ],
    },
  ];
}
