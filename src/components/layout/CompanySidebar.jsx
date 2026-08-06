import { useEffect, useState } from "react";
import { Building2, MapPin, Phone, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";

function CountBadge({ children, className = "bg-stamp-red text-white" }) {
  return (
    <span className={`ml-auto flex h-5 min-w-5 items-center justify-center rounded-full border border-white/30 px-1 text-[10px] font-bold ${className}`}>
      {children}
    </span>
  );
}

// Sidebar kiểu TailAdmin: chỉ còn danh sách MỤC LỚN phẳng — các bảng con của từng mục hiển thị
// bằng thanh menu ngang trong vùng làm việc. Ngôn ngữ / sáng-tối / user chuyển hết lên header.
// Có chế độ THU GỌN (chỉ icon + tooltip tên menu) — bề rộng cố định, không gây tràn bảng.
const SIDEBAR_COLLAPSED_KEY = "domix_sidebar_collapsed";

export default function CompanySidebar({
  open,
  onClose,
  navGroups,
  activeTab,
  onSelectTab,
  t,
  tagline,
  company,
  chatUnread,
  taskBadgeCount,
  attendancePendingCount,
  payrollActionSummary,
  isReviewer,
}) {
  const payrollActionCount = Number(payrollActionSummary?.total || 0);
  // t() trả về chính key khi thiếu bản dịch — phải rơi về fallback tiếng Việt, không hiện key thô.
  const label = (key, fallback) => {
    const value = t?.(key);
    return value && value !== key ? value : fallback;
  };
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0"); } catch { /* noop */ }
  }, [collapsed]);

  // Số cảnh báo của một mục: mục thường tính theo chính nó; mục lớn cộng dồn các bảng con.
  const badgeFor = (item) => {
    const ids = item.children ? item.children.map((child) => child.id) : [item.id];
    let total = 0;
    if (ids.includes("chat")) total += Number(chatUnread) || 0;
    if (ids.includes("giaoviec")) total += Number(taskBadgeCount) || 0;
    if (ids.includes("chamcong")) total += Number(attendancePendingCount) || 0;
    if (ids.includes("luong")) total += payrollActionCount;
    return total;
  };

  return (
    <>
      <button
        type="button"
        aria-label={label("sidebar_close_menu", "Đóng menu")}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/45 transition-opacity md:hidden ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(86vw,280px)] shrink-0 flex-col overflow-hidden bg-ink text-white shadow-2xl transition-transform duration-200 md:relative md:z-[1] md:h-screen ${collapsed ? "md:w-[64px]" : "md:w-60"} md:translate-x-0 md:shadow-none ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className={`flex items-start border-b border-white/10 py-5 md:py-6 ${collapsed ? "justify-center px-2" : "justify-between px-5"}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/logo.jfif" alt="DOMIX" className="h-9 w-9 shrink-0 rounded-lg object-cover shadow-md" />
            {!collapsed && (
              <div className="min-w-0">
                <div className="ktns-serif text-2xl font-bold leading-tight tracking-tight domix-brand-text">DOMIX</div>
                <div className="mt-0.5 text-[11px] text-white/60 truncate">{tagline}</div>
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white md:hidden" aria-label={label("sidebar_close_menu", "Đóng menu")}>
            <X size={18} />
          </button>
        </div>

        <nav className="ktns-sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain py-3">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-1">
              {!collapsed && <div className="px-5 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">{group.label}</div>}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = item.children
                  ? item.children.some((child) => child.id === activeTab)
                  : activeTab === item.id;
                const alerts = badgeFor(item);
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => onSelectTab(item.children ? item.children[0].id : item.id)}
                    title={collapsed ? item.label : undefined}
                    aria-label={item.label}
                    className={`relative mb-0.5 flex items-center rounded-lg text-left text-sm transition-colors duration-150 ${collapsed ? "mx-2 w-[calc(100%-16px)] justify-center px-0 py-2.5" : "mx-3 w-[calc(100%-24px)] gap-3 px-3 py-2.5"} ${active ? "ktns-tab-active font-semibold text-white" : "text-white/70 hover:bg-white/5 hover:text-white"}`}
                  >
                    <Icon size={16} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && item.beta && <span className="rounded-full border border-gold/40 bg-gold/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gold" title="Tính năng đang phát triển">Beta</span>}
                    {alerts > 0 && (collapsed ? (
                      <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-stamp-red" title={`${alerts} cảnh báo`} />
                    ) : (
                      <CountBadge className={item.id === "giaoviec" && !isReviewer ? "animate-pulse bg-stamp-red text-white" : "bg-stamp-red text-white"}>
                        {alerts > 99 ? "99+" : alerts}
                      </CountBadge>
                    ))}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Nút thu gọn/mở rộng — chỉ desktop; mobile dùng overlay đóng/mở như cũ. */}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className={`hidden items-center gap-2 border-t border-white/10 py-2.5 text-[11px] font-semibold text-white/60 hover:bg-white/5 hover:text-white md:flex ${collapsed ? "justify-center px-2" : "px-5"}`}
          title={collapsed ? label("sidebar_expand", "Mở rộng menu") : label("sidebar_collapse", "Thu gọn menu")}
          aria-label={collapsed ? label("sidebar_expand", "Mở rộng menu") : label("sidebar_collapse", "Thu gọn menu")}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          {!collapsed && <span>{label("sidebar_collapse", "Thu gọn menu")}</span>}
        </button>

        {!collapsed && (
          <div className="flex flex-col gap-2 border-t border-white/10 px-5 py-4">
            <div className="flex items-center gap-2"><Building2 size={13} className="shrink-0 text-gold" /><span className="text-[11px] font-medium text-white/80">{company.name}</span></div>
            <div className="flex items-center gap-2"><MapPin size={13} className="shrink-0 text-gold" /><span className="line-clamp-2 text-[11px] text-white/70">{company.address}</span></div>
            <div className="flex items-center gap-2"><Phone size={13} className="shrink-0 text-gold" /><span className="ktns-mono text-[11px] text-white/70">{company.phone}</span></div>
          </div>
        )}
      </aside>
    </>
  );
}
