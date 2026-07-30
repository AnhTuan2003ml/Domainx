import {
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
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Package,
  PieChart,
  Scale,
  Settings,
  UserPlus,
  Users,
  ClipboardList,
} from "lucide-react";

export function buildNavigationGroups({ lang, t }) {
  const vi = lang === "vi";
  return [
    {
      label: vi ? "Trung tâm quản trị" : "Management Center",
      items: [
        { id: "dashboard", label: t("nav_dashboard"), icon: LayoutDashboard },
        { id: "crm", label: t("nav_crm"), icon: BarChart3 },
        { id: "kho", label: t("nav_kho"), icon: Package },
        { id: "nhansu", label: t("nav_nhansu"), icon: Users },
      ],
    },
    {
      label: vi ? "Nhân sự & Tiền lương" : "HR & Payroll",
      items: [
        { id: "chamcong", label: t("nav_chamcong"), icon: CalendarCheck },
        { id: "luong", label: t("nav_luong"), icon: Banknote },
        { id: "hieusuat", label: t("nav_hieusuat"), icon: Gauge },
        { id: "tuyendung", label: vi ? "Tuyển dụng AI" : "AI Recruitment", icon: UserPlus, beta: true },
      ],
    },
    {
      label: vi ? "Sổ sách & Kế toán" : "Books & Accounting",
      items: [
        { id: "thuchi", label: t("nav_thuchi"), icon: FileText },
        { id: "congno", label: t("nav_congno"), icon: CreditCard },
        { id: "vongop", label: t("nav_vongop"), icon: Coins },
        { id: "taisan", label: vi ? "Tài sản cố định & CCDC" : "Fixed Assets & Tools", icon: Archive },
        { id: "quy", label: t("nav_quy"), icon: FileSpreadsheet },
        { id: "hoachdinh", label: t("nav_hoachdinh"), icon: PieChart, beta: true },
      ],
    },
    {
      label: vi ? "Kinh doanh & Vận hành" : "Business & Operations",
      items: [
        { id: "marketing", label: t("nav_marketing"), icon: Megaphone },
        { id: "hoptac", label: t("nav_hoptac"), icon: Handshake },
        { id: "hopdong", label: vi ? "Hợp đồng" : "Contracts", icon: FileSignature },
        { id: "hotro", label: vi ? "Hỗ trợ khách hàng" : "Customer Support", icon: Headphones },
      ],
    },
    {
      label: vi ? "Công việc & Trao đổi" : "Tasks & Communication",
      items: [
        { id: "giaoviec", label: t("nav_giaoviec"), icon: ClipboardList },
        { id: "chat", label: vi ? "Tin nhắn" : "Messages", icon: MessageCircle },
      ],
    },
    {
      label: vi ? "Trợ lý & Hệ thống" : "Assistants & System",
      items: [
        { id: "ai", label: t("nav_ai"), icon: Bot, beta: true },
        { id: "phaply", label: t("nav_phaply"), icon: Scale, beta: true },
        { id: "task-reminder-settings", label: vi ? "Cấu hình nhắc việc" : "Task reminders", icon: BellRing },
        { id: "settings", label: t("nav_settings"), icon: Settings },
      ],
    },
  ];
}
