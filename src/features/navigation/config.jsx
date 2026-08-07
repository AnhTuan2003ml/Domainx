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

import { NAV_SECTIONS } from "./menuData";

// Điều hướng 4 khu vực (Tổng quan · Vận hành · Quản trị · Hệ thống) đọc từ CẤU HÌNH MENU
// TẬP TRUNG (menuData.js) — sidebar chỉ hiện nhóm nghiệp vụ, các bảng con hiển thị bằng
// thanh tab ngang ở đầu vùng làm việc. Icon gắn tại đây để menuData thuần dữ liệu, unit-test được.
const ICON_BY_ID = {
  "hub-overview": LayoutDashboard,
  dashboard: LayoutDashboard,
  dieuhanh: AlertTriangle,
  chat: MessageCircle,
  "hub-sales": ShoppingCart,
  donhang: ShoppingCart,
  crm: BarChart3,
  hoptac: Handshake,
  hopdong: FileSignature,
  "hub-customer": Users,
  khachhang: Users,
  hotro: Headphones,
  "hotro-donhang": ShoppingCart,
  "hotro-khach": Users,
  "hotro-congno": CreditCard,
  "hotro-lichsu": History,
  kho: Package,
  marketing: Megaphone,
  "hub-hr": Users,
  nhansu: Users,
  chamcong: CalendarCheck,
  giaoviec: ClipboardList,
  luong: Banknote,
  hieusuat: Gauge,
  tuyendung: UserPlus,
  "hub-finance": FileText,
  thuchi: FileText,
  congno: CreditCard,
  vongop: Coins,
  taisan: Archive,
  socai: Scale,
  "hub-reports": PieChart,
  quy: FileSpreadsheet,
  hoachdinh: PieChart,
  "hub-ai": Bot,
  ai: Bot,
  phaply: Scale,
  "hub-settings": Settings,
  "task-reminder-settings": BellRing,
  settings: Settings,
};

const _iconOf = (id) => ICON_BY_ID[id] || FileText;

export function buildNavigationGroups({ lang }) {
  const pick = (label) => (lang === "vi" ? label.vi : label.en || label.vi);
  return NAV_SECTIONS.map((section) => ({
    id: section.id,
    label: pick(section.label),
    items: section.items.map((item) => ({
      id: item.id,
      label: pick(item.label),
      icon: _iconOf(item.id),
      beta: Boolean(item.beta),
      badgeKey: item.badgeKey || null,
      keywords: item.keywords || [],
      ...(item.children ? {} : { parentLabel: pick(section.label) }),
      ...(item.children ? {
        children: item.children.map((child) => ({
          id: child.id,
          label: pick(child.label),
          icon: _iconOf(child.id),
          beta: Boolean(child.beta),
          badgeKey: child.badgeKey || null,
          keywords: child.keywords || [],
          parentLabel: pick(item.label),
        })),
      } : {}),
    })),
  }));
}
