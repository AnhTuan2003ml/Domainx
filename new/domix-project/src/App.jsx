import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  LayoutDashboard,
  Wallet,
  Users,
  FileText,
  Bot,
  Send,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  X,
  Trash2,
  Building2,
  Banknote,
  Loader2,
  Target,
  CalendarCheck,
  Link2,
  Gauge,
  FileSpreadsheet,
  Megaphone,
  Wrench,
  Briefcase,
  UserCog,
  ChevronDown,
  ChevronUp,
  Landmark,
  MapPin,
  Phone,
  Pencil,
  ShoppingCart,
  UserCheck,
  Paperclip,
  Sparkles,
  CreditCard,
  Scale,
  Printer,
  Download,
  MessageCircle,
  Package,
  ClipboardList,
  Settings,
  Globe,
  PieChart,
  Calculator,
  Headphones,
  Crown,
  Coins,
  Handshake,
  UserPlus,
  ExternalLink,
  UserX,
  ChevronRight,
  Code,
  FileUp,
  Layers,
  Archive,
  FileSignature,
  Search,
  Sun,
  Moon,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Line,
  Area,
} from "recharts";
import * as XLSX from "xlsx";

const TODAY = new Date(); // ngày thật của máy đang chạy app — Chấm công/khoá sổ luôn tự quét đúng theo ngày hôm nay, không còn cố định ngày demo nữa
const TODAY_STR = TODAY.toISOString().slice(0, 10); // "YYYY-MM-DD" của hôm nay thật — dùng làm giá trị mặc định cho mọi ô ngày trong các form
// Ngày đầy đủ kèm thứ trong tuần, luôn tính từ TODAY thật (không hardcode) — hiện ở đầu trang.
function formatFullDateToday(lang) {
  const weekdays = {
    vi: ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"],
    en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  };
  const dd = String(TODAY.getDate()).padStart(2, "0"), mm = String(TODAY.getMonth() + 1).padStart(2, "0"), yyyy = TODAY.getFullYear();
  if (lang === "vi") return `${weekdays.vi[TODAY.getDay()]}, ${dd}/${mm}/${yyyy}`;
  if (lang === "en") return `${weekdays.en[TODAY.getDay()]}, ${mm}/${dd}/${yyyy}`;
  if (lang === "zh") return `${yyyy}年${mm}月${dd}日`;
  if (lang === "ja") return `${yyyy}年${mm}月${dd}日`;
  if (lang === "th") return `${dd}/${mm}/${yyyy}`;
  return `${dd}/${mm}/${yyyy}`;
}
// Lời chào tự đổi theo đúng giờ thật trong ngày — sáng/trưa/chiều/tối, mỗi khung giờ 1 câu khác
// nhau để ticker đầu trang không lặp lại nhàm chán suốt cả ngày.
function timeBasedGreeting() {
  const h = TODAY.getHours();
  if (h >= 5 && h < 11) return "☀️ Chào buổi sáng cả nhà DOMIX — chúc một ngày làm việc hiệu quả!";
  if (h >= 11 && h < 13) return "🍜 Đến giờ nghỉ trưa rồi — ăn uống đầy đủ để chiều làm việc năng suất nhé!";
  if (h >= 13 && h < 18) return "💪 Chào buổi chiều — cố lên, sắp hoàn thành mục tiêu hôm nay rồi!";
  if (h >= 18 && h < 22) return "🌙 Chào buổi tối — cảm ơn cả nhà đã cố gắng trong ngày hôm nay!";
  return "🌃 Làm việc khuya vất vả rồi — nhớ giữ sức khoẻ nhé!";
}

// ---------- Cấu hình công ty (nhập ở tab Cài đặt) — mọi hợp đồng, sidebar, báo cáo dùng chung. ----------
const DEFAULT_COMPANY = {
  name: "Công ty Công nghệ DOMIX",
  address: "Ocean Park 1, Gia Lâm, Hà Nội",
  phone: "0375899199",
  email: "",
  taxCode: "",
  representative: "",
  directorPassword: "GIAMDOC2026",
  establishedDate: "",
  registeredCharterCapital: 0,
};

// Vốn góp — hình thức góp vốn hợp pháp theo Điều 34 Luật Doanh nghiệp 2020.
const CAPITAL_ASSET_TYPES = {
  tien_mat: "Tiền mặt / Chuyển khoản (VNĐ)",
  ngoai_te: "Ngoại tệ tự do chuyển đổi",
  vang: "Vàng",
  nha_dat: "Nhà, đất (bất động sản)",
  quyen_su_dung_dat: "Quyền sử dụng đất",
  quyen_shtt: "Quyền sở hữu trí tuệ / công nghệ / bí quyết kỹ thuật",
  tai_san_khac: "Tài sản khác định giá được bằng VNĐ",
};

// ---------- Đa ngôn ngữ (VI/EN) — khung điều hướng & Dashboard dịch đầy đủ; các tab chi tiết dịch dần. ----------
const TRANSLATIONS = {
  vi: {
    nav_dashboard: "Tổng quan", nav_thuchi: "Thu chi & Hóa đơn", nav_congno: "Công nợ", nav_crm: "Doanh thu CRM",
    nav_marketing: "Marketing hàng ngày", nav_kho: "Kho hàng", nav_giaoviec: "Giao việc", nav_nhansu: "Nhân sự",
    nav_chamcong: "Chấm công", nav_hieusuat: "Hiệu suất nhân viên", nav_luong: "Bảng lương", nav_quy: "Báo cáo theo Quý",
    nav_ai: "Trợ lý AI kế toán", nav_phaply: "Trợ lý Pháp lý", nav_settings: "Cài đặt công ty",
    nav_vongop: "Vốn góp", nav_hoptac: "Hợp tác phân phối", nav_hoachdinh: "Hoạch định ngân sách",
    sidebar_tagline: "Kế toán · Nhân sự · Lương · Hiệu suất", header_subtitle: "Bản demo prototype",
    header_period: "Kỳ báo cáo", header_prev_period: "Đang xem kỳ trước", label_current: " (hiện tại)",
    missing_invoice_tx: "giao dịch thiếu hóa đơn",
    kpi_cash: "Số dư quỹ hiện tại", kpi_cash_sub: "Cộng dồn toàn bộ thu chi từ trước",
    kpi_cash_sub_capital: "Gồm vốn góp tiền mặt + dòng tiền kinh doanh",
    kpi_profit: "Lợi nhuận (kỳ đang xem)", kpi_profit_sub: "Đã trừ lương + BHXH-BHYT-BHTN DN đóng",
    kpi_receivable: "Phải thu khách hàng", kpi_receivable_sub: "Chưa thu về",
    kpi_payable: "Phải trả nhà cung cấp", kpi_payable_sub: "Chưa thanh toán",
    kpi_overdue: "Công nợ quá hạn", kpi_overdue_sub: "Xem chi tiết ở tab Công nợ",
    kpi_thu: "Tổng thu (kỳ đang xem)", kpi_chi: "Tổng chi (kỳ đang xem)",
    kpi_perf_warn: "Hiệu suất cảnh báo", employees_tracked: "nhân viên đang theo dõi",
    charter_capital_contributed: "Vốn điều lệ đã góp", of_registered: "trên tổng đăng ký", see_capital_tab: "Xem tab Vốn góp",
    chart_title: "Thu chi 6 tháng gần nhất (triệu đ)", million_vnd: "triệu đ", income_label: "Thu", expense_label: "Chi",
    payroll_link_title: "Quỹ lương ↔ Nhân sự ↔ Hiệu suất",
    payroll_link_sub: "Tự động tính từ hồ sơ nhân viên (lương, KPI, ngày công, thâm niên, chỉ số vận hành)",
    low_kpi_employees: "nhân viên KPI thưởng dưới 80%", warn_perf_employees: "nhân viên hiệu suất ở mức cảnh báo",
    see_details_perf_payroll: "xem chi tiết ở Hiệu suất & Bảng lương",
    recent_tx: "Giao dịch gần đây",
    btn_add: "Thêm", btn_edit: "Sửa", btn_save: "Lưu", btn_cancel: "Huỷ", btn_export_excel: "Xuất Excel",
    company_settings_title: "Cài đặt công ty", company_name: "Tên công ty", company_address: "Địa chỉ",
    company_phone: "Số điện thoại", company_email: "Email", company_tax: "Mã số thuế", company_rep: "Người đại diện",
    company_note: "Thông tin này dùng cho sidebar, hợp đồng do Trợ lý Pháp lý soạn, và các báo cáo xuất ra.",
    director_password_label: "Mật khẩu giám đốc (mở khoá sổ tháng cũ)", saved_label: "Đã lưu",
    preview_label: "Xem trước — sẽ hiện ở sidebar và trong hợp đồng",
  },
  en: {
    nav_dashboard: "Overview", nav_thuchi: "Income/Expense & Invoices", nav_congno: "Receivables/Payables", nav_crm: "CRM Revenue",
    nav_marketing: "Daily Marketing", nav_kho: "Inventory", nav_giaoviec: "Task Assignment", nav_nhansu: "HR / Employees",
    nav_chamcong: "Attendance", nav_hieusuat: "Employee Performance", nav_luong: "Payroll", nav_quy: "Quarterly Report",
    nav_ai: "AI Accounting Assistant", nav_phaply: "AI Legal Assistant", nav_settings: "Company Settings",
    nav_vongop: "Capital Contribution", nav_hoptac: "Distribution Partners", nav_hoachdinh: "Budget Planning",
    sidebar_tagline: "Accounting · HR · Payroll · Performance", header_subtitle: "Prototype demo",
    header_period: "Reporting period", header_prev_period: "Viewing a past period", label_current: " (current)",
    missing_invoice_tx: "transactions missing invoice",
    kpi_cash: "Current Cash Balance", kpi_cash_sub: "Cumulative from all transactions",
    kpi_cash_sub_capital: "Includes cash capital + operating cash flow",
    kpi_profit: "Profit (this period)", kpi_profit_sub: "After payroll",
    kpi_receivable: "Accounts Receivable", kpi_receivable_sub: "Not yet collected",
    kpi_payable: "Accounts Payable", kpi_payable_sub: "Not yet paid",
    kpi_overdue: "Overdue Debts", kpi_overdue_sub: "See Receivables/Payables tab",
    kpi_thu: "Total Income (this period)", kpi_chi: "Total Expense (this period)",
    kpi_perf_warn: "Performance Warnings", employees_tracked: "employees tracked",
    charter_capital_contributed: "Charter Capital Contributed", of_registered: "of registered", see_capital_tab: "See Capital tab",
    chart_title: "Income/Expense — last 6 months (million VND)", million_vnd: "million VND", income_label: "Income", expense_label: "Expense",
    payroll_link_title: "Payroll ↔ HR ↔ Performance",
    payroll_link_sub: "Auto-calculated from employee records (salary, KPI, attendance, tenure, operating metrics)",
    low_kpi_employees: "employees with bonus KPI below 80%", warn_perf_employees: "employees flagged for performance warning",
    see_details_perf_payroll: "see details in Performance & Payroll",
    recent_tx: "Recent Transactions",
    btn_add: "Add", btn_edit: "Edit", btn_save: "Save", btn_cancel: "Cancel", btn_export_excel: "Export Excel",
    company_settings_title: "Company Settings", company_name: "Company Name", company_address: "Address",
    company_phone: "Phone Number", company_email: "Email", company_tax: "Tax Code", company_rep: "Representative",
    company_note: "This info is used in the sidebar, contracts drafted by the AI Legal Assistant, and exported reports.",
    director_password_label: "Director password (unlock closed periods)", saved_label: "Saved",
    preview_label: "Preview — shown in sidebar and contracts",
  },
  zh: {
    nav_dashboard: "概览", nav_thuchi: "收支与发票", nav_congno: "应收/应付账款", nav_crm: "CRM销售收入",
    nav_marketing: "每日营销", nav_kho: "库存", nav_giaoviec: "任务分配", nav_nhansu: "人力资源",
    nav_chamcong: "考勤", nav_hieusuat: "员工绩效", nav_luong: "工资表", nav_quy: "季度报告",
    nav_ai: "AI会计助手", nav_phaply: "AI法律助手", nav_settings: "公司设置",
    nav_vongop: "出资/注册资本", nav_hoptac: "分销合作伙伴", nav_hoachdinh: "预算规划",
    sidebar_tagline: "会计 · 人力资源 · 工资 · 绩效", header_subtitle: "原型演示版",
    header_period: "报告期间", header_prev_period: "正在查看以前的期间", label_current: "（当前）",
    missing_invoice_tx: "笔交易缺少发票",
    kpi_cash: "当前现金余额", kpi_cash_sub: "所有交易累计",
    kpi_cash_sub_capital: "含现金出资与经营现金流",
    kpi_profit: "利润（本期间）", kpi_profit_sub: "已扣除工资",
    kpi_receivable: "应收账款", kpi_receivable_sub: "尚未收取",
    kpi_payable: "应付账款", kpi_payable_sub: "尚未支付",
    kpi_overdue: "逾期账款", kpi_overdue_sub: "查看应收/应付账款标签页",
    kpi_thu: "总收入（本期间）", kpi_chi: "总支出（本期间）",
    kpi_perf_warn: "绩效预警", employees_tracked: "名员工受追踪",
    charter_capital_contributed: "已实缴注册资本", of_registered: "占registered总额", see_capital_tab: "查看出资标签页",
    chart_title: "近6个月收支（百万越南盾）", million_vnd: "百万越南盾", income_label: "收入", expense_label: "支出",
    payroll_link_title: "工资 ↔ 人力资源 ↔ 绩效",
    payroll_link_sub: "根据员工档案自动计算（工资、KPI、考勤、工龄、运营指标）",
    low_kpi_employees: "名员工KPI奖金低于80%", warn_perf_employees: "名员工绩效处于预警状态",
    see_details_perf_payroll: "在绩效与工资表中查看详情",
    recent_tx: "最近交易",
    btn_add: "添加", btn_edit: "编辑", btn_save: "保存", btn_cancel: "取消", btn_export_excel: "导出Excel",
    company_settings_title: "公司设置", company_name: "公司名称", company_address: "地址",
    company_phone: "电话号码", company_email: "电子邮件", company_tax: "税号", company_rep: "法定代表人",
    company_note: "此信息用于侧边栏、AI法律助手起草的合同以及导出的报告。",
    director_password_label: "总经理密码（用于解锁已关闭的月份）", saved_label: "已保存",
    preview_label: "预览 — 将显示在侧边栏和合同中",
  },
  ja: {
    nav_dashboard: "概要", nav_thuchi: "収支・請求書", nav_congno: "売掛金・買掛金", nav_crm: "CRM売上",
    nav_marketing: "デイリーマーケティング", nav_kho: "在庫", nav_giaoviec: "タスク割り当て", nav_nhansu: "人事",
    nav_chamcong: "勤怠管理", nav_hieusuat: "従業員パフォーマンス", nav_luong: "給与", nav_quy: "四半期レポート",
    nav_ai: "AI会計アシスタント", nav_phaply: "AI法律アシスタント", nav_settings: "会社設定",
    nav_vongop: "出資金/資本金", nav_hoptac: "販売代理店", nav_hoachdinh: "予算計画",
    sidebar_tagline: "会計 · 人事 · 給与 · パフォーマンス", header_subtitle: "プロトタイプデモ",
    header_period: "報告期間", header_prev_period: "過去の期間を表示中", label_current: "（現在）",
    missing_invoice_tx: "件の請求書未登録取引",
    kpi_cash: "現在の現金残高", kpi_cash_sub: "すべての取引の累計",
    kpi_cash_sub_capital: "現金出資と営業キャッシュフローを含む",
    kpi_profit: "利益（当期間）", kpi_profit_sub: "給与控除後",
    kpi_receivable: "売掛金", kpi_receivable_sub: "未回収",
    kpi_payable: "買掛金", kpi_payable_sub: "未払い",
    kpi_overdue: "延滞債務", kpi_overdue_sub: "売掛金・買掛金タブを参照",
    kpi_thu: "総収入（当期間）", kpi_chi: "総支出（当期間）",
    kpi_perf_warn: "パフォーマンス警告", employees_tracked: "名の従業員を追跡中",
    charter_capital_contributed: "払込済み資本金", of_registered: "登録資本金のうち", see_capital_tab: "出資タブを参照",
    chart_title: "過去6ヶ月の収支（百万ドン）", million_vnd: "百万ドン", income_label: "収入", expense_label: "支出",
    payroll_link_title: "給与 ↔ 人事 ↔ パフォーマンス",
    payroll_link_sub: "従業員記録から自動計算（給与、KPI、勤怠、勤続年数、運用指標）",
    low_kpi_employees: "名の従業員のボーナスKPIが80%未満", warn_perf_employees: "名の従業員が警告レベルのパフォーマンス",
    see_details_perf_payroll: "パフォーマンスと給与タブで詳細を確認",
    recent_tx: "最近の取引",
    btn_add: "追加", btn_edit: "編集", btn_save: "保存", btn_cancel: "キャンセル", btn_export_excel: "Excel出力",
    company_settings_title: "会社設定", company_name: "会社名", company_address: "住所",
    company_phone: "電話番号", company_email: "メール", company_tax: "税番号", company_rep: "代表者",
    company_note: "この情報はサイドバー、AI法律アシスタントが作成する契約書、およびエクスポートされたレポートに使用されます。",
    director_password_label: "取締役パスワード（過去月のロック解除用）", saved_label: "保存しました",
    preview_label: "プレビュー — サイドバーと契約書に表示されます",
  },
  th: {
    nav_dashboard: "ภาพรวม", nav_thuchi: "รายรับรายจ่ายและใบแจ้งหนี้", nav_congno: "ลูกหนี้/เจ้าหนี้", nav_crm: "รายได้ CRM",
    nav_marketing: "การตลาดรายวัน", nav_kho: "คลังสินค้า", nav_giaoviec: "มอบหมายงาน", nav_nhansu: "ฝ่ายบุคคล",
    nav_chamcong: "การลงเวลา", nav_hieusuat: "ผลงานพนักงาน", nav_luong: "เงินเดือน", nav_quy: "รายงานรายไตรมาส",
    nav_ai: "ผู้ช่วยบัญชี AI", nav_phaply: "ผู้ช่วยกฎหมาย AI", nav_settings: "ตั้งค่าบริษัท",
    nav_vongop: "เงินลงทุน/ทุนจดทะเบียน", nav_hoptac: "พันธมิตรจัดจำหน่าย", nav_hoachdinh: "การวางแผนงบประมาณ",
    sidebar_tagline: "บัญชี · บุคคล · เงินเดือน · ผลงาน", header_subtitle: "เดโมต้นแบบ",
    header_period: "รอบรายงาน", header_prev_period: "กำลังดูรอบก่อนหน้า", label_current: " (ปัจจุบัน)",
    missing_invoice_tx: "รายการที่ยังไม่มีใบแจ้งหนี้",
    kpi_cash: "ยอดเงินสดปัจจุบัน", kpi_cash_sub: "สะสมจากรายการทั้งหมด",
    kpi_cash_sub_capital: "รวมเงินลงทุนสดและกระแสเงินสดจากการดำเนินงาน",
    kpi_profit: "กำไร (รอบนี้)", kpi_profit_sub: "หลังหักเงินเดือน",
    kpi_receivable: "ลูกหนี้การค้า", kpi_receivable_sub: "ยังไม่ได้รับชำระ",
    kpi_payable: "เจ้าหนี้การค้า", kpi_payable_sub: "ยังไม่ได้ชำระ",
    kpi_overdue: "หนี้เกินกำหนด", kpi_overdue_sub: "ดูที่แท็บลูกหนี้/เจ้าหนี้",
    kpi_thu: "รายรับรวม (รอบนี้)", kpi_chi: "รายจ่ายรวม (รอบนี้)",
    kpi_perf_warn: "คำเตือนผลงาน", employees_tracked: "พนักงานที่ติดตามอยู่",
    charter_capital_contributed: "ทุนจดทะเบียนที่ชำระแล้ว", of_registered: "จากทุนจดทะเบียนทั้งหมด", see_capital_tab: "ดูแท็บเงินลงทุน",
    chart_title: "รายรับรายจ่าย 6 เดือนล่าสุด (ล้านดอง)", million_vnd: "ล้านดอง", income_label: "รายรับ", expense_label: "รายจ่าย",
    payroll_link_title: "เงินเดือน ↔ บุคคล ↔ ผลงาน",
    payroll_link_sub: "คำนวณอัตโนมัติจากข้อมูลพนักงาน (เงินเดือน, KPI, การเข้างาน, อายุงาน, ตัวชี้วัดการดำเนินงาน)",
    low_kpi_employees: "พนักงานที่ได้โบนัส KPI ต่ำกว่า 80%", warn_perf_employees: "พนักงานที่มีผลงานอยู่ในระดับเตือน",
    see_details_perf_payroll: "ดูรายละเอียดที่แท็บผลงานและเงินเดือน",
    recent_tx: "รายการล่าสุด",
    btn_add: "เพิ่ม", btn_edit: "แก้ไข", btn_save: "บันทึก", btn_cancel: "ยกเลิก", btn_export_excel: "ส่งออก Excel",
    company_settings_title: "ตั้งค่าบริษัท", company_name: "ชื่อบริษัท", company_address: "ที่อยู่",
    company_phone: "หมายเลขโทรศัพท์", company_email: "อีเมล", company_tax: "เลขประจำตัวผู้เสียภาษี", company_rep: "ผู้แทน",
    company_note: "ข้อมูลนี้ใช้ในแถบด้านข้าง สัญญาที่ร่างโดยผู้ช่วยกฎหมาย AI และรายงานที่ส่งออก",
    director_password_label: "รหัสผ่านกรรมการ (ปลดล็อกรอบบัญชีที่ปิดแล้ว)", saved_label: "บันทึกแล้ว",
    preview_label: "ตัวอย่าง — จะแสดงในแถบด้านข้างและในสัญญา",
  },
};

// ---------- Style tokens ----------
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Noto+Serif:wght@600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

    .ktns-app {
      --ink: #1B2A4A;
      --ink-light: #2E4270;
      --paper: #F7F5F0;
      --paper-line: #E4DFD3;
      --stamp-red: #B5342E;
      --ledger-green: #2F6F4F;
      --gold: #B8912B;
      --charcoal: #201F1C;
      --muted: #55503F;
      font-family: 'Be Vietnam Pro', sans-serif;
      background: var(--paper);
      color: var(--charcoal);
      scroll-behavior: smooth;
    }
    /* Chuyển động mượt toàn cục — dùng cubic-bezier "ease-out-expo" thay vì ease phẳng, tạo cảm
       giác mượt mà, cao cấp hơn hẳn (chuẩn chuyển động của Apple/Linear/Stripe). */
    .ktns-app button, .ktns-app a, .ktns-app input, .ktns-app select, .ktns-app textarea, .ktns-app [class*="rounded"] {
      transition: background-color 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s ease, opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .ktns-app button:active { transform: scale(0.97); transition-duration: 0.1s; }
    /* Input/select focus — viền vàng phát sáng nhẹ, cảm giác cao cấp thay vì viền xanh mặc định trình duyệt. */
    .ktns-app input:focus, .ktns-app select:focus, .ktns-app textarea:focus {
      outline: none; border-color: var(--gold) !important;
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--gold) 18%, transparent);
    }
    /* Modal nền kính mờ (glassmorphism) — sang trọng hơn hẳn nền tối phẳng, dùng chung cho cả 13
       khung popup trong app (Xác nhận, Hoá đơn, Xoá...) — sửa 1 chỗ, áp dụng khắp nơi ngay. */
    .ktns-app [class*="bg-ink/40"] { backdrop-filter: blur(6px) saturate(1.1); -webkit-backdrop-filter: blur(6px) saturate(1.1); animation: ktnsFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
    .ktns-app [class*="bg-ink/40"] > div { animation: ktnsModalPop 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes ktnsModalPop { from { opacity: 0; transform: scale(0.94) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    @keyframes ktnsFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    /* Ticker chạy chữ đầu trang — lời chào theo giờ, thông báo công ty đã duyệt, tên nhân viên
       đang bị cảnh báo hiệu suất. Nhân đôi nội dung + dịch chuyển đúng 50% để chạy liền mạch. */
    @keyframes ktnsTickerScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    .ktns-ticker { animation: ktnsTickerScroll 28s linear infinite; }
    .ktns-ticker:hover { animation-play-state: paused; }
    .ktns-serif { font-family: 'Noto Serif', serif; }
    .ktns-mono { font-family: 'JetBrains Mono', monospace; }

    .ktns-ledger-lines {
      background-image: repeating-linear-gradient(to bottom, transparent, transparent 34px, var(--paper-line) 35px);
    }

    .stamp-ring {
      border: 1.6px solid var(--stamp-red);
      border-radius: 9999px;
      padding: 3px 10px;
      color: var(--stamp-red);
      background: color-mix(in srgb, var(--stamp-red) 6%, transparent);
      transform: rotate(-6deg);
      font-family: 'Noto Serif', serif;
      font-weight: 700;
      font-size: 10px;
      letter-spacing: 0.04em;
      mix-blend-mode: multiply;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      opacity: 0.94;
      box-shadow: 0 1px 2px color-mix(in srgb, var(--stamp-red) 15%, transparent);
    }
    .stamp-ring.gold { border-color: var(--gold); color: var(--gold); background: color-mix(in srgb, var(--gold) 8%, transparent); box-shadow: 0 1px 2px color-mix(in srgb, var(--gold) 18%, transparent); }
    .stamp-ring.muted { border-color: var(--muted); color: var(--muted); background: color-mix(in srgb, var(--muted) 6%, transparent); transform: rotate(-3deg); box-shadow: none; }

    /* ---------- Nâng cấp toàn diện: hệ thống card/panel, nút bấm, bảng, tiêu đề — áp dụng TOÀN
       CỤC, lan tỏa tự động ra mọi màn hình dùng chung 1 bộ class, không cần sửa từng nơi riêng. */
    .ktns-app .bg-white.border.border-paper-line,
    .ktns-app .bg-white.rounded-lg.border {
      box-shadow: 0 1px 2px rgba(20, 20, 15, 0.04), 0 1px 1px rgba(20, 20, 15, 0.03);
      transition: box-shadow 0.2s ease, transform 0.2s ease;
    }
    .ktns-app .bg-white.rounded-lg.border:hover {
      box-shadow: 0 4px 14px rgba(20, 20, 15, 0.07), 0 1px 3px rgba(20, 20, 15, 0.05);
    }
    /* Nút chính (nền ink) có sắc nhẹ chuyển màu + nổi nhẹ khi hover — cảm giác cao cấp hơn hẳn nút phẳng. */
    .ktns-app button.bg-ink {
      background: linear-gradient(180deg, var(--ink-light), var(--ink));
      box-shadow: 0 1px 3px rgba(27, 42, 74, 0.25), inset 0 1px 0 rgba(255,255,255,0.06);
    }
    .ktns-app button.bg-ink:hover { box-shadow: 0 3px 10px rgba(27, 42, 74, 0.3), inset 0 1px 0 rgba(255,255,255,0.08); transform: translateY(-1px); }
    .ktns-app button.bg-gold, .ktns-app button.bg-ledger-green {
      box-shadow: 0 1px 3px rgba(0,0,0,0.12);
    }
    .ktns-app button.bg-gold:hover, .ktns-app button.bg-ledger-green:hover { transform: translateY(-1px); box-shadow: 0 3px 8px rgba(0,0,0,0.16); }
    /* Tiêu đề serif đậm hơn, dãn chữ tinh tế hơn cho cảm giác cao cấp. */
    .ktns-serif.font-semibold { letter-spacing: -0.01em; }
    /* Tiêu đề khung nhỏ (uppercase label kiểu "GỬI THÔNG BÁO", "ĐANG HỖ TRỢ"...) thêm viền dưới mảnh vàng. */
    table thead tr.bg-paper th:first-child { border-top-left-radius: 4px; }
    table thead tr.bg-paper th:last-child { border-top-right-radius: 4px; }
    table thead tr.bg-paper { box-shadow: inset 0 -1.5px 0 color-mix(in srgb, var(--gold) 35%, var(--paper-line)); }
    tbody tr.border-t.border-paper-line { transition: background-color 0.12s ease; }
    /* Icon tròn nền nhạt (dùng trong KpiCard và nhiều nơi khác) nổi nhẹ hơn cho chiều sâu. */
    .ktns-app .rounded-full { transition: transform 0.15s ease; }

    .ktns-scrollbar::-webkit-scrollbar { width: 10px; height: 10px; }
    .ktns-scrollbar::-webkit-scrollbar-track { background: var(--paper); }
    .ktns-scrollbar::-webkit-scrollbar-thumb { background: var(--ink-light); border-radius: 5px; border: 2px solid var(--paper); }
    .ktns-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--ink); }
    .ktns-scrollbar { scrollbar-width: auto; scrollbar-color: var(--ink-light) var(--paper); }
    /* Mọi khung cuộn nội bộ trong bảng (max-h-[420px] overflow-y-auto) cũng dùng chung kiểu thanh
       cuộn rõ ràng này — trước đây mặc định của trình duyệt quá mảnh, gần như không thấy được. */
    div[class*="overflow-y-auto"]::-webkit-scrollbar { width: 10px; }
    div[class*="overflow-y-auto"]::-webkit-scrollbar-track { background: var(--paper); }
    div[class*="overflow-y-auto"]::-webkit-scrollbar-thumb { background: var(--ink-light); border-radius: 5px; border: 2px solid var(--paper); }
    div[class*="overflow-y-auto"]::-webkit-scrollbar-thumb:hover { background: var(--ink); }
    div[class*="overflow-y-auto"] { scrollbar-width: auto; scrollbar-color: var(--ink-light) var(--paper); }

    .ktns-tab-active { background: linear-gradient(90deg, color-mix(in srgb, var(--gold) 12%, var(--ink-light)), var(--ink-light)); box-shadow: inset 3px 0 0 var(--gold), inset 0 0 12px rgba(184, 145, 43, 0.08); }

    /* ---------- Dark Mode — ghi đè trực tiếp lên các class Tailwind cố định (bg-white,
       text-charcoal...) bằng bộ chọn con dưới .dark, không cần sửa hàng nghìn className riêng lẻ. */
    .ktns-app.dark {
      --paper: #12151C; --paper-line: #2A2F3A; --charcoal: #E7E5E0; --muted: #9CA3AF;
      background: #0C0E13; color: #E7E5E0;
    }
    .ktns-app.dark .bg-white { background-color: #171A22 !important; }
    .ktns-app.dark .bg-paper { background-color: #1E222C !important; }
    .ktns-app.dark .bg-paper\\/40, .ktns-app.dark .bg-paper\\/50, .ktns-app.dark .bg-paper\\/60 { background-color: #1E222C !important; }
    .ktns-app.dark .text-charcoal { color: #E7E5E0 !important; }
    .ktns-app.dark .text-ink { color: #F2F1ED !important; }
    .ktns-app.dark .text-ink-light { color: #C7CAD3 !important; }
    .ktns-app.dark .text-muted { color: #8B90A0 !important; }
    .ktns-app.dark .border-paper-line { border-color: #2A2F3A !important; }
    .ktns-app.dark input, .ktns-app.dark select, .ktns-app.dark textarea {
      background-color: #171A22 !important; color: #E7E5E0 !important; border-color: #2A2F3A !important;
    }
    .ktns-app.dark input::placeholder, .ktns-app.dark textarea::placeholder { color: #6B7080 !important; }
    .ktns-app.dark .ktns-ledger-lines { background-image: repeating-linear-gradient(to bottom, transparent, transparent 34px, #2A2F3A 35px); }
    .ktns-app.dark .ktns-warn-row { background: repeating-linear-gradient(135deg, rgba(181,52,46,0.10), rgba(181,52,46,0.10) 6px, transparent 6px, transparent 12px); }
    .ktns-app.dark ::-webkit-scrollbar-thumb { background: #4A5060; border-color: #12151C; }
    .ktns-app.dark ::-webkit-scrollbar-thumb:hover { background: #6B7280; }
    .ktns-app.dark ::-webkit-scrollbar-track { background: #12151C; }
    .ktns-app.dark .stamp-ring { mix-blend-mode: normal; }

    /* Hiệu ứng cực quang + sao nhấp nháy cho Dark Mode — nhẹ nhàng, không cản trở đọc nội dung,
       chỉ để mắt dễ chịu khi làm việc lâu buổi tối. Đặt cố định phía sau toàn bộ nội dung. */
    .ktns-aurora-layer { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
    .ktns-aurora-blob {
      position: absolute; border-radius: 50%; filter: blur(90px); opacity: 0.16;
      animation: ktnsAuroraDrift 22s ease-in-out infinite;
    }
    .ktns-aurora-blob:nth-child(1) { width: 480px; height: 480px; background: #3B5FE0; top: -10%; left: -8%; animation-delay: 0s; }
    .ktns-aurora-blob:nth-child(2) { width: 420px; height: 420px; background: #7B4FE0; top: 30%; right: -10%; animation-delay: -7s; animation-duration: 26s; }
    .ktns-aurora-blob:nth-child(3) { width: 380px; height: 380px; background: #1FA8A0; bottom: -12%; left: 20%; animation-delay: -14s; animation-duration: 30s; }
    @keyframes ktnsAuroraDrift {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(40px, -30px) scale(1.08); }
      66% { transform: translate(-30px, 25px) scale(0.95); }
    }
    .ktns-star { position: absolute; width: 2px; height: 2px; background: #fff; border-radius: 50%; animation: ktnsTwinkle 3.5s ease-in-out infinite; }
    @keyframes ktnsTwinkle { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.9; } }

    .ktns-warn-row {
      background: repeating-linear-gradient(135deg, rgba(181,52,46,0.05), rgba(181,52,46,0.05) 6px, transparent 6px, transparent 12px);
    }

    .ktns-link-chip {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 10px; color: var(--ink-light);
      background: rgba(46,66,112,0.08);
      border: 1px dashed var(--ink-light);
      padding: 1px 6px; border-radius: 999px;
    }

    .ktns-kpi-bar-track { background: var(--paper-line); border-radius: 999px; height: 6px; overflow: hidden; }
    .ktns-kpi-bar-fill { height: 100%; border-radius: 999px; }

    .ktns-role-pill {
      font-size: 11px; padding: 5px 12px; border-radius: 999px; border: 1px solid var(--paper-line);
      color: var(--muted); display: inline-flex; align-items: center; gap: 5px; background: white;
    }
    .ktns-role-pill.active { background: var(--ink); color: white; border-color: var(--ink); }

    .ktns-reminder {
      font-size: 11.5px; color: var(--stamp-red); display: flex; gap: 6px; align-items: flex-start; line-height: 1.4;
    }

    .band-blue { background: var(--ink-light); color: white; }
    .band-green { background: var(--ledger-green); color: white; }
    .band-gold { background: var(--gold); color: white; }
    .band-muted { background: var(--muted); color: white; }
    .bg-gold { background-color: var(--gold); }
    .bg-gold\/10 { background-color: color-mix(in srgb, var(--gold) 10%, transparent); }
    .bg-ink\/40 { background-color: color-mix(in srgb, var(--ink) 40%, transparent); }
    .bg-stamp-red { background-color: var(--stamp-red); }

    .ktns-att-table th, .ktns-att-table td { white-space: nowrap; }
    .ktns-att-select {
      border: 1px solid var(--paper-line); border-radius: 4px; padding: 2px 2px;
      font-family: 'JetBrains Mono', monospace; font-size: 11px; width: 46px; text-align: center;
      background: white; color: var(--charcoal);
    }
    .ktns-att-blank { border-style: dashed; color: var(--paper-line); background: transparent; }

    .ktns-print-area { display: none; }
    @media print {
      body * { visibility: hidden; }
      .ktns-print-area, .ktns-print-area * { visibility: visible; }
      .ktns-print-area {
        display: block !important; position: absolute; top: 0; left: 0; width: 100%;
        padding: 20mm; font-family: 'Noto Serif', serif; font-size: 12pt; line-height: 1.6;
        white-space: pre-wrap; color: #000;
      }
    }
    .ktns-att-sunday { background: color-mix(in srgb, var(--stamp-red) 5%, transparent); }

    /* ---- resolved custom color utilities (no Tailwind JIT available) ---- */
    .border-paper-line { border-color: var(--paper-line); }
    .text-muted { color: var(--muted); }
    .bg-ink { background-color: var(--ink); }
    .text-gold { color: var(--gold); }
    .text-ink { color: var(--ink); }
    .bg-stamp-red\/10 { background-color: color-mix(in srgb, var(--stamp-red) 10%, transparent); }
    .text-stamp-red { color: var(--stamp-red); }
    .hover\:bg-ink-light:hover { background-color: var(--ink-light); }
    .bg-paper { background-color: var(--paper); }
    .bg-ledger-green { background-color: var(--ledger-green); }
    .text-charcoal { color: var(--charcoal); }
    .hover\:text-stamp-red:hover { color: var(--stamp-red); }
    .text-ink-light { color: var(--ink-light); }
    .bg-stamp-red\/5 { background-color: color-mix(in srgb, var(--stamp-red) 5%, transparent); }
    .text-ledger-green { color: var(--ledger-green); }
    .hover\:bg-paper\/50:hover { background-color: color-mix(in srgb, var(--paper) 50%, transparent); }
    .bg-paper\/40 { background-color: color-mix(in srgb, var(--paper) 40%, transparent); }
    .hover\:border-gold:hover { border-color: var(--gold); }
    .hover\:text-ink:hover { color: var(--ink); }
  `}</style>
);

// ---------- Mock data / connected model ----------
// ---------- Mã tài khoản kế toán theo Thông tư 133/2016/TT-BTC (chế độ kế toán DN nhỏ và vừa) ----------
// Chỉ liệt kê các TK phổ biến với 1 công ty dịch vụ/thương mại nhỏ — không đầy đủ toàn bộ hệ thống
// TK133, chỉ đủ dùng để gợi ý nhanh khi hạch toán, kế toán thật vẫn cần rà soát lại trước khi ghi sổ.
const TT133_ACCOUNTS = {
  "111": "Tiền mặt", "112": "Tiền gửi ngân hàng", "131": "Phải thu của khách hàng",
  "133": "Thuế GTGT được khấu trừ", "138": "Phải thu khác", "156": "Hàng hóa",
  "211": "Tài sản cố định hữu hình", "214": "Hao mòn tài sản cố định", "242": "Chi phí trả trước (CCDC phân bổ)",
  "331": "Phải trả cho người bán",
  "3331": "Thuế GTGT phải nộp (đầu ra)", "3335": "Thuế TNCN phải nộp",
  "3383": "Bảo hiểm xã hội", "3384": "Bảo hiểm y tế", "3385": "Bảo hiểm thất nghiệp",
  "334": "Phải trả người lao động", "338": "Phải trả, phải nộp khác",
  "411": "Vốn đầu tư của chủ sở hữu", "421": "Lợi nhuận sau thuế chưa phân phối",
  "511": "Doanh thu bán hàng và cung cấp dịch vụ", "515": "Doanh thu hoạt động tài chính",
  "632": "Giá vốn hàng bán", "642": "Chi phí quản lý kinh doanh", "811": "Chi phí khác",
};
// Gợi ý TK dựa trên loại giao dịch (Thu/Chi) và nguồn gốc — kế toán vẫn có thể sửa tay nếu cần
// hạch toán khác đi, đây chỉ là gợi ý mặc định để đỡ phải tra cứu từ đầu.
function suggestAccountCode(t) {
  if (t.source === "bangluong") return "334";
  if (t.source === "congno") return t.kind === "thu" ? "131" : "331";
  if (t.kind === "thu") {
    if (t.source === "crm" || t.source === "hoptac") return "511";
    return "515";
  }
  const cat = (t.category || "").toLowerCase();
  if (cat.includes("lương")) return "334";
  if (cat.includes("thuê") || cat.includes("mặt bằng")) return "642";
  if (cat.includes("hàng") || t.source === "hoptac_muahang") return "156";
  if (cat.includes("hoa hồng") || cat.includes("phí")) return "642";
  return "642";
}

// Đọc số tiền bằng chữ — bắt buộc phải có trên Phiếu Thu/Phiếu Chi theo đúng mẫu TT133.
function soTienBangChu(num) {
  if (!num || num <= 0) return "Không đồng";
  const chuSo = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const docBaSo = (n, hasHundredsBefore) => {
    const tram = Math.floor(n / 100), chuc = Math.floor((n % 100) / 10), donvi = n % 10;
    let s = "";
    if (tram > 0 || hasHundredsBefore) s += chuSo[tram] + " trăm ";
    if (chuc === 0 && donvi > 0 && (tram > 0 || hasHundredsBefore)) s += "lẻ ";
    if (chuc >= 2) { s += chuSo[chuc] + " mươi "; if (donvi === 1) s += "mốt "; else if (donvi === 5) s += "lăm "; else if (donvi > 0) s += chuSo[donvi] + " "; }
    else if (chuc === 1) { s += "mười "; if (donvi === 5) s += "lăm "; else if (donvi > 0) s += chuSo[donvi] + " "; }
    else if (donvi > 0) s += chuSo[donvi] + " ";
    return s.trim();
  };
  const units = ["", " nghìn", " triệu", " tỷ"];
  let n = Math.floor(num);
  const groups = [];
  while (n > 0) { groups.unshift(n % 1000); n = Math.floor(n / 1000); }
  let result = "";
  groups.forEach((g, i) => {
    if (g === 0) return;
    const hasHundredsBefore = i > 0 && g < 100;
    result += docBaSo(g, hasHundredsBefore) + units[groups.length - 1 - i] + " ";
  });
  result = result.trim();
  return result.charAt(0).toUpperCase() + result.slice(1) + " đồng";
}
// Phiếu Thu (Mẫu 01-TT) / Phiếu Chi (Mẫu 02-TT) theo đúng mẫu Thông tư 133/2016/TT-BTC — in ra
// dùng thật được, kế toán ký tay trực tiếp lên bản in.
function buildPhieuThuChiHtml(t, company, accountCode) {
  const isThu = t.kind === "thu";
  const mauSo = isThu ? "01-TT" : "02-TT";
  const tenPhieu = isThu ? "PHIẾU THU" : "PHIẾU CHI";
  return `
    <div style="font-family: 'Times New Roman', serif; max-width: 760px; margin: 0 auto; padding: 24px; color: #111;">
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <div style="font-size:13px; line-height:1.5;">
          <div><strong>${company?.name || "CÔNG TY"}</strong></div>
          <div>Địa chỉ: ${company?.address || "—"}</div>
          <div>Mã số thuế: ${company?.taxCode || "—"}</div>
        </div>
        <div style="text-align:right; font-size:12px;">
          <div>Mẫu số ${mauSo}</div>
          <div>(Ban hành theo Thông tư số 133/2016/TT-BTC</div>
          <div>ngày 26/8/2016 của Bộ Tài chính)</div>
        </div>
      </div>
      <h2 style="text-align:center; margin:18px 0 4px; letter-spacing:2px;">${tenPhieu}</h2>
      <div style="text-align:center; font-size:13px; margin-bottom:4px;">Ngày ${(t.date || "").split("-")[2]} tháng ${(t.date || "").split("-")[1]} năm ${(t.date || "").split("-")[0]}</div>
      <div style="text-align:center; font-size:13px; margin-bottom:16px;">Số: ......................</div>
      <table style="width:100%; font-size:14px; line-height:1.9; border-collapse:collapse;">
        <tr><td style="width:220px;">Nợ TK ......................</td><td>${accountCode || "—"}</td></tr>
        <tr><td>Có TK ......................</td><td>${isThu ? "111 / 112" : "111 / 112"}</td></tr>
      </table>
      <div style="font-size:14px; line-height:2; margin-top:8px;">
        <div>Họ tên người ${isThu ? "nộp" : "nhận"} tiền: <strong>${t.partnerName || "......................"}</strong></div>
        <div>Địa chỉ: ......................................................................................</div>
        <div>Lý do ${isThu ? "nộp" : "chi"}: <strong>${t.desc || t.category || "......................"}</strong></div>
        <div>Số tiền: <strong>${fmtVND(t.amount)}</strong> (Viết bằng chữ): <em>${soTienBangChu(t.amount)}</em></div>
        <div>Kèm theo: ...................... chứng từ gốc.</div>
      </div>
      <table style="width:100%; text-align:center; font-size:13px; margin-top:36px;">
        <tr>
          <td style="width:20%;"><strong>Giám đốc</strong><br/>(Ký, họ tên, đóng dấu)</td>
          <td style="width:20%;"><strong>Kế toán trưởng</strong><br/>(Ký, họ tên)</td>
          <td style="width:20%;"><strong>Người lập phiếu</strong><br/>(Ký, họ tên)</td>
          <td style="width:20%;"><strong>Thủ quỹ</strong><br/>(Ký, họ tên)</td>
          <td style="width:20%;"><strong>Người ${isThu ? "nộp" : "nhận"} tiền</strong><br/>(Ký, họ tên)</td>
        </tr>
        <tr><td style="height:70px;"></td><td></td><td></td><td></td><td></td></tr>
      </table>
    </div>
  `;
}
function downloadPhieuThuChi(t, company, accountCode) {
  const html = buildPhieuThuChiHtml(t, company, accountCode);
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${t.kind === "thu" ? "Phieu Thu" : "Phieu Chi"} ${t.date}</title></head><body>${html}</body></html>`;
  const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${t.kind === "thu" ? "PhieuThu" : "PhieuChi"}_${t.date}_${t.id}.html`; a.click();
  URL.revokeObjectURL(url);
}

const INVOICE_TYPES = [
  "Hóa đơn GTGT (VAT)",
  "Hóa đơn bán hàng",
  "Hóa đơn điện tử",
  "Biên lai / Phiếu thu nội bộ",
  "Thu hộ đối tác (VAT do đối tác chịu)",
  "Không cần hóa đơn (dưới 200.000đ)",
  "Chưa xác định",
];
// Chỉ hóa đơn GTGT mới cần khai thuế VAT tách riêng.
const VAT_INVOICE_TYPES = ["Hóa đơn GTGT (VAT)"];
const VAT_RATE_OPTIONS = [0, 5, 8, 10]; // % — mức 8%/10% thay đổi theo chính sách từng giai đoạn, kiểm tra lại quy định hiện hành
// Giả định "Số tiền" nhập vào đã là tổng thanh toán (đã gồm VAT) — tách ngược ra tiền hàng + thuế.
function splitVAT(amount, vatRatePct) {
  if (!vatRatePct) return { beforeTax: amount, vatAmount: 0 };
  const beforeTax = amount / (1 + vatRatePct / 100);
  return { beforeTax, vatAmount: amount - beforeTax };
}

// Hoa hồng đối tác phân phối theo BẬC doanh thu (doanh thu càng cao, % hoa hồng càng thấp —
// khác chiều với hoa hồng Sale). Tìm bậc cao nhất có minRevenue <= doanh thu đơn đó.
function lookupCommissionTier(revenue, tiers) {
  if (!tiers || tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => a.minRevenue - b.minRevenue);
  let pct = sorted[0].pct;
  for (const t of sorted) { if (revenue >= t.minRevenue) pct = t.pct; }
  return pct;
}
// Cộng dồn doanh thu CẢ THÁNG với 1 đối tác (không tính đơn nhập hàng) — dùng để tra mốc % áp
// dụng CHUNG cho mọi đơn trong tháng đó, tự động nhảy mốc khi tổng tháng vượt ngưỡng mới, thay vì
// khoá cứng % theo từng đơn lẻ (đơn lẻ nhỏ sẽ không bao giờ tự đạt mốc cao được).
function getPartnerMonthlyRevenue(partnerId, dateStr, allDistOrders) {
  const ym = (dateStr || "").slice(0, 7);
  return (allDistOrders || [])
    .filter((o) => o.partnerId === partnerId && o.orderKind !== "purchase" && (o.date || "").slice(0, 7) === ym)
    .reduce((a, o) => a + (o.revenue || 0), 0);
}
// Đúng luồng thực tế: đối tác xuất VAT trước trên doanh thu thu được, PHẦN CÒN LẠI SAU THUẾ
// mới đem tính % hoa hồng đối tác được hưởng; phần còn lại sau hoa hồng mới là số đối tác nộp
// (trả) về công ty.
function computeDistributionSplit(revenue, vatRatePct, commissionPct) {
  const { beforeTax: netOfVat, vatAmount } = splitVAT(revenue, vatRatePct);
  const commissionAmount = netOfVat * (commissionPct / 100);
  const remittedToCompany = netOfVat - commissionAmount;
  return { netOfVat, vatAmount, commissionAmount, remittedToCompany };
}
// Áp dụng ĐỒNG NHẤT cho mọi vai trò đối tác: doanh thu → trừ VAT (đối tác xuất/chịu VAT) trước
// → phần còn lại sau VAT mới tính % hoa hồng/phí theo bậc. Kể cả vai trò "Nhượng quyền" cũng
// trừ VAT trước rồi mới tính % — không còn bỏ qua bước VAT như trước nữa.
function computePartnerAmount(revenue, vatRatePct, commissionPct, partnerRole) {
  return computeDistributionSplit(revenue, vatRatePct, commissionPct);
}

// Ba mô hình hợp tác phân phối phổ biến — mỗi mô hình khác nhau ở việc AI XUẤT HÓA ĐƠN VAT
// cho khách hàng cuối, vì đây là yếu tố pháp lý/thuế quan trọng nhất, không phải chi tiết phụ.
const PARTNER_ROLES = {
  dai_ly: {
    label: "Đại lý bán hộ (hoa hồng)",
    desc: "Đối tác trực tiếp bán & xuất hóa đơn VAT cho khách. Đối tác giữ % hoa hồng, nộp lại phần còn lại cho công ty bạn. (Cũng dùng đúng cho trường hợp NGƯỢC LẠI: bạn nhượng quyền/giao sản phẩm cho bên khác bán hộ, họ giữ % hoa hồng, nộp phần còn lại về công ty bạn — chỉ cần tạo đối tác đó với vai trò này.)",
    who_invoices_customer: "Đối tác",
  },
  nha_cung_cap: {
    label: "Nhà cung cấp (mua đứt bán lại)",
    desc: "Công ty bạn MUA sản phẩm từ đối tác (có hóa đơn VAT đầu vào), rồi TỰ BÁN lại cho khách và TỰ xuất hóa đơn VAT. Lợi nhuận = giá bán − giá mua.",
    who_invoices_customer: "Công ty bạn",
  },
  nhuong_quyen: {
    label: "Bên nhượng quyền thương hiệu (bạn trả phí cho họ)",
    desc: "Khách ký hợp đồng với công ty bạn. Công ty bạn bán & xuất hóa đơn VAT cho khách, sau đó trả phí nhượng quyền (%) cho đối tác theo thỏa thuận — dùng khi ĐỐI TÁC là bên cấp quyền/sản phẩm cho bạn.",
    who_invoices_customer: "Công ty bạn",
  },
};

const ROLE_META = {
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

const initialTransactions = [
// Giao dịch Thu liên kết trực tiếp với initialOrders ở trên (đồng bộ 2 chiều CRM ↔ Thu Chi) — 41 giao dịch.
];

// Doanh thu CRM — mỗi đơn gán cho 1 nhân viên Sale (saleEmployeeId). Doanh số của
// Sale ở Bảng lương tự cộng lại từ bảng này theo tháng hiện tại, không cần nhập tay.
const initialOrders = [
// Nhập từ sheet "DOANH THU_TEAM AE" thật (01-08/07/2026), ĐÃ QUÉT LẠI ĐẦY ĐỦ 41 đơn — khớp đúng "TỔNG DOANH SỐ PHÁT SINH: 77.880.000đ".
  { id: 80000000, date: "2026-07-01", customerName: "Duy Phùng", phone: "0329276693", email: "maduyphung93thhq@gmail.com", note: "", saleEmployeeId: 12, dealType: "sale", receivedAt: "", amount: 2470000, productId: 3, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "1510", invoiceDate: "2026-07-02", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000002, date: "2026-07-01", customerName: "Nguyễn Đăng Trường", phone: "0931614747", email: "dtruongit@gmail.com", note: "Nguyen dang truong chuyen tien", saleEmployeeId: 12, dealType: "sale", receivedAt: "", amount: 970000, productId: 1, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "1513", invoiceDate: "2026-07-02", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000004, date: "2026-07-01", customerName: "Trần Quốc Thi", phone: "0707058725", email: "tranquocthi1681993@gmail.com", note: "Tran quoc thi chuyen tien", saleEmployeeId: 12, dealType: "sale", receivedAt: "", amount: 2470000, productId: 3, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "1514", invoiceDate: "2026-07-02", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000006, date: "2026-07-01", customerName: "Bùi Hữu Quang", phone: "0336554387", email: "oo8.0.8oo.ooo@gmail.com", note: "Bui huu quang chuyen tien", saleEmployeeId: 12, dealType: "sale", receivedAt: "", amount: 970000, productId: 1, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "1516", invoiceDate: "2026-07-02", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000008, date: "2026-07-02", customerName: "Nguyễn Văn Hợi", phone: "0974432723", email: "nguyenvanhoi723@gmail.com", note: "NGUYEN VAN HOI chuyen tien", saleEmployeeId: 13, dealType: "sale", receivedAt: "", amount: 970000, productId: 1, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "1520", invoiceDate: "2026-07-02", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000010, date: "2026-07-02", customerName: "Bình Yên", phone: "0967057889", email: "doanha1993st@gmail.com", note: "Binh yen chuyen khoan nhanh qua zalo", saleEmployeeId: 12, dealType: "sale", receivedAt: "", amount: 970000, productId: 1, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "1522", invoiceDate: "2026-07-02", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000012, date: "2026-07-02", customerName: "Hải Cỏ Cỏ nhân tạo", phone: "0968090625", email: "haitranvtn@gmail.com", note: "tien tool ai 1 thang", saleEmployeeId: 13, dealType: "sale", receivedAt: "", amount: 970000, productId: 1, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "1535", invoiceDate: "2026-07-03", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000014, date: "2026-07-02", customerName: "hy siu pieu", phone: "0919839399", email: "Trienvinhx@gmail.com", note: "hy siu pieu chuyen tien", saleEmployeeId: 12, dealType: "sale", receivedAt: "", amount: 4840000, productId: 4, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "1539", invoiceDate: "2026-07-03", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000016, date: "2026-07-02", customerName: "Lê Hoàng Văn", phone: "0909559562", email: "Hoaivan1122@gmail.com", note: "LE HOANG VAN Key 6 Thang", saleEmployeeId: 14, dealType: "sale", receivedAt: "", amount: 4840000, productId: 4, productName: "Tool AI Agent", quantity: 1, invoiceStatus: "issued", invoiceNo: "1541", invoiceDate: "2026-07-03", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000018, date: "2026-07-02", customerName: "Nguyễn Thị Thu Hà", phone: "0971799696", email: "haxinh79@gmail.com", note: "Veo 3 Proxy", saleEmployeeId: 14, dealType: "sale", receivedAt: "", amount: 970000, productId: 1, productName: "Tool AI Agent", quantity: 1, invoiceStatus: "issued", invoiceNo: "1545", invoiceDate: "2026-07-03", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000020, date: "2026-07-02", customerName: "song ba po", phone: "0985927802", email: "songpo85@gmail.com", note: "song ba po chuyen tien", saleEmployeeId: 12, dealType: "sale", receivedAt: "", amount: 970000, productId: 1, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "1549", invoiceDate: "2026-07-03", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000022, date: "2026-07-02", customerName: "Nguyễn Quốc Trung Hiếu", phone: "0914030345", email: "tr.hieucomputer@gmail.com", note: "Key 1 thang", saleEmployeeId: 14, dealType: "sale", receivedAt: "", amount: 970000, productId: 1, productName: "Tool AI Agent", quantity: 1, invoiceStatus: "issued", invoiceNo: "1564", invoiceDate: "2026-07-03", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000024, date: "2026-07-03", customerName: "Nguyễn Thị Tươi", phone: "0819514143", email: "khaituoi@gmail.com", note: "Nguyen Thi Tuoi chuyen tien key 1 thang", saleEmployeeId: 14, dealType: "sale", receivedAt: "", amount: 970000, productId: 1, productName: "Tool AI Agent", quantity: 1, invoiceStatus: "issued", invoiceNo: "1550", invoiceDate: "2026-07-03", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000026, date: "2026-07-03", customerName: "Nguyễn Xuân Trường", phone: "0923410783", email: "dthuy0573@gmail.com", note: "Nguyen xuan truong ck tool 6 thang", saleEmployeeId: 13, dealType: "sale", receivedAt: "", amount: 4840000, productId: 4, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "1563", invoiceDate: "2026-07-03", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000028, date: "2026-07-03", customerName: "Trần Văn Hưởng", phone: "0986351431", email: "Tiepthilienketmk08@gmail.com", note: "key 1 thang", saleEmployeeId: 14, dealType: "sale", receivedAt: "", amount: 970000, productId: 1, productName: "Tool AI Agent", quantity: 1, invoiceStatus: "issued", invoiceNo: "1567", invoiceDate: "2026-07-04", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000030, date: "2026-07-03", customerName: "Ngô Thiên Chiều", phone: "0382968908", email: "chieufclq1@gmail.com", note: "ngo thien chieu tool 1 thang", saleEmployeeId: 13, dealType: "sale", receivedAt: "", amount: 970000, productId: 1, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "1571", invoiceDate: "2026-07-04", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000032, date: "2026-07-03", customerName: "Trinh Thi Nhu", phone: "0845225678", email: "uniosport.hn@gmail.com", note: "NGUYEN VAN ANH chuyen tien", saleEmployeeId: 14, dealType: "sale", receivedAt: "", amount: 2470000, productId: 3, productName: "Tool AI Agent", quantity: 1, invoiceStatus: "issued", invoiceNo: "1572", invoiceDate: "2026-07-04", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000034, date: "2026-07-03", customerName: "Nguyễn Hồng Sơn", phone: "0974706579", email: "sonthao12111997@gmail.com", note: "nguyen hong son chuyen tien", saleEmployeeId: 12, dealType: "sale", receivedAt: "", amount: 2470000, productId: 3, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "1588", invoiceDate: "2026-07-04", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000036, date: "2026-07-04", customerName: "Nguyễn Hồng Sơn", phone: "0974706579", email: "dionusers422@gmail.com", note: "nguyen hong son chuyen tien", saleEmployeeId: 12, dealType: "sale", receivedAt: "", amount: 2470000, productId: 3, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "AUTO19", invoiceDate: "2026-07-04", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000038, date: "2026-07-04", customerName: "Nguyễn Văn Ngọc", phone: "0335617726", email: "ngocglcpr@gmail.com", note: "nguyen van ngoc chuyen tien", saleEmployeeId: 12, dealType: "sale", receivedAt: "", amount: 2470000, productId: 3, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "1575", invoiceDate: "2026-07-04", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000040, date: "2026-07-04", customerName: "NGUYỄN NGỌC ANH", phone: "0379107254", email: "anhcanemnghe4@gmail.com", note: "nguyen ngoc anh chuyen tien", saleEmployeeId: 12, dealType: "sale", receivedAt: "", amount: 970000, productId: 1, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "1579", invoiceDate: "2026-07-04", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000042, date: "2026-07-04", customerName: "Nguyễn Trung Đức", phone: "0357225419", email: "duc121998.kts@gmail.com", note: "mua tool chay video", saleEmployeeId: 13, dealType: "sale", receivedAt: "", amount: 970000, productId: 1, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "1580", invoiceDate: "2026-07-04", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000044, date: "2026-07-04", customerName: "Trần nhật minh", phone: "0982842892", email: "minh.tn0510@gmail.com", note: "tran nhat minh chuyen tien", saleEmployeeId: 12, dealType: "sale", receivedAt: "", amount: 4840000, productId: 4, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "1581", invoiceDate: "2026-07-04", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000046, date: "2026-07-04", customerName: "Nguyễn Hồng Sơn", phone: "0974706579", email: "Netdamme@gmail.com", note: "nguyen hong son chuyen tien", saleEmployeeId: 12, dealType: "sale", receivedAt: "", amount: 970000, productId: 1, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "AUTO24", invoiceDate: "2026-07-04", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000048, date: "2026-07-05", customerName: "nguyễn thị huệ", phone: "0395982413", email: "nguyenthiminhhuesc@gmail.com", note: "nguyen thi hue chuyen tien", saleEmployeeId: 12, dealType: "sale", receivedAt: "", amount: 2470000, productId: 3, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "AUTO25", invoiceDate: "2026-07-05", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000050, date: "2026-07-05", customerName: "hoàng ngọc an", phone: "0932652688", email: "Hoangtuankiet.qb1502@gmail.com", note: "hoang ngoc an chuyen tien", saleEmployeeId: 12, dealType: "sale", receivedAt: "", amount: 970000, productId: 1, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "AUTO26", invoiceDate: "2026-07-05", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000052, date: "2026-07-06", customerName: "trương văn tuấn", phone: "0399024483", email: "ttuan2734@gmail.com", note: "truong van tuan chuyen tien", saleEmployeeId: 12, dealType: "sale", receivedAt: "", amount: 4840000, productId: 4, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "AUTO27", invoiceDate: "2026-07-06", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000054, date: "2026-07-06", customerName: "Nguyễn Hồng Sơn", phone: "0816475555", email: "scamhi6789@gmail.com", note: "NGUYEN HONG SON chuyen tien", saleEmployeeId: 13, dealType: "sale", receivedAt: "", amount: 1830000, productId: 2, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "AUTO28", invoiceDate: "2026-07-06", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000056, date: "2026-07-06", customerName: "trần tuấn kiệt", phone: "0907212505", email: "Binhan01101988@gmail.com", note: "tran tuan kiet chuyen", saleEmployeeId: 12, dealType: "sale", receivedAt: "", amount: 2470000, productId: 3, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "AUTO29", invoiceDate: "2026-07-06", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000058, date: "2026-07-07", customerName: "Ngô Thị Kim Chung", phone: "0852382420", email: "kimngo295@gmail.com", customerTaxCode: "0109441228", customerCompanyName: "CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ PHÁT TRIỂN CÔNG NGHỆ STECH GLOBAL", note: "ck", saleEmployeeId: 13, dealType: "sale", receivedAt: "", amount: 970000, productId: 1, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "AUTO30", invoiceDate: "2026-07-07", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000060, date: "2026-07-08", customerName: "trần quốc toàn", phone: "0902394898", email: "quoctoan4898@gmail.com", note: "tran quoc toan chuyen tuyen", saleEmployeeId: 12, dealType: "sale", receivedAt: "", amount: 970000, productId: 1, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "AUTO31", invoiceDate: "2026-07-08", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000062, date: "2026-07-08", customerName: "Đoàn Công Tuấn", phone: "0866792981", email: "Tuan81vms@gmail.com", note: "DOAN CONG TUAN chuyen tien", saleEmployeeId: 13, dealType: "sale", receivedAt: "", amount: 2470000, productId: 3, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "AUTO32", invoiceDate: "2026-07-08", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000064, date: "2026-07-08", customerName: "trần anh tú", phone: "0944250891", email: "anhtu.btmedia@gmail.com", note: "tran anh tu chuyen tien", saleEmployeeId: 12, dealType: "sale", receivedAt: "", amount: 970000, productId: 1, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "AUTO33", invoiceDate: "2026-07-08", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000066, date: "2026-07-08", customerName: "Trương mạnh toàn", phone: "0984350463", email: "ttoan1283@gmail.com", note: "truong manh toan chuyen tien", saleEmployeeId: 12, dealType: "sale", receivedAt: "", amount: 970000, productId: 1, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "AUTO34", invoiceDate: "2026-07-08", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000068, date: "2026-07-08", customerName: "Tổ Duyên", phone: "0382025167", email: "Nhipcautiengduc@gmail.com", note: "tieng duc to duyen chuyen khoan nhanh", saleEmployeeId: 12, dealType: "sale", receivedAt: "", amount: 1500000, productId: 2, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "AUTO35", invoiceDate: "2026-07-08", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000070, date: "2026-07-08", customerName: "Trần Việt Cường", phone: "0942270444", email: "duhocvnvj@gmail.com", note: "tran viet cuong chuyen tien", saleEmployeeId: 12, dealType: "sale", receivedAt: "", amount: 4840000, productId: 4, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "AUTO36", invoiceDate: "2026-07-08", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000072, date: "2026-07-08", customerName: "Lê Thị Thu Hiền", phone: "0858071689", email: "lethithuhien21011981@gmail.com", note: "key 1 thang", saleEmployeeId: 14, dealType: "sale", receivedAt: "", amount: 970000, productId: 1, productName: "Tool AI Agent", quantity: 1, invoiceStatus: "issued", invoiceNo: "AUTO37", invoiceDate: "2026-07-08", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000074, date: "2026-07-08", customerName: "Phùng Quang Tuấn", phone: "0888358555", email: "phungquangtuan79@gmail.com", note: "tn autu chuyen khoan", saleEmployeeId: 12, dealType: "sale", receivedAt: "", amount: 970000, productId: 1, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "AUTO38", invoiceDate: "2026-07-08", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000076, date: "2026-07-08", customerName: "Nail Hello", phone: "0938247216", email: "tuyennhan121289@gmail.com", note: "Nail Hello chuyen khoan nhanh", saleEmployeeId: 12, dealType: "sale", receivedAt: "", amount: 970000, productId: 1, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "AUTO39", invoiceDate: "2026-07-08", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000078, date: "2026-07-08", customerName: "Trần Bách", phone: "0869875442", email: "tbach1474@gmail.com", note: "Bach Tran chuyen khoan nhanh qua zalo", saleEmployeeId: 13, dealType: "sale", receivedAt: "", amount: 970000, productId: 1, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "AUTO40", invoiceDate: "2026-07-08", vatRate: 8, linkedTxId: null, contactLog: [] },
  { id: 80000080, date: "2026-07-08", customerName: "Trần Ngọc Ánh", phone: "0775376386", email: "trananh1985dt@gmail.com", note: "Xuong In lua Ly nhua tui Bao bi chuyen tien", saleEmployeeId: 13, dealType: "sale", receivedAt: "", amount: 970000, productId: 1, productName: "Tool AI Agent", quantity: 1, pageId: 1, invoiceStatus: "issued", invoiceNo: "AUTO41", invoiceDate: "2026-07-08", vatRate: 8, linkedTxId: null, contactLog: [] },
];
const CONTACT_TYPES = {
  call: { label: "Gọi điện", icon: Phone },
  message: { label: "Nhắn tin/SMS", icon: FileText },
  facebook: { label: "Facebook", icon: MessageCircle },
  zalo: { label: "Zalo", icon: MessageCircle },
  shopee: { label: "Shopee", icon: ShoppingCart },
  instagram: { label: "Instagram", icon: MessageCircle },
  support: { label: "Kết quả hỗ trợ", icon: Headphones },
};
// Nguồn khách tiềm năng — Marketing chạy ads lấy số, hoặc Pancake/kênh khác đẩy qua cho Sale gọi.
const LEAD_SOURCES = {
  marketing_ads: "Marketing chạy Ads",
  pancake: "Pancake (Facebook/Shopee...)",
  tu_tim: "Sale tự tìm",
  gioi_thieu: "Khách giới thiệu",
  khac: "Nguồn khác",
};

// Phạm vi Hỗ trợ khách hàng KHÔNG chỉ setup/kích hoạt mới — còn đồng hành chăm sóc định kỳ và tư
// vấn nâng cấp (upsale) trong suốt thời gian khách dùng dịch vụ.
// Lọc nội dung thông báo — chặn từ ngữ tục tĩu/thiếu chuẩn mực trước khi cho gửi lên ticker chạy
// cho cả công ty xem. Danh sách ở mức cơ bản, đủ chặn các từ phổ biến nhất trong môi trường công
// sở — không phải bộ lọc tuyệt đối, kế toán/sếp vẫn nên tự kiểm tra lại nội dung trước khi duyệt.
const BANNED_WORDS = [
  "đm", "dm", "đmm", "vcl", "vl", "vãi lồn", "đéo", "đjt", "địt", "đit", "lồn", "buồi", "cặc",
  "cc", "cứt", "đĩ", "điếm", "chó chết", "óc chó", "ngu như chó", "thằng chó", "con chó",
  "thằng khốn", "con khốn", "đồ khốn nạn", "mất dạy", "vô học", "óc lợn", "đầu buồi",
];
function containsProfanity(text) {
  const normalized = text.toLowerCase();
  return BANNED_WORDS.find((w) => normalized.includes(w)) || null;
}

const SUPPORT_TYPES = {
  kich_hoat: "Kích hoạt / Setup mới",
  su_co: "Xử lý sự cố",
  cham_soc: "Chăm sóc định kỳ",
  upsale: "Tư vấn nâng cấp / Upsale",
};

// Công nợ — Phải thu (khách hàng nợ mình) và Phải trả (mình nợ nhà cung cấp/đối tác).
const initialDebts = []; // trống — chưa có dữ liệu thật, bắt đầu ghi nhận từ khi công ty vận hành

// Kho hàng — theo dõi tồn kho, giá nhập/bán, cảnh báo sắp hết hàng.
const initialInventory = [
  // Sản phẩm "Tool AI Agent" — 4 gói thời hạn cùng 1 nhóm. Giá 1 tháng/3 tháng/6 tháng lấy từ
  // dữ liệu thật trong sheet DOANH THU_TEAM AE (Key 1 tháng=970k, Key 6 Tháng=4.840k, gói giữa suy
  // ra 3 tháng=2.470k theo đúng số tiền lặp lại nhiều lần trong sheet). Gói 2 tháng và toàn bộ giá
  // nhập (costPrice) đều là SỐ GIẢ ĐỊNH vì sheet không có — bạn cần sửa lại đúng giá nhập thật.
  { id: 1, sku: "AI-AGENT-1M", name: "Tool AI Agent", groupName: "Tool AI Agent", unit: "mã", stock: 50, minStock: 10, costPrice: 300000, sellPrice: 970000, durationMonths: 1, vatRate: 8 },
  { id: 2, sku: "AI-AGENT-2M", name: "Tool AI Agent", groupName: "Tool AI Agent", unit: "mã", stock: 50, minStock: 10, costPrice: 550000, sellPrice: 1750000, durationMonths: 2, vatRate: 8 },
  { id: 3, sku: "AI-AGENT-3M", name: "Tool AI Agent", groupName: "Tool AI Agent", unit: "mã", stock: 50, minStock: 10, costPrice: 750000, sellPrice: 2470000, durationMonths: 3, vatRate: 8 },
  { id: 4, sku: "AI-AGENT-6M", name: "Tool AI Agent", groupName: "Tool AI Agent", unit: "mã", stock: 50, minStock: 10, costPrice: 1450000, sellPrice: 4840000, durationMonths: 6, vatRate: 8 },
];

// Giao việc hàng ngày — sếp khoán việc cho từng nhân viên theo ngày, có cảnh báo tự động
// nếu quá nửa ngày mà chưa có tiến độ (tránh nhân viên ngồi chơi).
const TASK_TYPES = {
  doanh_so: { label: "Doanh số (đ)", unit: "đ" },
  khach_hang: { label: "Số khách hàng liên hệ", unit: "khách" },
  cuoc_goi: { label: "Số cuộc gọi", unit: "cuộc" },
  khach_tiep_can: { label: "Khách tiếp cận (Marketing)", unit: "khách" },
  chuyen_doi: { label: "Số chuyển đổi (Marketing)", unit: "đơn" },
  khac: { label: "Công việc khác (tick hoàn thành)", unit: "" },
};
// Mỗi vị trí chỉ nên khoán đúng loại chỉ tiêu có dữ liệu tự thu thập được — tránh chọn nhầm loại không đo được.
const ROLE_TASK_TYPES = {
  sale: ["doanh_so", "khach_hang", "cuoc_goi", "khac"],
  ads: ["khach_tiep_can", "chuyen_doi", "khac"],
  ky_thuat: ["khac"],
  ke_toan: ["khac"],
  nhan_su: ["khac"],
  van_hanh: ["khac"],
  cskh: ["khac"],
  quan_ly: ["khac"],
  khac: ["khac"],
};
const initialTasks = []; // trống — chưa có dữ liệu thật, bắt đầu ghi nhận từ khi công ty vận hành
// Nhật ký Marketing hàng ngày — mỗi dòng là 1 ngày làm việc của 1 nhân viên Ads/Marketing.
// Dùng để xếp đánh giá hiệu suất hàng ngày: tỷ lệ chuyển đổi, chi phí/khách, ROAS ngày đó.
const initialMarketingLogs = [
// Nhập từ sheet "BÁO CÁO MKT 2026.xlsm" thật — khối đầu (tên tạm) + khối "Tuấn Anh".
  { id: 92000000, date: "2026-07-01", employeeId: 16, pagesManaged: 1, customersReached: 117, conversions: 4, adSpend: 2440163, revenue: 6880000, note: "Nhập từ sheet BÁO CÁO MKT 2026 — khối đầu, tên đặt tạm" },
  { id: 92000001, date: "2026-07-02", employeeId: 16, pagesManaged: 1, customersReached: 81, conversions: 8, adSpend: 2197367, revenue: 15500000, note: "Nhập từ sheet BÁO CÁO MKT 2026 — khối đầu, tên đặt tạm" },
  { id: 92000002, date: "2026-07-03", employeeId: 16, pagesManaged: 1, customersReached: 111, conversions: 6, adSpend: 2207436, revenue: 12690000, note: "Nhập từ sheet BÁO CÁO MKT 2026 — khối đầu, tên đặt tạm" },
  { id: 92000003, date: "2026-07-04", employeeId: 16, pagesManaged: 1, customersReached: 45, conversions: 6, adSpend: 1062021, revenue: 12690000, note: "Nhập từ sheet BÁO CÁO MKT 2026 — khối đầu, tên đặt tạm" },
  { id: 92000004, date: "2026-07-05", employeeId: 16, pagesManaged: 1, customersReached: 27, conversions: 2, adSpend: 398902, revenue: 3440000, note: "Nhập từ sheet BÁO CÁO MKT 2026 — khối đầu, tên đặt tạm" },
  { id: 92000005, date: "2026-07-06", employeeId: 16, pagesManaged: 1, customersReached: 86, conversions: 3, adSpend: 1862805, revenue: 9140000, note: "Nhập từ sheet BÁO CÁO MKT 2026 — khối đầu, tên đặt tạm" },

  { id: 91000000, date: "2026-07-01", employeeId: 15, pagesManaged: 1, customersReached: 117, conversions: 4, adSpend: 2440163, revenue: 6880000, note: "Nhập từ sheet BÁO CÁO MKT 2026 — Tuấn Anh" },
  { id: 91000001, date: "2026-07-02", employeeId: 15, pagesManaged: 1, customersReached: 81, conversions: 8, adSpend: 2197367, revenue: 15500000, note: "Nhập từ sheet BÁO CÁO MKT 2026 — Tuấn Anh" },
  { id: 91000002, date: "2026-07-03", employeeId: 15, pagesManaged: 1, customersReached: 111, conversions: 6, adSpend: 2207436, revenue: 12690000, note: "Nhập từ sheet BÁO CÁO MKT 2026 — Tuấn Anh" },
  { id: 91000003, date: "2026-07-04", employeeId: 15, pagesManaged: 1, customersReached: 45, conversions: 6, adSpend: 1062021, revenue: 12690000, note: "Nhập từ sheet BÁO CÁO MKT 2026 — Tuấn Anh" },
  { id: 91000004, date: "2026-07-05", employeeId: 15, pagesManaged: 1, customersReached: 27, conversions: 0, adSpend: 398902, revenue: 3440000, note: "Nhập từ sheet BÁO CÁO MKT 2026 — Tuấn Anh" },

];

// ---------- Chấm công (Attendance) — hỗ trợ nhiều tháng, lưu lịch sử riêng từng tháng ----------
const ATT_YEAR = TODAY.getFullYear();
const ATT_MONTH = TODAY.getMonth() + 1; // tháng hiện tại thật — Bảng lương/Hiệu suất tự chuyển theo đúng tháng đang chạy
function daysInMonthVN(year, month) { return new Date(year, month, 0).getDate(); }
const ATT_DAYS = daysInMonthVN(ATT_YEAR, ATT_MONTH);
function isSundayVN(year, month, day) { return new Date(year, month - 1, day).getDay() === 0; }
const DAY_NAMES_VN = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
function dayNameVN(year, month, day) { return DAY_NAMES_VN[new Date(year, month - 1, day).getDay()]; }
function monthKey(year, month) { return `${year}-${String(month).padStart(2, "0")}`; }
function monthLabelVN(year, month) { return `Tháng ${month}/${year}`; }
// Danh sách tháng có thể chọn ở tab Chấm công — dùng để xem lại/chấm bù các tháng trước; ngày chưa tới luôn bị khoá.
const MONTH_OPTIONS = [];
for (let y = ATT_YEAR - 1; y <= ATT_YEAR + 1; y++) for (let m = 1; m <= 12; m++) MONTH_OPTIONS.push({ year: y, month: m });

// Nhân viên nghỉ việc tháng nào thì tháng đó trở về trước vẫn còn dữ liệu đúng (đã làm việc thật),
// từ tháng sau ngày nghỉ trở đi mới tự động ẩn khỏi Chấm công/Bảng lương/CRM/Hiệu suất...
function isEmployeeActiveInMonth(emp, year, month) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  if (emp.joined && new Date(emp.joined) > monthEnd) return false; // chưa vào làm trong tháng này
  if (emp.status === "inactive" && emp.resignedDate) {
    if (new Date(emp.resignedDate) < monthStart) return false; // đã nghỉ trước khi tháng này bắt đầu
  } else if (emp.status === "inactive" && !emp.resignedDate) {
    // Nghỉ việc nhưng chưa ghi ngày cụ thể — coi như đã nghỉ hẳn, chỉ hiện ở các tháng trước tháng hiện tại.
    if (year > ATT_YEAR || (year === ATT_YEAR && month >= ATT_MONTH)) return false;
  }
  return true;
}

// ---------- Khóa sổ tháng cũ — tự khóa sau 30 ngày kể từ cuối tháng, cần mật khẩu giám đốc để sửa lại. ----------
const LOCK_WINDOW_DAYS = 30;
const DEFAULT_DIRECTOR_PASSWORD = "GIAMDOC2026"; // đổi trong Cài đặt công ty nếu cần
function isPeriodLocked(year, month, unlockedSet) {
  if (unlockedSet && unlockedSet.has(monthKey(year, month))) return false;
  const monthEnd = new Date(year, month, 0);
  const daysSinceEnd = Math.floor((TODAY - monthEnd) / (1000 * 60 * 60 * 24));
  return daysSinceEnd > LOCK_WINDOW_DAYS;
}
const ATTENDANCE_CODES = {
  X: { label: "Làm đủ công", value: 1 },
  P: { label: "Làm nửa công", value: 0.5 },
  N: { label: "Nghỉ có phép", value: 0 },
  K: { label: "Nghỉ không phép", value: 0 },
  L: { label: "Nghỉ lễ / Tết (hưởng lương)", value: 1 },
  O: { label: "Tăng ca ngày nghỉ", value: 1 },
  CN: { label: "Nghỉ Chủ nhật (tự động)", value: 0 },
};

// Sinh bảng chấm công mặc định cho 1 tháng bất kỳ: chỉ tự đặt Chủ nhật = "CN" (sự thật lịch,
// không phải giả định làm việc). Mọi ngày khác để TRỐNG cho tới khi thực sự chấm công —
// chưa chấm thì chưa tính công, tránh hiện lương cho ngày chưa ai làm việc thật.
function defaultMonthAttendance(year, month, overrides = {}) {
  const days = daysInMonthVN(year, month);
  const att = {};
  for (let d = 1; d <= days; d++) {
    if (isSundayVN(year, month, d)) { att[d] = "CN"; continue; }
    if (overrides[d]) { att[d] = overrides[d]; continue; }
    // Không set gì — để trống, chờ chấm công thật.
  }
  return att;
}
function standardWorkDaysFor(year, month) {
  const days = daysInMonthVN(year, month);
  let c = 0;
  for (let d = 1; d <= days; d++) if (!isSundayVN(year, month, d)) c++;
  return c;
}
// Chỉ tính công cho ngày ĐÃ THỰC SỰ CHẤM — chưa chấm ngày nào thì ngày đó = 0,
// dù là ngày đã qua hay chưa tới. Đúng nguyên tắc "tích ngày nào mới tính lương ngày đó".
function monthlyCongFor(attendance, year, month) {
  const rec = attendance?.[monthKey(year, month)];
  const days = daysInMonthVN(year, month);
  let total = 0;
  for (let d = 1; d <= days; d++) {
    const code = rec?.[d];
    if (code) total += ATTENDANCE_CODES[code]?.value ?? 0;
  }
  return total;
}
// Phụ cấp chuyên cần — chỉ được hưởng ĐỦ nếu tháng đó không có ngày nghỉ có phép (N)
// hay nghỉ không phép (K) nào. Có bất kỳ ngày N/K nào trong tháng là mất luôn phụ cấp này,
// đúng thực tế phổ biến ở doanh nghiệp Việt Nam (thưởng chuyên cần toàn tháng, không chia nhỏ).
function hasAbsenceInMonth(attendance, year, month) {
  const rec = attendance?.[monthKey(year, month)];
  if (!rec) return false;
  return Object.values(rec).some((code) => code === "N" || code === "K");
}
// Wrapper cho tháng hiện tại — dùng ở Bảng lương/Hiệu suất/Nhân sự, giữ nguyên chữ ký cũ.
function standardWorkDays() { return standardWorkDaysFor(ATT_YEAR, ATT_MONTH); }
function monthlyCong(attendance) { return monthlyCongFor(attendance, ATT_YEAR, ATT_MONTH); }
// attendance của nhân viên giờ lưu dạng { "2026-07": {1:"X",...}, "2026-08": {...} } — mỗi tháng một bản ghi riêng.
function defaultAttendance(overrides = {}) {
  return { [monthKey(ATT_YEAR, ATT_MONTH)]: defaultMonthAttendance(ATT_YEAR, ATT_MONTH, overrides) };
}
const ROLE_BAND_CLASS = { sale: "band-blue", ky_thuat: "band-green", ads: "band-gold", ke_toan: "band-muted", nhan_su: "band-muted", van_hanh: "band-muted", cskh: "band-muted", quan_ly: "band-muted", khac: "band-muted" };

// Employee record carries everything payroll AND performance need: base salary,
// bonus target, generic KPI, join date, role type + role-specific operating
// metrics, plus per-day attendance. Chấm công, Bảng lương và Hiệu suất đều đọc
// thẳng từ đây.
const initialEmployees = [
  { id: 12, name: "Trần Tuấn Nghĩa", position: "Nhân viên Sale", dept: "Kinh doanh", baseSalary: 7500000, bonusTarget: 2000000, kpi: 0, joined: "2026-06-15", status: "active", resignedDate: null, roleType: "sale", salesTarget: 150000000, salesActual: 49790000, dealsClosed: 24, leadsHandled: 24, consecutiveLowKpiMonths: 0, dependents: 0, mealAllowance: 730000, attendanceBonus: 300000, otherBonus: 0, advance: 0, contractType: "chinh_thuc", probationRate: 1, dob: "", hometown: "", bankName: "", bankAccount: "", phone: "", email: "", idNumber: "", education: "", major: "", resumeSummary: "Nhập từ dữ liệu thật — sheet DOANH THU_TEAM AE.", attendance: defaultAttendance() },
  { id: 13, name: "Trần Văn Hiếu", position: "Nhân viên Sale", dept: "Kinh doanh", baseSalary: 7500000, bonusTarget: 2000000, kpi: 0, joined: "2026-06-15", status: "active", resignedDate: null, roleType: "sale", salesTarget: 150000000, salesActual: 15930000, dealsClosed: 10, leadsHandled: 10, consecutiveLowKpiMonths: 0, dependents: 0, mealAllowance: 730000, attendanceBonus: 300000, otherBonus: 0, advance: 0, contractType: "chinh_thuc", probationRate: 1, dob: "", hometown: "", bankName: "", bankAccount: "", phone: "", email: "", idNumber: "", education: "", major: "", resumeSummary: "Nhập từ dữ liệu thật — sheet DOANH THU_TEAM AE.", attendance: defaultAttendance() },
  { id: 14, name: "Lê Văn Thương", position: "Nhân viên Sale", dept: "Kinh doanh", baseSalary: 7500000, bonusTarget: 2000000, kpi: 0, joined: "2026-06-15", status: "active", resignedDate: null, roleType: "sale", salesTarget: 150000000, salesActual: 12160000, dealsClosed: 7, leadsHandled: 7, consecutiveLowKpiMonths: 0, dependents: 0, mealAllowance: 730000, attendanceBonus: 300000, otherBonus: 0, advance: 0, contractType: "chinh_thuc", probationRate: 1, dob: "", hometown: "", bankName: "", bankAccount: "", phone: "", email: "", idNumber: "", education: "", major: "", resumeSummary: "Nhập từ dữ liệu thật — sheet DOANH THU_TEAM AE.", attendance: defaultAttendance() },
  { id: 15, name: "Đỗ Tuấn Anh", position: "Nhân viên chạy Ads", dept: "Marketing", baseSalary: 7500000, bonusTarget: 2000000, kpi: 0, joined: "2026-06-15", status: "active", resignedDate: null, roleType: "ads", adSpend: 8305889, adRevenue: 51200000, conversions: 24, ctr: 0, consecutiveLowKpiMonths: 0, dependents: 0, mealAllowance: 730000, attendanceBonus: 300000, otherBonus: 0, advance: 0, contractType: "chinh_thuc", probationRate: 1, dob: "", hometown: "", bankName: "", bankAccount: "", phone: "", email: "", idNumber: "", education: "", major: "", resumeSummary: "Nhập từ dữ liệu thật — sheet BÁO CÁO MKT 2026.", attendance: defaultAttendance() },

  { id: 16, name: "Nguyễn Văn Toản", position: "Nhân viên chạy Ads", dept: "Marketing", baseSalary: 7500000, bonusTarget: 2000000, kpi: 0, joined: "2026-06-15", status: "active", resignedDate: null, roleType: "ads", adSpend: 10168694, adRevenue: 60340000, conversions: 29, ctr: 0, consecutiveLowKpiMonths: 0, dependents: 0, mealAllowance: 730000, attendanceBonus: 300000, otherBonus: 0, advance: 0, contractType: "chinh_thuc", probationRate: 1, dob: "", hometown: "", bankName: "", bankAccount: "", phone: "", email: "", idNumber: "", education: "", major: "", resumeSummary: "Nhập từ dữ liệu thật — sheet BÁO CÁO MKT 2026, khối đầu tiên.", attendance: defaultAttendance() },
  { id: 18, name: "Nguyễn Tiến Phong", position: "Hỗ trợ kỹ thuật", dept: "Kỹ thuật", baseSalary: 7500000, bonusTarget: 2000000, kpi: 0, joined: "2026-06-15", status: "active", resignedDate: null, roleType: "ky_thuat", tasksAssigned: 0, tasksCompleted: 0, tasksOnTime: 0, bugsFixed: 0, upsaleValue: 0, dependents: 0, mealAllowance: 730000, attendanceBonus: 300000, otherBonus: 0, advance: 0, contractType: "chinh_thuc", probationRate: 1, dob: "", hometown: "", bankName: "", bankAccount: "", phone: "", email: "", idNumber: "", education: "", major: "", resumeSummary: "Nhập từ danh sách nhân viên thật, chưa có dữ liệu task/upsale.", attendance: defaultAttendance() },
  { id: 19, name: "Hoàng Văn Hiệp", position: "Hỗ trợ kỹ thuật", dept: "Kỹ thuật", baseSalary: 7500000, bonusTarget: 2000000, kpi: 0, joined: "2026-06-15", status: "active", resignedDate: null, roleType: "ky_thuat", tasksAssigned: 0, tasksCompleted: 0, tasksOnTime: 0, bugsFixed: 0, upsaleValue: 0, dependents: 0, mealAllowance: 730000, attendanceBonus: 300000, otherBonus: 0, advance: 0, contractType: "chinh_thuc", probationRate: 1, dob: "", hometown: "", bankName: "", bankAccount: "", phone: "", email: "", idNumber: "", education: "", major: "", resumeSummary: "Nhập từ danh sách nhân viên thật, chưa có dữ liệu task/upsale.", attendance: defaultAttendance() },
];

const fmtVND = (n) => Math.round(n || 0).toLocaleString("vi-VN") + "đ";

function tenureMonths(joinedStr) {
  const j = new Date(joinedStr);
  return Math.max(0, (TODAY.getFullYear() - j.getFullYear()) * 12 + (TODAY.getMonth() - j.getMonth()));
}
function tenureLabel(months) {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} tháng`;
  return `${y} năm ${m} tháng`;
}

// Thuế TNCN lũy tiến từng phần theo biểu 7 bậc (thu nhập từ tiền lương, cá nhân cư trú).
// Ngưỡng có thể thay đổi theo quy định hiện hành — kiểm tra lại trước khi dùng thật.
// ---------- Thuế TNDN (thu nhập doanh nghiệp) — theo Nghị định 320/2025/NĐ-CP, áp dụng từ kỳ
// tính thuế 2025, chính thức 01/01/2026. Thuế suất theo QUY MÔ DOANH THU NĂM (không còn đồng
// nhất 20% như trước) — DN nhỏ được ưu đãi thấp hơn hẳn.
function corporateTaxRate(annualRevenue) {
  if (annualRevenue <= 3000000000) return 0.15;       // ≤ 3 tỷ/năm → 15%
  if (annualRevenue <= 50000000000) return 0.17;      // 3-50 tỷ/năm → 17%
  return 0.20;                                          // > 50 tỷ/năm → 20% (mức phổ thông)
}
// Ngưỡng bắt buộc thanh toán KHÔNG DÙNG TIỀN MẶT để khoản chi được tính là chi phí hợp lý khi
// tính thuế TNDN — theo Nghị định 320/2025/NĐ-CP: giảm từ 20 triệu (quy định cũ) xuống còn
// ĐÚNG 5 TRIỆU ĐỒNG mỗi lần mua hàng hoá/dịch vụ. Chi tiền mặt từ mức này trở lên có nguy cơ bị
// loại chi phí khi quyết toán thuế, dù có đủ hoá đơn.
const CASH_PAYMENT_DEDUCTIBLE_LIMIT = 5000000;

// CẬP NHẬT theo Luật Thuế TNCN 2025 (số 109/2025/QH15) — áp dụng từ kỳ tính thuế 01/01/2026: biểu
// thuế lũy tiến rút gọn từ 7 xuống còn 5 bậc, giãn khoảng cách rộng hơn, giảm thuế suất bậc 2-3.
const PIT_BRACKETS = [
  [10000000, 0.05], [30000000, 0.10], [60000000, 0.20], [100000000, 0.30], [Infinity, 0.35],
];
function progressiveTax(taxableIncome) {
  if (taxableIncome <= 0) return 0;
  let tax = 0, prev = 0;
  for (const [upper, rate] of PIT_BRACKETS) {
    if (taxableIncome <= prev) break;
    tax += (Math.min(taxableIncome, upper) - prev) * rate;
    prev = upper;
  }
  return tax;
}
// CẬP NHẬT theo Nghị quyết 110/2025/UBTVQH15 — mức giảm trừ gia cảnh mới áp dụng từ kỳ tính thuế
// 01/01/2026, tăng ~41% so với mức cũ (11tr/4,4tr) theo Nghị quyết 954/2020/UBTVQH14 đã hết hiệu lực.
const PERSONAL_DEDUCTION = 15500000;
const DEPENDENT_DEDUCTION = 6200000;
const MEAL_ALLOWANCE_TAX_FREE_CAP = 730000;

// ---------- Công thức lương Sale / Marketing / Hỗ trợ kỹ thuật ----------
// Chép đúng theo bảng "Quy định KPI" bạn gửi (3 khối: Sale, Marketing, Hỗ trợ kỹ thuật).
// Mọi mốc/tỷ lệ là hằng số riêng — sửa trực tiếp nếu công ty đổi chính sách.

// ① SALE - LƯƠNG THEO DOANH SỐ
const SALE_LOW_THRESHOLD = 50000000;    // dưới 50tr: 70% lương cứng, không hoa hồng
const SALE_KPI_TARGET = 100000000;      // đạt 100tr: bắt đầu tính hoa hồng
const SALE_LOW_RATE = 0.7;
const SALE_FULL_RATE = 1.0;
const SALE_COMMISSION_STEP = 100000000; // mỗi mốc 100tr
const SALE_COMMISSION_BASE_RATE = 0.012;  // hoa hồng ở mốc 100-200tr = 1,2%
const SALE_COMMISSION_RATE_INCREMENT = 0.006; // mỗi mốc 100tr tiếp theo +0,6%, cộng dồn không giới hạn
function saleTieredCommission(revenue) {
  if (revenue < SALE_KPI_TARGET) return 0;
  let commission = 0, prev = SALE_KPI_TARGET, rate = SALE_COMMISSION_BASE_RATE;
  while (prev < revenue) {
    const upper = prev + SALE_COMMISSION_STEP;
    commission += (Math.min(revenue, upper) - prev) * rate;
    prev = upper;
    rate += SALE_COMMISSION_RATE_INCREMENT;
  }
  return commission;
}
function evaluateSaleComp(revenue, baseSalary) {
  // ĐÃ SỬA theo yêu cầu: nhân viên chính thức nhận ĐỦ lương cơ bản (không còn bị giảm còn 70%
  // nếu doanh số thấp như trước) — lương thật sự tính theo NGÀY CÔNG THỰC TẾ (nghỉ ngày nào trừ
  // lương ngày đó, xử lý chung ở computePayroll qua salaryByDays), KHÔNG còn phụ thuộc doanh số.
  // Doanh số chỉ còn quyết định phần HOA HỒNG THƯỞNG THÊM (đạt từ 100 triệu trở lên), tách hẳn
  // khỏi lương cứng — đúng tinh thần "đạt KPI thì có thưởng thêm", không phải "không đạt thì bị trừ".
  if (revenue < SALE_KPI_TARGET) {
    return { rate: 1, statusLabel: revenue < SALE_LOW_THRESHOLD ? "Dưới 50 triệu — vẫn nhận đủ lương cơ bản theo ngày công, chưa có hoa hồng thêm" : "50–100 triệu — chưa đạt mốc hoa hồng, vẫn nhận đủ lương cơ bản theo ngày công", fixedSalary: null, commission: 0, bonus: 0 };
  }
  return { rate: 1, statusLabel: "Đạt mốc doanh số 100tr+ — lương cơ bản theo ngày công + hoa hồng lũy tiến thêm", fixedSalary: null, commission: saleTieredCommission(revenue), bonus: 0 };
}

// ② MARKETING - THƯỞNG THEO DOANH THU (ngưỡng & hoa hồng khác Sale, có thêm "thưởng thêm" cố định)
const ADS_TIERS = [
  { max: 140000000, rate: 0.7, bonus: 0, commissionRate: 0, label: "Dưới 140tr (<70% KPI) — 70% lương cứng, không thưởng/hoa hồng" },
  { max: 200000000, rate: 1.0, bonus: 0, commissionRate: 0, label: "140–199tr (70–100% KPI) — 100% lương cứng, chưa thưởng/hoa hồng" },
  { max: 300000000, rate: 1.0, bonus: 0, commissionRate: 0.016, label: "200–300tr — đạt KPI tối thiểu, 100% lương cứng + 1,6% hoa hồng" },
  { max: 450000000, rate: 1.0, bonus: 1000000, commissionRate: 0.018, label: "Trên 300–450tr — 100% lương cứng + thưởng 1.000.000đ + 1,8% hoa hồng" },
  { max: 550000000, rate: 1.0, bonus: 2000000, commissionRate: 0.02, label: "Trên 450–550tr — 100% lương cứng + thưởng 2.000.000đ + 2,0% hoa hồng" },
  { max: Infinity, rate: 1.0, bonus: 3000000, commissionRate: 0.022, label: "Trên 550tr — 100% lương cứng + thưởng 3.000.000đ + 2,2% hoa hồng" },
];
const ADS_KPI_TARGET = 200000000; // chỉ tiêu tối thiểu Marketing/tháng/người (theo "Quy định KPI đề xuất")
function evaluateAdsComp(revenue, baseSalary) {
  // ĐÃ SỬA đồng bộ với Sale: lương cơ bản không còn bị giảm còn 70% nếu doanh thu thấp — luôn
  // nhận đủ lương cơ bản theo ngày công thực tế (tính ở computePayroll qua salaryByDays). Hoa
  // hồng/thưởng thêm theo bậc doanh thu vẫn giữ nguyên, chỉ là khoản CỘNG THÊM khi đạt mốc.
  const tier = ADS_TIERS.find((t) => revenue < t.max) || ADS_TIERS[ADS_TIERS.length - 1];
  return { rate: 1, statusLabel: tier.label, fixedSalary: null, commission: revenue * tier.commissionRate, bonus: tier.bonus };
}

// ③ HỖ TRỢ KỸ THUẬT - HOA HỒNG UPSALE: 7% trên giá trị đơn upsale tự chốt cho khách hiện hữu
const TECH_UPSALE_RATE = 0.07;

// ---------- Loại hợp đồng: Chính thức / Thử việc / Cộng tác viên ----------
// Áp theo Bộ luật Lao động & Luật BHXH hiện hành — có thể thay đổi theo quy định mới:
// - Chính thức (HĐLĐ ≥1 tháng): bắt buộc đóng BHXH-BHYT-BHTN cả NV & DN, thuế TNCN
//   lũy tiến có giảm trừ gia cảnh, được tính phụ cấp thâm niên.
// - Thử việc: hưởng tối thiểu 85% lương vị trí chính thức (Điều 26 BLLĐ 2019, có thể
//   chỉnh riêng từng người), thường CHƯA bắt buộc đóng BHXH nếu ký hợp đồng thử việc
//   riêng (không phải HĐLĐ), thuế TNCN vẫn tính lũy tiến có giảm trừ gia cảnh vì trả
//   lương định kỳ qua bảng lương.
// - Cộng tác viên (hợp đồng dịch vụ/khoán việc, không phải quan hệ lao động): KHÔNG
//   đóng BHXH-BHYT-BHTN, KHÔNG được giảm trừ gia cảnh, khấu trừ thuế TNCN 10% ngay
//   tại nguồn nếu mỗi lần chi trả ≥2.000.000đ (Điều 25 Thông tư 111/2013/TT-BTC).
const CONTRACT_META = {
  chinh_thuc: { label: "Chính thức", hasInsurance: true, progressiveTax: true, hasSeniority: true },
  thu_viec: { label: "Thử việc", hasInsurance: false, progressiveTax: true, hasSeniority: false },
  ctv: { label: "Cộng tác viên", hasInsurance: false, progressiveTax: false, hasSeniority: false },
};
const CTV_FLAT_TAX_RATE = 0.10;
const CTV_FLAT_TAX_THRESHOLD = 2000000;
const DEFAULT_PROBATION_RATE = 0.85;

// Central payroll engine — mọi số liệu kế toán trưởng cần: thu nhập, BHXH-BHYT-BHTN
// (cả phần NV đóng và phần DN đóng), giảm trừ gia cảnh, thuế TNCN lũy tiến, thực lãnh
// và tổng chi phí nhân sự thực tế doanh nghiệp phải chi trả. Ngày công lấy trực tiếp
// từ bảng Chấm công — sửa ở đó là lương tự tính lại. Sale/Ads tính theo doanh số +
// hoa hồng bậc thang; Hỗ trợ kỹ thuật & vị trí khác tính theo công + KPI thưởng.
// Loại hợp đồng (chính thức/thử việc/CTV) quyết định có đóng BHXH và cách tính thuế.
// year/month = kỳ báo cáo đang xem — mặc định tháng hiện tại nếu không truyền vào,
// cho phép xem lại lương của các tháng trước theo đúng ngày công/dữ liệu tháng đó.
// ---------- Thưởng KPI theo mốc doanh số — CÓ THỂ CHỈNH SỬA, không còn cố định trong code ----------
// Tính trên doanh số ĐÃ TRỪ VAT (đúng nguyên tắc "trừ VAT trước rồi mới tính %" đã áp dụng cho
// Hợp tác phân phối) — đây là khoản thưởng THÊM, cộng vào lương chính/hoa hồng đã có sẵn.
const DEFAULT_KPI_TIERS = {
  sale: [{ minRevenue: 0, pct: 0 }, { minRevenue: 100000000, pct: 1.6 }, { minRevenue: 300000000, pct: 2.0 }],
  ads: [{ minRevenue: 0, pct: 0 }, { minRevenue: 100000000, pct: 1.6 }, { minRevenue: 300000000, pct: 2.0 }],
};
const KPI_BONUS_VAT_RATE = 8; // % VAT giả định trừ trước khi tính thưởng KPI — đổi ở đây nếu công ty áp mức khác
function computeKpiMilestoneBonus(revenue, tiers) {
  if (!revenue || !tiers || tiers.length === 0) return { netOfVat: 0, pct: 0, bonusAmount: 0 };
  const { beforeTax: netOfVat } = splitVAT(revenue, KPI_BONUS_VAT_RATE);
  const pct = lookupCommissionTier(netOfVat, tiers);
  return { netOfVat, pct, bonusAmount: netOfVat * (pct / 100) };
}

function computePayroll(e, year = ATT_YEAR, month = ATT_MONTH, kpiTiers = DEFAULT_KPI_TIERS) {
  const contract = CONTRACT_META[e.contractType] || CONTRACT_META.chinh_thuc;
  const months = tenureMonths(e.joined);

  // Tháng chưa tới (chưa có ngày làm việc nào) — toàn bộ lương = 0, kể cả Sale/Marketing tính theo
  // doanh số, để tránh hiện lương "khống" cho tháng chưa bắt đầu.
  if (new Date(year, month - 1, 1) > TODAY) {
    const standardDays = standardWorkDaysFor(year, month);
    return {
      contractType: e.contractType || "chinh_thuc", contractLabel: contract.label, probationRate: 1, periodYear: year, periodMonth: month,
      months, standardDays, actualDays: 0, daySalary: e.baseSalary / standardDays, salaryByDays: 0, kpiBonus: 0, seniorityAllowance: 0, mealAllowance: 0, otherBonus: 0, advance: 0, attendanceBonus: 0, hasAbsence: false, kpiMilestoneBonus: 0, kpiMilestonePct: 0, kpiMilestoneNetRevenue: 0, grossIncome: 0,
      usesRevenueModel: e.roleType === "sale" || e.roleType === "ads", mainSalary: 0, commission: 0, compBonus: 0, techUpsale: 0, compStatusLabel: "Tháng chưa bắt đầu — chưa có dữ liệu", compRate: null, revenueUsed: 0,
      bhxhNV: 0, bhytNV: 0, bhtnNV: 0, employeeInsurance: 0,
      bhxhDN: 0, bhytDN: 0, bhtnDN: 0, bhtnldBnnDN: 0, employerInsurance: 0,
      personalDeduction: 0, taxableIncome: 0, thueTNCN: 0,
      net: 0, employerTotalCost: 0, notStarted: true,
    };
  }

  const standardDays = standardWorkDaysFor(year, month);
  const actualDays = monthlyCongFor(e.attendance, year, month);
  const daySalary = e.baseSalary / standardDays;
  const salaryByDays = daySalary * actualDays;
  const seniorityRate = contract.hasSeniority ? (months >= 24 ? 0.04 : months >= 12 ? 0.02 : 0) : 0;
  const hasAbsence = hasAbsenceInMonth(e.attendance, year, month);
  const otherBonus = e.otherBonus || 0;
  const advance = e.advance || 0;
  const probationRate = e.contractType === "thu_viec" ? (e.probationRate || DEFAULT_PROBATION_RATE) : 1;

  const usesRevenueModel = e.roleType === "sale" || e.roleType === "ads";
  // Lương cứng theo hệ số/doanh số của Sale-Marketing chỉ áp dụng khi NGƯỜI ĐÓ ĐÃ THỰC SỰ CHẤM
  // CÔNG ít nhất 1 ngày trong tháng — tránh trả "lương sàn" cho người chưa hề đi làm ngày nào.
  const hasAnyAttendance = actualDays > 0;
  // Phụ cấp ăn trưa/thâm niên/chuyên cần đều là khoản GẮN VỚI NGÀY CÔNG THẬT — không chấm công
  // ngày nào trong tháng thì KHÔNG phát sinh các khoản này, tránh hiện "có lương" dù chưa ai làm
  // việc gì cả (lỗi trước đây: các khoản này cộng vô điều kiện, không kiểm tra hasAnyAttendance).
  const seniorityAllowance = hasAnyAttendance ? e.baseSalary * seniorityRate : 0;
  const mealAllowance = hasAnyAttendance ? (e.mealAllowance || 0) : 0;
  const attendanceBonus = hasAnyAttendance && !hasAbsence ? (e.attendanceBonus || 0) : 0;
  let mainSalary, kpiBonus = 0, commission = 0, compBonus = 0, techUpsale = 0, compStatusLabel = null, compRate = null, revenueUsed = 0;
  let kpiMilestoneBonus = 0, kpiMilestonePct = 0, kpiMilestoneNetRevenue = 0;

  if (e.roleType === "sale") {
    revenueUsed = e.salesActual || 0;
    if (!hasAnyAttendance) {
      mainSalary = 0; commission = 0; compStatusLabel = "Chưa chấm công ngày nào — chưa phát sinh lương"; compRate = 0;
    } else {
      const comp = evaluateSaleComp(revenueUsed, e.baseSalary);
      mainSalary = salaryByDays; // ĐÃ SỬA: lương cơ bản tính đúng theo ngày công thực tế (nghỉ ngày nào trừ ngày đó) — không còn phụ thuộc/bị giảm theo mốc doanh số như trước.
      commission = comp.commission; // hoa hồng lũy tiến vẫn cộng thêm riêng khi đạt mốc 100tr+, không đổi.
      compStatusLabel = comp.statusLabel;
      compRate = comp.rate;
      const kpiCalc = computeKpiMilestoneBonus(revenueUsed, kpiTiers.sale);
      kpiMilestoneBonus = kpiCalc.bonusAmount; kpiMilestonePct = kpiCalc.pct; kpiMilestoneNetRevenue = kpiCalc.netOfVat;
    }
  } else if (e.roleType === "ads") {
    revenueUsed = e.adRevenue || 0;
    if (!hasAnyAttendance) {
      mainSalary = 0; commission = 0; compBonus = 0; compStatusLabel = "Chưa chấm công ngày nào — chưa phát sinh lương"; compRate = 0;
    } else {
      const comp = evaluateAdsComp(revenueUsed, e.baseSalary);
      mainSalary = salaryByDays; // ĐÃ SỬA: lương cơ bản theo đúng ngày công thực tế, không còn phụ thuộc bậc doanh thu — hoa hồng/thưởng thêm vẫn theo bảng ② MARKETING, cộng thêm riêng.
      commission = comp.commission;
      compBonus = comp.bonus;
      compStatusLabel = comp.statusLabel;
      compRate = comp.rate;
      const kpiCalc = computeKpiMilestoneBonus(revenueUsed, kpiTiers.ads);
      kpiMilestoneBonus = kpiCalc.bonusAmount; kpiMilestonePct = kpiCalc.pct; kpiMilestoneNetRevenue = kpiCalc.netOfVat;
    }
  } else if (e.roleType === "ky_thuat") {
    mainSalary = salaryByDays; // tính theo ngày công như cũ
    techUpsale = hasAnyAttendance ? (e.upsaleValue || 0) * TECH_UPSALE_RATE : 0; // đúng bảng ③ HỖ TRỢ KỸ THUẬT — 7% giá trị upsale tự chốt
  } else {
    mainSalary = salaryByDays; // vị trí Khác: tính theo ngày công + thưởng KPI thường
    kpiBonus = hasAnyAttendance ? e.bonusTarget * (Math.min(e.kpi, 120) / 100) : 0;
  }
  mainSalary *= probationRate; // thử việc: nhân hệ số % lương chính thức

  const grossIncome = mainSalary + kpiBonus + commission + compBonus + techUpsale + seniorityAllowance + mealAllowance + otherBonus + attendanceBonus + kpiMilestoneBonus;

  // Bảo hiểm chỉ áp dụng cho hợp đồng chính thức VÀ có chấm công thật trong tháng — tháng nào
  // không đi làm ngày nào thì không phát sinh nghĩa vụ đóng bảo hiểm cho tháng đó (đồng bộ với
  // cách xử lý phụ cấp: không có ngày công = không có khoản phát sinh nào cho tháng đó).
  const bhxhNV = contract.hasInsurance && hasAnyAttendance ? e.baseSalary * 0.08 : 0;
  const bhytNV = contract.hasInsurance && hasAnyAttendance ? e.baseSalary * 0.015 : 0;
  const bhtnNV = contract.hasInsurance && hasAnyAttendance ? e.baseSalary * 0.01 : 0;
  const employeeInsurance = bhxhNV + bhytNV + bhtnNV;

  const bhxhDN = contract.hasInsurance && hasAnyAttendance ? e.baseSalary * 0.17 : 0;
  const bhytDN = contract.hasInsurance && hasAnyAttendance ? e.baseSalary * 0.03 : 0;
  const bhtnDN = contract.hasInsurance && hasAnyAttendance ? e.baseSalary * 0.01 : 0;
  const bhtnldBnnDN = contract.hasInsurance && hasAnyAttendance ? e.baseSalary * 0.005 : 0;
  const employerInsurance = bhxhDN + bhytDN + bhtnDN + bhtnldBnnDN;

  let personalDeduction = 0, taxableIncome = 0, thueTNCN = 0;
  if (contract.progressiveTax) {
    // Chính thức & Thử việc: lương trả định kỳ qua bảng lương → thuế lũy tiến, có giảm trừ gia cảnh
    const mealTaxFree = Math.min(mealAllowance, MEAL_ALLOWANCE_TAX_FREE_CAP);
    personalDeduction = PERSONAL_DEDUCTION + (e.dependents || 0) * DEPENDENT_DEDUCTION;
    taxableIncome = grossIncome - mealTaxFree - employeeInsurance - personalDeduction;
    thueTNCN = progressiveTax(taxableIncome);
  } else {
    // Cộng tác viên: khấu trừ 10% toàn bộ nếu ≥2 triệu/lần, không giảm trừ gia cảnh
    taxableIncome = grossIncome;
    thueTNCN = grossIncome >= CTV_FLAT_TAX_THRESHOLD ? grossIncome * CTV_FLAT_TAX_RATE : 0;
  }

  const net = grossIncome - employeeInsurance - thueTNCN - advance;
  const employerTotalCost = grossIncome + employerInsurance;

  return {
    contractType: e.contractType || "chinh_thuc", contractLabel: contract.label, probationRate, periodYear: year, periodMonth: month,
    months, standardDays, actualDays, daySalary, salaryByDays, kpiBonus, seniorityAllowance, mealAllowance, otherBonus, advance, attendanceBonus, hasAbsence, kpiMilestoneBonus, kpiMilestonePct, kpiMilestoneNetRevenue, grossIncome,
    usesRevenueModel, mainSalary, commission, compBonus, techUpsale, compStatusLabel, compRate, revenueUsed,
    bhxhNV, bhytNV, bhtnNV, employeeInsurance,
    bhxhDN, bhytDN, bhtnDN, bhtnldBnnDN, employerInsurance,
    personalDeduction, taxableIncome: Math.max(taxableIncome, 0), thueTNCN,
    net, employerTotalCost,
  };
}

// Central performance engine - one function, role-aware, feeds both the
// Hiệu suất tab UI and the Excel export so numbers never drift apart.
function evaluatePerformance(e) {
  let status = "tot"; // tot | trung_binh | canh_bao | chua_co_du_lieu
  const reminders = [];
  let metrics = [];

  if (e.roleType === "ads") {
    // Chưa hề có dữ liệu (chưa chạy đồng nào, chưa ghi nhận doanh thu) khác hẳn "đang làm kém" —
    // tách riêng để không bị xếp oan vào diện cảnh báo hiệu suất.
    if (!e.adSpend && !e.adRevenue) {
      return { status: "chua_co_du_lieu", reminders: ["Chưa có dữ liệu chạy ads tháng này — chưa đủ căn cứ đánh giá."], metrics: [{ label: "Chi phí Ads", value: fmtVND(0) }, { label: "Doanh thu từ Ads", value: fmtVND(0) }] };
    }
    const roas = e.adSpend > 0 ? e.adRevenue / e.adSpend : 0;
    if (roas < 1.5) { status = "canh_bao"; reminders.push("ROAS dưới 1.5 — chi phí ads đang không hiệu quả, cân nhắc tạm dừng hoặc tối ưu lại chiến dịch."); }
    else if (roas < 3) { status = "trung_binh"; reminders.push("ROAS ở mức trung bình, cần tối ưu target/creative để tăng hiệu quả chi tiêu."); }
    if (e.ctr < 1) { reminders.push("CTR dưới 1% — nội dung quảng cáo chưa thu hút, cần thử creative hoặc đối tượng mới."); if (status === "tot") status = "trung_binh"; }
    metrics = [
      { label: "Chi phí Ads", value: fmtVND(e.adSpend) },
      { label: "Doanh thu từ Ads", value: fmtVND(e.adRevenue) },
      { label: "ROAS", value: roas.toFixed(2) + "x" },
      { label: "CTR", value: e.ctr + "%" },
      { label: "Chuyển đổi", value: e.conversions },
    ];
  } else if (e.roleType === "sale") {
    if (!e.salesTarget && !e.salesActual && !e.dealsClosed && !e.leadsHandled) {
      return { status: "chua_co_du_lieu", reminders: ["Chưa có dữ liệu doanh số/lead tháng này — chưa đủ căn cứ đánh giá."], metrics: [{ label: "Chỉ tiêu", value: fmtVND(0) }, { label: "Doanh số đạt", value: fmtVND(0) }] };
    }
    const targetRate = e.salesTarget > 0 ? (e.salesActual / e.salesTarget) * 100 : 0;
    const closeRate = e.leadsHandled > 0 ? (e.dealsClosed / e.leadsHandled) * 100 : 0;
    if (targetRate < 70) { status = "canh_bao"; reminders.push(`Chỉ đạt ${targetRate.toFixed(0)}% chỉ tiêu doanh số — cần rà soát pipeline và hỗ trợ thêm.`); }
    else if (targetRate < 100) { status = "trung_binh"; reminders.push(`Đạt ${targetRate.toFixed(0)}% chỉ tiêu, cần đẩy nhanh tiến độ trong phần còn lại của tháng.`); }
    if (closeRate < 20) { reminders.push(`Tỷ lệ chốt đơn ${closeRate.toFixed(0)}% khá thấp — cần training kỹ năng chốt sale hoặc lọc lead kỹ hơn.`); if (status === "tot") status = "trung_binh"; }
    metrics = [
      { label: "Chỉ tiêu", value: fmtVND(e.salesTarget) },
      { label: "Doanh số đạt", value: fmtVND(e.salesActual) },
      { label: "% Chỉ tiêu", value: targetRate.toFixed(0) + "%" },
      { label: "Đơn chốt / Lead", value: `${e.dealsClosed}/${e.leadsHandled}` },
      { label: "Tỷ lệ chốt", value: closeRate.toFixed(0) + "%" },
    ];
  } else if (e.roleType === "ky_thuat") {
    if (!e.tasksAssigned) {
      return { status: "chua_co_du_lieu", reminders: ["Chưa có task nào được giao tháng này — chưa đủ căn cứ đánh giá."], metrics: [{ label: "Task được giao", value: 0 }] };
    }
    const completionRate = e.tasksAssigned > 0 ? (e.tasksCompleted / e.tasksAssigned) * 100 : 0;
    const onTimeRate = e.tasksCompleted > 0 ? (e.tasksOnTime / e.tasksCompleted) * 100 : 0;
    if (completionRate < 70) { status = "canh_bao"; reminders.push(`Chỉ hoàn thành ${completionRate.toFixed(0)}% task được giao — cần rà soát khối lượng công việc hoặc hỗ trợ.`); }
    else if (completionRate < 90) { status = "trung_binh"; reminders.push(`Hoàn thành ${completionRate.toFixed(0)}% task, cần đẩy nhanh tiến độ xử lý.`); }
    if (onTimeRate < 70) { reminders.push(`Tỷ lệ đúng hạn ${onTimeRate.toFixed(0)}% thấp — cần cải thiện quản lý thời gian và ước lượng deadline.`); if (status === "tot") status = "trung_binh"; }
    metrics = [
      { label: "Task được giao", value: e.tasksAssigned },
      { label: "Task hoàn thành", value: e.tasksCompleted },
      { label: "% Hoàn thành", value: completionRate.toFixed(0) + "%" },
      { label: "% Đúng hạn", value: onTimeRate.toFixed(0) + "%" },
      { label: "Lỗi đã sửa", value: e.bugsFixed },
    ];
  } else {
    const score = e.customScore || 0;
    if (score < 60) { status = "canh_bao"; reminders.push("Điểm đánh giá công việc dưới 60 — cần trao đổi trực tiếp để tìm nguyên nhân."); }
    else if (score < 80) { status = "trung_binh"; reminders.push("Điểm đánh giá ở mức trung bình, cần đặt mục tiêu cải thiện rõ ràng cho tháng tới."); }
    metrics = [{ label: "Điểm đánh giá", value: score + "/100" }];
  }

  // Quy định KPI đề xuất: không đạt KPI nhiều tháng liên tiếp → đào tạo lại, rồi xem xét điều chuyển/chấm dứt HĐ.
  if (e.roleType === "sale" || e.roleType === "ads") {
    const streak = e.consecutiveLowKpiMonths || 0;
    if (streak >= 3) {
      status = "canh_bao";
      reminders.push(`Không đạt KPI ${streak} tháng liên tiếp — xem xét điều chuyển vị trí hoặc chấm dứt hợp đồng theo quy định.`);
    } else if (streak === 2) {
      if (status === "tot") status = "trung_binh";
      reminders.push("Không đạt KPI 2 tháng liên tiếp — cần đào tạo lại và ký cam kết cải thiện.");
    }
  }

  return { status, reminders, metrics };
}

function exportPerformanceExcel(employees) {
  const wb = XLSX.utils.book_new();
  const statusLabel = { tot: "Tốt", trung_binh: "Cần cải thiện", canh_bao: "Cảnh báo - không hiệu quả", chua_co_du_lieu: "Chưa có dữ liệu" };

  const summary = employees.map((e) => {
    const perf = evaluatePerformance(e);
    return {
      "Họ tên": e.name,
      "Chức vụ": e.position,
      "Phòng ban": e.dept,
      "Vị trí": ROLE_META[e.roleType]?.label || "Khác",
      "Loại hợp đồng": CONTRACT_META[e.contractType]?.label || "Chính thức",
      "KPI thưởng (%)": e.kpi,
      "Ngày công": `${monthlyCong(e.attendance)}/${standardWorkDays()}`,
      "Thâm niên": tenureLabel(tenureMonths(e.joined)),
      "Đánh giá hiệu suất": statusLabel[perf.status],
      "Nhắc nhở / Cảnh báo": perf.reminders.join(" | ") || "Không có",
    };
  });
  const ws1 = XLSX.utils.json_to_sheet(summary);
  ws1["!cols"] = [{ wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 22 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Tổng hợp");

  Object.keys(ROLE_META).forEach((rt) => {
    const rows = employees.filter((e) => e.roleType === rt).map((e) => {
      const perf = evaluatePerformance(e);
      const row = { "Họ tên": e.name, "Chức vụ": e.position };
      perf.metrics.forEach((m) => { row[m.label] = m.value; });
      row["Đánh giá"] = statusLabel[perf.status];
      row["Nhắc nhở"] = perf.reminders.join(" | ") || "Không có";
      return row;
    });
    if (rows.length) {
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, ROLE_META[rt].label);
    }
  });

  XLSX.writeFile(wb, `DOMIX_Hieu_suat_nhan_vien_${TODAY.toISOString().slice(0, 10)}.xlsx`);
}

function exportPayrollExcel(payrollRows) {
  const wb = XLSX.utils.book_new();

  const main = payrollRows.map((r) => ({
    "Họ tên": r.name, "Chức vụ": r.position, "Phòng ban": r.dept, "Nhóm vị trí": ROLE_META[r.roleType]?.label,
    "Loại hợp đồng": r.contractLabel,
    "Ngày công": `${r.actualDays}/${r.standardDays}`,
    "Doanh số/Doanh thu": r.usesRevenueModel ? Math.round(r.revenueUsed) : "",
    "Trạng thái lương": r.usesRevenueModel ? r.compStatusLabel : "Tính theo công",
    "Lương chính": Math.round(r.mainSalary),
    "Thưởng thêm (Marketing)": Math.round(r.compBonus),
    "Hoa hồng Sale/Marketing": Math.round(r.commission),
    "Hoa hồng upsale (Kỹ thuật)": Math.round(r.techUpsale),
    "Thưởng KPI": Math.round(r.kpiBonus),
    "PC thâm niên": Math.round(r.seniorityAllowance),
    "PC ăn trưa": Math.round(r.mealAllowance),
    "PC chuyên cần": Math.round(r.attendanceBonus), "Mất chuyên cần": r.hasAbsence ? "Có" : "Không",
    "Thưởng khác": Math.round(r.otherBonus),
    "Tổng thu nhập": Math.round(r.grossIncome),
    "BHXH-BHYT-BHTN (NV đóng)": Math.round(r.employeeInsurance),
    "Giảm trừ gia cảnh": Math.round(r.personalDeduction),
    "Thu nhập chịu thuế": Math.round(r.taxableIncome),
    "Thuế TNCN": Math.round(r.thueTNCN),
    "Tạm ứng/Khấu trừ": Math.round(r.advance),
    "Thực lãnh": Math.round(r.net),
    "BH doanh nghiệp đóng": Math.round(r.employerInsurance),
    "Tổng chi phí DN": Math.round(r.employerTotalCost),
  }));
  const ws1 = XLSX.utils.json_to_sheet(main);
  ws1["!cols"] = new Array(25).fill({ wch: 16 });
  XLSX.utils.book_append_sheet(wb, ws1, "Bảng lương chi tiết");

  const insurance = payrollRows.map((r) => ({
    "Họ tên": r.name, "Loại hợp đồng": r.contractLabel,
    "Lương đóng BH": Math.round(r.baseSalary),
    "BHXH 8% (NV)": Math.round(r.bhxhNV), "BHYT 1.5% (NV)": Math.round(r.bhytNV), "BHTN 1% (NV)": Math.round(r.bhtnNV),
    "Tổng NV đóng (10.5%)": Math.round(r.employeeInsurance),
    "BHXH 17% (DN)": Math.round(r.bhxhDN), "BHYT 3% (DN)": Math.round(r.bhytDN), "BHTN 1% (DN)": Math.round(r.bhtnDN), "BH TNLĐ-BNN 0.5% (DN)": Math.round(r.bhtnldBnnDN),
    "Tổng DN đóng (21.5%)": Math.round(r.employerInsurance),
    "Tổng nộp cơ quan BH": Math.round(r.employeeInsurance + r.employerInsurance),
  }));
  const ws2 = XLSX.utils.json_to_sheet(insurance);
  ws2["!cols"] = new Array(12).fill({ wch: 16 });
  XLSX.utils.book_append_sheet(wb, ws2, "Bảo hiểm xã hội");

  const tax = payrollRows.map((r) => ({
    "Họ tên": r.name, "Loại hợp đồng": r.contractLabel,
    "Tổng thu nhập": Math.round(r.grossIncome),
    "Số người phụ thuộc": r.dependents || 0,
    "Giảm trừ bản thân": r.contractType === "ctv" ? 0 : PERSONAL_DEDUCTION,
    "Giảm trừ người phụ thuộc": r.contractType === "ctv" ? 0 : (r.dependents || 0) * DEPENDENT_DEDUCTION,
    "Bảo hiểm được trừ": Math.round(r.employeeInsurance),
    "Thu nhập chịu thuế": Math.round(r.taxableIncome),
    "Thuế TNCN phải nộp": Math.round(r.thueTNCN),
  }));
  const ws3 = XLSX.utils.json_to_sheet(tax);
  ws3["!cols"] = new Array(9).fill({ wch: 18 });
  XLSX.utils.book_append_sheet(wb, ws3, "Thuế TNCN");

  // Sheet để nộp ngân hàng chuyển lương hàng loạt
  const bankTransfer = payrollRows.map((r) => ({
    "Họ tên": r.name,
    "Ngân hàng": r.bankName || "",
    "Số tài khoản": r.bankAccount || "",
    "Số tiền chuyển": Math.round(r.net),
    "Nội dung chuyển khoản": `Luong T${ATT_MONTH}/${ATT_YEAR} ${r.name}`,
    "Số điện thoại": r.phone || "",
  }));
  const ws4 = XLSX.utils.json_to_sheet(bankTransfer);
  ws4["!cols"] = [{ wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 30 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws4, "Chuyển khoản lương");

  // Sheet hồ sơ nhân sự đầy đủ
  const profile = payrollRows.map((r) => ({
    "Họ tên": r.name, "Chức vụ": r.position, "Phòng ban": r.dept, "Loại hợp đồng": r.contractLabel,
    "Ngày sinh": r.dob || "", "Quê quán": r.hometown || "",
    "Số điện thoại": r.phone || "", "Email": r.email || "",
    "Ngân hàng": r.bankName || "", "Số tài khoản": r.bankAccount || "",
    "Ngày vào làm": r.joined, "Số người phụ thuộc": r.dependents || 0,
  }));
  const ws5 = XLSX.utils.json_to_sheet(profile);
  ws5["!cols"] = new Array(12).fill({ wch: 18 });
  XLSX.utils.book_append_sheet(wb, ws5, "Hồ sơ nhân sự");

  XLSX.writeFile(wb, `DOMIX_Bang_luong_${TODAY.toISOString().slice(0, 10)}.xlsx`);
}

// ---------- Small components ----------
function StampBadge({ text, gold, muted }) {
  return (
    <span className={`stamp-ring ${gold ? "gold" : ""} ${muted ? "muted" : ""}`}>
      {gold ? <CheckCircle2 size={11} /> : muted ? <Clock size={11} /> : <AlertTriangle size={11} />}
      {text}
    </span>
  );
}
function LinkChip({ children }) {
  return (
    <span className="ktns-link-chip">
      <Link2 size={9} /> {children}
    </span>
  );
}
// Bấm vào tên hoặc icon bút chì để sửa — dùng khi lỡ gõ sai tên nhân viên.
function EditableName({ value, onSave, className }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const commit = () => {
    const trimmed = val.trim();
    onSave(trimmed || value);
    setEditing(false);
  };
  if (editing) {
    return (
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setVal(value); setEditing(false); } }}
        onClick={(e) => e.stopPropagation()}
        className={`border border-paper-line rounded px-1.5 py-0.5 ${className || ""}`}
      />
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 cursor-pointer group ${className || ""}`}
      onClick={(e) => { e.stopPropagation(); setVal(value); setEditing(true); }}
      title="Bấm để sửa tên"
    >
      {value}
      <Pencil size={11} className="text-muted opacity-40 group-hover:opacity-100 shrink-0" />
    </span>
  );
}
// Bộ chọn kỳ dùng chung — thay cho nút bật/tắt 2 trạng thái cũ (cả tháng ↔ toàn bộ lịch sử), giờ
// có thêm lựa chọn "Tuỳ chỉnh: từ ngày X đến ngày Y" — không bắt xem nguyên cả tháng nữa.
function RangeModePicker({ rangeMode, setRangeMode, rangeFrom, setRangeFrom, rangeTo, setRangeTo, reportMonth, reportYear, show, setShow }) {
  const label = rangeMode === "month" ? `Đang xem kỳ ${reportMonth}/${reportYear}` : rangeMode === "custom" ? `${rangeFrom.split("-").reverse().join("/")} → ${rangeTo.split("-").reverse().join("/")}` : "Đang xem toàn bộ lịch sử";
  return (
    <div className="relative">
      <button onClick={() => setShow((v) => !v)} className={`text-xs px-2.5 py-1.5 rounded-md border flex items-center gap-1.5 ${rangeMode !== "all" ? "bg-ink text-white border-ink" : "border-paper-line text-ink-light"}`}>
        <CalendarCheck size={12} /> {label} <ChevronRight size={11} className={`transition-transform ${show ? "rotate-90" : ""}`} />
      </button>
      {show && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-paper-line rounded-md shadow-lg p-3 z-20 w-64">
          <button onClick={() => { setRangeMode("month"); setShow(false); }} className={`w-full text-left text-xs px-2 py-1.5 rounded ${rangeMode === "month" ? "bg-paper font-medium" : "hover:bg-paper"}`}>Cả tháng {reportMonth}/{reportYear}</button>
          <button onClick={() => { setRangeMode("all"); setShow(false); }} className={`w-full text-left text-xs px-2 py-1.5 rounded ${rangeMode === "all" ? "bg-paper font-medium" : "hover:bg-paper"}`}>Toàn bộ lịch sử</button>
          <div className={`px-2 py-1.5 rounded ${rangeMode === "custom" ? "bg-paper" : ""}`}>
            <button onClick={() => setRangeMode("custom")} className={`text-xs mb-1.5 ${rangeMode === "custom" ? "font-medium" : ""}`}>Tuỳ chỉnh khoảng ngày</button>
            <div className="flex items-center gap-1">
              <input type="date" value={rangeFrom} onChange={(e) => { setRangeFrom(e.target.value); setRangeMode("custom"); }} className="border border-paper-line rounded px-1.5 py-1 text-[11px] flex-1" />
              <span className="text-muted text-[10px]">→</span>
              <input type="date" value={rangeTo} onChange={(e) => { setRangeTo(e.target.value); setRangeMode("custom"); }} className="border border-paper-line rounded px-1.5 py-1 text-[11px] flex-1" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function KpiCard({ icon: Icon, label, value, tone, sub }) {
  const toneColor = tone === "up" ? "var(--ledger-green)" : tone === "down" ? "var(--stamp-red)" : "var(--charcoal)";
  return (
    <div className="relative bg-white rounded-lg border border-paper-line p-3.5 flex flex-col gap-1.5 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: `linear-gradient(90deg, var(--gold), transparent)`, opacity: 0.4 }} />
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${toneColor} 12%, transparent)` }}>
          <Icon size={12} color={toneColor} />
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted font-medium leading-tight">{label}</span>
      </div>
      <div className="ktns-mono text-lg font-semibold leading-none pl-0.5" style={{ color: toneColor }}>{value}</div>
      {sub && <div className="text-[10px] text-muted pl-0.5 leading-snug" style={{ opacity: 0.85 }}>{sub}</div>}
    </div>
  );
}
// Ô nhập tiền thông minh — vừa hiện số đã format sống ngay dưới ô (đỡ đếm nhầm số 0),
// vừa gợi ý các mức x1.000/x10.000/x100.000... để bấm chọn thay vì tự gõ hết số 0.
function MoneyInput({ value, onChange, placeholder, className, disabled }) {
  const [focused, setFocused] = useState(false);
  const num = Number(value) || 0;
  const suggestions = !disabled && num > 0 && num < 100000
    ? [num * 1000, num * 10000, num * 100000, num * 1000000].filter((n) => n !== num && n <= 100000000000)
    : [];
  return (
    <div className="relative">
      <input
        type="number" value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        disabled={disabled}
        className={className || "border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono w-full disabled:bg-paper disabled:text-muted"}
      />
      {num > 0 && <div className="text-[10px] text-ink-light mt-0.5 ktns-mono">= {fmtVND(num)}</div>}
      {focused && suggestions.length > 0 && (
        <div className="absolute z-20 bg-white border border-paper-line rounded-md shadow-lg mt-1 flex flex-col min-w-[140px] overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s} onMouseDown={(e) => { e.preventDefault(); onChange(String(s)); setFocused(false); }}
              className="text-left px-2.5 py-1.5 text-xs hover:bg-paper ktns-mono border-b border-paper-line last:border-b-0"
            >
              {fmtVND(s)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function KpiBar({ value }) {
  const color = value >= 90 ? "var(--ledger-green)" : value >= 70 ? "var(--gold)" : "var(--stamp-red)";
  return (
    <div className="flex items-center gap-2">
      <div className="ktns-kpi-bar-track flex-1"><div className="ktns-kpi-bar-fill" style={{ width: `${Math.min(value, 100)}%`, background: color }} /></div>
      <span className="ktns-mono text-xs font-medium" style={{ color }}>{value}%</span>
    </div>
  );
}

// Tính toàn bộ số liệu (thu/chi/lương/thuế/BH) cho MỘT tháng bất kỳ — dùng chung cho
// kỳ báo cáo hiện tại và cho báo cáo theo Quý, để mỗi tháng luôn ra đúng số của tháng đó.
function computeMonthSnapshot(year, month, { transactions, orders, marketingLogs, employees, kpiTiers = DEFAULT_KPI_TIERS }) {
  const inMonth = (dateStr) => {
    const d = new Date(dateStr);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  };
  const txThisMonth = transactions.filter((t) => inMonth(t.date));
  const thu = txThisMonth.filter((t) => t.kind === "thu").reduce((a, b) => a + b.amount, 0);
  // Chi ở đây KHÔNG tính giao dịch nguồn "bangluong" (lương thường + lương giữa tháng) — vì quỹ
  // lương đã được tính riêng bên dưới (payrollTotal, theo đúng công thức/kỳ, không phụ thuộc đã
  // chi trả thật hay chưa). Nếu cộng cả 2 sẽ bị TÍNH TRÙNG lương khi tháng đó đã bấm "Đã chi trả".
  const chi = txThisMonth.filter((t) => t.kind === "chi" && t.source !== "bangluong").reduce((a, b) => a + b.amount, 0);
  const missingInvoices = txThisMonth.filter((t) => t.invoiceType === "Chưa xác định").length;

  const revenueByEmployee = {};
  const upsaleByEmployee = {};
  orders.filter((o) => inMonth(o.date)).forEach((o) => {
    if (!o.saleEmployeeId) return;
    if ((o.dealType || "sale") === "upsale") upsaleByEmployee[o.saleEmployeeId] = (upsaleByEmployee[o.saleEmployeeId] || 0) + (Number(o.amount) || 0);
    else revenueByEmployee[o.saleEmployeeId] = (revenueByEmployee[o.saleEmployeeId] || 0) + (Number(o.amount) || 0);
  });
  const marketingByEmployee = {};
  (marketingLogs || []).filter((l) => inMonth(l.date)).forEach((l) => {
    const cur = marketingByEmployee[l.employeeId] || { adSpend: 0, adRevenue: 0, conversions: 0 };
    cur.adSpend += Number(l.adSpend) || 0; cur.adRevenue += Number(l.revenue) || 0; cur.conversions += Number(l.conversions) || 0;
    marketingByEmployee[l.employeeId] = cur;
  });

  const payrollRows = employees.filter((e) => isEmployeeActiveInMonth(e, year, month)).map((e) => {
    let effective = e;
    if (e.roleType === "sale") effective = { ...effective, salesActual: revenueByEmployee[e.id] || 0 };
    if (e.roleType === "ads") effective = { ...effective, adSpend: marketingByEmployee[e.id]?.adSpend || 0, adRevenue: marketingByEmployee[e.id]?.adRevenue || 0, conversions: marketingByEmployee[e.id]?.conversions || 0 };
    if (e.roleType === "ky_thuat") effective = { ...effective, upsaleValue: upsaleByEmployee[e.id] || 0 };
    return { ...e, ...computePayroll(effective, year, month, kpiTiers) };
  });
  const payrollTotal = payrollRows.reduce((a, r) => a + r.net, 0);
  const employeeInsurance = payrollRows.reduce((a, r) => a + r.employeeInsurance, 0);
  const employerInsurance = payrollRows.reduce((a, r) => a + r.employerInsurance, 0);
  const taxTotal = payrollRows.reduce((a, r) => a + r.thueTNCN, 0);
  const employerCost = payrollRows.reduce((a, r) => a + r.employerTotalCost, 0);

  // Lợi nhuận PHẢI trừ đúng TOÀN BỘ chi phí lương công ty gánh (employerCost = lương gross + BHXH-
  // BHYT-BHTN phần DN đóng thêm ~21.5% lương cơ bản mỗi người) — KHÔNG PHẢI chỉ trừ số lương thực
  // lãnh nhân viên nhận (payrollTotal/net). Trước đây dùng nhầm payrollTotal khiến Lợi nhuận bị
  // TÍNH THIẾU đúng phần bảo hiểm doanh nghiệp phải đóng, làm lợi nhuận hiện cao hơn thực tế.
  return { year, month, thu, chi, profit: thu - chi - employerCost, missingInvoices, payrollTotal, employeeInsurance, employerInsurance, taxTotal, employerCost, payrollRows };
}
function quarterOf(month) { return Math.ceil(month / 3); }
function quarterMonths(year, quarter) { return [1, 2, 3].map((i) => ({ year, month: (quarter - 1) * 3 + i })); }

// ---------- Main App ----------
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [employees, setEmployees] = useState(initialEmployees);
  const [orders, setOrders] = useState(initialOrders);
  // Khách tiềm năng (lead) — TÁCH HẲN khỏi orders thật. Trước đây "Thêm khách cần gọi" lưu thẳng
  // vào orders với amount=0, khiến lead (chưa chắc đã mua) bị lẫn vào bảng đơn hàng/hoá đơn thật,
  // hiện sai badge "CHƯA XUẤT HĐ" cho người còn đang cân nhắc. Giờ có state riêng, khi Sale chốt
  // đơn thật mới chuyển sang orders qua nút "Chuyển thành đơn hàng".
  const [leads, setLeads] = useState([]);
  const [marketingLogs, setMarketingLogs] = useState(initialMarketingLogs);
  const [debts, setDebts] = useState(initialDebts);
  const [inventory, setInventory] = useState(initialInventory);
  const [tasks, setTasks] = useState(initialTasks);
  const [lang, setLang] = useState("vi");
  const [company, setCompany] = useState(DEFAULT_COMPANY);
  const [unlockedMonths, setUnlockedMonths] = useState(new Set());
  const [capitalContributions, setCapitalContributions] = useState([]);
  const [distributionPartners, setDistributionPartners] = useState([
    { id: 1, name: "Say Media", taxCode: "", phone: "", email: "", partnerRole: "nhuong_quyen", commissionTiers: [{ minRevenue: 0, pct: 37 }], productIds: [1, 2, 3, 4] },
  ]);
  const [distributionOrders, setDistributionOrders] = useState([
// Phí nhượng quyền Say Media 37% cho từng đơn Tool AI Agent đã bán (khớp 1-1 với 41 đơn CRM).
  { id: 70000000, sourceCrmOrderId: 80000000, date: "2026-07-01", partnerId: 1, productId: 3, productName: "Tool AI Agent", quantity: 1, revenue: 2470000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Duy Phùng", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000001, sourceCrmOrderId: 80000002, date: "2026-07-01", partnerId: 1, productId: 1, productName: "Tool AI Agent", quantity: 1, revenue: 970000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Nguyễn Đăng Trường", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000002, sourceCrmOrderId: 80000004, date: "2026-07-01", partnerId: 1, productId: 3, productName: "Tool AI Agent", quantity: 1, revenue: 2470000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Trần Quốc Thi", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000003, sourceCrmOrderId: 80000006, date: "2026-07-01", partnerId: 1, productId: 1, productName: "Tool AI Agent", quantity: 1, revenue: 970000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Bùi Hữu Quang", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000004, sourceCrmOrderId: 80000008, date: "2026-07-02", partnerId: 1, productId: 1, productName: "Tool AI Agent", quantity: 1, revenue: 970000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Nguyễn Văn Hợi", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000005, sourceCrmOrderId: 80000010, date: "2026-07-02", partnerId: 1, productId: 1, productName: "Tool AI Agent", quantity: 1, revenue: 970000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Bình Yên", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000006, sourceCrmOrderId: 80000012, date: "2026-07-02", partnerId: 1, productId: 1, productName: "Tool AI Agent", quantity: 1, revenue: 970000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Hải Cỏ Cỏ nhân tạo", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000007, sourceCrmOrderId: 80000014, date: "2026-07-02", partnerId: 1, productId: 4, productName: "Tool AI Agent", quantity: 1, revenue: 4840000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "hy siu pieu", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000008, sourceCrmOrderId: 80000016, date: "2026-07-02", partnerId: 1, productId: 4, productName: "Tool AI Agent", quantity: 1, revenue: 4840000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Lê Hoàng Văn", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000009, sourceCrmOrderId: 80000018, date: "2026-07-02", partnerId: 1, productId: 1, productName: "Tool AI Agent", quantity: 1, revenue: 970000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Nguyễn Thị Thu Hà", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000010, sourceCrmOrderId: 80000020, date: "2026-07-02", partnerId: 1, productId: 1, productName: "Tool AI Agent", quantity: 1, revenue: 970000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "song ba po", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000011, sourceCrmOrderId: 80000022, date: "2026-07-02", partnerId: 1, productId: 1, productName: "Tool AI Agent", quantity: 1, revenue: 970000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Nguyễn Quốc Trung Hiếu", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000012, sourceCrmOrderId: 80000024, date: "2026-07-03", partnerId: 1, productId: 1, productName: "Tool AI Agent", quantity: 1, revenue: 970000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Nguyễn Thị Tươi", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000013, sourceCrmOrderId: 80000026, date: "2026-07-03", partnerId: 1, productId: 4, productName: "Tool AI Agent", quantity: 1, revenue: 4840000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Nguyễn Xuân Trường", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000014, sourceCrmOrderId: 80000028, date: "2026-07-03", partnerId: 1, productId: 1, productName: "Tool AI Agent", quantity: 1, revenue: 970000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Trần Văn Hưởng", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000015, sourceCrmOrderId: 80000030, date: "2026-07-03", partnerId: 1, productId: 1, productName: "Tool AI Agent", quantity: 1, revenue: 970000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Ngô Thiên Chiều", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000016, sourceCrmOrderId: 80000032, date: "2026-07-03", partnerId: 1, productId: 3, productName: "Tool AI Agent", quantity: 1, revenue: 2470000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Trinh Thi Nhu", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000017, sourceCrmOrderId: 80000034, date: "2026-07-03", partnerId: 1, productId: 3, productName: "Tool AI Agent", quantity: 1, revenue: 2470000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Nguyễn Hồng Sơn", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000018, sourceCrmOrderId: 80000036, date: "2026-07-04", partnerId: 1, productId: 3, productName: "Tool AI Agent", quantity: 1, revenue: 2470000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Nguyễn Hồng Sơn", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000019, sourceCrmOrderId: 80000038, date: "2026-07-04", partnerId: 1, productId: 3, productName: "Tool AI Agent", quantity: 1, revenue: 2470000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Nguyễn Văn Ngọc", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000020, sourceCrmOrderId: 80000040, date: "2026-07-04", partnerId: 1, productId: 1, productName: "Tool AI Agent", quantity: 1, revenue: 970000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "NGUYỄN NGỌC ANH", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000021, sourceCrmOrderId: 80000042, date: "2026-07-04", partnerId: 1, productId: 1, productName: "Tool AI Agent", quantity: 1, revenue: 970000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Nguyễn Trung Đức", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000022, sourceCrmOrderId: 80000044, date: "2026-07-04", partnerId: 1, productId: 4, productName: "Tool AI Agent", quantity: 1, revenue: 4840000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Trần nhật minh", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000023, sourceCrmOrderId: 80000046, date: "2026-07-04", partnerId: 1, productId: 1, productName: "Tool AI Agent", quantity: 1, revenue: 970000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Nguyễn Hồng Sơn", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000024, sourceCrmOrderId: 80000048, date: "2026-07-05", partnerId: 1, productId: 3, productName: "Tool AI Agent", quantity: 1, revenue: 2470000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "nguyễn thị huệ", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000025, sourceCrmOrderId: 80000050, date: "2026-07-05", partnerId: 1, productId: 1, productName: "Tool AI Agent", quantity: 1, revenue: 970000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "hoàng ngọc an", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000026, sourceCrmOrderId: 80000052, date: "2026-07-06", partnerId: 1, productId: 4, productName: "Tool AI Agent", quantity: 1, revenue: 4840000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "trương văn tuấn", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000027, sourceCrmOrderId: 80000054, date: "2026-07-06", partnerId: 1, productId: 2, productName: "Tool AI Agent", quantity: 1, revenue: 1830000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Nguyễn Hồng Sơn", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000028, sourceCrmOrderId: 80000056, date: "2026-07-06", partnerId: 1, productId: 3, productName: "Tool AI Agent", quantity: 1, revenue: 2470000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "trần tuấn kiệt", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000029, sourceCrmOrderId: 80000058, date: "2026-07-07", partnerId: 1, productId: 1, productName: "Tool AI Agent", quantity: 1, revenue: 970000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Ngô Thị Kim Chung", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000030, sourceCrmOrderId: 80000060, date: "2026-07-08", partnerId: 1, productId: 1, productName: "Tool AI Agent", quantity: 1, revenue: 970000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "trần quốc toàn", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000031, sourceCrmOrderId: 80000062, date: "2026-07-08", partnerId: 1, productId: 3, productName: "Tool AI Agent", quantity: 1, revenue: 2470000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Đoàn Công Tuấn", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000032, sourceCrmOrderId: 80000064, date: "2026-07-08", partnerId: 1, productId: 1, productName: "Tool AI Agent", quantity: 1, revenue: 970000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "trần anh tú", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000033, sourceCrmOrderId: 80000066, date: "2026-07-08", partnerId: 1, productId: 1, productName: "Tool AI Agent", quantity: 1, revenue: 970000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Trương mạnh toàn", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000034, sourceCrmOrderId: 80000068, date: "2026-07-08", partnerId: 1, productId: 2, productName: "Tool AI Agent", quantity: 1, revenue: 1500000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Tổ Duyên", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000035, sourceCrmOrderId: 80000070, date: "2026-07-08", partnerId: 1, productId: 4, productName: "Tool AI Agent", quantity: 1, revenue: 4840000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Trần Việt Cường", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000036, sourceCrmOrderId: 80000072, date: "2026-07-08", partnerId: 1, productId: 1, productName: "Tool AI Agent", quantity: 1, revenue: 970000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Lê Thị Thu Hiền", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000037, sourceCrmOrderId: 80000074, date: "2026-07-08", partnerId: 1, productId: 1, productName: "Tool AI Agent", quantity: 1, revenue: 970000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Phùng Quang Tuấn", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000038, sourceCrmOrderId: 80000076, date: "2026-07-08", partnerId: 1, productId: 1, productName: "Tool AI Agent", quantity: 1, revenue: 970000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Nail Hello", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000039, sourceCrmOrderId: 80000078, date: "2026-07-08", partnerId: 1, productId: 1, productName: "Tool AI Agent", quantity: 1, revenue: 970000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Trần Bách", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },
  { id: 70000040, sourceCrmOrderId: 80000080, date: "2026-07-08", partnerId: 1, productId: 1, productName: "Tool AI Agent", quantity: 1, revenue: 970000, vatRate: 8, commissionPct: 37, issuedKeyCode: "", endCustomerName: "Trần Ngọc Ánh", note: "Phí nhượng quyền Say Media 37% — tự sinh từ đơn CRM tương ứng", partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null },

  ]);
  const [payrollPayments, setPayrollPayments] = useState([]);
  // Duyệt lương 2 bước: Kế toán duyệt → Sếp xác nhận (bằng mật khẩu giám đốc) → mới cho phép chi
  // trả. Áp dụng cho CẢ lương cuối tháng bình thường LẪN yêu cầu lương giữa tháng (nghỉ việc giữa
  // chừng cần thanh toán sớm, không đợi tới cuối tháng).
  const [payrollApprovals, setPayrollApprovals] = useState([]);
  const [midMonthRequests, setMidMonthRequests] = useState([]);
  const [kpiTiers, setKpiTiers] = useState(DEFAULT_KPI_TIERS);
  const [cvReviews, setCvReviews] = useState([]);
  const [marketingPages, setMarketingPages] = useState([
    { id: 1, name: "Page DOMIX", url: "", productIds: [1, 2, 3, 4], marketingEmployeeIds: [16], saleEmployeeIds: [12, 13] },
  ]);
  const [cvQueue, setCvQueue] = useState([]);
  const [fixedAssets, setFixedAssets] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [supportCases, setSupportCases] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  // Cầu nối Tuyển dụng AI → Nhân sự — ứng viên "Nên tuyển" bấm 1 nút là tự chuyển tab + điền sẵn
  // tên/vị trí vào form thêm nhân viên, không phải gõ tay lại từ đầu.
  const [prefillEmployee, setPrefillEmployee] = useState(null);
  // Sếp phải DUYỆT thì cảnh báo hiệu suất mới chạy lên ticker — không tự động chạy nữa. Chạy đúng
  // 30 phút kể từ lúc duyệt rồi tự tắt (không hiện mãi), nếu vẫn còn người cảnh báo thì lại phải
  // duyệt lại.
  const [perfWarningApprovedAt, setPerfWarningApprovedAt] = useState(null);
  const [cvProcessing, setCvProcessing] = useState(false);
  const [cvProgress, setCvProgress] = useState({ done: 0, total: 0 });
  const t = (key) => TRANSLATIONS[lang][key] || TRANSLATIONS.vi[key] || key;
  const [showTxForm, setShowTxForm] = useState(false);
  const [showEmpForm, setShowEmpForm] = useState(false);
  // Kỳ báo cáo đang xem — đổi tháng ở đây là Thu Chi, Doanh thu CRM, Marketing, Bảng lương
  // đều tự tính lại đúng số của tháng đó, tháng nào ra tháng đó, không lẫn dữ liệu.
  const [reportYear, setReportYear] = useState(ATT_YEAR);
  const [reportMonth, setReportMonth] = useState(ATT_MONTH);

  // Xuất/Nhập TOÀN BỘ dữ liệu ra file — vì app không có server lưu trữ thật, dữ liệu chỉ tồn tại
  // trong phiên làm việc hiện tại (tải lại trang là mất). Đây là cách duy nhất trong phạm vi 1 app
  // chạy trình duyệt để bạn tự sao lưu trước khi đóng tab, và nạp lại khi mở lại.
  const exportAllData = () => {
    const snapshot = {
      _meta: { exportedAt: new Date().toISOString(), appName: "DOMIX", version: 1 },
      transactions, employees, orders, marketingLogs, debts, inventory, tasks, lang, company,
      capitalContributions, distributionPartners, distributionOrders, payrollPayments, kpiTiers,
      cvReviews, marketingPages, contracts, fixedAssets, leads, supportCases, announcements, chatMessages, payrollApprovals, midMonthRequests,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `DOMIX_saoluu_${TODAY.toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const importAllData = (jsonText) => {
    try {
      const data = JSON.parse(jsonText);
      if (data.transactions) setTransactions(data.transactions);
      if (data.employees) setEmployees(data.employees);
      if (data.orders) setOrders(data.orders);
      if (data.marketingLogs) setMarketingLogs(data.marketingLogs);
      if (data.debts) setDebts(data.debts);
      if (data.inventory) setInventory(data.inventory);
      if (data.tasks) setTasks(data.tasks);
      if (data.lang) setLang(data.lang);
      if (data.company) setCompany(data.company);
      if (data.capitalContributions) setCapitalContributions(data.capitalContributions);
      if (data.distributionPartners) setDistributionPartners(data.distributionPartners);
      if (data.distributionOrders) setDistributionOrders(data.distributionOrders);
      if (data.payrollPayments) setPayrollPayments(data.payrollPayments);
      if (data.kpiTiers) setKpiTiers(data.kpiTiers);
      if (data.cvReviews) setCvReviews(data.cvReviews);
      if (data.marketingPages) setMarketingPages(data.marketingPages);
      if (data.contracts) setContracts(data.contracts);
      if (data.fixedAssets) setFixedAssets(data.fixedAssets);
      if (data.leads) setLeads(data.leads);
      if (data.supportCases) setSupportCases(data.supportCases);
      if (data.announcements) setAnnouncements(data.announcements);
      if (data.chatMessages) setChatMessages(data.chatMessages);
      if (data.payrollApprovals) setPayrollApprovals(data.payrollApprovals);
      if (data.midMonthRequests) setMidMonthRequests(data.midMonthRequests);
      return { ok: true, exportedAt: data._meta?.exportedAt };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };
  const isCurrentPeriod = reportYear === ATT_YEAR && reportMonth === ATT_MONTH;

  const snapshot = useMemo(
    () => computeMonthSnapshot(reportYear, reportMonth, { transactions, orders, marketingLogs, employees, kpiTiers }),
    [reportYear, reportMonth, transactions, orders, marketingLogs, employees, kpiTiers]
  );
  // Biểu đồ 6 tháng gần nhất — tính THẬT từ giao dịch trong Thu Chi, không còn số bịa cứng như
  // trước (trước đây hiện cả số liệu cho tháng công ty chưa hề vận hành/chưa có giao dịch nào).
  const monthlyChart = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(TODAY.getFullYear(), TODAY.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }
    return months.map(({ year, month }) => {
      const thu = transactions.filter((t) => { const td = new Date(t.date); return t.kind === "thu" && td.getFullYear() === year && td.getMonth() + 1 === month; }).reduce((a, t) => a + t.amount, 0);
      const chi = transactions.filter((t) => { const td = new Date(t.date); return t.kind === "chi" && td.getFullYear() === year && td.getMonth() + 1 === month; }).reduce((a, t) => a + t.amount, 0);
      const thuM = Math.round(thu / 1000000 * 100) / 100;
      const chiM = Math.round(chi / 1000000 * 100) / 100;
      return { month: `T${month}`, thu: thuM, chi: chiM, net: Math.round((thuM - chiM) * 100) / 100 };
    });
  }, [transactions]);
  const totals = { thu: snapshot.thu, chi: snapshot.chi, profit: snapshot.thu - snapshot.chi, missing: snapshot.missingInvoices };
  // Số dư quỹ thực tế = thu chi hoạt động kinh doanh + vốn góp bằng tiền mặt đã thực nhận
  // (vốn góp bằng tài sản/nhà đất KHÔNG cộng vào đây vì không phải tiền mặt thực có trong quỹ).
  const cashFromOperations = transactions.reduce((a, t) => a + (t.kind === "thu" ? t.amount : -t.amount), 0);
  const cashCapitalContributed = capitalContributions.filter((c) => c.assetType === "tien_mat" && c.status !== "chua_gop").reduce((a, c) => a + c.value, 0);
  const totalCharterCapitalContributed = capitalContributions.filter((c) => c.status !== "chua_gop").reduce((a, c) => a + c.value, 0);
  const cashBalance = cashFromOperations + cashCapitalContributed;
  const totalReceivable = debts.filter((d) => d.type === "thu" && d.status !== "paid").reduce((a, d) => a + d.amount, 0);
  // Doanh thu ròng đang CHỜ đối tác xác nhận hoá đơn (Hợp tác phân phối) — số này CHƯA nằm trong
  // Thu Chi (theo mô hình mới, chỉ ghi 1 khoản Thu ròng khi xác nhận xong), nên hiện riêng ở đây
  // để biết còn bao nhiêu tiền "sắp về" chứ không phải đã về.
  const pendingDistRevenue = (distributionOrders || [])
    .filter((o) => o.orderKind !== "purchase" && !o.partnerInvoiceReceived && !o.partnerInvoiceConfirmed)
    .reduce((sum, o) => {
      const p = distributionPartners.find((x) => x.id === o.partnerId);
      const monthlyRevenue = getPartnerMonthlyRevenue(o.partnerId, o.date, distributionOrders);
      const pct = lookupCommissionTier(monthlyRevenue, p?.commissionTiers);
      const split = computePartnerAmount(o.revenue, o.vatRate, pct, p?.partnerRole);
      return sum + split.remittedToCompany;
    }, 0);
  const totalPayable = debts.filter((d) => d.type === "tra" && d.status !== "paid").reduce((a, d) => a + d.amount, 0);
  const overdueDebts = debts.filter((d) => d.status !== "paid" && new Date(d.dueDate) < TODAY).length;
  const payrollRows = snapshot.payrollRows;
  const totalPayroll = snapshot.payrollTotal;
  // Dùng RIÊNG cho tính Lợi nhuận — employerCost là TOÀN BỘ chi phí lương công ty gánh (gồm cả
  // BHXH-BHYT-BHTN phần DN đóng), khác với totalPayroll (chỉ lương thực lãnh NV nhận, dùng để
  // HIỂN THỊ "quỹ lương" cho dễ hình dung, không dùng để tính lợi nhuận).
  const totalEmployerCost = snapshot.employerCost;

  // Doanh số/chỉ số Marketing của kỳ đang xem — CRM/Marketing tab dùng để hiện số theo đúng người.
  const revenueByEmployee = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const d = new Date(o.date);
      if (d.getFullYear() === reportYear && d.getMonth() + 1 === reportMonth && o.saleEmployeeId && (o.dealType || "sale") === "sale") {
        map[o.saleEmployeeId] = (map[o.saleEmployeeId] || 0) + (Number(o.amount) || 0);
      }
    });
    return map;
  }, [orders, reportYear, reportMonth]);
  // Kỹ thuật upsale thành công (đã xuất hoá đơn hay chưa đều tính, giống Sale) — trả kết quả
  // ngược lại đúng người đó để tính hoa hồng upsale 7%, không cần nhập tay upsaleValue nữa.
  const upsaleByEmployee = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const d = new Date(o.date);
      if (d.getFullYear() === reportYear && d.getMonth() + 1 === reportMonth && o.saleEmployeeId && o.dealType === "upsale") {
        map[o.saleEmployeeId] = (map[o.saleEmployeeId] || 0) + (Number(o.amount) || 0);
      }
    });
    return map;
  }, [orders, reportYear, reportMonth]);
  const marketingByEmployee = useMemo(() => {
    const map = {};
    marketingLogs.forEach((l) => {
      const d = new Date(l.date);
      if (d.getFullYear() === reportYear && d.getMonth() + 1 === reportMonth && l.employeeId) {
        const cur = map[l.employeeId] || { adSpend: 0, adRevenue: 0, conversions: 0, customersReached: 0 };
        cur.adSpend += Number(l.adSpend) || 0;
        cur.adRevenue += Number(l.revenue) || 0;
        cur.conversions += Number(l.conversions) || 0;
        cur.customersReached += Number(l.customersReached) || 0;
        map[l.employeeId] = cur;
      }
    });
    return map;
  }, [marketingLogs, reportYear, reportMonth]);

  // Nhân viên còn "hoạt động" đúng theo kỳ báo cáo đang xem — nghỉ việc tháng 6 thì tháng 7 tự ẩn,
  // nhưng xem lại tháng 6 vẫn còn đúng dữ liệu vì họ có làm việc thật trong tháng đó.
  const activeEmployees = employees.filter((e) => isEmployeeActiveInMonth(e, reportYear, reportMonth));
  // Bản "hiệu lực" của nhân viên theo đúng kỳ báo cáo — Hiệu suất/Dashboard/Trợ lý AI dùng cái này.
  const effectiveActiveEmployees = activeEmployees.map((e) => {
    let eff = e;
    if (e.roleType === "sale") eff = { ...eff, salesActual: revenueByEmployee[e.id] || 0 };
    if (e.roleType === "ads") eff = { ...eff, adSpend: marketingByEmployee[e.id]?.adSpend || 0, adRevenue: marketingByEmployee[e.id]?.adRevenue || 0, conversions: marketingByEmployee[e.id]?.conversions || 0 };
    if (e.roleType === "ky_thuat") eff = { ...eff, upsaleValue: upsaleByEmployee[e.id] || 0 };
    return eff;
  });
  const warnCount = effectiveActiveEmployees.filter((e) => evaluatePerformance(e).status === "canh_bao").length;
  const warnNames = effectiveActiveEmployees.filter((e) => evaluatePerformance(e).status === "canh_bao").map((e) => e.name);

  // Xếp hạng tổng hợp — gộp Chấm công + CRM/Marketing + Giao việc + Hiệu suất thành 1 kết quả chuẩn/người.
  const masterRanking = effectiveActiveEmployees.map((e) => {
    const payrollRow = payrollRows.find((p) => p.id === e.id);
    const taskStats = computeEmployeeTaskStats(e.id, tasks, orders, marketingLogs);
    return { emp: e, ...computeMasterRanking(e, payrollRow, taskStats) };
  }).sort((a, b) => {
    if (a.notEnoughData !== b.notEnoughData) return a.notEnoughData ? 1 : -1; // chưa đủ dữ liệu xuống cuối
    return a.compositeScore - b.compositeScore;
  });

  // Số liệu tháng trước — dùng để đề xuất phân bổ ngân sách/nhân sự cho tháng đang xem.
  const prevPeriod = reportMonth === 1 ? { year: reportYear - 1, month: 12 } : { year: reportYear, month: reportMonth - 1 };
  const prevSnapshot = useMemo(
    () => computeMonthSnapshot(prevPeriod.year, prevPeriod.month, { transactions, orders, marketingLogs, employees }),
    [prevPeriod.year, prevPeriod.month, transactions, orders, marketingLogs, employees]
  );
  const roleGroupStats = useMemo(() => {
    const groups = {};
    prevSnapshot.payrollRows.forEach((r) => {
      const g = groups[r.roleType] || { cost: 0, revenue: 0, headcount: 0 };
      g.cost += r.employerTotalCost;
      g.revenue += r.revenueUsed || 0;
      g.headcount += 1;
      groups[r.roleType] = g;
    });
    return groups;
  }, [prevSnapshot]);

  const navGroups = [
    { label: lang === "vi" ? "Tổng quan" : "Overview", items: [
      { id: "dashboard", label: t("nav_dashboard"), icon: LayoutDashboard },
    ]},
    { label: lang === "vi" ? "Tài chính" : "Finance", items: [
      { id: "thuchi", label: t("nav_thuchi"), icon: Wallet },
      { id: "congno", label: t("nav_congno"), icon: CreditCard },
      { id: "hopdong", label: lang === "vi" ? "Hợp đồng" : "Contracts", icon: FileSignature },
      { id: "vongop", label: t("nav_vongop"), icon: Coins },
      { id: "taisan", label: lang === "vi" ? "Tài sản cố định & CCDC" : "Fixed Assets & Tools", icon: Archive },
      { id: "quy", label: t("nav_quy"), icon: FileSpreadsheet },
      { id: "hoachdinh", label: t("nav_hoachdinh"), icon: PieChart },
    ]},
    { label: lang === "vi" ? "Kinh doanh" : "Business", items: [
      { id: "crm", label: t("nav_crm"), icon: ShoppingCart },
      { id: "hoptac", label: t("nav_hoptac"), icon: Handshake },
      { id: "kho", label: t("nav_kho"), icon: Package },
      { id: "marketing", label: t("nav_marketing"), icon: Megaphone },
      { id: "giaoviec", label: t("nav_giaoviec"), icon: ClipboardList },
      { id: "hotro", label: lang === "vi" ? "Hỗ trợ khách hàng" : "Customer Support", icon: Headphones },
      { id: "chat", label: lang === "vi" ? "Chat công ty" : "Company Chat", icon: MessageCircle },
    ]},
    { label: lang === "vi" ? "Nhân sự" : "HR", items: [
      { id: "nhansu", label: t("nav_nhansu"), icon: Users },
      { id: "tuyendung", label: lang === "vi" ? "Tuyển dụng AI" : "AI Recruitment", icon: UserPlus },
      { id: "chamcong", label: t("nav_chamcong"), icon: CalendarCheck },
      { id: "hieusuat", label: t("nav_hieusuat"), icon: Gauge },
      { id: "luong", label: t("nav_luong"), icon: Banknote },
    ]},
    { label: lang === "vi" ? "Trợ lý AI" : "AI Assistants", items: [
      { id: "ai", label: t("nav_ai"), icon: Bot },
      { id: "phaply", label: t("nav_phaply"), icon: Scale },
    ]},
    { label: lang === "vi" ? "Hệ thống" : "System", items: [
      { id: "settings", label: t("nav_settings"), icon: Settings },
    ]},
  ];
  const nav = navGroups.flatMap((g) => g.items);

  // Cmd+K / Ctrl+K mở bảng tìm nhanh — chuẩn thao tác của mọi SaaS hiện đại (Linear, Notion, Vercel...).
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette((v) => !v);
        setPaletteQuery("");
      }
      if (e.key === "Escape") setShowCommandPalette(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const paletteMatches = paletteQuery
    ? nav.filter((n) => n.label.toLowerCase().includes(paletteQuery.toLowerCase()))
    : nav;

  return (
    <div className={`ktns-app h-screen w-full flex overflow-hidden ${darkMode ? "dark" : ""}`}>
      <GlobalStyle />

      {darkMode && (
        <div className="ktns-aurora-layer">
          <div className="ktns-aurora-blob"></div>
          <div className="ktns-aurora-blob"></div>
          <div className="ktns-aurora-blob"></div>
          {[
            [4, 8, 0], [12, 22, 0.6], [22, 5, 1.2], [31, 35, 0.3], [40, 12, 1.8],
            [55, 28, 0.9], [63, 6, 2.1], [71, 40, 0.4], [80, 15, 1.5], [88, 32, 0.7],
            [8, 55, 1.1], [25, 62, 2.4], [45, 70, 0.2], [67, 58, 1.7], [92, 65, 0.5],
            [15, 85, 1.9], [50, 90, 0.8], [78, 88, 2.2],
          ].map(([left, top, delay], i) => (
            <span key={i} className="ktns-star" style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${delay}s` }} />
          ))}
        </div>
      )}

      <aside className="w-60 shrink-0 bg-ink text-white flex flex-col" style={{ position: "relative", zIndex: 1 }}>
        <div className="px-5 py-6 border-b border-white/10 flex items-start justify-between">
          <div>
            <div className="ktns-serif text-2xl font-bold leading-tight tracking-tight" style={{ background: "linear-gradient(135deg, #fff, var(--gold))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>DOMIX</div>
            <div className="text-[11px] text-white/60 mt-0.5">{t("sidebar_tagline")}</div>
          </div>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            title="Switch language / Đổi ngôn ngữ / 切换语言 / 言語切替 / เปลี่ยนภาษา"
            className="flex items-center gap-1 text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1 rounded-full shrink-0 mt-1 border-none text-white cursor-pointer"
          >
            <option value="vi" style={{ color: "#1B2A4A" }}>🇻🇳 Tiếng Việt</option>
            <option value="en" style={{ color: "#1B2A4A" }}>🇺🇸 English</option>
            <option value="zh" style={{ color: "#1B2A4A" }}>🇨🇳 中文</option>
            <option value="ja" style={{ color: "#1B2A4A" }}>🇯🇵 日本語</option>
            <option value="th" style={{ color: "#1B2A4A" }}>🇹🇭 ไทย</option>
          </select>
        </div>
        <div className="px-5 pb-2">
          <button onClick={() => setDarkMode((v) => !v)} className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 transition-colors text-white/70 hover:text-white text-xs">
            <span className="flex items-center gap-2">{darkMode ? <Sun size={13} /> : <Moon size={13} />} {darkMode ? "Chế độ sáng" : "Chế độ tối"}</span>
            <span className={`w-8 h-4 rounded-full relative transition-colors ${darkMode ? "bg-gold" : "bg-white/20"}`}>
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${darkMode ? "left-4" : "left-0.5"}`} />
            </span>
          </button>
        </div>
        <button onClick={() => { setShowCommandPalette(true); setPaletteQuery(""); }} className="mx-4 mt-2 mb-1 flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white text-xs">
          <span className="flex items-center gap-2"><Search size={13} /> Tìm nhanh...</span>
          <span className="ktns-mono text-[10px] border border-white/20 rounded px-1.5 py-0.5">⌘K</span>
        </button>
        <nav className="flex-1 py-3 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-1">
              <div className="px-5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/35">{group.label}</div>
              {group.items.map((n) => {
                const Icon = n.icon;
                const active = tab === n.id;
                return (
                  <button key={n.id} onClick={() => setTab(n.id)} className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm text-left transition-all duration-150 ${active ? "ktns-tab-active text-white" : "text-white/70 hover:text-white hover:bg-white/5 hover:pl-6"}`}>
                    <Icon size={16} />
                    {n.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Building2 size={13} className="text-gold shrink-0" />
            <span className="text-[11px] text-white/80 font-medium">{company.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={13} className="text-gold shrink-0" />
            <span className="text-[11px] text-white/70">{company.address}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone size={13} className="text-gold shrink-0" />
            <span className="text-[11px] text-white/70 ktns-mono">{company.phone}</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 ktns-scrollbar overflow-y-auto" style={{ position: "relative", zIndex: 1 }}>
        <div className="sticky top-0 z-10" style={{ boxShadow: "0 2px 8px rgba(20,20,15,0.05)" }}>
        <header className="bg-white border-b border-paper-line px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="ktns-serif text-xl font-bold text-ink">{nav.find((n) => n.id === tab)?.label}</h1>
            <p className="text-xs text-muted mt-0.5">{formatFullDateToday(lang)} · DOMIX · {t("header_subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={monthKey(reportYear, reportMonth)}
              onChange={(e) => { const opt = MONTH_OPTIONS.find((o) => monthKey(o.year, o.month) === e.target.value); if (opt) { setReportYear(opt.year); setReportMonth(opt.month); } }}
              className="border border-paper-line rounded-md px-2.5 py-1.5 text-xs ktns-mono bg-white"
              title={t("header_period")}
            >
              {MONTH_OPTIONS.map((o) => (<option key={monthKey(o.year, o.month)} value={monthKey(o.year, o.month)}>{monthLabelVN(o.month, o.year)}{o.year === ATT_YEAR && o.month === ATT_MONTH ? t("label_current") : ""}</option>))}
            </select>
            {!isCurrentPeriod && <span className="text-[10px] text-gold px-2 py-1 rounded-full bg-gold/10">{t("header_prev_period")}</span>}
            {warnCount > 0 && (
              <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-stamp-red/10 text-stamp-red">
                <AlertTriangle size={13} /> {warnCount} {t("kpi_perf_warn")}
              </div>
            )}
            {totals.missing > 0 && (
              <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-stamp-red/10 text-stamp-red">
                <AlertTriangle size={13} /> {totals.missing} {t("missing_invoice_tx")}
              </div>
            )}
          </div>
        </header>

        {(() => {
          // "YYYY-MM-DD HH:MM:SS" -> số phút đã trôi qua kể từ mốc đó tới thực tế bây giờ.
          const minutesSince = (stamp) => {
            if (!stamp) return Infinity;
            const [d, t] = stamp.split(" ");
            const [y, mo, da] = d.split("-").map(Number);
            const [h, mi, s] = t.split(":").map(Number);
            const then = new Date(y, mo - 1, da, h, mi, s);
            return (TODAY - then) / 60000;
          };
          const parts = [timeBasedGreeting()];
          // Thông báo công ty — chỉ chạy tối đa 10 phút kể từ lúc DUYỆT, quá giờ tự tắt khỏi ticker
          // (vẫn còn trong danh sách quản lý, chỉ là không hiện lên nữa, không cần xoá tay).
          announcements.filter((a) => a.approved && minutesSince(a.approvedAt) <= 10).forEach((a) => parts.push(`📢 ${a.text}`));
          // Cảnh báo hiệu suất — PHẢI được sếp duyệt riêng (xem nút ở Tổng quan), chạy tối đa 30
          // phút kể từ lúc duyệt rồi tự tắt, không tự động chạy ngay khi có người bị cảnh báo nữa.
          if (warnNames && warnNames.length > 0 && minutesSince(perfWarningApprovedAt) <= 30) {
            parts.push(`⚠️ Đang cảnh báo hiệu suất: ${warnNames.join(", ")}`);
          }
          const tickerText = parts.join("   •   ");
          return (
            <div className="bg-ink text-white overflow-hidden whitespace-nowrap py-1.5 border-b border-white/10">
              <div className="inline-block ktns-ticker text-xs">
                <span className="mx-8">{tickerText}</span>
                <span className="mx-8">{tickerText}</span>
              </div>
            </div>
          );
        })()}
        </div>

        <div className="p-8" key={tab} style={{ animation: "ktnsFadeIn 0.2s ease" }}>
          {tab === "dashboard" && <Dashboard totals={totals} transactions={transactions} payrollRows={payrollRows} totalPayroll={totalPayroll} activeEmployees={effectiveActiveEmployees} warnCount={warnCount} warnNames={warnNames} cashBalance={cashBalance} totalReceivable={totalReceivable} totalPayable={totalPayable} overdueDebts={overdueDebts} t={t} lang={lang} totalCharterCapitalContributed={totalCharterCapitalContributed} registeredCharterCapital={company.registeredCharterCapital} monthlyChart={monthlyChart} orders={orders} distributionOrders={distributionOrders} cvReviews={cvReviews} masterRanking={masterRanking} inventory={inventory} debts={debts} setTab={setTab} pendingDistRevenue={pendingDistRevenue} contracts={contracts} leads={leads} perfWarningApprovedAt={perfWarningApprovedAt} setPerfWarningApprovedAt={setPerfWarningApprovedAt} announcements={announcements} setAnnouncements={setAnnouncements} totalEmployerCost={totalEmployerCost} />}
          {tab === "settings" && <CaiDatCongTy company={company} setCompany={setCompany} t={t} lang={lang} exportAllData={exportAllData} importAllData={importAllData} announcements={announcements} setAnnouncements={setAnnouncements} />}
          {tab === "thuchi" && <ThuChi transactions={transactions} setTransactions={setTransactions} showForm={showTxForm} setShowForm={setShowTxForm} company={company} orders={orders} setOrders={setOrders} reportYear={reportYear} reportMonth={reportMonth} employees={activeEmployees} distributionOrders={distributionOrders} distributionPartners={distributionPartners} />}
          {tab === "congno" && <CongNo debts={debts} setDebts={setDebts} setTransactions={setTransactions} transactions={transactions} distributionOrders={distributionOrders} distributionPartners={distributionPartners} setTab={setTab} />}
          {tab === "hopdong" && <HopDong contracts={contracts} setContracts={setContracts} partners={distributionPartners} employees={activeEmployees} />}
          {tab === "vongop" && <VonGop contributions={capitalContributions} setContributions={setCapitalContributions} company={company} setCompany={setCompany} totalContributed={totalCharterCapitalContributed} />}
          {tab === "hoptac" && <HopTacPhanPhoi partners={distributionPartners} setPartners={setDistributionPartners} distOrders={distributionOrders} setDistOrders={setDistributionOrders} setTransactions={setTransactions} transactions={transactions} company={company} inventory={inventory} setInventory={setInventory} reportYear={reportYear} reportMonth={reportMonth} orders={orders} employees={activeEmployees} />}
          {tab === "kho" && <KhoHang inventory={inventory} setInventory={setInventory} orders={orders} distOrders={distributionOrders} distPartners={distributionPartners} />}
          {tab === "taisan" && <TaiSanCoDinh assets={fixedAssets} setAssets={setFixedAssets} setTransactions={setTransactions} reportYear={reportYear} reportMonth={reportMonth} />}
          {tab === "giaoviec" && <GiaoViec tasks={tasks} setTasks={setTasks} employees={activeEmployees} orders={orders} marketingLogs={marketingLogs} reportYear={reportYear} reportMonth={reportMonth} />}
          {tab === "hotro" && <HoTroKhachHang cases={supportCases} setCases={setSupportCases} employees={activeEmployees} orders={orders} setOrders={setOrders} />}
          {tab === "chat" && <ChatCongTy messages={chatMessages} setMessages={setChatMessages} employees={activeEmployees} />}
          {tab === "crm" && <DoanhThuCRM orders={orders} setOrders={setOrders} leads={leads} setLeads={setLeads} employees={activeEmployees} revenueByEmployee={revenueByEmployee} setTransactions={setTransactions} inventory={inventory} setInventory={setInventory} distPartners={distributionPartners} distOrders={distributionOrders} setDistOrders={setDistributionOrders} reportYear={reportYear} reportMonth={reportMonth} pages={marketingPages} setSupportCases={setSupportCases} />}
          {tab === "marketing" && <MarketingDaily logs={marketingLogs} setLogs={setMarketingLogs} employees={activeEmployees} marketingByEmployee={marketingByEmployee} reportYear={reportYear} reportMonth={reportMonth} pages={marketingPages} setPages={setMarketingPages} orders={orders} inventory={inventory} />}
          {tab === "nhansu" && <NhanSu employees={employees} setEmployees={setEmployees} showForm={showEmpForm} setShowForm={setShowEmpForm} reportYear={reportYear} reportMonth={reportMonth} prefillEmployee={prefillEmployee} setPrefillEmployee={setPrefillEmployee} />}
          {tab === "tuyendung" && <TuyenDungAI cvReviews={cvReviews} setCvReviews={setCvReviews} employees={activeEmployees} masterRanking={masterRanking} company={company} queue={cvQueue} setQueue={setCvQueue} processing={cvProcessing} setProcessing={setCvProcessing} progress={cvProgress} setProgress={setCvProgress} setPrefillEmployee={setPrefillEmployee} setTab={setTab} setShowEmpForm={setShowEmpForm} />}
          {tab === "chamcong" && <ChamCong employees={employees} setEmployees={setEmployees} unlockedMonths={unlockedMonths} setUnlockedMonths={setUnlockedMonths} company={company} />}
          {tab === "hieusuat" && <HieuSuat employees={effectiveActiveEmployees} masterRanking={masterRanking} supportCases={supportCases} />}
          {tab === "luong" && <BangLuong payrollRows={payrollRows} totalPayroll={totalPayroll} setEmployees={setEmployees} reportYear={reportYear} reportMonth={reportMonth} setTransactions={setTransactions} payrollPayments={payrollPayments} setPayrollPayments={setPayrollPayments} company={company} kpiTiers={kpiTiers} setKpiTiers={setKpiTiers} payrollApprovals={payrollApprovals} setPayrollApprovals={setPayrollApprovals} midMonthRequests={midMonthRequests} setMidMonthRequests={setMidMonthRequests} employees={employees} />}
          {tab === "quy" && <QuarterReport transactions={transactions} orders={orders} marketingLogs={marketingLogs} employees={employees} reportYear={reportYear} reportMonth={reportMonth} />}
          {tab === "hoachdinh" && <HoachDinhNganSach prevSnapshot={prevSnapshot} prevPeriod={prevPeriod} roleGroupStats={roleGroupStats} company={company} />}
          {tab === "ai" && <TroLyAI totals={totals} transactions={transactions} setTransactions={setTransactions} orders={orders} employees={effectiveActiveEmployees} payrollRows={payrollRows} totalPayroll={totalPayroll} totalEmployerCost={totalEmployerCost} />}
          {tab === "phaply" && <TroLyPhapLy employees={activeEmployees} setEmployees={setEmployees} company={company} />}
        </div>
      </main>

      {showCommandPalette && (
        <div className="fixed inset-0 bg-ink/50 flex items-start justify-center z-[100] pt-24 backdrop-blur-sm" onClick={() => setShowCommandPalette(false)}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-paper-line">
              <Search size={16} className="text-muted shrink-0" />
              <input
                autoFocus
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && paletteMatches[0]) { setTab(paletteMatches[0].id); setShowCommandPalette(false); } }}
                placeholder="Gõ để tìm nhanh chức năng... (VD: lương, thuế, khách hàng)"
                className="flex-1 outline-none text-sm"
              />
              <span className="ktns-mono text-[10px] text-muted border border-paper-line rounded px-1.5 py-0.5">ESC</span>
            </div>
            <div className="max-h-80 overflow-y-auto py-1">
              {paletteMatches.length === 0 && <div className="px-4 py-6 text-center text-xs text-muted">Không tìm thấy chức năng nào khớp.</div>}
              {paletteMatches.map((n, i) => {
                const Icon = n.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => { setTab(n.id); setShowCommandPalette(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-paper transition-colors ${i === 0 ? "bg-paper/60" : ""}`}
                  >
                    <Icon size={15} className="text-ink-light shrink-0" />
                    {n.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Dashboard ----------
// Ô thông báo nhanh ngay ở Tổng quan — đúng lúc vui muốn thưởng/động viên ai đó thì gõ phát là
// chạy lên ticker LUÔN, không cần qua Cài đặt công ty + bước duyệt riêng (vì đây đã là nơi sếp/kế
// toán trực tiếp thao tác — không cần tự duyệt lại chính mình). Khung "Cài đặt công ty" vẫn còn để
// dùng khi cần soạn trước rồi để người khác duyệt sau.
function QuickAnnouncementBox({ announcements, setAnnouncements }) {
  const [text, setText] = useState("");
  const [justSent, setJustSent] = useState(false);
  const QUICK_TEMPLATES = [
    "🎉 Thưởng nóng cho [Tên] vì làm tốt hôm nay — mọi người cố gắng nhé!",
    "📢 Thông báo: nghỉ lễ ngày ... — công ty nghỉ, quay lại làm việc ngày ...",
    "🔥 Doanh số tháng này đang rất tốt — cảm ơn cả nhà đã cố gắng!",
  ];
  const [blockedMsg, setBlockedMsg] = useState("");
  const send = () => {
    if (!text.trim()) return;
    const bad = containsProfanity(text);
    if (bad) { setBlockedMsg(`Nội dung chứa từ ngữ không phù hợp ("${bad}") — vui lòng sửa lại trước khi gửi. Đây là thông báo chạy cho cả công ty xem.`); return; }
    setBlockedMsg("");
    setAnnouncements((prev) => [...prev, { id: Date.now(), text: text.trim(), approved: true, approvedAt: nowStamp(), createdAt: nowStamp() }]);
    setText("");
    setJustSent(true);
    setTimeout(() => setJustSent(false), 3000);
  };
  return (
    <div className="bg-white rounded-lg border border-gold/40 p-4">
      <div className="text-xs font-semibold text-gold uppercase mb-2 flex items-center gap-1.5"><Megaphone size={14} /> Gửi thông báo nhanh — chạy ngay lên ticker (thưởng nóng, động viên, thông báo gấp...)</div>
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Nhập nội dung thông báo..." className="flex-1 border border-paper-line rounded-md px-3 py-2 text-sm" />
        <button onClick={send} className="bg-ink text-white text-sm px-4 py-2 rounded-md hover:bg-ink-light shrink-0">Gửi ngay</button>
      </div>
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <span className="text-[10px] text-muted">Mẫu nhanh:</span>
        {QUICK_TEMPLATES.map((tpl, i) => (
          <button key={i} onClick={() => setText(tpl)} className="text-[10px] text-ink-light border border-paper-line rounded-full px-2 py-0.5 hover:border-gold">{tpl.slice(0, 24)}...</button>
        ))}
      </div>
      {justSent && <p className="text-xs text-ledger-green mt-2 flex items-center gap-1"><CheckCircle2 size={12} /> Đã gửi — đang chạy trên ticker đầu trang (10 phút).</p>}
      {blockedMsg && <p className="text-xs text-stamp-red mt-2 flex items-center gap-1"><AlertTriangle size={12} /> {blockedMsg}</p>}
    </div>
  );
}

function Dashboard({ totals, transactions, payrollRows, totalPayroll, activeEmployees, warnCount, warnNames, cashBalance, totalReceivable, totalPayable, overdueDebts, t, lang, totalCharterCapitalContributed, registeredCharterCapital, monthlyChart, orders, distributionOrders, cvReviews, masterRanking, inventory, debts, setTab, pendingDistRevenue, contracts, leads, perfWarningApprovedAt, setPerfWarningApprovedAt, announcements, setAnnouncements, totalEmployerCost }) {
  const lowKpi = payrollRows.filter((r) => r.kpi < 80).length;
  const lowKpiNames = payrollRows.filter((r) => r.kpi < 80).map((r) => r.name);
  const [showLowKpiList, setShowLowKpiList] = useState(false);
  const [showWarnList, setShowWarnList] = useState(false);

  // Gom cảnh báo/việc cần xử lý từ KHẮP hệ thống về đúng 1 chỗ — đúng thứ sếp cần thấy ngay khi
  // mở app, không phải tự đi từng tab kiểm tra riêng lẻ.
  const crmPending = (orders || []).filter((o) => o.invoiceStatus !== "issued").length;
  const distPending = (distributionOrders || []).filter((o) => o.orderKind !== "purchase" && !o.partnerInvoiceReceived).length;
  const lowStockProducts = (inventory || []).filter((p) => p.stock <= p.minStock);
  const pendingCvCount = (cvReviews || []).filter((r) => r.verdict?.recommendation === "accept" || r.verdict?.recommendation === "consider").length;
  const chronicWarnCount = (masterRanking || []).filter((r) => r.category === "cho_thoi_viec").length;
  const overdueDebtList = (debts || []).filter((d) => d.status !== "paid" && new Date(d.dueDate) < TODAY);
  const expiringContracts = (contracts || []).filter((c) => c.expiryDate && Math.ceil((new Date(c.expiryDate) - TODAY) / 86400000) <= 30);
  const cashRiskCount = (transactions || []).filter((t) => t.kind === "chi" && t.paymentMethod === "tien_mat" && t.amount >= CASH_PAYMENT_DEDUCTIBLE_LIMIT).length;
  const overdueLeadsCount = (leads || []).filter((l) => l.status === "dang_cham_soc" && l.nextFollowUpDate && l.nextFollowUpDate <= TODAY_STR).length;

  const actionItems = [
    crmPending > 0 && { icon: ShoppingCart, text: `${crmPending} đơn CRM chưa xuất hóa đơn`, tab: "crm", tone: "gold" },
    distPending > 0 && { icon: Handshake, text: `${fmtVND(pendingDistRevenue)} doanh thu ròng đang chờ đối tác phân phối xác nhận (${distPending} đơn) — chưa vào Thu Chi`, tab: "hoptac", tone: "gold" },
    lowStockProducts.length > 0 && { icon: Package, text: `${lowStockProducts.length} sản phẩm sắp hết hàng trong Kho`, tab: "kho", tone: "red" },
    overdueDebtList.length > 0 && { icon: AlertTriangle, text: `${overdueDebtList.length} khoản công nợ quá hạn`, tab: "congno", tone: "red" },
    chronicWarnCount > 0 && { icon: UserX, text: `${chronicWarnCount} nhân viên cảnh báo nghỉ việc (yếu kéo dài)`, tab: "hieusuat", tone: "red" },
    pendingCvCount > 0 && { icon: UserPlus, text: `${pendingCvCount} ứng viên CV đang chờ quyết định tuyển`, tab: "tuyendung", tone: "gold" },
    expiringContracts.length > 0 && { icon: FileSignature, text: `${expiringContracts.length} hợp đồng sắp/đã hết hạn (≤30 ngày)`, tab: "hopdong", tone: "red" },
    cashRiskCount > 0 && { icon: AlertTriangle, text: `${cashRiskCount} khoản chi tiền mặt ≥5 triệu — nguy cơ không được trừ thuế TNDN`, tab: "thuchi", tone: "red" },
    overdueLeadsCount > 0 && { icon: Phone, text: `${overdueLeadsCount} khách tiềm năng đến hẹn/quá hẹn gọi lại hôm nay`, tab: "crm", tone: "red" },
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <QuickAnnouncementBox announcements={announcements} setAnnouncements={setAnnouncements} />

      {warnNames && warnNames.length > 0 && (() => {
        const minutesSince = (stamp) => {
          if (!stamp) return Infinity;
          const [d, t] = stamp.split(" ");
          const [y, mo, da] = d.split("-").map(Number);
          const [h, mi, s] = t.split(":").map(Number);
          return (TODAY - new Date(y, mo - 1, da, h, mi, s)) / 60000;
        };
        const isLive = minutesSince(perfWarningApprovedAt) <= 30;
        return (
          <div className={`rounded-lg border p-3 flex items-center justify-between gap-3 flex-wrap ${isLive ? "border-ledger-green/40 bg-ledger-green/5" : "border-gold/40 bg-gold/5"}`}>
            <span className="text-xs text-charcoal flex items-center gap-1.5">
              <Megaphone size={14} className={isLive ? "text-ledger-green" : "text-gold"} />
              {isLive
                ? `Đang chạy trên ticker: cảnh báo hiệu suất của ${warnNames.length} nhân viên (còn ${Math.max(0, Math.ceil(30 - minutesSince(perfWarningApprovedAt)))} phút).`
                : `${warnNames.length} nhân viên đang bị cảnh báo hiệu suất — chưa hiện lên ticker đầu trang, cần sếp duyệt.`}
            </span>
            <button onClick={() => setPerfWarningApprovedAt(nowStamp())} className={`text-xs px-3 py-1.5 rounded-md shrink-0 ${isLive ? "border border-paper-line text-muted" : "bg-ink text-white"}`}>
              {isLive ? "Duyệt lại (chạy thêm 30 phút)" : "Duyệt hiển thị lên ticker (30 phút)"}
            </button>
          </div>
        );
      })()}

      {actionItems.length > 0 && (
        <div className="bg-white rounded-lg border border-stamp-red/30 overflow-hidden">
          <div className="px-4 py-2.5 bg-stamp-red/5 text-xs font-semibold text-stamp-red uppercase flex items-center gap-1.5"><AlertTriangle size={13} /> Cần xử lý ({actionItems.length}) — gom từ khắp hệ thống</div>
          <div className="divide-y divide-paper-line">
            {actionItems.map((item, i) => (
              <button key={i} onClick={() => setTab && setTab(item.tab)} className="w-full text-left px-4 py-2.5 flex items-center gap-2 text-sm hover:bg-paper/60">
                <item.icon size={14} className={item.tone === "red" ? "text-stamp-red" : "text-gold"} />
                <span className="text-charcoal">{item.text}</span>
                <ChevronRight size={13} className="text-muted ml-auto" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <KpiCard icon={Wallet} label={t("kpi_cash")} value={fmtVND(cashBalance)} tone={cashBalance >= 0 ? "up" : "down"} sub={t("kpi_cash_sub_capital")} />
        <KpiCard icon={TrendingUp} label={t("kpi_thu")} value={fmtVND(totals.thu)} tone="up" />
        <KpiCard icon={TrendingDown} label={t("kpi_chi")} value={fmtVND(totals.chi)} tone="down" />
        <KpiCard icon={Gauge} label={t("kpi_perf_warn")} value={warnCount} tone={warnCount > 0 ? "down" : "up"} sub={`${activeEmployees.length} ${t("employees_tracked")}`} />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard icon={Wallet} label={t("kpi_profit")} value={fmtVND(totals.profit - totalEmployerCost)} tone={totals.profit - totalEmployerCost >= 0 ? "up" : "down"} sub={t("kpi_profit_sub")} />
        <KpiCard icon={CreditCard} label={t("kpi_receivable")} value={fmtVND(totalReceivable)} tone="up" sub={t("kpi_receivable_sub")} />
        <KpiCard icon={CreditCard} label={t("kpi_payable")} value={fmtVND(totalPayable)} tone="down" sub={t("kpi_payable_sub")} />
        <KpiCard icon={AlertTriangle} label={t("kpi_overdue")} value={overdueDebts} tone={overdueDebts > 0 ? "down" : "up"} sub={t("kpi_overdue_sub")} />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard icon={Coins} label={t("charter_capital_contributed")} value={fmtVND(totalCharterCapitalContributed || 0)} tone="up" sub={registeredCharterCapital > 0 ? `${t("of_registered")} ${fmtVND(registeredCharterCapital)}` : t("see_capital_tab")} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-white rounded-lg border border-paper-line p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="ktns-serif font-semibold text-ink">{t("chart_title")}</h3>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "var(--ledger-green)" }} />{t("income_label")}</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "var(--stamp-red)" }} />{t("expense_label")}</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 rounded-sm inline-block" style={{ background: "var(--gold)" }} />Lợi nhuận ròng</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={monthlyChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="thuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--ledger-green)" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="var(--ledger-green)" stopOpacity={0.55} />
                </linearGradient>
                <linearGradient id="chiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--stamp-red)" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="var(--stamp-red)" stopOpacity={0.55} />
                </linearGradient>
                <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--gold)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--paper-line)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--muted)" }} axisLine={{ stroke: "var(--paper-line)" }} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v, name) => [`${v} ${t("million_vnd")}`, name]}
                contentStyle={{ background: "var(--ink)", border: "none", borderRadius: 8, color: "#fff" }}
                labelStyle={{ color: "#fff", fontWeight: 600 }}
                itemStyle={{ color: "#fff" }}
              />
              <Area type="monotone" dataKey="net" name="Lợi nhuận ròng" stroke="none" fill="url(#netGrad)" />
              <Bar dataKey="thu" name={t("income_label")} fill="url(#thuGrad)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="chi" name={t("expense_label")} fill="url(#chiGrad)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Line type="monotone" dataKey="net" name="Lợi nhuận ròng" stroke="var(--gold)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--gold)", strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-lg border border-paper-line p-5 flex flex-col gap-3">
          <h3 className="ktns-serif font-semibold text-ink">{t("payroll_link_title")}</h3>
          <div className="text-xs text-muted">{t("payroll_link_sub")}</div>
          <div className="ktns-mono text-lg font-semibold text-ink">{fmtVND(totalPayroll)}</div>
          <div className="flex flex-col gap-1 text-xs">
            {lowKpi > 0 && (
              <div>
                <button onClick={() => setShowLowKpiList((v) => !v)} className="text-stamp-red flex items-center gap-1.5 hover:underline">
                  <AlertTriangle size={12} /> {lowKpi} {t("low_kpi_employees")} <ChevronRight size={11} className={`transition-transform ${showLowKpiList ? "rotate-90" : ""}`} />
                </button>
                {showLowKpiList && <div className="pl-5 pt-1 text-[11px] text-ink-light">{lowKpiNames.join(", ")}</div>}
              </div>
            )}
            {warnCount > 0 && (
              <div>
                <button onClick={() => setShowWarnList((v) => !v)} className="text-stamp-red flex items-center gap-1.5 hover:underline">
                  <Gauge size={12} /> {warnCount} {t("warn_perf_employees")} <ChevronRight size={11} className={`transition-transform ${showWarnList ? "rotate-90" : ""}`} />
                </button>
                {showWarnList && <div className="pl-5 pt-1 text-[11px] text-ink-light">{(warnNames || []).join(", ")}</div>}
              </div>
            )}
          </div>
          <LinkChip>{t("see_details_perf_payroll")}</LinkChip>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-paper-line ktns-ledger-lines">
        <h3 className="ktns-serif font-semibold text-ink px-5 pt-4 pb-2">{t("recent_tx")}</h3>
        <div className="px-5 pb-4">
          {transactions.slice(-5).reverse().map((tx) => (
            <div key={tx.id} className="flex items-center justify-between py-1.5 text-sm">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted ktns-mono w-20">{tx.date}</span>
                <span>{tx.desc}</span>
                {tx.invoiceType === "Chưa xác định" && <span className="text-[10px] text-stamp-red flex items-center gap-1"><AlertTriangle size={10} /> thiếu hóa đơn</span>}
              </div>
              <span className="ktns-mono font-medium" style={{ color: tx.kind === "thu" ? "var(--ledger-green)" : "var(--stamp-red)" }}>{tx.kind === "thu" ? "+" : "-"}{fmtVND(tx.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Cài đặt công ty ----------
// ---------- Thông báo công ty chạy ticker đầu trang — PHẢI DUYỆT mới hiển thị ----------
// Tránh ai cũng gõ gì cũng chạy lên đầu trang toàn công ty thấy — phải qua bước duyệt riêng.
function AnnouncementPanel({ announcements, setAnnouncements }) {
  const [draftText, setDraftText] = useState("");
  const [blockedMsg, setBlockedMsg] = useState("");
  const addDraft = () => {
    if (!draftText.trim()) return;
    const bad = containsProfanity(draftText);
    if (bad) { setBlockedMsg(`Nội dung chứa từ ngữ không phù hợp ("${bad}") — vui lòng sửa lại trước khi thêm.`); return; }
    setBlockedMsg("");
    setAnnouncements((prev) => [...prev, { id: Date.now(), text: draftText.trim(), approved: false, createdAt: nowStamp() }]);
    setDraftText("");
  };
  const toggleApprove = (id) => setAnnouncements((prev) => prev.map((a) => (a.id === id ? { ...a, approved: !a.approved, approvedAt: !a.approved ? nowStamp() : a.approvedAt } : a)));
  const removeAnnouncement = (id) => setAnnouncements((prev) => prev.filter((a) => a.id !== id));

  return (
    <div className="bg-white rounded-lg border border-paper-line p-5">
      <h3 className="ktns-serif font-semibold text-ink mb-1 flex items-center gap-2"><Megaphone size={16} /> Thông báo chạy chữ đầu trang</h3>
      <p className="text-xs text-muted mb-3">Ticker đầu trang tự chạy lời chào theo giờ (sáng/trưa/chiều/tối) + tên nhân viên đang bị cảnh báo hiệu suất. Muốn thêm thông báo riêng của công ty (nghỉ lễ, họp, thông báo gấp...) thì gõ ở đây — <strong className="text-charcoal">phải bấm "Duyệt hiển thị" mới thật sự chạy lên ticker</strong>, gõ xong chưa duyệt sẽ nằm ở trạng thái nháp, chưa ai thấy.</p>
      <div className="flex gap-2 mb-3">
        <input value={draftText} onChange={(e) => setDraftText(e.target.value)} placeholder="VD: Nghỉ lễ 2/9 cả công ty, họp toàn công ty 15h thứ 6..." className="flex-1 border border-paper-line rounded px-2.5 py-1.5 text-sm" />
        <button onClick={addDraft} className="text-sm bg-ink text-white px-3.5 py-1.5 rounded-md hover:bg-ink-light flex items-center gap-1"><Plus size={14} /> Thêm nháp</button>
      </div>
      {blockedMsg && <p className="text-xs text-stamp-red mb-3 flex items-center gap-1"><AlertTriangle size={12} /> {blockedMsg}</p>}
      {announcements.length === 0 ? (
        <p className="text-xs text-muted">Chưa có thông báo nào.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {announcements.slice().reverse().map((a) => (
            <div key={a.id} className={`flex items-center gap-2 px-3 py-2 rounded-md border ${a.approved ? "border-ledger-green/40 bg-ledger-green/5" : "border-paper-line bg-paper/60"}`}>
              <span className="flex-1 text-sm text-charcoal">{a.text}</span>
              <span className="text-[10px] text-muted ktns-mono">{a.createdAt}</span>
              <button onClick={() => toggleApprove(a.id)} className={`text-[11px] px-2.5 py-1 rounded-md ${a.approved ? "bg-ledger-green text-white" : "border border-gold text-gold"}`}>
                {a.approved ? "Đã duyệt — đang chạy" : "Duyệt hiển thị"}
              </button>
              <button onClick={() => removeAnnouncement(a.id)} className="text-muted hover:text-stamp-red"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CaiDatCongTy({ company, setCompany, t, lang, exportAllData, importAllData, announcements, setAnnouncements }) {
  const [form, setForm] = useState(company);
  const [saved, setSaved] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [importErr, setImportErr] = useState("");
  const fileInputRef = useRef(null);

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg(""); setImportErr("");
    const reader = new FileReader();
    reader.onload = () => {
      const result = importAllData(reader.result);
      if (result.ok) {
        setImportMsg(`Đã nạp lại dữ liệu thành công${result.exportedAt ? " — file xuất lúc " + new Date(result.exportedAt).toLocaleString("vi-VN") : ""}. Bấm qua tab khác để xem dữ liệu đã về.`);
      } else {
        setImportErr(`Không đọc được file — kiểm tra lại đúng file đã xuất từ DOMIX chưa. Lỗi: ${result.error}`);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const save = () => {
    setCompany(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const fields = [
    { key: "name", label: t("company_name"), required: true },
    { key: "address", label: t("company_address") },
    { key: "phone", label: t("company_phone"), mono: true },
    { key: "email", label: t("company_email") },
    { key: "taxCode", label: t("company_tax"), mono: true },
    { key: "representative", label: t("company_rep") },
    { key: "directorPassword", label: t("director_password_label"), mono: true },
  ];

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="bg-white rounded-lg border border-stamp-red/40 p-5">
        <h3 className="ktns-serif font-semibold text-stamp-red mb-1 flex items-center gap-2"><AlertTriangle size={16} /> Sao lưu &amp; Phục hồi dữ liệu — QUAN TRỌNG</h3>
        <p className="text-xs text-muted mb-3">App này chạy trong trình duyệt, <strong className="text-charcoal">không có server lưu trữ thật</strong> — tải lại trang, đóng tab, hay mở app trên máy khác sẽ <strong className="text-stamp-red">mất toàn bộ dữ liệu</strong> đã nhập. Trước khi đóng tab, luôn bấm "Tải file sao lưu" để lưu lại; lần sau mở app, nạp lại đúng file đó để có lại dữ liệu.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={exportAllData} className="flex items-center gap-1.5 text-sm bg-ink text-white px-4 py-2 rounded-md hover:bg-ink-light">
            <Download size={15} /> Tải file sao lưu toàn bộ dữ liệu
          </button>
          <label className="flex items-center gap-1.5 text-sm border border-paper-line px-4 py-2 rounded-md text-ink hover:border-ink cursor-pointer">
            <FileUp size={15} /> Nạp lại từ file sao lưu
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          </label>
        </div>
        {importMsg && <p className="text-xs text-ledger-green mt-2 flex items-center gap-1.5"><CheckCircle2 size={13} /> {importMsg}</p>}
        {importErr && <p className="text-xs text-stamp-red mt-2 flex items-center gap-1.5"><AlertTriangle size={13} /> {importErr}</p>}
        <p className="text-[10px] text-muted mt-2">* Nạp file sẽ THAY THẾ toàn bộ dữ liệu hiện tại bằng dữ liệu trong file — sao lưu dữ liệu hiện tại trước nếu chưa chắc chắn.</p>
      </div>

      <AnnouncementPanel announcements={announcements} setAnnouncements={setAnnouncements} />

      <div className="bg-white rounded-lg border border-paper-line p-3 text-xs text-muted flex items-start gap-2">
        <Link2 size={13} className="text-ink-light shrink-0 mt-0.5" />
        <span>{t("company_note")}</span>
      </div>

      <div className="bg-white rounded-lg border border-paper-line p-5">
        <h3 className="ktns-serif font-semibold text-ink mb-4 flex items-center gap-2"><Building2 size={16} /> {t("company_settings_title")}</h3>
        <div className="grid grid-cols-2 gap-4">
          {fields.map((f) => (
            <label key={f.key} className={`text-xs text-muted flex flex-col gap-1 ${f.key === "name" || f.key === "address" ? "col-span-2" : ""}`}>
              {f.label}{f.required && <span className="text-stamp-red"> *</span>}
              <input
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                className={`border border-paper-line rounded px-2.5 py-2 text-sm ${f.mono ? "ktns-mono" : ""}`}
              />
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-5">
          <button onClick={save} className="bg-ledger-green text-white text-sm px-4 py-2 rounded-md hover:opacity-90 flex items-center gap-1.5">
            <CheckCircle2 size={14} /> {t("btn_save")}
          </button>
          {saved && <span className="text-xs text-ledger-green flex items-center gap-1"><CheckCircle2 size={12} /> {t("saved_label")}</span>}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-paper-line p-4">
        <div className="text-xs font-semibold text-ink uppercase mb-2">{t("preview_label")}</div>
        <div className="bg-ink rounded-md p-4 flex flex-col gap-2 max-w-xs">
          <div className="flex items-center gap-2"><Building2 size={13} className="text-gold" /><span className="text-[11px] text-white/80 font-medium">{form.name || "—"}</span></div>
          <div className="flex items-center gap-2"><MapPin size={13} className="text-gold" /><span className="text-[11px] text-white/70">{form.address || "—"}</span></div>
          <div className="flex items-center gap-2"><Phone size={13} className="text-gold" /><span className="text-[11px] text-white/70 ktns-mono">{form.phone || "—"}</span></div>
        </div>
      </div>
    </div>
  );
}

// ---------- Thu Chi ----------
function ThuChi({ transactions, setTransactions, showForm, setShowForm, company, orders, setOrders, reportYear, reportMonth, employees, distributionOrders, distributionPartners }) {
  const blankTx = { date: TODAY_STR, kind: "chi", category: "", desc: "", amount: "", partnerName: "", partnerTaxCode: "", partnerPhone: "", partnerEmail: "", paymentMethod: "chuyen_khoan", invoiceType: "Chưa xác định", invoiceNo: "", vatRate: 8, attachmentData: "", attachmentName: "", attachmentType: "" };
  const [form, setForm] = useState(blankTx);
  const [editingId, setEditingId] = useState(null);
  const [viewAttachment, setViewAttachment] = useState(null);
  const [rangeFrom, setRangeFrom] = useState(new Date(reportYear || TODAY.getFullYear(), (reportMonth || TODAY.getMonth() + 1) - 1, 1).toISOString().slice(0, 10));
  const [rangeTo, setRangeTo] = useState(new Date(reportYear || TODAY.getFullYear(), (reportMonth || TODAY.getMonth() + 1), 0).toISOString().slice(0, 10));
  // Đổi kỳ báo cáo ở đầu trang thì khoảng ngày ở đây TỰ ĐỘNG đổi theo — trước đây 2 cái tách rời
  // nhau hoàn toàn, chọn tháng khác ở trên mà Thu Chi vẫn đứng yên hiển thị tháng cũ.
  const [rangeMode, setRangeMode] = useState("month"); // month | custom | all
  useEffect(() => {
    if (!reportYear || !reportMonth || rangeMode === "custom") return;
    setRangeFrom(new Date(reportYear, reportMonth - 1, 1).toISOString().slice(0, 10));
    setRangeTo(new Date(reportYear, reportMonth, 0).toISOString().slice(0, 10));
  }, [reportYear, reportMonth, rangeMode]);
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [filterKind, setFilterKind] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [showVatDetail, setShowVatDetail] = useState(false);
  const [expandedTxId, setExpandedTxId] = useState(null);
  const inRange = (t) => t.date >= rangeFrom && t.date <= rangeTo;
  const vatOutput = transactions.filter((t) => t.kind === "thu" && VAT_INVOICE_TYPES.includes(t.invoiceType) && inRange(t)).reduce((a, t) => a + splitVAT(t.amount, t.vatRate || 0).vatAmount, 0);
  const vatInput = transactions.filter((t) => t.kind === "chi" && VAT_INVOICE_TYPES.includes(t.invoiceType) && inRange(t)).reduce((a, t) => a + splitVAT(t.amount, t.vatRate || 0).vatAmount, 0);
  const vatPayable = vatOutput - vatInput;
  const printRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, attachmentData: reader.result, attachmentName: file.name, attachmentType: file.type }));
    reader.readAsDataURL(file);
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(blankTx); if (fileInputRef.current) fileInputRef.current.value = ""; };
  const startEditTx = (t) => {
    setEditingId(t.id);
    setForm({
      date: t.date, kind: t.kind, category: t.category || "", desc: t.desc, amount: String(t.amount),
      partnerName: t.partnerName || "", partnerTaxCode: t.partnerTaxCode || "", partnerPhone: t.partnerPhone || "", partnerEmail: t.partnerEmail || "", paymentMethod: t.paymentMethod || "chuyen_khoan",
      invoiceType: t.invoiceType, invoiceNo: t.invoiceNo || "", vatRate: t.vatRate ?? 8,
      attachmentData: t.attachmentData || "", attachmentName: t.attachmentName || "", attachmentType: t.attachmentType || "",
    });
    setShowForm(true);
  };
  const addTx = () => {
    if (!form.desc || !form.amount) return;
    if (editingId) {
      setTransactions((prev) => prev.map((t) => (t.id === editingId ? { ...t, ...form, amount: Number(form.amount) } : t)));
      // Giao dịch đến từ CRM (Sale/Upsale) — kế toán xử lý hoá đơn xong tại đây thì trả kết quả
      // ngược lại đúng đơn hàng bên tab Doanh thu CRM, để Sale thấy ngay đã xuất hay chưa.
      const tx = transactions.find((t) => t.id === editingId);
      if (tx?.source === "crm" && tx.sourceOrderId && setOrders) {
        const issued = form.invoiceType !== "Chưa xác định" && !!form.attachmentData;
        setOrders((prev) => prev.map((o) => (o.id === tx.sourceOrderId ? {
          ...o, invoiceStatus: issued ? "issued" : "pending", invoiceType: form.invoiceType, invoiceNo: form.invoiceNo,
          invoiceDate: issued ? nowStamp() : o.invoiceDate, vatRate: form.vatRate,
          invoiceAttachmentData: form.attachmentData, invoiceAttachmentName: form.attachmentName, invoiceAttachmentType: form.attachmentType,
        } : o)));
      }
    } else {
      setTransactions((prev) => [...prev, { ...form, id: Date.now(), amount: Number(form.amount), status: "pending" }]);
    }
    closeForm();
  };
  const [blockedMsg, setBlockedMsg] = useState("");
  const AUTO_SOURCE_LABELS = { bangluong: "Bảng lương", hoptac: "Hợp tác phân phối", hoptac_muahang: "Hợp tác phân phối (nhập hàng)", congno: "Công nợ" };
  const removeTx = (id) => {
    const tx = transactions.find((t) => t.id === id);
    if (tx?.source === "crm" && tx.sourceOrderId && setOrders) {
      setOrders((prev) => prev.map((o) => (o.id === tx.sourceOrderId ? { ...o, invoiceStatus: "pending", invoiceNo: "", invoiceAttachmentData: "", invoiceAttachmentName: "", linkedTxId: null } : o)));
    } else if (tx?.source && AUTO_SOURCE_LABELS[tx.source]) {
      // Các nguồn này (Lương, Hợp tác phân phối) chưa có đường đồng bộ ngược ở đây — chặn xoá
      // trực tiếp tại Thu Chi để tránh lệch dữ liệu, phải huỷ đúng ở tab gốc.
      setBlockedMsg(`Giao dịch này tự động sinh ra từ tab "${AUTO_SOURCE_LABELS[tx.source]}" — vui lòng huỷ/sửa đúng ở tab đó để dữ liệu 2 bên luôn khớp nhau, không xoá trực tiếp ở đây.`);
      setTimeout(() => setBlockedMsg(""), 5000);
      return;
    }
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };
  const filteredTransactions = transactions.filter((t) => {
    // Có gõ tìm kiếm thì bỏ qua giới hạn kỳ — tìm xuyên suốt mọi tháng, vì khách/kế toán chỉ nhớ
    // SĐT/email chứ không nhớ đúng giao dịch đó thuộc tháng nào.
    if (!searchText && rangeMode !== "all" && !inRange(t)) return false;
    if (filterKind !== "all" && t.kind !== filterKind) return false;
    if (filterStatus === "missing" && t.invoiceType !== "Chưa xác định") return false;
    if (filterStatus === "ok" && t.invoiceType === "Chưa xác định") return false;
    if (searchText && !`${t.desc} ${t.category} ${t.partnerName || ""} ${t.partnerPhone || ""} ${t.partnerEmail || ""} ${t.partnerTaxCode || ""}`.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });
  const sumThu = filteredTransactions.filter((t) => t.kind === "thu").reduce((a, t) => a + t.amount, 0);
  const sumChi = filteredTransactions.filter((t) => t.kind === "chi").reduce((a, t) => a + t.amount, 0);
  const missingCount = filteredTransactions.filter((t) => t.invoiceType === "Chưa xác định").length;
  const categoryBreakdown = Object.values(filteredTransactions.reduce((acc, t) => {
    const key = t.category || "(Chưa phân loại)";
    acc[key] = acc[key] || { category: key, thu: 0, chi: 0 };
    acc[key][t.kind] += t.amount;
    return acc;
  }, {})).sort((a, b) => (b.thu + b.chi) - (a.thu + a.chi));
  const editingTx = editingId ? transactions.find((t) => t.id === editingId) : null;
  const isCrmLocked = editingTx?.source === "crm";

  const buildInvoiceStatementHtml = () => {
    const rows = transactions
      .filter((t) => t.date >= rangeFrom && t.date <= rangeTo)
      .sort((a, b) => a.date.localeCompare(b.date));
    const totalThu = rows.filter((t) => t.kind === "thu").reduce((a, t) => a + t.amount, 0);
    const totalChi = rows.filter((t) => t.kind === "chi").reduce((a, t) => a + t.amount, 0);
    return { rows, totalThu, totalChi, html: `
      <div style="font-family: 'Noto Serif', serif; font-size: 12pt;">
        <h2 style="text-align:center; margin-bottom:2px;">${company?.name || "DOMIX"}</h2>
        <p style="text-align:center; margin-top:0; font-size:10pt;">${company?.address || ""}${company?.taxCode ? " — MST: " + company.taxCode : ""}</p>
        <h3 style="text-align:center;">BẢNG KÊ CHI TIẾT HÓA ĐƠN THU CHI</h3>
        <p style="text-align:center; font-size:10pt;">Từ ngày ${rangeFrom.split("-").reverse().join("/")} đến ngày ${rangeTo.split("-").reverse().join("/")}</p>
        <table style="width:100%; border-collapse: collapse; font-size: 10pt; margin-top:12px;">
          <thead>
            <tr style="border-bottom: 2px solid #000;">
              <th style="text-align:left; padding:4px;">Ngày</th><th style="text-align:left; padding:4px;">Mô tả</th>
              <th style="text-align:left; padding:4px;">Đối tác</th><th style="text-align:left; padding:4px;">Danh mục</th><th style="text-align:right; padding:4px;">Số tiền</th>
              <th style="text-align:left; padding:4px;">Loại hóa đơn</th><th style="text-align:left; padding:4px;">Số HĐ</th>
              <th style="text-align:left; padding:4px;">Đính kèm</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length === 0 ? `<tr><td colspan="8" style="padding:12px; text-align:center; color:#888;">Không có giao dịch nào trong khoảng ngày đã chọn.</td></tr>` : rows.map((t) => `
              <tr style="border-bottom: 1px solid #ccc;">
                <td style="padding:4px;">${t.date.split("-").reverse().join("/")}</td>
                <td style="padding:4px;">${t.desc}</td>
                <td style="padding:4px;">${t.partnerName || "—"}${t.partnerTaxCode ? " (MST " + t.partnerTaxCode + ")" : ""}</td>
                <td style="padding:4px;">${t.category || "—"}</td>
                <td style="padding:4px; text-align:right;">${t.kind === "thu" ? "+" : "-"}${t.amount.toLocaleString("vi-VN")}đ</td>
                <td style="padding:4px;">${t.invoiceType}</td>
                <td style="padding:4px;">${t.invoiceNo || "—"}</td>
                <td style="padding:4px;">${t.attachmentName ? "Có" : "Không"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <p style="margin-top:10px; font-size:10pt;"><strong>Tổng thu:</strong> ${totalThu.toLocaleString("vi-VN")}đ &nbsp;&nbsp; <strong>Tổng chi:</strong> ${totalChi.toLocaleString("vi-VN")}đ &nbsp;&nbsp; <strong>Số giao dịch:</strong> ${rows.length}</p>
        <div style="margin-top:24px; page-break-inside: avoid;">
          ${rows.filter((t) => t.attachmentData && t.attachmentType?.startsWith("image/")).map((t) => `
            <div style="page-break-before: always; text-align:center; padding-top:20px;">
              <p style="font-size:10pt;"><strong>${t.date.split("-").reverse().join("/")} — ${t.desc}</strong> (${t.invoiceType}${t.invoiceNo ? " #" + t.invoiceNo : ""})</p>
              <img src="${t.attachmentData}" style="max-width:100%; max-height:80vh; margin-top:8px;" />
            </div>
          `).join("")}
        </div>
      </div>
    ` };
  };
  const printInvoicesInRange = () => {
    const { html } = buildInvoiceStatementHtml();
    if (printRef.current) printRef.current.innerHTML = html;
    window.print();
  };
  // Dự phòng chắc chắn hoạt động — window.print() có thể bị chặn trong khung xem trước của Claude
  // (giống window.prompt/alert trước đây), nên tải hẳn 1 file HTML để mở bằng trình duyệt thật rồi in.
  const downloadInvoiceStatement = () => {
    const { html } = buildInvoiceStatementHtml();
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bảng kê hóa đơn ${rangeFrom} - ${rangeTo}</title></head><body>${html}</body></html>`;
    const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `DOMIX_Bang_ke_hoa_don_${rangeFrom}_${rangeTo}.html`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      <div ref={printRef} className="ktns-print-area"></div>

      {blockedMsg && (
        <div className="bg-stamp-red/10 border border-stamp-red text-stamp-red text-xs rounded-md px-3 py-2 flex items-center gap-2">
          <AlertTriangle size={13} /> {blockedMsg}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <KpiCard icon={TrendingUp} label="Tổng thu (đang lọc)" value={fmtVND(sumThu)} tone="up" />
        <KpiCard icon={TrendingDown} label="Tổng chi (đang lọc)" value={fmtVND(sumChi)} tone="down" />
        <KpiCard icon={Wallet} label="Chênh lệch" value={fmtVND(sumThu - sumChi)} tone={sumThu - sumChi >= 0 ? "up" : "down"} />
        <KpiCard icon={AlertTriangle} label="Chờ bổ sung hóa đơn" value={missingCount} tone={missingCount > 0 ? "down" : "up"} />
      </div>

      <div className="flex justify-between items-center flex-wrap gap-2">
        <p className="text-sm text-muted">Mỗi khoản thu chi đều yêu cầu khai báo <strong>loại hóa đơn</strong> tương ứng để đảm bảo hợp lệ hóa chứng từ.</p>
        <button onClick={() => { setForm(blankTx); setEditingId(null); setShowForm(true); }} className="flex items-center gap-1.5 text-sm bg-ink text-white px-3.5 py-2 rounded-md hover:bg-ink-light"><Plus size={15} /> Thêm giao dịch</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-paper-line p-5 relative">
          <button className="absolute top-3 right-3 text-muted" onClick={closeForm}><X size={16} /></button>
          <h3 className="ktns-serif font-semibold text-ink mb-2">{isCrmLocked ? "Xử lý hoá đơn cho đơn từ CRM" : editingId ? "Sửa giao dịch" : "Giao dịch mới"}</h3>
          {isCrmLocked && (
            <div className="mb-3 text-xs text-ink-light bg-paper rounded px-2.5 py-2 flex items-start gap-1.5">
              <Link2 size={12} className="mt-0.5 shrink-0" />
              <span>
                Đơn này đến từ CRM — thông tin khách hàng/số tiền do Sale sở hữu nên khoá lại, bạn chỉ cần điền phần hoá đơn. Lưu xong sẽ tự trả kết quả về đúng đơn bên tab Doanh thu CRM.
                {(form.partnerPhone || form.partnerEmail) && (
                  <div className="mt-1 text-charcoal ktns-mono">📞 {form.partnerPhone || "—"} {form.partnerEmail && `· ✉️ ${form.partnerEmail}`}</div>
                )}
              </span>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <label className="text-xs text-muted flex flex-col gap-1">Ngày<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} disabled={isCrmLocked} className="border border-paper-line rounded px-2 py-1.5 text-sm disabled:bg-paper disabled:text-muted" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Loại<select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} disabled={isCrmLocked} className="border border-paper-line rounded px-2 py-1.5 text-sm disabled:bg-paper disabled:text-muted"><option value="thu">Thu</option><option value="chi">Chi</option></select></label>
            <label className="text-xs text-muted flex flex-col gap-1">Danh mục<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} disabled={isCrmLocked} placeholder="VD: Bán hàng, Thuê mặt bằng..." className="border border-paper-line rounded px-2 py-1.5 text-sm disabled:bg-paper disabled:text-muted" /></label>
            {!isCrmLocked && form.kind === "chi" && (
              <div className="col-span-3 flex flex-wrap gap-1.5 -mt-1">
                <span className="text-[10px] text-muted mt-1">Chi phí hay có VAT:</span>
                {["Thuê văn phòng/mặt bằng", "Mua sắm thiết bị/văn phòng phẩm", "Ăn uống tiếp khách", "Dịch vụ/phần mềm", "Điện nước/internet", "Đi lại/vận chuyển"].map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, category: c, invoiceType: "Hóa đơn GTGT (VAT)" })} className="text-[10px] border border-paper-line rounded-full px-2 py-0.5 text-ink-light hover:border-ink hover:text-ink">{c}</button>
                ))}
              </div>
            )}
            <label className="text-xs text-muted flex flex-col gap-1 col-span-3">Mô tả<input value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} disabled={isCrmLocked} placeholder="Nội dung giao dịch" className="border border-paper-line rounded px-2 py-1.5 text-sm disabled:bg-paper disabled:text-muted" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">{form.kind === "thu" ? "Tên khách hàng" : "Tên nhà cung cấp"}<input value={form.partnerName} onChange={(e) => setForm({ ...form, partnerName: e.target.value })} disabled={isCrmLocked} placeholder="Tên đối tác giao dịch" className="border border-paper-line rounded px-2 py-1.5 text-sm disabled:bg-paper disabled:text-muted" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">MST đối tác (nếu có)<input value={form.partnerTaxCode} onChange={(e) => setForm({ ...form, partnerTaxCode: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Hình thức thanh toán<select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm"><option value="tien_mat">Tiền mặt (TM)</option><option value="chuyen_khoan">Chuyển khoản (CK)</option></select></label>
            <label className="text-xs text-muted flex flex-col gap-1">Số tiền (đ)<MoneyInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} disabled={isCrmLocked} /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Loại hóa đơn <span className="text-stamp-red">*</span><select value={form.invoiceType} onChange={(e) => setForm({ ...form, invoiceType: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm">{INVOICE_TYPES.map((it) => (<option key={it}>{it}</option>))}</select></label>
            <label className="text-xs text-muted flex flex-col gap-1">Số hóa đơn<input value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} disabled={form.invoiceType.startsWith("Không cần") || form.invoiceType === "Chưa xác định"} className="border border-paper-line rounded px-2 py-1.5 text-sm disabled:bg-paper ktns-mono" /></label>
            {VAT_INVOICE_TYPES.includes(form.invoiceType) && (
              <label className="text-xs text-muted flex flex-col gap-1">Thuế suất VAT
                <select value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: Number(e.target.value) })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono">
                  {VAT_RATE_OPTIONS.map((r) => (<option key={r} value={r}>{r}%</option>))}
                </select>
              </label>
            )}
            <label className="text-xs text-muted flex flex-col gap-1 col-span-3">Đính kèm ảnh/file hóa đơn (jpg, png, pdf)
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFileChange} className="border border-paper-line rounded px-2 py-1.5 text-sm bg-white" />
              {form.attachmentName && <span className="text-[11px] text-ledger-green flex items-center gap-1 mt-1"><CheckCircle2 size={11} /> Đã đính kèm: {form.attachmentName}</span>}
            </label>
          </div>
          {VAT_INVOICE_TYPES.includes(form.invoiceType) && form.amount && (
            <div className="mt-2 text-xs text-ink-light bg-paper rounded px-2.5 py-2 flex gap-4">
              <span>Tiền hàng (trước thuế): <strong className="ktns-mono">{fmtVND(splitVAT(Number(form.amount), form.vatRate).beforeTax)}</strong></span>
              <span>Thuế VAT ({form.vatRate}%): <strong className="ktns-mono text-stamp-red">{fmtVND(splitVAT(Number(form.amount), form.vatRate).vatAmount)}</strong></span>
            </div>
          )}
          {form.invoiceType === "Chưa xác định" && <div className="mt-3 text-xs text-stamp-red flex items-center gap-1.5"><AlertTriangle size={13} /> Giao dịch sẽ được đánh dấu "chờ bổ sung hóa đơn" cho đến khi cập nhật loại hóa đơn.</div>}
          <button onClick={addTx} className="mt-4 bg-ledger-green text-white text-sm px-4 py-2 rounded-md hover:opacity-90">{editingId ? "Cập nhật giao dịch" : "Lưu giao dịch"}</button>
        </div>
      )}

      <div className="bg-white rounded-lg border border-paper-line p-3 flex items-center gap-2 flex-wrap">
        <RangeModePicker rangeMode={rangeMode} setRangeMode={setRangeMode} rangeFrom={rangeFrom} setRangeFrom={setRangeFrom} rangeTo={rangeTo} setRangeTo={setRangeTo} reportMonth={reportMonth} reportYear={reportYear} show={showRangePicker} setShow={setShowRangePicker} />
        <select value={filterKind} onChange={(e) => setFilterKind(e.target.value)} className="border border-paper-line rounded px-2.5 py-1.5 text-xs"><option value="all">Tất cả loại</option><option value="thu">Chỉ Thu</option><option value="chi">Chỉ Chi</option></select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border border-paper-line rounded px-2.5 py-1.5 text-xs"><option value="all">Tất cả hóa đơn</option><option value="ok">Đã có hóa đơn</option><option value="missing">Chờ bổ sung hóa đơn</option></select>
        <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Tìm theo mô tả, đối tác, SĐT, email... (tìm xuyên suốt mọi tháng)" className="border border-paper-line rounded px-2.5 py-1.5 text-xs flex-1 min-w-[200px]" />
        <span className="text-[11px] text-muted">{filteredTransactions.length}/{transactions.length} giao dịch</span>
      </div>

      {categoryBreakdown.length > 0 && (
        <div className="bg-white rounded-lg border border-paper-line p-4">
          <div className="text-xs font-semibold text-ink uppercase mb-2">Tổng hợp theo danh mục (đang lọc)</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            {categoryBreakdown.map((c) => (
              <div key={c.category} className="flex items-center justify-between text-xs border-b border-paper-line py-1">
                <span className="text-charcoal">{c.category}</span>
                <span className="ktns-mono">{c.thu > 0 && <span className="text-ledger-green">+{fmtVND(c.thu)}</span>}{c.thu > 0 && c.chi > 0 && " / "}{c.chi > 0 && <span className="text-stamp-red">-{fmtVND(c.chi)}</span>}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-paper-line p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold text-ink uppercase flex items-center gap-1.5"><Landmark size={13} /> Thuế GTGT (VAT) — theo khoảng ngày đã chọn bên dưới</div>
          <button onClick={() => setShowVatDetail((v) => !v)} className="text-[10px] text-ink-light underline">{showVatDetail ? "Thu gọn" : "Xem chi tiết từng khoản"}</button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-[11px] text-muted uppercase">Thuế GTGT đầu ra (bán ra)</div>
            <div className="ktns-mono text-lg font-semibold text-ledger-green">{fmtVND(vatOutput)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted uppercase">Thuế GTGT đầu vào (mua vào)</div>
            <div className="ktns-mono text-lg font-semibold text-stamp-red">{fmtVND(vatInput)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted uppercase">{vatPayable >= 0 ? "Thuế GTGT phải nộp" : "Thuế GTGT được khấu trừ kỳ sau"}</div>
            <div className={`ktns-mono text-lg font-semibold ${vatPayable >= 0 ? "text-ink" : "text-ledger-green"}`}>{fmtVND(Math.abs(vatPayable))}</div>
          </div>
        </div>
        <p className="text-[10px] text-muted mt-2">* Chỉ tính từ giao dịch có loại hóa đơn GTGT. Thuế phải nộp = Đầu ra − Đầu vào — công thức khai thuế GTGT theo phương pháp khấu trừ. Mức thuế suất 8%/10% có thể thay đổi theo chính sách hiện hành, kiểm tra lại trước khi kê khai chính thức. Giao dịch loại "Thu hộ đối tác (VAT do đối tác chịu)" — VD bán sản phẩm hợp tác phân phối mà đối tác chịu trách nhiệm VAT — <strong className="text-charcoal">cố tình KHÔNG tính vào đây</strong>, vì đó không phải nghĩa vụ VAT của công ty bạn.</p>

        {showVatDetail && (() => {
          const vatTx = transactions.filter((t) => VAT_INVOICE_TYPES.includes(t.invoiceType) && inRange(t));
          const outputRows = vatTx.filter((t) => t.kind === "thu");
          const inputRows = vatTx.filter((t) => t.kind === "chi");
          const Row = (t) => {
            const v = splitVAT(t.amount, t.vatRate || 0);
            return (
              <tr key={t.id} className="border-t border-paper-line">
                <td className="px-3 py-1.5 ktns-mono text-[11px] text-muted">{t.date}</td>
                <td className="px-3 py-1.5 text-xs">{t.category || "—"}</td>
                <td className="px-3 py-1.5 text-xs">{t.desc}</td>
                <td className="px-3 py-1.5 text-right ktns-mono text-xs">{fmtVND(t.amount)}</td>
                <td className="px-3 py-1.5 text-right ktns-mono text-xs text-stamp-red">{fmtVND(v.vatAmount)} ({t.vatRate || 0}%)</td>
              </tr>
            );
          };
          return (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] font-semibold text-ledger-green uppercase mb-1">Đầu ra — công ty bán ra, xuất VAT cho khách ({outputRows.length})</div>
                <div className="border border-paper-line rounded overflow-hidden">
                  <table className="w-full">
                    <thead><tr className="bg-paper text-left text-[10px] uppercase text-muted"><th className="px-3 py-1.5">Ngày</th><th className="px-3 py-1.5">Danh mục</th><th className="px-3 py-1.5">Mô tả</th><th className="px-3 py-1.5 text-right">Số tiền</th><th className="px-3 py-1.5 text-right">VAT</th></tr></thead>
                    <tbody>
                      {outputRows.length === 0 && <tr><td colSpan={5} className="px-3 py-3 text-center text-[11px] text-muted">Chưa có khoản đầu ra nào.</td></tr>}
                      {outputRows.map(Row)}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-stamp-red uppercase mb-1">Đầu vào — công ty mua vào, có VAT (thuê nhà, mua sắm, ăn uống tiếp khách...) ({inputRows.length})</div>
                <div className="border border-paper-line rounded overflow-hidden">
                  <table className="w-full">
                    <thead><tr className="bg-paper text-left text-[10px] uppercase text-muted"><th className="px-3 py-1.5">Ngày</th><th className="px-3 py-1.5">Danh mục</th><th className="px-3 py-1.5">Mô tả</th><th className="px-3 py-1.5 text-right">Số tiền</th><th className="px-3 py-1.5 text-right">VAT</th></tr></thead>
                    <tbody>
                      {inputRows.length === 0 && <tr><td colSpan={5} className="px-3 py-3 text-center text-[11px] text-muted">Chưa có khoản đầu vào nào.</td></tr>}
                      {inputRows.map(Row)}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="bg-white rounded-lg border border-paper-line p-4">
        <div className="text-xs font-semibold text-ink uppercase mb-2 flex items-center gap-1.5"><Printer size={13} /> In hóa đơn theo khoảng ngày — phục vụ khi cơ quan thuế kiểm tra</div>
        <div className="flex items-end gap-3 flex-wrap">
          <label className="text-xs text-muted flex flex-col gap-1">Từ ngày<input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
          <label className="text-xs text-muted flex flex-col gap-1">Đến ngày<input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
          <button onClick={printInvoicesInRange} className="text-sm bg-ink text-white px-4 py-2 rounded-md hover:bg-ink-light flex items-center gap-1.5"><Printer size={14} /> In / Lưu PDF bảng kê + ảnh hóa đơn</button>
          <button onClick={downloadInvoiceStatement} className="text-sm border border-paper-line text-ink px-4 py-2 rounded-md hover:border-gold flex items-center gap-1.5" title="Nếu nút In không hiện hộp thoại, dùng nút này — tải file về máy rồi mở bằng trình duyệt để in"><Download size={14} /> Tải file HTML để in</button>
          <span className="text-[11px] text-muted">{transactions.filter((t) => t.date >= rangeFrom && t.date <= rangeTo).length} giao dịch trong khoảng ngày này</span>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
        <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10"><tr className="bg-paper text-left text-xs uppercase text-muted"><th className="px-4 py-2.5">STT</th><th className="px-4 py-2.5">Ngày</th><th className="px-4 py-2.5">Danh mục</th><th className="px-4 py-2.5">Mô tả</th><th className="px-4 py-2.5">Đối tác</th><th className="px-4 py-2.5 text-right">Số tiền</th><th className="px-4 py-2.5">Loại hóa đơn</th><th className="px-4 py-2.5">Đính kèm</th><th className="px-4 py-2.5">Trạng thái</th><th className="px-4 py-2.5"></th><th className="px-2 py-2.5"></th></tr></thead>
          <tbody>
            {filteredTransactions.length === 0 && (
              <tr><td colSpan={11} className="px-4 py-6 text-center text-xs text-muted">Không có giao dịch nào khớp bộ lọc.</td></tr>
            )}
            {filteredTransactions.map((t, idx) => ({ ...t, _stt: idx + 1 })).slice().reverse().map((t) => {
              const missing = t.invoiceType === "Chưa xác định";
              // Chi tiền mặt ≥5 triệu (Nghị định 320/2025/NĐ-CP) có nguy cơ KHÔNG được tính là
              // chi phí hợp lý khi quyết toán thuế TNDN, dù có đủ hoá đơn — cảnh báo ngay tại dòng.
              const cashRiskFlag = t.kind === "chi" && t.paymentMethod === "tien_mat" && t.amount >= CASH_PAYMENT_DEDUCTIBLE_LIMIT;
              let srcOrder = t.source === "crm" ? (orders || []).find((o) => o.id === t.sourceOrderId) : null;
              if (t.source === "hoptac" && t.sourceOrderId) {
                const linkedDist = (distributionOrders || []).find((d) => d.id === t.sourceOrderId);
                if (linkedDist?.sourceCrmOrderId) srcOrder = (orders || []).find((o) => o.id === linkedDist.sourceCrmOrderId);
              }
              // Đơn Hợp tác phân phối liên kết (nếu có) — để hiện thẳng "còn nợ đối tác X đ" ngay
              // trong dòng này, không phải bấm mở rộng mới biết khoản thu này chưa phải lãi sạch.
              const linkedDistOrder = t.sourceOrderId ? (distributionOrders || []).find((d) => d.sourceCrmOrderId === t.sourceOrderId) : null;
              let owedToPartner = null;
              if (linkedDistOrder && !linkedDistOrder.partnerInvoiceReceived && !linkedDistOrder.partnerInvoiceConfirmed) {
                const p = (distributionPartners || []).find((x) => x.id === linkedDistOrder.partnerId);
                const monthlyRevenue = getPartnerMonthlyRevenue(linkedDistOrder.partnerId, linkedDistOrder.date, distributionOrders);
                const pct = lookupCommissionTier(monthlyRevenue, p?.commissionTiers);
                const split = computePartnerAmount(linkedDistOrder.revenue, linkedDistOrder.vatRate, pct, p?.partnerRole);
                // Số "không phải của công ty" = TOÀN BỘ phần chênh lệch giữa số thu được và số
                // "Công ty thực nhận" bên Hợp tác phân phối (gồm cả VAT lẫn hoa hồng đối tác giữ,
                // không chỉ riêng hoa hồng) — để khớp đúng 100% với con số đã tính bên kia.
                owedToPartner = { partnerName: p?.name, amount: linkedDistOrder.revenue - split.remittedToCompany, companyKeeps: split.remittedToCompany };
              }
              const isExpanded = expandedTxId === t.id;
              return (
                <React.Fragment key={t.id}>
                <tr className={`border-t border-paper-line cursor-pointer hover:bg-paper/40 ${missing || cashRiskFlag ? "ktns-warn-row" : ""}`} onClick={() => setExpandedTxId(isExpanded ? null : t.id)}>
                  <td className="px-4 py-2.5 ktns-mono text-xs text-muted">{t._stt}</td>
                  <td className="px-4 py-2.5 ktns-mono text-xs text-muted">{t.date}</td>
                  <td className="px-4 py-2.5">
                    {t.category || "—"}
                    <div className="text-[9px] text-ink-light ktns-mono">TK {t.accountCode || suggestAccountCode(t)}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    {t.desc}
                    {t.source === "crm" && <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-ink-light text-white">CRM</span>}
                    {t.source === "bangluong" && <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-gold text-white">LƯƠNG</span>}
                    {t.source === "hoptac" && <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-stamp-red text-white">PHÂN PHỐI</span>}
                    {t.source === "hoptac_muahang" && <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-ledger-green text-white">NHẬP HÀNG</span>}
                    {t.source === "congno" && <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-ink text-white">CÔNG NỢ</span>}
                    {cashRiskFlag && <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-stamp-red text-white" title="Chi tiền mặt ≥5 triệu có nguy cơ không được trừ khi tính thuế TNDN">⚠ TIỀN MẶT ≥5TR</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {t.partnerName || "—"}{t.paymentMethod && <span className="text-muted"> · {t.paymentMethod === "tien_mat" ? "TM" : "CK"}</span>}
                    {(t.partnerPhone || t.partnerEmail) && (
                      <div className="text-[10px] text-muted ktns-mono">{t.partnerPhone}{t.partnerPhone && t.partnerEmail ? " · " : ""}{t.partnerEmail}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right ktns-mono font-medium" style={{ color: t.kind === "thu" ? "var(--ledger-green)" : "var(--stamp-red)" }}>
                    {t.kind === "thu" ? "+" : "-"}{fmtVND(t.amount)}
                    {owedToPartner && (
                      <div className="text-[10px] text-stamp-red font-normal normal-case">
                        còn nợ {owedToPartner.partnerName}: -{fmtVND(owedToPartner.amount)}<br />
                        <span className="text-ledger-green">công ty thực nhận: {fmtVND(owedToPartner.companyKeeps)}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5"><span className={`text-xs px-2 py-1 rounded ${missing ? "bg-stamp-red/10 text-stamp-red" : "bg-paper text-charcoal"}`}>{t.invoiceType}</span>{t.invoiceNo && <span className="ml-1.5 text-[10px] ktns-mono text-muted">#{t.invoiceNo}</span>}</td>
                  <td className="px-4 py-2.5">
                    {t.attachmentData ? (
                      <button onClick={(e) => { e.stopPropagation(); setViewAttachment(t); }} className="flex items-center gap-1 text-xs text-ink-light hover:text-ink underline"><Paperclip size={12} /> Xem</button>
                    ) : <span className="text-xs text-muted">—</span>}
                  </td>
                  <td className="px-4 py-2.5">{t.source === "crm" && missing ? <StampBadge text="CHỜ XỬ LÝ (CRM)" /> : missing ? <StampBadge text="CHỜ HÓA ĐƠN" /> : <StampBadge text="ĐÃ DUYỆT" gold />}</td>
                  <td className="px-2 py-2.5 text-center"><ChevronRight size={14} className={`text-muted transition-transform inline-block ${isExpanded ? "rotate-90" : ""}`} /></td>
                  <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {t.source && AUTO_SOURCE_LABELS[t.source] ? (
                        <span title={`Sửa ở tab "${AUTO_SOURCE_LABELS[t.source]}" — không sửa trực tiếp ở đây`} className="text-paper-line cursor-not-allowed"><Pencil size={13} /></span>
                      ) : (
                        <button onClick={() => startEditTx(t)} className="text-muted hover:text-ink" title={t.source === "crm" ? "Xử lý hoá đơn cho đơn Sale này" : "Sửa giao dịch"}><Pencil size={13} /></button>
                      )}
                      <button onClick={() => removeTx(t.id)} className="text-muted hover:text-stamp-red" title={t.source === "crm" ? "Xoá sẽ trả đơn về trạng thái chờ hoá đơn bên CRM" : "Xoá giao dịch"}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-paper/60 border-t border-paper-line">
                    <td colSpan={11} className="px-4 py-3">
                      {srcOrder ? (
                        <div className="grid grid-cols-4 gap-3 text-xs">
                          <div><span className="text-muted">Mã số thuế: </span><span className="ktns-mono">{srcOrder.customerTaxCode || "— (khách cá nhân)"}</span></div>
                          <div><span className="text-muted">Người phụ trách Sale: </span>{(employees || []).find((e) => e.id === srcOrder.saleEmployeeId)?.name || "—"}</div>
                          <div><span className="text-muted">Sản phẩm: </span>{srcOrder.productName || "—"} {srcOrder.quantity ? `x${srcOrder.quantity}` : ""}</div>
                          <div><span className="text-muted">Mã key đã cấp: </span><span className="ktns-mono">{srcOrder.issuedKeyCode || "chưa ghi"}</span></div>
                          <div><span className="text-muted">Ghi chú đơn: </span>{srcOrder.note || "—"}</div>
                          <div><span className="text-muted">Nguồn Page: </span>{srcOrder.pageId ? `Page #${srcOrder.pageId}` : "không rõ / khách quen"}</div>
                          <div><span className="text-muted">Mã đơn liên kết: </span><span className="ktns-mono">#{t.sourceOrderId || "—"}{t.source === "hoptac" ? " (Hợp tác PP)" : t.source === "congno" ? " (Công nợ)" : ""}</span></div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted">Không có thông tin chi tiết bổ sung cho giao dịch này (giao dịch nhập tay, gộp nhiều đơn, hoặc không liên kết đơn gốc). {t.sourceOrderId ? <span className="ktns-mono">Mã liên kết: #{t.sourceOrderId}</span> : ""}</p>
                      )}
                      {t.source === "crm" && t.invoiceType === "Thu hộ đối tác (VAT do đối tác chịu)" && (
                        <div className="mt-2 bg-gold/10 border border-gold rounded px-2.5 py-2 text-[11px] text-charcoal">
                          Khoản thu này đến từ sản phẩm hợp tác phân phối — công ty còn phải trả một phần hoa hồng/phí cho đối tác cung cấp sản phẩm (xem chi tiết ở tab Hợp tác phân phối, đơn liên kết #{t.sourceOrderId}).
                        </div>
                      )}
                      {t.source === "hoptac" && t.settledRevenue != null && (
                        <div className="mt-2 bg-paper border border-paper-line rounded px-2.5 py-2 text-[11px] grid grid-cols-3 gap-2">
                          <div><span className="text-muted">Doanh thu gộp: </span><strong className="ktns-mono">{fmtVND(t.settledRevenue)}</strong></div>
                          <div><span className="text-muted">% đối tác giữ (đã chốt): </span><strong className="ktns-mono">{t.settledPct}%</strong></div>
                          <div><span className="text-muted">Công ty thực nhận: </span><strong className="ktns-mono text-ledger-green">{fmtVND(t.amount)}</strong></div>
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-2 text-[11px]">
                        <span className="text-muted">Hạch toán TK (theo TT133 — gợi ý, kế toán có thể sửa lại):</span>
                        <select
                          value={t.accountCode || suggestAccountCode(t)}
                          onChange={(e) => setTransactions((prev) => prev.map((x) => (x.id === t.id ? { ...x, accountCode: e.target.value } : x)))}
                          className="border border-paper-line rounded px-1.5 py-0.5 ktns-mono text-[11px]"
                        >
                          {Object.entries(TT133_ACCOUNTS).map(([code, name]) => (<option key={code} value={code}>{code} — {name}</option>))}
                        </select>
                        <button onClick={() => downloadPhieuThuChi(t, company, t.accountCode || suggestAccountCode(t))} className="flex items-center gap-1 text-ink-light hover:text-ink underline ml-auto">
                          <Printer size={11} /> Tải {t.kind === "thu" ? "Phiếu Thu" : "Phiếu Chi"} (Mẫu {t.kind === "thu" ? "01-TT" : "02-TT"})
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {viewAttachment && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-8" onClick={() => setViewAttachment(null)}>
          <div className="bg-white rounded-lg p-4 max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="ktns-serif font-semibold text-ink text-sm">{viewAttachment.desc} — {viewAttachment.attachmentName}</h3>
              <button onClick={() => setViewAttachment(null)} className="text-muted hover:text-ink"><X size={18} /></button>
            </div>
            {viewAttachment.attachmentType?.startsWith("image/") ? (
              <img src={viewAttachment.attachmentData} alt={viewAttachment.attachmentName} className="max-w-full rounded" />
            ) : (
              <a href={viewAttachment.attachmentData} download={viewAttachment.attachmentName} className="text-sm text-ink-light underline">Tải file {viewAttachment.attachmentName}</a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Vốn góp / Vốn điều lệ ----------
function exportCapitalExcel(contributions, company) {
  const wb = XLSX.utils.book_new();
  const statusLabel = { da_gop_du: "Đã góp đủ", gop_mot_phan: "Góp một phần", chua_gop: "Chưa góp" };
  const rows = contributions.map((c) => ({
    "Người/tổ chức góp vốn": c.contributorName, "Loại tài sản góp vốn": CAPITAL_ASSET_TYPES[c.assetType],
    "Giá trị (VNĐ)": Math.round(c.value), "Tỷ lệ sở hữu (%)": c.ownershipPercent,
    "Ngày góp": c.contributionDate, "Trạng thái": statusLabel[c.status], "Ghi chú": c.note,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 22 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 34 }];
  XLSX.utils.book_append_sheet(wb, ws, "Vốn góp");
  XLSX.writeFile(wb, `${(company.name || "DOMIX").replace(/\s+/g, "_")}_Von_gop_${TODAY.toISOString().slice(0, 10)}.xlsx`);
}

function VonGop({ contributions, setContributions, company, setCompany, totalContributed }) {
  const [showForm, setShowForm] = useState(false);
  const [companyForm, setCompanyForm] = useState({ establishedDate: company.establishedDate || "", registeredCharterCapital: String(company.registeredCharterCapital || 0) });
  const [form, setForm] = useState({ contributorName: "", assetType: "tien_mat", value: "", ownershipPercent: "", contributionDate: TODAY.toISOString().slice(0, 10), status: "da_gop_du", note: "" });

  const saveCompanyCapital = () => {
    setCompany({ ...company, establishedDate: companyForm.establishedDate, registeredCharterCapital: Number(companyForm.registeredCharterCapital) || 0 });
  };

  const addContribution = () => {
    if (!form.contributorName || !form.value) return;
    setContributions((prev) => [...prev, { ...form, id: Date.now(), value: Number(form.value) || 0, ownershipPercent: Number(form.ownershipPercent) || 0 }]);
    setForm({ contributorName: "", assetType: "tien_mat", value: "", ownershipPercent: "", contributionDate: TODAY.toISOString().slice(0, 10), status: "da_gop_du", note: "" });
    setShowForm(false);
  };
  const removeContribution = (id) => setContributions((prev) => prev.filter((c) => c.id !== id));

  const registeredCapital = company.registeredCharterCapital || 0;
  const contributedPct = registeredCapital > 0 ? Math.min(100, Math.round((totalContributed / registeredCapital) * 100)) : 0;
  const totalOwnershipPct = contributions.reduce((a, c) => a + (c.ownershipPercent || 0), 0);

  // Điều 47/113 Luật Doanh nghiệp 2020: phải góp đủ vốn điều lệ trong 90 ngày kể từ ngày cấp GCN ĐKDN.
  const deadlinePassed = company.establishedDate && new Date(company.establishedDate).getTime() + 90 * 86400000 < TODAY.getTime();
  const daysLeft = company.establishedDate ? Math.ceil((new Date(company.establishedDate).getTime() + 90 * 86400000 - TODAY.getTime()) / 86400000) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-lg border border-paper-line p-3 text-xs text-muted flex items-start gap-2">
        <Link2 size={13} className="text-ink-light shrink-0 mt-0.5" />
        <span>Vốn góp là tiền/tài sản chủ sở hữu-thành viên-cổ đông đưa vào công ty để vận hành, khác với doanh thu kinh doanh. Vốn góp bằng <strong className="text-charcoal">tiền mặt</strong> được cộng vào Số dư quỹ ở Dashboard; góp bằng <strong className="text-charcoal">nhà đất/tài sản khác</strong> tính vào vốn điều lệ nhưng không phải tiền mặt trong quỹ.</span>
      </div>

      <div className="bg-white rounded-lg border border-paper-line p-5">
        <h3 className="ktns-serif font-semibold text-ink mb-4 flex items-center gap-2"><Landmark size={16} /> Vốn điều lệ đăng ký</h3>
        <div className="grid grid-cols-3 gap-4">
          <label className="text-xs text-muted flex flex-col gap-1">Vốn điều lệ đăng ký (theo GCN ĐKDN, đ)
            <MoneyInput value={companyForm.registeredCharterCapital} onChange={(v) => setCompanyForm({ ...companyForm, registeredCharterCapital: v })} className="border border-paper-line rounded px-2.5 py-2 text-sm ktns-mono w-full" />
          </label>
          <label className="text-xs text-muted flex flex-col gap-1">Ngày cấp Giấy chứng nhận ĐKDN
            <input type="date" value={companyForm.establishedDate} onChange={(e) => setCompanyForm({ ...companyForm, establishedDate: e.target.value })} className="border border-paper-line rounded px-2.5 py-2 text-sm" />
          </label>
          <div className="flex items-end">
            <button onClick={saveCompanyCapital} className="bg-ink text-white text-sm px-4 py-2 rounded-md hover:bg-ink-light">Lưu</button>
          </div>
        </div>
        {company.establishedDate && (
          <p className={`text-xs mt-3 flex items-center gap-1.5 ${deadlinePassed && contributedPct < 100 ? "text-stamp-red" : "text-muted"}`}>
            <AlertTriangle size={13} />
            {deadlinePassed
              ? (contributedPct >= 100 ? "Đã góp đủ vốn điều lệ trong thời hạn 90 ngày theo luật." : "Đã QUÁ 90 ngày kể từ ngày thành lập mà chưa góp đủ vốn điều lệ — cần xử lý theo Điều 47/113 Luật Doanh nghiệp 2020 (giảm vốn điều lệ hoặc thay đổi tỷ lệ sở hữu tương ứng, đăng ký lại với cơ quan đăng ký kinh doanh).")
              : `Còn ${daysLeft} ngày trong thời hạn 90 ngày phải góp đủ vốn điều lệ kể từ ngày thành lập (Điều 47/113 Luật Doanh nghiệp 2020).`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KpiCard icon={Coins} label="Vốn điều lệ đăng ký" value={fmtVND(registeredCapital)} />
        <KpiCard icon={Landmark} label="Đã góp thực tế" value={fmtVND(totalContributed)} tone="up" sub={registeredCapital > 0 ? `${contributedPct}% vốn điều lệ` : ""} />
        <KpiCard icon={Users} label="Tổng tỷ lệ sở hữu đã ghi nhận" value={`${totalOwnershipPct}%`} tone={totalOwnershipPct === 100 ? "up" : totalOwnershipPct > 100 ? "down" : undefined} sub={totalOwnershipPct !== 100 ? "Nên khớp đủ 100%" : "Khớp đủ 100%"} />
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted">{contributions.length} lượt góp vốn đã ghi nhận.</p>
        <div className="flex gap-2">
          <button onClick={() => exportCapitalExcel(contributions, company)} className="flex items-center gap-1.5 text-sm bg-ledger-green text-white px-3.5 py-2 rounded-md hover:opacity-90">
            <FileSpreadsheet size={15} /> Xuất Excel
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-sm bg-ink text-white px-3.5 py-2 rounded-md hover:bg-ink-light">
            <Plus size={15} /> Thêm lượt góp vốn
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-paper-line p-5 relative">
          <button className="absolute top-3 right-3 text-muted hover:text-ink" onClick={() => { if ((form.contributorName || form.value) && !window.confirm("Chưa lưu — đóng lại sẽ mất thông tin vừa nhập. Vẫn muốn đóng?")) return; setShowForm(false); }}><X size={16} /></button>
          <h3 className="ktns-serif font-semibold text-ink mb-4">Ghi nhận góp vốn</h3>
          <div className="grid grid-cols-4 gap-3">
            <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Người/tổ chức góp vốn<input value={form.contributorName} onChange={(e) => setForm({ ...form, contributorName: e.target.value })} placeholder="Tên thành viên/cổ đông" className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Loại tài sản góp vốn
              <select value={form.assetType} onChange={(e) => setForm({ ...form, assetType: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm">
                {Object.entries(CAPITAL_ASSET_TYPES).map(([id, label]) => (<option key={id} value={id}>{label}</option>))}
              </select>
            </label>
            <label className="text-xs text-muted flex flex-col gap-1">Giá trị góp vốn (đ)<MoneyInput value={form.value} onChange={(v) => setForm({ ...form, value: v })} /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Tỷ lệ sở hữu (%)<input type="number" value={form.ownershipPercent} onChange={(e) => setForm({ ...form, ownershipPercent: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Ngày góp<input type="date" value={form.contributionDate} onChange={(e) => setForm({ ...form, contributionDate: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Trạng thái
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm">
                <option value="da_gop_du">Đã góp đủ</option>
                <option value="gop_mot_phan">Góp một phần</option>
                <option value="chua_gop">Chưa góp</option>
              </select>
            </label>
            <label className="text-xs text-muted flex flex-col gap-1 col-span-4">Ghi chú (mô tả tài sản nếu không phải tiền mặt — VD: "Nhà đất tại...", định giá bởi...)<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
          </div>
          {form.assetType !== "tien_mat" && (
            <p className="mt-2 text-[11px] text-gold flex items-center gap-1.5"><AlertTriangle size={12} /> Tài sản góp vốn không phải tiền mặt phải được định giá bởi thành viên/cổ đông sáng lập hoặc tổ chức thẩm định giá (Điều 36 Luật Doanh nghiệp 2020).</p>
          )}
          <button onClick={addContribution} className="mt-4 bg-ledger-green text-white text-sm px-4 py-2 rounded-md hover:opacity-90">Lưu lượt góp vốn</button>
        </div>
      )}

      <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-paper text-left text-xs uppercase text-muted">
              <th className="px-4 py-2.5">Người góp vốn</th>
              <th className="px-4 py-2.5">Loại tài sản</th>
              <th className="px-4 py-2.5 text-right">Giá trị</th>
              <th className="px-4 py-2.5 text-right">Tỷ lệ sở hữu</th>
              <th className="px-4 py-2.5">Ngày góp</th>
              <th className="px-4 py-2.5">Trạng thái</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {contributions.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-xs text-muted">Chưa có lượt góp vốn nào — bấm "Thêm lượt góp vốn" để bắt đầu ghi nhận.</td></tr>
            )}
            {contributions.map((c) => (
              <tr key={c.id} className="border-t border-paper-line">
                <td className="px-4 py-2.5 font-medium">{c.contributorName}</td>
                <td className="px-4 py-2.5 text-xs">{CAPITAL_ASSET_TYPES[c.assetType]}</td>
                <td className="px-4 py-2.5 text-right ktns-mono font-medium text-ledger-green">{fmtVND(c.value)}</td>
                <td className="px-4 py-2.5 text-right ktns-mono">{c.ownershipPercent}%</td>
                <td className="px-4 py-2.5 ktns-mono text-xs text-muted">{c.contributionDate}</td>
                <td className="px-4 py-2.5">
                  {c.status === "da_gop_du" && <StampBadge text="ĐÃ GÓP ĐỦ" gold />}
                  {c.status === "gop_mot_phan" && <StampBadge text="GÓP MỘT PHẦN" muted />}
                  {c.status === "chua_gop" && <StampBadge text="CHƯA GÓP" />}
                </td>
                <td className="px-4 py-2.5 text-right"><button onClick={() => removeContribution(c.id)} className="text-muted hover:text-stamp-red"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">* Hình thức góp vốn hợp pháp theo Điều 34 Luật Doanh nghiệp 2020: Đồng Việt Nam, ngoại tệ tự do chuyển đổi, vàng, quyền sử dụng đất, quyền sở hữu trí tuệ/công nghệ/bí quyết kỹ thuật, tài sản khác định giá được bằng VNĐ. Thông tin ở đây mang tính tham khảo, không thay thế tư vấn của luật sư/kế toán khi làm thủ tục với cơ quan đăng ký kinh doanh.</p>
    </div>
  );
}

// ---------- Hợp tác phân phối ----------
function exportDistributionExcel(distOrders, partners) {
  const wb = XLSX.utils.book_new();
  const nameOf = (id) => partners.find((p) => p.id === id)?.name || "—";
  const roleOf = (id) => partners.find((p) => p.id === id)?.partnerRole || "dai_ly";
  const salesOrders = distOrders.filter((o) => o.orderKind !== "purchase");
  const purchaseOrders = distOrders.filter((o) => o.orderKind === "purchase");

  const rows = salesOrders.map((o) => {
    const monthlyRevenue = getPartnerMonthlyRevenue(o.partnerId, o.date, salesOrders);
    const pct = lookupCommissionTier(monthlyRevenue, partners.find((p) => p.id === o.partnerId)?.commissionTiers);
    const split = computePartnerAmount(o.revenue, o.vatRate, pct, roleOf(o.partnerId));
    return {
      "Ngày": o.date, "Sản phẩm": o.productName, "Đối tác": nameOf(o.partnerId), "Vai trò": PARTNER_ROLES[roleOf(o.partnerId)]?.label,
      "Doanh thu": Math.round(o.revenue), "Thuế suất VAT (%)": o.vatRate, "VAT": Math.round(split.vatAmount),
      "Còn lại sau VAT": Math.round(split.netOfVat), "Tỷ lệ % (theo cộng dồn tháng)": pct,
      "Số tiền hoa hồng/phí": Math.round(split.commissionAmount),
      "Công ty thực nhận": Math.round(split.remittedToCompany),
      "Đã nhận HĐ VAT đối tác": o.partnerInvoiceReceived ? "Có" : "Chưa",
      "Mã key đã cấp": o.issuedKeyCode || "", "Khách hàng cuối": o.endCustomerName || "",
      "Ghi chú": o.note,
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = new Array(14).fill({ wch: 16 });
  XLSX.utils.book_append_sheet(wb, ws, "Đơn bán-Nhượng quyền");

  if (purchaseOrders.length > 0) {
    const purchaseRows = purchaseOrders.map((o) => {
      const vat = splitVAT(o.totalCost, o.vatRate);
      return {
        "Ngày": o.date, "Sản phẩm": o.productName, "Nhà cung cấp": nameOf(o.partnerId),
        "Số lượng": o.quantity, "Đơn giá mua": Math.round(o.unitCost), "Tổng tiền mua": Math.round(o.totalCost),
        "VAT đầu vào (%)": o.vatRate, "Tiền VAT": Math.round(vat.vatAmount), "Số hoá đơn NCC": o.invoiceNo, "Ghi chú": o.note,
      };
    });
    const wsP = XLSX.utils.json_to_sheet(purchaseRows);
    wsP["!cols"] = new Array(10).fill({ wch: 16 });
    XLSX.utils.book_append_sheet(wb, wsP, "Đơn nhập hàng");
  }

  XLSX.writeFile(wb, `DOMIX_Hop_tac_phan_phoi_${TODAY.toISOString().slice(0, 10)}.xlsx`);
}

function HopTacPhanPhoi({ partners, setPartners, distOrders, setDistOrders, setTransactions, transactions, company, inventory, setInventory, reportYear, reportMonth, orders, employees }) {
  const [rangeMode, setRangeMode] = useState("month");
  const [rangeFrom, setRangeFrom] = useState(new Date(reportYear || TODAY.getFullYear(), (reportMonth || TODAY.getMonth() + 1) - 1, 1).toISOString().slice(0, 10));
  const [rangeTo, setRangeTo] = useState(new Date(reportYear || TODAY.getFullYear(), (reportMonth || TODAY.getMonth() + 1), 0).toISOString().slice(0, 10));
  useEffect(() => {
    if (!reportYear || !reportMonth || rangeMode === "custom") return;
    setRangeFrom(new Date(reportYear, reportMonth - 1, 1).toISOString().slice(0, 10));
    setRangeTo(new Date(reportYear, reportMonth, 0).toISOString().slice(0, 10));
  }, [reportYear, reportMonth, rangeMode]);
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [expandedDistId, setExpandedDistId] = useState(null);
  const inPeriod = (o) => rangeMode === "all" || (o.date >= rangeFrom && o.date <= rangeTo);
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const blankTiers = [{ minRevenue: 0, pct: 36 }, { minRevenue: 100000000, pct: 34 }, { minRevenue: 300000000, pct: 33 }];
  const [partnerForm, setPartnerForm] = useState({ name: "", taxCode: "", phone: "", email: "", partnerRole: "dai_ly", commissionTiers: blankTiers, productIds: [] });
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderForm, setOrderForm] = useState({ date: TODAY_STR, productId: "", productName: "", quantity: "1", partnerId: partners[0]?.id || "", revenue: "", vatRate: 8, issuedKeyCode: "", endCustomerName: "", note: "" });
  // Mô hình "Nhà cung cấp — mua đứt bán lại" dùng form NHẬP HÀNG riêng (không phải hoa hồng):
  // mua từ đối tác với giá + VAT đầu vào, tăng tồn kho, tạo Chi có hoá đơn NCC làm chứng từ khấu trừ.
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({ date: TODAY_STR, productId: "", quantity: "1", unitCost: "", vatRate: 8, partnerId: partners[0]?.id || "", note: "", invoiceNo: "", attachmentData: "", attachmentName: "", attachmentType: "" });
  const selectDistProduct = (productId) => {
    const p = (inventory || []).find((i) => i.id === Number(productId));
    setOrderForm((f) => ({ ...f, productId, productName: p ? p.name : "", revenue: p ? String(p.sellPrice * Number(f.quantity || 1)) : f.revenue, vatRate: p ? (p.vatRate ?? f.vatRate) : f.vatRate }));
  };
  const updateDistQty = (qty) => {
    const p = orderForm.productId ? (inventory || []).find((i) => i.id === Number(orderForm.productId)) : null;
    setOrderForm((f) => ({ ...f, quantity: qty, revenue: p ? String(p.sellPrice * Number(qty || 1)) : f.revenue }));
  };
  const [activeInvoiceOrderId, setActiveInvoiceOrderId] = useState(null);
  const [invoiceDraft, setInvoiceDraft] = useState({});
  const [invoiceErr, setInvoiceErr] = useState("");
  const [viewingAttachment, setViewingAttachment] = useState(null);

  const nameOf = (id) => partners.find((p) => p.id === id)?.name || "—";
  const partnerOf = (id) => partners.find((p) => p.id === id);
  // % LUÔN tra động theo doanh thu cộng dồn cả tháng — kể cả đơn ĐÃ xác nhận. Đổi bậc % của đối
  // tác thì mọi đơn (kể cả đã xác nhận) đều tự tính lại theo đúng % mới nhất, số tiền đã ghi Thu
  // Chi cũng được cập nhật lại theo (xem savePartnerAndSync bên dưới).
  const resolvePct = (order) => {
    const p = partnerOf(order.partnerId);
    const monthlyRevenue = getPartnerMonthlyRevenue(order.partnerId, order.date, distOrders);
    return lookupCommissionTier(monthlyRevenue, p?.commissionTiers);
  };

  const addTierRow = () => setPartnerForm((f) => ({ ...f, commissionTiers: [...f.commissionTiers, { minRevenue: 0, pct: 0 }] }));
  const updateTierRow = (i, field, value) => setPartnerForm((f) => ({ ...f, commissionTiers: f.commissionTiers.map((t, idx) => (idx === i ? { ...t, [field]: Number(value) || 0 } : t)) }));
  const removeTierRow = (i) => setPartnerForm((f) => ({ ...f, commissionTiers: f.commissionTiers.filter((_, idx) => idx !== i) }));
  const toggleProductForPartner = (pid) => setPartnerForm((f) => ({ ...f, productIds: f.productIds.includes(pid) ? f.productIds.filter((x) => x !== pid) : [...f.productIds, pid] }));

  // Thêm sản phẩm mới của đối tác NGAY TẠI ĐÂY — tự động lưu vào Kho hàng dùng chung
  // (hiện ra ở tab Kho hàng, chọn được ở CRM/Sale) và tự gán luôn cho đối tác đang sửa.
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const blankNewProduct = { sku: "", name: "", groupName: "", unit: "cái", stock: "0", minStock: "10", costPrice: "", sellPrice: "", durationMonths: "0", vatRate: 8 };
  const [newProductForm, setNewProductForm] = useState(blankNewProduct);
  const addProductFromPartner = () => {
    if (!newProductForm.name) return;
    const newId = Date.now();
    setInventory((prev) => [...prev, {
      ...newProductForm, id: newId, stock: Number(newProductForm.stock) || 0, minStock: Number(newProductForm.minStock) || 0,
      costPrice: Number(newProductForm.costPrice) || 0, sellPrice: Number(newProductForm.sellPrice) || 0, durationMonths: Number(newProductForm.durationMonths) || 0,
      vatRate: Number(newProductForm.vatRate) || 0,
    }]);
    setPartnerForm((f) => ({ ...f, productIds: [...f.productIds, newId] }));
    setNewProductForm(blankNewProduct);
    setShowNewProductForm(false);
  };

  const [editingPartnerId, setEditingPartnerId] = useState(null);
  const closePartnerForm = () => { setShowPartnerForm(false); setEditingPartnerId(null); setPartnerForm({ name: "", taxCode: "", phone: "", email: "", partnerRole: "dai_ly", commissionTiers: [...blankTiers], productIds: [] }); };
  const [syncMsg, setSyncMsg] = useState("");
  const startEditPartner = (p) => {
    setEditingPartnerId(p.id);
    setPartnerForm({ name: p.name, taxCode: p.taxCode || "", phone: p.phone || "", email: p.email || "", partnerRole: p.partnerRole || "dai_ly", commissionTiers: (p.commissionTiers || blankTiers).map((t) => ({ ...t })), productIds: [...(p.productIds || [])] });
    setShowPartnerForm(true);
  };
  const addPartner = () => {
    if (!partnerForm.name) return;
    if (partnerForm.partnerRole !== "nha_cung_cap" && partnerForm.commissionTiers.length === 0) return;
    if (editingPartnerId) {
      setPartners((prev) => prev.map((p) => (p.id === editingPartnerId ? { ...p, ...partnerForm } : p)));
      // Đổi bậc %/vai trò xong thì quét lại TẤT CẢ đơn của đối tác này ĐÃ XÁC NHẬN (đã ghi Thu Chi
      // thật) — tính lại đúng theo cấu hình MỚI, sửa luôn số tiền đã ghi sổ cho khớp, theo đúng
      // yêu cầu: đổi % là mọi đơn (kể cả đã xác nhận) đều cập nhật theo, không giữ số cũ.
      const affected = distOrders.filter((o) => o.partnerId === editingPartnerId && o.orderKind !== "purchase" && (o.partnerInvoiceReceived || o.partnerInvoiceConfirmed) && o.linkedTxId);
      if (affected.length > 0) {
        const updatesByTxId = {};
        affected.forEach((o) => {
          const monthlyRevenue = getPartnerMonthlyRevenue(o.partnerId, o.date, distOrders);
          const newPct = lookupCommissionTier(monthlyRevenue, partnerForm.commissionTiers);
          const split = computePartnerAmount(o.revenue, o.vatRate, newPct, partnerForm.partnerRole);
          updatesByTxId[o.linkedTxId] = { amount: Math.round(split.remittedToCompany), settledPct: newPct, settledRevenue: o.revenue };
        });
        setTransactions((prev) => prev.map((t) => (updatesByTxId[t.id] ? { ...t, ...updatesByTxId[t.id] } : t)));
        setDistOrders((prev) => prev.map((o) => (updatesByTxId[o.linkedTxId] ? { ...o, commissionPct: updatesByTxId[o.linkedTxId].settledPct } : o)));
        setSyncMsg(`Đã cập nhật lại ${affected.length} đơn đã xác nhận theo % mới, sửa luôn số tiền trong Thu Chi.`);
        setTimeout(() => setSyncMsg(""), 6000);
      }
    } else {
      setPartners((prev) => [...prev, { ...partnerForm, id: Date.now() }]);
    }
    closePartnerForm();
  };
  const removePartner = (id) => setPartners((prev) => prev.filter((p) => p.id !== id));

  const selectPartnerForOrder = (partnerId) => setOrderForm((f) => ({ ...f, partnerId, productId: "", productName: "", revenue: "" }));
  // Sản phẩm hiện được trong dropdown đơn hàng phải khớp đúng danh mục đối tác đang chọn được gán —
  // tránh gán nhầm sản phẩm cho đối tác không thực sự phân phối nó.
  const availableProductsForOrder = (() => {
    const p = partnerOf(Number(orderForm.partnerId));
    if (!p || !p.productIds || p.productIds.length === 0) return [];
    return (inventory || []).filter((i) => p.productIds.includes(i.id));
  })();
  const addDistOrder = () => {
    if (!orderForm.productName || !orderForm.revenue || !orderForm.partnerId) return;
    const p = partnerOf(Number(orderForm.partnerId));
    const revenue = Number(orderForm.revenue) || 0;
    // % tra theo doanh thu CỘNG DỒN cả tháng (đã có + đơn này) — lưu lại % lúc tạo chỉ để tham
    // khảo/xuất Excel, còn hiển thị/tính toán thực tế luôn tra động qua resolvePct().
    const monthlySoFar = getPartnerMonthlyRevenue(Number(orderForm.partnerId), orderForm.date, distOrders);
    const commissionPct = lookupCommissionTier(monthlySoFar + revenue, p?.commissionTiers);
    setDistOrders((prev) => [...prev, {
      ...orderForm, id: Date.now(), partnerId: Number(orderForm.partnerId), productId: orderForm.productId ? Number(orderForm.productId) : null,
      quantity: Number(orderForm.quantity) || 1, revenue, vatRate: Number(orderForm.vatRate) || 0, commissionPct,
      partnerInvoiceReceived: false, partnerInvoiceNo: "", linkedTxId: null,
    }]);
    if (orderForm.productId && setInventory) {
      const pid = Number(orderForm.productId);
      const qty = Number(orderForm.quantity) || 1;
      setInventory((prev) => prev.map((i) => (i.id === pid ? { ...i, stock: Math.max(0, i.stock - qty) } : i)));
    }
    setOrderForm({ date: TODAY_STR, productId: "", productName: "", quantity: "1", partnerId: partners[0]?.id || "", revenue: "", vatRate: 8, issuedKeyCode: "", endCustomerName: "", note: "" });
    setShowOrderForm(false);
  };
  const removeDistOrder = (id) => {
    const o = distOrders.find((x) => x.id === id);
    if (o?.linkedTxId) setTransactions((prev) => prev.filter((t) => t.id !== o.linkedTxId));
    if (o?.orderKind === "purchase" && o.productId && setInventory) {
      // Xoá đơn nhập hàng thì phải trừ lại đúng số lượng đã cộng vào tồn kho lúc nhập.
      setInventory((prev) => prev.map((i) => (i.id === o.productId ? { ...i, stock: Math.max(0, i.stock - o.quantity) } : i)));
    } else if (o?.productId && setInventory) {
      // Xoá đơn phân phối/nhượng quyền thì trả lại tồn kho đã trừ lúc bán.
      setInventory((prev) => prev.map((i) => (i.id === o.productId ? { ...i, stock: i.stock + (o.quantity || 1) } : i)));
    }
    setDistOrders((prev) => prev.filter((x) => x.id !== id));
  };

  // Mô hình "Nhà cung cấp — mua đứt bán lại": mua hàng từ đối tác, có hoá đơn VAT ĐẦU VÀO của họ.
  // Công ty bạn tự bán lại và tự xuất hoá đơn cho khách ở CRM như bình thường — không có % hoa hồng ở đây.
  const [purchaseErr, setPurchaseErr] = useState("");
  const handlePurchaseFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPurchaseForm((f) => ({ ...f, attachmentData: reader.result, attachmentName: file.name, attachmentType: file.type }));
    reader.readAsDataURL(file);
  };
  const addPurchase = () => {
    if (!purchaseForm.productId || !purchaseForm.unitCost || !purchaseForm.partnerId) return;
    if (!purchaseForm.attachmentData) { setPurchaseErr("Bắt buộc đính kèm hoá đơn VAT đầu vào từ nhà cung cấp trước khi lưu — đây là chứng từ khấu trừ thuế hợp lệ."); return; }
    const p = partnerOf(Number(purchaseForm.partnerId));
    const product = (inventory || []).find((i) => i.id === Number(purchaseForm.productId));
    const qty = Number(purchaseForm.quantity) || 1;
    const unitCost = Number(purchaseForm.unitCost) || 0;
    const totalCost = unitCost * qty;
    const txId = Date.now();
    // Tăng tồn kho + cập nhật giá nhập mới nhất cho sản phẩm.
    if (product && setInventory) {
      setInventory((prev) => prev.map((i) => (i.id === product.id ? { ...i, stock: i.stock + qty, costPrice: unitCost } : i)));
    }
    setTransactions((prev) => [...prev, {
      id: txId, date: purchaseForm.date, kind: "chi", category: "Nhập hàng (mua đứt bán lại)",
      desc: `Nhập ${qty} ${product?.unit || ""} ${product?.name || ""} từ ${p?.name || "đối tác"}`, amount: totalCost,
      partnerName: p?.name || "", partnerTaxCode: p?.taxCode || "", paymentMethod: "chuyen_khoan",
      invoiceType: "Hóa đơn GTGT (VAT)", invoiceNo: purchaseForm.invoiceNo, vatRate: purchaseForm.vatRate,
      attachmentData: purchaseForm.attachmentData, attachmentName: purchaseForm.attachmentName, attachmentType: purchaseForm.attachmentType,
      status: "approved", source: "hoptac_muahang", sourceOrderId: null,
    }]);
    setDistOrders((prev) => [...prev, {
      id: Date.now() + 1, orderKind: "purchase", date: purchaseForm.date, partnerId: Number(purchaseForm.partnerId),
      productId: product?.id || null, productName: product?.name || "", quantity: qty, unitCost, totalCost,
      vatRate: purchaseForm.vatRate, invoiceNo: purchaseForm.invoiceNo, note: purchaseForm.note, linkedTxId: txId,
    }]);
    setPurchaseForm({ date: TODAY_STR, productId: "", quantity: "1", unitCost: "", vatRate: 8, partnerId: partners[0]?.id || "", note: "", invoiceNo: "", attachmentData: "", attachmentName: "", attachmentType: "" });
    setPurchaseErr("");
    setShowPurchaseForm(false);
  };

  const openInvoiceModal = (o) => {
    setInvoiceErr("");
    setInvoiceDraft({ invoiceNo: o.partnerInvoiceNo || "", attachmentData: "", attachmentName: "", attachmentType: "" });
    setActiveInvoiceOrderId(o.id);
  };
  const handleInvoiceFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setInvoiceDraft((d) => ({ ...d, attachmentData: reader.result, attachmentName: file.name, attachmentType: file.type }));
    reader.readAsDataURL(file);
  };
  const saveCommissionInvoice = () => {
    if (!invoiceDraft.invoiceNo) { setInvoiceErr("Cần nhập số hoá đơn đối tác đã báo lại cho bạn."); return; }
    const o = distOrders.find((x) => x.id === activeInvoiceOrderId);
    const p = partnerOf(o.partnerId);
    const resolvedPct = resolvePct(o);
    const split = computePartnerAmount(o.revenue, o.vatRate, resolvedPct, p?.partnerRole);
    const linkedTxId = o.linkedTxId || Date.now();
    const hasAttachment = !!invoiceDraft.attachmentData;
    const srcOrder = o.sourceCrmOrderId ? (orders || []).find((x) => x.id === o.sourceCrmOrderId) : null;
    // ĐÚNG 1 KHOẢN THU DUY NHẤT — không tách thành Thu gộp + Chi hoa hồng nữa (tránh cảm giác
    // "xuất 2 lần"). Chỉ khi đối tác xác nhận xong (biết chính xác % áp dụng) mới ghi đúng số tiền
    // công ty THỰC SỰ nhận được vào Thu Chi — trước đó không có gì trong Thu Chi cho đơn này cả.
    // Mô tả rút gọn — chi tiết VAT/% xem ở khung mở rộng khi bấm vào dòng, không nhồi hết vào đây.
    setTransactions((prev) => {
      const without = prev.filter((t) => t.id !== o.linkedTxId);
      return [...without, {
        id: linkedTxId, date: o.date, kind: "thu", category: "Bán hàng (qua đối tác phân phối)",
        desc: `${o.endCustomerName || o.productName} — qua ${p?.name || "đối tác"}`, amount: Math.round(split.remittedToCompany),
        partnerName: o.endCustomerName || p?.name || "", partnerTaxCode: srcOrder?.customerTaxCode || "", partnerPhone: srcOrder?.phone || "", partnerEmail: srcOrder?.email || "", paymentMethod: "chuyen_khoan",
        // ĐÃ SỬA: có đính kèm file KHÔNG có nghĩa đây là "Hóa đơn GTGT (VAT)" của chính công ty —
        // file đính kèm thường là hoá đơn/chứng từ đối tác báo hoa hồng, không tự động là căn cứ
        // tính thuế GTGT đầu ra cho khoản THU RÒNG này. Để "Biên lai nội bộ" làm mặc định an toàn,
        // kế toán tự đổi đúng loại hoá đơn ở tab Thu Chi sau khi xác minh rõ nghĩa vụ thuế thật.
        invoiceType: "Biên lai / Phiếu thu nội bộ", invoiceNo: invoiceDraft.invoiceNo, vatRate: o.vatRate,
        attachmentData: invoiceDraft.attachmentData, attachmentName: invoiceDraft.attachmentName, attachmentType: invoiceDraft.attachmentType,
        status: hasAttachment ? "approved" : "pending", source: "hoptac", sourceOrderId: o.id,
        settledPct: resolvedPct, settledRevenue: o.revenue, settledPartnerName: p?.name || "",
      }];
    });
    // Đóng băng % đã áp dụng lúc xác nhận (commissionPct) — từ giờ bảng luôn hiện đúng % này cho
    // đơn đã xác nhận, không tính lại theo cấu hình mới nữa dù sau đó bạn đổi bậc % của đối tác.
    setDistOrders((prev) => prev.map((x) => (x.id === activeInvoiceOrderId ? { ...x, partnerInvoiceReceived: hasAttachment, partnerInvoiceConfirmed: true, partnerInvoiceNo: invoiceDraft.invoiceNo, linkedTxId, commissionPct: resolvedPct } : x)));
    setActiveInvoiceOrderId(null);
  };

  // Xác nhận GỘP cả tháng — đúng thực tế nhiều đối tác (VD Say Media) không xuất hoá đơn riêng
  // từng đơn mà GỘP LẠI xuất 1 hoá đơn duy nhất cuối tháng cho tổng hoa hồng/phí. Thay vì bắt xác
  // nhận tay 41 lần, chọn đối tác + nhập 1 số hoá đơn duy nhất là xong toàn bộ đơn đang "chờ".
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchDraft, setBatchDraft] = useState({ partnerId: "", invoiceNo: "", attachmentData: "", attachmentName: "", attachmentType: "" });
  const [batchErr, setBatchErr] = useState("");
  const pendingOrdersForBatch = (pid) => salesOrders.filter((o) => o.partnerId === Number(pid) && !o.partnerInvoiceReceived && !o.partnerInvoiceConfirmed);
  const batchTotal = (pid) => pendingOrdersForBatch(pid).reduce((sum, o) => {
    const p = partnerOf(o.partnerId);
    const split = computePartnerAmount(o.revenue, o.vatRate, resolvePct(o), p?.partnerRole);
    return sum + split.remittedToCompany;
  }, 0);
  const handleBatchFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBatchDraft((d) => ({ ...d, attachmentData: reader.result, attachmentName: file.name, attachmentType: file.type }));
    reader.readAsDataURL(file);
  };
  const saveBatchSettlement = () => {
    if (!batchDraft.partnerId) { setBatchErr("Chọn đối tác cần xác nhận gộp."); return; }
    if (!batchDraft.invoiceNo) { setBatchErr("Cần nhập số hoá đơn tổng đối tác đã báo."); return; }
    const pid = Number(batchDraft.partnerId);
    const pending = pendingOrdersForBatch(pid);
    if (pending.length === 0) { setBatchErr("Đối tác này không có đơn nào đang chờ trong kỳ đang xem."); return; }
    const p = partnerOf(pid);
    const hasAttachment = !!batchDraft.attachmentData;
    const total = batchTotal(pid);
    const txId = Date.now();
    // Lưu lại % đã áp dụng cho TỪNG đơn tại đúng thời điểm gộp — mỗi đơn có thể rơi vào bậc khác
    // nhau nếu doanh thu cộng dồn vượt mốc giữa chừng trong tháng.
    const pctByOrderId = {};
    pending.forEach((o) => { pctByOrderId[o.id] = resolvePct(o); });
    setTransactions((prev) => [...prev, {
      id: txId, date: TODAY_STR, kind: "thu", category: "Bán hàng (qua đối tác phân phối)",
      desc: `Gộp ${pending.length} đơn qua ${p?.name || "đối tác"} (HĐ tổng #${batchDraft.invoiceNo})`, amount: Math.round(total),
      partnerName: p?.name || "", partnerTaxCode: "", paymentMethod: "chuyen_khoan",
      invoiceType: "Biên lai / Phiếu thu nội bộ", invoiceNo: batchDraft.invoiceNo, vatRate: pending[0]?.vatRate || 8,
      attachmentData: batchDraft.attachmentData, attachmentName: batchDraft.attachmentName, attachmentType: batchDraft.attachmentType,
      status: hasAttachment ? "approved" : "pending", source: "hoptac", sourceOrderId: null,
    }]);
    const pendingIds = new Set(pending.map((o) => o.id));
    setDistOrders((prev) => prev.map((x) => (pendingIds.has(x.id) ? { ...x, partnerInvoiceReceived: hasAttachment, partnerInvoiceConfirmed: true, partnerInvoiceNo: batchDraft.invoiceNo, linkedTxId: txId, batchSettled: true, commissionPct: pctByOrderId[x.id] } : x)));
    setBatchDraft({ partnerId: "", invoiceNo: "", attachmentData: "", attachmentName: "", attachmentType: "" });
    setBatchErr("");
    setShowBatchModal(false);
  };

  const [distSearch, setDistSearch] = useState("");
  const distSearchQ = distSearch.trim().toLowerCase();
  const matchesDistSearch = (o) => {
    if (!distSearchQ) return true;
    const srcOrder = o.sourceCrmOrderId ? (orders || []).find((x) => x.id === o.sourceCrmOrderId) : null;
    return (o.endCustomerName || "").toLowerCase().includes(distSearchQ)
      || (srcOrder?.phone || "").includes(distSearchQ)
      || (srcOrder?.email || "").toLowerCase().includes(distSearchQ);
  };
  // Có tìm kiếm thì bỏ qua giới hạn kỳ — tìm xuyên suốt mọi tháng.
  const salesOrders = distOrders.filter((o) => o.orderKind !== "purchase" && (distSearchQ ? matchesDistSearch(o) : inPeriod(o)));
  const purchaseOrders = distOrders.filter((o) => o.orderKind === "purchase" && (distSearchQ ? matchesDistSearch(o) : inPeriod(o)));
  const totalRevenue = salesOrders.reduce((a, o) => a + o.revenue, 0);
  const totalCommission = salesOrders.reduce((a, o) => a + computePartnerAmount(o.revenue, o.vatRate, resolvePct(o), partnerOf(o.partnerId)?.partnerRole).commissionAmount, 0);
  const totalRemitted = salesOrders.reduce((a, o) => a + computePartnerAmount(o.revenue, o.vatRate, resolvePct(o), partnerOf(o.partnerId)?.partnerRole).remittedToCompany, 0);
  const pendingInvoiceCount = salesOrders.filter((o) => !o.partnerInvoiceReceived).length;
  const totalPurchaseCost = purchaseOrders.reduce((a, o) => a + o.totalCost, 0);

  // Tổng hợp theo ĐỐI TÁC + SẢN PHẨM — tách rõ đã nhận tiền / còn phải thu, để biết chính xác
  // đang chờ thu bao nhiêu từ từng công ty, từng sản phẩm — không gộp lẫn lộn tất cả vào 1 con số.
  const summaryByPartnerProduct = (() => {
    const map = {};
    salesOrders.forEach((o) => {
      const key = `${o.partnerId}__${o.productName}`;
      if (!map[key]) map[key] = { partnerId: o.partnerId, productName: o.productName, receivedCount: 0, receivedAmount: 0, pendingCount: 0, pendingAmount: 0 };
      const p = partnerOf(o.partnerId);
      const split = computePartnerAmount(o.revenue, o.vatRate, resolvePct(o), p?.partnerRole);
      if (o.partnerInvoiceReceived) {
        map[key].receivedCount += 1;
        map[key].receivedAmount += split.remittedToCompany;
      } else {
        map[key].pendingCount += 1;
        map[key].pendingAmount += split.remittedToCompany;
      }
    });
    return Object.values(map).sort((a, b) => nameOf(a.partnerId).localeCompare(nameOf(b.partnerId)));
  })();

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-lg border border-paper-line p-3 text-xs text-muted flex items-start gap-2">
        <Link2 size={13} className="text-ink-light shrink-0 mt-0.5" />
        <span>Đối tác phân phối bán hộ sản phẩm (VD: mã key kích hoạt ứng dụng) — <strong className="text-charcoal">đối tác trực tiếp cấp mã cho khách khi khách mua thành công</strong>, sau đó ăn hoa hồng % theo doanh thu. Về nguyên tắc <strong className="text-charcoal">đối tác phải xuất hoá đơn VAT</strong> cho phần hoa hồng đó — đây là chứng từ chi phí hợp lệ của công ty, nên bắt buộc đính kèm trước khi ghi nhận vào Thu Chi. Nếu sản phẩm có thời hạn, nhớ ghi lại mã key đã cấp để tra cứu/hỗ trợ khách sau này (xem bảng theo hạn ở tab Kho hàng).</span>
      </div>

      {syncMsg && (
        <div className="bg-ledger-green/10 border border-ledger-green rounded-lg p-3 text-xs text-charcoal flex items-center gap-2">
          <CheckCircle2 size={14} className="text-ledger-green shrink-0" /> {syncMsg}
        </div>
      )}

      {summaryByPartnerProduct.length > 0 && (
        <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
          <div className="px-4 pt-3 pb-1 text-xs font-semibold text-ink uppercase">Tổng hợp theo Đối tác + Sản phẩm — đã nhận / còn phải thu cuối tháng</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-paper text-left text-xs uppercase text-muted">
                <th className="px-4 py-2">Đối tác</th><th className="px-4 py-2">Sản phẩm</th>
                <th className="px-4 py-2 text-right">Đã nhận</th><th className="px-4 py-2 text-right">Số đơn đã nhận</th>
                <th className="px-4 py-2 text-right">Còn phải thu</th><th className="px-4 py-2 text-right">Số đơn chưa nhận</th>
              </tr>
            </thead>
            <tbody>
              {summaryByPartnerProduct.map((s, i) => (
                <tr key={i} className={`border-t border-paper-line ${s.pendingAmount > 0 ? "ktns-warn-row" : ""}`}>
                  <td className="px-4 py-2 font-medium">{nameOf(s.partnerId)}</td>
                  <td className="px-4 py-2">{s.productName}</td>
                  <td className="px-4 py-2 text-right ktns-mono text-ledger-green">{fmtVND(s.receivedAmount)}</td>
                  <td className="px-4 py-2 text-right ktns-mono text-muted">{s.receivedCount}</td>
                  <td className="px-4 py-2 text-right ktns-mono text-stamp-red font-semibold">{s.pendingAmount > 0 ? fmtVND(s.pendingAmount) : "—"}</td>
                  <td className="px-4 py-2 text-right ktns-mono text-muted">{s.pendingCount || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2.5 text-[11px] text-muted border-t border-paper-line">* "Còn phải thu" là số tiền công ty bạn còn đang chờ đối tác trả về — dùng để đối chiếu khi họ tổng hợp cuối tháng, biết chính xác từng đối tác/sản phẩm còn nợ bao nhiêu.</p>
        </div>
      )}

      <div className="bg-white rounded-lg border border-paper-line p-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={distSearch}
            onChange={(e) => setDistSearch(e.target.value)}
            placeholder="Tìm theo tên khách, SĐT, email — tìm xuyên suốt mọi tháng..."
            className="w-full border border-paper-line rounded-md pl-8 pr-2 py-1.5 text-xs"
          />
        </div>
        {!distSearchQ && (
          <RangeModePicker rangeMode={rangeMode} setRangeMode={setRangeMode} rangeFrom={rangeFrom} setRangeFrom={setRangeFrom} rangeTo={rangeTo} setRangeTo={setRangeTo} reportMonth={reportMonth} reportYear={reportYear} show={showRangePicker} setShow={setShowRangePicker} />
        )}
        <span className="text-[11px] text-muted">{salesOrders.length + purchaseOrders.length}/{distOrders.length} đơn{distSearchQ ? " khớp tìm kiếm (mọi tháng)" : " trong kỳ"}</span>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <KpiCard icon={TrendingUp} label="Tổng doanh thu bán/nhượng quyền" value={fmtVND(totalRevenue)} tone="up" />
        <KpiCard icon={Handshake} label="Tổng hoa hồng/phí đối tác" value={fmtVND(totalCommission)} tone="down" />
        <KpiCard icon={Wallet} label="Công ty thực nhận" value={fmtVND(totalRemitted)} tone={totalRemitted >= 0 ? "up" : "down"} />
        <KpiCard icon={AlertTriangle} label="Chờ hoá đơn VAT đối tác" value={pendingInvoiceCount} tone={pendingInvoiceCount > 0 ? "down" : "up"} />
        <KpiCard icon={Package} label="Tổng tiền nhập hàng (mua đứt)" value={fmtVND(totalPurchaseCost)} tone="down" />
      </div>

      <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="text-xs font-semibold text-ink uppercase flex items-center gap-1.5"><Handshake size={13} /> Đối tác phân phối</div>
          <button onClick={() => { setEditingPartnerId(null); setShowPartnerForm(true); }} className="text-xs bg-ink text-white px-2.5 py-1.5 rounded-md hover:bg-ink-light flex items-center gap-1"><Plus size={12} /> Thêm đối tác</button>
        </div>
        {showPartnerForm && (
          <div className="mx-4 mb-3 bg-paper border border-paper-line rounded-md p-3">
            <div className="text-[11px] font-semibold text-ink uppercase mb-2">{editingPartnerId ? "Sửa đối tác" : "Đối tác mới"}</div>
            <div className="grid grid-cols-4 gap-2">
              <input value={partnerForm.name} onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })} placeholder="Tên đối tác/công ty" className="border border-paper-line rounded px-2 py-1.5 text-xs col-span-2" />
              <input value={partnerForm.taxCode} onChange={(e) => setPartnerForm({ ...partnerForm, taxCode: e.target.value })} placeholder="MST đối tác" className="border border-paper-line rounded px-2 py-1.5 text-xs ktns-mono" />
              <input value={partnerForm.phone} onChange={(e) => setPartnerForm({ ...partnerForm, phone: e.target.value })} placeholder="SĐT" className="border border-paper-line rounded px-2 py-1.5 text-xs ktns-mono" />
            </div>

            <div className="mt-3">
              <div className="text-[11px] font-semibold text-ink uppercase mb-1.5">Vai trò hợp tác — quyết định ai xuất hoá đơn VAT cho khách</div>
              <div className="flex flex-col gap-1.5">
                {Object.entries(PARTNER_ROLES).map(([id, meta]) => (
                  <label key={id} className={`flex items-start gap-2 text-xs border rounded px-2.5 py-2 cursor-pointer ${partnerForm.partnerRole === id ? "border-ink bg-white" : "border-paper-line bg-white/50"}`}>
                    <input type="radio" name="partnerRole" checked={partnerForm.partnerRole === id} onChange={() => setPartnerForm({ ...partnerForm, partnerRole: id })} className="mt-0.5" />
                    <span>
                      <span className="font-semibold text-ink">{meta.label}</span> — <span className="text-ink-light">bên xuất HĐ cho khách: {meta.who_invoices_customer}</span>
                      <div className="text-[10px] text-muted mt-0.5">{meta.desc}</div>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <div className="text-[11px] font-semibold text-ink uppercase mb-1.5 flex items-center justify-between">
                <span>Sản phẩm đối tác này cung cấp/phân phối</span>
                <button onClick={() => setShowNewProductForm((v) => !v)} className="text-[10px] bg-ink text-white px-2 py-1 rounded flex items-center gap-1"><Plus size={10} /> Thêm sản phẩm mới</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(inventory || []).length === 0 && <span className="text-xs text-muted">Chưa có sản phẩm nào trong Kho hàng.</span>}
                {(inventory || []).map((p) => (
                  <label key={p.id} className="flex items-center gap-1.5 text-xs bg-white border border-paper-line rounded px-2 py-1 cursor-pointer">
                    <input type="checkbox" checked={partnerForm.productIds.includes(p.id)} onChange={() => toggleProductForPartner(p.id)} />
                    {p.name}
                  </label>
                ))}
              </div>
              {showNewProductForm && (
                <div className="mt-2 bg-white border border-paper-line rounded-md p-2.5">
                  <div className="text-[10px] text-muted mb-1.5">Sản phẩm mới này sẽ tự lưu vào Kho hàng và gán ngay cho đối tác đang sửa — chọn được luôn ở CRM/Sale sau đó. Nếu sản phẩm có nhiều gói thời hạn giá khác nhau (VD "AI Agent" 1/3/6/12 tháng), đặt cùng "Nhóm sản phẩm" cho các gói để gộp chung.</div>
                  <div className="grid grid-cols-4 gap-2">
                    <input value={newProductForm.sku} onChange={(e) => setNewProductForm({ ...newProductForm, sku: e.target.value })} placeholder="SKU (VD: AI-1M)" className="border border-paper-line rounded px-2 py-1 text-xs ktns-mono" />
                    <input value={newProductForm.name} onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })} placeholder="Tên sản phẩm/gói" className="border border-paper-line rounded px-2 py-1 text-xs col-span-2" />
                    <input value={newProductForm.unit} onChange={(e) => setNewProductForm({ ...newProductForm, unit: e.target.value })} placeholder="Đơn vị (VD: mã)" className="border border-paper-line rounded px-2 py-1 text-xs" />
                    <input value={newProductForm.groupName} onChange={(e) => setNewProductForm({ ...newProductForm, groupName: e.target.value })} placeholder="Nhóm sản phẩm (VD: AI Agent)" className="border border-paper-line rounded px-2 py-1 text-xs col-span-2" />
                    <input type="number" min="0" value={newProductForm.durationMonths} onChange={(e) => setNewProductForm({ ...newProductForm, durationMonths: e.target.value })} placeholder="Thời hạn (tháng, 0=không)" className="border border-paper-line rounded px-2 py-1 text-xs ktns-mono" />
                    <div><MoneyInput value={newProductForm.costPrice} onChange={(v) => setNewProductForm({ ...newProductForm, costPrice: v })} className="border border-paper-line rounded px-2 py-1 text-xs ktns-mono w-full" /><span className="text-[9px] text-muted">Giá nhập</span></div>
                    <div><MoneyInput value={newProductForm.sellPrice} onChange={(v) => setNewProductForm({ ...newProductForm, sellPrice: v })} className="border border-paper-line rounded px-2 py-1 text-xs ktns-mono w-full" /><span className="text-[9px] text-muted">Giá bán (đã gồm VAT)</span></div>
                    <select value={newProductForm.vatRate} onChange={(e) => setNewProductForm({ ...newProductForm, vatRate: Number(e.target.value) })} className="border border-paper-line rounded px-2 py-1 text-xs ktns-mono">{VAT_RATE_OPTIONS.map((r) => (<option key={r} value={r}>VAT {r}%</option>))}</select>
                    <input type="number" min="0" value={newProductForm.stock} onChange={(e) => setNewProductForm({ ...newProductForm, stock: e.target.value })} placeholder="Tồn kho ban đầu" className="border border-paper-line rounded px-2 py-1 text-xs ktns-mono" />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={addProductFromPartner} className="text-[10px] bg-ledger-green text-white px-2.5 py-1 rounded">Lưu sản phẩm &amp; gán cho đối tác</button>
                    <button onClick={() => setShowNewProductForm(false)} className="text-[10px] border border-paper-line px-2.5 py-1 rounded text-muted">Huỷ</button>
                  </div>
                </div>
              )}
            </div>

            {partnerForm.partnerRole === "nha_cung_cap" ? (
              <div className="mt-3 text-[11px] text-ink-light bg-white border border-paper-line rounded px-2.5 py-2">
                Đối tác vai trò "Nhà cung cấp" không cần khai % hoa hồng — giá mua khai theo từng lần nhập hàng ở form "Thêm đơn nhập hàng", và công ty bạn tự bán lại + tự xuất hoá đơn cho khách ở tab Doanh thu CRM như bình thường.
              </div>
            ) : (
              <div className="mt-3">
                <div className="text-[11px] font-semibold text-ink uppercase mb-1.5 flex items-center justify-between">
                  <span>{partnerForm.partnerRole === "nhuong_quyen" ? "Bậc phí nhượng quyền theo doanh thu — % này công ty bạn phải trả cho đối tác" : "Bậc hoa hồng theo doanh thu (tính trên phần sau VAT) — đối tác lấy % này, phần còn lại nộp về công ty"}</span>
                  <button onClick={addTierRow} className="text-[10px] bg-ink text-white px-2 py-1 rounded">+ Thêm bậc</button>
                </div>
                <div className="bg-white border border-paper-line rounded px-2.5 py-2 mb-2 text-[10px] text-ink-light">
                  <strong className="text-charcoal">Cách dùng để mô phỏng thưởng/phạt theo chỉ tiêu:</strong> đặt bậc <strong>thấp nhất</strong> (từ 0đ) là mức <strong className="text-stamp-red">"chưa đạt chỉ tiêu"</strong> — % cao nhất (bất lợi cho {partnerForm.partnerRole === "nhuong_quyen" ? "công ty bạn" : "đối tác"}); đặt bậc <strong>ở đúng mức chỉ tiêu thoả thuận</strong> — % chuẩn; thêm bậc <strong className="text-ledger-green">cao hơn</strong> khi vượt chỉ tiêu — % thấp hơn (được ưu ái). Hệ thống tự chọn đúng bậc theo doanh thu cộng dồn tháng, tự nhảy lên/xuống theo kết quả thật, không cần chỉnh tay.
                </div>
                <div className="flex flex-col gap-2">
                  {partnerForm.commissionTiers.map((t, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-[11px] text-muted w-24 shrink-0 mt-2">Từ doanh thu</span>
                      <div className="w-40">
                        <MoneyInput value={t.minRevenue} onChange={(v) => updateTierRow(i, "minRevenue", v)} className="border border-paper-line rounded px-2 py-1 text-xs ktns-mono w-full" />
                      </div>
                      <span className="text-[11px] text-muted mt-2">đ trở lên → {partnerForm.partnerRole === "nhuong_quyen" ? "phí" : "đối tác lấy"}</span>
                      <input type="number" value={t.pct} onChange={(e) => updateTierRow(i, "pct", e.target.value)} className="border border-paper-line rounded px-2 py-1 text-xs ktns-mono w-16 mt-0.5" />
                      <span className="text-[11px] text-muted mt-2">%</span>
                      <button onClick={() => removeTierRow(i)} className="text-muted hover:text-stamp-red ml-auto mt-1.5"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted mt-1.5">VD: dưới 50 triệu (chưa đạt chỉ tiêu) → 40%, từ 50 triệu (đạt chỉ tiêu) → 36%, từ 100 triệu (vượt chỉ tiêu, được ưu ái) → 33%. Sửa số theo đúng thoả thuận thật với từng đối tác.</p>
              </div>
            )}

            <div className="flex gap-2 mt-3">
              <button onClick={addPartner} className="text-xs bg-ledger-green text-white px-3 py-1.5 rounded-md">{editingPartnerId ? "Cập nhật đối tác" : "Lưu đối tác"}</button>
              <button onClick={closePartnerForm} className="text-xs border border-paper-line px-3 py-1.5 rounded-md text-muted">Huỷ</button>
            </div>
          </div>
        )}
        <table className="w-full text-sm">
          <thead><tr className="bg-paper text-left text-xs uppercase text-muted"><th className="px-4 py-2">Đối tác</th><th className="px-4 py-2">Vai trò</th><th className="px-4 py-2">MST</th><th className="px-4 py-2">Sản phẩm cung cấp</th><th className="px-4 py-2">Bậc hoa hồng/phí</th><th className="px-4 py-2"></th></tr></thead>
          <tbody>
            {partners.length === 0 && <tr><td colSpan={6} className="px-4 py-4 text-center text-xs text-muted">Chưa có đối tác phân phối nào.</td></tr>}
            {partners.map((p) => (
              <tr key={p.id} className="border-t border-paper-line">
                <td className="px-4 py-2 font-medium">{p.name}</td>
                <td className="px-4 py-2 text-[10px]">{PARTNER_ROLES[p.partnerRole || "dai_ly"]?.label}</td>
                <td className="px-4 py-2 ktns-mono text-xs text-muted">{p.taxCode || "—"}</td>
                <td className="px-4 py-2 text-xs">{(p.productIds || []).map((pid) => (inventory || []).find((i) => i.id === pid)?.name).filter(Boolean).join(", ") || "—"}</td>
                <td className="px-4 py-2 text-xs">
                  {p.partnerRole === "nha_cung_cap" ? <span className="text-muted">Theo giá từng lần nhập</span> : (p.commissionTiers || []).sort((a, b) => a.minRevenue - b.minRevenue).map((t, i) => (
                    <div key={i} className="ktns-mono">≥{fmtVND(t.minRevenue)}: {t.pct}%</div>
                  ))}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => startEditPartner(p)} className="text-muted hover:text-ink"><Pencil size={13} /></button>
                    <button onClick={() => removePartner(p.id)} className="text-muted hover:text-stamp-red"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted">{salesOrders.length} đơn bán/nhượng quyền · {purchaseOrders.length} đơn nhập hàng đã ghi nhận.</p>
        <div className="flex gap-2">
          <button onClick={() => exportDistributionExcel(distOrders, partners)} className="flex items-center gap-1.5 text-sm bg-ledger-green text-white px-3.5 py-2 rounded-md hover:opacity-90"><FileSpreadsheet size={15} /> Xuất Excel</button>
          <button onClick={() => { setBatchDraft({ partnerId: partners[0]?.id || "", invoiceNo: "", attachmentData: "", attachmentName: "", attachmentType: "" }); setBatchErr(""); setShowBatchModal(true); }} disabled={partners.length === 0} className="flex items-center gap-1.5 text-sm border border-gold text-gold px-3.5 py-2 rounded-md hover:bg-gold/10 disabled:opacity-40"><Layers size={15} /> Xác nhận gộp cả tháng</button>
          <button onClick={() => { setPurchaseForm((f) => ({ ...f, partnerId: partners.find((p) => p.partnerRole === "nha_cung_cap")?.id || partners[0]?.id || "" })); setShowPurchaseForm(true); }} disabled={partners.length === 0} className="flex items-center gap-1.5 text-sm border border-paper-line text-ink px-3.5 py-2 rounded-md hover:border-gold disabled:opacity-40"><Plus size={15} /> Thêm đơn nhập hàng</button>
          <button onClick={() => { setOrderForm((f) => ({ ...f, partnerId: partners[0]?.id || "" })); setShowOrderForm(true); }} disabled={partners.length === 0} className="flex items-center gap-1.5 text-sm bg-ink text-white px-3.5 py-2 rounded-md hover:bg-ink-light disabled:opacity-40"><Plus size={15} /> Thêm đơn bán/nhượng quyền</button>
        </div>
      </div>
      {partners.length === 0 && <p className="text-xs text-gold flex items-center gap-1.5"><AlertTriangle size={12} /> Thêm đối tác phân phối trước khi ghi đơn.</p>}

      {showBatchModal && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-6" onClick={() => setShowBatchModal(false)}>
          <div className="bg-white rounded-lg p-5 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="ktns-serif font-semibold text-ink mb-1">Xác nhận thanh toán gộp cả tháng</h3>
            <p className="text-xs text-muted mb-3">Dùng khi đối tác KHÔNG xuất hoá đơn riêng từng đơn mà gộp lại xuất 1 hoá đơn tổng cuối tháng (VD Say Media) — chọn đối tác, hệ thống tự cộng hết các đơn đang "chờ" của đối tác đó trong kỳ đang xem, ghi 1 khoản Chi duy nhất.</p>
            <label className="text-xs text-muted flex flex-col gap-1 mb-2">Đối tác
              <select value={batchDraft.partnerId} onChange={(e) => setBatchDraft({ ...batchDraft, partnerId: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm">
                {partners.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </label>
            {batchDraft.partnerId && (
              <div className="bg-paper rounded px-2.5 py-2 mb-2 text-xs">
                <strong className="text-charcoal">{pendingOrdersForBatch(batchDraft.partnerId).length} đơn đang chờ</strong> trong kỳ đang xem — tổng phải trả: <strong className="ktns-mono text-stamp-red">{fmtVND(batchTotal(batchDraft.partnerId))}</strong>
              </div>
            )}
            <label className="text-xs text-muted flex flex-col gap-1 mb-2">Số hoá đơn tổng đối tác đã báo<input value={batchDraft.invoiceNo} onChange={(e) => setBatchDraft({ ...batchDraft, invoiceNo: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Đính kèm ảnh/file hoá đơn tổng <span className="text-ink-light">(có sau cũng được)</span>
              <input type="file" accept="image/*,.pdf" onChange={handleBatchFile} className="border border-paper-line rounded px-2 py-1.5 text-sm bg-white" />
              {batchDraft.attachmentName && <span className="text-[11px] text-ledger-green flex items-center gap-1 mt-1"><CheckCircle2 size={11} /> {batchDraft.attachmentName}</span>}
            </label>
            {batchErr && <p className="text-xs text-stamp-red mt-2 flex items-center gap-1"><AlertTriangle size={12} /> {batchErr}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={saveBatchSettlement} className="bg-gold text-white text-sm px-3 py-1.5 rounded-md hover:opacity-90">Xác nhận gộp &amp; ghi Thu Chi</button>
              <button onClick={() => setShowBatchModal(false)} className="border border-paper-line text-sm px-3 py-1.5 rounded-md text-muted">Huỷ</button>
            </div>
          </div>
        </div>
      )}

      {showOrderForm && (
        <div className="bg-white rounded-lg border border-paper-line p-5 relative">
          <button className="absolute top-3 right-3 text-muted" onClick={() => setShowOrderForm(false)}><X size={16} /></button>
          <h3 className="ktns-serif font-semibold text-ink mb-4">Đơn phân phối mới</h3>
          <div className="grid grid-cols-4 gap-3">
            <label className="text-xs text-muted flex flex-col gap-1">Ngày<input type="date" value={orderForm.date} onChange={(e) => setOrderForm({ ...orderForm, date: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Đối tác phân phối
              <select value={orderForm.partnerId} onChange={(e) => selectPartnerForOrder(e.target.value)} className="border border-paper-line rounded px-2 py-1.5 text-sm">
                {partners.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </label>
            <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Sản phẩm (chỉ hiện đúng sản phẩm đối tác này được gán ở Kho hàng)
              <select value={orderForm.productId} onChange={(e) => selectDistProduct(e.target.value)} disabled={availableProductsForOrder.length === 0} className="border border-paper-line rounded px-2 py-1.5 text-sm disabled:bg-paper disabled:text-muted">
                <option value="">— Không thuộc kho (dịch vụ/khác) —</option>
                {availableProductsForOrder.map((p) => (<option key={p.id} value={p.id}>{p.name}{p.durationMonths > 0 ? ` (${p.durationMonths} tháng)` : ""} — tồn {p.stock} {p.unit} — {fmtVND(p.sellPrice)} (đã gồm VAT {p.vatRate || 0}%)</option>))}
              </select>
              {availableProductsForOrder.length === 0 && (
                <span className="text-[10px] text-gold">Đối tác này chưa được gán sản phẩm nào ở Kho hàng — vào "Sửa đối tác" để gán, hoặc gõ tay tên dịch vụ bên dưới.</span>
              )}
            </label>
            {!orderForm.productId && (
              <label className="text-xs text-muted flex flex-col gap-1">Tên sản phẩm/dịch vụ<input value={orderForm.productName} onChange={(e) => setOrderForm({ ...orderForm, productName: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            )}
            {orderForm.productId && (
              <label className="text-xs text-muted flex flex-col gap-1">Số lượng<input type="number" min="1" value={orderForm.quantity} onChange={(e) => updateDistQty(e.target.value)} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
            )}
            <label className="text-xs text-muted flex flex-col gap-1">Doanh thu bán được (đ)<MoneyInput value={orderForm.revenue} onChange={(v) => setOrderForm({ ...orderForm, revenue: v })} /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Thuế suất VAT đối tác xuất<select value={orderForm.vatRate} onChange={(e) => setOrderForm({ ...orderForm, vatRate: Number(e.target.value) })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono">{VAT_RATE_OPTIONS.map((r) => (<option key={r} value={r}>{r}%</option>))}</select></label>
            <label className="text-xs text-muted flex flex-col gap-1">Tên khách hàng cuối (nếu đối tác cho biết)<input value={orderForm.endCustomerName} onChange={(e) => setOrderForm({ ...orderForm, endCustomerName: e.target.value })} placeholder="Đối tác cấp mã cho khách nào" className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            {(() => {
              const p = orderForm.productId ? (inventory || []).find((i) => i.id === Number(orderForm.productId)) : null;
              return p && p.durationMonths > 0 ? (
                <label className="text-xs text-muted flex flex-col gap-1">Mã key đối tác đã cấp<input value={orderForm.issuedKeyCode} onChange={(e) => setOrderForm({ ...orderForm, issuedKeyCode: e.target.value })} placeholder="VD: ABCD-1234-EFGH" className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
              ) : null;
            })()}
            <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Ghi chú<input value={orderForm.note} onChange={(e) => setOrderForm({ ...orderForm, note: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
          </div>
          {orderForm.revenue && orderForm.partnerId && (() => {
            const p = partnerOf(Number(orderForm.partnerId));
            const revenue = Number(orderForm.revenue) || 0;
            const monthlySoFar = getPartnerMonthlyRevenue(Number(orderForm.partnerId), orderForm.date, distOrders);
            const monthlyWithThis = monthlySoFar + revenue;
            const commissionPct = lookupCommissionTier(monthlyWithThis, p?.commissionTiers);
            const split = computePartnerAmount(revenue, orderForm.vatRate, commissionPct, p?.partnerRole);
            const isFranchise = p?.partnerRole === "nhuong_quyen";
            const feeLabel = isFranchise ? "phí nhượng quyền" : "hoa hồng";
            return (
              <div className="mt-3 text-xs bg-paper rounded px-3 py-2 flex flex-col gap-1">
                <div className="text-[10px] text-ink-light">Đã có {fmtVND(monthlySoFar)} doanh thu tháng {orderForm.date.slice(0, 7)} với {p?.name} → cộng đơn này thành {fmtVND(monthlyWithThis)} → áp mức <strong>{commissionPct}%</strong> cho toàn bộ đơn tháng này.</div>
                <div className="flex justify-between"><span className="text-muted">1. Doanh thu {isFranchise ? "công ty thu được" : "thu được"}</span><strong className="ktns-mono">{fmtVND(revenue)}</strong></div>
                <div className="flex justify-between"><span className="text-muted">2. Trừ VAT ({orderForm.vatRate}%, {isFranchise ? "đối tác chịu" : "đối tác xuất"})</span><strong className="ktns-mono text-stamp-red">− {fmtVND(split.vatAmount)}</strong></div>
                <div className="flex justify-between border-t border-paper-line pt-1"><span className="text-muted">3. Còn lại sau VAT</span><strong className="ktns-mono">{fmtVND(split.netOfVat)}</strong></div>
                <div className="flex justify-between"><span className="text-muted">4. Đối tác lấy {feeLabel} ({commissionPct}% — theo doanh thu cộng dồn tháng, tính trên phần sau VAT)</span><strong className="ktns-mono text-stamp-red">− {fmtVND(split.commissionAmount)}</strong></div>
                <div className="flex justify-between border-t border-paper-line pt-1"><span className="text-charcoal font-medium">5. Công ty thực nhận (đối tác nộp lại)</span><strong className="ktns-mono text-ledger-green">{fmtVND(split.remittedToCompany)}</strong></div>
              </div>
            );
          })()}
          <button onClick={addDistOrder} className="mt-4 bg-ledger-green text-white text-sm px-4 py-2 rounded-md hover:opacity-90">Lưu đơn</button>
        </div>
      )}

      {showPurchaseForm && (
        <div className="bg-white rounded-lg border border-paper-line p-5 relative">
          <button className="absolute top-3 right-3 text-muted" onClick={() => { setShowPurchaseForm(false); setPurchaseErr(""); }}><X size={16} /></button>
          <h3 className="ktns-serif font-semibold text-ink mb-1">Nhập hàng từ nhà cung cấp (mua đứt bán lại)</h3>
          <p className="text-[11px] text-muted mb-3">Công ty bạn mua sản phẩm này, sau đó tự bán lại cho khách và tự xuất hoá đơn ở tab Doanh thu CRM như bình thường. Lợi nhuận = giá bán − giá mua.</p>
          <div className="grid grid-cols-4 gap-3">
            <label className="text-xs text-muted flex flex-col gap-1">Ngày<input type="date" value={purchaseForm.date} onChange={(e) => setPurchaseForm({ ...purchaseForm, date: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Nhà cung cấp
              <select value={purchaseForm.partnerId} onChange={(e) => setPurchaseForm({ ...purchaseForm, partnerId: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm">
                {partners.map((p) => (<option key={p.id} value={p.id}>{p.name}{p.partnerRole !== "nha_cung_cap" ? " (chưa đặt vai trò Nhà cung cấp)" : ""}</option>))}
              </select>
            </label>
            <label className="text-xs text-muted flex flex-col gap-1">Sản phẩm
              <select value={purchaseForm.productId} onChange={(e) => setPurchaseForm({ ...purchaseForm, productId: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm">
                <option value="">— Chọn sản phẩm trong Kho hàng —</option>
                {(inventory || []).map((p) => (<option key={p.id} value={p.id}>{p.name}{p.durationMonths > 0 ? ` (${p.durationMonths} tháng)` : ""} — tồn {p.stock} {p.unit}</option>))}
              </select>
            </label>
            <label className="text-xs text-muted flex flex-col gap-1">Số lượng<input type="number" min="1" value={purchaseForm.quantity} onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Đơn giá mua — đã gồm VAT (đ)<MoneyInput value={purchaseForm.unitCost} onChange={(v) => setPurchaseForm({ ...purchaseForm, unitCost: v })} /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Thuế suất VAT đầu vào<select value={purchaseForm.vatRate} onChange={(e) => setPurchaseForm({ ...purchaseForm, vatRate: Number(e.target.value) })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono">{VAT_RATE_OPTIONS.map((r) => (<option key={r} value={r}>{r}%</option>))}</select></label>
            <label className="text-xs text-muted flex flex-col gap-1">Số hoá đơn NCC<input value={purchaseForm.invoiceNo} onChange={(e) => setPurchaseForm({ ...purchaseForm, invoiceNo: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
            <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Đính kèm hoá đơn VAT của NCC <span className="text-stamp-red">* bắt buộc</span>
              <input type="file" accept="image/*,.pdf" onChange={handlePurchaseFile} className="border border-paper-line rounded px-2 py-1.5 text-sm bg-white" />
              {purchaseForm.attachmentName && <span className="text-[11px] text-ledger-green flex items-center gap-1 mt-1"><CheckCircle2 size={11} /> {purchaseForm.attachmentName}</span>}
            </label>
            <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Ghi chú<input value={purchaseForm.note} onChange={(e) => setPurchaseForm({ ...purchaseForm, note: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
          </div>
          {purchaseForm.unitCost && purchaseForm.productId && (() => {
            const total = Number(purchaseForm.unitCost) * (Number(purchaseForm.quantity) || 1);
            const vat = splitVAT(total, purchaseForm.vatRate);
            const product = (inventory || []).find((i) => i.id === Number(purchaseForm.productId));
            const margin = product ? product.sellPrice - Number(purchaseForm.unitCost) : null;
            return (
              <div className="mt-3 text-xs bg-paper rounded px-3 py-2 flex flex-col gap-1">
                <div className="flex justify-between"><span className="text-muted">Tổng tiền mua ({purchaseForm.quantity} x {fmtVND(purchaseForm.unitCost)})</span><strong className="ktns-mono">{fmtVND(total)}</strong></div>
                <div className="flex justify-between"><span className="text-muted">Trong đó VAT đầu vào ({purchaseForm.vatRate}%)</span><strong className="ktns-mono text-stamp-red">{fmtVND(vat.vatAmount)}</strong></div>
                {margin !== null && <div className="flex justify-between border-t border-paper-line pt-1"><span className="text-charcoal font-medium">Lợi nhuận biên/đơn vị (giá bán hiện tại − giá mua này)</span><strong className={`ktns-mono ${margin >= 0 ? "text-ledger-green" : "text-stamp-red"}`}>{fmtVND(margin)}</strong></div>}
              </div>
            );
          })()}
          {purchaseErr && <p className="text-xs text-stamp-red mt-2 flex items-center gap-1"><AlertTriangle size={12} /> {purchaseErr}</p>}
          <button onClick={addPurchase} className="mt-4 bg-ledger-green text-white text-sm px-4 py-2 rounded-md hover:opacity-90">Lưu đơn nhập hàng</button>
        </div>
      )}

      <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
        <div className="px-4 pt-3 pb-1 text-xs font-semibold text-ink uppercase">Đơn bán / Đại lý / Nhượng quyền</div>
        <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-paper text-left text-xs uppercase text-muted">
              <th className="px-4 py-2">STT</th>
              <th className="px-4 py-2">Ngày</th><th className="px-4 py-2">Sản phẩm</th><th className="px-4 py-2">Khách hàng</th><th className="px-4 py-2">Đối tác</th><th className="px-4 py-2">Vai trò</th>
              <th className="px-4 py-2 text-right">Doanh thu</th><th className="px-4 py-2 text-right">VAT</th>
              <th className="px-4 py-2 text-right">%</th>
              <th className="px-4 py-2 text-right">Hoa hồng/Phí</th><th className="px-4 py-2 text-right">Công ty nhận</th>
              <th className="px-4 py-2">HĐ VAT đối tác</th><th className="px-4 py-2"></th><th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {salesOrders.length === 0 && <tr><td colSpan={14} className="px-4 py-6 text-center text-xs text-muted">Chưa có đơn bán/nhượng quyền nào.</td></tr>}
            {salesOrders.map((o, idx) => ({ ...o, _stt: idx + 1 })).slice().reverse().map((o) => {
              const p = partnerOf(o.partnerId);
              const pct = resolvePct(o);
              const split = computePartnerAmount(o.revenue, o.vatRate, pct, p?.partnerRole);
              const isFranchise = p?.partnerRole === "nhuong_quyen";
              const srcOrder = o.sourceCrmOrderId ? (orders || []).find((x) => x.id === o.sourceCrmOrderId) : null;
              const isExpanded = expandedDistId === o.id;
              return (
                <React.Fragment key={o.id}>
                <tr className={`border-t border-paper-line cursor-pointer hover:bg-paper/40 ${!o.partnerInvoiceReceived ? "ktns-warn-row" : ""}`} onClick={() => setExpandedDistId(isExpanded ? null : o.id)}>
                  <td className="px-4 py-2 ktns-mono text-xs text-muted">{o._stt}</td>
                  <td className="px-4 py-2 ktns-mono text-xs text-muted">{o.date}</td>
                  <td className="px-4 py-2">{o.productName}</td>
                  <td className="px-4 py-2 text-xs">{o.endCustomerName || srcOrder?.customerName || "—"}</td>
                  <td className="px-4 py-2 text-xs">{nameOf(o.partnerId)}</td>
                  <td className="px-4 py-2 text-[10px]">{isFranchise ? <span className="text-gold">Nhượng quyền</span> : <span className="text-ink-light">Đại lý</span>}</td>
                  <td className="px-4 py-2 text-right ktns-mono text-ledger-green">{fmtVND(o.revenue)}</td>
                  <td className="px-4 py-2 text-right ktns-mono text-muted">{o.vatRate}%</td>
                  <td className="px-4 py-2 text-right ktns-mono">{pct}%</td>
                  <td className="px-4 py-2 text-right ktns-mono text-stamp-red">{fmtVND(split.commissionAmount)}</td>
                  <td className="px-4 py-2 text-right ktns-mono font-semibold">{fmtVND(split.remittedToCompany)}</td>
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openInvoiceModal(o)}>
                      {o.partnerInvoiceReceived ? <StampBadge text="ĐÃ NHẬN ĐỦ" gold /> : o.partnerInvoiceConfirmed ? <StampBadge text="ĐÃ XÁC NHẬN — CHỜ CHỨNG TỪ" muted /> : <StampBadge text="CHỜ HĐ VAT" />}
                    </button>
                    {o.partnerInvoiceConfirmed && o.linkedTxId && (
                      <button onClick={() => setViewingAttachment(o)} className="ml-1.5 text-[10px] text-ink-light underline">xem</button>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}><button onClick={() => removeDistOrder(o.id)} className="text-muted hover:text-stamp-red"><Trash2 size={14} /></button></td>
                  <td className="px-2 py-2 text-center"><ChevronRight size={14} className={`text-muted transition-transform inline-block ${isExpanded ? "rotate-90" : ""}`} /></td>
                </tr>
                {isExpanded && (
                  <tr className="bg-paper/60 border-t border-paper-line">
                    <td colSpan={14} className="px-4 py-3">
                      <div className="grid grid-cols-4 gap-3 text-xs">
                        <div><span className="text-muted">SĐT: </span><span className="ktns-mono">{srcOrder?.phone || "—"}</span></div>
                        <div><span className="text-muted">Email: </span><span className="ktns-mono">{srcOrder?.email || "—"}</span></div>
                        <div><span className="text-muted">Mã số thuế: </span><span className="ktns-mono">{srcOrder?.customerTaxCode || "— (khách cá nhân)"}</span></div>
                        <div><span className="text-muted">Sale phụ trách: </span>{(employees || []).find((e) => e.id === srcOrder?.saleEmployeeId)?.name || "—"}</div>
                        <div><span className="text-muted">Mã key đã cấp: </span><span className="ktns-mono">{o.issuedKeyCode || "chưa ghi"}</span></div>
                        <div><span className="text-muted">Ghi chú: </span>{o.note || "—"}</div>
                        <div><span className="text-muted">Nguồn CRM: </span>{o.sourceCrmOrderId ? `Đơn #${o.sourceCrmOrderId}${srcOrder ? " (đã tìm thấy)" : " (không tìm thấy — có thể đơn gốc đã bị xoá)"}` : "Tạo tay ở tab này"}</div>
                        <div><span className="text-muted">Số hoá đơn đối tác: </span>{o.partnerInvoiceNo || "chưa có"}</div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
      <p className="text-xs text-muted">* Công thức áp dụng cho MỌI vai trò đối tác (Đại lý lẫn Nhượng quyền): Doanh thu → trừ VAT → phần còn lại mới tính % hoa hồng/phí theo doanh thu cộng dồn cả tháng với đối tác đó → phần còn lại sau hoa hồng/phí là số đối tác nộp về công ty. Khi nhận hoá đơn VAT từ đối tác, hệ thống tự ghi 1 khoản Chi tương ứng bên tab Thu Chi — dùng làm chứng từ chi phí hợp lệ khi quyết toán thuế.</p>

      {purchaseOrders.length > 0 && (
        <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
          <div className="px-4 pt-3 pb-1 text-xs font-semibold text-ink uppercase">Đơn nhập hàng (mua đứt bán lại)</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-paper text-left text-xs uppercase text-muted">
                <th className="px-4 py-2">STT</th>
                <th className="px-4 py-2">Ngày</th><th className="px-4 py-2">Sản phẩm</th><th className="px-4 py-2">Nhà cung cấp</th>
                <th className="px-4 py-2 text-right">SL</th><th className="px-4 py-2 text-right">Đơn giá</th>
                <th className="px-4 py-2 text-right">Tổng tiền</th><th className="px-4 py-2 text-right">VAT đầu vào</th>
                <th className="px-4 py-2">Số HĐ NCC</th><th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.map((o, idx) => ({ ...o, _stt: idx + 1 })).slice().reverse().map((o) => {
                const vat = splitVAT(o.totalCost, o.vatRate);
                return (
                  <tr key={o.id} className="border-t border-paper-line">
                    <td className="px-4 py-2 ktns-mono text-xs text-muted">{o._stt}</td>
                    <td className="px-4 py-2 ktns-mono text-xs text-muted">{o.date}</td>
                    <td className="px-4 py-2">{o.productName}</td>
                    <td className="px-4 py-2 text-xs">{nameOf(o.partnerId)}</td>
                    <td className="px-4 py-2 text-right ktns-mono">{o.quantity}</td>
                    <td className="px-4 py-2 text-right ktns-mono text-muted">{fmtVND(o.unitCost)}</td>
                    <td className="px-4 py-2 text-right ktns-mono font-medium">{fmtVND(o.totalCost)}</td>
                    <td className="px-4 py-2 text-right ktns-mono text-stamp-red">{fmtVND(vat.vatAmount)} ({o.vatRate}%)</td>
                    <td className="px-4 py-2 ktns-mono text-xs">{o.invoiceNo || "—"}</td>
                    <td className="px-4 py-2 text-right"><button onClick={() => removeDistOrder(o.id)} className="text-muted hover:text-stamp-red"><Trash2 size={14} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-4 py-2.5 text-[11px] text-muted border-t border-paper-line">* Đã tự cộng số lượng vào tồn kho ở Kho hàng và cập nhật giá nhập mới nhất. VAT đầu vào ở đây được khấu trừ khi kê khai thuế GTGT (xem tổng hợp ở tab Thu Chi).</p>
        </div>
      )}

      {activeInvoiceOrderId && (() => {
        const o = distOrders.find((x) => x.id === activeInvoiceOrderId);
        if (!o) return null;
        const p = partnerOf(o.partnerId);
        const pct = resolvePct(o);
        const monthlyRevenue = getPartnerMonthlyRevenue(o.partnerId, o.date, distOrders);
        const split = computePartnerAmount(o.revenue, o.vatRate, pct, p?.partnerRole);
        const label = p?.partnerRole === "nhuong_quyen" ? "phí nhượng quyền" : "hoa hồng";
        // Đóng khung có kiểm tra — đã nhập số hoá đơn/đính kèm ảnh mà đóng ngang thì phải hỏi lại,
        // tránh mất công nhập giống lỗi đã sửa bên CRM.
        const closeInvoiceModal = () => {
          const hasUnsavedInput = invoiceDraft.invoiceNo || invoiceDraft.attachmentData;
          if (hasUnsavedInput && !window.confirm("Bạn đã nhập thông tin hoá đơn nhưng chưa bấm Lưu — đóng lại sẽ MẤT hết thông tin vừa nhập. Vẫn muốn đóng?")) return;
          setActiveInvoiceOrderId(null);
        };
        return (
          <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-6" onClick={closeInvoiceModal}>
            <div className="bg-white rounded-lg p-5 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="ktns-serif font-semibold text-ink mb-1">Hoá đơn VAT {label} từ đối tác</h3>
              <div className="bg-paper rounded-md p-3 mb-3 text-xs flex flex-col gap-1">
                <div className="font-semibold text-ink">{nameOf(o.partnerId)}</div>
                <div className="text-muted">{o.productName} · Doanh thu {fmtVND(o.revenue)} · {pct}% <span className="text-[10px]">(cộng dồn tháng {o.date.slice(0, 7)}: {fmtVND(monthlyRevenue)})</span></div>
                <div className="text-charcoal font-medium">Số tiền {label}: <span className="ktns-mono text-stamp-red">{fmtVND(split.commissionAmount)}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Số hoá đơn đối tác đã báo lại <span className="text-stamp-red">* bắt buộc</span><input value={invoiceDraft.invoiceNo} onChange={(e) => setInvoiceDraft({ ...invoiceDraft, invoiceNo: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
                <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Đính kèm ảnh/file hoá đơn <span className="text-ink-light">(có sau cũng được, bổ sung khi nhận được từ đối tác)</span>
                  <input type="file" accept="image/*,.pdf" onChange={handleInvoiceFile} className="border border-paper-line rounded px-2 py-1.5 text-sm bg-white" />
                  {invoiceDraft.attachmentName && <span className="text-[11px] text-ledger-green flex items-center gap-1 mt-1"><CheckCircle2 size={11} /> {invoiceDraft.attachmentName}</span>}
                </label>
              </div>
              {!invoiceDraft.attachmentData && (
                <p className="text-[11px] text-gold mt-2 flex items-center gap-1"><AlertTriangle size={12} /> Chưa có ảnh — vẫn ghi nhận đúng khoản Thu ròng vào Thu Chi, nhưng đánh dấu "chờ bổ sung chứng từ" cho tới khi có ảnh. Loại hoá đơn mặc định là "Biên lai nội bộ" — kế toán tự đổi lại đúng loại (VD Hóa đơn GTGT) ở tab Thu Chi sau khi xác minh rõ nghĩa vụ thuế thật với đối tác này.</p>
              )}
              {invoiceErr && <p className="text-xs text-stamp-red mt-2 flex items-center gap-1"><AlertTriangle size={12} /> {invoiceErr}</p>}
              <div className="flex gap-2 mt-4">
                <button onClick={saveCommissionInvoice} className="bg-ledger-green text-white text-sm px-3 py-1.5 rounded-md hover:opacity-90">{invoiceDraft.attachmentData ? "Lưu & ghi Thu Chi" : "Xác nhận (chưa có ảnh)"}</button>
                <button onClick={closeInvoiceModal} className="border border-paper-line text-sm px-3 py-1.5 rounded-md text-muted">Huỷ</button>
              </div>
            </div>
          </div>
        );
      })()}

      {viewingAttachment && (() => {
        const tx = transactions.find((t) => t.id === viewingAttachment.linkedTxId);
        if (!tx) return null;
        return (
          <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-8" onClick={() => setViewingAttachment(null)}>
            <div className="bg-white rounded-lg p-4 max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl" onClick={(ev) => ev.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="ktns-serif font-semibold text-ink text-sm">{nameOf(viewingAttachment.partnerId)} — HĐ #{tx.invoiceNo}</h3>
                <button onClick={() => setViewingAttachment(null)} className="text-muted hover:text-ink"><X size={18} /></button>
              </div>
              {tx.attachmentData ? (
                tx.attachmentType?.startsWith("image/") ? (
                  <img src={tx.attachmentData} alt={tx.attachmentName} className="max-w-full rounded" />
                ) : (
                  <a href={tx.attachmentData} download={tx.attachmentName} className="text-sm text-ink-light underline">Tải file {tx.attachmentName}</a>
                )
              ) : (
                <div className="text-sm text-muted">
                  <p>Đối tác đã báo số hoá đơn #{tx.invoiceNo} nhưng chưa có ảnh/file chứng từ.</p>
                  <button onClick={() => { setViewingAttachment(null); openInvoiceModal(viewingAttachment); }} className="mt-2 text-xs bg-ink text-white px-3 py-1.5 rounded-md">Bổ sung ảnh hoá đơn ngay</button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ---------- Công nợ ----------
function exportDebtsExcel(debts) {
  const wb = XLSX.utils.book_new();
  const rows = debts.map((d) => ({
    "Loại": d.type === "thu" ? "Phải thu" : "Phải trả",
    "Đối tác": d.partner, "Số tiền": Math.round(d.amount),
    "Ngày phát sinh": d.issueDate, "Hạn thanh toán": d.dueDate,
    "Trạng thái": d.status === "paid" ? "Đã thanh toán" : (new Date(d.dueDate) < TODAY ? "Quá hạn" : "Còn nợ"),
    "Ghi chú": d.note,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 10 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 34 }];
  XLSX.utils.book_append_sheet(wb, ws, "Công nợ");
  XLSX.writeFile(wb, `DOMIX_Cong_no_${TODAY.toISOString().slice(0, 10)}.xlsx`);
}

// ---------- Hợp đồng ----------
// Theo dõi hợp đồng với đối tác phân phối, khách hàng lớn, nhà cung cấp, nhân viên — cảnh báo
// trước khi hết hạn để không bị gián đoạn hợp tác hoặc quên gia hạn.
const CONTRACT_TYPES = { doi_tac: "Đối tác phân phối", khach_hang: "Khách hàng", nha_cung_cap: "Nhà cung cấp", nhan_vien: "Nhân viên", khac: "Khác" };
function HopDong({ contracts, setContracts, partners, employees }) {
  const [showForm, setShowForm] = useState(false);
  const blankForm = { name: "", type: "doi_tac", partyName: "", value: "", signDate: TODAY_STR, expiryDate: "", fileData: "", fileName: "", fileType: "", note: "" };
  const [form, setForm] = useState(blankForm);
  const [viewingFile, setViewingFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, fileData: reader.result, fileName: file.name, fileType: file.type }));
    reader.readAsDataURL(file);
  };
  const addContract = () => {
    if (!form.name || !form.partyName) return;
    setContracts((prev) => [...prev, { ...form, id: Date.now(), value: Number(form.value) || 0 }]);
    setForm(blankForm);
    setShowForm(false);
  };
  const removeContract = (id) => setContracts((prev) => prev.filter((c) => c.id !== id));

  const daysUntilExpiry = (c) => c.expiryDate ? Math.ceil((new Date(c.expiryDate) - TODAY) / 86400000) : null;
  const statusOf = (c) => {
    const d = daysUntilExpiry(c);
    if (d === null) return "khong_thoi_han";
    if (d < 0) return "het_han";
    if (d <= 30) return "sap_het_han";
    return "con_hieu_luc";
  };
  const expiringCount = contracts.filter((c) => statusOf(c) === "sap_het_han").length;
  const expiredCount = contracts.filter((c) => statusOf(c) === "het_han").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-lg border border-paper-line p-3 text-xs text-muted flex items-start gap-2">
        <Link2 size={13} className="text-ink-light shrink-0 mt-0.5" />
        <span>Lưu trữ hợp đồng với đối tác phân phối, khách hàng lớn, nhà cung cấp, nhân viên — kèm file scan thật, tự cảnh báo trước 30 ngày khi sắp hết hạn để kịp gia hạn/đàm phán lại.</span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard icon={FileSignature} label="Tổng hợp đồng" value={contracts.length} />
        <KpiCard icon={Wallet} label="Tổng giá trị" value={fmtVND(contracts.reduce((a, c) => a + c.value, 0))} />
        <KpiCard icon={AlertTriangle} label="Sắp hết hạn (≤30 ngày)" value={expiringCount} tone={expiringCount > 0 ? "down" : "up"} />
        <KpiCard icon={AlertTriangle} label="Đã hết hạn" value={expiredCount} tone={expiredCount > 0 ? "down" : "up"} />
      </div>

      <button onClick={() => { setForm(blankForm); setShowForm(true); }} className="flex items-center gap-1.5 text-sm bg-ink text-white px-3.5 py-2 rounded-md hover:bg-ink-light w-fit">
        <Plus size={15} /> Thêm hợp đồng
      </button>

      {showForm && (
        <div className="bg-white rounded-lg border border-paper-line p-4">
          <div className="grid grid-cols-3 gap-3">
            <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Tên/số hợp đồng<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: HĐ Nhượng quyền Say Media 2026" className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Loại
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm">
                {Object.entries(CONTRACT_TYPES).map(([id, l]) => (<option key={id} value={id}>{l}</option>))}
              </select>
            </label>
            <label className="text-xs text-muted flex flex-col gap-1">Bên liên quan<input value={form.partyName} onChange={(e) => setForm({ ...form, partyName: e.target.value })} placeholder="Tên đối tác/khách hàng/nhân viên" className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Giá trị hợp đồng (đ, nếu có)<MoneyInput value={form.value} onChange={(v) => setForm({ ...form, value: v })} /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Ngày ký<input type="date" value={form.signDate} onChange={(e) => setForm({ ...form, signDate: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Ngày hết hạn (để trống nếu vô thời hạn)<input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-muted flex flex-col gap-1 col-span-2">File hợp đồng (scan/ảnh)
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFile} className="border border-paper-line rounded px-2 py-1.5 text-sm bg-white" />
              {form.fileName && <span className="text-[11px] text-ledger-green flex items-center gap-1 mt-1"><CheckCircle2 size={11} /> {form.fileName}</span>}
            </label>
            <label className="text-xs text-muted flex flex-col gap-1 col-span-3">Ghi chú<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={addContract} className="bg-ledger-green text-white text-sm px-3 py-1.5 rounded-md">Lưu</button>
            <button onClick={() => { if ((form.name || form.partyName) && !window.confirm("Chưa lưu — đóng lại sẽ mất thông tin vừa nhập. Vẫn muốn đóng?")) return; setShowForm(false); }} className="border border-paper-line text-sm px-3 py-1.5 rounded-md text-muted">Huỷ</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
        <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-paper text-left text-xs uppercase text-muted">
              <th className="px-4 py-2">STT</th><th className="px-4 py-2">Tên hợp đồng</th><th className="px-4 py-2">Loại</th><th className="px-4 py-2">Bên liên quan</th>
              <th className="px-4 py-2 text-right">Giá trị</th><th className="px-4 py-2">Ngày ký</th><th className="px-4 py-2">Hết hạn</th>
              <th className="px-4 py-2">Trạng thái</th><th className="px-4 py-2">File</th><th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {contracts.length === 0 && <tr><td colSpan={10} className="px-4 py-6 text-center text-xs text-muted">Chưa có hợp đồng nào.</td></tr>}
            {contracts.slice().sort((a, b) => (a.expiryDate || "9999").localeCompare(b.expiryDate || "9999")).map((c, idx) => {
              const status = statusOf(c);
              const d = daysUntilExpiry(c);
              return (
                <tr key={c.id} className={`border-t border-paper-line ${status === "het_han" || status === "sap_het_han" ? "ktns-warn-row" : ""}`}>
                  <td className="px-4 py-2 ktns-mono text-xs text-muted">{idx + 1}</td>
                  <td className="px-4 py-2 font-medium">{c.name}{c.note && <div className="text-[10px] text-muted">{c.note}</div>}</td>
                  <td className="px-4 py-2 text-xs">{CONTRACT_TYPES[c.type]}</td>
                  <td className="px-4 py-2 text-xs">{c.partyName}</td>
                  <td className="px-4 py-2 text-right ktns-mono">{c.value > 0 ? fmtVND(c.value) : "—"}</td>
                  <td className="px-4 py-2 ktns-mono text-xs text-muted">{c.signDate}</td>
                  <td className="px-4 py-2 ktns-mono text-xs text-muted">{c.expiryDate || "Vô thời hạn"}</td>
                  <td className="px-4 py-2">
                    {status === "het_han" && <StampBadge text={`ĐÃ HẾT HẠN ${Math.abs(d)} NGÀY`} />}
                    {status === "sap_het_han" && <StampBadge text={`CÒN ${d} NGÀY`} gold />}
                    {status === "con_hieu_luc" && <StampBadge text="CÒN HIỆU LỰC" muted />}
                    {status === "khong_thoi_han" && <StampBadge text="VÔ THỜI HẠN" muted />}
                  </td>
                  <td className="px-4 py-2">{c.fileData ? <button onClick={() => setViewingFile(c)} className="text-xs text-ink-light underline">Xem</button> : <span className="text-xs text-muted">—</span>}</td>
                  <td className="px-4 py-2 text-right"><button onClick={() => removeContract(c.id)} className="text-muted hover:text-stamp-red"><Trash2 size={14} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {viewingFile && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-8" onClick={() => setViewingFile(null)}>
          <div className="bg-white rounded-lg p-4 max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="ktns-serif font-semibold text-ink text-sm">{viewingFile.name}</h3>
              <button onClick={() => setViewingFile(null)} className="text-muted hover:text-ink"><X size={18} /></button>
            </div>
            {viewingFile.fileType?.startsWith("image/") ? (
              <img src={viewingFile.fileData} alt={viewingFile.fileName} className="max-w-full rounded" />
            ) : (
              <a href={viewingFile.fileData} download={viewingFile.fileName} className="text-sm text-ink-light underline">Tải file {viewingFile.fileName}</a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CongNo({ debts, setDebts, setTransactions, transactions, distributionOrders, distributionPartners, setTab }) {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ type: "thu", partner: "", amount: "", issueDate: TODAY_STR, dueDate: new Date(TODAY.getTime() + 7 * 86400000).toISOString().slice(0, 10), note: "" });

  const addDebt = () => {
    if (!form.partner || !form.amount) return;
    setDebts((prev) => [...prev, { ...form, id: Date.now(), amount: Number(form.amount) || 0, status: "open" }]);
    setForm({ type: "thu", partner: "", amount: "", issueDate: TODAY_STR, dueDate: new Date(TODAY.getTime() + 7 * 86400000).toISOString().slice(0, 10), note: "" });
    setShowForm(false);
  };
  // Đánh dấu "Đã trả" phải ghi THẬT 1 khoản Thu/Chi tương ứng — trước đây chỉ đổi trạng thái,
  // tiền thật vào/ra không hề xuất hiện ở Thu Chi, làm sai lệch số dư quỹ thực tế.
  const togglePaid = (d) => {
    const nowPaid = d.status !== "paid";
    if (nowPaid) {
      const txId = Date.now();
      setTransactions((prev) => [...prev, {
        id: txId, date: TODAY_STR, kind: d.type === "thu" ? "thu" : "chi", category: d.type === "thu" ? "Thu công nợ" : "Trả công nợ",
        desc: `${d.type === "thu" ? "Thu nợ từ" : "Trả nợ cho"} ${d.partner}${d.note ? " — " + d.note : ""}`, amount: d.amount,
        partnerName: d.partner, partnerTaxCode: "", paymentMethod: "chuyen_khoan",
        invoiceType: "Chưa xác định", invoiceNo: "", vatRate: 0, attachmentData: "", attachmentName: "", attachmentType: "",
        status: "pending", source: "congno", sourceOrderId: d.id,
      }]);
      setDebts((prev) => prev.map((x) => (x.id === d.id ? { ...x, status: "paid", linkedTxId: txId } : x)));
    } else {
      if (d.linkedTxId) setTransactions((prev) => prev.filter((t) => t.id !== d.linkedTxId));
      setDebts((prev) => prev.map((x) => (x.id === d.id ? { ...x, status: "open", linkedTxId: null } : x)));
    }
  };
  const removeDebt = (id) => setDebts((prev) => prev.filter((d) => d.id !== id));

  // Doanh thu ròng đang CHỜ đối tác phân phối xác nhận — CHƯA vào Thu Chi, CHƯA phải là công nợ
  // (không có gì để "nợ" vì chưa ghi nhận thu ở đâu cả) — chỉ hiện để biết còn bao nhiêu tiền
  // "sắp về" khi đối tác xác nhận xong, tách hẳn khỏi Phải thu/Phải trả thật.
  const pendingDistByPartner = (distributionPartners || []).map((p) => {
    const pending = (distributionOrders || []).filter((o) => o.partnerId === p.id && o.orderKind !== "purchase" && !o.partnerInvoiceReceived && !o.partnerInvoiceConfirmed);
    const total = pending.reduce((sum, o) => {
      const monthlyRevenue = getPartnerMonthlyRevenue(o.partnerId, o.date, distributionOrders);
      const pct = lookupCommissionTier(monthlyRevenue, p.commissionTiers);
      const split = computePartnerAmount(o.revenue, o.vatRate, pct, p.partnerRole);
      return sum + split.remittedToCompany;
    }, 0);
    return { partner: p, count: pending.length, total };
  }).filter((x) => x.count > 0);

  const receivable = debts.filter((d) => d.type === "thu" && d.status !== "paid").reduce((a, d) => a + d.amount, 0);
  const payable = debts.filter((d) => d.type === "tra" && d.status !== "paid").reduce((a, d) => a + d.amount, 0);
  const overdue = debts.filter((d) => d.status !== "paid" && new Date(d.dueDate) < TODAY);

  const filtered = debts.filter((d) => {
    if (filter === "thu") return d.type === "thu";
    if (filter === "tra") return d.type === "tra";
    if (filter === "overdue") return d.status !== "paid" && new Date(d.dueDate) < TODAY;
    if (filter === "open") return d.status !== "paid";
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-lg border border-paper-line p-3 text-xs text-muted flex items-start gap-2">
        <Link2 size={13} className="text-ink-light shrink-0 mt-0.5" />
        <span>Theo dõi ai đang nợ mình (<strong className="text-charcoal">Phải thu</strong>) và mình đang nợ ai (<strong className="text-charcoal">Phải trả</strong>) — tách khỏi Thu Chi vì đây là tiền chưa thực nhận/thực chi, không tính vào số dư quỹ cho tới khi thanh toán xong.</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KpiCard icon={CreditCard} label="Tổng phải thu" value={fmtVND(receivable)} tone="up" />
        <KpiCard icon={CreditCard} label="Tổng phải trả" value={fmtVND(payable)} tone="down" />
        <KpiCard icon={AlertTriangle} label="Khoản quá hạn" value={overdue.length} tone={overdue.length > 0 ? "down" : "up"} />
      </div>

      {pendingDistByPartner.length > 0 && (
        <div className="bg-white rounded-lg border border-ink-light/30 overflow-hidden">
          <div className="px-4 py-2.5 bg-paper text-xs font-semibold text-ink-light uppercase flex items-center gap-1.5"><Handshake size={13} /> Doanh thu ròng đang chờ đối tác phân phối xác nhận — chưa vào Thu Chi, không phải công nợ</div>
          <div className="divide-y divide-paper-line">
            {pendingDistByPartner.map((x) => (
              <button key={x.partner.id} onClick={() => setTab && setTab("hoptac")} className="w-full text-left px-4 py-2.5 flex items-center justify-between text-sm hover:bg-paper/60">
                <span className="text-charcoal">Qua <strong>{x.partner.name}</strong> — {x.count} đơn chưa xác nhận</span>
                <span className="ktns-mono text-ink-light font-medium flex items-center gap-2">{fmtVND(x.total)} <ChevronRight size={14} className="text-muted" /></span>
              </button>
            ))}
          </div>
          <p className="px-4 py-2 text-[10px] text-muted border-t border-paper-line">* Số này CHƯA nằm trong Thu Chi và CHƯA tính vào "Tổng phải thu" ở trên — chỉ hiện để biết còn bao nhiêu tiền dự kiến. Xử lý ở tab Hợp tác phân phối ("Xác nhận gộp cả tháng" hoặc từng đơn) thì sẽ tự chuyển thành khoản Thu thật.</p>
        </div>
      )}

      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {[["all", "Tất cả"], ["thu", "Phải thu"], ["tra", "Phải trả"], ["open", "Còn nợ"], ["overdue", "Quá hạn"]].map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)} className={`ktns-role-pill ${filter === id ? "active" : ""}`}>{label}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportDebtsExcel(debts)} className="flex items-center gap-1.5 text-sm bg-ledger-green text-white px-3.5 py-2 rounded-md hover:opacity-90">
            <FileSpreadsheet size={15} /> Xuất Excel
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-sm bg-ink text-white px-3.5 py-2 rounded-md hover:bg-ink-light">
            <Plus size={15} /> Thêm công nợ
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-paper-line p-5 relative">
          <button className="absolute top-3 right-3 text-muted hover:text-ink" onClick={() => { if ((form.partner || form.amount) && !window.confirm("Chưa lưu — đóng lại sẽ mất thông tin vừa nhập. Vẫn muốn đóng?")) return; setShowForm(false); }}><X size={16} /></button>
          <h3 className="ktns-serif font-semibold text-ink mb-4">Khoản công nợ mới</h3>
          <div className="grid grid-cols-4 gap-3">
            <label className="text-xs text-muted flex flex-col gap-1">Loại
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm">
                <option value="thu">Phải thu (khách nợ mình)</option>
                <option value="tra">Phải trả (mình nợ đối tác)</option>
              </select>
            </label>
            <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Đối tác<input value={form.partner} onChange={(e) => setForm({ ...form, partner: e.target.value })} placeholder="Tên khách hàng / nhà cung cấp" className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Số tiền (đ)<MoneyInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Ngày phát sinh<input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Hạn thanh toán<input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Ghi chú<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
          </div>
          <button onClick={addDebt} className="mt-4 bg-ledger-green text-white text-sm px-4 py-2 rounded-md hover:opacity-90">Lưu</button>
        </div>
      )}

      <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
        <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-paper text-left text-xs uppercase text-muted">
              <th className="px-4 py-2.5">Loại</th>
              <th className="px-4 py-2.5">Đối tác</th>
              <th className="px-4 py-2.5 text-right">Số tiền</th>
              <th className="px-4 py-2.5">Hạn thanh toán</th>
              <th className="px-4 py-2.5">Trạng thái</th>
              <th className="px-4 py-2.5">Ghi chú</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice().reverse().map((d) => {
              const isOverdue = d.status !== "paid" && new Date(d.dueDate) < TODAY;
              return (
                <tr key={d.id} className={`border-t border-paper-line ${isOverdue ? "ktns-warn-row" : ""}`}>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${d.type === "thu" ? "bg-ledger-green" : "bg-stamp-red"}`} style={{ color: "white" }}>{d.type === "thu" ? "Phải thu" : "Phải trả"}</span>
                  </td>
                  <td className="px-4 py-2 font-medium">{d.partner}</td>
                  <td className={`px-4 py-2 text-right ktns-mono font-medium ${d.type === "thu" ? "text-ledger-green" : "text-stamp-red"}`}>{fmtVND(d.amount)}</td>
                  <td className="px-4 py-2 ktns-mono text-xs">
                    <span className={isOverdue ? "text-stamp-red font-semibold" : "text-muted"}>{d.dueDate}</span>
                  </td>
                  <td className="px-4 py-2">
                    <button onClick={() => togglePaid(d)}>
                      {d.status === "paid" ? <StampBadge text="ĐÃ THANH TOÁN" gold /> : isOverdue ? <StampBadge text="QUÁ HẠN" /> : <StampBadge text="CÒN NỢ" muted />}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted max-w-xs">{d.note}</td>
                  <td className="px-4 py-2 text-right"><button onClick={() => removeDebt(d.id)} className="text-muted hover:text-stamp-red"><Trash2 size={14} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
      <p className="text-xs text-muted">* Bấm vào trạng thái để đánh dấu đã thanh toán/còn nợ. Khoản quá hạn (đỏ) là chưa thanh toán và đã qua hạn — nên nhắc khách/tự nhắc mình xử lý sớm.</p>
    </div>
  );
}

// ---------- Kho hàng ----------
function exportInventoryExcel(inventory) {
  const wb = XLSX.utils.book_new();
  const rows = inventory.map((p) => ({
    "Mã SKU": p.sku, "Tên sản phẩm": p.name, "Đơn vị": p.unit,
    "Tồn kho": p.stock, "Tồn tối thiểu": p.minStock,
    "Giá nhập": Math.round(p.costPrice), "Giá bán": Math.round(p.sellPrice),
    "Giá trị tồn kho (theo giá nhập)": Math.round(p.stock * p.costPrice),
    "Trạng thái": p.stock <= p.minStock ? "Sắp hết hàng" : "Bình thường",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = new Array(9).fill({ wch: 18 });
  XLSX.utils.book_append_sheet(wb, ws, "Kho hàng");
  XLSX.writeFile(wb, `DOMIX_Kho_hang_${TODAY.toISOString().slice(0, 10)}.xlsx`);
}

// ---------- Tài sản cố định & Công cụ dụng cụ ----------
// TSCĐ (nguyên giá thường ≥30 triệu, thời gian sử dụng >1 năm) hạch toán TK 211/214.
// CCDC (giá trị nhỏ hơn, phân bổ dần) hạch toán TK 242. Cả 2 đều khấu hao/phân bổ đường thẳng
// (nguyên giá chia đều cho số tháng sử dụng) — cách tính phổ biến nhất cho DN nhỏ và vừa.
function TaiSanCoDinh({ assets, setAssets, setTransactions, reportYear, reportMonth }) {
  const [showForm, setShowForm] = useState(false);
  const blankForm = { name: "", assetType: "tscd", purchaseDate: TODAY_STR, cost: "", usefulMonths: "36", note: "", depreciatedMonths: [] };
  const [form, setForm] = useState(blankForm);

  const addAsset = () => {
    if (!form.name || !form.cost || !form.usefulMonths) return;
    setAssets((prev) => [...prev, { ...form, id: Date.now(), cost: Number(form.cost) || 0, usefulMonths: Number(form.usefulMonths) || 1, depreciatedMonths: [] }]);
    setForm(blankForm);
    setShowForm(false);
  };
  const removeAsset = (id) => setAssets((prev) => prev.filter((a) => a.id !== id));

  const monthlyDep = (a) => a.cost / a.usefulMonths;
  const monthsDone = (a) => (a.depreciatedMonths || []).length;
  const remainingValue = (a) => Math.max(0, a.cost - monthsDone(a) * monthlyDep(a));
  const isFullyDep = (a) => monthsDone(a) >= a.usefulMonths;
  const currentPeriodKey = `${reportYear}-${String(reportMonth).padStart(2, "0")}`;
  const pendingThisMonth = assets.filter((a) => !isFullyDep(a) && !(a.depreciatedMonths || []).includes(currentPeriodKey) && a.purchaseDate <= `${currentPeriodKey}-31`);

  // Ghi nhận khấu hao/phân bổ CẢ THÁNG cho tất cả tài sản đủ điều kiện cùng lúc — tự tạo khoản Chi
  // tương ứng bên Thu Chi, đúng TK 214 (TSCĐ) hoặc 242 (CCDC), đối ứng TK 642 chi phí.
  const recordDepreciation = () => {
    if (pendingThisMonth.length === 0) return;
    const newTxs = pendingThisMonth.map((a, i) => ({
      id: Date.now() + i, date: TODAY_STR, kind: "chi",
      category: a.assetType === "tscd" ? "Khấu hao TSCĐ" : "Phân bổ CCDC",
      desc: `${a.assetType === "tscd" ? "Khấu hao" : "Phân bổ"} ${a.name} — kỳ ${currentPeriodKey}`,
      amount: Math.round(monthlyDep(a)), partnerName: "", partnerTaxCode: "", paymentMethod: "chuyen_khoan",
      invoiceType: "Biên lai / Phiếu thu nội bộ", invoiceNo: "", vatRate: 0,
      attachmentData: "", attachmentName: "", attachmentType: "", status: "approved",
      source: "taisan", sourceOrderId: a.id, accountCode: a.assetType === "tscd" ? "214" : "242",
    }));
    setTransactions((prev) => [...prev, ...newTxs]);
    setAssets((prev) => prev.map((a) => (pendingThisMonth.some((p) => p.id === a.id) ? { ...a, depreciatedMonths: [...(a.depreciatedMonths || []), currentPeriodKey] } : a)));
  };

  const totalCost = assets.reduce((a, x) => a + x.cost, 0);
  const totalRemaining = assets.reduce((a, x) => a + remainingValue(x), 0);
  const totalMonthlyDep = assets.filter((a) => !isFullyDep(a)).reduce((a, x) => a + monthlyDep(x), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-lg border border-paper-line p-3 text-xs text-muted flex items-start gap-2">
        <Link2 size={13} className="text-ink-light shrink-0 mt-0.5" />
        <span>Theo dõi tài sản cố định (TK 211/214) và công cụ dụng cụ phân bổ dần (TK 242) — khấu hao/phân bổ tính theo đường thẳng (nguyên giá chia đều số tháng sử dụng). Bấm "Ghi nhận khấu hao tháng này" để tự động tạo đúng khoản Chi tương ứng bên Thu Chi, không cần nhập tay hàng tháng.</span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard icon={Archive} label="Tổng nguyên giá" value={fmtVND(totalCost)} />
        <KpiCard icon={Wallet} label="Giá trị còn lại" value={fmtVND(totalRemaining)} tone="up" />
        <KpiCard icon={TrendingDown} label="Khấu hao/phân bổ mỗi tháng" value={fmtVND(totalMonthlyDep)} tone="down" />
        <KpiCard icon={AlertTriangle} label="Chờ ghi nhận kỳ này" value={pendingThisMonth.length} tone={pendingThisMonth.length > 0 ? "down" : "up"} />
      </div>

      <div className="flex justify-between items-center">
        <button onClick={recordDepreciation} disabled={pendingThisMonth.length === 0} className="flex items-center gap-1.5 text-sm bg-gold text-white px-3.5 py-2 rounded-md hover:opacity-90 disabled:opacity-40">
          <Calculator size={15} /> Ghi nhận khấu hao/phân bổ kỳ {reportMonth}/{reportYear} ({pendingThisMonth.length} tài sản)
        </button>
        <button onClick={() => { setForm(blankForm); setShowForm(true); }} className="flex items-center gap-1.5 text-sm bg-ink text-white px-3.5 py-2 rounded-md hover:bg-ink-light">
          <Plus size={15} /> Thêm tài sản/CCDC
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-paper-line p-4">
          <div className="grid grid-cols-3 gap-3">
            <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Tên tài sản<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: Laptop Dell, Máy in, Bàn ghế văn phòng..." className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Loại
              <select value={form.assetType} onChange={(e) => setForm({ ...form, assetType: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm">
                <option value="tscd">Tài sản cố định (TK 211)</option>
                <option value="ccdc">Công cụ dụng cụ (TK 242)</option>
              </select>
            </label>
            <label className="text-xs text-muted flex flex-col gap-1">Ngày mua/đưa vào dùng<input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Nguyên giá (đ)<MoneyInput value={form.cost} onChange={(v) => setForm({ ...form, cost: v })} /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Thời gian sử dụng (tháng)<input type="number" value={form.usefulMonths} onChange={(e) => setForm({ ...form, usefulMonths: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
            <label className="text-xs text-muted flex flex-col gap-1 col-span-3">Ghi chú<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
          </div>
          {form.cost && form.usefulMonths && (
            <p className="text-[11px] text-ink-light mt-2">Khấu hao/phân bổ mỗi tháng: <strong className="ktns-mono">{fmtVND(Number(form.cost) / Number(form.usefulMonths))}</strong></p>
          )}
          <div className="flex gap-2 mt-3">
            <button onClick={addAsset} className="bg-ledger-green text-white text-sm px-3 py-1.5 rounded-md">Lưu</button>
            <button onClick={() => { if ((form.name || form.cost) && !window.confirm("Chưa lưu — đóng lại sẽ mất thông tin vừa nhập. Vẫn muốn đóng?")) return; setShowForm(false); }} className="border border-paper-line text-sm px-3 py-1.5 rounded-md text-muted">Huỷ</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
        <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-paper text-left text-xs uppercase text-muted">
              <th className="px-4 py-2">STT</th><th className="px-4 py-2">Tên tài sản</th><th className="px-4 py-2">Loại</th><th className="px-4 py-2">Ngày mua</th>
              <th className="px-4 py-2 text-right">Nguyên giá</th><th className="px-4 py-2 text-right">Đã khấu hao</th>
              <th className="px-4 py-2 text-right">Còn lại</th><th className="px-4 py-2">Tiến độ</th><th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 && <tr><td colSpan={9} className="px-4 py-6 text-center text-xs text-muted">Chưa có tài sản/CCDC nào.</td></tr>}
            {assets.map((a, idx) => (
              <tr key={a.id} className="border-t border-paper-line">
                <td className="px-4 py-2 ktns-mono text-xs text-muted">{idx + 1}</td>
                <td className="px-4 py-2 font-medium">{a.name}{a.note && <div className="text-[10px] text-muted">{a.note}</div>}</td>
                <td className="px-4 py-2 text-xs">{a.assetType === "tscd" ? "TSCĐ" : "CCDC"}</td>
                <td className="px-4 py-2 ktns-mono text-xs text-muted">{a.purchaseDate}</td>
                <td className="px-4 py-2 text-right ktns-mono">{fmtVND(a.cost)}</td>
                <td className="px-4 py-2 text-right ktns-mono text-stamp-red">{fmtVND(monthsDone(a) * monthlyDep(a))}</td>
                <td className="px-4 py-2 text-right ktns-mono text-ledger-green font-semibold">{fmtVND(remainingValue(a))}</td>
                <td className="px-4 py-2 text-xs">{isFullyDep(a) ? <StampBadge text="ĐÃ KHẤU HAO HẾT" muted /> : `${monthsDone(a)}/${a.usefulMonths} tháng`}</td>
                <td className="px-4 py-2 text-right"><button onClick={() => removeAsset(a.id)} className="text-muted hover:text-stamp-red"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      <p className="text-[11px] text-muted">* Khấu hao TSCĐ hạch toán Nợ TK 642 / Có TK 214; phân bổ CCDC hạch toán Nợ TK 642 / Có TK 242 — đúng nguyên tắc TT133. Cách tính đường thẳng đơn giản, một số tài sản đặc thù có thể cần phương pháp khấu hao khác, kế toán rà soát lại nếu cần.</p>
    </div>
  );
}

function KhoHang({ inventory, setInventory, orders, distOrders, distPartners }) {
  const [showForm, setShowForm] = useState(false);
  const blankProduct = { sku: "", name: "", groupName: "", unit: "cái", stock: "", minStock: "10", costPrice: "", sellPrice: "", durationMonths: "0", vatRate: 8 };
  const [form, setForm] = useState(blankProduct);

  const addProduct = () => {
    if (!form.name || !form.stock) return;
    setInventory((prev) => [...prev, { ...form, id: Date.now(), stock: Number(form.stock) || 0, minStock: Number(form.minStock) || 0, costPrice: Number(form.costPrice) || 0, sellPrice: Number(form.sellPrice) || 0, durationMonths: Number(form.durationMonths) || 0, vatRate: Number(form.vatRate) || 0 }]);
    setForm(blankProduct);
    setShowForm(false);
  };
  // Thêm nhanh 1 gói thời hạn khác CÙNG NHÓM sản phẩm — VD "AI Agent" đã có gói 1 tháng,
  // giờ thêm gói 3 tháng/6 tháng... chỉ cần đổi thời hạn + giá, không phải gõ lại từ đầu.
  const addVariant = (baseProduct) => {
    setForm({
      sku: "", name: baseProduct.name, groupName: baseProduct.groupName || baseProduct.name,
      unit: baseProduct.unit, stock: "", minStock: String(baseProduct.minStock),
      costPrice: String(baseProduct.costPrice), sellPrice: "", durationMonths: "1", vatRate: baseProduct.vatRate ?? 8,
    });
    setShowForm(true);
  };
  const adjustStock = (id, delta) => setInventory((prev) => prev.map((p) => (p.id === id ? { ...p, stock: Math.max(0, p.stock + delta) } : p)));
  const removeProduct = (id) => setInventory((prev) => prev.filter((p) => p.id !== id));

  const totalValue = inventory.reduce((a, p) => a + p.stock * p.costPrice, 0);
  const lowStock = inventory.filter((p) => p.stock <= p.minStock);

  // Gộp các gói thời hạn khác nhau của CÙNG 1 sản phẩm lại theo groupName (VD "AI Agent":
  // gói 1 tháng/3 tháng/6 tháng/12 tháng, mỗi gói giá riêng) để hiển thị rõ ràng, không rời rạc.
  const groupedInventory = Object.values(inventory.reduce((acc, p) => {
    const key = p.groupName || p.name;
    acc[key] = acc[key] || { groupName: key, items: [] };
    acc[key].items.push(p);
    return acc;
  }, {})).map((g) => ({ ...g, items: g.items.sort((a, b) => (a.durationMonths || 0) - (b.durationMonths || 0)) }));

  // Doanh thu theo sản phẩm — gộp cả 2 kênh: Sale bán trực tiếp (CRM) và Hợp tác phân phối,
  // để biết sản phẩm nào bán chạy và bán chủ yếu qua kênh nào. Tách rõ THÊM: sản phẩm này của
  // công ty hay của đối tác nào cung cấp, và nếu bán qua phân phối thì ĐÚNG đối tác nào (không
  // gộp chung "Hợp tác phân phối" mập mờ nữa) — đúng yêu cầu lọc rõ dòng tiền theo từng đối tác.
  const productRevenue = inventory.map((p) => {
    const owningPartner = distPartners ? distPartners.find((dp) => (dp.productIds || []).includes(p.id)) : null;
    const directOrders = (orders || []).filter((o) => o.productId === p.id);
    const distOrdersForP = (distOrders || []).filter((o) => o.productId === p.id && o.orderKind !== "purchase");
    const directQty = directOrders.reduce((a, o) => a + (o.quantity || 1), 0);
    const directRevenue = directOrders.reduce((a, o) => a + o.amount, 0);
    const distQty = distOrdersForP.reduce((a, o) => a + (o.quantity || 1), 0);
    const distRevenue = distOrdersForP.reduce((a, o) => a + o.revenue, 0);
    // Tách theo TỪNG đối tác cụ thể — 1 sản phẩm về lý thuyết chỉ gắn 1 đối tác sở hữu, nhưng vẫn
    // nhóm theo partnerId thực tế trên từng đơn để không sai lệch nếu dữ liệu lịch sử có khác biệt.
    const byPartner = {};
    distOrdersForP.forEach((o) => {
      const pid = o.partnerId;
      if (!byPartner[pid]) byPartner[pid] = { partnerId: pid, name: distPartners?.find((dp) => dp.id === pid)?.name || "—", qty: 0, revenue: 0 };
      byPartner[pid].qty += o.quantity || 1;
      byPartner[pid].revenue += o.revenue;
    });
    return { product: p, owningPartner, directQty, directRevenue, distQty, distRevenue, byPartner: Object.values(byPartner), totalQty: directQty + distQty, totalRevenue: directRevenue + distRevenue };
  }).filter((r) => r.totalQty > 0).sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Sản phẩm dạng mã key/gói có hạn (durationMonths > 0) — mỗi lượt bán (CRM hoặc phân phối)
  // tự tính ngày hết hạn = ngày bán + số tháng, để biết mã nào còn hạn/sắp hết/đã hết.
  const keyProducts = inventory.filter((p) => (p.durationMonths || 0) > 0);
  const addMonths = (dateStr, months) => { const d = new Date(dateStr); d.setMonth(d.getMonth() + months); return d; };
  const keyLedger = keyProducts.flatMap((p) => {
    const direct = (orders || []).filter((o) => o.productId === p.id).map((o) => ({
      product: p, date: o.date, customer: o.customerName, channel: "Sale trực tiếp", quantity: o.quantity || 1,
      keyCode: o.issuedKeyCode || "", expiry: addMonths(o.date, p.durationMonths),
    }));
    const dist = (distOrders || []).filter((o) => o.productId === p.id).map((o) => ({
      product: p, date: o.date, customer: o.endCustomerName || null, channel: "Hợp tác phân phối", quantity: o.quantity || 1,
      keyCode: o.issuedKeyCode || "", expiry: addMonths(o.date, p.durationMonths),
    }));
    return [...direct, ...dist];
  }).map((k) => {
    const daysLeft = Math.ceil((k.expiry - TODAY) / 86400000);
    const status = daysLeft < 0 ? "expired" : daysLeft <= 7 ? "expiring" : "active";
    return { ...k, daysLeft, status };
  }).sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-lg border border-paper-line p-3 text-xs text-muted flex items-start gap-2">
        <Link2 size={13} className="text-ink-light shrink-0 mt-0.5" />
        <span>Theo dõi tồn kho, giá nhập/bán, và cảnh báo khi sắp hết hàng — nhập/xuất kho bằng nút +/- ngay trên bảng.</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KpiCard icon={Package} label="Số mặt hàng" value={inventory.length} />
        <KpiCard icon={Wallet} label="Giá trị tồn kho" value={fmtVND(totalValue)} tone="up" sub="Tính theo giá nhập" />
        <KpiCard icon={AlertTriangle} label="Sắp hết hàng" value={lowStock.length} tone={lowStock.length > 0 ? "down" : "up"} />
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted">{inventory.length} sản phẩm trong kho.</p>
        <div className="flex gap-2">
          <button onClick={() => exportInventoryExcel(inventory)} className="flex items-center gap-1.5 text-sm bg-ledger-green text-white px-3.5 py-2 rounded-md hover:opacity-90">
            <FileSpreadsheet size={15} /> Xuất Excel
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-sm bg-ink text-white px-3.5 py-2 rounded-md hover:bg-ink-light">
            <Plus size={15} /> Thêm sản phẩm
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-paper-line p-5 relative">
          <button className="absolute top-3 right-3 text-muted hover:text-ink" onClick={() => { if (form.name && !window.confirm("Chưa lưu — đóng lại sẽ mất thông tin vừa nhập. Vẫn muốn đóng?")) return; setShowForm(false); }}><X size={16} /></button>
          <h3 className="ktns-serif font-semibold text-ink mb-4">{form.groupName ? `Gói mới cho "${form.groupName}"` : "Sản phẩm mới"}</h3>
          <div className="grid grid-cols-4 gap-3">
            <label className="text-xs text-muted flex flex-col gap-1">Mã SKU<input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="SP-006" className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
            <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Tên sản phẩm/gói<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Đơn vị<input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Nhóm sản phẩm <span className="text-[10px] text-ink-light">(để trống nếu là sản phẩm độc lập; đặt cùng tên nhóm cho các gói thời hạn của cùng 1 sản phẩm, VD "AI Agent")</span><input value={form.groupName} onChange={(e) => setForm({ ...form, groupName: e.target.value })} placeholder="VD: AI Agent" className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Tồn kho ban đầu<input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Tồn tối thiểu (cảnh báo)<input type="number" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Giá nhập (đ)<MoneyInput value={form.costPrice} onChange={(v) => setForm({ ...form, costPrice: v })} /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Giá bán — đã gồm VAT (đ)<MoneyInput value={form.sellPrice} onChange={(v) => setForm({ ...form, sellPrice: v })} /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Thuế suất VAT của giá bán trên<select value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: Number(e.target.value) })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono">{VAT_RATE_OPTIONS.map((r) => (<option key={r} value={r}>{r}%</option>))}</select></label>
            <label className="text-xs text-muted flex flex-col gap-1">Thời hạn sử dụng (tháng, 0 = hàng thường không có hạn)<input type="number" min="0" value={form.durationMonths} onChange={(e) => setForm({ ...form, durationMonths: e.target.value })} placeholder="VD: 1, 3, 6, 12" className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
          </div>
          {form.sellPrice && Number(form.vatRate) > 0 && (
            <div className="mt-2 text-xs bg-paper rounded px-2.5 py-2 flex gap-4">
              <span>Tiền hàng trước VAT: <strong className="ktns-mono">{fmtVND(splitVAT(Number(form.sellPrice), form.vatRate).beforeTax)}</strong></span>
              <span>VAT ({form.vatRate}%): <strong className="ktns-mono text-stamp-red">{fmtVND(splitVAT(Number(form.sellPrice), form.vatRate).vatAmount)}</strong></span>
            </div>
          )}
          <button onClick={addProduct} className="mt-4 bg-ledger-green text-white text-sm px-4 py-2 rounded-md hover:opacity-90">Lưu</button>
        </div>
      )}

      {productRevenue.length > 0 && (
        <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
          <div className="px-4 pt-3 pb-1 text-xs font-semibold text-ink uppercase flex items-center gap-1.5"><TrendingUp size={13} /> Doanh thu theo sản phẩm — rõ của ai, qua đối tác nào</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-paper text-left text-xs uppercase text-muted">
                <th className="px-4 py-2">Sản phẩm</th>
                <th className="px-4 py-2">Chủ sở hữu</th>
                <th className="px-4 py-2 text-right">SL bán (Sale)</th>
                <th className="px-4 py-2 text-right">DT Sale trực tiếp</th>
                <th className="px-4 py-2">Qua đối tác nào</th>
                <th className="px-4 py-2 text-right">DT Phân phối</th>
                <th className="px-4 py-2 text-right">Tổng doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {productRevenue.map((r) => (
                <tr key={r.product.id} className="border-t border-paper-line">
                  <td className="px-4 py-2 font-medium">{r.product.name}</td>
                  <td className="px-4 py-2">
                    {r.owningPartner ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gold/15 text-gold font-medium">{r.owningPartner.name}</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-ledger-green/15 text-ledger-green font-medium">Của công ty</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right ktns-mono">{r.directQty}</td>
                  <td className="px-4 py-2 text-right ktns-mono text-ink-light">{fmtVND(r.directRevenue)}</td>
                  <td className="px-4 py-2">
                    {r.byPartner.length === 0 ? <span className="text-muted text-xs">—</span> : (
                      <div className="flex flex-col gap-0.5">
                        {r.byPartner.map((bp) => (
                          <span key={bp.partnerId} className="text-[11px] text-charcoal">{bp.name} <span className="text-muted">({bp.qty} đơn)</span></span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right ktns-mono text-gold">{fmtVND(r.distRevenue)}</td>
                  <td className="px-4 py-2 text-right ktns-mono font-semibold text-ledger-green">{fmtVND(r.totalRevenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2.5 text-[11px] text-muted border-t border-paper-line">* Chỉ tính đơn có gắn đúng sản phẩm trong kho (chọn từ danh sách khi tạo đơn ở CRM/Hợp tác phân phối, không phải gõ tay tự do). Tồn kho đã tự trừ khi các đơn này được tạo.</p>
        </div>
      )}

      <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
        <div className="px-4 pt-3 pb-1 text-xs font-semibold text-ink uppercase">Danh mục sản phẩm — các gói thời hạn cùng 1 sản phẩm được gộp chung nhóm</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-paper text-left text-xs uppercase text-muted">
              <th className="px-4 py-2.5">SKU</th>
              <th className="px-4 py-2.5">Sản phẩm / Gói</th>
              <th className="px-4 py-2.5 text-right">Tồn kho</th>
              <th className="px-4 py-2.5 text-right">Giá nhập</th>
              <th className="px-4 py-2.5 text-right">Giá bán (đã gồm VAT)</th>
              <th className="px-4 py-2.5">Thời hạn</th>
              <th className="px-4 py-2.5">Đối tác phân phối</th>
              <th className="px-4 py-2.5">Trạng thái</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {groupedInventory.map((g) => (
              <React.Fragment key={g.groupName}>
                {g.items.length > 1 && (
                  <tr className="bg-paper/60">
                    <td colSpan={9} className="px-4 py-1.5 text-[11px] font-semibold text-ink uppercase flex items-center justify-between">
                      <span>{g.groupName} — {g.items.length} gói</span>
                      <button onClick={() => addVariant(g.items[0])} className="text-[10px] bg-ink text-white px-2 py-1 rounded flex items-center gap-1 normal-case font-normal"><Plus size={10} /> Thêm gói thời hạn khác</button>
                    </td>
                  </tr>
                )}
                {g.items.map((p) => {
                  const low = p.stock <= p.minStock;
                  const handlingPartners = (distPartners || []).filter((dp) => (dp.productIds || []).includes(p.id));
                  const vat = splitVAT(p.sellPrice, p.vatRate || 0);
                  return (
                    <tr key={p.id} className={`border-t border-paper-line ${low ? "ktns-warn-row" : ""}`}>
                      <td className="px-4 py-2 ktns-mono text-xs text-muted">{p.sku}</td>
                      <td className="px-4 py-2 font-medium">{p.durationMonths > 0 && g.items.length > 1 ? `↳ Gói ${p.durationMonths} tháng` : p.name} <span className="text-[11px] text-muted">/{p.unit}</span></td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => adjustStock(p.id, -1)} className="w-5 h-5 rounded border border-paper-line text-muted hover:border-stamp-red hover:text-stamp-red text-xs">−</button>
                          <span className="ktns-mono w-10 text-center">{p.stock}</span>
                          <button onClick={() => adjustStock(p.id, 1)} className="w-5 h-5 rounded border border-paper-line text-muted hover:border-ledger-green hover:text-ledger-green text-xs">+</button>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right ktns-mono text-muted">{fmtVND(p.costPrice)}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="ktns-mono text-ledger-green">{fmtVND(p.sellPrice)}</div>
                        <div className="text-[10px] text-muted">VAT {p.vatRate || 0}% = {fmtVND(vat.vatAmount)} (trước thuế {fmtVND(vat.beforeTax)})</div>
                      </td>
                      <td className="px-4 py-2 text-xs">{p.durationMonths > 0 ? <span className="ktns-mono text-ink-light">{p.durationMonths} tháng</span> : <span className="text-muted">—</span>}</td>
                      <td className="px-4 py-2 text-xs">{handlingPartners.length > 0 ? handlingPartners.map((dp) => dp.name).join(", ") : <span className="text-muted">Chưa gán đối tác</span>}</td>
                      <td className="px-4 py-2">{low ? <StampBadge text="SẮP HẾT HÀNG" /> : <StampBadge text="CÒN HÀNG" gold />}</td>
                      <td className="px-4 py-2 text-right"><button onClick={() => removeProduct(p.id)} className="text-muted hover:text-stamp-red"><Trash2 size={14} /></button></td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-2.5 text-[11px] text-muted border-t border-paper-line">* Giá bán hiển thị đã bao gồm VAT theo thuế suất khai báo cho từng sản phẩm — dòng nhỏ bên dưới tách rõ phần tiền hàng trước thuế và phần VAT.</p>
      </div>

      {keyLedger.length > 0 && (
        <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
          <div className="px-4 pt-3 pb-1 text-xs font-semibold text-ink uppercase flex items-center gap-1.5"><CalendarCheck size={13} /> Theo dõi mã Key/Gói theo hạn — {keyLedger.filter((k) => k.status === "expiring").length} sắp hết hạn, {keyLedger.filter((k) => k.status === "expired").length} đã hết hạn</div>
          <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-paper text-left text-xs uppercase text-muted">
                <th className="px-4 py-2">Sản phẩm</th>
                <th className="px-4 py-2">Mã key đã cấp</th>
                <th className="px-4 py-2">Khách hàng</th>
                <th className="px-4 py-2">Kênh bán</th>
                <th className="px-4 py-2">Ngày kích hoạt</th>
                <th className="px-4 py-2">Ngày hết hạn</th>
                <th className="px-4 py-2 text-right">Còn lại</th>
                <th className="px-4 py-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {keyLedger.map((k, i) => (
                <tr key={i} className={`border-t border-paper-line ${k.status !== "active" ? "ktns-warn-row" : ""}`}>
                  <td className="px-4 py-2 font-medium">{k.product.name} {k.quantity > 1 && <span className="text-muted">x{k.quantity}</span>}</td>
                  <td className="px-4 py-2 ktns-mono text-xs">{k.keyCode || <span className="text-stamp-red">chưa ghi</span>}</td>
                  <td className="px-4 py-2 text-xs">{k.customer || "—"}</td>
                  <td className="px-4 py-2 text-xs text-muted">{k.channel}</td>
                  <td className="px-4 py-2 ktns-mono text-xs text-muted">{k.date}</td>
                  <td className="px-4 py-2 ktns-mono text-xs">{k.expiry.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-2 text-right ktns-mono text-xs">{k.daysLeft >= 0 ? `${k.daysLeft} ngày` : `quá ${Math.abs(k.daysLeft)} ngày`}</td>
                  <td className="px-4 py-2">
                    {k.status === "active" && <StampBadge text="CÒN HẠN" gold />}
                    {k.status === "expiring" && <StampBadge text="SẮP HẾT HẠN" />}
                    {k.status === "expired" && <StampBadge text="ĐÃ HẾT HẠN" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <p className="px-4 py-2.5 text-[11px] text-muted border-t border-paper-line">* Tự tính từ ngày bán (CRM/Hợp tác phân phối) + số tháng thời hạn khai báo ở sản phẩm. "Sắp hết hạn" là còn ≤7 ngày — dùng để nhắc khách/đối tác gia hạn trước khi mã hết hiệu lực.</p>
        </div>
      )}
    </div>
  );
}

// ---------- Giao việc ----------
const GIAOVIEC_TODAY = TODAY.toISOString().slice(0, 10); // luôn khớp đúng ngày thật, không lệch với Chấm công

function computeTaskProgress(task, orders, marketingLogs) {
  if (task.targetType === "doanh_so") {
    const value = orders.filter((o) => o.saleEmployeeId === task.employeeId && o.date === task.date).reduce((a, o) => a + (Number(o.amount) || 0), 0);
    return { value, label: fmtVND(value) };
  }
  if (task.targetType === "khach_hang") {
    const phones = new Set();
    orders.forEach((o) => (o.contactLog || []).forEach((c) => { if (c.date.startsWith(task.date) && o.saleEmployeeId === task.employeeId) phones.add(o.phone); }));
    return { value: phones.size, label: `${phones.size} khách` };
  }
  if (task.targetType === "cuoc_goi") {
    let count = 0;
    orders.forEach((o) => { if (o.saleEmployeeId === task.employeeId) count += (o.contactLog || []).filter((c) => c.date.startsWith(task.date) && c.type === "call").length; });
    return { value: count, label: `${count} cuộc` };
  }
  if (task.targetType === "khach_tiep_can") {
    const value = (marketingLogs || []).filter((l) => l.employeeId === task.employeeId && l.date === task.date).reduce((a, l) => a + (Number(l.customersReached) || 0), 0);
    return { value, label: `${value} khách` };
  }
  if (task.targetType === "chuyen_doi") {
    const value = (marketingLogs || []).filter((l) => l.employeeId === task.employeeId && l.date === task.date).reduce((a, l) => a + (Number(l.conversions) || 0), 0);
    return { value, label: `${value} đơn` };
  }
  return { value: task.doneManual ? 1 : 0, label: task.doneManual ? "Đã xong" : "Chưa xong" };
}

function evaluateTaskStatus(task, progressValue) {
  const isToday = task.date === GIAOVIEC_TODAY;
  const isPastNoon = new Date().getHours() >= 12;
  if (task.targetType === "khac") {
    if (task.doneManual) return "dat";
    if (isToday && isPastNoon) return "canh_bao";
    return "dang_lam";
  }
  if (progressValue >= task.targetValue && task.targetValue > 0) return "dat";
  if (progressValue > 0) return "dang_lam";
  if (isToday && isPastNoon) return "canh_bao";
  return "dang_lam";
}

// ---------- Xếp hạng tổng hợp — gộp Chấm công + Doanh số CRM/Marketing + Giao việc + Hiệu suất ----------
// thành MỘT kết quả chuẩn duy nhất mỗi người, để trả lời: ai chăm, ai lười, ai cần cải thiện, ai cần xem xét cho thôi việc.
const RANKING_CATEGORY = {
  cham_chi: { label: "CHĂM CHỈ", tone: "gold" },
  on_dinh: { label: "ỔN ĐỊNH", tone: "muted" },
  can_cai_thien: { label: "CẦN CẢI THIỆN", tone: "gold" },
  luoi_bieng: { label: "LƯỜI BIẾNG", tone: "red" },
  cho_thoi_viec: { label: "CẢNH BÁO NGHỈ VIỆC", tone: "red" },
  chua_du_lieu: { label: "CHƯA ĐỦ DỮ LIỆU", tone: "muted" },
};
// Số ngày công tối thiểu trong tháng trước khi cho phép đánh giá — tránh chấm "lười biếng"
// oan cho người mới đi làm vài ngày hoặc tháng vừa mới bắt đầu, chưa kịp chấm công.
const MIN_DAYS_FOR_EVALUATION = 6;

function computeEmployeeTaskStats(employeeId, tasks, orders, marketingLogs) {
  const own = (tasks || []).filter((t) => t.employeeId === employeeId);
  let done = 0, warned = 0;
  own.forEach((t) => {
    const progress = computeTaskProgress(t, orders, marketingLogs);
    const status = evaluateTaskStatus(t, progress.value);
    if (status === "dat") done++;
    if (status === "canh_bao") warned++;
  });
  return { total: own.length, done, warned };
}

function computeMasterRanking(emp, payrollRow, taskStats) {
  const actualDays = payrollRow ? payrollRow.actualDays : 0;
  const attendanceRate = payrollRow && payrollRow.standardDays > 0 ? payrollRow.actualDays / payrollRow.standardDays : 0;
  const perf = evaluatePerformance(emp);
  const perfScore = perf.status === "tot" ? 100 : perf.status === "trung_binh" ? 60 : perf.status === "chua_co_du_lieu" ? 100 : 20;
  const taskWarnPenalty = taskStats.total > 0 ? (taskStats.warned / taskStats.total) * 100 : 0;
  const taskDoneRate = taskStats.total > 0 ? (taskStats.done / taskStats.total) * 100 : null;

  // Điểm chuyên cần/thái độ — có đi làm đều không, có bị cảnh báo "ngồi chơi" ở Giao việc không.
  const disciplineScore = Math.max(0, Math.round(attendanceRate * 100 - taskWarnPenalty * 0.6));
  // Điểm kết quả công việc — doanh số/KPI thật + tỷ lệ hoàn thành nhiệm vụ được giao.
  const outputScore = taskDoneRate !== null ? Math.round(perfScore * 0.6 + taskDoneRate * 0.4) : perfScore;
  const compositeScore = Math.round(disciplineScore * 0.4 + outputScore * 0.6);

  // Tín hiệu nghiêm trọng dựa trên NHIỀU THÁNG (không bị ảnh hưởng bởi thiếu dữ liệu tháng này).
  const chronicByKpiHistory = (emp.consecutiveLowKpiMonths || 0) >= 3;
  // Chưa đủ ngày công tháng này VÀ chưa có nhiệm vụ nào để đánh giá thay thế → chưa đủ căn cứ chấm điểm.
  const notEnoughData = !chronicByKpiHistory && actualDays < MIN_DAYS_FOR_EVALUATION && taskStats.total === 0;

  let category;
  if (chronicByKpiHistory) category = "cho_thoi_viec";
  else if (notEnoughData) category = "chua_du_lieu";
  else {
    const chronicSevere = attendanceRate < 0.65 && taskStats.warned >= 3;
    if (chronicSevere) category = "cho_thoi_viec";
    else if (disciplineScore < 55) category = "luoi_bieng";
    else if (outputScore < 55 || perf.status === "canh_bao") category = "can_cai_thien";
    else if (compositeScore >= 80) category = "cham_chi";
    else category = "on_dinh";
  }

  return { attendanceRate, disciplineScore, outputScore, compositeScore, category, perf, taskStats, actualDays, notEnoughData };
}

function exportMasterRankingExcel(rows) {
  const wb = XLSX.utils.book_new();
  const data = rows.map((r) => ({
    "Nhân viên": r.emp.name, "Vị trí": ROLE_META[r.emp.roleType]?.label,
    "Chuyên cần (%)": Math.round(r.attendanceRate * 100), "Điểm thái độ": r.disciplineScore,
    "Điểm kết quả công việc": r.outputScore, "Điểm tổng hợp": r.compositeScore,
    "Nhiệm vụ đạt/tổng": `${r.taskStats.done}/${r.taskStats.total}`, "Lần cảnh báo ngồi chơi": r.taskStats.warned,
    "Phân loại": RANKING_CATEGORY[r.category].label,
    "Nhắc nhở": r.perf.reminders.join(" | ") || "Không có",
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = new Array(9).fill({ wch: 20 });
  XLSX.utils.book_append_sheet(wb, ws, "Xếp hạng tổng hợp");
  XLSX.writeFile(wb, `DOMIX_Xep_hang_tong_hop_${TODAY.toISOString().slice(0, 10)}.xlsx`);
}

function exportTasksExcel(tasks, employees, orders, marketingLogs) {
  const wb = XLSX.utils.book_new();
  const nameOf = (id) => employees.find((e) => e.id === id)?.name || "—";
  const statusLabel = { dat: "Đạt chỉ tiêu", dang_lam: "Đang làm", canh_bao: "Cảnh báo - chưa có tiến độ" };
  const rows = tasks.map((t) => {
    const progress = computeTaskProgress(t, orders, marketingLogs);
    const status = evaluateTaskStatus(t, progress.value);
    return {
      "Ngày": t.date, "Nhân viên": nameOf(t.employeeId), "Loại mục tiêu": TASK_TYPES[t.targetType]?.label,
      "Chỉ tiêu": t.targetType === "khac" ? "—" : t.targetValue, "Tiến độ thực tế": progress.label,
      "Mô tả công việc": t.description, "Trạng thái": statusLabel[status],
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 40 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws, "Giao việc");
  XLSX.writeFile(wb, `DOMIX_Giao_viec_${TODAY.toISOString().slice(0, 10)}.xlsx`);
}

// ---------- Hỗ trợ khách hàng — tránh nhiều người cùng hỗ trợ 1 khách, biết ai đang bận ----------
// ---------- Chat công ty — gắn vị trí, gửi ảnh/file, lọc nội dung, chỉ lưu 30 ngày ----------
// LƯU Ý QUAN TRỌNG: app chưa có server thật, nên chat này hoạt động đúng trong PHIÊN TRÌNH DUYỆT
// HIỆN TẠI — chưa đồng bộ thời gian thực giữa các máy/điện thoại khác nhau (giống mọi tính năng
// khác trong app). Cấu trúc dữ liệu đã đúng chuẩn để sau này cắm vào backend thật là chạy được ngay.
const CHAT_RETENTION_DAYS = 30;
function ChatCongTy({ messages, setMessages, employees }) {
  const [postingAsId, setPostingAsId] = useState(employees[0]?.id || "");
  const [text, setText] = useState("");
  const [fileDraft, setFileDraft] = useState(null);
  const [blockedMsg, setBlockedMsg] = useState("");
  const fileInputRef = useRef(null);
  const [viewingFile, setViewingFile] = useState(null);

  // Tự dọn tin nhắn quá 30 ngày — chỉ xoá đúng lúc mở tab này, không cần chạy nền liên tục.
  useEffect(() => {
    const cutoff = new Date(TODAY.getTime() - CHAT_RETENTION_DAYS * 86400000);
    setMessages((prev) => prev.filter((m) => new Date(m.timestamp.replace(" ", "T")) >= cutoff));
  }, []);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFileDraft({ data: reader.result, name: file.name, type: file.type });
    reader.readAsDataURL(file);
  };

  const send = () => {
    if (!text.trim() && !fileDraft) return;
    if (!postingAsId) { setBlockedMsg("Chọn bạn là ai trước khi gửi (chưa có đăng nhập thật, phải tự chọn)."); return; }
    if (text.trim()) {
      const bad = containsProfanity(text);
      if (bad) { setBlockedMsg(`Nội dung chứa từ ngữ không phù hợp ("${bad}") — vui lòng sửa lại trước khi gửi.`); return; }
    }
    setBlockedMsg("");
    const emp = employees.find((e) => e.id === Number(postingAsId));
    setMessages((prev) => [...prev, {
      id: Date.now(), employeeId: emp?.id, employeeName: emp?.name || "—", position: ROLE_META[emp?.roleType]?.label || "—",
      text: text.trim(), fileData: fileDraft?.data || "", fileName: fileDraft?.name || "", fileType: fileDraft?.type || "",
      timestamp: nowStamp(),
    }]);
    setText("");
    setFileDraft(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-lg border border-paper-line p-3 text-xs text-muted flex items-start gap-2">
        <Link2 size={13} className="text-ink-light shrink-0 mt-0.5" />
        <span>Chat nội bộ công ty — tin nhắn gắn kèm tên + vị trí công việc của người gửi, gửi được ảnh/file, có lọc nội dung không phù hợp. <strong className="text-charcoal">Tự động xoá tin nhắn cũ hơn {CHAT_RETENTION_DAYS} ngày</strong>, không lưu vĩnh viễn.</span>
      </div>

      <div className="bg-white rounded-lg border border-paper-line overflow-hidden flex flex-col" style={{ height: "560px" }}>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {messages.length === 0 && <p className="text-xs text-muted text-center mt-8">Chưa có tin nhắn nào — bắt đầu trò chuyện bên dưới.</p>}
          {messages.map((m) => (
            <div key={m.id} className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-ink text-white flex items-center justify-center text-xs font-semibold shrink-0">{m.employeeName?.charAt(0) || "?"}</div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-semibold text-charcoal">{m.employeeName}</span>
                  <span className="text-[10px] text-white bg-ink-light px-1.5 py-0.5 rounded-full">{m.position}</span>
                  <span className="text-[10px] text-muted ktns-mono">{m.timestamp}</span>
                </div>
                {m.text && <div className="text-sm text-charcoal mt-0.5">{m.text}</div>}
                {m.fileData && (
                  m.fileType?.startsWith("image/") ? (
                    <img src={m.fileData} alt={m.fileName} className="mt-1.5 max-w-xs rounded-md border border-paper-line cursor-pointer" onClick={() => setViewingFile(m)} />
                  ) : (
                    <button onClick={() => setViewingFile(m)} className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-light underline"><FileText size={12} /> {m.fileName}</button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-paper-line p-3">
          {blockedMsg && <p className="text-xs text-stamp-red mb-2 flex items-center gap-1"><AlertTriangle size={12} /> {blockedMsg}</p>}
          {fileDraft && (
            <div className="flex items-center gap-2 mb-2 bg-paper rounded px-2 py-1.5 text-xs">
              <CheckCircle2 size={12} className="text-ledger-green" /> {fileDraft.name}
              <button onClick={() => { setFileDraft(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="ml-auto text-muted hover:text-stamp-red"><X size={12} /></button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <select value={postingAsId} onChange={(e) => setPostingAsId(e.target.value)} className="border border-paper-line rounded px-2 py-2 text-xs bg-white shrink-0" title="Chưa có đăng nhập thật — tự chọn bạn là ai">
              <option value="">— Bạn là ai? —</option>
              {employees.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
            </select>
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Nhập tin nhắn..." className="flex-1 border border-paper-line rounded-md px-3 py-2 text-sm" />
            <label className="border border-paper-line rounded-md p-2 cursor-pointer hover:border-ink shrink-0" title="Gửi ảnh/file">
              <Paperclip size={16} className="text-ink-light" />
              <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xlsx,.xls" onChange={handleFile} className="hidden" />
            </label>
            <button onClick={send} className="bg-ink text-white text-sm px-4 py-2 rounded-md hover:bg-ink-light shrink-0">Gửi</button>
          </div>
        </div>
      </div>

      {viewingFile && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-8" onClick={() => setViewingFile(null)}>
          <div className="bg-white rounded-lg p-4 max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="ktns-serif font-semibold text-ink text-sm">{viewingFile.fileName}</h3>
              <button onClick={() => setViewingFile(null)} className="text-muted hover:text-ink"><X size={18} /></button>
            </div>
            {viewingFile.fileType?.startsWith("image/") ? (
              <img src={viewingFile.fileData} alt={viewingFile.fileName} className="max-w-full rounded" />
            ) : (
              <a href={viewingFile.fileData} download={viewingFile.fileName} className="text-sm text-ink-light underline">Tải file {viewingFile.fileName}</a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HoTroKhachHang({ cases, setCases, employees, orders, setOrders }) {
  const supportStaff = employees.filter((e) => e.roleType === "ky_thuat" || e.roleType === "cskh");
  const blankForm = { customerName: "", phone: "", issue: "", employeeId: supportStaff[0]?.id || "" };
  const [form, setForm] = useState(blankForm);
  const [showForm, setShowForm] = useState(false);
  const [dupWarning, setDupWarning] = useState(null);
  const [resolveDraft, setResolveDraft] = useState({});
  // Lịch sử đã hoàn tất — lọc theo ngày/khoảng ngày, mặc định xem trong ngày hôm nay.
  const [historyMode, setHistoryMode] = useState("today"); // today | custom | all
  const [historyFrom, setHistoryFrom] = useState(TODAY_STR);
  const [historyTo, setHistoryTo] = useState(TODAY_STR);
  const [showHistoryPicker, setShowHistoryPicker] = useState(false);

  // "cho_nhan" = tín hiệu từ Sale gửi sang, CHƯA có ai nhận — vẫn cần hiện trong danh sách cần xử
  // lý, nhưng KHÔNG tính là "đang bận" cho ai (chưa ai nhận thì chưa bận).
  const activeCases = cases.filter((c) => c.status === "dang_ho_tro" || c.status === "cho_nhan");
  const busyByEmployee = {};
  cases.filter((c) => c.status === "dang_ho_tro").forEach((c) => { busyByEmployee[c.employeeId] = c; });

  const findActiveDuplicate = (phone) => cases.find((c) => c.phone === phone && (c.status === "dang_ho_tro" || c.status === "cho_nhan"));

  const startSupport = (force) => {
    if (!form.customerName || !form.phone || !form.employeeId) return;
    if (!force) {
      const dup = findActiveDuplicate(form.phone);
      if (dup) { setDupWarning(dup); return; }
    }
    setCases((prev) => [...prev, {
      id: Date.now(), customerName: form.customerName, phone: form.phone, issue: form.issue,
      employeeId: Number(form.employeeId), status: "dang_ho_tro", startedAt: nowStamp(), completedAt: null, note: "",
    }]);
    setForm(blankForm);
    setShowForm(false);
    setDupWarning(null);
  };
  const claimCase = (id, employeeId) => setCases((prev) => prev.map((c) => (c.id === id ? { ...c, employeeId: Number(employeeId), status: "dang_ho_tro", startedAt: nowStamp() } : c)));
  // Hoàn tất PHẢI kèm ghi chú kết quả — kết quả này tự động đẩy về đúng đơn CRM gốc (contactLog)
  // để Sale xem lại được khách đã được hỗ trợ ra sao, KHÔNG đụng gì tới số tiền/doanh thu.
  const completeCase = (id) => {
    const draft = resolveDraft[id];
    const resultNote = draft?.result || "Đã hỗ trợ xong, không ghi chú thêm.";
    setCases((prev) => prev.map((c) => (c.id === id ? { ...c, status: "hoan_tat", completedAt: nowStamp(), resultNote } : c)));
    const c = cases.find((x) => x.id === id);
    if (c?.sourceCrmOrderId && setOrders) {
      setOrders((prev) => prev.map((o) => (o.id === c.sourceCrmOrderId ? {
        ...o,
        contactLog: [...(o.contactLog || []), { id: Date.now(), date: nowStamp(), type: "support", note: `[Kết quả hỗ trợ kỹ thuật] ${resultNote}`, acknowledged: false }],
      } : o)));
    }
    setResolveDraft((p) => ({ ...p, [id]: { result: "" } }));
  };
  const removeCase = (id) => setCases((prev) => prev.filter((c) => c.id !== id));

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-lg border border-paper-line p-3 text-xs text-muted flex items-start gap-2">
        <Link2 size={13} className="text-ink-light shrink-0 mt-0.5" />
        <span>Theo dõi ai đang hỗ trợ khách nào ngay lúc này — tạo ca hỗ trợ mới sẽ <strong className="text-charcoal">tự cảnh báo nếu khách đó đã có người khác đang xử lý</strong>, tránh 2-3 người cùng nhắn/gọi 1 khách gây phiền. Sale chốt đơn xong bấm "Gửi hỗ trợ khách hàng" ở tab CRM sẽ tự đẩy tên/SĐT/sản phẩm/thời hạn sang đây (<strong className="text-charcoal">không kèm doanh thu</strong> — bảo mật, bên hỗ trợ không cần và không được xem số tiền). Ai rảnh thì bấm nhận ca. Xong việc ghi kết quả rồi bấm "Hoàn tất" — kết quả tự động gửi ngược về đúng đơn hàng bên CRM để Sale xem lại.</span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard icon={Headphones} label="Đang hỗ trợ" value={activeCases.length} tone={activeCases.length > 0 ? "down" : "up"} />
        <KpiCard icon={UserCheck} label="Nhân viên đang bận" value={Object.keys(busyByEmployee).length} />
        <KpiCard icon={CheckCircle2} label="Đã hoàn tất hôm nay" value={cases.filter((c) => c.status === "hoan_tat" && c.completedAt?.startsWith(TODAY_STR)).length} tone="up" />
        <KpiCard icon={Users} label="Tổng nhân sự hỗ trợ/kỹ thuật" value={supportStaff.length} />
      </div>

      <div className="bg-white rounded-lg border border-paper-line p-4">
        <div className="text-xs font-semibold text-ink uppercase mb-2">Trạng thái từng nhân viên — biết ngay ai rảnh</div>
        <div className="grid grid-cols-4 gap-3">
          {supportStaff.length === 0 && <p className="text-xs text-muted col-span-4">Chưa có nhân viên nào ở vị trí Hỗ trợ kỹ thuật/CSKH.</p>}
          {supportStaff.map((e) => {
            const busy = busyByEmployee[e.id];
            return (
              <div key={e.id} className={`rounded-md border p-3 ${busy ? "border-stamp-red/40 bg-stamp-red/5" : "border-ledger-green/40 bg-ledger-green/5"}`}>
                <div className="text-sm font-medium text-charcoal">{e.name}</div>
                {busy ? (
                  <div className="text-[11px] text-stamp-red mt-1">Đang bận — hỗ trợ {busy.customerName} ({busy.phone})</div>
                ) : (
                  <div className="text-[11px] text-ledger-green mt-1">Đang rảnh</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={() => { setForm(blankForm); setShowForm(true); }} className="flex items-center gap-1.5 text-sm bg-ink text-white px-3.5 py-2 rounded-md hover:bg-ink-light w-fit">
        <Plus size={15} /> Bắt đầu ca hỗ trợ mới
      </button>

      {showForm && (
        <div className="bg-white rounded-lg border border-paper-line p-4 relative">
          <button
            className="absolute top-3 right-3 text-muted hover:text-ink"
            onClick={() => { if ((form.customerName || form.phone) && !window.confirm("Chưa lưu — đóng lại sẽ mất thông tin vừa nhập. Vẫn muốn đóng?")) return; setShowForm(false); }}
          ><X size={16} /></button>
          <h3 className="ktns-serif font-semibold text-ink mb-4">Bắt đầu ca hỗ trợ mới</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-muted flex flex-col gap-1">Tên khách hàng<input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">SĐT<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
            <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Vấn đề cần hỗ trợ<input value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })} placeholder="VD: Không đăng nhập được, lỗi key kích hoạt..." className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Nhân viên phụ trách
              <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm">
                {supportStaff.map((e) => (<option key={e.id} value={e.id}>{e.name}{busyByEmployee[e.id] ? " — đang bận" : " — đang rảnh"}</option>))}
              </select>
            </label>
          </div>
          {dupWarning && (
            <div className="mt-3 bg-stamp-red/10 border border-stamp-red rounded-md p-3 text-xs text-charcoal">
              <div className="flex items-center gap-1.5 font-semibold text-stamp-red mb-1"><AlertTriangle size={13} /> Khách này đang được hỗ trợ rồi!</div>
              <p>Số {dupWarning.phone} hiện đang được <strong>{employees.find((e) => e.id === dupWarning.employeeId)?.name || "—"}</strong> xử lý (vấn đề: {dupWarning.issue || "—"}) — tạo thêm ca nữa có thể khiến 2 người cùng liên hệ 1 khách.</p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => startSupport(true)} className="bg-stamp-red text-white text-xs px-3 py-1.5 rounded-md">Vẫn tạo thêm (biết rủi ro)</button>
                <button onClick={() => setDupWarning(null)} className="border border-paper-line text-xs px-3 py-1.5 rounded-md text-muted">Huỷ, không tạo</button>
              </div>
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <button onClick={() => startSupport(false)} className="bg-ledger-green text-white text-sm px-3 py-1.5 rounded-md">Bắt đầu hỗ trợ</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
        <div className="px-4 pt-3 pb-1 text-xs font-semibold text-ink uppercase">Đang hỗ trợ ({activeCases.length})</div>
        <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10"><tr className="bg-paper text-left text-xs uppercase text-muted"><th className="px-4 py-2">STT</th><th className="px-4 py-2">Khách hàng</th><th className="px-4 py-2">SĐT/Zalo</th><th className="px-4 py-2">Vấn đề</th><th className="px-4 py-2">Nhân viên</th><th className="px-4 py-2">Bắt đầu lúc</th><th className="px-4 py-2"></th></tr></thead>
          <tbody>
            {activeCases.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-xs text-muted">Không có ca hỗ trợ nào đang xử lý — mọi người đang rảnh.</td></tr>}
            {activeCases.slice().reverse().map((c, idx) => {
              const draft = resolveDraft[c.id] || { result: "" };
              return (
              <React.Fragment key={c.id}>
              <tr className={`border-t border-paper-line ${c.status === "cho_nhan" ? "ktns-warn-row" : ""}`}>
                <td className="px-4 py-2 ktns-mono text-xs text-muted">{idx + 1}</td>
                <td className="px-4 py-2 font-medium">{c.customerName}{c.productName && <div className="text-[10px] text-muted">{c.productName}{c.durationLabel ? ` — ${c.durationLabel}` : ""}</div>}</td>
                <td className="px-4 py-2 ktns-mono text-xs">{c.phone}</td>
                <td className="px-4 py-2 text-xs">{c.issue || "—"}</td>
                <td className="px-4 py-2 text-xs">
                  {c.status === "cho_nhan" ? (
                    <select onChange={(e) => e.target.value && claimCase(c.id, e.target.value)} defaultValue="" className="border border-paper-line rounded px-1.5 py-1 text-[11px]">
                      <option value="" disabled>— Nhận ca này —</option>
                      {supportStaff.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
                    </select>
                  ) : (employees.find((e) => e.id === c.employeeId)?.name || "—")}
                </td>
                <td className="px-4 py-2 ktns-mono text-xs text-muted">{c.startedAt}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => removeCase(c.id)} className="text-muted hover:text-stamp-red"><Trash2 size={13} /></button>
                </td>
              </tr>
              {c.status === "dang_ho_tro" && (
                <tr className="border-t border-paper-line bg-paper/40">
                  <td colSpan={7} className="px-4 py-2.5">
                    <div className="flex gap-2 items-center">
                      <input value={draft.result} onChange={(e) => setResolveDraft((p) => ({ ...p, [c.id]: { result: e.target.value } }))} placeholder="Ghi kết quả hỗ trợ trước khi hoàn tất (VD: đã gửi lại mã key, hướng dẫn kích hoạt xong)..." className="flex-1 border border-paper-line rounded px-2 py-1.5 text-xs" />
                      <button onClick={() => completeCase(c.id)} className="text-[11px] bg-ledger-green text-white px-3 py-1.5 rounded flex items-center gap-1 shrink-0"><CheckCircle2 size={11} /> Hoàn tất hỗ trợ</button>
                    </div>
                  </td>
                </tr>
              )}
              </React.Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {cases.filter((c) => c.status === "hoan_tat").length > 0 && (
        <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
          <div className="px-4 pt-3 pb-1 flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs font-semibold text-ink uppercase">Lịch sử đã hoàn tất</div>
            <div className="relative">
              <button onClick={() => setShowHistoryPicker((v) => !v)} className="text-xs px-2.5 py-1.5 rounded-md border border-paper-line text-ink-light flex items-center gap-1.5">
                <CalendarCheck size={12} />
                {historyMode === "today" ? "Hôm nay" : historyMode === "all" ? "Toàn bộ lịch sử" : `${historyFrom.split("-").reverse().join("/")} → ${historyTo.split("-").reverse().join("/")}`}
                <ChevronRight size={11} className={`transition-transform ${showHistoryPicker ? "rotate-90" : ""}`} />
              </button>
              {showHistoryPicker && (
                <div className="absolute top-full right-0 mt-1 bg-white border border-paper-line rounded-md shadow-lg p-3 z-20 w-64">
                  <button onClick={() => { setHistoryMode("today"); setShowHistoryPicker(false); }} className={`w-full text-left text-xs px-2 py-1.5 rounded ${historyMode === "today" ? "bg-paper font-medium" : "hover:bg-paper"}`}>Hôm nay</button>
                  <button onClick={() => { setHistoryMode("all"); setShowHistoryPicker(false); }} className={`w-full text-left text-xs px-2 py-1.5 rounded ${historyMode === "all" ? "bg-paper font-medium" : "hover:bg-paper"}`}>Toàn bộ lịch sử</button>
                  <div className={`px-2 py-1.5 rounded ${historyMode === "custom" ? "bg-paper" : ""}`}>
                    <button onClick={() => setHistoryMode("custom")} className={`text-xs mb-1.5 ${historyMode === "custom" ? "font-medium" : ""}`}>Tuỳ chỉnh khoảng ngày</button>
                    <div className="flex items-center gap-1">
                      <input type="date" value={historyFrom} onChange={(e) => { setHistoryFrom(e.target.value); setHistoryMode("custom"); }} className="border border-paper-line rounded px-1.5 py-1 text-[11px] flex-1" />
                      <span className="text-muted text-[10px]">→</span>
                      <input type="date" value={historyTo} onChange={(e) => { setHistoryTo(e.target.value); setHistoryMode("custom"); }} className="border border-paper-line rounded px-1.5 py-1 text-[11px] flex-1" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10"><tr className="bg-paper text-left text-xs uppercase text-muted"><th className="px-4 py-2">STT</th><th className="px-4 py-2">Khách hàng</th><th className="px-4 py-2">SĐT</th><th className="px-4 py-2">Vấn đề</th><th className="px-4 py-2">Nhân viên</th><th className="px-4 py-2">Bắt đầu</th><th className="px-4 py-2">Hoàn tất</th></tr></thead>
            <tbody>
              {(() => {
                const filtered = cases.filter((c) => {
                  if (c.status !== "hoan_tat") return false;
                  if (historyMode === "all") return true;
                  const d = c.completedAt?.slice(0, 10);
                  if (historyMode === "today") return d === TODAY_STR;
                  return d >= historyFrom && d <= historyTo;
                });
                if (filtered.length === 0) {
                  return <tr><td colSpan={7} className="px-4 py-6 text-center text-xs text-muted">Không có ca nào hoàn tất trong khoảng thời gian này.</td></tr>;
                }
                return filtered.slice().reverse().map((c, idx) => (
                  <tr key={c.id} className="border-t border-paper-line text-xs">
                    <td className="px-4 py-2 ktns-mono text-muted">{idx + 1}</td>
                    <td className="px-4 py-2">{c.customerName}</td>
                    <td className="px-4 py-2 ktns-mono">{c.phone}</td>
                    <td className="px-4 py-2">{c.issue || "—"}</td>
                    <td className="px-4 py-2">{employees.find((e) => e.id === c.employeeId)?.name || "—"}</td>
                    <td className="px-4 py-2 ktns-mono text-muted">{c.startedAt}</td>
                    <td className="px-4 py-2 ktns-mono text-muted">{c.completedAt}</td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}

function GiaoViec({ tasks, setTasks, employees, orders, marketingLogs, reportYear, reportMonth }) {
  const [showForm, setShowForm] = useState(false);
  const [filterDate, setFilterDate] = useState(GIAOVIEC_TODAY);
  const [viewMonthMode, setViewMonthMode] = useState(false);
  const firstEmp = employees[0];
  const [form, setForm] = useState({ date: GIAOVIEC_TODAY, employeeId: firstEmp?.id || "", targetType: (ROLE_TASK_TYPES[firstEmp?.roleType] || ["khac"])[0], targetValue: "", description: "" });

  const availableTypes = (empId) => {
    const emp = employees.find((e) => e.id === Number(empId));
    return ROLE_TASK_TYPES[emp?.roleType] || ["khac"];
  };
  const selectEmployee = (empId) => {
    const types = availableTypes(empId);
    setForm((f) => ({ ...f, employeeId: empId, targetType: types.includes(f.targetType) ? f.targetType : types[0] }));
  };

  const addTask = () => {
    if (!form.employeeId || !form.description) return;
    setTasks((prev) => [...prev, { ...form, id: Date.now(), employeeId: Number(form.employeeId), targetValue: Number(form.targetValue) || 0, doneManual: false }]);
    setForm({ date: GIAOVIEC_TODAY, employeeId: firstEmp?.id || "", targetType: (ROLE_TASK_TYPES[firstEmp?.roleType] || ["khac"])[0], targetValue: "", description: "" });
    setShowForm(false);
  };
  const toggleDone = (id) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, doneManual: !t.doneManual } : t)));
  const removeTask = (id) => setTasks((prev) => prev.filter((t) => t.id !== id));
  const nameOf = (id) => employees.find((e) => e.id === id)?.name || "—";

  const filtered = viewMonthMode
    ? tasks.filter((t) => { const d = new Date(t.date); return d.getFullYear() === reportYear && d.getMonth() + 1 === reportMonth; })
    : tasks.filter((t) => t.date === filterDate);
  const statusOrder = { canh_bao: 0, dang_lam: 1, dat: 2 };
  const rows = filtered
    .map((t) => {
      const progress = computeTaskProgress(t, orders, marketingLogs);
      const status = evaluateTaskStatus(t, progress.value);
      return { ...t, progress, status };
    })
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status]); // cảnh báo lên đầu — nhìn phát biết ai chưa hiệu quả
  const warnCount = rows.filter((r) => r.status === "canh_bao").length;
  const doneCount = rows.filter((r) => r.status === "dat").length;

  // Nhân viên chưa được giao việc gì ngày này — cũng đáng để ý, tránh sót người.
  const unassigned = employees.filter((e) => !filtered.some((t) => t.employeeId === e.id));

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-lg border border-paper-line p-3 text-xs text-muted flex items-start gap-2">
        <Link2 size={13} className="text-ink-light shrink-0 mt-0.5" />
        <span>Giao chỉ tiêu rõ ràng cho từng vị trí mỗi ngày — <strong className="text-charcoal">Sale</strong> tự lấy doanh số/số khách/số cuộc gọi từ CRM, <strong className="text-charcoal">Marketing</strong> tự lấy khách tiếp cận/chuyển đổi từ nhật ký hàng ngày, <strong className="text-charcoal">Kỹ thuật &amp; vị trí khác</strong> giao việc cụ thể tick hoàn thành. Qua buổi trưa mà vẫn 0 tiến độ sẽ tự chuyển sang <strong className="text-stamp-red">cảnh báo</strong>.</span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard icon={ClipboardList} label={viewMonthMode ? `Nhiệm vụ kỳ ${reportMonth}/${reportYear}` : "Nhiệm vụ hôm nay"} value={filtered.length} />
        <KpiCard icon={CheckCircle2} label="Đã đạt chỉ tiêu" value={doneCount} tone="up" />
        <KpiCard icon={AlertTriangle} label="Cảnh báo — chưa có tiến độ" value={warnCount} tone={warnCount > 0 ? "down" : "up"} />
        <KpiCard icon={UserCheck} label="Chưa được giao việc" value={unassigned.length} tone={unassigned.length > 0 ? "down" : "up"} />
      </div>

      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMonthMode((v) => !v)} className={`text-xs px-2.5 py-1.5 rounded-md border flex items-center gap-1.5 ${viewMonthMode ? "bg-ink text-white border-ink" : "border-paper-line text-ink-light"}`}>
            <CalendarCheck size={12} /> {viewMonthMode ? `Xem cả kỳ ${reportMonth}/${reportYear}` : "Xem theo ngày"}
          </button>
          {!viewMonthMode && <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="border border-paper-line rounded-md px-3 py-2 text-sm ktns-mono" />}
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportTasksExcel(tasks, employees, orders, marketingLogs)} className="flex items-center gap-1.5 text-sm bg-ledger-green text-white px-3.5 py-2 rounded-md hover:opacity-90">
            <FileSpreadsheet size={15} /> Xuất Excel
          </button>
          <button onClick={() => { selectEmployee(firstEmp?.id || ""); setForm((f) => ({ ...f, date: filterDate, targetValue: "", description: "" })); setShowForm(true); }} className="flex items-center gap-1.5 text-sm bg-ink text-white px-3.5 py-2 rounded-md hover:bg-ink-light">
            <Plus size={15} /> Giao việc mới
          </button>
        </div>
      </div>

      {unassigned.length > 0 && (
        <div className="bg-white rounded-lg border border-paper-line p-3 text-xs text-muted flex items-start gap-2">
          <AlertTriangle size={13} className="text-gold shrink-0 mt-0.5" />
          <span>Chưa giao việc cho: <strong className="text-charcoal">{unassigned.map((e) => e.name).join(", ")}</strong> — nên giao để tránh sót người ngồi không.</span>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-lg border border-paper-line p-5 relative">
          <button className="absolute top-3 right-3 text-muted hover:text-ink" onClick={() => { if (form.description && !window.confirm("Chưa lưu — đóng lại sẽ mất thông tin vừa nhập. Vẫn muốn đóng?")) return; setShowForm(false); }}><X size={16} /></button>
          <h3 className="ktns-serif font-semibold text-ink mb-4">Giao việc mới</h3>
          <div className="grid grid-cols-4 gap-3">
            <label className="text-xs text-muted flex flex-col gap-1">Ngày<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Nhân viên
              <select value={form.employeeId} onChange={(e) => selectEmployee(e.target.value)} className="border border-paper-line rounded px-2 py-1.5 text-sm">
                {employees.map((e) => (<option key={e.id} value={e.id}>{e.name} — {ROLE_META[e.roleType]?.label}</option>))}
              </select>
            </label>
            <label className="text-xs text-muted flex flex-col gap-1">Loại chỉ tiêu <span className="text-[10px] text-muted normal-case">(theo vị trí đã chọn)</span>
              <select value={form.targetType} onChange={(e) => setForm({ ...form, targetType: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm">
                {availableTypes(form.employeeId).map((id) => (<option key={id} value={id}>{TASK_TYPES[id].label}</option>))}
              </select>
            </label>
            {form.targetType !== "khac" && (
              <label className="text-xs text-muted flex flex-col gap-1">Giá trị chỉ tiêu ({TASK_TYPES[form.targetType].unit})<input type="number" value={form.targetValue} onChange={(e) => setForm({ ...form, targetValue: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
            )}
            <label className="text-xs text-muted flex flex-col gap-1 col-span-4">Mô tả công việc cụ thể<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="VD: Chốt ít nhất 30 triệu doanh số, ưu tiên khách cũ..." className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
          </div>
          <button onClick={addTask} className="mt-4 bg-ledger-green text-white text-sm px-4 py-2 rounded-md hover:opacity-90">Giao việc</button>
        </div>
      )}

      <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
        <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-paper text-left text-xs uppercase text-muted">
              <th className="px-4 py-2.5">Nhân viên</th>
              <th className="px-4 py-2.5">Công việc được giao</th>
              <th className="px-4 py-2.5 text-right">Chỉ tiêu</th>
              <th className="px-4 py-2.5 text-right">Tiến độ thực tế</th>
              <th className="px-4 py-2.5">Trạng thái</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-4 text-center text-xs text-muted">Chưa giao việc nào cho ngày này.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className={`border-t border-paper-line ${r.status === "canh_bao" ? "ktns-warn-row" : ""}`}>
                <td className="px-4 py-2">
                  <div className="font-medium">{nameOf(r.employeeId)}</div>
                  <div className="text-[11px] text-muted">{ROLE_META[employees.find((e) => e.id === r.employeeId)?.roleType]?.label}</div>
                </td>
                <td className="px-4 py-2 text-xs text-muted max-w-sm">{r.description}</td>
                <td className="px-4 py-2 text-right ktns-mono text-xs">{r.targetType === "khac" ? "—" : `${r.targetValue} ${TASK_TYPES[r.targetType].unit}`}</td>
                <td className="px-4 py-2 text-right ktns-mono text-xs font-medium">{r.progress.label}</td>
                <td className="px-4 py-2">
                  {r.status === "dat" && <StampBadge text="ĐẠT CHỈ TIÊU" gold />}
                  {r.status === "dang_lam" && <StampBadge text="ĐANG LÀM" muted />}
                  {r.status === "canh_bao" && <StampBadge text="CẢNH BÁO" />}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {r.targetType === "khac" && (
                      <button onClick={() => toggleDone(r.id)} className="text-[10px] border border-paper-line rounded px-2 py-1 text-ink-light hover:border-gold">{r.doneManual ? "Bỏ đánh dấu" : "Đánh dấu xong"}</button>
                    )}
                    <button onClick={() => removeTask(r.id)} className="text-muted hover:text-stamp-red"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      <p className="text-xs text-muted">* Doanh số/số khách/số cuộc gọi lấy tự động từ Doanh thu CRM và nhật ký liên hệ theo đúng ngày — không cần nhập tay tiến độ. Cảnh báo áp dụng khi đã qua buổi trưa (theo giờ máy đang dùng) mà tiến độ vẫn bằng 0.</p>
    </div>
  );
}

// ---------- Doanh thu CRM ----------
function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function exportOrdersExcel(orders, employees) {
  const wb = XLSX.utils.book_new();
  const nameOf = (id) => employees.find((e) => e.id === id)?.name || "—";

  const rows = orders.map((o) => ({
    "Ngày tháng": o.date,
    "Khách hàng": o.customerName,
    "SĐT": o.phone,
    "Email": o.email,
    "Nội dung chuyển khoản": o.note,
    "Nhân sự Sale": nameOf(o.saleEmployeeId),
    "Ngày nhận tiền": o.receivedAt,
    "Số tiền": Math.round(o.amount),
    "Tình trạng": o.invoiceStatus === "issued" ? "Đã xuất hoá đơn" : "Chưa xuất hoá đơn",
    "Loại hoá đơn": o.invoiceType || "",
    "Số hoá đơn": o.invoiceNo,
    "Ngày giờ xuất HĐ": o.invoiceDate,
    "Có chứng từ đính kèm": o.invoiceAttachmentData ? "Có" : "Không",
    "Lần liên hệ gần nhất": (o.contactLog || []).length ? o.contactLog[o.contactLog.length - 1].date : "",
  }));
  const ws1 = XLSX.utils.json_to_sheet(rows);
  ws1["!cols"] = [{ wch: 12 }, { wch: 22 }, { wch: 13 }, { wch: 24 }, { wch: 26 }, { wch: 14 }, { wch: 16 }, { wch: 13 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Đơn hàng");

  const bySale = {};
  orders.forEach((o) => {
    const key = nameOf(o.saleEmployeeId);
    bySale[key] = bySale[key] || { count: 0, total: 0, pending: 0, contacts: 0 };
    bySale[key].count += 1;
    bySale[key].total += Number(o.amount) || 0;
    bySale[key].contacts += (o.contactLog || []).length;
    if (o.invoiceStatus !== "issued") bySale[key].pending += 1;
  });
  const summary = Object.entries(bySale).map(([name, s]) => ({
    "Nhân sự Sale": name, "Số đơn": s.count, "Tổng doanh số": Math.round(s.total),
    "TB / đơn": Math.round(s.total / s.count), "Đơn chưa xuất hoá đơn": s.pending,
    "Tổng lượt liên hệ khách": s.contacts,
  }));
  const ws2 = XLSX.utils.json_to_sheet(summary);
  ws2["!cols"] = [{ wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Tổng hợp theo Sale");

  const contactRows = [];
  orders.forEach((o) => (o.contactLog || []).forEach((c) => contactRows.push({
    "Khách hàng": o.customerName, "SĐT": o.phone, "Nhân sự Sale": nameOf(o.saleEmployeeId),
    "Ngày giờ liên hệ": c.date, "Hình thức": CONTACT_TYPES[c.type]?.label || c.type, "Ghi chú": c.note,
  })));
  const ws3 = XLSX.utils.json_to_sheet(contactRows);
  ws3["!cols"] = [{ wch: 22 }, { wch: 13 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Lịch sử chăm sóc KH");

  XLSX.writeFile(wb, `DOMIX_Doanh_thu_CRM_${TODAY.toISOString().slice(0, 10)}.xlsx`);
}

function exportDailyCallReportExcel(dailyContacts, dailyBySale, date, nameOf) {
  const wb = XLSX.utils.book_new();
  const statusLabel = { tot: "Hiệu quả", trung_binh: "Trung bình", canh_bao: "Chưa hiệu quả" };

  const rows = dailyContacts.map((c) => ({
    "Giờ": c.date, "Nhân sự Sale": nameOf(c.saleEmployeeId),
    "Khách hàng": c.customerName, "SĐT": c.phone, "Nguồn": LEAD_SOURCES[c.source] || "—",
    "Hình thức": CONTACT_TYPES[c.type]?.label || c.type, "Ghi chú": c.note,
  }));
  const ws1 = XLSX.utils.json_to_sheet(rows);
  ws1["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 22 }, { wch: 13 }, { wch: 18 }, { wch: 12 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Chi tiết liên hệ");

  const summary = dailyBySale.map((s) => ({
    "Nhân sự Sale": s.emp.name, "Số khách đã liên hệ": s.uniqueCustomers,
    "Số cuộc gọi": s.calls, "Tổng lượt liên hệ": s.totalContacts, "Đánh giá": statusLabel[s.status],
  }));
  const ws2 = XLSX.utils.json_to_sheet(summary);
  ws2["!cols"] = [{ wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Tổng hợp");

  XLSX.writeFile(wb, `DOMIX_Bao_cao_goi_khach_${date}.xlsx`);
}

function DoanhThuCRM({ orders, setOrders, leads, setLeads, employees, revenueByEmployee, setTransactions, inventory, setInventory, distPartners, distOrders, setDistOrders, reportYear, reportMonth, pages, setSupportCases }) {
  const [showForm, setShowForm] = useState(false);
  const [rangeMode, setRangeMode] = useState("month");
  const [rangeFrom, setRangeFrom] = useState(new Date(reportYear || TODAY.getFullYear(), (reportMonth || TODAY.getMonth() + 1) - 1, 1).toISOString().slice(0, 10));
  const [rangeTo, setRangeTo] = useState(new Date(reportYear || TODAY.getFullYear(), (reportMonth || TODAY.getMonth() + 1), 0).toISOString().slice(0, 10));
  useEffect(() => {
    if (!reportYear || !reportMonth || rangeMode === "custom") return;
    setRangeFrom(new Date(reportYear, reportMonth - 1, 1).toISOString().slice(0, 10));
    setRangeTo(new Date(reportYear, reportMonth, 0).toISOString().slice(0, 10));
  }, [reportYear, reportMonth, rangeMode]);
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  // Tìm kiếm PHẢI xuyên suốt TOÀN BỘ lịch sử, không chỉ trong tháng đang xem — khách chỉ nhớ SĐT
  // hay email thì không thể bắt họ (Sale) nhớ đơn đó thuộc tháng nào để bật đúng bộ lọc trước.
  const orderSearchQ = orderSearch.trim().toLowerCase();
  const visibleOrders = orderSearchQ
    ? orders.filter((o) => o.customerName?.toLowerCase().includes(orderSearchQ) || o.phone?.includes(orderSearchQ) || o.email?.toLowerCase().includes(orderSearchQ))
    : rangeMode === "all"
    ? orders
    : orders.filter((o) => o.date >= rangeFrom && o.date <= rangeTo);
  // Đơn theo ĐÚNG kỳ đang xem, KHÔNG bị ảnh hưởng bởi ô tìm kiếm — dùng riêng cho các ô KPI/thống
  // kê tổng đầu trang, để đổi tháng là số liệu đổi theo NGAY, không lẫn với việc đang tìm kiếm.
  const periodOrders = rangeMode === "all" ? orders : orders.filter((o) => o.date >= rangeFrom && o.date <= rangeTo);
  const [expanded, setExpanded] = useState({});
  const [contactDraft, setContactDraft] = useState({});
  const [expandedLead, setExpandedLead] = useState({});
  const [leadContactDraft, setLeadContactDraft] = useState({});
  const [leadSearch, setLeadSearch] = useState("");
  const [leadFilter, setLeadFilter] = useState("all"); // all | overdue | today | no_date | rejected
  const [leadShowCount, setLeadShowCount] = useState(10);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [bulkReassignTarget, setBulkReassignTarget] = useState("");
  const toggleLeadSelect = (id) => setSelectedLeadIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  // Chuyển khách sang Sale khác — dùng khi 1 Sale quá tải gọi không hết (đẩy bớt cho người rảnh),
  // hoặc Sale đang nghỉ (số vẫn cần người khác chăm chứ không thể để đó chờ).
  const reassignLead = (leadId, newSaleId) => setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, saleEmployeeId: Number(newSaleId) } : l)));
  const bulkReassign = () => {
    if (!bulkReassignTarget || selectedLeadIds.length === 0) return;
    setLeads((prev) => prev.map((l) => (selectedLeadIds.includes(l.id) ? { ...l, saleEmployeeId: Number(bulkReassignTarget) } : l)));
    setSelectedLeadIds([]);
    setBulkReassignTarget("");
  };
  const [callReportDate, setCallReportDate] = useState(TODAY_STR);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadForm, setLeadForm] = useState({
    date: TODAY_STR, customerName: "", phone: "", source: "marketing_ads",
    saleEmployeeId: "", contactType: "call", note: "",
  });
  const saleEmployees = employees.filter((e) => e.roleType === "sale");
  // Sale chốt đơn VÀ Kỹ thuật upsale thành công đều đẩy qua đây để kế toán xuất hoá đơn —
  // loại giao dịch tự suy ra từ vị trí người được chọn, không cần chọn tay 2 lần.
  const dealEmployees = employees.filter((e) => e.roleType === "sale" || e.roleType === "ky_thuat");
  const [form, setForm] = useState({
    date: TODAY_STR, customerName: "", phone: "", email: "", customerTaxCode: "", note: "",
    saleEmployeeId: saleEmployees[0]?.id || "", dealType: "sale", receivedAt: "", amount: "",
    productId: "", quantity: "1", issuedKeyCode: "", pageId: "",
    invoiceStatus: "pending", invoiceNo: "", invoiceDate: "",
  });
  const selectProduct = (productId) => {
    const p = (inventory || []).find((i) => i.id === Number(productId));
    setForm((f) => ({ ...f, productId, amount: p ? String(p.sellPrice * Number(f.quantity || 1)) : f.amount }));
  };
  const updateQty = (qty) => {
    const p = (inventory || []).find((i) => i.id === Number(form.productId));
    setForm((f) => ({ ...f, quantity: qty, amount: p ? String(p.sellPrice * Number(qty || 1)) : f.amount }));
  };

  const addOrder = () => {
    if (!form.customerName || !form.amount) return;
    const emp = employees.find((e) => e.id === Number(form.saleEmployeeId));
    const dealType = emp?.roleType === "ky_thuat" ? "upsale" : "sale";
    const orderId = Date.now();
    const linkedTxId = orderId + 1;
    const product = form.productId ? (inventory || []).find((i) => i.id === Number(form.productId)) : null;
    // Sản phẩm này có gán cho đối tác phân phối nào không (VD Tool AI Agent ← Say Media)? Việc này
    // phải biết TRƯỚC khi quyết định có đẩy Thu Chi ngay hay không.
    const owningPartner = product && distPartners ? distPartners.find((p) => (p.productIds || []).includes(product.id)) : null;
    setOrders((prev) => [...prev, { ...form, id: orderId, saleEmployeeId: Number(form.saleEmployeeId) || null, dealType, productId: form.productId ? Number(form.productId) : null, productName: product?.name || "", quantity: Number(form.quantity) || 1, amount: Number(form.amount) || 0, pageId: form.pageId ? Number(form.pageId) : null, contactLog: [], linkedTxId: owningPartner ? null : linkedTxId }]);
    // Bán được hàng thật (có chọn sản phẩm trong kho) thì tự trừ tồn kho ngay — Kho hàng và
    // Doanh thu CRM luôn khớp số lượng thật, không phải đối chiếu tay.
    if (product && setInventory) {
      setInventory((prev) => prev.map((i) => (i.id === product.id ? { ...i, stock: Math.max(0, i.stock - (Number(form.quantity) || 1)) } : i)));
    }
    if (owningPartner) {
      // Sản phẩm của đối tác phân phối — KHÔNG đẩy Thu Chi ngay ở bước này. Số tiền khách trả gồm
      // cả phần thuộc về đối tác, chưa xác nhận hoá đơn thì chưa biết chính xác công ty thực nhận
      // bao nhiêu — đẩy sớm sẽ phải sửa lại/xuất 2 lần khi đối tác xác nhận. Chỉ tạo đơn Hợp tác
      // phân phối; Thu Chi chỉ nhận đúng 1 khoản DUY NHẤT (lợi nhuận ròng) khi xác nhận xong bên đó.
      const distId = orderId + 2;
      setDistOrders((prev) => [...prev, {
        id: distId, sourceCrmOrderId: orderId, date: form.date, partnerId: owningPartner.id,
        productId: product.id, productName: product.name, quantity: Number(form.quantity) || 1,
        revenue: Number(form.amount) || 0, vatRate: product.vatRate ?? 8, commissionPct: 0,
        issuedKeyCode: form.issuedKeyCode || "", endCustomerName: form.customerName,
        note: `Tự tạo từ đơn CRM #${orderId} — ${owningPartner.name} cung cấp sản phẩm này`,
        partnerInvoiceReceived: false, partnerInvoiceConfirmed: false, partnerInvoiceNo: "", linkedTxId: null,
      }]);
    } else {
      // Sản phẩm/dịch vụ công ty tự làm — đẩy thẳng lên Thu Chi như cũ, không phải chờ đối tác nào.
      setTransactions((prev) => [...prev, {
        id: linkedTxId, date: form.date, kind: "thu", category: dealType === "upsale" ? "Upsale Kỹ thuật (CRM)" : "Bán hàng (CRM)",
        desc: `${form.customerName}${product ? " — " + product.name + " x" + form.quantity : ""} — ${emp?.name || "—"}`, amount: Number(form.amount) || 0,
        partnerName: form.customerName, partnerTaxCode: form.customerTaxCode || "", partnerPhone: form.phone || "", partnerEmail: form.email || "", paymentMethod: "chuyen_khoan",
        invoiceType: "Chưa xác định", invoiceNo: "", vatRate: product?.vatRate ?? 8, attachmentData: "", attachmentName: "", attachmentType: "",
        status: "pending", source: "crm", sourceOrderId: orderId,
      }]);
    }
    setForm({ date: TODAY_STR, customerName: "", phone: "", email: "", customerTaxCode: "", note: "", saleEmployeeId: saleEmployees[0]?.id || "", dealType: "sale", receivedAt: "", amount: "", productId: "", quantity: "1", issuedKeyCode: "", pageId: "", invoiceStatus: "pending", invoiceNo: "", invoiceDate: "" });
    setShowForm(false);
  };
  const prefillOrderFromCustomer = (o) => {
    setForm({ date: TODAY_STR, customerName: o.customerName, phone: o.phone, email: o.email, note: "", saleEmployeeId: o.saleEmployeeId || saleEmployees[0]?.id || "", dealType: "sale", receivedAt: "", amount: "", invoiceStatus: "pending", invoiceNo: "", invoiceDate: "" });
    setShowForm(true);
  };
  const [sentToSupport, setSentToSupport] = useState({});
  const [supportTypeMenu, setSupportTypeMenu] = useState(null);
  // Gửi tín hiệu cho bên Hỗ trợ khách hàng — CHỈ mang theo tên/SĐT/sản phẩm/thời hạn, TUYỆT ĐỐI
  // KHÔNG mang doanh thu/số tiền sang, vì đây là thông tin nội bộ Sale/Kế toán, không cho bên Hỗ
  // trợ (kỹ thuật) xem để bảo mật đúng yêu cầu. Có phân loại rõ mục đích — không chỉ setup mới mà
  // còn chăm sóc định kỳ/tư vấn nâng cấp trong suốt vòng đời khách hàng.
  const sendToSupport = (o, type) => {
    const product = inventory.find((i) => i.id === o.productId);
    const durationLabel = product ? (product.durationMonths > 0 ? `Gói ${product.durationMonths} tháng` : "Trọn đời/vĩnh viễn") : "";
    const typeLabel = SUPPORT_TYPES[type] || SUPPORT_TYPES.kich_hoat;
    setSupportCases((prev) => [...prev, {
      id: Date.now(), customerName: o.customerName, phone: o.phone, zalo: o.phone,
      issue: `[${typeLabel}] ${product?.name || o.productName || "sản phẩm"}${durationLabel ? " — " + durationLabel : ""}`,
      supportType: type || "kich_hoat",
      employeeId: "", status: "cho_nhan", startedAt: nowStamp(), completedAt: null, note: "",
      sourceCrmOrderId: o.id, productName: product?.name || o.productName || "", durationLabel,
    }]);
    setSentToSupport((p) => ({ ...p, [o.id]: true }));
  };
  const [invoiceEdit, setInvoiceEdit] = useState({});
  const [invoiceError, setInvoiceError] = useState({});
  const [activeInvoiceId, setActiveInvoiceId] = useState(null);
  const [viewingAttachment, setViewingAttachment] = useState(null);
  const startInvoiceEdit = (o, e) => {
    e?.stopPropagation();
    setInvoiceError((p) => ({ ...p, [o.id]: "" }));
    setInvoiceEdit((p) => ({ ...p, [o.id]: {
      invoiceNo: o.invoiceNo || `HD${Math.floor(1000 + Math.random() * 9000)}`,
      invoiceDate: o.invoiceDate || nowStamp(),
      invoiceType: o.invoiceType || "Hóa đơn GTGT (VAT)",
      vatRate: o.vatRate ?? 8,
      attachmentData: o.invoiceAttachmentData || "", attachmentName: o.invoiceAttachmentName || "", attachmentType: o.invoiceAttachmentType || "",
    } }));
    setActiveInvoiceId(o.id);
  };
  // Trước khi xoá bản nháp, kiểm tra xem người dùng đã NHẬP GÌ CHƯA (số hoá đơn, đính kèm) —
  // nếu có mà bấm Huỷ/bấm ra ngoài, phải hỏi lại chứ không âm thầm xoá mất công đã nhập.
  const cancelInvoiceEdit = (id) => {
    const draft = invoiceEdit[id];
    const hasUnsavedInput = draft && (draft.invoiceNo || draft.attachmentData);
    if (hasUnsavedInput && !window.confirm("Bạn đã nhập thông tin hoá đơn nhưng chưa bấm Lưu — đóng lại sẽ MẤT hết thông tin vừa nhập. Vẫn muốn đóng?")) {
      return;
    }
    setInvoiceEdit((p) => { const n = { ...p }; delete n[id]; return n; });
    setActiveInvoiceId(null);
  };
  const handleInvoiceFile = (id, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setInvoiceEdit((p) => ({ ...p, [id]: { ...p[id], attachmentData: reader.result, attachmentName: file.name, attachmentType: file.type } }));
    reader.readAsDataURL(file);
  };
  const saveInvoiceEdit = (id) => {
    const draft = invoiceEdit[id];
    if (!draft?.invoiceNo) return;
    if (!draft.attachmentData) { setInvoiceError((p) => ({ ...p, [id]: "Bắt buộc đính kèm ảnh/file hóa đơn trước khi lưu — tránh đánh dấu đã xuất mà không có chứng từ thật." })); return; }
    const order = orders.find((o) => o.id === id);
    // Xuất hóa đơn CRM → tự động tạo giao dịch Thu tương ứng bên Thu Chi, dựa thẳng vào
    // thông tin khách hàng đã có trong đơn — kế toán không cần nhập lại từ đầu.
    const linkedTxId = order?.linkedTxId || Date.now() + 1;
    setTransactions((prev) => {
      const withoutOld = prev.filter((t) => t.id !== order?.linkedTxId);
      return [...withoutOld, {
        id: linkedTxId, date: order.date, kind: "thu", category: order.dealType === "upsale" ? "Upsale Kỹ thuật (CRM)" : "Bán hàng (CRM)",
        desc: `${order.customerName} — ${nameOf(order.saleEmployeeId)}`, amount: order.amount,
        invoiceType: draft.invoiceType, invoiceNo: draft.invoiceNo, vatRate: VAT_INVOICE_TYPES.includes(draft.invoiceType) ? draft.vatRate : 0, status: "approved",
        attachmentData: draft.attachmentData, attachmentName: draft.attachmentName, attachmentType: draft.attachmentType,
        source: "crm", sourceOrderId: id,
      }];
    });
    setOrders((prev) => prev.map((o) => (o.id === id ? {
      ...o, invoiceStatus: "issued", invoiceNo: draft.invoiceNo, invoiceDate: draft.invoiceDate, invoiceType: draft.invoiceType, vatRate: draft.vatRate,
      invoiceAttachmentData: draft.attachmentData, invoiceAttachmentName: draft.attachmentName, invoiceAttachmentType: draft.attachmentType,
      linkedTxId,
    } : o)));
    cancelInvoiceEdit(id);
  };
  const revertToPending = (id) => {
    const order = orders.find((o) => o.id === id);
    if (order?.linkedTxId) setTransactions((prev) => prev.filter((t) => t.id !== order.linkedTxId));
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, invoiceStatus: "pending", invoiceNo: "", invoiceDate: "", invoiceAttachmentData: "", invoiceAttachmentName: "", linkedTxId: null } : o)));
    cancelInvoiceEdit(id);
  };
  const removeOrder = (id) => {
    const order = orders.find((o) => o.id === id);
    if (order?.linkedTxId) setTransactions((prev) => prev.filter((t) => t.id !== order.linkedTxId));
    // Hoàn lại đúng tồn kho đã trừ lúc tạo đơn — trước đây thiếu bước này, xoá đơn nhầm là tồn
    // kho mất vĩnh viễn dù hàng chưa hề thật sự bán ra ngoài.
    if (order?.productId && setInventory) {
      setInventory((prev) => prev.map((i) => (i.id === order.productId ? { ...i, stock: i.stock + (order.quantity || 1) } : i)));
    }
    // Xoá luôn đơn Hợp tác phân phối tự sinh ra từ đơn CRM này (nếu có) — tránh còn sót lại
    // 1 bên mà không rõ đơn gốc đã bị xoá.
    if (setDistOrders && distOrders) {
      const linkedDist = distOrders.find((d) => d.sourceCrmOrderId === id);
      if (linkedDist) {
        if (linkedDist.linkedTxId) setTransactions((prev) => prev.filter((t) => t.id !== linkedDist.linkedTxId));
        setDistOrders((prev) => prev.filter((d) => d.sourceCrmOrderId !== id));
      }
    }
    setOrders((prev) => prev.filter((o) => o.id !== id));
  };
  const nameOf = (id) => employees.find((e) => e.id === id)?.name || "—";
  const toggleExpand = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const addContact = (orderId) => {
    const draft = contactDraft[orderId];
    if (!draft?.note) return;
    setOrders((prev) => prev.map((o) => (o.id === orderId ? {
      ...o, contactLog: [...(o.contactLog || []), { id: Date.now(), date: nowStamp(), type: draft.type || "call", note: draft.note }],
    } : o)));
    setContactDraft((p) => ({ ...p, [orderId]: { type: "call", note: "" } }));
  };

  // Marketing chạy ads / Pancake đẩy số điện thoại qua → tạo khách tiềm năng ngay, gán Sale gọi,
  // ghi chú luôn trong 1 form — chưa cần biết số tiền/đơn hàng, sau chốt được thì sửa lại đơn bình thường.
  const addLead = () => {
    if (!leadForm.phone || !leadForm.saleEmployeeId) return;
    setLeads((prev) => [...prev, {
      id: Date.now(), date: leadForm.date, customerName: leadForm.customerName || "(Chưa rõ tên)", phone: leadForm.phone, email: "",
      note: `Nguồn: ${LEAD_SOURCES[leadForm.source]}`, saleEmployeeId: Number(leadForm.saleEmployeeId),
      source: leadForm.source, status: "dang_cham_soc",
      contactLog: leadForm.note ? [{ date: nowStamp(), type: leadForm.contactType, note: leadForm.note }] : [],
    }]);
    setLeadForm({ date: TODAY_STR, customerName: "", phone: "", source: "marketing_ads", saleEmployeeId: "", contactType: "call", note: "" });
    setShowLeadForm(false);
  };
  const removeLead = (id) => setLeads((prev) => prev.filter((l) => l.id !== id));
  const markLeadRejected = (id) => setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: "tu_choi" } : l)));
  // Chuyển lead thành đơn hàng thật khi Sale đã chốt được — copy đúng thông tin khách qua form
  // Thêm đơn hàng, xoá khỏi danh sách lead (đã "tốt nghiệp" thành khách hàng thật).
  const convertLeadToOrder = (lead) => {
    setForm((f) => ({ ...f, customerName: lead.customerName, phone: lead.phone, saleEmployeeId: lead.saleEmployeeId, note: lead.note }));
    setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    setShowForm(true);
  };
  // Ghi nhận 1 lượt chăm sóc lead + đặt lịch hẹn gọi lại — draft lưu RIÊNG theo từng lead.id nên
  // mở khách này rồi chuyển sang khách khác KHÔNG bị mất nội dung đang gõ của khách trước.
  const addLeadContact = (leadId) => {
    const draft = leadContactDraft[leadId];
    if (!draft?.note && !draft?.nextFollowUpDate) return;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? {
      ...l,
      contactLog: [...(l.contactLog || []), { id: Date.now(), date: nowStamp(), type: draft.type || "call", note: draft.note || "(không ghi chú)" }],
      nextFollowUpDate: draft.nextFollowUpDate || l.nextFollowUpDate,
    } : l)));
    setLeadContactDraft((p) => ({ ...p, [leadId]: { type: "call", note: "", nextFollowUpDate: "" } }));
  };
  // Nâng lên cấp component để dùng chung cho cả bảng LẪN nút "Xem thêm" bên dưới — tránh tính 2 lần.
  const filteredLeads = (() => {
    const q = leadSearch.trim().toLowerCase();
    return (leads || []).filter((l) => {
      if (q) {
        const inNote = (l.contactLog || []).some((c) => c.note?.toLowerCase().includes(q));
        const matches = l.customerName?.toLowerCase().includes(q) || l.phone?.includes(q) || inNote;
        if (!matches) return false;
      }
      if (leadFilter === "overdue") return l.status === "dang_cham_soc" && l.nextFollowUpDate && l.nextFollowUpDate <= TODAY_STR;
      if (leadFilter === "no_date") return l.status === "dang_cham_soc" && !l.nextFollowUpDate;
      if (leadFilter === "rejected") return l.status === "tu_choi";
      return true;
    }).sort((a, b) => (a.nextFollowUpDate || "9999").localeCompare(b.nextFollowUpDate || "9999"));
  })();

  const totalRevenue = periodOrders.reduce((a, o) => a + (Number(o.amount) || 0), 0);
  const pendingCount = periodOrders.filter((o) => o.invoiceStatus !== "issued").length;

  const saleStats = saleEmployees.map((e) => {
    const own = periodOrders.filter((o) => o.saleEmployeeId === e.id);
    const total = own.reduce((a, o) => a + (Number(o.amount) || 0), 0);
    const pending = own.filter((o) => o.invoiceStatus !== "issued").length;
    const contacts = own.reduce((a, o) => a + (o.contactLog || []).length, 0);
    const perf = evaluatePerformance({ ...e, salesActual: revenueByEmployee[e.id] || 0 });
    return { emp: e, count: own.length, total, avg: own.length ? total / own.length : 0, pending, contacts, perf };
  });

  // Báo cáo cuộc gọi/liên hệ khách hàng theo ngày — gộp từ nhật ký chăm sóc của CẢ đơn hàng thật
  // LẪN khách tiềm năng (lead) chưa mua — Sale gọi lead cũng là hoạt động liên hệ thật, phải tính.
  // Kết quả hỗ trợ đã "Xác nhận" thì ẩn khỏi bảng chính (đỡ rối), nhưng KHÔNG xoá — vẫn xem lại
  // được ở khung "Lịch sử hỗ trợ đã xác nhận" thu gọn bên dưới.
  const allDailyContacts = [
    ...orders.flatMap((o) => (o.contactLog || [])
      .filter((c) => c.date.startsWith(callReportDate))
      .map((c) => ({ ...c, customerName: o.customerName, phone: o.phone, saleEmployeeId: o.saleEmployeeId, source: o.source, orderId: o.id }))),
    ...(leads || []).flatMap((l) => (l.contactLog || [])
      .filter((c) => c.date.startsWith(callReportDate))
      .map((c) => ({ ...c, customerName: l.customerName, phone: l.phone, saleEmployeeId: l.saleEmployeeId, source: l.source, leadId: l.id }))),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const dailyContacts = allDailyContacts.filter((c) => !(c.type === "support" && c.acknowledged));
  const acknowledgedSupportContacts = allDailyContacts.filter((c) => c.type === "support" && c.acknowledged);
  const acknowledgeSupport = (orderId, entryId) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? {
      ...o,
      contactLog: (o.contactLog || []).map((c) => (c.id === entryId ? { ...c, acknowledged: true } : c)),
    } : o)));
  };
  const CALL_GOOD_THRESHOLD = 8; // ngưỡng số khách liên hệ/ngày để coi là hiệu quả — chỉnh nếu công ty có KPI riêng
  const CALL_OK_THRESHOLD = 4;
  const dailyBySale = saleEmployees.map((e) => {
    const own = dailyContacts.filter((c) => c.saleEmployeeId === e.id);
    const uniqueCustomers = new Set(own.map((c) => c.phone)).size;
    const calls = own.filter((c) => c.type === "call").length;
    const status = uniqueCustomers >= CALL_GOOD_THRESHOLD ? "tot" : uniqueCustomers >= CALL_OK_THRESHOLD ? "trung_binh" : "canh_bao";
    return { emp: e, totalContacts: own.length, uniqueCustomers, calls, status };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-lg border border-paper-line p-3 text-xs text-muted flex items-start gap-2">
        <Link2 size={13} className="text-ink-light shrink-0 mt-0.5" />
        <span>Ghi nhận đơn Sale chốt được VÀ Kỹ thuật upsale thành công ở đây — loại giao dịch tự nhận theo vị trí người phụ trách. Xuất hoá đơn (bắt buộc đính kèm chứng từ) sẽ tự đẩy sang <strong className="text-charcoal">Thu Chi</strong>, và doanh số/upsale tự cộng ngược lại đúng người ở <strong className="text-charcoal">Bảng lương</strong> — không cần nhập tay 2 nơi.</span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard icon={ShoppingCart} label="Tổng số đơn/upsale" value={orders.length} />
        <KpiCard icon={Wallet} label="Tổng doanh thu ghi nhận" value={fmtVND(totalRevenue)} tone="up" />
        <KpiCard icon={AlertTriangle} label="Chưa xuất hoá đơn" value={pendingCount} tone={pendingCount > 0 ? "down" : "up"} />
        <KpiCard icon={UserCheck} label="Sale + Kỹ thuật đang ghi nhận" value={dealEmployees.length} />
      </div>

      <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
        <div className="px-4 pt-3 pb-1 text-xs font-semibold text-ink uppercase flex items-center gap-1.5"><TrendingUp size={13} /> Chi tiết doanh số từng Sale — để tính KPI &amp; xem chất lượng</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-paper text-left text-xs uppercase text-muted">
              <th className="px-4 py-2">Nhân sự Sale</th>
              <th className="px-4 py-2 text-right">Số đơn</th>
              <th className="px-4 py-2 text-right">Tổng doanh số</th>
              <th className="px-4 py-2 text-right">TB / đơn</th>
              <th className="px-4 py-2 text-right">Chưa xuất HĐ</th>
              <th className="px-4 py-2 text-right">Lượt chăm sóc KH</th>
              <th className="px-4 py-2">Đánh giá hiệu suất</th>
            </tr>
          </thead>
          <tbody>
            {saleStats.map((s) => (
              <tr key={s.emp.id} className="border-t border-paper-line">
                <td className="px-4 py-2 font-medium">{s.emp.name}</td>
                <td className="px-4 py-2 text-right ktns-mono">{s.count}</td>
                <td className="px-4 py-2 text-right ktns-mono font-semibold text-ledger-green">{fmtVND(s.total)}</td>
                <td className="px-4 py-2 text-right ktns-mono text-muted">{fmtVND(s.avg)}</td>
                <td className="px-4 py-2 text-right ktns-mono">{s.pending > 0 ? <span className="text-stamp-red">{s.pending}</span> : "0"}</td>
                <td className="px-4 py-2 text-right ktns-mono">{s.contacts}</td>
                <td className="px-4 py-2">
                  {s.perf.status === "tot" && <StampBadge text="TỐT" gold />}
                  {s.perf.status === "trung_binh" && <StampBadge text="CẦN CẢI THIỆN" muted />}
                  {s.perf.status === "canh_bao" && <StampBadge text="CẢNH BÁO" />}
                  {s.perf.status === "chua_co_du_lieu" && <StampBadge text="CHƯA CÓ DỮ LIỆU" muted />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs font-semibold text-ink uppercase flex items-center gap-1.5"><Phone size={13} /> Báo cáo gọi/liên hệ khách hàng theo ngày</div>
          <div className="flex items-center gap-2">
            <input type="date" value={callReportDate} onChange={(e) => setCallReportDate(e.target.value)} className="border border-paper-line rounded px-2.5 py-1.5 text-xs ktns-mono" />
            <button onClick={() => { setLeadForm((f) => ({ ...f, date: callReportDate, saleEmployeeId: f.saleEmployeeId || saleEmployees[0]?.id || "" })); setShowLeadForm(true); }} className="text-xs bg-ink text-white px-2.5 py-1.5 rounded-md hover:bg-ink-light flex items-center gap-1"><Plus size={12} /> Thêm khách cần gọi</button>
            <button onClick={() => exportDailyCallReportExcel(dailyContacts, dailyBySale, callReportDate, nameOf)} className="text-xs bg-ledger-green text-white px-2.5 py-1.5 rounded-md hover:opacity-90 flex items-center gap-1"><FileSpreadsheet size={12} /> Xuất Excel</button>
          </div>
        </div>

        {showLeadForm && (
          <div className="mx-4 mb-3 bg-paper border border-paper-line rounded-md p-3">
            <div className="text-[11px] font-semibold text-ink uppercase mb-2">Khách tiềm năng mới — Marketing/Pancake đẩy qua cho Sale gọi</div>
            <div className="grid grid-cols-4 gap-2">
              <input type="date" value={leadForm.date} onChange={(e) => setLeadForm({ ...leadForm, date: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-xs" />
              <input value={leadForm.customerName} onChange={(e) => setLeadForm({ ...leadForm, customerName: e.target.value })} placeholder="Tên khách (nếu có)" className="border border-paper-line rounded px-2 py-1.5 text-xs" />
              <input value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} placeholder="SĐT *" className="border border-paper-line rounded px-2 py-1.5 text-xs ktns-mono" />
              <select value={leadForm.source} onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-xs">
                {Object.entries(LEAD_SOURCES).map(([id, label]) => (<option key={id} value={id}>{label}</option>))}
              </select>
              <select value={leadForm.saleEmployeeId} onChange={(e) => setLeadForm({ ...leadForm, saleEmployeeId: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-xs">
                <option value="">— Nhân sự Sale phụ trách *</option>
                {saleEmployees.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
              </select>
              <select value={leadForm.contactType} onChange={(e) => setLeadForm({ ...leadForm, contactType: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-xs">
                {Object.entries(CONTACT_TYPES).map(([id, m]) => (<option key={id} value={id}>{m.label}</option>))}
              </select>
              <input value={leadForm.note} onChange={(e) => setLeadForm({ ...leadForm, note: e.target.value })} placeholder="Ghi chú Sale gọi (nếu đã gọi luôn)" className="border border-paper-line rounded px-2 py-1.5 text-xs col-span-2" />
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={addLead} className="text-xs bg-ledger-green text-white px-3 py-1.5 rounded-md hover:opacity-90">Lưu khách tiềm năng</button>
              <button onClick={() => setShowLeadForm(false)} className="text-xs border border-paper-line px-3 py-1.5 rounded-md text-muted">Huỷ</button>
            </div>
          </div>
        )}
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-paper text-left text-xs uppercase text-muted">
              <th className="px-4 py-2">Giờ</th>
              <th className="px-4 py-2">Nhân sự Sale</th>
              <th className="px-4 py-2">Khách hàng</th>
              <th className="px-4 py-2">SĐT</th>
              <th className="px-4 py-2">Nguồn</th>
              <th className="px-4 py-2">Hình thức</th>
              <th className="px-4 py-2">Ghi chú</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {dailyContacts.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-4 text-center text-xs text-muted">Chưa có lượt liên hệ nào được ghi nhận ngày này.</td></tr>
            )}
            {dailyContacts.map((c, i) => (
              <tr key={i} className="border-t border-paper-line">
                <td className="px-4 py-2 ktns-mono text-xs text-muted">{c.date.split(" ")[1] || c.date}</td>
                <td className="px-4 py-2 text-xs font-medium">{nameOf(c.saleEmployeeId)}</td>
                <td className="px-4 py-2 text-xs">{c.customerName}</td>
                <td className="px-4 py-2 ktns-mono text-xs">{c.phone}</td>
                <td className="px-4 py-2 text-xs text-ink-light">{LEAD_SOURCES[c.source] || "—"}</td>
                <td className="px-4 py-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${["call", "message"].includes(c.type) ? "bg-ink-light" : "bg-gold"}`} style={{ color: "white" }}>{CONTACT_TYPES[c.type]?.label}</span>
                </td>
                <td className="px-4 py-2 text-xs text-muted max-w-xs">{c.note}</td>
                <td className="px-4 py-2 text-right">
                  {c.type === "support" && !c.acknowledged && (
                    <button onClick={() => acknowledgeSupport(c.orderId, c.id)} className="text-[10px] bg-ledger-green text-white px-2 py-1 rounded flex items-center gap-1 hover:opacity-90"><CheckCircle2 size={10} /> Xác nhận</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {acknowledgedSupportContacts.length > 0 && (
          <details className="mx-4 my-2">
            <summary className="text-[11px] text-muted cursor-pointer hover:text-ink">Lịch sử hỗ trợ đã xác nhận hôm nay ({acknowledgedSupportContacts.length}) — bấm để xem lại</summary>
            <div className="mt-2 flex flex-col gap-1 max-h-[300px] overflow-y-auto">
              {acknowledgedSupportContacts.map((c, i) => (
                <div key={i} className="text-[11px] text-muted flex items-center gap-2 border-t border-paper-line pt-1">
                  <span className="ktns-mono w-16 shrink-0">{c.date.split(" ")[1] || c.date}</span>
                  <span className="font-medium text-charcoal w-32 shrink-0">{c.customerName}</span>
                  <span>{c.note}</span>
                </div>
              ))}
            </div>
          </details>
        )}

        <div className="px-4 pt-3 pb-1 text-xs font-semibold text-ink uppercase border-t border-paper-line mt-2">Báo cáo tổng hợp — ai gọi bao nhiêu khách, hiệu quả hay không</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-paper text-left text-xs uppercase text-muted">
              <th className="px-4 py-2">Nhân sự Sale</th>
              <th className="px-4 py-2 text-right">Số khách đã liên hệ</th>
              <th className="px-4 py-2 text-right">Số cuộc gọi</th>
              <th className="px-4 py-2 text-right">Tổng lượt liên hệ</th>
              <th className="px-4 py-2">Đánh giá hiệu suất</th>
            </tr>
          </thead>
          <tbody>
            {dailyBySale.map((s) => (
              <tr key={s.emp.id} className="border-t border-paper-line">
                <td className="px-4 py-2 font-medium">{s.emp.name}</td>
                <td className="px-4 py-2 text-right ktns-mono font-semibold">{s.uniqueCustomers}</td>
                <td className="px-4 py-2 text-right ktns-mono">{s.calls}</td>
                <td className="px-4 py-2 text-right ktns-mono">{s.totalContacts}</td>
                <td className="px-4 py-2">
                  {s.status === "tot" && <StampBadge text="HIỆU QUẢ" gold />}
                  {s.status === "trung_binh" && <StampBadge text="TRUNG BÌNH" muted />}
                  {s.status === "canh_bao" && <StampBadge text="CHƯA HIỆU QUẢ" />}
                  {s.status === "chua_co_du_lieu" && <StampBadge text="CHƯA CÓ DỮ LIỆU" muted />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-2.5 text-[11px] text-muted border-t border-paper-line">* Hiệu quả khi liên hệ ≥{CALL_GOOD_THRESHOLD} khách/ngày, trung bình {CALL_OK_THRESHOLD}-{CALL_GOOD_THRESHOLD - 1} khách, dưới {CALL_OK_THRESHOLD} là chưa hiệu quả — chỉnh ngưỡng này trong code nếu công ty có KPI riêng. Ghi nhận cuộc gọi ở phần "Nhật ký liên hệ đa kênh" khi mở rộng từng đơn hàng bên dưới.</p>
      </div>

      <div className="bg-white rounded-lg border border-gold/40 overflow-hidden">
        <div className="px-4 py-2.5 bg-gold/5 flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-semibold text-gold uppercase flex items-center gap-1.5"><Phone size={13} /> Khách hàng tiềm năng đang chăm sóc — chưa mua, chưa phải đơn hàng thật</span>
          <span className="text-[11px] text-muted">{(leads || []).filter((l) => l.status === "dang_cham_soc").length} người đang chăm sóc</span>
        </div>
        <div className="px-4 py-2.5 border-b border-paper-line flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={leadSearch}
              onChange={(e) => setLeadSearch(e.target.value)}
              placeholder="Tìm theo tên, SĐT, hoặc nội dung ghi chú (VD: 'hẹn mai')..."
              className="w-full border border-paper-line rounded-md pl-8 pr-2 py-1.5 text-xs"
            />
          </div>
          {[
            { id: "all", label: "Tất cả" },
            { id: "overdue", label: "Đến hẹn/quá hẹn" },
            { id: "no_date", label: "Chưa hẹn" },
            { id: "rejected", label: "Không mua" },
          ].map((f) => (
            <button key={f.id} onClick={() => setLeadFilter(f.id)} className={`text-[11px] px-2.5 py-1.5 rounded-md border ${leadFilter === f.id ? "bg-ink text-white border-ink" : "border-paper-line text-muted"}`}>{f.label}</button>
          ))}
        </div>
        {selectedLeadIds.length > 0 && (
          <div className="px-4 py-2.5 bg-gold/10 border-b border-gold/40 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-charcoal">Đã chọn <strong>{selectedLeadIds.length}</strong> khách — chuyển hết cho:</span>
            <select value={bulkReassignTarget} onChange={(e) => setBulkReassignTarget(e.target.value)} className="border border-paper-line rounded px-2 py-1.5 text-xs bg-white">
              <option value="">— Chọn Sale —</option>
              {saleEmployees.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
            </select>
            <button onClick={bulkReassign} disabled={!bulkReassignTarget} className="text-xs bg-ink text-white px-3 py-1.5 rounded-md disabled:opacity-40">Chuyển ngay</button>
            <button onClick={() => setSelectedLeadIds([])} className="text-xs text-muted underline">Bỏ chọn hết</button>
          </div>
        )}
        <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10"><tr className="bg-paper text-left text-xs uppercase text-muted"><th className="px-2 py-2"></th><th className="px-4 py-2">STT</th><th className="px-4 py-2">Ngày lấy</th><th className="px-4 py-2">Khách hàng</th><th className="px-4 py-2">SĐT</th><th className="px-4 py-2">Nguồn</th><th className="px-4 py-2">Sale phụ trách</th><th className="px-4 py-2">Hẹn gọi lại</th><th className="px-4 py-2">Trạng thái</th><th className="px-4 py-2"></th><th className="px-2 py-2"></th></tr></thead>
          <tbody>
            {(() => {
              const filtered = filteredLeads;
              if (filtered.length === 0) {
                return <tr><td colSpan={11} className="px-4 py-6 text-center text-xs text-muted">{(leads || []).length === 0 ? 'Chưa có khách tiềm năng nào — bấm "Thêm khách cần gọi" ở trên để ghi nhận lead mới từ Marketing.' : "Không tìm thấy khách nào khớp bộ lọc/từ khoá."}</td></tr>;
              }
              return filtered.slice(0, leadShowCount).map((l, idx) => {
              const isOverdue = l.nextFollowUpDate && l.nextFollowUpDate <= TODAY_STR && l.status === "dang_cham_soc";
              const isExpanded = expandedLead[l.id];
              const draft = leadContactDraft[l.id] || { type: "call", note: "", nextFollowUpDate: "" };
              return (
                <React.Fragment key={l.id}>
                <tr className={`border-t border-paper-line cursor-pointer hover:bg-paper/40 ${isOverdue ? "ktns-warn-row" : ""}`} onClick={() => setExpandedLead((p) => ({ ...p, [l.id]: !p[l.id] }))}>
                  <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedLeadIds.includes(l.id)} onChange={() => toggleLeadSelect(l.id)} /></td>
                  <td className="px-4 py-2 ktns-mono text-xs text-muted">{idx + 1}</td>
                  <td className="px-4 py-2 ktns-mono text-xs text-muted">{l.date}</td>
                  <td className="px-4 py-2 font-medium">{l.customerName}</td>
                  <td className="px-4 py-2 ktns-mono text-xs">{l.phone}</td>
                  <td className="px-4 py-2 text-xs">{LEAD_SOURCES[l.source]}</td>
                  <td className="px-4 py-2 text-xs" onClick={(e) => e.stopPropagation()}>
                    <select value={l.saleEmployeeId || ""} onChange={(e) => reassignLead(l.id, e.target.value)} className="border border-paper-line rounded px-1.5 py-1 text-[11px] bg-white">
                      {saleEmployees.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {l.nextFollowUpDate ? (
                      <span className={isOverdue ? "text-stamp-red font-semibold" : "text-charcoal"}>{l.nextFollowUpDate}{isOverdue ? " — ĐẾN HẸN" : ""}</span>
                    ) : <span className="text-muted">Chưa hẹn</span>}
                  </td>
                  <td className="px-4 py-2">
                    {l.status === "dang_cham_soc" && <StampBadge text="ĐANG CHĂM SÓC" gold />}
                    {l.status === "tu_choi" && <StampBadge text="TỪ CHỐI/KHÔNG MUA" muted />}
                  </td>
                  <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {l.status === "dang_cham_soc" && (
                        <>
                          <button onClick={() => convertLeadToOrder(l)} className="text-[11px] text-ledger-green underline">Đã mua → Tạo đơn hàng</button>
                          <button onClick={() => markLeadRejected(l.id)} className="text-[11px] text-muted underline">Không mua</button>
                        </>
                      )}
                      <button onClick={() => removeLead(l.id)} className="text-muted hover:text-stamp-red"><Trash2 size={13} /></button>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center"><ChevronRight size={14} className={`text-muted transition-transform inline-block ${isExpanded ? "rotate-90" : ""}`} /></td>
                </tr>
                {isExpanded && (
                  <tr className="border-t border-paper-line bg-paper/40">
                    <td colSpan={11} className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="text-[11px] font-semibold text-ink uppercase mb-1.5">Lịch sử chăm sóc — {l.customerName} ({l.phone})</div>
                      {(l.contactLog || []).length === 0 && <div className="text-xs text-muted mb-2">Chưa có lượt chăm sóc nào được ghi nhận.</div>}
                      <div className="flex flex-col gap-1 mb-2">
                        {(l.contactLog || []).slice().reverse().map((c, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="ktns-mono text-muted w-36 shrink-0">{c.date}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-ink-light text-white">{CONTACT_TYPES[c.type]?.label || c.type}</span>
                            <span className="text-charcoal">{c.note}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 items-center flex-wrap">
                        <select value={draft.type} onChange={(e) => setLeadContactDraft((p) => ({ ...p, [l.id]: { ...draft, type: e.target.value } }))} className="border border-paper-line rounded px-2 py-1.5 text-xs">
                          {Object.entries(CONTACT_TYPES).map(([id, m]) => (<option key={id} value={id}>{m.label}</option>))}
                        </select>
                        <input value={draft.note} onChange={(e) => setLeadContactDraft((p) => ({ ...p, [l.id]: { ...draft, note: e.target.value } }))} placeholder="Ghi chú nội dung trao đổi... (VD: hẹn mai gọi lại xác nhận)" className="flex-1 min-w-[220px] border border-paper-line rounded px-2 py-1.5 text-xs" />
                        <label className="flex items-center gap-1.5 text-[11px] text-muted">Hẹn gọi lại:
                          <input type="date" value={draft.nextFollowUpDate} onChange={(e) => setLeadContactDraft((p) => ({ ...p, [l.id]: { ...draft, nextFollowUpDate: e.target.value } }))} className="border border-paper-line rounded px-2 py-1.5 text-xs" />
                        </label>
                        <button onClick={() => addLeadContact(l.id)} className="text-xs bg-ink text-white px-3 py-1.5 rounded-md hover:bg-ink-light flex items-center gap-1"><Plus size={12} /> Ghi nhận</button>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
              });
            })()}
          </tbody>
        </table>
        </div>
        {filteredLeads.length > leadShowCount && (
          <div className="px-4 py-2.5 border-t border-paper-line text-center">
            <button onClick={() => setLeadShowCount((c) => c + 10)} className="text-xs text-ink-light underline hover:text-ink">
              Xem thêm 10 người (còn {filteredLeads.length - leadShowCount} người) — hoặc <span onClick={(e) => { e.stopPropagation(); setLeadShowCount(filteredLeads.length); }} className="text-gold underline">xem tất cả {filteredLeads.length} người</span>
            </button>
          </div>
        )}
        {leadShowCount > 10 && filteredLeads.length > 10 && (
          <div className="px-4 py-2 border-t border-paper-line text-center">
            <button onClick={() => setLeadShowCount(10)} className="text-[11px] text-muted underline hover:text-ink">Thu gọn lại còn 10 người</button>
          </div>
        )}
        <p className="px-4 py-2.5 text-[11px] text-muted border-t border-paper-line">* Khách ở đây CHƯA tính vào doanh thu/hoá đơn — khi Sale chốt được đơn thật, bấm "Đã mua → Tạo đơn hàng" để chuyển hẳn xuống bảng đơn hàng CRM bên dưới. Mặc định chỉ hiện 10 người gần hẹn nhất, bấm "Xem thêm" để hiện dần, không tự hiện hết một lúc.</p>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted">{orders.length} đơn hàng đã ghi nhận trong CRM.</p>
        <div className="flex gap-2">
          <button onClick={() => exportOrdersExcel(orders, employees)} className="flex items-center gap-1.5 text-sm bg-ledger-green text-white px-3.5 py-2 rounded-md hover:opacity-90">
            <FileSpreadsheet size={15} /> Xuất Excel chi tiết hoá đơn
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-sm bg-ink text-white px-3.5 py-2 rounded-md hover:bg-ink-light">
            <Plus size={15} /> Thêm đơn hàng
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-paper-line p-5 relative">
          <button
            className="absolute top-3 right-3 text-muted hover:text-ink"
            onClick={() => {
              const hasInput = form.customerName || form.phone || form.amount;
              if (hasInput && !window.confirm("Bạn đã nhập thông tin đơn hàng nhưng chưa bấm Lưu — đóng lại sẽ MẤT hết thông tin vừa nhập. Vẫn muốn đóng?")) return;
              setShowForm(false);
            }}
          ><X size={16} /></button>
          <h3 className="ktns-serif font-semibold text-ink mb-4">Đơn hàng / Upsale mới</h3>
          <div className="grid grid-cols-4 gap-3">
            <label className="text-xs text-muted flex flex-col gap-1">Ngày tháng<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Khách hàng<input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Tên khách hàng" className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">SĐT<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
            <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Mã số thuế công ty <span className="text-ink-light">(nếu khách là công ty cần xuất hóa đơn GTGT)</span><input value={form.customerTaxCode} onChange={(e) => setForm({ ...form, customerTaxCode: e.target.value })} placeholder="VD: 0109441228" className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
            <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Nội dung chuyển khoản<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Người chốt đơn/upsale
              <select value={form.saleEmployeeId} onChange={(e) => setForm({ ...form, saleEmployeeId: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm">
                {dealEmployees.map((e) => (<option key={e.id} value={e.id}>{e.name} ({ROLE_META[e.roleType]?.label})</option>))}
              </select>
              {(() => { const emp = employees.find((e) => e.id === Number(form.saleEmployeeId)); return emp?.roleType === "ky_thuat" ? <span className="text-[10px] text-gold mt-0.5">→ Ghi nhận là Upsale kỹ thuật</span> : <span className="text-[10px] text-ink-light mt-0.5">→ Ghi nhận là Bán hàng Sale</span>; })()}
            </label>
            <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Sản phẩm (tuỳ chọn — lấy từ Kho hàng)
              <select value={form.productId} onChange={(e) => selectProduct(e.target.value)} className="border border-paper-line rounded px-2 py-1.5 text-sm">
                <option value="">— Không gắn sản phẩm cụ thể (dịch vụ/khác) —</option>
                {(inventory || []).map((p) => (<option key={p.id} value={p.id}>{p.name}{p.durationMonths > 0 ? ` (${p.durationMonths} tháng)` : ""} — tồn {p.stock} {p.unit} — {fmtVND(p.sellPrice)} (đã gồm VAT {p.vatRate || 0}%)</option>))}
              </select>
            </label>
            <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Nguồn từ Page nào (tuỳ chọn — để biết Marketing chạy page nào ra đơn này)
              <select value={form.pageId} onChange={(e) => setForm({ ...form, pageId: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm">
                <option value="">— Không rõ nguồn / khách quen —</option>
                {(pages || []).map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </label>
            {form.productId && (
              <label className="text-xs text-muted flex flex-col gap-1">Số lượng<input type="number" min="1" value={form.quantity} onChange={(e) => updateQty(e.target.value)} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
            )}
            <label className="text-xs text-muted flex flex-col gap-1">Số tiền (đ)<MoneyInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Ngày nhận tiền<input value={form.receivedAt} onChange={(e) => setForm({ ...form, receivedAt: e.target.value })} placeholder="2026-07-08 10:00" className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
            {(() => {
              const p = form.productId ? (inventory || []).find((i) => i.id === Number(form.productId)) : null;
              return p && p.durationMonths > 0 ? (
                <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Mã key đã cấp cho khách<input value={form.issuedKeyCode} onChange={(e) => setForm({ ...form, issuedKeyCode: e.target.value })} placeholder="VD: ABCD-1234-EFGH" className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
              ) : null;
            })()}
          </div>
          {form.productId && (() => {
            const p = (inventory || []).find((i) => i.id === Number(form.productId));
            const qty = Number(form.quantity) || 1;
            return p && qty > p.stock ? <p className="mt-2 text-xs text-stamp-red flex items-center gap-1.5"><AlertTriangle size={12} /> Chỉ còn {p.stock} {p.unit} trong kho, đang bán {qty} — kiểm tra lại tồn kho.</p> : null;
          })()}
          <button onClick={addOrder} className="mt-4 bg-ledger-green text-white text-sm px-4 py-2 rounded-md hover:opacity-90">Lưu đơn hàng</button>
        </div>
      )}

      <div className="bg-white rounded-lg border border-paper-line p-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={orderSearch}
            onChange={(e) => setOrderSearch(e.target.value)}
            placeholder="Tìm theo tên, SĐT, hoặc email — tìm xuyên suốt mọi tháng..."
            className="w-full border border-paper-line rounded-md pl-8 pr-2 py-1.5 text-xs"
          />
        </div>
        {!orderSearchQ && (
          <RangeModePicker rangeMode={rangeMode} setRangeMode={setRangeMode} rangeFrom={rangeFrom} setRangeFrom={setRangeFrom} rangeTo={rangeTo} setRangeTo={setRangeTo} reportMonth={reportMonth} reportYear={reportYear} show={showRangePicker} setShow={setShowRangePicker} />
        )}
        <span className="text-[11px] text-muted">{visibleOrders.length}/{orders.length} đơn hàng{orderSearchQ ? " khớp tìm kiếm (mọi tháng)" : ""}</span>
      </div>

      <div className="bg-white rounded-lg border border-paper-line overflow-x-auto">
        <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-paper text-left text-xs uppercase text-muted">
              <th className="px-3 py-2.5">STT</th>
              <th className="px-3 py-2.5">Ngày</th>
              <th className="px-3 py-2.5">Khách hàng</th>
              <th className="px-3 py-2.5">Sản phẩm</th>
              <th className="px-3 py-2.5">Liên hệ</th>
              <th className="px-3 py-2.5">Người phụ trách</th>
              <th className="px-3 py-2.5">Loại</th>
              <th className="px-3 py-2.5 text-right">Số tiền</th>
              <th className="px-3 py-2.5">Tình trạng hoá đơn</th>
              <th className="px-3 py-2.5">Chăm sóc KH</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {visibleOrders.map((o, idx) => ({ ...o, _stt: idx + 1 })).slice().reverse().map((o) => {
              const pending = o.invoiceStatus !== "issued";
              const log = o.contactLog || [];
              const lastContact = log[log.length - 1];
              return (
                <React.Fragment key={o.id}>
                  <tr className={`border-t border-paper-line cursor-pointer hover:bg-paper/50 ${pending ? "ktns-warn-row" : ""}`} onClick={() => toggleExpand(o.id)}>
                    <td className="px-3 py-2 ktns-mono text-xs text-muted">{o._stt}</td>
                    <td className="px-3 py-2 ktns-mono text-xs text-muted">{o.date}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{o.customerName}</div>
                      <div className="text-[11px] text-muted">{o.note}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {o.productName ? <>{o.productName} <span className="text-muted">x{o.quantity || 1}</span></> : <span className="text-muted">—</span>}
                      {(distOrders || []).some((d) => d.sourceCrmOrderId === o.id) && (
                        <div className="text-[9px] text-gold flex items-center gap-0.5 mt-0.5"><Link2 size={9} /> Đã nối Hợp tác phân phối</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">
                      <div className="ktns-mono">{o.phone}</div>
                      <div>{o.email}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">{nameOf(o.saleEmployeeId)}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${o.dealType === "upsale" ? "bg-gold" : "bg-ink-light"}`} style={{ color: "white" }}>{o.dealType === "upsale" ? "Upsale KT" : "Sale"}</span>
                    </td>
                    <td className="px-3 py-2 text-right ktns-mono font-medium text-ledger-green">{fmtVND(o.amount)}</td>
                    <td className="px-3 py-2 min-w-[150px]" onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => startInvoiceEdit(o, e)}>
                        {o.invoiceStatus === "issued" ? <StampBadge text="ĐÃ XUẤT" gold /> : <StampBadge text="CHƯA XUẤT HĐ" />}
                      </button>
                      {o.invoiceStatus === "issued" ? (
                        <div className="text-[10px] text-muted ktns-mono mt-1 flex items-center gap-1.5">
                          {o.invoiceNo}
                          {o.invoiceAttachmentData && <button onClick={(e) => { e.stopPropagation(); setViewingAttachment(o); }} className="text-ink-light underline flex items-center gap-0.5"><Paperclip size={9} /> xem</button>}
                        </div>
                      ) : (
                        <div className="text-[10px] text-ink-light mt-1">Bấm để xuất hoá đơn</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs" onClick={(e) => e.stopPropagation()}>
                      {lastContact ? (
                        <span className="text-muted">{CONTACT_TYPES[lastContact.type]?.label} · <span className="ktns-mono">{lastContact.date}</span></span>
                      ) : (
                        <span className="text-stamp-red">Chưa liên hệ</span>
                      )}
                      {o.productId && (
                        <div className="relative mt-1">
                          {sentToSupport[o.id] ? (
                            <span className="text-[10px] text-ink-light flex items-center gap-1"><CheckCircle2 size={10} /> Đã gửi hỗ trợ</span>
                          ) : (
                            <button onClick={() => setSupportTypeMenu((p) => (p === o.id ? null : o.id))} className="text-[10px] text-gold underline flex items-center gap-1"><Headphones size={10} /> Gửi hỗ trợ</button>
                          )}
                          {supportTypeMenu === o.id && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-paper-line rounded-md shadow-lg p-1 z-20 w-44">
                              {Object.entries(SUPPORT_TYPES).map(([id, label]) => (
                                <button key={id} onClick={() => { sendToSupport(o, id); setSupportTypeMenu(null); }} className="w-full text-left text-[11px] px-2 py-1.5 rounded hover:bg-paper">{label}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}><button onClick={() => removeOrder(o.id)} className="text-muted hover:text-stamp-red"><Trash2 size={14} /></button></td>
                  </tr>
                  {expanded[o.id] && (
                    <tr className="border-t border-paper-line bg-paper/40">
                      <td colSpan={11} className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="text-[11px] font-semibold text-ink uppercase flex items-center gap-1.5"><Phone size={12} /> Nhật ký liên hệ đa kênh — {o.customerName} ({o.phone})</div>
                          <div className="flex items-center gap-2 relative">
                            <button onClick={() => prefillOrderFromCustomer(o)} className="text-[10px] bg-ledger-green text-white px-2.5 py-1 rounded flex items-center gap-1 hover:opacity-90"><Plus size={10} /> Tạo đơn mới cho khách này</button>
                            {o.productId && (
                              sentToSupport[o.id] ? (
                                <span className="text-[10px] text-ink-light flex items-center gap-1"><CheckCircle2 size={10} /> Đã gửi hỗ trợ</span>
                              ) : (
                                <button onClick={() => setSupportTypeMenu((p) => (p === o.id ? null : o.id))} className="text-[10px] bg-gold text-white px-2.5 py-1 rounded flex items-center gap-1 hover:opacity-90"><Headphones size={10} /> Gửi hỗ trợ khách hàng</button>
                              )
                            )}
                            {supportTypeMenu === o.id && (
                              <div className="absolute top-full right-0 mt-1 bg-white border border-paper-line rounded-md shadow-lg p-1 z-20 w-44">
                                {Object.entries(SUPPORT_TYPES).map(([id, label]) => (
                                  <button key={id} onClick={() => { sendToSupport(o, id); setSupportTypeMenu(null); }} className="w-full text-left text-[11px] px-2 py-1.5 rounded hover:bg-paper">{label}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {log.length === 0 && <div className="text-xs text-muted mb-2">Chưa có lượt liên hệ nào được ghi nhận.</div>}
                        <div className="flex flex-col gap-1 mb-2">
                          {log.slice().reverse().map((c, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className="ktns-mono text-muted w-36 shrink-0">{c.date}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${["call", "message"].includes(c.type) ? "bg-ink-light" : "bg-gold"}`} style={{ color: "white" }}>{CONTACT_TYPES[c.type]?.label}</span>
                              <span className="text-charcoal">{c.note}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 items-center">
                          <select value={contactDraft[o.id]?.type || "call"} onChange={(e) => setContactDraft((p) => ({ ...p, [o.id]: { ...p[o.id], type: e.target.value } }))} className="border border-paper-line rounded px-2 py-1.5 text-xs">
                            {Object.entries(CONTACT_TYPES).map(([id, m]) => (<option key={id} value={id}>{m.label}</option>))}
                          </select>
                          <input value={contactDraft[o.id]?.note || ""} onChange={(e) => setContactDraft((p) => ({ ...p, [o.id]: { ...p[o.id], note: e.target.value } }))} placeholder="Ghi chú nội dung liên hệ..." className="flex-1 border border-paper-line rounded px-2 py-1.5 text-xs" />
                          <button onClick={() => addContact(o.id)} className="text-xs bg-ink text-white px-3 py-1.5 rounded-md hover:bg-ink-light flex items-center gap-1"><Plus size={12} /> Ghi nhận</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {activeInvoiceId && (() => {
        const o = orders.find((x) => x.id === activeInvoiceId);
        const draft = invoiceEdit[activeInvoiceId];
        if (!o || !draft) return null;
        return (
          <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-6" onClick={() => cancelInvoiceEdit(activeInvoiceId)}>
            <div className="bg-white rounded-lg p-5 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="ktns-serif font-semibold text-ink mb-1 flex items-center gap-1.5"><FileText size={15} /> Xuất hoá đơn cho khách hàng</h3>
              <div className="bg-paper rounded-md p-3 mb-3 text-xs flex flex-col gap-1">
                <div className="font-semibold text-ink">{o.customerName}</div>
                <div className="text-muted ktns-mono">{o.phone}{o.email ? ` · ${o.email}` : ""}</div>
                <div className="text-muted">Nhân sự Sale: {nameOf(o.saleEmployeeId)} · Số tiền: <span className="ktns-mono text-ledger-green font-medium">{fmtVND(o.amount)}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Loại hoá đơn
                  <select value={draft.invoiceType} onChange={(e) => setInvoiceEdit((p) => ({ ...p, [activeInvoiceId]: { ...p[activeInvoiceId], invoiceType: e.target.value } }))} className="border border-paper-line rounded px-2 py-1.5 text-sm">
                    {INVOICE_TYPES.filter((it) => it !== "Chưa xác định").map((it) => (<option key={it}>{it}</option>))}
                  </select>
                </label>
                <label className="text-xs text-muted flex flex-col gap-1">Số hoá đơn<input value={draft.invoiceNo} onChange={(e) => setInvoiceEdit((p) => ({ ...p, [activeInvoiceId]: { ...p[activeInvoiceId], invoiceNo: e.target.value } }))} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
                <label className="text-xs text-muted flex flex-col gap-1">Ngày giờ xuất<input value={draft.invoiceDate} onChange={(e) => setInvoiceEdit((p) => ({ ...p, [activeInvoiceId]: { ...p[activeInvoiceId], invoiceDate: e.target.value } }))} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
                {VAT_INVOICE_TYPES.includes(draft.invoiceType) && (
                  <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Thuế suất VAT
                    <select value={draft.vatRate} onChange={(e) => setInvoiceEdit((p) => ({ ...p, [activeInvoiceId]: { ...p[activeInvoiceId], vatRate: Number(e.target.value) } }))} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono">
                      {VAT_RATE_OPTIONS.map((r) => (<option key={r} value={r}>{r}%</option>))}
                    </select>
                  </label>
                )}
                <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Đính kèm ảnh/file hoá đơn <span className="text-stamp-red">* bắt buộc</span>
                  <input type="file" accept="image/*,.pdf" onChange={(e) => handleInvoiceFile(activeInvoiceId, e)} className="border border-paper-line rounded px-2 py-1.5 text-sm bg-white" />
                  {draft.attachmentName && <span className="text-[11px] text-ledger-green flex items-center gap-1 mt-1"><CheckCircle2 size={11} /> {draft.attachmentName}</span>}
                </label>
              </div>
              {VAT_INVOICE_TYPES.includes(draft.invoiceType) && (
                <div className="mt-2 text-xs text-ink-light bg-paper rounded px-2.5 py-2 flex gap-4">
                  <span>Tiền hàng: <strong className="ktns-mono">{fmtVND(splitVAT(o.amount, draft.vatRate).beforeTax)}</strong></span>
                  <span>Thuế VAT ({draft.vatRate}%): <strong className="ktns-mono text-stamp-red">{fmtVND(splitVAT(o.amount, draft.vatRate).vatAmount)}</strong></span>
                </div>
              )}
              {invoiceError[activeInvoiceId] && <p className="text-xs text-stamp-red mt-2 flex items-center gap-1"><AlertTriangle size={12} /> {invoiceError[activeInvoiceId]}</p>}
              <div className="flex gap-2 mt-4 flex-wrap">
                <button onClick={() => saveInvoiceEdit(activeInvoiceId)} className="bg-ledger-green text-white text-sm px-3 py-1.5 rounded-md hover:opacity-90">Lưu &amp; ghi Thu Chi</button>
                <button onClick={() => cancelInvoiceEdit(activeInvoiceId)} className="border border-paper-line text-sm px-3 py-1.5 rounded-md text-muted">Huỷ</button>
                {o.invoiceStatus === "issued" && <button onClick={() => revertToPending(activeInvoiceId)} className="text-sm text-stamp-red px-2 py-1.5">Bỏ đã xuất</button>}
              </div>
              {o.email && o.invoiceStatus === "issued" && (
                <a
                  href={`mailto:${o.email}?subject=${encodeURIComponent(`Hoá đơn ${draft.invoiceNo} — ${o.customerName}`)}&body=${encodeURIComponent(`Kính gửi ${o.customerName},\n\nCảm ơn quý khách đã sử dụng dịch vụ. Đính kèm là hoá đơn:\n- Số hoá đơn: ${draft.invoiceNo}\n- Ngày xuất: ${draft.invoiceDate}\n- Số tiền: ${fmtVND(o.amount)}\n\n(Vui lòng đính kèm file ảnh hoá đơn vào email này trước khi gửi — trình duyệt không cho tự động đính kèm)\n\nTrân trọng.`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-light underline"
                >
                  <FileText size={12} /> Mở email nháp gửi khách ({o.email})
                </a>
              )}
              <p className="text-[10px] text-muted mt-3">Lưu sẽ tự tạo giao dịch Thu tương ứng bên tab Thu Chi (đúng khách hàng, số tiền, hoá đơn, VAT) — không cần nhập lại. Email nháp mở qua ứng dụng mail mặc định của máy — cần tự đính kèm ảnh hoá đơn rồi mới gửi, trình duyệt không cho web tự động gửi/đính kèm thay bạn.</p>
            </div>
          </div>
        );
      })()}

      {viewingAttachment && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-8" onClick={() => setViewingAttachment(null)}>
          <div className="bg-white rounded-lg p-4 max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="ktns-serif font-semibold text-ink text-sm">{viewingAttachment.customerName} — {viewingAttachment.invoiceAttachmentName}</h3>
              <button onClick={() => setViewingAttachment(null)} className="text-muted hover:text-ink"><X size={18} /></button>
            </div>
            {viewingAttachment.invoiceAttachmentType?.startsWith("image/") ? (
              <img src={viewingAttachment.invoiceAttachmentData} alt={viewingAttachment.invoiceAttachmentName} className="max-w-full rounded" />
            ) : (
              <a href={viewingAttachment.invoiceAttachmentData} download={viewingAttachment.invoiceAttachmentName} className="text-sm text-ink-light underline">Tải file {viewingAttachment.invoiceAttachmentName}</a>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-muted">* Bấm vào dòng để mở nhật ký chăm sóc khách hàng. Bấm vào badge "Tình trạng hoá đơn" để xuất hoá đơn — bắt buộc đính kèm chứng từ, tự động ghi nhận sang Thu Chi.</p>
    </div>
  );
}

// ---------- Marketing hàng ngày ----------
function exportMarketingExcel(logs, employees) {
  const wb = XLSX.utils.book_new();
  const nameOf = (id) => employees.find((e) => e.id === id)?.name || "—";

  const rows = logs.slice().sort((a, b) => a.date.localeCompare(b.date)).map((l) => {
    const convRate = l.customersReached > 0 ? (l.conversions / l.customersReached) * 100 : 0;
    const roas = l.adSpend > 0 ? l.revenue / l.adSpend : 0;
    const costPerCustomer = l.customersReached > 0 ? l.adSpend / l.customersReached : 0;
    return {
      "Ngày": l.date, "Nhân viên": nameOf(l.employeeId), "Số page quản lý": l.pagesManaged,
      "Khách tiếp cận": l.customersReached, "Chuyển đổi": l.conversions,
      "Tỷ lệ chuyển đổi (%)": Math.round(convRate * 10) / 10,
      "Chi phí ads": Math.round(l.adSpend), "Doanh thu": Math.round(l.revenue),
      "ROAS": Math.round(roas * 100) / 100, "Chi phí / khách": Math.round(costPerCustomer),
      "Ghi chú tối ưu": l.note,
    };
  });
  const ws1 = XLSX.utils.json_to_sheet(rows);
  ws1["!cols"] = new Array(11).fill({ wch: 16 });
  XLSX.utils.book_append_sheet(wb, ws1, "Nhật ký hàng ngày");

  const byEmp = {};
  logs.forEach((l) => {
    const key = nameOf(l.employeeId);
    byEmp[key] = byEmp[key] || { days: 0, customers: 0, conversions: 0, spend: 0, revenue: 0, maxPages: 0 };
    const s = byEmp[key];
    s.days += 1; s.customers += Number(l.customersReached) || 0; s.conversions += Number(l.conversions) || 0;
    s.spend += Number(l.adSpend) || 0; s.revenue += Number(l.revenue) || 0; s.maxPages = Math.max(s.maxPages, l.pagesManaged || 0);
  });
  const summary = Object.entries(byEmp).map(([name, s]) => ({
    "Nhân viên": name, "Số ngày ghi nhận": s.days, "Số page (nhiều nhất)": s.maxPages,
    "TB khách/ngày": Math.round(s.customers / s.days), "Tổng chuyển đổi": s.conversions,
    "Tỷ lệ chuyển đổi TB (%)": Math.round((s.conversions / s.customers) * 1000) / 10,
    "Tổng chi phí": Math.round(s.spend), "Tổng doanh thu": Math.round(s.revenue),
    "ROAS trung bình": Math.round((s.revenue / s.spend) * 100) / 100,
  }));
  const ws2 = XLSX.utils.json_to_sheet(summary);
  ws2["!cols"] = new Array(9).fill({ wch: 16 });
  XLSX.utils.book_append_sheet(wb, ws2, "Xếp hạng theo người");

  XLSX.writeFile(wb, `DOMIX_Marketing_hang_ngay_${TODAY.toISOString().slice(0, 10)}.xlsx`);
}

function MarketingDaily({ logs, setLogs, employees, marketingByEmployee, reportYear, reportMonth, pages, setPages, orders, inventory }) {
  const pageNameOf = (id) => (pages || []).find((p) => p.id === id)?.name || "";
  const [showPageForm, setShowPageForm] = useState(false);
  const [editingPageId, setEditingPageId] = useState(null);
  const blankPageForm = { name: "", url: "", productIds: [], marketingEmployeeIds: [], saleEmployeeIds: [] };
  const [pageForm, setPageForm] = useState(blankPageForm);
  // Danh sách nhân sự Sale/Marketing luôn LẤY ĐÚNG NGƯỜI ĐANG CÓ HIỆN TẠI (tính lại mỗi lần render
  // từ danh sách nhân sự thật) — thêm/nghỉ nhân sự ở tab Nhân sự thì danh sách này tự cập nhật theo,
  // không phải danh sách cố định lúc tạo Page.
  const mktEmpAll = employees.filter((e) => e.roleType === "ads");
  const saleEmpAll = employees.filter((e) => e.roleType === "sale");
  const closePageForm = () => { setShowPageForm(false); setEditingPageId(null); setPageForm(blankPageForm); };
  const startEditPage = (p) => {
    setEditingPageId(p.id);
    setPageForm({ name: p.name, url: p.url || "", productIds: [...(p.productIds || [])], marketingEmployeeIds: [...(p.marketingEmployeeIds || [])], saleEmployeeIds: [...(p.saleEmployeeIds || [])] });
    setShowPageForm(true);
  };
  const addPage = () => {
    if (!pageForm.name) return;
    if (editingPageId) {
      setPages((prev) => prev.map((p) => (p.id === editingPageId ? { ...p, ...pageForm } : p)));
    } else {
      setPages((prev) => [...prev, { ...pageForm, id: Date.now() }]);
    }
    closePageForm();
  };
  const removePage = (id) => setPages((prev) => prev.filter((p) => p.id !== id));
  const togglePageEmp = (field, id) => setPageForm((f) => ({ ...f, [field]: f[field].includes(id) ? f[field].filter((x) => x !== id) : [...f[field], id] }));
  const togglePageProduct = (id) => setPageForm((f) => ({ ...f, productIds: f.productIds.includes(id) ? f.productIds.filter((x) => x !== id) : [...f.productIds, id] }));

  const mktEmployees = employees.filter((e) => e.roleType === "ads");
  const [showForm, setShowForm] = useState(false);
  const [rangeMode, setRangeMode] = useState("month");
  const [rangeFrom, setRangeFrom] = useState(new Date(reportYear || TODAY.getFullYear(), (reportMonth || TODAY.getMonth() + 1) - 1, 1).toISOString().slice(0, 10));
  const [rangeTo, setRangeTo] = useState(new Date(reportYear || TODAY.getFullYear(), (reportMonth || TODAY.getMonth() + 1), 0).toISOString().slice(0, 10));
  useEffect(() => {
    if (!reportYear || !reportMonth || rangeMode === "custom") return;
    setRangeFrom(new Date(reportYear, reportMonth - 1, 1).toISOString().slice(0, 10));
    setRangeTo(new Date(reportYear, reportMonth, 0).toISOString().slice(0, 10));
  }, [reportYear, reportMonth, rangeMode]);
  const [showRangePicker, setShowRangePicker] = useState(false);
  const visibleLogs = rangeMode === "all" ? logs : logs.filter((l) => l.date >= rangeFrom && l.date <= rangeTo);
  const [form, setForm] = useState({
    date: TODAY_STR, employeeId: mktEmployees[0]?.id || "", pageId: "", pagesManaged: "1", customersReached: "",
    conversions: "", adSpend: "", revenue: "", note: "",
  });
  const nameOf = (id) => employees.find((e) => e.id === id)?.name || "—";

  const addLog = () => {
    if (!form.employeeId || !form.customersReached) return;
    setLogs((prev) => [...prev, {
      ...form, id: Date.now(), employeeId: Number(form.employeeId), pageId: form.pageId ? Number(form.pageId) : null,
      pagesManaged: Number(form.pagesManaged) || 0, customersReached: Number(form.customersReached) || 0,
      conversions: Number(form.conversions) || 0, adSpend: Number(form.adSpend) || 0, revenue: Number(form.revenue) || 0,
    }]);
    setForm({ date: TODAY_STR, employeeId: mktEmployees[0]?.id || "", pageId: "", pagesManaged: "1", customersReached: "", conversions: "", adSpend: "", revenue: "", note: "" });
    setShowForm(false);
  };
  const removeLog = (id) => setLogs((prev) => prev.filter((l) => l.id !== id));

  // Xếp hạng hiệu suất hàng ngày theo từng người — trung bình khách/ngày, tỷ lệ chuyển đổi, ROAS.
  const leaderboard = mktEmployees.map((e) => {
    const own = visibleLogs.filter((l) => l.employeeId === e.id);
    const days = own.length || 1;
    const customers = own.reduce((a, l) => a + (Number(l.customersReached) || 0), 0);
    const conversions = own.reduce((a, l) => a + (Number(l.conversions) || 0), 0);
    const spend = own.reduce((a, l) => a + (Number(l.adSpend) || 0), 0);
    const revenue = own.reduce((a, l) => a + (Number(l.revenue) || 0), 0);
    const maxPages = own.reduce((m, l) => Math.max(m, l.pagesManaged || 0), 0);
    const convRate = customers > 0 ? (conversions / customers) * 100 : 0;
    const roas = spend > 0 ? revenue / spend : 0;
    return { emp: e, days: own.length, customersPerDay: customers / days, convRate, roas, maxPages, spend, revenue };
  }).sort((a, b) => b.roas - a.roas);

  const totalCustomersToday = logs.filter((l) => l.date === TODAY_STR).reduce((a, l) => a + (Number(l.customersReached) || 0), 0);

  // Doanh thu theo Page — nối đủ chuỗi: Page → Marketing chạy ads (chi phí) → Sale xử lý đơn ra
  // từ page đó (doanh thu THẬT từ CRM, không phải số tự khai trong nhật ký) → ROAS thật cả phễu.
  const pageStats = (pages || []).map((p) => {
    const pageLogs = visibleLogs.filter((l) => l.pageId === p.id);
    const spend = pageLogs.reduce((a, l) => a + (Number(l.adSpend) || 0), 0);
    const leadRevenue = pageLogs.reduce((a, l) => a + (Number(l.revenue) || 0), 0);
    const pageOrders = (orders || []).filter((o) => o.pageId === p.id && (rangeMode === "all" || (o.date >= rangeFrom && o.date <= rangeTo)));
    const realRevenue = pageOrders.reduce((a, o) => a + (Number(o.amount) || 0), 0);
    const realRoas = spend > 0 ? realRevenue / spend : 0;
    // 1 Page có thể ra đơn từ NHIỀU loại sản phẩm khác nhau — gộp riêng từng loại để biết rõ,
    // không chỉ 1 con số tổng gộp chung.
    const byProduct = Object.values(pageOrders.reduce((acc, o) => {
      const key = o.productName || "Không rõ sản phẩm";
      acc[key] = acc[key] || { name: key, count: 0, revenue: 0 };
      acc[key].count += 1; acc[key].revenue += Number(o.amount) || 0;
      return acc;
    }, {})).sort((a, b) => b.revenue - a.revenue);
    return { page: p, spend, leadRevenue, realRevenue, realRoas, orderCount: pageOrders.length, byProduct };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-lg border border-paper-line p-3 text-xs text-muted flex items-start gap-2">
        <Link2 size={13} className="text-ink-light shrink-0 mt-0.5" />
        <span>Ghi mỗi ngày làm việc của từng nhân viên Marketing/Ads ở đây — chi phí, doanh thu và số liệu chuyển đổi sẽ tự cộng vào <strong className="text-charcoal">Bảng lương</strong> và <strong className="text-charcoal">Hiệu suất</strong> theo tháng.</span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard icon={Megaphone} label="Số nhân viên Marketing" value={mktEmployees.length} />
        <KpiCard icon={ShoppingCart} label="Số ngày đã ghi nhận" value={logs.length} />
        <KpiCard icon={UserCheck} label="Khách tiếp cận hôm nay" value={totalCustomersToday} tone="up" />
        <KpiCard icon={TrendingUp} label="ROAS trung bình cao nhất" value={leaderboard[0] ? `${leaderboard[0].roas.toFixed(2)}x` : "—"} tone="up" sub={leaderboard[0]?.emp.name} />
      </div>

      <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="text-xs font-semibold text-ink uppercase flex items-center gap-1.5"><Megaphone size={13} /> Quản lý Page — ai chạy ads, đơn ra thì Sale nào xử lý</div>
          <button onClick={() => { setEditingPageId(null); setPageForm(blankPageForm); setShowPageForm(true); }} className="text-xs bg-ink text-white px-2.5 py-1.5 rounded-md hover:bg-ink-light flex items-center gap-1"><Plus size={12} /> Thêm Page</button>
        </div>
        {showPageForm && (
          <div className="mx-4 mb-3 bg-paper border border-paper-line rounded-md p-3">
            <div className="text-[11px] font-semibold text-ink uppercase mb-2">{editingPageId ? "Sửa Page — cập nhật đúng nhân sự đang có hiện tại" : "Page mới"}</div>
            <input value={pageForm.name} onChange={(e) => setPageForm({ ...pageForm, name: e.target.value })} placeholder="Tên Page (VD: Page DOMIX)" className="border border-paper-line rounded px-2 py-1.5 text-xs w-full mb-2" />
            <input value={pageForm.url} onChange={(e) => setPageForm({ ...pageForm, url: e.target.value })} placeholder="Link Page thật (VD: https://facebook.com/domix.page) — sếp bấm vào kiểm tra được" className="border border-paper-line rounded px-2 py-1.5 text-xs w-full mb-2" />
            <div className="mb-2">
              <div className="text-[10px] font-semibold text-ink uppercase mb-1">Sản phẩm Page này bán (lấy từ Kho hàng — để kiểm soát đúng hiệu quả từng sản phẩm)</div>
              <div className="flex flex-wrap gap-1.5">
                {(inventory || []).length === 0 && <span className="text-[10px] text-muted">Chưa có sản phẩm nào trong Kho hàng.</span>}
                {(inventory || []).map((prod) => (
                  <label key={prod.id} className="flex items-center gap-1 text-xs bg-white border border-paper-line rounded px-2 py-1 cursor-pointer">
                    <input type="checkbox" checked={pageForm.productIds.includes(prod.id)} onChange={() => togglePageProduct(prod.id)} /> {prod.name}{prod.durationMonths > 0 ? ` (${prod.durationMonths}th)` : ""}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] font-semibold text-ink uppercase mb-1">Marketing chạy ads Page này (đang làm việc)</div>
                <div className="flex flex-wrap gap-1.5">
                  {mktEmpAll.length === 0 && <span className="text-[10px] text-muted">Chưa có ai vị trí Marketing/Ads.</span>}
                  {mktEmpAll.map((e) => (
                    <label key={e.id} className="flex items-center gap-1 text-xs bg-white border border-paper-line rounded px-2 py-1 cursor-pointer">
                      <input type="checkbox" checked={pageForm.marketingEmployeeIds.includes(e.id)} onChange={() => togglePageEmp("marketingEmployeeIds", e.id)} /> {e.name}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-ink uppercase mb-1">Sale xử lý đơn từ Page này (đang làm việc)</div>
                <div className="flex flex-wrap gap-1.5">
                  {saleEmpAll.length === 0 && <span className="text-[10px] text-muted">Chưa có ai vị trí Sale.</span>}
                  {saleEmpAll.map((e) => (
                    <label key={e.id} className="flex items-center gap-1 text-xs bg-white border border-paper-line rounded px-2 py-1 cursor-pointer">
                      <input type="checkbox" checked={pageForm.saleEmployeeIds.includes(e.id)} onChange={() => togglePageEmp("saleEmployeeIds", e.id)} /> {e.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-[10px] text-muted mt-2">Danh sách trên luôn lấy đúng người đang làm việc thật ở tab Nhân sự — thêm nhân sự Sale/Marketing mới thì mở "Sửa Page" là thấy ngay, tick thêm là xong, không cần tạo lại Page.</p>
            <div className="flex gap-2 mt-3">
              <button onClick={addPage} className="text-xs bg-ledger-green text-white px-3 py-1.5 rounded-md">{editingPageId ? "Cập nhật Page" : "Lưu Page"}</button>
              <button onClick={closePageForm} className="text-xs border border-paper-line px-3 py-1.5 rounded-md text-muted">Huỷ</button>
            </div>
          </div>
        )}
        <table className="w-full text-sm">
          <thead><tr className="bg-paper text-left text-xs uppercase text-muted"><th className="px-4 py-2">Page</th><th className="px-4 py-2">Sản phẩm</th><th className="px-4 py-2">Marketing chạy</th><th className="px-4 py-2">Sale xử lý</th><th className="px-4 py-2"></th></tr></thead>
          <tbody>
            {(pages || []).length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-center text-xs text-muted">Chưa có Page nào.</td></tr>}
            {(pages || []).map((p) => (
              <tr key={p.id} className="border-t border-paper-line">
                <td className="px-4 py-2">
                  <div className="font-medium">{p.name}</div>
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-ink-light underline flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <ExternalLink size={9} /> Xem Page thật
                    </a>
                  ) : (
                    <span className="text-[10px] text-gold">Chưa có link — sếp không kiểm tra trực tiếp được</span>
                  )}
                </td>
                <td className="px-4 py-2 text-xs">{(p.productIds || []).map((id) => (inventory || []).find((i) => i.id === id)?.name).filter(Boolean).join(", ") || <span className="text-muted">—</span>}</td>
                <td className="px-4 py-2 text-xs">{p.marketingEmployeeIds?.map((id) => nameOf(id)).join(", ") || "—"}</td>
                <td className="px-4 py-2 text-xs">{p.saleEmployeeIds?.map((id) => nameOf(id)).join(", ") || "—"}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => startEditPage(p)} className="text-muted hover:text-ink"><Pencil size={13} /></button>
                    <button onClick={() => removePage(p.id)} className="text-muted hover:text-stamp-red"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageStats.length > 0 && (
        <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
          <div className="px-4 pt-3 pb-1 text-xs font-semibold text-ink uppercase">Doanh thu theo Page — cả phễu Marketing → Sale (kỳ đang xem)</div>
          <table className="w-full text-sm">
            <thead><tr className="bg-paper text-left text-xs uppercase text-muted"><th className="px-4 py-2">Page</th><th className="px-4 py-2 text-right">Chi phí ads</th><th className="px-4 py-2 text-right">Doanh thu tự khai (Marketing)</th><th className="px-4 py-2 text-right">Đơn Sale chốt thật</th><th className="px-4 py-2 text-right">Doanh thu THẬT (CRM)</th><th className="px-4 py-2 text-right">ROAS thật cả phễu</th></tr></thead>
            <tbody>
              {pageStats.map((s) => (
                <React.Fragment key={s.page.id}>
                  <tr className="border-t border-paper-line">
                    <td className="px-4 py-2 font-medium">{s.page.name}</td>
                    <td className="px-4 py-2 text-right ktns-mono text-stamp-red">{fmtVND(s.spend)}</td>
                    <td className="px-4 py-2 text-right ktns-mono text-muted">{fmtVND(s.leadRevenue)}</td>
                    <td className="px-4 py-2 text-right ktns-mono">{s.orderCount}</td>
                    <td className="px-4 py-2 text-right ktns-mono text-ledger-green font-semibold">{fmtVND(s.realRevenue)}</td>
                    <td className="px-4 py-2 text-right ktns-mono font-semibold">{s.realRoas.toFixed(2)}x</td>
                  </tr>
                  {s.byProduct.length > 0 && (
                    <tr className="bg-paper/50">
                      <td colSpan={6} className="px-4 py-1.5">
                        <span className="text-[10px] text-muted">Theo sản phẩm: </span>
                        {s.byProduct.map((bp, i) => (
                          <span key={bp.name} className="text-[10px] text-ink-light">{i > 0 && " · "}{bp.name} ({bp.count} đơn, {fmtVND(bp.revenue)})</span>
                        ))}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2.5 text-[11px] text-muted border-t border-paper-line">* "Doanh thu THẬT" lấy từ đúng đơn hàng CRM đã gắn Page nguồn — khác với "Doanh thu tự khai" (số Marketing tự ước lượng khi ghi nhật ký), phản ánh đúng kết quả Sale chốt được, không phải số ước tính. 1 Page có thể ra đơn nhiều loại sản phẩm khác nhau — xem dòng "Theo sản phẩm" bên dưới mỗi Page.</p>
        </div>
      )}

      <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
        <div className="px-4 pt-3 pb-1 text-xs font-semibold text-ink uppercase flex items-center gap-1.5"><Gauge size={13} /> Xếp hạng hiệu suất — để đánh giá hàng ngày</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-paper text-left text-xs uppercase text-muted">
              <th className="px-4 py-2">Nhân viên</th>
              <th className="px-4 py-2 text-right">Số page</th>
              <th className="px-4 py-2 text-right">Khách TB/ngày</th>
              <th className="px-4 py-2 text-right">Tỷ lệ chuyển đổi</th>
              <th className="px-4 py-2 text-right">Chi phí</th>
              <th className="px-4 py-2 text-right">Doanh thu</th>
              <th className="px-4 py-2 text-right">ROAS</th>
              <th className="px-4 py-2">Đánh giá</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((s, i) => {
              const convColor = s.convRate >= 10 ? "text-ledger-green" : s.convRate >= 5 ? "text-gold" : "text-stamp-red";
              const roasColor = s.roas >= 3 ? "text-ledger-green" : s.roas >= 1.5 ? "text-gold" : "text-stamp-red";
              return (
                <tr key={s.emp.id} className="border-t border-paper-line">
                  <td className="px-4 py-2 font-medium">{i === 0 && s.roas > 0 ? "🏆 " : ""}{s.emp.name}</td>
                  <td className="px-4 py-2 text-right ktns-mono">{s.maxPages}</td>
                  <td className="px-4 py-2 text-right ktns-mono">{s.customersPerDay.toFixed(1)}</td>
                  <td className={`px-4 py-2 text-right ktns-mono font-medium ${convColor}`}>{s.convRate.toFixed(1)}%</td>
                  <td className="px-4 py-2 text-right ktns-mono text-muted">{fmtVND(s.spend)}</td>
                  <td className="px-4 py-2 text-right ktns-mono text-ledger-green">{fmtVND(s.revenue)}</td>
                  <td className={`px-4 py-2 text-right ktns-mono font-semibold ${roasColor}`}>{s.roas.toFixed(2)}x</td>
                  <td className="px-4 py-2">
                    {s.roas >= 3 ? <StampBadge text="TỐT" gold /> : s.roas >= 1.5 ? <StampBadge text="ỔN" muted /> : <StampBadge text="CẦN TỐI ƯU" />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <RangeModePicker rangeMode={rangeMode} setRangeMode={setRangeMode} rangeFrom={rangeFrom} setRangeFrom={setRangeFrom} rangeTo={rangeTo} setRangeTo={setRangeTo} reportMonth={reportMonth} reportYear={reportYear} show={showRangePicker} setShow={setShowRangePicker} />
          <p className="text-sm text-muted">{visibleLogs.length}/{logs.length} lượt ghi nhận theo ngày.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportMarketingExcel(visibleLogs, employees)} className="flex items-center gap-1.5 text-sm bg-ledger-green text-white px-3.5 py-2 rounded-md hover:opacity-90">
            <FileSpreadsheet size={15} /> Xuất Excel chi tiết
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-sm bg-ink text-white px-3.5 py-2 rounded-md hover:bg-ink-light">
            <Plus size={15} /> Ghi nhận ngày mới
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-paper-line p-5 relative">
          <button className="absolute top-3 right-3 text-muted hover:text-ink" onClick={() => { if (form.customersReached && !window.confirm("Chưa lưu — đóng lại sẽ mất thông tin vừa nhập. Vẫn muốn đóng?")) return; setShowForm(false); }}><X size={16} /></button>
          <h3 className="ktns-serif font-semibold text-ink mb-4">Ghi nhận hiệu suất ngày</h3>
          <div className="grid grid-cols-4 gap-3">
            <label className="text-xs text-muted flex flex-col gap-1">Ngày<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Nhân viên
              <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm">
                {mktEmployees.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
              </select>
            </label>
            <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Page đang chạy
              <select value={form.pageId} onChange={(e) => setForm({ ...form, pageId: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm">
                <option value="">— Chưa gán Page cụ thể —</option>
                {(pages || []).map((p) => (<option key={p.id} value={p.id}>{p.name}{p.saleEmployeeIds?.length ? ` — Sale xử lý: ${p.saleEmployeeIds.map((id) => nameOf(id)).join(", ")}` : ""}</option>))}
              </select>
            </label>
            <label className="text-xs text-muted flex flex-col gap-1">Khách tiếp cận<input type="number" value={form.customersReached} onChange={(e) => setForm({ ...form, customersReached: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Số chuyển đổi<input type="number" value={form.conversions} onChange={(e) => setForm({ ...form, conversions: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Chi phí ads (đ)<MoneyInput value={form.adSpend} onChange={(v) => setForm({ ...form, adSpend: v })} /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Doanh thu (đ)<MoneyInput value={form.revenue} onChange={(v) => setForm({ ...form, revenue: v })} /></label>
            <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Ghi chú tối ưu (đã đổi gì hôm nay)<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="VD: đổi creative, tắt tập quảng cáo yếu..." className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
          </div>
          <button onClick={addLog} className="mt-4 bg-ledger-green text-white text-sm px-4 py-2 rounded-md hover:opacity-90">Lưu</button>
        </div>
      )}

      <div className="bg-white rounded-lg border border-paper-line overflow-x-auto">
        <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-paper text-left text-xs uppercase text-muted">
              <th className="px-3 py-2.5">STT</th>
              <th className="px-3 py-2.5">Ngày</th>
              <th className="px-3 py-2.5">Nhân viên</th>
              <th className="px-3 py-2.5">Page</th>
              <th className="px-3 py-2.5 text-right">Khách tiếp cận</th>
              <th className="px-3 py-2.5 text-right">Chuyển đổi</th>
              <th className="px-3 py-2.5 text-right">Tỷ lệ CĐ</th>
              <th className="px-3 py-2.5 text-right">Chi phí</th>
              <th className="px-3 py-2.5 text-right">Doanh thu</th>
              <th className="px-3 py-2.5 text-right">ROAS</th>
              <th className="px-3 py-2.5">Ghi chú tối ưu</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {visibleLogs.map((l, idx) => ({ ...l, _stt: idx + 1 })).slice().reverse().map((l) => {
              const convRate = l.customersReached > 0 ? (l.conversions / l.customersReached) * 100 : 0;
              const roas = l.adSpend > 0 ? l.revenue / l.adSpend : 0;
              return (
                <tr key={l.id} className="border-t border-paper-line">
                  <td className="px-3 py-2 ktns-mono text-xs text-muted">{l._stt}</td>
                  <td className="px-3 py-2 ktns-mono text-xs text-muted">{l.date}</td>
                  <td className="px-3 py-2 text-xs font-medium">{nameOf(l.employeeId)}</td>
                  <td className="px-3 py-2 text-xs">{pageNameOf(l.pageId) || <span className="text-muted">{l.pagesManaged} page (chưa đặt tên)</span>}</td>
                  <td className="px-3 py-2 text-right ktns-mono text-xs">{l.customersReached}</td>
                  <td className="px-3 py-2 text-right ktns-mono text-xs">{l.conversions}</td>
                  <td className="px-3 py-2 text-right ktns-mono text-xs">{convRate.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right ktns-mono text-xs text-muted">{fmtVND(l.adSpend)}</td>
                  <td className="px-3 py-2 text-right ktns-mono text-xs text-ledger-green">{fmtVND(l.revenue)}</td>
                  <td className="px-3 py-2 text-right ktns-mono text-xs font-medium">{roas.toFixed(2)}x</td>
                  <td className="px-3 py-2 text-xs text-muted max-w-xs">{l.note || "—"}</td>
                  <td className="px-3 py-2 text-right"><button onClick={() => removeLog(l.id)} className="text-muted hover:text-stamp-red"><Trash2 size={14} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
      <p className="text-xs text-muted">* Tỷ lệ chuyển đổi ≥10% và ROAS ≥3x được coi là tốt, dưới 5%/1.5x cần tối ưu lại — chỉnh ngưỡng này trong code nếu công ty có tiêu chuẩn riêng.</p>
    </div>
  );
}

// ---------- Chấm công ----------
function ChamCong({ employees, setEmployees, unlockedMonths, setUnlockedMonths, company }) {
  const [viewYear, setViewYear] = useState(ATT_YEAR);
  const [viewMonth, setViewMonth] = useState(ATT_MONTH);
  const isCurrentMonth = viewYear === ATT_YEAR && viewMonth === ATT_MONTH;
  const key = monthKey(viewYear, viewMonth);
  const locked = isPeriodLocked(viewYear, viewMonth, unlockedMonths);
  const days = Array.from({ length: daysInMonthVN(viewYear, viewMonth) }, (_, i) => i + 1);

  const activeEmployees = employees.filter((e) => isEmployeeActiveInMonth(e, viewYear, viewMonth));
  const groups = Object.keys(ROLE_META)
    .map((rt) => ({ rt, meta: ROLE_META[rt], members: activeEmployees.filter((e) => e.roleType === rt) }))
    .filter((g) => g.members.length > 0);

  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quick, setQuick] = useState({ name: "", position: "", dept: "", roleType: "khac", contractType: "chinh_thuc", baseSalary: "" });
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockError, setUnlockError] = useState("");

  const openUnlockModal = () => { setUnlockPassword(""); setUnlockError(""); setShowUnlockModal(true); };
  const confirmUnlock = () => {
    if (unlockPassword === (company.directorPassword || DEFAULT_DIRECTOR_PASSWORD)) {
      setUnlockedMonths((prev) => new Set(prev).add(monthKey(viewYear, viewMonth)));
      setShowUnlockModal(false);
    } else {
      setUnlockError("Sai mật khẩu — không thể mở khoá.");
    }
  };

  const updateCell = (empId, day, code) => {
    if (locked) { openUnlockModal(); return; }
    setEmployees((prev) => prev.map((e) => {
      if (e.id !== empId) return e;
      const monthRec = { ...(e.attendance?.[key] || defaultMonthAttendance(viewYear, viewMonth)) };
      if (code === "") delete monthRec[day]; else monthRec[day] = code;
      return { ...e, attendance: { ...e.attendance, [key]: monthRec } };
    }));
  };

  const quickAddEmp = () => {
    if (!quick.name || !quick.baseSalary) return;
    setEmployees((prev) => [...prev, {
      id: Date.now(), name: quick.name, position: quick.position || ROLE_META[quick.roleType].label,
      dept: quick.dept || ROLE_META[quick.roleType].label, roleType: quick.roleType,
      contractType: quick.contractType, probationRate: DEFAULT_PROBATION_RATE,
      baseSalary: Number(quick.baseSalary) || 0, bonusTarget: 0, kpi: 100,
      joined: TODAY_STR, status: "active", dependents: 0, mealAllowance: 730000, attendanceBonus: 300000, otherBonus: 0, advance: 0,
      dob: "", hometown: "", bankName: "", bankAccount: "", phone: "", email: "",
      customScore: 80, adSpend: 0, adRevenue: 0, conversions: 0, ctr: 0,
      salesTarget: 0, salesActual: 0, dealsClosed: 0, leadsHandled: 0,
      tasksAssigned: 0, tasksCompleted: 0, tasksOnTime: 0, bugsFixed: 0, upsaleValue: 0, consecutiveLowKpiMonths: 0,
      attendance: { [key]: defaultMonthAttendance(viewYear, viewMonth) },
    }]);
    setQuick({ name: "", position: "", dept: "", roleType: "khac", contractType: "chinh_thuc", baseSalary: "" });
    setShowQuickAdd(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <p className="text-sm text-muted">
          Chủ nhật tự động là ngày nghỉ (CN). Ngày đã qua chưa chấm mặc định "X" (đủ công); <strong className="text-ink">ngày chưa tới bị khoá, để trắng</strong> — đúng ngày đó mới chấm được, tránh chấm công khống trước. Mỗi tháng lưu riêng, chuyển tháng vẫn giữ lịch sử.
          {isCurrentMonth ? <> Ngày công tính đến hôm nay tự động đổ sang <strong className="text-ink">Bảng lương</strong>.</> : <strong className="text-gold"> Đang xem tháng khác — Bảng lương chỉ tính theo tháng {ATT_MONTH}/{ATT_YEAR}.</strong>}
        </p>
        <div className="flex items-center gap-2">
          <select
            value={key}
            onChange={(e) => { const opt = MONTH_OPTIONS.find((o) => monthKey(o.year, o.month) === e.target.value); if (opt) { setViewYear(opt.year); setViewMonth(opt.month); } }}
            className="border border-paper-line rounded-md px-3 py-2 text-sm ktns-mono bg-white"
          >
            {MONTH_OPTIONS.map((o) => (<option key={monthKey(o.year, o.month)} value={monthKey(o.year, o.month)}>{monthLabelVN(o.month, o.year)}{o.year === ATT_YEAR && o.month === ATT_MONTH ? " (hiện tại)" : ""}</option>))}
          </select>
          {locked ? (
            <button onClick={openUnlockModal} className="flex items-center gap-1.5 text-xs bg-stamp-red text-white px-3 py-2 rounded-md hover:opacity-90">
              <CreditCard size={13} /> Đã khoá sổ — Nhập mật khẩu giám đốc
            </button>
          ) : (
            !isCurrentMonth && new Date(viewYear, viewMonth, 0) < TODAY && (
              <span className="text-[10px] text-gold px-2 py-1 rounded-full bg-gold/10">Còn {LOCK_WINDOW_DAYS - Math.floor((TODAY - new Date(viewYear, viewMonth, 0)) / 86400000)} ngày trước khi khoá sổ</span>
            )
          )}
          <button onClick={() => setShowQuickAdd(true)} className="flex items-center gap-1.5 text-sm bg-ink text-white px-3.5 py-2 rounded-md hover:bg-ink-light"><Plus size={15} /> Tuyển thêm nhân viên</button>
        </div>
      </div>

      {showQuickAdd && (
        <div className="bg-white rounded-lg border border-paper-line p-5 relative">
          <button className="absolute top-3 right-3 text-muted" onClick={() => setShowQuickAdd(false)}><X size={16} /></button>
          <h3 className="ktns-serif font-semibold text-ink mb-1">Thêm nhân viên mới vào chấm công</h3>
          <p className="text-xs text-muted mb-4">Nhập nhanh để có mặt trong bảng chấm công ngay — vào tab Nhân sự sau để bổ sung lương thưởng, KPI, chỉ số vận hành chi tiết.</p>
          <div className="grid grid-cols-6 gap-3">
            <input placeholder="Họ tên" value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm col-span-2" />
            <input placeholder="Chức vụ" value={quick.position} onChange={(e) => setQuick({ ...quick, position: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" />
            <select value={quick.roleType} onChange={(e) => setQuick({ ...quick, roleType: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm">
              {Object.entries(ROLE_META).map(([id, m]) => (<option key={id} value={id}>{m.label}</option>))}
            </select>
            <select value={quick.contractType} onChange={(e) => setQuick({ ...quick, contractType: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm">
              {Object.entries(CONTRACT_META).map(([id, m]) => (<option key={id} value={id}>{m.label}</option>))}
            </select>
            <MoneyInput value={quick.baseSalary} onChange={(v) => setQuick({ ...quick, baseSalary: v })} placeholder="Lương cơ bản (đ)" />
          </div>
          <button onClick={quickAddEmp} className="mt-4 bg-ledger-green text-white text-sm px-4 py-2 rounded-md hover:opacity-90">Thêm vào chấm công</button>
        </div>
      )}

      <div className="grid grid-cols-[1fr_260px] gap-4 items-start">
        <div className="bg-white rounded-lg border border-paper-line overflow-x-auto">
          <table className="ktns-att-table text-sm border-collapse w-full">
            <thead>
              <tr>
                <th rowSpan={2} className="px-3 py-2 bg-ink text-white text-xs sticky left-0">Ngày</th>
                <th rowSpan={2} className="px-3 py-2 bg-ink text-white text-xs">Thứ</th>
                {groups.map((g) => (
                  <th key={g.rt} colSpan={g.members.length} className={`px-2 py-2 text-xs uppercase font-semibold ${ROLE_BAND_CLASS[g.rt]}`}>{g.meta.label}</th>
                ))}
              </tr>
              <tr>
                {groups.flatMap((g) => g.members.map((emp) => (
                  <th key={emp.id} className="px-2 py-1.5 text-xs bg-paper border-b border-paper-line font-medium text-ink">{emp.name}</th>
                )))}
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const sunday = isSundayVN(viewYear, viewMonth, day);
                const isFuture = new Date(viewYear, viewMonth - 1, day) > TODAY;
                return (
                  <tr key={day} className={sunday ? "ktns-att-sunday" : ""}>
                    <td className={`ktns-mono text-xs text-center px-3 py-1 border-t border-paper-line font-medium bg-white sticky left-0 ${isFuture ? "text-muted" : ""}`}>{day}</td>
                    <td className={`text-xs px-3 py-1 border-t border-paper-line ${isFuture ? "text-muted/70" : "text-muted"}`}>{dayNameVN(viewYear, viewMonth, day)}</td>
                    {groups.flatMap((g) => g.members.map((emp) => {
                      const rawCode = emp.attendance?.[key]?.[day];
                      const code = rawCode || (sunday ? "CN" : "");
                      return (
                        <td key={emp.id} className="px-1.5 py-1 border-t border-paper-line text-center">
                          {sunday ? (
                            <span className="ktns-mono text-xs text-stamp-red">CN</span>
                          ) : isFuture && !rawCode ? (
                            <span className="ktns-mono text-xs text-paper-line" title="Chưa tới ngày — kế toán chỉ chấm được khi ngày này đến, tránh chấm công khống trước.">—</span>
                          ) : locked ? (
                            <button onClick={openUnlockModal} className="ktns-mono text-xs text-muted border border-dashed border-paper-line rounded px-1.5 py-0.5 w-11" title="Tháng đã khoá sổ — bấm để nhập mật khẩu giám đốc mở khoá">
                              🔒{code || "—"}
                            </button>
                          ) : (
                            <select value={code} onChange={(ev) => updateCell(emp.id, day, ev.target.value)} className={`ktns-att-select ${!code ? "ktns-att-blank" : ""}`} title={!code ? "Chưa chấm — chọn ký hiệu để tính công ngày này" : ""}>
                              <option value="">—</option>
                              {Object.keys(ATTENDANCE_CODES).filter((c) => c !== "CN").map((c) => (<option key={c} value={c}>{c}</option>))}
                            </select>
                          )}
                        </td>
                      );
                    }))}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-ink">
                <td colSpan={2} className="text-white text-xs font-semibold px-3 py-2.5 sticky left-0 bg-ink">TỔNG CÔNG</td>
                {groups.flatMap((g) => g.members.map((emp) => (
                  <td key={emp.id} className="text-white ktns-mono text-center text-sm font-semibold py-2.5">{monthlyCongFor(emp.attendance, viewYear, viewMonth).toFixed(1)}</td>
                )))}
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="bg-white rounded-lg border border-paper-line p-4 flex flex-col gap-2">
          <div className="text-xs font-semibold text-ink uppercase flex items-center gap-1.5"><Gauge size={13} /> Ký hiệu chấm công</div>
          {Object.entries(ATTENDANCE_CODES).map(([code, meta]) => (
            <div key={code} className="flex items-center gap-2 text-xs border-t border-paper-line pt-1.5 first:border-t-0 first:pt-0">
              <span className="ktns-mono font-bold text-ink w-7">{code}</span>
              <span className="text-muted flex-1">{meta.label}</span>
              <span className="ktns-mono text-charcoal">{meta.value.toFixed(1)}</span>
            </div>
          ))}
          <p className="text-[11px] text-muted mt-2 pt-2 border-t border-paper-line">
            Bấm "Tuyển thêm nhân viên" ở trên để thêm ngay tại đây, hoặc thêm đầy đủ hơn ở tab Nhân sự — cả hai cách đều tự xuất hiện đúng nhóm vị trí, mặc định làm đủ công.
          </p>
          <p className="text-[11px] text-muted pt-2 border-t border-paper-line">
            Đổi tháng ở ô chọn phía trên để chấm bù/kiểm tra tháng trước — dữ liệu từng tháng lưu riêng, không ghi đè lên nhau. Ngày chưa tới luôn bị khoá dù ở tháng nào, tránh chấm công khống trước.
          </p>
        </div>
      </div>

      {showUnlockModal && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={() => setShowUnlockModal(false)}>
          <div className="bg-white rounded-lg p-5 w-80 shadow-xl" onClick={(ev) => ev.stopPropagation()}>
            <h3 className="ktns-serif font-semibold text-ink mb-1 flex items-center gap-1.5"><CreditCard size={15} /> Mở khoá sổ tháng {viewMonth}/{viewYear}</h3>
            <p className="text-xs text-muted mb-3">Tháng này đã khoá sổ (quá {LOCK_WINDOW_DAYS} ngày). Nhập mật khẩu giám đốc để mở khoá sửa tạm thời.</p>
            <input
              type="password"
              value={unlockPassword}
              onChange={(ev) => { setUnlockPassword(ev.target.value); setUnlockError(""); }}
              onKeyDown={(ev) => ev.key === "Enter" && confirmUnlock()}
              placeholder="Mật khẩu giám đốc"
              autoFocus
              className="border border-paper-line rounded px-2.5 py-2 text-sm w-full ktns-mono"
            />
            {unlockError && <p className="text-xs text-stamp-red mt-1.5">{unlockError}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={confirmUnlock} className="bg-ink text-white text-sm px-3 py-1.5 rounded-md hover:bg-ink-light">Mở khoá</button>
              <button onClick={() => setShowUnlockModal(false)} className="border border-paper-line text-sm px-3 py-1.5 rounded-md text-muted">Huỷ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Nhân sự ----------
function NhanSu({ employees, setEmployees, showForm, setShowForm, reportYear, reportMonth, prefillEmployee, setPrefillEmployee }) {
  const [showInactive, setShowInactive] = useState(false);
  const [expandedResume, setExpandedResume] = useState({});
  const [viewingDoc, setViewingDoc] = useState(null);
  const periodActive = employees.filter((e) => isEmployeeActiveInMonth(e, reportYear, reportMonth));
  const periodInactive = employees.filter((e) => !isEmployeeActiveInMonth(e, reportYear, reportMonth));
  const visibleEmployees = showInactive ? employees : periodActive;

  const blankForm = {
    name: "", position: "", dept: "", baseSalary: "", bonusTarget: "", kpi: "100", joined: TODAY_STR,
    dependents: "0", mealAllowance: "730000", attendanceBonus: "300000",
    roleType: "khac", customScore: "80",
    contractType: "chinh_thuc", probationRate: "85",
    dob: "", hometown: "", bankName: "", bankAccount: "", phone: "", email: "", resignedDate: "",
    idNumber: "", education: "Đại học", major: "", resumeSummary: "",
    idFrontData: "", idFrontName: "", idFrontType: "", idBackData: "", idBackName: "", idBackType: "",
    resumeFileData: "", resumeFileName: "", resumeFileType: "",
    adSpend: "", adRevenue: "", conversions: "", ctr: "",
    salesTarget: "", salesActual: "", dealsClosed: "", leadsHandled: "",
    tasksAssigned: "", tasksCompleted: "", tasksOnTime: "", bugsFixed: "", upsaleValue: "",
    consecutiveLowKpiMonths: "0",
  };
  const [form, setForm] = useState(blankForm);
  // Nhận dữ liệu điền sẵn từ Tuyển dụng AI (bấm "Tuyển ngay") — chỉ chạy khi có dữ liệu mới gửi
  // qua, xong thì xoá cầu nối ngay để không lặp lại lần mở form sau.
  useEffect(() => {
    if (prefillEmployee) {
      setForm((f) => ({ ...f, name: prefillEmployee.name, roleType: prefillEmployee.roleType, position: ROLE_META[prefillEmployee.roleType]?.label || "" }));
      setPrefillEmployee(null);
    }
  }, [prefillEmployee]);
  const handleDocFile = (e, dataField, nameField) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, [dataField]: reader.result, [nameField]: file.name, [dataField.replace("Data", "Type")]: file.type }));
    reader.readAsDataURL(file);
  };
  const [editingId, setEditingId] = useState(null);

  const startEdit = (e) => {
    setEditingId(e.id);
    setForm({
      name: e.name, position: e.position, dept: e.dept, baseSalary: String(e.baseSalary), bonusTarget: String(e.bonusTarget), kpi: String(e.kpi), joined: e.joined,
      dependents: String(e.dependents || 0), mealAllowance: String(e.mealAllowance || 0), attendanceBonus: String(e.attendanceBonus || 0),
      roleType: e.roleType, customScore: String(e.customScore || 0),
      contractType: e.contractType || "chinh_thuc", probationRate: String(Math.round((e.probationRate || DEFAULT_PROBATION_RATE) * 100)),
      dob: e.dob || "", hometown: e.hometown || "", bankName: e.bankName || "", bankAccount: e.bankAccount || "", phone: e.phone || "", email: e.email || "", resignedDate: e.resignedDate || "",
      idNumber: e.idNumber || "", education: e.education || "Đại học", major: e.major || "", resumeSummary: e.resumeSummary || "",
      idFrontData: e.idFrontData || "", idFrontName: e.idFrontName || "", idFrontType: e.idFrontType || "",
      idBackData: e.idBackData || "", idBackName: e.idBackName || "", idBackType: e.idBackType || "",
      resumeFileData: e.resumeFileData || "", resumeFileName: e.resumeFileName || "", resumeFileType: e.resumeFileType || "",
      adSpend: String(e.adSpend || 0), adRevenue: String(e.adRevenue || 0), conversions: String(e.conversions || 0), ctr: String(e.ctr || 0),
      salesTarget: String(e.salesTarget || 0), salesActual: String(e.salesActual || 0), dealsClosed: String(e.dealsClosed || 0), leadsHandled: String(e.leadsHandled || 0),
      tasksAssigned: String(e.tasksAssigned || 0), tasksCompleted: String(e.tasksCompleted || 0), tasksOnTime: String(e.tasksOnTime || 0), bugsFixed: String(e.bugsFixed || 0), upsaleValue: String(e.upsaleValue || 0),
      consecutiveLowKpiMonths: String(e.consecutiveLowKpiMonths || 0),
    });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(blankForm); };

  const saveEmp = () => {
    if (!form.name || !form.baseSalary) return;
    const num = (v) => Number(v) || 0;
    const parsed = {
      ...form,
      baseSalary: num(form.baseSalary), bonusTarget: num(form.bonusTarget), kpi: num(form.kpi),
      dependents: num(form.dependents), mealAllowance: num(form.mealAllowance) || 730000, attendanceBonus: num(form.attendanceBonus),
      customScore: num(form.customScore),
      probationRate: num(form.probationRate) / 100 || DEFAULT_PROBATION_RATE,
      adSpend: num(form.adSpend), adRevenue: num(form.adRevenue), conversions: num(form.conversions), ctr: num(form.ctr),
      salesTarget: num(form.salesTarget), salesActual: num(form.salesActual), dealsClosed: num(form.dealsClosed), leadsHandled: num(form.leadsHandled),
      tasksAssigned: num(form.tasksAssigned), tasksCompleted: num(form.tasksCompleted), tasksOnTime: num(form.tasksOnTime), bugsFixed: num(form.bugsFixed),
      upsaleValue: num(form.upsaleValue), consecutiveLowKpiMonths: num(form.consecutiveLowKpiMonths),
      resignedDate: form.resignedDate || null,
    };
    if (editingId) {
      // Sửa nhân viên có sẵn — giữ nguyên id, trạng thái nghỉ việc, chấm công, thưởng/khấu trừ đã có, chỉ cập nhật các trường trong form.
      setEmployees((prev) => prev.map((e) => (e.id === editingId ? { ...e, ...parsed } : e)));
    } else {
      setEmployees((prev) => [...prev, { ...parsed, id: Date.now(), status: "active", attendance: defaultAttendance(), otherBonus: 0, advance: 0 }]);
    }
    closeForm();
  };
  const [resigningId, setResigningId] = useState(null);
  const [resignDate, setResignDate] = useState(TODAY.toISOString().slice(0, 10));
  const startResign = (id) => { setResigningId(id); setResignDate(TODAY.toISOString().slice(0, 10)); };
  const confirmResign = () => {
    setEmployees((prev) => prev.map((e) => (e.id === resigningId ? { ...e, status: "inactive", resignedDate: resignDate } : e)));
    setResigningId(null);
  };
  const reactivate = (id) => setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, status: "active", resignedDate: null } : e)));
  const updateField = (id, field, value) => setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: Number(value) || 0 } : e)));
  const updateTextField = (id, field, value) => setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <p className="text-sm text-muted">
          {periodActive.length} nhân viên đang làm việc trong tháng {reportMonth}/{reportYear} ·
          <span className="text-ink-light"> lương, thưởng, KPI, ngày công, thâm niên và chỉ số vận hành theo vị trí sẽ tự động đổ vào Bảng lương và Hiệu suất</span>
        </p>
        <div className="flex items-center gap-2">
          {periodInactive.length > 0 && (
            <button onClick={() => setShowInactive((v) => !v)} className="text-xs border border-paper-line px-2.5 py-2 rounded-md text-ink-light hover:border-gold">
              {showInactive ? "Ẩn người đã nghỉ" : `Hiện cả ${periodInactive.length} người đã nghỉ/chưa vào`}
            </button>
          )}
          <button onClick={() => { setForm(blankForm); setEditingId(null); setShowForm(true); }} className="flex items-center gap-1.5 text-sm bg-ink text-white px-3.5 py-2 rounded-md hover:bg-ink-light"><Plus size={15} /> Thêm nhân viên</button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-paper-line p-5 relative">
          <button className="absolute top-3 right-3 text-muted" onClick={closeForm}><X size={16} /></button>
          <h3 className="ktns-serif font-semibold text-ink mb-4">{editingId ? "Sửa thông tin nhân viên" : "Nhân viên mới"}</h3>
          <div className="grid grid-cols-4 gap-3">
            <input placeholder="Họ tên" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm col-span-2" />
            <input placeholder="Chức vụ" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" />
            <input placeholder="Phòng ban" value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" />
            <label className="text-xs text-muted flex flex-col gap-1">Nhóm vị trí
              <select value={form.roleType} onChange={(e) => setForm({ ...form, roleType: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm">
                {Object.entries(ROLE_META).map(([id, m]) => (<option key={id} value={id}>{m.label}</option>))}
              </select>
            </label>
            <label className="text-xs text-muted flex flex-col gap-1">Loại hợp đồng
              <select value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm">
                {Object.entries(CONTRACT_META).map(([id, m]) => (<option key={id} value={id}>{m.label}</option>))}
              </select>
            </label>
            <label className="text-xs text-muted flex flex-col gap-1">Mức lương (đ)<MoneyInput value={form.baseSalary} onChange={(v) => setForm({ ...form, baseSalary: v })} /></label>
            <label className="text-xs text-muted flex flex-col gap-1">
              Mức thưởng mục tiêu (đ)<MoneyInput value={form.bonusTarget} onChange={(v) => setForm({ ...form, bonusTarget: v })} />
              <span className="text-[10px] text-ink-light normal-case">
                {form.roleType === "sale" || form.roleType === "ads"
                  ? "Sale/Ads không dùng số này — lương tính theo doanh số ở form riêng bên dưới."
                  : form.roleType === "ky_thuat"
                  ? "Kỹ thuật không dùng số này — thưởng tính theo % giá trị upsale."
                  : "Số tiền thưởng tối đa nếu đạt 100% KPI thưởng bên dưới. VD: 2.000.000đ + KPI 80% → thưởng thực nhận 1.600.000đ."}
              </span>
            </label>
            <label className="text-xs text-muted flex flex-col gap-1">
              KPI thưởng (%)<input type="number" value={form.kpi} onChange={(e) => setForm({ ...form, kpi: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" />
              <span className="text-[10px] text-ink-light normal-case">
                {form.roleType === "sale" || form.roleType === "ads"
                  ? "Sale/Ads không dùng số này — chỉ áp dụng cho các vị trí còn lại (Kế toán, HR, Vận hành, CSKH, Quản lý, IT, Khác)."
                  : "Tự đánh giá 0-120% mức hoàn thành công việc tháng này — nhân với \"Mức thưởng mục tiêu\" ở trên ra tiền thưởng thực nhận trong Bảng lương."}
              </span>
            </label>
            {form.contractType === "thu_viec" && (
              <label className="text-xs text-muted flex flex-col gap-1">% Lương thử việc<input type="number" value={form.probationRate} onChange={(e) => setForm({ ...form, probationRate: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
            )}
            <label className="text-xs text-muted flex flex-col gap-1">Ngày vào làm<input type="date" value={form.joined} onChange={(e) => setForm({ ...form, joined: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Số người phụ thuộc<input type="number" value={form.dependents} onChange={(e) => setForm({ ...form, dependents: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Phụ cấp ăn trưa (đ)<MoneyInput value={form.mealAllowance} onChange={(v) => setForm({ ...form, mealAllowance: v })} /></label>
            <label className="text-xs text-muted flex flex-col gap-1">Phụ cấp chuyên cần (đ, mất nếu có ngày nghỉ)<MoneyInput value={form.attendanceBonus} onChange={(v) => setForm({ ...form, attendanceBonus: v })} /></label>
            <div className="col-span-2 text-[11px] text-ink-light bg-paper rounded px-2 py-1.5 flex items-center gap-1.5"><CalendarCheck size={12} /> Ngày công chấm ở tab Chấm công sau khi lưu — mặc định làm đủ công.</div>
          </div>

          <div className="mt-4 pt-4 border-t border-paper-line">
            <div className="text-xs font-medium text-ink mb-2">Hồ sơ cá nhân — để chuyển lương &amp; liên hệ</div>
            <div className="grid grid-cols-4 gap-3">
              <label className="text-xs text-muted flex flex-col gap-1">Ngày sinh<input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
              <label className="text-xs text-muted flex flex-col gap-1">Quê quán<input value={form.hometown} onChange={(e) => setForm({ ...form, hometown: e.target.value })} placeholder="VD: Nam Định" className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
              <label className="text-xs text-muted flex flex-col gap-1">Số điện thoại<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="09xxxxxxxx" className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
              <label className="text-xs text-muted flex flex-col gap-1">Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ten@congty.vn" className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
              <label className="text-xs text-muted flex flex-col gap-1">Ngân hàng<input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="VD: Vietcombank" className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
              <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Số tài khoản<input value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
              {editingId && (
                <label className="text-xs text-muted flex flex-col gap-1">Ngày nghỉ việc (nếu có)<input type="date" value={form.resignedDate} onChange={(e) => setForm({ ...form, resignedDate: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-paper-line">
            <div className="text-xs font-medium text-ink mb-2">Sơ yếu lý lịch — để dễ kiểm soát hồ sơ</div>
            <div className="grid grid-cols-4 gap-3">
              <label className="text-xs text-muted flex flex-col gap-1 col-span-2">Số CCCD/CMND<input value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} placeholder="12 số CCCD" className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
              <label className="text-xs text-muted flex flex-col gap-1">Trình độ học vấn
                <select value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm">
                  <option>THPT</option><option>Trung cấp</option><option>Cao đẳng</option><option>Đại học</option><option>Sau đại học (Thạc sĩ)</option><option>Tiến sĩ</option>
                </select>
              </label>
              <label className="text-xs text-muted flex flex-col gap-1">Chuyên ngành<input value={form.major} onChange={(e) => setForm({ ...form, major: e.target.value })} placeholder="VD: Kế toán" className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
              <label className="text-xs text-muted flex flex-col gap-1 col-span-4">Tóm tắt sơ yếu lý lịch / kinh nghiệm
                <textarea value={form.resumeSummary} onChange={(e) => setForm({ ...form, resumeSummary: e.target.value })} placeholder="Trường tốt nghiệp, kinh nghiệm làm việc trước đó, chứng chỉ liên quan..." rows={2} className="border border-paper-line rounded px-2 py-1.5 text-sm resize-none" />
              </label>
              <label className="text-xs text-muted flex flex-col gap-1">Ảnh CCCD mặt trước
                <input type="file" accept="image/*,.pdf" onChange={(e) => handleDocFile(e, "idFrontData", "idFrontName")} className="border border-paper-line rounded px-2 py-1.5 text-sm bg-white" />
                {form.idFrontName && <span className="text-[11px] text-ledger-green flex items-center gap-1 mt-1"><CheckCircle2 size={11} /> {form.idFrontName}</span>}
              </label>
              <label className="text-xs text-muted flex flex-col gap-1">Ảnh CCCD mặt sau
                <input type="file" accept="image/*,.pdf" onChange={(e) => handleDocFile(e, "idBackData", "idBackName")} className="border border-paper-line rounded px-2 py-1.5 text-sm bg-white" />
                {form.idBackName && <span className="text-[11px] text-ledger-green flex items-center gap-1 mt-1"><CheckCircle2 size={11} /> {form.idBackName}</span>}
              </label>
              <label className="text-xs text-muted flex flex-col gap-1 col-span-2">File hồ sơ/sơ yếu lý lịch đính kèm (bản scan/nộp online của ứng viên)
                <input type="file" accept="image/*,.pdf" onChange={(e) => handleDocFile(e, "resumeFileData", "resumeFileName")} className="border border-paper-line rounded px-2 py-1.5 text-sm bg-white" />
                {form.resumeFileName && <span className="text-[11px] text-ledger-green flex items-center gap-1 mt-1"><CheckCircle2 size={11} /> {form.resumeFileName}</span>}
              </label>
            </div>
            {(form.idFrontData || form.idBackData || form.resumeFileData) && (
              <div className="flex gap-3 mt-2 flex-wrap">
                {form.idFrontData && <button onClick={() => setViewingDoc({ data: form.idFrontData, name: form.idFrontName, type: form.idFrontType })} className="text-[11px] text-ink-light underline">Xem CCCD mặt trước</button>}
                {form.idBackData && <button onClick={() => setViewingDoc({ data: form.idBackData, name: form.idBackName, type: form.idBackType })} className="text-[11px] text-ink-light underline">Xem CCCD mặt sau</button>}
                {form.resumeFileData && <button onClick={() => setViewingDoc({ data: form.resumeFileData, name: form.resumeFileName, type: form.resumeFileType })} className="text-[11px] text-ink-light underline">Xem file hồ sơ</button>}
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-paper-line">
            <div className="text-xs font-medium text-ink mb-2">Chỉ số hiệu suất theo vị trí — {ROLE_META[form.roleType].label}</div>
            <div className="grid grid-cols-4 gap-3">
              {form.roleType === "ads" && (<>
                <label className="text-xs text-muted flex flex-col gap-1">Chi phí Ads (đ)<MoneyInput value={form.adSpend} onChange={(v) => setForm({ ...form, adSpend: v })} /></label>
                <label className="text-xs text-muted flex flex-col gap-1">Doanh thu từ Ads (đ)
                  <MoneyInput value={form.adRevenue} onChange={(v) => setForm({ ...form, adRevenue: v })} />
                  {(() => {
                    const spend = Number(form.adSpend) || 0, rev = Number(form.adRevenue) || 0;
                    if (!spend) return null;
                    const roas = rev / spend;
                    const color = roas >= 3 ? "text-ledger-green" : roas >= 1.5 ? "text-gold" : "text-stamp-red";
                    return <span className={`text-[10px] ktns-mono ${color}`}>= ROAS {roas.toFixed(2)}x (đúng công thức tab Hiệu suất — dưới 1.5x cảnh báo, dưới 3x trung bình)</span>;
                  })()}
                </label>
                <label className="text-xs text-muted flex flex-col gap-1">Chuyển đổi<input type="number" value={form.conversions} onChange={(e) => setForm({ ...form, conversions: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
                <label className="text-xs text-muted flex flex-col gap-1">CTR (%)<input type="number" value={form.ctr} onChange={(e) => setForm({ ...form, ctr: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
                <label className="text-xs text-muted flex flex-col gap-1">
              Tháng không đạt KPI liên tiếp<input type="number" value={form.consecutiveLowKpiMonths} onChange={(e) => setForm({ ...form, consecutiveLowKpiMonths: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" />
              <span className="text-[10px] text-ink-light normal-case">Đếm số tháng LIÊN TỤC không đạt chỉ tiêu (không phải % KPI ở trên) — đạt từ 3 tháng trở lên sẽ tự động bị xếp "CẢNH BÁO NGHỈ VIỆC" ở tab Hiệu suất, bất kể tháng đó thực tế có tốt hay không.</span>
            </label>
              </>)}
              {form.roleType === "sale" && (<>
                <label className="text-xs text-muted flex flex-col gap-1">Chỉ tiêu doanh số (đ)<MoneyInput value={form.salesTarget} onChange={(v) => setForm({ ...form, salesTarget: v })} /></label>
                <label className="text-xs text-muted flex flex-col gap-1">Doanh số đạt (đ)
                  <MoneyInput value={form.salesActual} onChange={(v) => setForm({ ...form, salesActual: v })} />
                  {(() => {
                    const target = Number(form.salesTarget) || 0, actual = Number(form.salesActual) || 0;
                    if (!target) return null;
                    const rate = (actual / target) * 100;
                    const color = rate >= 100 ? "text-ledger-green" : rate >= 70 ? "text-gold" : "text-stamp-red";
                    return <span className={`text-[10px] ktns-mono ${color}`}>= {rate.toFixed(0)}% đạt chỉ tiêu (đúng công thức tab Hiệu suất — dưới 70% cảnh báo, dưới 100% trung bình)</span>;
                  })()}
                </label>
                <label className="text-xs text-muted flex flex-col gap-1">Đơn đã chốt<input type="number" value={form.dealsClosed} onChange={(e) => setForm({ ...form, dealsClosed: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
                <label className="text-xs text-muted flex flex-col gap-1">Lead đã xử lý
                  <input type="number" value={form.leadsHandled} onChange={(e) => setForm({ ...form, leadsHandled: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" />
                  {(() => {
                    const leads = Number(form.leadsHandled) || 0, closed = Number(form.dealsClosed) || 0;
                    if (!leads) return null;
                    const rate = (closed / leads) * 100;
                    return <span className={`text-[10px] ktns-mono ${rate >= 20 ? "text-ledger-green" : "text-stamp-red"}`}>= {rate.toFixed(0)}% tỷ lệ chốt đơn (dưới 20% bị nhắc trong Hiệu suất)</span>;
                  })()}
                </label>
                <label className="text-xs text-muted flex flex-col gap-1">
              Tháng không đạt KPI liên tiếp<input type="number" value={form.consecutiveLowKpiMonths} onChange={(e) => setForm({ ...form, consecutiveLowKpiMonths: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" />
              <span className="text-[10px] text-ink-light normal-case">Đếm số tháng LIÊN TỤC không đạt chỉ tiêu (không phải % KPI ở trên) — đạt từ 3 tháng trở lên sẽ tự động bị xếp "CẢNH BÁO NGHỈ VIỆC" ở tab Hiệu suất, bất kể tháng đó thực tế có tốt hay không.</span>
            </label>
              </>)}
              {form.roleType === "ky_thuat" && (<>
                <label className="text-xs text-muted flex flex-col gap-1">Task được giao<input type="number" value={form.tasksAssigned} onChange={(e) => setForm({ ...form, tasksAssigned: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
                <label className="text-xs text-muted flex flex-col gap-1">Task hoàn thành
                  <input type="number" value={form.tasksCompleted} onChange={(e) => setForm({ ...form, tasksCompleted: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" />
                  {(() => {
                    const assigned = Number(form.tasksAssigned) || 0, done = Number(form.tasksCompleted) || 0;
                    if (!assigned) return null;
                    const rate = (done / assigned) * 100;
                    const color = rate >= 90 ? "text-ledger-green" : rate >= 70 ? "text-gold" : "text-stamp-red";
                    return <span className={`text-[10px] ktns-mono ${color}`}>= {rate.toFixed(0)}% hoàn thành (đúng công thức tab Hiệu suất)</span>;
                  })()}
                </label>
                <label className="text-xs text-muted flex flex-col gap-1">Task đúng hạn<input type="number" value={form.tasksOnTime} onChange={(e) => setForm({ ...form, tasksOnTime: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
                <label className="text-xs text-muted flex flex-col gap-1">Lỗi đã sửa<input type="number" value={form.bugsFixed} onChange={(e) => setForm({ ...form, bugsFixed: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
                <label className="text-xs text-muted flex flex-col gap-1">Giá trị đơn upsale đã chốt (đ)<MoneyInput value={form.upsaleValue} onChange={(v) => setForm({ ...form, upsaleValue: v })} /></label>
              </>)}
              {form.roleType === "khac" && (
                <label className="text-xs text-muted flex flex-col gap-1">Điểm đánh giá (0-100)<input type="number" value={form.customScore} onChange={(e) => setForm({ ...form, customScore: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" /></label>
              )}
            </div>
          </div>

          <button onClick={saveEmp} className="mt-4 bg-ledger-green text-white text-sm px-4 py-2 rounded-md hover:opacity-90">{editingId ? "Cập nhật nhân viên" : "Lưu nhân viên"}</button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {visibleEmployees.map((e) => {
          const months = tenureMonths(e.joined);
          const RoleIcon = ROLE_META[e.roleType]?.icon || UserCog;
          const pay = computePayroll(e, reportYear, reportMonth);
          return (
            <div key={e.id} className="bg-white rounded-lg border border-paper-line p-4 flex flex-col gap-2.5">
              <div className="flex justify-between items-start">
                <div>
                  <EditableName value={e.name} onSave={(v) => updateTextField(e.id, "name", v)} className="font-semibold text-ink text-sm" />
                  <div className="text-xs text-muted">{e.position} · {e.dept}</div>
                </div>
                {e.status === "active" ? <StampBadge text="ĐANG LÀM" gold /> : <StampBadge text={e.resignedDate ? `NGHỈ TỪ ${e.resignedDate.split("-").reverse().join("/")}` : "NGHỈ VIỆC"} muted />}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-[11px] text-ink-light"><RoleIcon size={12} /> {ROLE_META[e.roleType]?.label}</div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${e.contractType === "ctv" ? "bg-gold" : e.contractType === "thu_viec" ? "bg-stamp-red" : "bg-ledger-green"}`} style={{ color: "white" }}>
                  {CONTRACT_META[e.contractType]?.label || "Chính thức"}{e.contractType === "thu_viec" ? ` (${Math.round((e.probationRate || DEFAULT_PROBATION_RATE) * 100)}%)` : ""}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="ktns-mono text-sm text-ink font-semibold">
                  {pay.usesRevenueModel ? fmtVND(pay.mainSalary) : fmtVND(pay.salaryByDays)}
                  <span className="text-muted text-[11px] font-normal"> tạm tính tháng {reportMonth}</span>
                </div>
                {pay.usesRevenueModel ? (
                  <div className={`text-[10px] ${pay.actualDays === 0 ? "text-stamp-red font-medium" : "text-muted"}`}>
                    {pay.actualDays === 0 ? "Chưa chấm công ngày nào — chưa phát sinh lương" : `Theo doanh số — lương cơ bản niêm yết ${fmtVND(e.baseSalary)}/tháng`}
                  </div>
                ) : (
                  <div className="text-[10px] text-muted">{fmtVND(pay.daySalary)}/ngày × {pay.actualDays.toFixed(1)}/{pay.standardDays} ngày công đã chấm</div>
                )}
                <div className="text-[10px] flex items-center gap-1.5">
                  <span className={pay.hasAbsence ? "text-stamp-red" : "text-ledger-green"}>
                    {pay.hasAbsence ? `Mất chuyên cần (có ngày nghỉ)` : `Chuyên cần đủ +${fmtVND(e.attendanceBonus || 0)}`}
                  </span>
                  <span className="text-muted">· thưởng tới {fmtVND(e.bonusTarget)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span className="flex items-center gap-1"><Target size={11} /> KPI thưởng</span>
                  <input type="number" value={e.kpi} onChange={(ev) => updateField(e.id, "kpi", ev.target.value)} className="w-14 border border-paper-line rounded px-1 py-0.5 text-right ktns-mono text-[11px]" />
                </div>
                <KpiBar value={e.kpi} />
                {!pay.usesRevenueModel && <div className="text-[10px] text-muted text-right">= {fmtVND(pay.kpiBonus)} thưởng KPI</div>}
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted"><span className="flex items-center gap-1"><CalendarCheck size={11} /> Công tháng {reportMonth}</span><span className="ktns-mono">{monthlyCongFor(e.attendance, reportYear, reportMonth).toFixed(1)}/{standardWorkDaysFor(reportYear, reportMonth)} ngày</span></div>
              <div className="flex items-center justify-between text-[11px] text-muted"><span>Thâm niên</span><span className="ktns-mono">{tenureLabel(months)}</span></div>

              {(e.phone || e.email || e.bankName) && (
                <div className="flex flex-col gap-0.5 text-[11px] text-muted border-t border-paper-line pt-1.5">
                  {e.phone && <div className="flex items-center gap-1.5"><Phone size={10} /> <span className="ktns-mono">{e.phone}</span></div>}
                  {e.email && <div className="flex items-center gap-1.5"><FileText size={10} /> {e.email}</div>}
                  {e.bankName && <div className="flex items-center gap-1.5"><Landmark size={10} /> {e.bankName} · <span className="ktns-mono">{e.bankAccount}</span></div>}
                  {e.hometown && <div className="flex items-center gap-1.5"><MapPin size={10} /> {e.hometown}{e.dob ? ` · sinh ${e.dob.split("-").reverse().join("/")}` : ""}</div>}
                  {e.idNumber && <div className="flex items-center gap-1.5"><CreditCard size={10} /> CCCD <span className="ktns-mono">{e.idNumber}</span></div>}
                  {e.education && <div className="flex items-center gap-1.5"><ClipboardList size={10} /> {e.education}{e.major ? ` · ${e.major}` : ""}</div>}
                </div>
              )}
              {e.resumeSummary && (
                <div>
                  <button onClick={() => setExpandedResume((p) => ({ ...p, [e.id]: !p[e.id] }))} className="text-[10px] text-ink-light underline">
                    {expandedResume[e.id] ? "Ẩn sơ yếu lý lịch" : "Xem sơ yếu lý lịch"}
                  </button>
                  {expandedResume[e.id] && <p className="text-[11px] text-muted mt-1 bg-paper rounded p-2 leading-relaxed">{e.resumeSummary}</p>}
                </div>
              )}

              <div className="flex gap-1.5 flex-wrap">
                <LinkChip>đã tính vào Bảng lương</LinkChip>
                <LinkChip>chấm công ở tab Chấm công</LinkChip>
                <LinkChip>xem ở Hiệu suất</LinkChip>
              </div>

              <div className="flex gap-3 items-center mt-1">
                <button onClick={() => startEdit(e)} className="text-xs text-ink font-medium flex items-center gap-1 hover:text-ink-light"><Pencil size={11} /> Sửa thông tin</button>
                <button onClick={() => (e.status === "active" ? startResign(e.id) : reactivate(e.id))} className="text-xs text-ink-light underline">{e.status === "active" ? "Đánh dấu nghỉ việc" : "Kích hoạt lại"}</button>
              </div>
            </div>
          );
        })}
      </div>

      {resigningId && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50" onClick={() => setResigningId(null)}>
          <div className="bg-white rounded-lg p-5 w-80 shadow-xl" onClick={(ev) => ev.stopPropagation()}>
            <h3 className="ktns-serif font-semibold text-ink mb-1">Xác nhận nghỉ việc</h3>
            <p className="text-xs text-muted mb-3">Dữ liệu các tháng trước ngày này vẫn giữ nguyên. Từ tháng sau ngày nghỉ, người này tự ẩn khỏi Chấm công/Bảng lương/CRM/Hiệu suất.</p>
            <label className="text-xs text-muted flex flex-col gap-1">Ngày nghỉ việc chính thức
              <input type="date" value={resignDate} onChange={(ev) => setResignDate(ev.target.value)} className="border border-paper-line rounded px-2 py-1.5 text-sm ktns-mono" />
            </label>
            <div className="flex gap-2 mt-4">
              <button onClick={confirmResign} className="bg-stamp-red text-white text-sm px-3 py-1.5 rounded-md hover:opacity-90">Xác nhận nghỉ việc</button>
              <button onClick={() => setResigningId(null)} className="border border-paper-line text-sm px-3 py-1.5 rounded-md text-muted">Huỷ</button>
            </div>
          </div>
        </div>
      )}

      {viewingDoc && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-8" onClick={() => setViewingDoc(null)}>
          <div className="bg-white rounded-lg p-4 max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="ktns-serif font-semibold text-ink text-sm">{viewingDoc.name}</h3>
              <button onClick={() => setViewingDoc(null)} className="text-muted hover:text-ink"><X size={18} /></button>
            </div>
            {viewingDoc.type?.startsWith("image/") ? (
              <img src={viewingDoc.data} alt={viewingDoc.name} className="max-w-full rounded" />
            ) : (
              <a href={viewingDoc.data} download={viewingDoc.name} className="text-sm text-ink-light underline">Tải file {viewingDoc.name}</a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Hiệu suất nhân viên ----------
function HieuSuat({ employees, masterRanking, supportCases }) {
  // Số ca Hỗ trợ khách hàng đã hoàn thành — tính THẬT từ dữ liệu module Hỗ trợ khách hàng, không
  // phải số tự gõ tay như tasksAssigned/tasksCompleted — nối 2 module lại với nhau để đánh giá
  // hiệu suất Kỹ thuật/CSKH phản ánh đúng khối lượng hỗ trợ thật đã xử lý trong kỳ.
  const supportStatsByEmployee = {};
  (supportCases || []).forEach((c) => {
    if (!c.employeeId) return;
    if (!supportStatsByEmployee[c.employeeId]) supportStatsByEmployee[c.employeeId] = { completed: 0, active: 0 };
    if (c.status === "hoan_tat") supportStatsByEmployee[c.employeeId].completed += 1;
    else if (c.status === "dang_ho_tro") supportStatsByEmployee[c.employeeId].active += 1;
  });
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? employees : employees.filter((e) => e.roleType === filter);
  const warnCount = employees.filter((e) => evaluatePerformance(e).status === "canh_bao").length;

  const filters = [{ id: "all", label: "Tất cả" }, ...Object.entries(ROLE_META).map(([id, m]) => ({ id, label: m.label }))];
  const categoryCounts = (masterRanking || []).reduce((acc, r) => { acc[r.category] = (acc[r.category] || 0) + 1; return acc; }, {});

  return (
    <div className="flex flex-col gap-4">
      {masterRanking && masterRanking.length > 0 && (
        <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-xs font-semibold text-ink uppercase flex items-center gap-1.5"><Gauge size={13} /> Xếp hạng tổng hợp — ai chăm, ai lười, ai cần cải thiện</div>
              <div className="text-[11px] text-muted mt-0.5">Gộp Chấm công + Doanh số CRM/Marketing + Giao việc + Hiệu suất thành 1 kết quả chuẩn/người, sắp điểm thấp lên đầu.</div>
            </div>
            <button onClick={() => exportMasterRankingExcel(masterRanking)} className="text-xs bg-ledger-green text-white px-2.5 py-1.5 rounded-md hover:opacity-90 flex items-center gap-1 shrink-0"><FileSpreadsheet size={12} /> Xuất Excel</button>
          </div>
          <div className="px-4 pb-2 flex gap-2 flex-wrap">
            {Object.entries(RANKING_CATEGORY).map(([id, m]) => (
              <span key={id} className={`text-[10px] px-2 py-1 rounded-full font-medium ${m.tone === "gold" ? "bg-gold" : m.tone === "red" ? "bg-stamp-red" : "bg-ink-light"}`} style={{ color: "white" }}>
                {m.label}: {categoryCounts[id] || 0}
              </span>
            ))}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-paper text-left text-xs uppercase text-muted">
                <th className="px-4 py-2">Nhân viên</th>
                <th className="px-4 py-2 text-right">Chuyên cần</th>
                <th className="px-4 py-2 text-right">Điểm thái độ</th>
                <th className="px-4 py-2 text-right">Điểm kết quả</th>
                <th className="px-4 py-2 text-right">Điểm tổng hợp</th>
                <th className="px-4 py-2 text-right">Nhiệm vụ đạt</th>
                <th className="px-4 py-2">Phân loại</th>
              </tr>
            </thead>
            <tbody>
              {masterRanking.map((r) => (
                <tr key={r.emp.id} className={`border-t border-paper-line ${r.category === "cho_thoi_viec" || r.category === "luoi_bieng" ? "ktns-warn-row" : ""}`}>
                  <td className="px-4 py-2">
                    <div className="font-medium">{r.emp.name}</div>
                    <div className="text-[11px] text-muted">{ROLE_META[r.emp.roleType]?.label}</div>
                  </td>
                  <td className="px-4 py-2 text-right ktns-mono text-xs">{Math.round(r.attendanceRate * 100)}%</td>
                  <td className="px-4 py-2 text-right ktns-mono text-xs">{r.disciplineScore}</td>
                  <td className="px-4 py-2 text-right ktns-mono text-xs">{r.outputScore}</td>
                  <td className="px-4 py-2 text-right ktns-mono font-bold text-sm">{r.compositeScore}</td>
                  <td className="px-4 py-2 text-right ktns-mono text-xs">{r.taskStats.total > 0 ? `${r.taskStats.done}/${r.taskStats.total}` : "—"}</td>
                  <td className="px-4 py-2">
                    <span className={`stamp-ring ${RANKING_CATEGORY[r.category].tone === "gold" ? "gold" : RANKING_CATEGORY[r.category].tone === "red" ? "" : "muted"}`}>
                      {RANKING_CATEGORY[r.category].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <p className="px-4 py-2.5 text-[11px] text-muted border-t border-paper-line">* Chưa đủ {MIN_DAYS_FOR_EVALUATION} ngày công trong tháng (và chưa có nhiệm vụ nào ở Giao việc) → xếp "CHƯA ĐỦ DỮ LIỆU", không vội chấm lười biếng. Điểm tổng hợp = 40% chuyên cần/thái độ (đi làm đều, không bị cảnh báo ngồi chơi ở Giao việc) + 60% kết quả công việc (KPI/doanh số + tỷ lệ hoàn thành nhiệm vụ). "Cảnh báo nghỉ việc" chỉ bật khi không đạt KPI 3 tháng liên tiếp hoặc chuyên cần quá thấp kèm nhiều lần cảnh báo — đây là gợi ý dữ liệu để bạn xem xét, quyết định cuối cùng và thủ tục chấm dứt hợp đồng vẫn cần theo đúng luật lao động (xem tab Trợ lý Pháp lý).</p>
        </div>
      )}

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted">
          Thống kê hiệu suất theo từng vị trí — chạy Ads, Sale, Kỹ thuật và các vị trí khác.
          {warnCount > 0 && <span className="text-stamp-red font-medium"> {warnCount} nhân viên đang ở mức cảnh báo, cần nhắc nhở.</span>}
        </p>
        <button onClick={() => exportPerformanceExcel(employees)} className="flex items-center gap-1.5 text-sm bg-ledger-green text-white px-3.5 py-2 rounded-md hover:opacity-90 shrink-0">
          <FileSpreadsheet size={15} /> Xuất Excel chi tiết
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={`ktns-role-pill ${filter === f.id ? "active" : ""}`}>{f.label}</button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-paper-line overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-paper text-left text-xs uppercase text-muted">
              <th className="px-4 py-2.5">Nhân viên</th>
              <th className="px-4 py-2.5">Loại HĐ</th>
              <th className="px-4 py-2.5 text-right">Ngày công</th>
              <th className="px-4 py-2.5 text-right">KPI thưởng</th>
              <th className="px-4 py-2.5">Chỉ số chính</th>
              <th className="px-4 py-2.5">Đánh giá</th>
              <th className="px-4 py-2.5">Nhắc nhở</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => {
              const perf = evaluatePerformance(e);
              const cong = monthlyCong(e.attendance);
              return (
                <tr key={e.id} className="border-t border-paper-line">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{e.name}</div>
                    <div className="text-[11px] text-muted">{e.position} · {ROLE_META[e.roleType]?.label}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted">{CONTRACT_META[e.contractType]?.label || "Chính thức"}</td>
                  <td className="px-4 py-2.5 text-right ktns-mono text-xs">{cong.toFixed(1)}/{standardWorkDays()}</td>
                  <td className="px-4 py-2.5 text-right ktns-mono text-xs">{e.kpi}%</td>
                  <td className="px-4 py-2.5 text-xs text-muted">{perf.metrics.slice(0, 2).map((m) => `${m.label}: ${m.value}`).join(" · ")}</td>
                  <td className="px-4 py-2.5">
                    {perf.status === "tot" && <StampBadge text="TỐT" gold />}
                    {perf.status === "trung_binh" && <StampBadge text="CẢI THIỆN" muted />}
                    {perf.status === "canh_bao" && <StampBadge text="CẢNH BÁO" />}
                    {perf.status === "chua_co_du_lieu" && <StampBadge text="CHƯA CÓ DỮ LIỆU" muted />}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-stamp-red max-w-xs">{perf.reminders.join(" · ") || <span className="text-ledger-green">Không có</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {filtered.map((e) => {
          const perf = evaluatePerformance(e);
          const RoleIcon = ROLE_META[e.roleType]?.icon || UserCog;
          return (
            <div key={e.id} className="bg-white rounded-lg border border-paper-line p-4 flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-ink flex items-center gap-1.5"><RoleIcon size={13} className="text-ink-light" /> {e.name}</div>
                  <div className="text-xs text-muted">{e.position} · {e.dept}</div>
                </div>
                {perf.status === "tot" && <StampBadge text="HIỆU SUẤT TỐT" gold />}
                {perf.status === "trung_binh" && <StampBadge text="CẦN CẢI THIỆN" muted />}
                {perf.status === "canh_bao" && <StampBadge text="CẢNH BÁO" />}
                {perf.status === "chua_co_du_lieu" && <StampBadge text="CHƯA CÓ DỮ LIỆU" muted />}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {perf.metrics.map((m) => (
                  <div key={m.label} className="flex justify-between text-xs">
                    <span className="text-muted">{m.label}</span>
                    <span className="ktns-mono font-medium text-charcoal">{m.value}</span>
                  </div>
                ))}
              </div>

              {(e.roleType === "ky_thuat" || e.roleType === "cskh") && (
                <div className="flex items-center justify-between text-xs bg-paper rounded-md px-2.5 py-1.5">
                  <span className="text-muted flex items-center gap-1"><Headphones size={11} /> Ca Hỗ trợ KH đã xử lý (thật)</span>
                  <span className="ktns-mono font-medium text-charcoal">
                    {supportStatsByEmployee[e.id]?.completed || 0} hoàn tất
                    {supportStatsByEmployee[e.id]?.active > 0 && <span className="text-gold"> · {supportStatsByEmployee[e.id].active} đang xử lý</span>}
                  </span>
                </div>
              )}

              {perf.reminders.length > 0 && (
                <div className="flex flex-col gap-1.5 bg-stamp-red/5 rounded-md p-2.5">
                  {perf.reminders.map((r, i) => (
                    <div key={i} className="ktns-reminder"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> {r}</div>
                  ))}
                </div>
              )}
              {perf.reminders.length === 0 && (
                <div className="text-xs text-ledger-green flex items-center gap-1.5"><CheckCircle2 size={12} /> Không có cảnh báo, đang làm việc hiệu quả.</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Bảng lương ----------
function BangLuong({ payrollRows, totalPayroll, setEmployees, reportYear, reportMonth, setTransactions, payrollPayments, setPayrollPayments, company, kpiTiers, setKpiTiers, payrollApprovals, setPayrollApprovals, midMonthRequests, setMidMonthRequests, employees }) {
  const [showKpiConfig, setShowKpiConfig] = useState(false);
  const addKpiTierRow = (role) => setKpiTiers((prev) => ({ ...prev, [role]: [...prev[role], { minRevenue: 0, pct: 0 }] }));
  const updateKpiTierRow = (role, i, field, value) => setKpiTiers((prev) => ({ ...prev, [role]: prev[role].map((t, idx) => (idx === i ? { ...t, [field]: Number(value) || 0 } : t)) }));
  const removeKpiTierRow = (role, i) => setKpiTiers((prev) => ({ ...prev, [role]: prev[role].filter((_, idx) => idx !== i) }));
  const [expanded, setExpanded] = useState({});
  const toggleExpand = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }));
  const updateAdjustment = (id, field, value) => setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: Number(value) || 0 } : e)));

  const periodKey = `${reportYear}-${reportMonth}`;
  const paymentOf = (employeeId) => payrollPayments.find((p) => p.employeeId === employeeId && p.year === reportYear && p.month === reportMonth);
  const approvalOf = (employeeId) => payrollApprovals.find((a) => a.employeeId === employeeId && a.year === reportYear && a.month === reportMonth);
  // Kế toán duyệt trước — đánh dấu đã rà số liệu đúng, chuyển sang chờ sếp xác nhận.
  const accountantApprove = (r) => {
    setPayrollApprovals((prev) => {
      const existing = approvalOf(r.id);
      if (existing) return prev.map((a) => (a.id === existing.id ? { ...a, status: "cho_sep_xac_nhan", amount: r.net, accountantApprovedAt: nowStamp() } : a));
      return [...prev, { id: Date.now(), employeeId: r.id, year: reportYear, month: reportMonth, amount: r.net, status: "cho_sep_xac_nhan", accountantApprovedAt: nowStamp(), bossApprovedAt: null }];
    });
  };
  const [bossConfirmTarget, setBossConfirmTarget] = useState(null);
  const [bossPassword, setBossPassword] = useState("");
  const [bossConfirmError, setBossConfirmError] = useState("");
  const openBossConfirm = (r) => { setBossConfirmTarget(r); setBossPassword(""); setBossConfirmError(""); };
  const confirmBossApproval = () => {
    if (bossPassword !== (company.directorPassword || DEFAULT_DIRECTOR_PASSWORD)) { setBossConfirmError("Sai mật khẩu giám đốc — không thể xác nhận."); return; }
    const r = bossConfirmTarget;
    setPayrollApprovals((prev) => prev.map((a) => (a.employeeId === r.id && a.year === reportYear && a.month === reportMonth ? { ...a, status: "da_duyet_cho_thanh_toan", bossApprovedAt: nowStamp() } : a)));
    setBossConfirmTarget(null);
  };
  // Đánh dấu "Đã chi trả" giờ ghi THẬT một khoản Chi vào Thu Chi (đúng người, đúng số tiền thực lãnh
  // tháng này) — trước đây nút này chỉ đổi màu chữ trên giao diện, không có giao dịch nào cả.
  // BẮT BUỘC phải qua đủ 2 bước duyệt (Kế toán → Sếp) mới cho phép bấm chi trả thật.
  const togglePaid = (r) => {
    const existing = paymentOf(r.id);
    if (existing) {
      setTransactions((prev) => prev.filter((t) => t.id !== existing.linkedTxId));
      setPayrollPayments((prev) => prev.filter((p) => p.id !== existing.id));
      return;
    }
    const approval = approvalOf(r.id);
    if (!approval || approval.status !== "da_duyet_cho_thanh_toan") return; // chặn cứng — chưa đủ duyệt thì không cho chi
    const txId = Date.now();
    setTransactions((prev) => [...prev, {
      id: txId, date: TODAY.toISOString().slice(0, 10), kind: "chi", category: "Lương nhân viên",
      desc: `Lương thực lãnh tháng ${reportMonth}/${reportYear} — ${r.name}`, amount: r.net,
      partnerName: r.name, partnerTaxCode: "", paymentMethod: "chuyen_khoan",
      invoiceType: "Biên lai / Phiếu thu nội bộ", invoiceNo: "", vatRate: 0,
      attachmentData: "", attachmentName: "", attachmentType: "",
      status: "approved", source: "bangluong", sourceOrderId: r.id,
    }]);
    setPayrollPayments((prev) => [...prev, { id: Date.now() + 1, employeeId: r.id, year: reportYear, month: reportMonth, amount: r.net, linkedTxId: txId }]);
  };
  const paidCount = payrollRows.filter((r) => paymentOf(r.id)).length;
  // Kiểm tra chéo với "lương giữa tháng" — nếu người này ĐÃ được trả 1 phần qua yêu cầu giữa
  // tháng trong CHÍNH kỳ đang xem, phải cảnh báo rõ để kế toán không vô tình trả trùng lần nữa
  // khi chạy lương cuối tháng bình thường.
  const midMonthPaidOf = (employeeId) => (midMonthRequests || [])
    .filter((m) => m.employeeId === employeeId && m.paid && new Date(m.date).getFullYear() === reportYear && new Date(m.date).getMonth() + 1 === reportMonth)
    .reduce((a, m) => a + m.amount, 0);
  const paidTotal = payrollRows.reduce((a, r) => a + (paymentOf(r.id) ? r.net : 0), 0);

  // Yêu cầu lương giữa tháng — cho người nghỉ việc/nghỉ ngang giữa chừng, không cần đợi tới cuối
  // tháng mới được thanh toán. Cũng phải qua đủ 2 bước duyệt (Kế toán → Sếp) mới cho chi thật.
  const blankMidMonthForm = { employeeId: employees[0]?.id || "", amount: "", reason: "Nghỉ việc giữa tháng — thanh toán lương những ngày đã làm", date: TODAY_STR };
  const [midMonthForm, setMidMonthForm] = useState(blankMidMonthForm);
  const [showMidMonthForm, setShowMidMonthForm] = useState(false);
  const addMidMonthRequest = () => {
    if (!midMonthForm.employeeId || !midMonthForm.amount) return;
    setMidMonthRequests((prev) => [...prev, { id: Date.now(), employeeId: Number(midMonthForm.employeeId), amount: Number(midMonthForm.amount), reason: midMonthForm.reason, date: midMonthForm.date, status: "cho_ke_toan_duyet", accountantApprovedAt: null, bossApprovedAt: null, paid: false, linkedTxId: null }]);
    setMidMonthForm(blankMidMonthForm);
    setShowMidMonthForm(false);
  };
  const midMonthAccountantApprove = (id) => setMidMonthRequests((prev) => prev.map((m) => (m.id === id ? { ...m, status: "cho_sep_xac_nhan", accountantApprovedAt: nowStamp() } : m)));
  const [midMonthBossTarget, setMidMonthBossTarget] = useState(null);
  const [midMonthBossPassword, setMidMonthBossPassword] = useState("");
  const [midMonthBossError, setMidMonthBossError] = useState("");
  const confirmMidMonthBossApproval = () => {
    if (midMonthBossPassword !== (company.directorPassword || DEFAULT_DIRECTOR_PASSWORD)) { setMidMonthBossError("Sai mật khẩu giám đốc — không thể xác nhận."); return; }
    setMidMonthRequests((prev) => prev.map((m) => (m.id === midMonthBossTarget.id ? { ...m, status: "da_duyet_cho_thanh_toan", bossApprovedAt: nowStamp() } : m)));
    setMidMonthBossTarget(null);
  };
  const payMidMonthRequest = (m) => {
    if (m.status !== "da_duyet_cho_thanh_toan") return;
    const emp = employees.find((e) => e.id === m.employeeId);
    const txId = Date.now();
    setTransactions((prev) => [...prev, {
      id: txId, date: TODAY_STR, kind: "chi", category: "Lương nhân viên (giữa tháng)",
      desc: `${m.reason} — ${emp?.name || "—"}`, amount: m.amount,
      partnerName: emp?.name || "", partnerTaxCode: "", paymentMethod: "chuyen_khoan",
      invoiceType: "Biên lai / Phiếu thu nội bộ", invoiceNo: "", vatRate: 0,
      attachmentData: "", attachmentName: "", attachmentType: "", status: "approved", source: "bangluong", sourceOrderId: m.id,
    }]);
    setMidMonthRequests((prev) => prev.map((x) => (x.id === m.id ? { ...x, paid: true, linkedTxId: txId } : x)));
  };
  const removeMidMonthRequest = (id) => setMidMonthRequests((prev) => prev.filter((m) => m.id !== id));

  const totalEmployeeIns = payrollRows.reduce((a, r) => a + r.employeeInsurance, 0);
  const totalEmployerIns = payrollRows.reduce((a, r) => a + r.employerInsurance, 0);
  const totalTax = payrollRows.reduce((a, r) => a + r.thueTNCN, 0);
  const totalCompanyCost = payrollRows.reduce((a, r) => a + r.employerTotalCost, 0);
  const totalCommission = payrollRows.reduce((a, r) => a + r.commission + r.compBonus + r.techUpsale, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
        <button onClick={() => setShowKpiConfig((v) => !v)} className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-ink uppercase hover:bg-paper">
          <span className="flex items-center gap-1.5"><Target size={13} /> Cấu hình thưởng KPI theo mốc doanh số (Sale &amp; Marketing) — tự tính vào lương</span>
          <span className="text-[10px] text-ink-light normal-case">{showKpiConfig ? "Thu gọn ▲" : "Mở rộng ▼"}</span>
        </button>
        {showKpiConfig && (
          <div className="px-4 pb-4 border-t border-paper-line pt-3">
            <p className="text-[11px] text-muted mb-3">Doanh số/doanh thu tháng đó được trừ VAT ({KPI_BONUS_VAT_RATE}%) trước, phần còn lại mới so mốc để lấy đúng % thưởng — đạt mốc nào tính đúng % mốc đó (không cộng dồn từng khoảng như hoa hồng lũy tiến). Đây là khoản thưởng THÊM, cộng vào lương chính đã có.</p>
            <div className="grid grid-cols-2 gap-4">
              {["sale", "ads"].map((role) => (
                <div key={role}>
                  <div className="text-[11px] font-semibold text-ink uppercase mb-1.5 flex items-center justify-between">
                    <span>{role === "sale" ? "Sale / Kinh doanh" : "Marketing / Ads"}</span>
                    <button onClick={() => addKpiTierRow(role)} className="text-[10px] bg-ink text-white px-2 py-1 rounded">+ Thêm mốc</button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {kpiTiers[role].map((t, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-[11px] text-muted w-16 shrink-0 mt-2">Đạt mốc</span>
                        <div className="w-32">
                          <MoneyInput value={t.minRevenue} onChange={(v) => updateKpiTierRow(role, i, "minRevenue", v)} className="border border-paper-line rounded px-2 py-1 text-xs ktns-mono w-full" />
                        </div>
                        <span className="text-[11px] text-muted mt-2">đ → thưởng</span>
                        <input type="number" step="0.1" value={t.pct} onChange={(e) => updateKpiTierRow(role, i, "pct", e.target.value)} className="border border-paper-line rounded px-2 py-1 text-xs ktns-mono w-16 mt-0.5" />
                        <span className="text-[11px] text-muted mt-2">%</span>
                        <button onClick={() => removeKpiTierRow(role, i)} className="text-muted hover:text-stamp-red ml-auto mt-1.5"><Trash2 size={12} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-paper-line p-3 text-xs text-muted flex items-start gap-2">
        <Link2 size={13} className="text-ink-light shrink-0 mt-0.5" />
        <span>Bấm "Đánh dấu đã chi trả" cho từng người sẽ tự ghi khoản Chi tương ứng vào tab Thu Chi (đúng tên, đúng số thực lãnh) — <strong className="text-charcoal">{paidCount}/{payrollRows.length}</strong> người đã chi trả tháng {reportMonth}/{reportYear}, tổng {fmtVND(paidTotal)}.</span>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <KpiCard icon={Banknote} label="Tổng thực lãnh (NV nhận)" value={fmtVND(totalPayroll)} tone="down" />
        <KpiCard icon={TrendingUp} label="Tổng hoa hồng & thưởng thêm" value={fmtVND(totalCommission)} tone="up" />
        <KpiCard icon={FileText} label="Thuế TNCN khấu trừ" value={fmtVND(totalTax)} tone="down" />
        <KpiCard icon={Wallet} label="Tổng chi phí nhân sự (DN)" value={fmtVND(totalCompanyCost)} tone="down" sub="Gồm lương + BH doanh nghiệp đóng" />
      </div>

      <div className="bg-white rounded-lg border border-paper-line p-3 text-xs text-muted flex items-start gap-2">
        <Link2 size={13} className="text-ink-light shrink-0 mt-0.5" />
        <span>
          <strong className="text-charcoal">Sale</strong>: dưới {fmtVND(SALE_LOW_THRESHOLD)} hưởng {SALE_LOW_RATE * 100}% lương cứng; từ {fmtVND(SALE_KPI_TARGET)} trở lên hưởng đủ lương + hoa hồng lũy tiến, mỗi mốc 100tr tăng thêm 0,6% không giới hạn.
          <strong className="text-charcoal"> Marketing/Ads</strong>: dưới 140tr hưởng 70% lương cứng; 140–199tr đủ 100% lương; từ 200tr trở lên có hoa hồng 1,6–2,2% + thưởng thêm cố định theo mốc doanh thu.
          <strong className="text-charcoal"> Hỗ trợ kỹ thuật</strong>: tính theo ngày công + hoa hồng 7% trên giá trị đơn upsale tự chốt cho khách hiện hữu.
          <strong className="text-charcoal"> Vị trí khác</strong>: theo ngày công + thưởng KPI thường.
          <strong className="text-charcoal"> Loại hợp đồng</strong>: Chính thức đóng đủ BHXH-BHYT-BHTN + thuế TNCN lũy tiến; Thử việc hưởng % lương thỏa thuận, chưa đóng BHXH; Cộng tác viên không đóng BHXH, khấu trừ thẳng 10% thuế. Bấm mũi tên để xem chi tiết.
        </span>
      </div>

      <div className="flex justify-end">
        <button onClick={() => exportPayrollExcel(payrollRows)} className="flex items-center gap-1.5 text-sm bg-ledger-green text-white px-3.5 py-2 rounded-md hover:opacity-90">
          <FileSpreadsheet size={15} /> Xuất Excel bảng lương chi tiết
        </button>
      </div>

      <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
        <div className="max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-paper text-left text-xs uppercase text-muted">
              <th className="px-4 py-2.5">Nhân viên</th>
              <th className="px-4 py-2.5 text-right">Tổng thu nhập</th>
              <th className="px-4 py-2.5 text-right">BHXH-YT-TN (NV)</th>
              <th className="px-4 py-2.5 text-right">Giảm trừ GC</th>
              <th className="px-4 py-2.5 text-right">Thuế TNCN</th>
              <th className="px-4 py-2.5 text-right">Thực lãnh</th>
              <th className="px-4 py-2.5 text-right">Chi phí DN</th>
              <th className="px-4 py-2.5">Trạng thái</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {payrollRows.map((r) => (
              <React.Fragment key={r.id}>
                <tr className="border-t border-paper-line cursor-pointer hover:bg-paper/50" onClick={() => toggleExpand(r.id)}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-[11px] text-muted">{r.contractLabel} · {ROLE_META[r.roleType]?.label} · {r.dependents || 0} người phụ thuộc · {tenureLabel(r.months)}</div>
                    {r.usesRevenueModel && <div className="text-[10px] text-ink-light mt-0.5">{r.compStatusLabel}</div>}
                    {r.kpiMilestoneBonus > 0 && <div className="text-[10px] text-gold mt-0.5">+ Thưởng KPI mốc doanh số ({r.kpiMilestonePct}% × {fmtVND(r.kpiMilestoneNetRevenue)} sau VAT) = {fmtVND(r.kpiMilestoneBonus)}</div>}
                    {r.contractType === "ctv" && <div className="text-[10px] text-gold mt-0.5">Khấu trừ 10% thuế TNCN, không giảm trừ gia cảnh</div>}
                  </td>
                  <td className="px-4 py-2.5 text-right ktns-mono">{fmtVND(r.grossIncome)}</td>
                  <td className="px-4 py-2.5 text-right ktns-mono text-stamp-red">-{fmtVND(r.employeeInsurance)}</td>
                  <td className="px-4 py-2.5 text-right ktns-mono text-muted">-{fmtVND(r.personalDeduction)}</td>
                  <td className="px-4 py-2.5 text-right ktns-mono text-stamp-red">-{fmtVND(r.thueTNCN)}</td>
                  <td className="px-4 py-2.5 text-right ktns-mono font-semibold text-ink">{fmtVND(r.net)}</td>
                  <td className="px-4 py-2.5 text-right ktns-mono text-muted">{fmtVND(r.employerTotalCost)}</td>
                  <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    {(() => {
                      const paid = paymentOf(r.id);
                      const approval = approvalOf(r.id);
                      const midPaid = midMonthPaidOf(r.id);
                      return (
                        <div className="flex flex-col gap-1 items-end">
                          {paid ? <button onClick={() => togglePaid(r)}><StampBadge text="ĐÃ CHI TRẢ" gold /></button>
                          : approval?.status === "da_duyet_cho_thanh_toan" ? <button onClick={() => togglePaid(r)} className="text-[10px] bg-ledger-green text-white px-2 py-1 rounded flex items-center gap-1"><CheckCircle2 size={10} /> Đã duyệt đủ — Chi trả ngay</button>
                          : approval?.status === "cho_sep_xac_nhan" ? <button onClick={() => openBossConfirm(r)} className="text-[10px] border border-gold text-gold px-2 py-1 rounded flex items-center gap-1"><UserCheck size={10} /> Chờ sếp xác nhận</button>
                          : <button onClick={() => accountantApprove(r)} className="text-[10px] border border-paper-line text-muted px-2 py-1 rounded flex items-center gap-1"><CheckCircle2 size={10} /> Kế toán duyệt</button>}
                          {midPaid > 0 && !paid && (
                            <span className="text-[9px] text-stamp-red flex items-center gap-1" title="Kiểm tra kỹ trước khi chi trả — tránh trả trùng"><AlertTriangle size={9} /> Đã trả {fmtVND(midPaid)} qua yêu cầu giữa tháng!</span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{expanded[r.id] ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</td>
                </tr>
                {expanded[r.id] && (
                  <tr className="border-t border-paper-line bg-paper/40">
                    <td colSpan={9} className="px-4 py-4">
                      <div className="grid grid-cols-4 gap-6">
                        <div>
                          <div className="text-[11px] font-semibold text-ink uppercase mb-1.5">
                            {r.roleType === "sale" ? "Doanh số & hoa hồng (Sale)" : r.roleType === "ads" ? "Doanh thu & thưởng (Marketing)" : r.roleType === "ky_thuat" ? "Công & hoa hồng upsale" : "Cấu thành thu nhập"}
                          </div>
                          <div className="flex flex-col gap-1 text-xs ktns-mono">
                            {r.usesRevenueModel ? (
                              <>
                                <div className="flex justify-between"><span className="text-muted font-sans">Doanh số / Doanh thu</span>{fmtVND(r.revenueUsed)}</div>
                                <div className="flex justify-between"><span className="text-muted font-sans">Hệ số lương ({r.compRate * 100}%)</span>{fmtVND(r.mainSalary)}</div>
                                {r.compBonus > 0 && <div className="flex justify-between"><span className="text-muted font-sans">Thưởng thêm cố định</span>{fmtVND(r.compBonus)}</div>}
                                <div className="flex justify-between"><span className="text-muted font-sans">Hoa hồng {r.roleType === "sale" ? "lũy tiến" : ""}</span>{fmtVND(r.commission)}</div>
                              </>
                            ) : (
                              <>
                                <div className="flex justify-between"><span className="text-muted font-sans">Lương theo ngày công ({r.actualDays}/{r.standardDays})</span>{fmtVND(r.salaryByDays)}</div>
                                {r.roleType === "ky_thuat" ? (
                                  <div className="flex justify-between"><span className="text-muted font-sans">Hoa hồng upsale (7%)</span>{fmtVND(r.techUpsale)}</div>
                                ) : (
                                  <div className="flex justify-between"><span className="text-muted font-sans">Thưởng KPI ({r.kpi}%)</span>{fmtVND(r.kpiBonus)}</div>
                                )}
                              </>
                            )}
                            <div className="flex justify-between"><span className="text-muted font-sans">Phụ cấp thâm niên</span>{fmtVND(r.seniorityAllowance)}</div>
                            <div className="flex justify-between"><span className="text-muted font-sans">Phụ cấp ăn trưa</span>{fmtVND(r.mealAllowance)}</div>
                            <div className="flex justify-between"><span className="text-muted font-sans">Phụ cấp chuyên cần {r.hasAbsence ? "(mất — có ngày nghỉ)" : ""}</span>{fmtVND(r.attendanceBonus)}</div>
                            {r.kpiMilestoneBonus > 0 && <div className="flex justify-between"><span className="text-muted font-sans">Thưởng KPI mốc doanh số ({r.kpiMilestonePct}%)</span>{fmtVND(r.kpiMilestoneBonus)}</div>}
                            <div className="flex justify-between font-semibold border-t border-paper-line pt-1 mt-1"><span className="font-sans">Tổng thu nhập</span>{fmtVND(r.grossIncome)}</div>
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold text-ink uppercase mb-1.5">Bảo hiểm (trên lương {fmtVND(r.baseSalary)})</div>
                          {r.employeeInsurance > 0 || r.employerInsurance > 0 ? (
                            <div className="flex flex-col gap-1 text-xs ktns-mono">
                              <div className="flex justify-between"><span className="text-muted font-sans">BHXH 8% + BHYT 1.5% + BHTN 1% (NV)</span>{fmtVND(r.employeeInsurance)}</div>
                              <div className="flex justify-between"><span className="text-muted font-sans">BHXH 17% + BHYT 3% + BHTN 1% + TNLĐ-BNN 0.5% (DN)</span>{fmtVND(r.employerInsurance)}</div>
                              <div className="flex justify-between font-semibold border-t border-paper-line pt-1 mt-1"><span className="font-sans">Tổng nộp cơ quan BH</span>{fmtVND(r.employeeInsurance + r.employerInsurance)}</div>
                            </div>
                          ) : (
                            <p className="text-xs text-muted font-sans">Không đóng BHXH-BHYT-BHTN — {r.contractType === "ctv" ? "cộng tác viên (hợp đồng dịch vụ, không phải quan hệ lao động)" : "hợp đồng thử việc riêng"}.</p>
                          )}
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold text-ink uppercase mb-1.5">Thuế TNCN &amp; chi phí doanh nghiệp</div>
                          <div className="flex flex-col gap-1 text-xs ktns-mono">
                            {r.contractType === "ctv" ? (
                              <div className="flex justify-between"><span className="text-muted font-sans">Khấu trừ 10% (không giảm trừ gia cảnh)</span>{fmtVND(r.thueTNCN)}</div>
                            ) : (
                              <>
                                <div className="flex justify-between"><span className="text-muted font-sans">Giảm trừ bản thân + {r.dependents || 0} người phụ thuộc</span>{fmtVND(r.personalDeduction)}</div>
                                <div className="flex justify-between"><span className="text-muted font-sans">Thu nhập chịu thuế</span>{fmtVND(r.taxableIncome)}</div>
                                <div className="flex justify-between"><span className="text-muted font-sans">Thuế TNCN (lũy tiến)</span>{fmtVND(r.thueTNCN)}</div>
                              </>
                            )}
                            <div className="flex justify-between font-semibold border-t border-paper-line pt-1 mt-1"><span className="font-sans">Tổng chi phí DN chi trả</span>{fmtVND(r.employerTotalCost)}</div>
                          </div>
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <div className="text-[11px] font-semibold text-ink uppercase mb-1.5">Thưởng khác / Tạm ứng</div>
                          <div className="flex flex-col gap-2 text-xs">
                            <label className="flex flex-col gap-1 text-muted">Thưởng khác (đ)
                              <input type="number" defaultValue={r.otherBonus} onBlur={(ev) => updateAdjustment(r.id, "otherBonus", ev.target.value)} className="border border-paper-line rounded px-2 py-1 ktns-mono text-charcoal" />
                            </label>
                            <label className="flex flex-col gap-1 text-muted">Tạm ứng / Khấu trừ (đ)
                              <input type="number" defaultValue={r.advance} onBlur={(ev) => updateAdjustment(r.id, "advance", ev.target.value)} className="border border-paper-line rounded px-2 py-1 ktns-mono text-charcoal" />
                            </label>
                            <p className="text-[10px] text-muted">Sửa xong bấm ra ngoài ô để cập nhật thực lãnh.</p>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      <div className="bg-white rounded-lg border border-gold/40 overflow-hidden">
        <div className="px-4 py-2.5 bg-gold/5 flex items-center justify-between">
          <span className="text-xs font-semibold text-gold uppercase flex items-center gap-1.5"><Wallet size={13} /> Yêu cầu lương giữa tháng — nghỉ việc/nghỉ ngang, không đợi cuối tháng</span>
          <button onClick={() => { setMidMonthForm(blankMidMonthForm); setShowMidMonthForm(true); }} className="text-xs bg-ink text-white px-2.5 py-1.5 rounded-md hover:bg-ink-light flex items-center gap-1"><Plus size={12} /> Tạo yêu cầu</button>
        </div>
        {showMidMonthForm && (
          <div className="p-4 border-b border-paper-line grid grid-cols-4 gap-2">
            <select value={midMonthForm.employeeId} onChange={(e) => setMidMonthForm({ ...midMonthForm, employeeId: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-xs">
              {employees.map((e) => (<option key={e.id} value={e.id}>{e.name}{e.status === "inactive" ? " — đã nghỉ việc" : ""}</option>))}
            </select>
            <input type="date" value={midMonthForm.date} onChange={(e) => setMidMonthForm({ ...midMonthForm, date: e.target.value })} className="border border-paper-line rounded px-2 py-1.5 text-xs" />
            <MoneyInput value={midMonthForm.amount} onChange={(v) => setMidMonthForm({ ...midMonthForm, amount: v })} placeholder="Số tiền (đ)" />
            <input value={midMonthForm.reason} onChange={(e) => setMidMonthForm({ ...midMonthForm, reason: e.target.value })} placeholder="Lý do" className="border border-paper-line rounded px-2 py-1.5 text-xs col-span-4" />
            <div className="col-span-4 flex gap-2">
              <button onClick={addMidMonthRequest} className="text-xs bg-ledger-green text-white px-3 py-1.5 rounded-md">Gửi yêu cầu</button>
              <button onClick={() => setShowMidMonthForm(false)} className="text-xs border border-paper-line px-3 py-1.5 rounded-md text-muted">Huỷ</button>
            </div>
          </div>
        )}
        <table className="w-full text-sm">
          <thead><tr className="bg-paper text-left text-xs uppercase text-muted"><th className="px-4 py-2">Nhân viên</th><th className="px-4 py-2">Lý do</th><th className="px-4 py-2 text-right">Số tiền</th><th className="px-4 py-2">Ngày</th><th className="px-4 py-2">Trạng thái</th><th className="px-4 py-2"></th></tr></thead>
          <tbody>
            {midMonthRequests.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-xs text-muted">Chưa có yêu cầu lương giữa tháng nào.</td></tr>}
            {midMonthRequests.slice().reverse().map((m) => {
              const emp = employees.find((e) => e.id === m.employeeId);
              const reqYear = new Date(m.date).getFullYear(), reqMonth = new Date(m.date).getMonth() + 1;
              return (
                <tr key={m.id} className="border-t border-paper-line">
                  <td className="px-4 py-2 font-medium">
                    {emp?.name || "—"}
                    {reqYear === reportYear && reqMonth === reportMonth && paymentOf(m.employeeId) && (
                      <div className="text-[9px] text-stamp-red flex items-center gap-1 mt-0.5" title="Kiểm tra kỹ — tránh trả trùng"><AlertTriangle size={9} /> Người này đã có lương thường tháng này rồi!</div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted">{m.reason}</td>
                  <td className="px-4 py-2 text-right ktns-mono">{fmtVND(m.amount)}</td>
                  <td className="px-4 py-2 ktns-mono text-xs text-muted">{m.date}</td>
                  <td className="px-4 py-2">
                    {m.paid ? <StampBadge text="ĐÃ CHI TRẢ" gold /> :
                      m.status === "da_duyet_cho_thanh_toan" ? <button onClick={() => payMidMonthRequest(m)} className="text-[10px] bg-ledger-green text-white px-2 py-1 rounded flex items-center gap-1"><CheckCircle2 size={10} /> Đã duyệt đủ — Chi trả ngay</button> :
                      m.status === "cho_sep_xac_nhan" ? <button onClick={() => { setMidMonthBossTarget(m); setMidMonthBossPassword(""); setMidMonthBossError(""); }} className="text-[10px] border border-gold text-gold px-2 py-1 rounded flex items-center gap-1"><UserCheck size={10} /> Chờ sếp xác nhận</button> :
                      <button onClick={() => midMonthAccountantApprove(m.id)} className="text-[10px] border border-paper-line text-muted px-2 py-1 rounded flex items-center gap-1"><CheckCircle2 size={10} /> Kế toán duyệt</button>}
                  </td>
                  <td className="px-4 py-2 text-right"><button onClick={() => removeMidMonthRequest(m.id)} className="text-muted hover:text-stamp-red"><Trash2 size={13} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">* Mốc doanh số/doanh thu, hệ số lương và hoa hồng lấy đúng theo bảng "Quy định KPI" — chỉnh các hằng số SALE_* và ADS_TIERS trong code nếu công ty đổi chính sách. Thuế TNCN lũy tiến, mức đóng BHXH-BHYT-BHTN có thể thay đổi theo quy định hiện hành — không thay thế tư vấn thuế chính thức.</p>

      {bossConfirmTarget && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-6" onClick={() => setBossConfirmTarget(null)}>
          <div className="bg-white rounded-lg p-5 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="ktns-serif font-semibold text-ink mb-1 flex items-center gap-1.5"><UserCheck size={15} /> Sếp xác nhận chi trả</h3>
            <p className="text-xs text-muted mb-3">Xác nhận chi trả lương <strong className="text-charcoal">{fmtVND(bossConfirmTarget.net)}</strong> cho <strong className="text-charcoal">{bossConfirmTarget.name}</strong> — kỳ {reportMonth}/{reportYear}. Kế toán đã duyệt số liệu, cần đúng mật khẩu giám đốc để xác nhận bước cuối.</p>
            <input type="password" value={bossPassword} onChange={(e) => setBossPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirmBossApproval()} placeholder="Mật khẩu giám đốc" className="w-full border border-paper-line rounded px-3 py-2 text-sm ktns-mono" autoFocus />
            {bossConfirmError && <p className="text-xs text-stamp-red mt-2 flex items-center gap-1"><AlertTriangle size={12} /> {bossConfirmError}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={confirmBossApproval} className="bg-ledger-green text-white text-sm px-3 py-1.5 rounded-md">Xác nhận</button>
              <button onClick={() => setBossConfirmTarget(null)} className="border border-paper-line text-sm px-3 py-1.5 rounded-md text-muted">Huỷ</button>
            </div>
          </div>
        </div>
      )}

      {midMonthBossTarget && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-6" onClick={() => setMidMonthBossTarget(null)}>
          <div className="bg-white rounded-lg p-5 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="ktns-serif font-semibold text-ink mb-1 flex items-center gap-1.5"><UserCheck size={15} /> Sếp xác nhận chi trả giữa tháng</h3>
            <p className="text-xs text-muted mb-3">Xác nhận chi trả <strong className="text-charcoal">{fmtVND(midMonthBossTarget.amount)}</strong> cho <strong className="text-charcoal">{employees.find((e) => e.id === midMonthBossTarget.employeeId)?.name || "—"}</strong> — {midMonthBossTarget.reason}.</p>
            <input type="password" value={midMonthBossPassword} onChange={(e) => setMidMonthBossPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirmMidMonthBossApproval()} placeholder="Mật khẩu giám đốc" className="w-full border border-paper-line rounded px-3 py-2 text-sm ktns-mono" autoFocus />
            {midMonthBossError && <p className="text-xs text-stamp-red mt-2 flex items-center gap-1"><AlertTriangle size={12} /> {midMonthBossError}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={confirmMidMonthBossApproval} className="bg-ledger-green text-white text-sm px-3 py-1.5 rounded-md">Xác nhận</button>
              <button onClick={() => setMidMonthBossTarget(null)} className="border border-paper-line text-sm px-3 py-1.5 rounded-md text-muted">Huỷ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Báo cáo theo Quý ----------
function exportQuarterExcel(monthSnapshots, quarter, year) {
  const wb = XLSX.utils.book_new();
  const rows = monthSnapshots.map((s) => ({
    "Tháng": `Tháng ${s.month}/${s.year}`,
    "Doanh thu": Math.round(s.thu), "Chi phí": Math.round(s.chi),
    "Quỹ lương thực lãnh": Math.round(s.payrollTotal),
    "Lợi nhuận sau lương": Math.round(s.profit),
    "BHXH-BHYT-BHTN (NV)": Math.round(s.employeeInsurance),
    "BHXH-BHYT-BHTN (DN)": Math.round(s.employerInsurance),
    "Thuế TNCN khấu trừ": Math.round(s.taxTotal),
    "Tổng chi phí nhân sự (DN)": Math.round(s.employerCost),
    "Giao dịch thiếu hoá đơn": s.missingInvoices,
  }));
  const totalRow = { "Tháng": `Tổng Quý ${quarter}/${year}` };
  Object.keys(rows[0]).forEach((k) => { if (k !== "Tháng") totalRow[k] = rows.reduce((a, r) => a + (r[k] || 0), 0); });
  rows.push(totalRow);
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = new Array(9).fill({ wch: 20 });
  XLSX.utils.book_append_sheet(wb, ws, `Quý ${quarter}-${year}`);
  XLSX.writeFile(wb, `DOMIX_Bao_cao_Quy${quarter}_${year}.xlsx`);
}

function QuarterReport({ transactions, orders, marketingLogs, employees, reportYear, reportMonth }) {
  const [year, setYear] = useState(reportYear);
  const [quarter, setQuarter] = useState(quarterOf(reportMonth));
  const months = quarterMonths(year, quarter);
  const snapshots = months.map((m) => computeMonthSnapshot(m.year, m.month, { transactions, orders, marketingLogs, employees }));

  const quarterTotal = snapshots.reduce((a, s) => ({
    thu: a.thu + s.thu, chi: a.chi + s.chi, payrollTotal: a.payrollTotal + s.payrollTotal,
    profit: a.profit + s.profit, taxTotal: a.taxTotal + s.taxTotal,
    employeeInsurance: a.employeeInsurance + s.employeeInsurance, employerInsurance: a.employerInsurance + s.employerInsurance,
  }), { thu: 0, chi: 0, payrollTotal: 0, profit: 0, taxTotal: 0, employeeInsurance: 0, employerInsurance: 0 });

  // Thuế TNDN phải tính theo TỔNG DOANH THU CẢ NĂM (không phải theo quý) để chọn đúng mức thuế
  // suất 15%/17%/20% — nên phải tự cộng đủ 12 tháng của đúng năm đang xem, không chỉ 3 tháng của quý.
  const yearSnapshots = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => computeMonthSnapshot(year, m, { transactions, orders, marketingLogs, employees }));
  const annualRevenue = yearSnapshots.reduce((a, s) => a + s.thu, 0);
  const annualProfitAccounting = yearSnapshots.reduce((a, s) => a + s.profit, 0);
  // Chi phí KHÔNG được trừ khi tính thuế TNDN — đã bị trừ vào lợi nhuận kế toán rồi, phải CỘNG
  // NGƯỢC LẠI vào thu nhập chịu thuế (Điều 9-10 Luật Thuế TNDN 2025 + Nghị định 320/2025/NĐ-CP):
  // (1) Chi tiền mặt ≥5 triệu/lần — không có chứng từ thanh toán không dùng tiền mặt.
  // (2) Chi chưa có hoá đơn/chứng từ hợp lệ ("Chưa xác định") — thiếu điều kiện (2) Điều 9 Luật thuế.
  // Đây vẫn CHƯA đầy đủ toàn bộ Điều 10 (còn phạt vi phạm HC, tài trợ sai đối tượng...) — kế toán
  // vẫn cần rà thêm, nhưng đã bắt được 2 nguyên nhân phổ biến nhất gây bị loại chi phí khi thanh tra.
  const yearTx = (transactions || []).filter((t) => new Date(t.date).getFullYear() === year && t.kind === "chi");
  const nonDeductibleCash = yearTx.filter((t) => t.paymentMethod === "tien_mat" && t.amount >= CASH_PAYMENT_DEDUCTIBLE_LIMIT).reduce((a, t) => a + t.amount, 0);
  const nonDeductibleNoInvoice = yearTx.filter((t) => t.invoiceType === "Chưa xác định" && !(t.paymentMethod === "tien_mat" && t.amount >= CASH_PAYMENT_DEDUCTIBLE_LIMIT)).reduce((a, t) => a + t.amount, 0);
  const nonDeductibleTotal = nonDeductibleCash + nonDeductibleNoInvoice;
  const annualProfitBeforeTax = annualProfitAccounting; // lợi nhuận kế toán (chưa điều chỉnh) — vẫn hiện riêng để đối chiếu
  const taxableIncomeTNDN = annualProfitAccounting + nonDeductibleTotal;
  const taxRate = corporateTaxRate(annualRevenue);
  const estimatedTNDN = Math.max(0, taxableIncomeTNDN) * taxRate;
  const profitAfterTNDN = annualProfitAccounting - estimatedTNDN;

  const yearOptions = [2025, 2026, 2027];

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-lg border border-paper-line p-3 text-xs text-muted flex items-start gap-2">
        <Link2 size={13} className="text-ink-light shrink-0 mt-0.5" />
        <span>Mỗi tháng tính riêng theo đúng dữ liệu Thu Chi/CRM/Marketing/Chấm công của tháng đó — xem cạnh nhau theo quý để đối chiếu và kê khai thuế cho dễ.</span>
      </div>

      <div className="bg-white rounded-lg border border-stamp-red/40 p-4">
        <div className="text-xs font-semibold text-stamp-red uppercase mb-1 flex items-center gap-1.5"><AlertTriangle size={13} /> Thuế TNDN dự kiến — Năm {year} (trước đây app CHƯA từng tính khoản này)</div>
        <p className="text-[11px] text-muted mb-3">Tính theo Nghị định 320/2025/NĐ-CP: doanh thu năm ≤3 tỷ → 15%, 3-50 tỷ → 17%, trên 50 tỷ → 20%. Đã tự CỘNG NGƯỢC các khoản chi tiền mặt ≥5 triệu vào thu nhập chịu thuế (vì thuế không cho trừ khoản này) — đây vẫn là ước tính, còn nhiều khoản chi không hợp lý khác theo Điều 10 Luật Thuế TNDN mà app chưa nhận diện được hết, kế toán cần rà lại kỹ trước khi kê khai chính thức.</p>
        <div className="grid grid-cols-4 gap-4 mb-3 pb-3 border-b border-paper-line">
          <div>
            <div className="text-[11px] text-muted uppercase">Lợi nhuận kế toán (đã trừ hết chi phí)</div>
            <div className="ktns-mono text-sm">{fmtVND(annualProfitAccounting)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted uppercase">+ Tiền mặt ≥5tr không được trừ</div>
            <div className="ktns-mono text-sm text-stamp-red">+{fmtVND(nonDeductibleCash)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted uppercase">+ Chi thiếu hoá đơn không được trừ</div>
            <div className="ktns-mono text-sm text-stamp-red">+{fmtVND(nonDeductibleNoInvoice)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted uppercase">= Thu nhập chịu thuế TNDN</div>
            <div className="ktns-mono text-sm font-semibold">{fmtVND(taxableIncomeTNDN)}</div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <div className="text-[11px] text-muted uppercase">Tổng doanh thu cả năm</div>
            <div className="ktns-mono text-base font-semibold">{fmtVND(annualRevenue)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted uppercase">Thuế suất áp dụng</div>
            <div className="ktns-mono text-base font-semibold text-gold">{(taxRate * 100).toFixed(0)}%</div>
          </div>
          <div>
            <div className="text-[11px] text-muted uppercase">Thuế TNDN dự kiến phải nộp</div>
            <div className="ktns-mono text-base font-semibold text-stamp-red">{fmtVND(estimatedTNDN)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted uppercase">Lợi nhuận sau thuế TNDN</div>
            <div className={`ktns-mono text-base font-semibold ${profitAfterTNDN >= 0 ? "text-ledger-green" : "text-stamp-red"}`}>{fmtVND(profitAfterTNDN)}</div>
          </div>
        </div>
      </div>

      {(() => {
        const marginNet = quarterTotal.thu > 0 ? (quarterTotal.profit / quarterTotal.thu) * 100 : 0;
        const payrollRatio = quarterTotal.thu > 0 ? (quarterTotal.payrollTotal / quarterTotal.thu) * 100 : 0;
        const costRatio = quarterTotal.thu > 0 ? (quarterTotal.chi / quarterTotal.thu) * 100 : 0;
        return (
          <div className="bg-white rounded-lg border border-paper-line p-4">
            <div className="text-xs font-semibold text-ink uppercase mb-3">Chỉ số tài chính cơ bản — Quý {quarter}/{year}</div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-[11px] text-muted uppercase">Biên lợi nhuận ròng</div>
                <div className={`ktns-mono text-lg font-semibold ${marginNet >= 0 ? "text-ledger-green" : "text-stamp-red"}`}>{marginNet.toFixed(1)}%</div>
                <div className="text-[10px] text-ink-light">Lợi nhuận / Doanh thu — càng cao càng tốt, dưới 10% cần xem lại chi phí.</div>
              </div>
              <div>
                <div className="text-[11px] text-muted uppercase">Tỷ lệ chi phí lương / doanh thu</div>
                <div className={`ktns-mono text-lg font-semibold ${payrollRatio <= 40 ? "text-ledger-green" : "text-stamp-red"}`}>{payrollRatio.toFixed(1)}%</div>
                <div className="text-[10px] text-ink-light">Thường nên dưới 40% với công ty dịch vụ/thương mại nhỏ.</div>
              </div>
              <div>
                <div className="text-[11px] text-muted uppercase">Tỷ lệ tổng chi phí / doanh thu</div>
                <div className={`ktns-mono text-lg font-semibold ${costRatio <= 80 ? "text-ledger-green" : "text-stamp-red"}`}>{costRatio.toFixed(1)}%</div>
                <div className="text-[10px] text-ink-light">Trên 100% nghĩa là đang lỗ trong quý này.</div>
              </div>
            </div>
            <p className="text-[10px] text-muted mt-3">* Chỉ số tham khảo nhanh, tính trực tiếp từ dữ liệu Thu Chi thật trong quý — không thay thế phân tích tài chính chuyên sâu (ROE, ROA, thanh khoản...) cần đầy đủ Bảng cân đối kế toán mới tính chính xác được.</p>
          </div>
        );
      })()}

      <div className="flex items-center gap-2">
        <select value={quarter} onChange={(e) => setQuarter(Number(e.target.value))} className="border border-paper-line rounded-md px-3 py-2 text-sm">
          {[1, 2, 3, 4].map((q) => (<option key={q} value={q}>Quý {q}</option>))}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="border border-paper-line rounded-md px-3 py-2 text-sm ktns-mono">
          {yearOptions.map((y) => (<option key={y} value={y}>{y}</option>))}
        </select>
        <button onClick={() => exportQuarterExcel(snapshots, quarter, year)} className="flex items-center gap-1.5 text-sm bg-ledger-green text-white px-3.5 py-2 rounded-md hover:opacity-90 ml-auto">
          <FileSpreadsheet size={15} /> Xuất Excel báo cáo quý
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard icon={TrendingUp} label={`Doanh thu Quý ${quarter}`} value={fmtVND(quarterTotal.thu)} tone="up" />
        <KpiCard icon={TrendingDown} label="Chi phí" value={fmtVND(quarterTotal.chi)} tone="down" />
        <KpiCard icon={Banknote} label="Quỹ lương" value={fmtVND(quarterTotal.payrollTotal)} tone="down" />
        <KpiCard icon={Wallet} label="Lợi nhuận sau lương" value={fmtVND(quarterTotal.profit)} tone={quarterTotal.profit >= 0 ? "up" : "down"} />
      </div>

      <div className="bg-white rounded-lg border border-paper-line overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-paper text-left text-xs uppercase text-muted">
              <th className="px-4 py-2.5">Chỉ tiêu</th>
              {snapshots.map((s) => (<th key={s.month} className="px-4 py-2.5 text-right">Tháng {s.month}/{s.year}{s.year === ATT_YEAR && s.month === ATT_MONTH ? " (hiện tại)" : ""}</th>))}
              <th className="px-4 py-2.5 text-right bg-ink text-white">Tổng Quý {quarter}</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Doanh thu", "thu", "text-ledger-green"],
              ["Chi phí", "chi", "text-stamp-red"],
              ["Quỹ lương thực lãnh", "payrollTotal", "text-charcoal"],
              ["Lợi nhuận sau lương", "profit", null],
              ["BHXH-BHYT-BHTN (NV đóng)", "employeeInsurance", "text-muted"],
              ["BHXH-BHYT-BHTN (DN đóng)", "employerInsurance", "text-muted"],
              ["Thuế TNCN khấu trừ", "taxTotal", "text-stamp-red"],
            ].map(([label, key, cls]) => (
              <tr key={key} className="border-t border-paper-line">
                <td className="px-4 py-2 font-medium">{label}</td>
                {snapshots.map((s) => (
                  <td key={s.month} className={`px-4 py-2 text-right ktns-mono ${cls || (s[key] >= 0 ? "text-ledger-green" : "text-stamp-red")}`}>{fmtVND(s[key])}</td>
                ))}
                <td className={`px-4 py-2 text-right ktns-mono font-semibold bg-paper ${cls || (quarterTotal[key] >= 0 ? "text-ledger-green" : "text-stamp-red")}`}>{fmtVND(quarterTotal[key])}</td>
              </tr>
            ))}
            <tr className="border-t border-paper-line">
              <td className="px-4 py-2 font-medium">Giao dịch thiếu hoá đơn</td>
              {snapshots.map((s) => (<td key={s.month} className={`px-4 py-2 text-right ktns-mono ${s.missingInvoices > 0 ? "text-stamp-red" : "text-ledger-green"}`}>{s.missingInvoices}</td>))}
              <td className="px-4 py-2 text-right ktns-mono font-semibold bg-paper">{snapshots.reduce((a, s) => a + s.missingInvoices, 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">* Mỗi tháng tự tính lại từ dữ liệu gốc (Thu Chi, CRM, Marketing, Chấm công) của đúng tháng đó — không cộng dồn nhầm sang tháng khác. Dùng bảng này để đối chiếu khi kê khai thuế GTGT/TNCN theo quý.</p>

      {(() => {
        const qFrom = `${year}-${String((quarter - 1) * 3 + 1).padStart(2, "0")}-01`;
        const qToMonth = quarter * 3;
        const qTo = `${year}-${String(qToMonth).padStart(2, "0")}-31`;
        const inQuarter = transactions.filter((t) => t.date >= qFrom && t.date <= qTo);
        const byAccount = {};
        inQuarter.forEach((t) => {
          const code = t.accountCode || suggestAccountCode(t);
          if (!byAccount[code]) byAccount[code] = { debit: 0, credit: 0 };
          if (t.kind === "thu") byAccount[code].credit += t.amount;
          else byAccount[code].debit += t.amount;
        });
        const rows = Object.entries(byAccount).sort(([a], [b]) => a.localeCompare(b));
        if (rows.length === 0) return null;
        return (
          <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
            <div className="px-4 pt-3 pb-1 text-xs font-semibold text-ink uppercase">Tổng hợp phát sinh theo tài khoản (TK133) — Quý {quarter}/{year}</div>
            <table className="w-full text-sm">
              <thead><tr className="bg-paper text-left text-xs uppercase text-muted"><th className="px-4 py-2">Mã TK</th><th className="px-4 py-2">Tên tài khoản</th><th className="px-4 py-2 text-right">Phát sinh Nợ</th><th className="px-4 py-2 text-right">Phát sinh Có</th></tr></thead>
              <tbody>
                {rows.map(([code, v]) => (
                  <tr key={code} className="border-t border-paper-line">
                    <td className="px-4 py-2 ktns-mono font-medium">{code}</td>
                    <td className="px-4 py-2 text-xs">{TT133_ACCOUNTS[code] || "—"}</td>
                    <td className="px-4 py-2 text-right ktns-mono text-stamp-red">{v.debit > 0 ? fmtVND(v.debit) : "—"}</td>
                    <td className="px-4 py-2 text-right ktns-mono text-ledger-green">{v.credit > 0 ? fmtVND(v.credit) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-2.5 text-[11px] text-muted border-t border-paper-line">* Bảng tổng hợp ĐƠN GIẢN theo mã TK gán trên từng giao dịch Thu Chi — DOMIX chưa hạch toán kép (mỗi giao dịch đủ cả Nợ/Có 2 vế) nên đây KHÔNG phải Bảng cân đối phát sinh chính thức theo TT133, chỉ là căn cứ tham khảo nhanh trước khi kế toán nhập vào phần mềm kế toán chính thức.</p>
          </div>
        );
      })()}
    </div>
  );
}

// ---------- Hoạch định ngân sách & nhân sự ----------
const BUDGET_CATEGORIES = [
  { key: "nhansu", label: "Nhân sự (lương + BHXH-BHYT-BHTN)", defaultPct: 28 },
  { key: "marketing", label: "Marketing / Ads", defaultPct: 15 },
  { key: "van_hanh", label: "Vận hành (thuê mặt bằng, văn phòng phẩm, nhiên liệu, đi lại)", defaultPct: 8 },
  { key: "nvl", label: "Nguyên vật liệu / Giá vốn hàng bán", defaultPct: 20 },
  { key: "du_phong", label: "Dự phòng rủi ro", defaultPct: 5 },
  { key: "loi_nhuan", label: "Lợi nhuận mục tiêu giữ lại", defaultPct: 24 },
];

function roleEfficiency(group) {
  if (!group || group.revenue <= 0) return { ratio: null, label: "Bộ phận hỗ trợ — đánh giá qua Hiệu suất/Giao việc, không có doanh thu trực tiếp để so sánh", tone: "muted" };
  const ratio = group.revenue / group.cost;
  if (ratio >= 3) return { ratio, label: "Hiệu quả cao — cân nhắc tuyển thêm để mở rộng", tone: "gold" };
  if (ratio >= 1.5) return { ratio, label: "Ổn định — giữ nguyên quy mô", tone: "muted" };
  return { ratio, label: "Hiệu quả thấp — cân nhắc tối ưu chi phí hoặc cơ cấu lại vị trí", tone: "red" };
}

function HoachDinhNganSach({ prevSnapshot, prevPeriod, roleGroupStats, company }) {
  const [pcts, setPcts] = useState(Object.fromEntries(BUDGET_CATEGORIES.map((c) => [c.key, c.defaultPct])));
  const [targetRevenue, setTargetRevenue] = useState(Math.round(prevSnapshot.thu));
  const totalPct = Object.values(pcts).reduce((a, b) => a + (Number(b) || 0), 0);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const printRef = useRef(null);
  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);

  const roleRows = Object.entries(ROLE_META).map(([id, meta]) => ({ id, meta, group: roleGroupStats[id], eff: roleEfficiency(roleGroupStats[id]) })).filter((r) => r.group);

  const handlePrint = (docText) => { if (printRef.current) printRef.current.innerText = docText; window.print(); };
  const handleDownload = (docText, i) => downloadTextFile(docText, `${company.name.replace(/\s+/g, "_")}_KeHoach_NganSach_${i}_${TODAY.toISOString().slice(0, 10)}.txt`);

  const generatePlan = async () => {
    setLoading(true);
    const roleSummary = roleRows.map((r) => `${r.meta.label}: chi phí ${fmtVND(r.group.cost)}, doanh thu đóng góp ${r.group.revenue > 0 ? fmtVND(r.group.revenue) : "không trực tiếp"}, ${r.group.headcount} người — ${r.eff.label}`).join("\n");
    const allocationSummary = BUDGET_CATEGORIES.map((c) => `${c.label}: ${pcts[c.key]}% (${fmtVND(targetRevenue * (pcts[c.key] || 0) / 100)})`).join("\n");

    const prompt = `Phân tích tình hình tháng ${prevPeriod.month}/${prevPeriod.year} của ${company.name} và đề xuất phân bổ ngân sách + nhân sự cho tháng tới.

Số liệu tháng ${prevPeriod.month}/${prevPeriod.year}:
- Doanh thu: ${fmtVND(prevSnapshot.thu)}
- Chi phí: ${fmtVND(prevSnapshot.chi)}
- Quỹ lương thực lãnh: ${fmtVND(prevSnapshot.payrollTotal)}
- Tổng chi phí nhân sự (gồm BH doanh nghiệp đóng): ${fmtVND(prevSnapshot.employerCost)}
- Lợi nhuận sau lương: ${fmtVND(prevSnapshot.profit)}

Hiệu quả từng nhóm vị trí:
${roleSummary}

Doanh thu mục tiêu tháng tới: ${fmtVND(targetRevenue)}
Đề xuất phân bổ ngân sách theo % (đã điều chỉnh thủ công, tổng ${totalPct}%):
${allocationSummary}

Hãy soạn một bản "Kế hoạch phân bổ ngân sách & nhân sự tháng tới" đầy đủ gồm:
1. Tóm tắt tình hình tháng trước (doanh thu, lợi nhuận, hiệu quả chi phí).
2. Đề xuất phân bổ ngân sách theo từng hạng mục (dùng đúng số % và số tiền đã cho ở trên, giải thích ngắn vì sao hợp lý hoặc nên điều chỉnh gì).
3. Đề xuất nhân sự cụ thể: vị trí nào nên tuyển thêm, vị trí nào nên tối ưu/cắt giảm hoặc đào tạo lại, dựa trên hiệu quả chi phí/doanh thu từng nhóm ở trên.
4. Đánh giá yếu tố thị trường & sản phẩm có thể ảnh hưởng tới doanh thu tháng tới (mùa vụ, cạnh tranh, xu hướng ngành — nêu giả định hợp lý vì không có dữ liệu thị trường thực tế).
5. Rủi ro cần lưu ý và khuyến nghị theo dõi.
Đặt toàn bộ trong khối \`\`\`document, có tiêu đề, đánh số mục I/II/III, ngày lập, chỗ ký duyệt. Cuối văn bản ghi chú: "Đây là đề xuất tham khảo dựa trên dữ liệu nội bộ, không thay thế tư vấn tài chính chuyên nghiệp — cần đối chiếu thêm dữ liệu thị trường thực tế trước khi quyết định."`;

    const newMessages = [...messages, { role: "user", text: `Tạo kế hoạch phân bổ ngân sách & nhân sự cho tháng tới (dựa trên tháng ${prevPeriod.month}/${prevPeriod.year})` }];
    setMessages(newMessages);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: `Bạn là chuyên gia tài chính - vận hành cho ${company.name}, một doanh nghiệp vừa và nhỏ tại Việt Nam. Trả lời bằng tiếng Việt, chuyên nghiệp, dựa sát vào số liệu được cung cấp, không bịa số. Khi soạn kế hoạch/báo cáo, đặt toàn bộ trong khối \`\`\`document như hướng dẫn.`,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      const raw = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n") || "";
      const { clean, document, truncated } = parseLegalDocument(raw);
      setMessages((prev) => [...prev, { role: "assistant", text: clean || "Đã tạo xong kế hoạch bên dưới.", document, truncated }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", text: "Đã có lỗi khi tạo đề xuất. Vui lòng thử lại." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div ref={printRef} className="ktns-print-area"></div>
      <div className="bg-white rounded-lg border border-paper-line p-3 text-xs text-muted flex items-start gap-2">
        <Link2 size={13} className="text-ink-light shrink-0 mt-0.5" />
        <span>Dựa trên số liệu thật tháng {prevPeriod.month}/{prevPeriod.year}, đề xuất phân bổ ngân sách và nhân sự hợp lý cho tháng tới — chỉnh % nếu công ty có tỷ lệ ngân sách riêng.</span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard icon={TrendingUp} label={`Doanh thu T${prevPeriod.month}/${prevPeriod.year}`} value={fmtVND(prevSnapshot.thu)} tone="up" />
        <KpiCard icon={Wallet} label="Lợi nhuận sau lương" value={fmtVND(prevSnapshot.profit)} tone={prevSnapshot.profit >= 0 ? "up" : "down"} />
        <KpiCard icon={Banknote} label="Tổng chi phí nhân sự" value={fmtVND(prevSnapshot.employerCost)} tone="down" />
        <KpiCard icon={PieChart} label="Tỷ trọng chi phí NS/Doanh thu" value={prevSnapshot.thu > 0 ? `${Math.round((prevSnapshot.employerCost / prevSnapshot.thu) * 100)}%` : "—"} tone={prevSnapshot.thu > 0 && prevSnapshot.employerCost / prevSnapshot.thu > 0.35 ? "down" : "up"} />
      </div>

      <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
        <div className="px-4 pt-3 pb-1 text-xs font-semibold text-ink uppercase flex items-center gap-1.5"><Gauge size={13} /> Hiệu quả chi phí từng nhóm vị trí (tháng {prevPeriod.month}/{prevPeriod.year})</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-paper text-left text-xs uppercase text-muted">
              <th className="px-4 py-2">Nhóm vị trí</th>
              <th className="px-4 py-2 text-right">Số người</th>
              <th className="px-4 py-2 text-right">Chi phí</th>
              <th className="px-4 py-2 text-right">Doanh thu đóng góp</th>
              <th className="px-4 py-2 text-right">Tỷ lệ</th>
              <th className="px-4 py-2">Đề xuất</th>
            </tr>
          </thead>
          <tbody>
            {roleRows.map((r) => (
              <tr key={r.id} className="border-t border-paper-line">
                <td className="px-4 py-2 font-medium">{r.meta.label}</td>
                <td className="px-4 py-2 text-right ktns-mono">{r.group.headcount}</td>
                <td className="px-4 py-2 text-right ktns-mono text-stamp-red">{fmtVND(r.group.cost)}</td>
                <td className="px-4 py-2 text-right ktns-mono text-ledger-green">{r.group.revenue > 0 ? fmtVND(r.group.revenue) : "—"}</td>
                <td className="px-4 py-2 text-right ktns-mono font-semibold">{r.eff.ratio !== null ? `${r.eff.ratio.toFixed(2)}x` : "—"}</td>
                <td className="px-4 py-2 text-xs">
                  <span className={`stamp-ring ${r.eff.tone === "gold" ? "gold" : r.eff.tone === "muted" ? "muted" : ""}`}>{r.eff.label.split(" — ")[0]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-2.5 text-[11px] text-muted border-t border-paper-line">* Tỷ lệ = doanh thu đóng góp / chi phí nhóm. ≥3x: hiệu quả cao, nên cân nhắc mở rộng. 1.5-3x: ổn định. Dưới 1.5x: cần tối ưu. Kỹ thuật/vị trí khác không có doanh thu trực tiếp nên đánh giá qua tab Hiệu suất/Giao việc thay vì tỷ lệ này.</p>
      </div>

      <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs font-semibold text-ink uppercase flex items-center gap-1.5"><PieChart size={13} /> Đề xuất phân bổ ngân sách tháng tới</div>
          <label className="text-xs text-muted flex items-center gap-2">Doanh thu mục tiêu
            <MoneyInput value={targetRevenue} onChange={(v) => setTargetRevenue(Number(v) || 0)} className="border border-paper-line rounded px-2 py-1 text-xs ktns-mono w-36" />
          </label>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-paper text-left text-xs uppercase text-muted">
              <th className="px-4 py-2">Hạng mục</th>
              <th className="px-4 py-2 text-right">Tỷ trọng (%)</th>
              <th className="px-4 py-2 text-right">Số tiền đề xuất</th>
            </tr>
          </thead>
          <tbody>
            {BUDGET_CATEGORIES.map((c) => (
              <tr key={c.key} className="border-t border-paper-line">
                <td className="px-4 py-2">{c.label}</td>
                <td className="px-4 py-2 text-right">
                  <input type="number" value={pcts[c.key]} onChange={(e) => setPcts({ ...pcts, [c.key]: Number(e.target.value) || 0 })} className="border border-paper-line rounded px-2 py-1 text-xs ktns-mono w-16 text-right" />
                </td>
                <td className="px-4 py-2 text-right ktns-mono font-medium">{fmtVND(targetRevenue * (pcts[c.key] || 0) / 100)}</td>
              </tr>
            ))}
            <tr className="border-t border-paper-line bg-paper">
              <td className="px-4 py-2 font-semibold">Tổng</td>
              <td className={`px-4 py-2 text-right ktns-mono font-semibold ${totalPct === 100 ? "text-ledger-green" : "text-stamp-red"}`}>{totalPct}%</td>
              <td className="px-4 py-2 text-right ktns-mono font-semibold">{fmtVND(targetRevenue)}</td>
            </tr>
          </tbody>
        </table>
        {totalPct !== 100 && <p className="px-4 py-2 text-[11px] text-stamp-red border-t border-paper-line flex items-center gap-1"><AlertTriangle size={11} /> Tổng tỷ trọng chưa đủ 100% — điều chỉnh lại cho cân đối.</p>}
      </div>

      <div className="bg-white rounded-lg border border-paper-line flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-paper-line flex items-center justify-between">
          <div className="text-xs font-semibold text-ink uppercase flex items-center gap-1.5"><Sparkles size={13} /> AI phân tích thị trường & đề xuất chi tiết</div>
          <button onClick={generatePlan} disabled={loading} className="text-xs bg-ink text-white px-3 py-1.5 rounded-md hover:bg-ink-light disabled:opacity-50 flex items-center gap-1.5">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Tạo kế hoạch đề xuất
          </button>
        </div>
        {messages.length === 0 && !loading && (
          <div className="px-4 py-6 text-center text-xs text-muted">Bấm "Tạo kế hoạch đề xuất" để AI phân tích số liệu ở trên và soạn báo cáo đầy đủ, có thể in/tải file.</div>
        )}
        {messages.length > 0 && (
          <div ref={scrollRef} className="max-h-[500px] overflow-y-auto ktns-scrollbar p-4 flex flex-col gap-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[90%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-ink text-white" : "bg-paper text-charcoal border border-paper-line"}`}>
                  {m.text}
                  {m.document && (
                    <div className="mt-3 bg-white border border-paper-line rounded-md overflow-hidden">
                      <div className="px-3 py-2 bg-paper border-b border-paper-line flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wide text-ink-light font-semibold flex items-center gap-1.5"><FileText size={11} /> Kế hoạch đề xuất</span>
                        <div className="flex gap-1.5">
                          <button onClick={() => handlePrint(m.document)} className="text-[10px] bg-ink text-white px-2.5 py-1 rounded flex items-center gap-1 hover:bg-ink-light"><Printer size={11} /> In / Lưu PDF</button>
                          <button onClick={() => handleDownload(m.document, i)} className="text-[10px] border border-paper-line text-ink px-2.5 py-1 rounded flex items-center gap-1 hover:border-gold"><Download size={11} /> Tải .txt</button>
                        </div>
                      </div>
                      <div className="px-4 py-3 max-h-96 overflow-y-auto ktns-scrollbar">
                        <pre className="ktns-serif text-xs whitespace-pre-wrap text-charcoal leading-relaxed">{m.document}</pre>
                      </div>
                      {m.truncated && <div className="px-3 py-2 bg-stamp-red/5 border-t border-paper-line text-[10px] text-stamp-red flex items-center gap-1"><AlertTriangle size={11} /> Nội dung có thể bị cắt do quá dài.</div>}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && <div className="flex justify-start"><div className="bg-paper border border-paper-line rounded-lg px-4 py-2.5 text-sm flex items-center gap-2 text-muted"><Loader2 size={14} className="animate-spin" /> Đang phân tích...</div></div>}
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted">* Tỷ lệ ngân sách mặc định (28% nhân sự, 15% marketing...) là mốc tham khảo phổ biến cho SME dịch vụ tại Việt Nam, không phải chuẩn bắt buộc — điều chỉnh theo đặc thù ngành của công ty bạn. Đề xuất của AI dựa trên số liệu nội bộ, không thay thế tư vấn tài chính chuyên nghiệp.</p>
    </div>
  );
}

// ---------- Tuyển dụng AI — duyệt CV ----------
function parseCvVerdict(text) {
  const match = text.match(/```verdict\s*([\s\S]*?)```/);
  if (!match) return { clean: text, verdict: null };
  const clean = text.replace(match[0], "").trim();
  try {
    const obj = JSON.parse(match[1].trim());
    return { clean, verdict: obj };
  } catch (err) {
    return { clean, verdict: null };
  }
}

function TuyenDungAI({ cvReviews, setCvReviews, employees, masterRanking, company, queue, setQueue, processing, setProcessing, progress, setProgress, setPrefillEmployee, setTab, setShowEmpForm }) {
  const [candidateName, setCandidateName] = useState("");
  const [position, setPosition] = useState("sale");
  const [cvText, setCvText] = useState("");
  const [cvImage, setCvImage] = useState(null); // { data, name, type }
  const [err, setErr] = useState("");
  const [expandedReviewId, setExpandedReviewId] = useState(null);
  // queue/processing/progress giờ đến từ App (props) — không mất khi chuyển tab qua lại nữa,
  // trước đây các state này nằm cục bộ trong component nên bị xoá sạch mỗi lần rời tab.

  const handleCvFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCvImage({ data: reader.result, name: file.name, type: file.type });
    reader.readAsDataURL(file);
  };

  const headcountInRole = employees.filter((e) => e.roleType === position).length;
  // Những người đang yếu ở đúng vị trí này (từ Xếp hạng tổng hợp) — dùng để gợi ý phương án thay thế.
  const weakInRole = (masterRanking || []).filter((r) => r.emp.roleType === position && ["luoi_bieng", "can_cai_thien", "cho_thoi_viec"].includes(r.category));

  const addToQueue = () => {
    if (!candidateName || (!cvText && !cvImage)) { setErr("Cần nhập tên ứng viên và CV (dán nội dung hoặc tải ảnh)."); return; }
    setErr("");
    setQueue((prev) => [...prev, { id: Date.now(), candidateName, position, cvText, cvImage, status: "pending" }]);
    setCandidateName(""); setCvText(""); setCvImage(null);
  };
  const removeFromQueue = (id) => setQueue((prev) => prev.filter((q) => q.id !== id));

  // Tách riêng để gọi cho từng ứng viên trong hàng chờ — xử lý TUẦN TỰ (không gửi 10 yêu cầu cùng
  // lúc) để tránh quá tải, nhưng bạn chỉ cần bấm 1 lần rồi để nó tự chạy hết, không phải chờ canh từng người.
  const analyzeOne = async (candidate) => {
    const wkInRole = (masterRanking || []).filter((r) => r.emp.roleType === candidate.position && ["luoi_bieng", "can_cai_thien", "cho_thoi_viec"].includes(r.category));
    const weakSummary = wkInRole.length > 0
      ? wkInRole.map((r) => `${r.emp.name} (điểm tổng hợp ${r.compositeScore}, phân loại: ${RANKING_CATEGORY[r.category].label})`).join("; ")
      : "không có ai đang yếu ở vị trí này theo dữ liệu Xếp hạng tổng hợp";
    const hcInRole = employees.filter((e) => e.roleType === candidate.position).length;

    const systemPrompt = `Bạn là chuyên gia tuyển dụng (HR) cho ${company.name}, đang giúp sàng lọc CV ứng viên vị trí "${ROLE_META[candidate.position]?.label}". Đánh giá khách quan dựa TRÊN KỸ NĂNG, KINH NGHIỆM, MỨC ĐỘ PHÙ HỢP VỚI VỊ TRÍ — tuyệt đối không đánh giá dựa trên tuổi tác, giới tính, ngoại hình, nơi sinh, tình trạng hôn nhân hay các yếu tố không liên quan đến năng lực công việc.

Bối cảnh thực tế của công ty (dùng để cân nhắc mức độ cần thiết, KHÔNG bịa thêm số liệu ngoài đây):
- Vị trí "${ROLE_META[candidate.position]?.label}" hiện có ${hcInRole} người đang làm.
- Nhân sự đang yếu ở vị trí này (theo dữ liệu Xếp hạng tổng hợp thật của công ty): ${weakSummary}.

Nhiệm vụ:
1. Đọc CV (ảnh hoặc text được cung cấp), đánh giá chất lượng, kinh nghiệm, kỹ năng, mức độ phù hợp với vị trí "${ROLE_META[candidate.position]?.label}".
2. Đưa ra quyết định: "accept" (nên nhận), "reject" (không nên nhận), hoặc "consider" (cân nhắc thêm/phỏng vấn kỹ hơn).
3. Nếu "accept": giải thích lý do — có thể vì vị trí đang thiếu người, hoặc vì đây là vị trí quan trọng, hoặc vì ứng viên xuất sắc dù đã đủ người.
4. Nếu công ty đã đủ người NHƯNG có người đang yếu (danh sách trên), hãy gợi ý phương án: có thể cân nhắc dùng ứng viên này để THAY THẾ người yếu đó (nêu rõ tên), thay vì tuyển thêm.
5. Trả lời bằng tiếng Việt, 2-4 đoạn ngắn phân tích rõ ràng, chuyên nghiệp.
6. Sau phần phân tích, thêm CHÍNH XÁC một khối \`\`\`verdict chứa JSON (không thêm chữ nào khác trong khối):
{"recommendation":"accept"|"reject"|"consider","importance":"mô tả ngắn tầm quan trọng/mức độ cần thiết của vị trí này lúc này","replaceSuggestion":"tên nhân viên nên cân nhắc thay thế nếu có, hoặc null nếu không có"}

Lưu ý: đây là công cụ HỖ TRỢ sàng lọc ban đầu, quyết định tuyển dụng cuối cùng vẫn cần người phụ trách tuyển dụng phỏng vấn trực tiếp và quyết định.`;

    // PDF phải gửi bằng khối "document", KHÔNG phải "image" — trước đây gửi nhầm loại nên AI
    // không đọc được nếu ứng viên nộp CV dạng PDF (rất phổ biến), dẫn đến lỗi/không có kết quả.
    const isPdf = candidate.cvImage?.type === "application/pdf";
    const cvBlock = candidate.cvImage
      ? (isPdf
          ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: candidate.cvImage.data.split(",")[1] } }
          : { type: "image", source: { type: "base64", media_type: candidate.cvImage.type, data: candidate.cvImage.data.split(",")[1] } })
      : null;
    const userContent = cvBlock
      ? [cvBlock, { type: "text", text: `Đây là CV của ứng viên ${candidate.candidateName}. Hãy phân tích theo hướng dẫn.${candidate.cvText ? " Ghi chú thêm: " + candidate.cvText : ""}` }]
      : [{ type: "text", text: `CV của ứng viên ${candidate.candidateName}:\n\n${candidate.cvText}\n\nHãy phân tích theo hướng dẫn.` }];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1500, system: systemPrompt, messages: [{ role: "user", content: userContent }] }),
    });
    const data = await response.json();
    const raw = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n") || "";
    const { clean, verdict } = parseCvVerdict(raw);
    return {
      id: Date.now() + Math.random(), date: TODAY_STR, candidateName: candidate.candidateName, position: candidate.position,
      cvImageName: candidate.cvImage?.name || "", analysis: clean, verdict,
    };
  };

  const processQueue = async () => {
    const pending = queue.filter((q) => q.status === "pending" || q.status === "error");
    if (pending.length === 0) return;
    setProcessing(true);
    setProgress({ done: 0, total: pending.length });
    for (let i = 0; i < pending.length; i++) {
      const item = pending[i];
      setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "processing" } : q)));
      try {
        const review = await analyzeOne(item);
        setCvReviews((prev) => [...prev, review]);
        setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "done" } : q)));
      } catch (e2) {
        // Vẫn ghi vào lịch sử kèm lý do lỗi thật, thay vì chỉ báo "—" không rõ nguyên nhân.
        setCvReviews((prev) => [...prev, {
          id: Date.now() + Math.random(), date: TODAY_STR, candidateName: item.candidateName, position: item.position,
          cvImageName: item.cvImage?.name || "", analysis: `Không phân tích được CV này — lỗi kỹ thuật: ${e2?.message || "không rõ nguyên nhân"}. Thử xoá và duyệt lại, hoặc nếu là file PDF quá nặng/quét ảnh thì thử chụp lại từng trang dạng ảnh (jpg/png) rồi tải lên lại.`, verdict: null,
        }]);
        setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: "error" } : q)));
      }
      setProgress({ done: i + 1, total: pending.length });
    }
    setProcessing(false);
    setTimeout(() => setQueue((prev) => prev.filter((q) => q.status !== "done")), 3000);
  };

  const VERDICT_META = {
    accept: { label: "NÊN NHẬN", tone: "gold" },
    reject: { label: "KHÔNG NÊN NHẬN", tone: "red" },
    consider: { label: "CÂN NHẮC THÊM", tone: "muted" },
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-lg border border-paper-line p-3 text-xs text-muted flex items-start gap-2">
        <Link2 size={13} className="text-ink-light shrink-0 mt-0.5" />
        <span>AI đọc CV, đánh giá phù hợp với vị trí ứng tuyển, và đối chiếu với dữ liệu thật của công ty (đang thiếu người ở vị trí đó không, có ai đang yếu cần thay thế không — lấy từ tab Hiệu suất). Đây là công cụ hỗ trợ sàng lọc ban đầu, quyết định cuối cùng vẫn cần phỏng vấn trực tiếp.</span>
      </div>

      <div className="bg-white rounded-lg border border-paper-line p-5">
        <h3 className="ktns-serif font-semibold text-ink mb-4">Duyệt CV ứng viên mới</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-muted flex flex-col gap-1">Tên ứng viên<input value={candidateName} onChange={(e) => setCandidateName(e.target.value)} placeholder="Nguyễn Văn A" className="border border-paper-line rounded px-2 py-1.5 text-sm" /></label>
          <label className="text-xs text-muted flex flex-col gap-1">Vị trí ứng tuyển
            <select value={position} onChange={(e) => setPosition(e.target.value)} className="border border-paper-line rounded px-2 py-1.5 text-sm">
              {Object.entries(ROLE_META).map(([id, m]) => (<option key={id} value={id}>{m.label}</option>))}
            </select>
          </label>
        </div>
        <div className="mt-2 text-[11px] text-ink-light bg-paper rounded px-2.5 py-2">
          Vị trí này hiện có <strong className="text-charcoal">{headcountInRole} người</strong>.
          {weakInRole.length > 0 ? <> Đang có <strong className="text-stamp-red">{weakInRole.length} người</strong> ở vị trí này bị xếp hạng yếu (xem chi tiết ở tab Hiệu suất) — AI sẽ cân nhắc gợi ý thay thế nếu phù hợp.</> : " Chưa có ai ở vị trí này bị xếp hạng yếu theo dữ liệu hiện tại."}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <label className="text-xs text-muted flex flex-col gap-1">Tải ảnh/PDF CV
            <input type="file" accept="image/*,.pdf" onChange={handleCvFile} className="border border-paper-line rounded px-2 py-1.5 text-sm bg-white" />
            {cvImage && <span className="text-[11px] text-ledger-green flex items-center gap-1 mt-1"><CheckCircle2 size={11} /> {cvImage.name}</span>}
          </label>
          <label className="text-xs text-muted flex flex-col gap-1">Hoặc dán nội dung CV / ghi chú thêm
            <textarea value={cvText} onChange={(e) => setCvText(e.target.value)} rows={2} placeholder="Dán tóm tắt kinh nghiệm, kỹ năng... nếu không có ảnh CV" className="border border-paper-line rounded px-2 py-1.5 text-sm resize-none" />
          </label>
        </div>
        {err && <p className="text-xs text-stamp-red mt-2 flex items-center gap-1"><AlertTriangle size={12} /> {err}</p>}
        <button onClick={addToQueue} className="mt-4 border border-ink text-ink text-sm px-4 py-2 rounded-md hover:bg-paper flex items-center gap-1.5">
          <Plus size={14} /> Thêm vào hàng chờ
        </button>
        <p className="text-[11px] text-muted mt-1.5">Nhiều ứng viên (VD 10 người) thì thêm hết vào hàng chờ trước, rồi bấm "Xử lý hàng chờ" 1 lần — AI chạy tuần tự tự động, không cần đợi từng người một, bạn có thể làm việc khác trong lúc chờ.</p>
      </div>

      {queue.length > 0 && (
        <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <div className="text-xs font-semibold text-ink uppercase">Hàng chờ xử lý ({queue.length} ứng viên)</div>
            <button onClick={processQueue} disabled={processing} className="text-xs bg-ink text-white px-3 py-1.5 rounded-md hover:bg-ink-light disabled:opacity-50 flex items-center gap-1.5">
              {processing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {processing ? `Đang xử lý ${progress.done}/${progress.total}...` : "Xử lý hàng chờ"}
            </button>
          </div>
          {processing && (
            <div className="px-4 pb-2">
              <div className="w-full bg-paper rounded-full h-1.5 overflow-hidden">
                <div className="bg-ink h-full transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
            </div>
          )}
          <table className="w-full text-sm">
            <thead><tr className="bg-paper text-left text-xs uppercase text-muted"><th className="px-4 py-2">Ứng viên</th><th className="px-4 py-2">Vị trí</th><th className="px-4 py-2">Trạng thái</th><th className="px-4 py-2"></th></tr></thead>
            <tbody>
              {queue.map((q) => (
                <tr key={q.id} className="border-t border-paper-line">
                  <td className="px-4 py-2 font-medium">{q.candidateName}</td>
                  <td className="px-4 py-2 text-xs">{ROLE_META[q.position]?.label}</td>
                  <td className="px-4 py-2 text-xs">
                    {q.status === "pending" && <span className="text-muted">⏳ Chờ xử lý</span>}
                    {q.status === "processing" && <span className="text-ink-light flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Đang phân tích...</span>}
                    {q.status === "done" && <span className="text-ledger-green">✓ Xong</span>}
                    {q.status === "error" && <span className="text-stamp-red">✗ Lỗi — thử lại</span>}
                  </td>
                  <td className="px-4 py-2 text-right">{q.status === "pending" && <button onClick={() => removeFromQueue(q.id)} className="text-muted hover:text-stamp-red"><Trash2 size={14} /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cvReviews.length > 0 && (
        <div className="bg-white rounded-lg border border-paper-line overflow-hidden">
          <div className="px-4 pt-3 pb-1 text-xs font-semibold text-ink uppercase">Lịch sử duyệt CV — bấm vào 1 dòng để xem đầy đủ lý do</div>
          <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-paper text-left text-xs uppercase text-muted">
                <th className="px-4 py-2">Ngày</th><th className="px-4 py-2">Ứng viên</th><th className="px-4 py-2">Vị trí</th><th className="px-4 py-2">Kết quả</th><th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {cvReviews.slice().reverse().map((r) => (
                <React.Fragment key={r.id}>
                  <tr className="border-t border-paper-line cursor-pointer hover:bg-paper/50" onClick={() => setExpandedReviewId((cur) => (cur === r.id ? null : r.id))}>
                    <td className="px-4 py-2 ktns-mono text-xs text-muted">{r.date}</td>
                    <td className="px-4 py-2 font-medium">{r.candidateName}</td>
                    <td className="px-4 py-2 text-xs">{ROLE_META[r.position]?.label}</td>
                    <td className="px-4 py-2">{r.verdict ? <StampBadge text={VERDICT_META[r.verdict.recommendation]?.label || "CÂN NHẮC"} gold={VERDICT_META[r.verdict.recommendation]?.tone === "gold"} muted={VERDICT_META[r.verdict.recommendation]?.tone === "muted"} /> : <span className="text-xs text-muted">— (không đọc được kết quả AI, xem chi tiết)</span>}</td>
                    <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}><button onClick={() => setCvReviews((prev) => prev.filter((x) => x.id !== r.id))} className="text-muted hover:text-stamp-red"><Trash2 size={14} /></button></td>
                  </tr>
                  {expandedReviewId === r.id && (
                    <tr className="border-t border-paper-line bg-paper/40">
                      <td colSpan={5} className="px-4 py-4">
                        <p className="text-sm text-charcoal whitespace-pre-wrap leading-relaxed">{r.analysis || "(Không có nội dung phân tích — có thể do lỗi kết nối lúc xử lý, thử xoá dòng này và duyệt lại CV.)"}</p>
                        {r.verdict?.importance && (
                          <div className="mt-3 bg-white border border-paper-line rounded-md p-3 text-xs">
                            <span className="font-semibold text-ink">Mức độ cần thiết: </span><span className="text-charcoal">{r.verdict.importance}</span>
                          </div>
                        )}
                        {r.verdict?.replaceSuggestion && r.verdict.replaceSuggestion !== "null" && (
                          <div className="mt-2 bg-gold/10 border border-gold rounded-md p-3 text-xs flex items-start gap-2">
                            <AlertTriangle size={13} className="text-gold shrink-0 mt-0.5" />
                            <span><strong className="text-charcoal">Gợi ý phương án thay thế:</strong> cân nhắc dùng ứng viên này thay cho <strong className="text-charcoal">{r.verdict.replaceSuggestion}</strong> thay vì tuyển thêm — quyết định cuối cùng cần trao đổi trực tiếp với người liên quan trước.</span>
                          </div>
                        )}
                        {r.cvImageName && <p className="text-[11px] text-muted mt-2">File CV gốc: {r.cvImageName}</p>}
                        {(r.verdict?.recommendation === "accept" || r.verdict?.recommendation === "consider") && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPrefillEmployee({ name: r.candidateName, roleType: r.position });
                              setShowEmpForm(true);
                              setTab("nhansu");
                            }}
                            className="mt-3 text-xs bg-ledger-green text-white px-3 py-1.5 rounded-md hover:opacity-90 flex items-center gap-1.5"
                          ><UserPlus size={13} /> Tuyển ngay — tạo hồ sơ Nhân sự (điền sẵn tên + vị trí)</button>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
      <p className="text-[11px] text-muted">* AI chỉ đánh giá dựa trên kỹ năng/kinh nghiệm/mức độ phù hợp công việc, không dựa trên các yếu tố cá nhân không liên quan. Đây là công cụ sàng lọc hỗ trợ — không thay thế phỏng vấn và quyết định cuối cùng của người phụ trách tuyển dụng.</p>
    </div>
  );
}

// ---------- Trợ lý AI kế toán ----------
const TX_CATEGORIES = ["Bán hàng", "Dịch vụ", "Nguyên vật liệu", "Văn phòng phẩm", "Thuê mặt bằng", "Marketing", "Tạm ứng nhân viên", "Đi lại/Công tác phí", "Khác"];

function TroLyAI({ totals, transactions, setTransactions, orders, employees, payrollRows, totalPayroll, totalEmployerCost }) {
  const missingTx = transactions.filter((t) => t.invoiceType === "Chưa xác định");
  const pendingOrders = (orders || []).filter((o) => o.invoiceStatus !== "issued");
  const activeEmp = employees.filter((e) => e.status === "active");
  const warnList = activeEmp.filter((e) => evaluatePerformance(e).status === "canh_bao").map((e) => e.name).join(", ") || "không có";

  const [messages, setMessages] = useState([
    { role: "assistant", text: `Chào bạn, tôi là trợ lý AI kế toán của DOMIX. Hiện có ${missingTx.length} giao dịch thiếu loại hóa đơn, ${pendingOrders.length} đơn CRM chưa xuất hoá đơn, quỹ lương tháng này là ${fmtVND(totalPayroll)} và ${warnList !== "không có" ? `các nhân viên cần cảnh báo hiệu suất: ${warnList}` : "không có nhân viên nào cần cảnh báo hiệu suất"}. Bạn có thể hỏi tôi, hoặc gửi ảnh hóa đơn/biên lai/đề nghị tạm ứng để tôi đọc và đề xuất thêm vào Thu Chi.` },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);

  const perfSummary = activeEmp.map((e) => {
    const perf = evaluatePerformance(e);
    return `${e.name} (${ROLE_META[e.roleType]?.label}): ${perf.status === "tot" ? "tốt" : perf.status === "trung_binh" ? "cần cải thiện" : "cảnh báo"}${perf.reminders.length ? " - " + perf.reminders.join("; ") : ""}`;
  }).join("\n");

  const contextSummary = `
Dữ liệu công ty DOMIX hiện tại (dùng để trả lời, đừng liệt kê lại toàn bộ trừ khi được hỏi):
- Tổng thu tháng: ${fmtVND(totals.thu)} | Tổng chi: ${fmtVND(totals.chi)} | Lợi nhuận sau lương: ${fmtVND(totals.profit - totalEmployerCost)}
- Giao dịch Thu Chi thiếu loại hóa đơn (${missingTx.length}): ${missingTx.map((t) => `${t.desc} (${fmtVND(t.amount)})`).join(", ") || "không có"}
- Đơn CRM chưa xuất hoá đơn (${pendingOrders.length}): ${pendingOrders.map((o) => `${o.customerName} (${fmtVND(o.amount)})`).join(", ") || "không có"}
- Tổng quỹ lương thực lãnh: ${fmtVND(totalPayroll)} cho ${payrollRows.length} nhân viên
- Hiệu suất từng nhân viên theo vị trí (ads/sale/kỹ thuật/khác):
${perfSummary}
- Danh mục thu chi hợp lệ: ${TX_CATEGORIES.join(", ")}
- Loại hóa đơn hợp lệ: ${INVOICE_TYPES.join(", ")}
- Nhân sự nhập lương/thưởng/KPI/ngày công/thâm niên/chỉ số vận hành → Bảng lương và Hiệu suất tự tính, không cần nhập lại.
`;

  const EXTRACTION_INSTRUCTIONS = `
Khi người dùng gửi ẢNH hóa đơn/biên lai/đề nghị tạm ứng, hoặc file CSV/txt liệt kê giao dịch, hoặc yêu cầu "tạo hóa đơn"/"ứng tiền" cho MỘT giao dịch cụ thể:
1. Trả lời ngắn gọn 1-2 câu tóm tắt bạn đọc được gì.
2. Sau đó thêm CHÍNH XÁC một khối \`\`\`json ở cuối câu trả lời với object duy nhất (không thêm chữ nào trong khối này ngoài JSON hợp lệ):
{"kind":"thu"|"chi","desc":"mô tả ngắn","amount":số tiền VNĐ dạng số nguyên,"category":"một trong danh mục hợp lệ ở trên","invoiceType":"một trong loại hóa đơn hợp lệ ở trên, chọn 'Chưa xác định' nếu không rõ"}
Nếu là đề nghị tạm ứng của nhân viên, dùng category "Tạm ứng nhân viên" và kind "chi".
Nếu ảnh/file không phải hóa đơn/giao dịch tài chính, hoặc không đủ thông tin số tiền, KHÔNG thêm khối JSON, chỉ trả lời bình thường.

Khi được yêu cầu SOẠN một văn bản/báo cáo kế toán hoàn chỉnh (báo cáo thu chi, báo cáo tài chính tóm tắt, phiếu thu, phiếu chi, bảng kê chi tiết, biên bản đối chiếu công nợ, giải trình số liệu...):
1. Trả lời 1-2 câu giới thiệu ngắn gọn.
2. Đặt TOÀN BỘ nội dung văn bản trong một khối \`\`\`document ... \`\`\` duy nhất, đúng thể thức văn bản kế toán Việt Nam (tiêu đề viết hoa, có ngày lập, bảng số liệu trình bày rõ ràng bằng văn bản, chỗ ký tên người lập/kế toán trưởng/giám đốc nếu phù hợp), dùng đúng số liệu thật lấy từ dữ liệu công ty ở trên.
3. KHÔNG dùng khối \`\`\`json khi đã dùng khối \`\`\`document trong cùng một câu trả lời — chỉ chọn một loại phù hợp với yêu cầu.

Khi người dùng hỏi "đề xuất loại hóa đơn cho các giao dịch còn thiếu", liệt kê từng giao dịch/đơn kèm loại hóa đơn gợi ý bằng lời văn, KHÔNG cần khối \`\`\`json hay \`\`\`document (vì có nhiều mục, người dùng sẽ tự cập nhật ở tab Thu Chi/CRM).
`;

  function parseAction(text) {
    let clean = text;
    let action = null;
    let document = null;
    let truncated = false;
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      clean = clean.replace(jsonMatch[0], "").trim();
      try {
        const obj = JSON.parse(jsonMatch[1].trim());
        if (obj && obj.desc && obj.amount) action = obj;
      } catch (err) { /* JSON không hợp lệ, bỏ qua */ }
    }
    const docMatch = text.match(/```document\s*([\s\S]*?)```/);
    if (docMatch) {
      document = docMatch[1].trim();
      clean = clean.replace(docMatch[0], "").trim();
    } else {
      const openMatch = text.match(/```document\s*([\s\S]*)$/);
      if (openMatch) { document = openMatch[1].trim(); clean = clean.slice(0, openMatch.index).trim(); truncated = true; }
    }
    return { clean, action, document, truncated };
  }

  const sendMessage = async (displayText, apiContent) => {
    if (loading) return;
    const userMsg = { role: "user", text: displayText, apiContent };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2500,
          system: `Bạn là trợ lý AI kế toán cho DOMIX, phần mềm kế toán - nhân sự - lương - hiệu suất của doanh nghiệp nhỏ tại Việt Nam. Trả lời ngắn gọn, thực tế, bằng tiếng Việt, dùng thuật ngữ kế toán/vận hành Việt Nam (hóa đơn GTGT, BHXH, thuế TNCN, KPI, ROAS, CTR, tỷ lệ chốt...). Khi liên quan, tham chiếu dữ liệu công ty dưới đây.\n${contextSummary}\n${EXTRACTION_INSTRUCTIONS}`,
          messages: newMessages.map((m) => ({ role: m.role, content: m.apiContent || m.text })),
        }),
      });
      const data = await response.json();
      const raw = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n") || "Xin lỗi, tôi chưa thể trả lời ngay lúc này.";
      const { clean, action, document, truncated } = parseAction(raw);
      setMessages((prev) => [...prev, { role: "assistant", text: clean, action, document, truncated }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", text: "Đã có lỗi khi kết nối trợ lý AI. Vui lòng thử lại." }]);
    } finally {
      setLoading(false);
    }
  };

  const send = () => { if (!input.trim()) return; sendMessage(input, undefined); };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.type.startsWith("image/")) {
        const base64 = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result.split(",")[1]);
          r.onerror = reject;
          r.readAsDataURL(file);
        });
        await sendMessage(`📎 Đã gửi ảnh: ${file.name}`, [
          { type: "image", source: { type: "base64", media_type: file.type, data: base64 } },
          { type: "text", text: "Đây là ảnh hóa đơn/biên lai/đề nghị tạm ứng — đọc và trích xuất theo đúng định dạng đã hướng dẫn." },
        ]);
      } else {
        const text = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = reject;
          r.readAsText(file);
        });
        await sendMessage(`📎 Đã gửi file: ${file.name}`, [
          { type: "text", text: `Nội dung file "${file.name}":\n${String(text).slice(0, 6000)}\n\nĐọc và trích xuất theo đúng định dạng đã hướng dẫn.` },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", text: "Không đọc được file này. Thử lại với ảnh (jpg/png) hoặc file .csv/.txt." }]);
    }
  };

  const printRef = useRef(null);
  const handlePrint = (docText) => { if (printRef.current) printRef.current.innerText = docText; window.print(); };
  const handleDownload = (docText, i) => downloadTextFile(docText, `DOMIX_KeToan_${i}_${TODAY.toISOString().slice(0, 10)}.txt`);

  const applyAction = (msgIndex, action) => {
    setTransactions((prev) => [...prev, {
      id: Date.now(), date: TODAY.toISOString().slice(0, 10), kind: action.kind === "thu" ? "thu" : "chi",
      category: action.category || "Khác", desc: action.desc, amount: Number(action.amount) || 0,
      invoiceType: INVOICE_TYPES.includes(action.invoiceType) ? action.invoiceType : "Chưa xác định",
      invoiceNo: "", status: "pending",
    }]);
    setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, actionApplied: true } : m)));
  };

  const suggestions = [
    "Soạn báo cáo thu chi tháng này",
    "Nhân viên nào đang cảnh báo hiệu suất, cần nhắc nhở gì?",
    "Đề xuất loại hóa đơn cho các giao dịch và đơn CRM còn thiếu",
    "So sánh hiệu quả Ads và Sale tháng này",
  ];

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-180px)]">
      <div ref={printRef} className="ktns-print-area"></div>
      <div className="bg-white rounded-lg border border-paper-line flex-1 flex flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto ktns-scrollbar p-5 flex flex-col gap-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-ink text-white" : "bg-paper text-charcoal border border-paper-line"}`}>
                {m.role === "assistant" && <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gold mb-1 font-semibold"><Bot size={11} /> Trợ lý AI · DOMIX</div>}
                {m.text}
                {m.action && (
                  <div className="mt-2.5 bg-white border border-paper-line rounded-md p-2.5 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-ink-light font-semibold"><Sparkles size={11} /> Đề xuất giao dịch</div>
                    <div className="text-xs ktns-mono text-charcoal">{m.action.kind === "thu" ? "Thu" : "Chi"} · {m.action.category} · {fmtVND(m.action.amount)}</div>
                    <div className="text-xs text-muted">{m.action.desc} — loại hóa đơn: {m.action.invoiceType}</div>
                    {m.actionApplied ? (
                      <div className="text-xs text-ledger-green flex items-center gap-1.5 mt-1"><CheckCircle2 size={12} /> Đã thêm vào Thu Chi</div>
                    ) : (
                      <button onClick={() => applyAction(i, m.action)} className="mt-1 self-start text-xs bg-ledger-green text-white px-3 py-1.5 rounded-md hover:opacity-90 flex items-center gap-1.5">
                        <Plus size={12} /> Thêm vào Thu Chi
                      </button>
                    )}
                  </div>
                )}
                {m.document && (
                  <div className="mt-3 bg-white border border-paper-line rounded-md overflow-hidden">
                    <div className="px-3 py-2 bg-paper border-b border-paper-line flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wide text-ink-light font-semibold flex items-center gap-1.5"><FileText size={11} /> Văn bản/báo cáo đã soạn</span>
                      <div className="flex gap-1.5">
                        <button onClick={() => handlePrint(m.document)} className="text-[10px] bg-ink text-white px-2.5 py-1 rounded flex items-center gap-1 hover:bg-ink-light"><Printer size={11} /> In / Lưu PDF</button>
                        <button onClick={() => handleDownload(m.document, i)} className="text-[10px] border border-paper-line text-ink px-2.5 py-1 rounded flex items-center gap-1 hover:border-gold"><Download size={11} /> Tải .txt</button>
                      </div>
                    </div>
                    <div className="px-4 py-3 max-h-80 overflow-y-auto ktns-scrollbar">
                      <pre className="ktns-serif text-xs whitespace-pre-wrap text-charcoal leading-relaxed">{m.document}</pre>
                    </div>
                    {m.truncated && (
                      <div className="px-3 py-2 bg-stamp-red/5 border-t border-paper-line text-[10px] text-stamp-red flex items-center gap-1">
                        <AlertTriangle size={11} /> Nội dung có thể bị cắt do quá dài — hỏi lại "soạn tiếp phần còn lại" nếu thiếu.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && <div className="flex justify-start"><div className="bg-paper border border-paper-line rounded-lg px-4 py-2.5 text-sm flex items-center gap-2 text-muted"><Loader2 size={14} className="animate-spin" /> Đang soạn câu trả lời...</div></div>}
        </div>
        <div className="border-t border-paper-line p-3 flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">{suggestions.map((s) => (<button key={s} onClick={() => setInput(s)} className="text-xs px-2.5 py-1 rounded-full border border-paper-line text-muted hover:border-gold hover:text-ink">{s}</button>))}</div>
          <div className="flex gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,.csv,.txt,text/csv,text/plain" className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} disabled={loading} title="Gửi ảnh hóa đơn/biên lai hoặc file CSV" className="px-3 border border-paper-line rounded-md text-muted hover:text-ink hover:border-gold disabled:opacity-50"><Paperclip size={16} /></button>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Hỏi trợ lý AI, hoặc bấm 📎 để gửi ảnh hóa đơn..." className="flex-1 border border-paper-line rounded-md px-3 py-2 text-sm" />
            <button onClick={send} disabled={loading} className="bg-ink text-white px-4 rounded-md flex items-center gap-1.5 text-sm hover:bg-ink-light disabled:opacity-50"><Send size={14} /> Gửi</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Trợ lý Pháp lý ----------

function downloadTextFile(text, filename) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function parseLegalDocument(text) {
  let clean = text;
  let document = null;
  let advance = null;
  let truncated = false;
  const docMatch = text.match(/```document\s*([\s\S]*?)```/);
  if (docMatch) {
    document = docMatch[1].trim();
    clean = clean.replace(docMatch[0], "").trim();
  } else {
    // Bị cắt giữa chừng (hết token) trước khi đóng khối — vẫn lấy phần đã có để hiện khung + nút xuất file.
    const openMatch = text.match(/```document\s*([\s\S]*)$/);
    if (openMatch) {
      document = openMatch[1].trim();
      clean = clean.slice(0, openMatch.index).trim();
      truncated = true;
    }
  }
  const advMatch = text.match(/```advance\s*([\s\S]*?)```/);
  if (advMatch) {
    clean = clean.replace(advMatch[0], "").trim();
    try {
      const obj = JSON.parse(advMatch[1].trim());
      if (obj && obj.employeeName && obj.amount) advance = obj;
    } catch (err) { /* JSON không hợp lệ, bỏ qua */ }
  }
  return { clean, document, advance, truncated };
}

function TroLyPhapLy({ employees, setEmployees, company }) {
  const [messages, setMessages] = useState([
    { role: "assistant", text: `Chào bạn, tôi là trợ lý AI pháp lý của DOMIX. Tôi có thể soạn mọi loại hợp đồng (lao động, dịch vụ, mua bán, thuê mặt bằng, hợp tác kinh doanh, bảo mật...), nội quy, thủ tục hồ sơ, kế hoạch kinh doanh, và xử lý đơn ứng lương — ghi thẳng vào Bảng lương nếu bạn xác nhận. Văn bản soạn ra có thể in trực tiếp hoặc tải về. Lưu ý: đây là bản dự thảo tham khảo, nên có luật sư rà soát trước khi dùng chính thức.` },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const printRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);

  const employeeNames = employees.map((e) => e.name).join(", ");
  const companyInfoText = `${company.name}${company.address ? " — " + company.address : ""}${company.phone ? " — SĐT " + company.phone : ""}${company.taxCode ? " — MST " + company.taxCode : ""}${company.representative ? " — Người đại diện: " + company.representative : ""}`;

  const LEGAL_SYSTEM_PROMPT = `Bạn là trợ lý AI đa năng cho ${company.name}, phụ trách toàn bộ hợp đồng, thủ tục hồ sơ, kế hoạch kinh doanh và ứng lương của công ty, theo pháp luật Việt Nam hiện hành (Bộ luật Lao động 2019, Luật Doanh nghiệp, Luật BHXH, Bộ luật Dân sự về hợp đồng...). Trả lời bằng tiếng Việt, văn phong hành chính - pháp lý chuẩn mực, rõ ràng.

Phạm vi hỗ trợ:
- Hợp đồng nhân sự nội bộ: lao động chính thức, thử việc, cộng tác viên/freelancer, biên bản thanh lý HĐLĐ, quyết định chấm dứt HĐLĐ, đơn xin nghỉ việc, quy chế lương thưởng/phụ cấp, nội quy lao động.
- Hợp đồng kinh doanh & đối tác: dịch vụ, mua bán hàng hóa, thuê mặt bằng/văn phòng, hợp tác kinh doanh, đại lý/phân phối, biên bản thanh lý hợp đồng mua bán.
- Pháp lý chung: thỏa thuận bảo mật (NDA), điều khoản không cạnh tranh, thủ tục hồ sơ, đơn từ, quy chế nội bộ khác.
- Kế hoạch kinh doanh (business plan): khi được yêu cầu, soạn đầy đủ các phần thường có — Tóm tắt, Mục tiêu, Phân tích thị trường/SWOT, Kế hoạch vận hành, Kế hoạch tài chính sơ bộ, Rủi ro và giải pháp.
- Đơn xin ứng lương cho nhân viên.

Thông tin công ty để dùng khi soạn văn bản: ${companyInfoText}.
Danh sách nhân viên hiện có: ${employeeNames || "chưa có dữ liệu"}.

Khi được yêu cầu SOẠN một văn bản/hợp đồng/đơn/nội quy/kế hoạch kinh doanh hoàn chỉnh:
1. Trả lời 1-2 câu giới thiệu ngắn gọn.
2. Đặt TOÀN BỘ nội dung văn bản trong một khối \`\`\`document ... \`\`\` duy nhất, đúng thể thức hành chính/hợp đồng Việt Nam (tiêu đề viết hoa, đánh số Điều 1, Điều 2... với hợp đồng/nội quy; đánh số mục I, II... với kế hoạch kinh doanh, để chỗ trống ký tên nếu là hợp đồng/đơn).
3. Cuối văn bản luôn thêm dòng: "Ghi chú: Đây là bản dự thảo tham khảo do AI soạn, cần được luật sư/chuyên viên pháp chế/kế toán trưởng rà soát trước khi dùng chính thức."

Khi được yêu cầu xử lý ỨNG LƯƠNG cho một nhân viên cụ thể (có tên trong danh sách trên) với số tiền rõ ràng:
1. Soạn "Đơn xin ứng lương" hoàn chỉnh trong khối \`\`\`document như trên.
2. Thêm một khối \`\`\`advance ... \`\`\` chứa JSON: {"employeeName":"tên đúng như trong danh sách nhân viên","amount":số tiền,"reason":"lý do ngắn gọn"}. Chỉ thêm khối này khi số tiền và tên nhân viên đã rõ ràng, cụ thể.

Khi chỉ tư vấn/giải thích luật (không soạn văn bản), trả lời bình thường, KHÔNG dùng khối \`\`\`document hay \`\`\`advance.
Khi tư vấn điều khoản có lợi cho công ty, vẫn phải nêu cân bằng: điều khoản đó có lợi thế nào cho công ty và rủi ro/nghĩa vụ đi kèm là gì, không chỉ nói một chiều.

QUY TẮC SOẠN HỢP ĐỒNG LAO ĐỘNG NỘI BỘ NGHIÊNG VỀ CÔNG TY (mặc định áp dụng trừ khi người dùng yêu cầu khác):
Trong mọi khoảng linh hoạt mà luật cho phép, LUÔN chọn mức có lợi nhất cho công ty (bên sử dụng lao động), ví dụ:
- Thời gian thử việc: lấy mức tối đa theo Điều 25 BLLĐ 2019 (180 ngày cho vị trí quản lý điều hành theo Luật Doanh nghiệp; 60 ngày cho công việc cần trình độ cao đẳng trở lên; 30 ngày cho trung cấp/công nhân kỹ thuật/nhân viên nghiệp vụ; 6 ngày cho công việc khác).
- Lương thử việc: lấy đúng mức sàn tối thiểu 85% lương chính thức (Điều 26).
- Thời hạn báo trước khi người lao động đơn phương chấm dứt hợp đồng: lấy mức dài nhất được phép (45 ngày với HĐLĐ không xác định thời hạn, 30 ngày với HĐLĐ xác định thời hạn 12-36 tháng).
- Luôn có điều khoản: bảo mật thông tin kinh doanh, chuyển giao toàn bộ quyền sở hữu trí tuệ/sản phẩm tạo ra trong quá trình làm việc cho công ty, hoàn trả chi phí đào tạo nếu nghỉ việc trước thời hạn cam kết (Điều 62), và nghĩa vụ bàn giao công việc đầy đủ trước khi nghỉ.
- Có thể thêm điều khoản không cạnh tranh/không lôi kéo khách hàng-nhân sự sau khi nghỉ việc trong thời hạn hợp lý (thường 12-24 tháng), nhưng phải ghi chú rõ: hiệu lực pháp lý của điều khoản không cạnh tranh sau khi chấm dứt HĐLĐ tại Việt Nam còn chưa thống nhất trong thực tiễn xét xử, nên cần luật sư tư vấn thêm nếu muốn áp dụng chế tài.

TUYỆT ĐỐI KHÔNG đưa vào hợp đồng những điều khoản trái luật sau, dù được yêu cầu — vì các điều khoản này vô hiệu theo pháp luật và có thể khiến công ty bị xử phạt hành chính (Điều 17 BLLĐ và các quy định liên quan):
- Yêu cầu người lao động nộp tiền đặt cọc/tài sản thế chấp để đảm bảo việc làm.
- Giữ bản gốc văn bằng, chứng chỉ,giấy tờ tùy thân của người lao động.
- Lương thấp hơn mức lương tối thiểu vùng theo quy định hiện hành.
- Không đóng BHXH-BHYT-BHTN bắt buộc, hoặc không cho nghỉ phép năm/nghỉ lễ theo luật.
- Phạt tiền người lao động khi vi phạm kỷ luật lao động (luật chỉ cho phép khiển trách, kéo dài thời hạn nâng lương tối đa 6 tháng, cách chức, hoặc sa thải theo đúng trình tự — không có hình thức phạt tiền).
Nếu người dùng yêu cầu đưa các điều khoản trên vào hợp đồng, hãy từ chối đưa vào, giải thích ngắn gọn lý do vô hiệu/rủi ro, và đề xuất điều khoản thay thế hợp pháp đạt mục đích tương tự nếu có.`;

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", text: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: LEGAL_SYSTEM_PROMPT,
          messages: newMessages.map((m) => ({ role: m.role, content: m.text })),
        }),
      });
      const data = await response.json();
      const raw = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n") || "Xin lỗi, tôi chưa thể trả lời ngay lúc này.";
      const { clean, document, advance, truncated } = parseLegalDocument(raw);
      setMessages((prev) => [...prev, { role: "assistant", text: clean, document, advance, truncated }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", text: "Đã có lỗi khi kết nối trợ lý AI. Vui lòng thử lại." }]);
    } finally {
      setLoading(false);
    }
  };

  const continueDocument = async (msgIndex) => {
    if (loading) return;
    setLoading(true);
    const followUp = { role: "user", text: "Văn bản trên bị cắt giữa chừng do vượt giới hạn độ dài. Hãy soạn tiếp phần còn lại, viết tiếp ngay từ chỗ bị dừng, KHÔNG lặp lại nội dung đã có, và đặt phần tiếp theo trong khối ```document như cũ." };
    const newMessages = [...messages, followUp];
    setMessages(newMessages);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: LEGAL_SYSTEM_PROMPT,
          messages: newMessages.map((m) => ({ role: m.role, content: m.text })),
        }),
      });
      const data = await response.json();
      const raw = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n") || "";
      const { document: moreDoc, truncated } = parseLegalDocument(raw);
      setMessages((prev) => {
        const updated = [...prev, { role: "assistant", text: "Đã soạn tiếp phần còn lại, đã nối vào văn bản ở trên." }];
        if (moreDoc) {
          updated[msgIndex] = { ...updated[msgIndex], document: `${updated[msgIndex].document || ""}\n${moreDoc}`, truncated };
        }
        return updated;
      });
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", text: "Đã có lỗi khi soạn tiếp. Vui lòng thử lại." }]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = (docText) => {
    if (printRef.current) printRef.current.innerText = docText;
    window.print();
  };
  const handleDownload = (docText, i) => downloadTextFile(docText, `DOMIX_VanBan_${i}_${TODAY.toISOString().slice(0, 10)}.txt`);

  const findEmployeeByName = (name) => {
    const norm = (s) => (s || "").toLowerCase().trim();
    return employees.find((e) => norm(e.name) === norm(name)) || employees.find((e) => norm(e.name).includes(norm(name)) || norm(name).includes(norm(e.name)));
  };
  const applyAdvance = (msgIndex, advance) => {
    const emp = findEmployeeByName(advance.employeeName);
    if (!emp || !setEmployees) return;
    setEmployees((prev) => prev.map((e) => (e.id === emp.id ? { ...e, advance: Number(advance.amount) || 0 } : e)));
    setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, advanceApplied: true } : m)));
  };

  const suggestions = [
    "Soạn hợp đồng lao động chính thức",
    "Soạn hợp đồng thử việc 2 tháng",
    "Soạn nội quy lao động cơ bản",
  ];

  const CONTRACT_TEMPLATES = [
    { group: "Nhân sự nội bộ", items: [
      "Soạn hợp đồng lao động chính thức",
      "Soạn hợp đồng thử việc",
      "Soạn hợp đồng cộng tác viên/freelancer",
      "Soạn nội quy lao động cơ bản",
      "Soạn quy chế lương thưởng và phụ cấp",
      "Soạn biên bản thanh lý hợp đồng lao động",
      "Soạn quyết định chấm dứt hợp đồng lao động",
      "Soạn đơn xin nghỉ việc kèm bàn giao công việc",
    ]},
    { group: "Kinh doanh & đối tác", items: [
      "Soạn hợp đồng dịch vụ với khách hàng",
      "Soạn hợp đồng mua bán hàng hóa với nhà cung cấp",
      "Soạn hợp đồng thuê mặt bằng/văn phòng",
      "Soạn hợp đồng hợp tác kinh doanh",
      "Soạn hợp đồng đại lý/phân phối sản phẩm",
      "Soạn biên bản thanh lý hợp đồng mua bán",
    ]},
    { group: "Pháp lý chung", items: [
      "Soạn thỏa thuận bảo mật thông tin (NDA)",
      "Soạn điều khoản không cạnh tranh sau khi nghỉ việc",
      "Soạn kế hoạch kinh doanh mở rộng thị trường",
      "Điều khoản phạt vi phạm hợp đồng có lợi cho công ty khi đối tác giao hàng trễ",
    ]},
  ];

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-180px)]">
      <div ref={printRef} className="ktns-print-area"></div>
      <div className="bg-white rounded-lg border border-paper-line flex-1 flex flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto ktns-scrollbar p-5 flex flex-col gap-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-ink text-white" : "bg-paper text-charcoal border border-paper-line"}`}>
                {m.role === "assistant" && <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gold mb-1 font-semibold"><Scale size={11} /> Trợ lý Pháp lý · DOMIX</div>}
                {m.text}
                {m.document && (
                  <div className="mt-3 bg-white border border-paper-line rounded-md overflow-hidden">
                    <div className="px-3 py-2 bg-paper border-b border-paper-line flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wide text-ink-light font-semibold flex items-center gap-1.5"><FileText size={11} /> Văn bản đã soạn</span>
                      <div className="flex gap-1.5">
                        <button onClick={() => handlePrint(m.document)} className="text-[10px] bg-ink text-white px-2.5 py-1 rounded flex items-center gap-1 hover:bg-ink-light"><Printer size={11} /> In / Lưu PDF</button>
                        <button onClick={() => handleDownload(m.document, i)} className="text-[10px] border border-paper-line text-ink px-2.5 py-1 rounded flex items-center gap-1 hover:border-gold"><Download size={11} /> Tải .txt</button>
                      </div>
                    </div>
                    <div className="px-4 py-3 max-h-80 overflow-y-auto ktns-scrollbar">
                      <pre className="ktns-serif text-xs whitespace-pre-wrap text-charcoal leading-relaxed">{m.document}</pre>
                    </div>
                    {m.truncated && (
                      <div className="px-3 py-2 bg-stamp-red/5 border-t border-paper-line flex items-center justify-between gap-2">
                        <span className="text-[10px] text-stamp-red flex items-center gap-1"><AlertTriangle size={11} /> Văn bản có thể bị cắt do quá dài</span>
                        <button onClick={() => continueDocument(i)} disabled={loading} className="text-[10px] bg-stamp-red text-white px-2.5 py-1 rounded hover:opacity-90 disabled:opacity-50">Soạn tiếp phần còn lại</button>
                      </div>
                    )}
                  </div>
                )}
                {m.advance && (
                  <div className="mt-2.5 bg-white border border-paper-line rounded-md p-2.5 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-ink-light font-semibold"><Sparkles size={11} /> Đề xuất ứng lương</div>
                    <div className="text-xs ktns-mono text-charcoal">{m.advance.employeeName} · {fmtVND(m.advance.amount)}</div>
                    <div className="text-xs text-muted">{m.advance.reason}</div>
                    {m.advanceApplied ? (
                      <div className="text-xs text-ledger-green flex items-center gap-1.5 mt-1"><CheckCircle2 size={12} /> Đã ghi vào Bảng lương (mục Tạm ứng)</div>
                    ) : findEmployeeByName(m.advance.employeeName) ? (
                      <button onClick={() => applyAdvance(i, m.advance)} className="mt-1 self-start text-xs bg-ledger-green text-white px-3 py-1.5 rounded-md hover:opacity-90 flex items-center gap-1.5">
                        <Plus size={12} /> Ghi vào Bảng lương
                      </button>
                    ) : (
                      <div className="text-xs text-stamp-red">Không tìm thấy nhân viên "{m.advance.employeeName}" trong hệ thống.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && <div className="flex justify-start"><div className="bg-paper border border-paper-line rounded-lg px-4 py-2.5 text-sm flex items-center gap-2 text-muted"><Loader2 size={14} className="animate-spin" /> Đang soạn thảo...</div></div>}
        </div>
        <div className="border-t border-paper-line p-3 flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap items-center">
            {suggestions.map((s) => (<button key={s} onClick={() => setInput(s)} className="text-xs px-2.5 py-1 rounded-full border border-paper-line text-muted hover:border-gold hover:text-ink">{s}</button>))}
            <select
              value=""
              onChange={(e) => { if (e.target.value) setInput(e.target.value); }}
              className="text-xs px-2.5 py-1.5 rounded-full border border-paper-line text-ink-light bg-white hover:border-gold"
            >
              <option value="">📄 Xem thêm mẫu hợp đồng...</option>
              {CONTRACT_TEMPLATES.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map((it) => (<option key={it} value={it}>{it}</option>))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Yêu cầu soạn hợp đồng, đơn từ, hoặc hỏi về điều khoản luật..." className="flex-1 border border-paper-line rounded-md px-3 py-2 text-sm" />
            <button onClick={send} disabled={loading} className="bg-ink text-white px-4 rounded-md flex items-center gap-1.5 text-sm hover:bg-ink-light disabled:opacity-50"><Send size={14} /> Gửi</button>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-muted">* Văn bản do AI soạn chỉ mang tính tham khảo, không thay thế tư vấn của luật sư — nên rà soát kỹ trước khi ký kết chính thức, đặc biệt với hợp đồng lao động và hợp đồng giá trị lớn.</p>
    </div>
  );
}
