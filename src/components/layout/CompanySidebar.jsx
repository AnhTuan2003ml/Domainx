import {
  Building2,
  Globe,
  MapPin,
  Moon,
  Phone,
  Search,
  Sun,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

function CountBadge({ children, className = "bg-stamp-red text-white" }) {
  return (
    <span className={`ml-auto flex h-5 min-w-5 items-center justify-center rounded-full border border-white/30 px-1 text-[10px] font-bold ${className}`}>
      {children}
    </span>
  );
}

export default function CompanySidebar({
  open,
  onClose,
  navGroups,
  activeTab,
  onSelectTab,
  lang,
  onLanguageChange,
  t,
  tagline,
  darkMode,
  onToggleDarkMode,
  taskReminderEligible,
  taskSoundEnabled,
  onToggleTaskSound,
  onOpenCommandPalette,
  company,
  chatUnread,
  taskBadgeCount,
  attendancePendingCount,
  payrollActionSummary,
  isReviewer,
}) {
  const payrollActionCount = Number(payrollActionSummary?.total || 0);
  const label = (key, fallback) => t?.(key) || fallback;
  return (
    <>
      <button
        type="button"
        aria-label={label("sidebar_close_menu", "Đóng menu")}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/45 transition-opacity md:hidden ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(86vw,280px)] shrink-0 flex-col overflow-hidden bg-ink text-white shadow-2xl transition-transform duration-200 md:relative md:z-[1] md:h-screen md:w-60 md:translate-x-0 md:shadow-none ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-5 md:py-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/logo.jfif" alt="DOMIX" className="h-9 w-9 shrink-0 rounded-lg object-cover shadow-md" />
            <div className="min-w-0">
              <div className="ktns-serif text-2xl font-bold leading-tight tracking-tight domix-brand-text">DOMIX</div>
              <div className="mt-0.5 text-[11px] text-white/60 truncate">{tagline}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white md:hidden" aria-label={label("sidebar_close_menu", "Đóng menu")}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2 px-5 pb-2 pt-3">
          <button type="button" onClick={onToggleDarkMode} className="flex w-full items-center justify-between gap-2 rounded-md bg-white/5 px-3 py-2 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white">
            <span className="flex items-center gap-2">{darkMode ? <Sun size={13} /> : <Moon size={13} />} {darkMode ? label("sidebar_light_mode", "Chế độ sáng") : label("sidebar_dark_mode", "Chế độ tối")}</span>
            <span className={`relative h-4 w-8 rounded-full transition-colors ${darkMode ? "bg-gold" : "bg-white/20"}`}><span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${darkMode ? "left-4" : "left-0.5"}`} /></span>
          </button>
          <label className="flex w-full items-center justify-between gap-2 rounded-md bg-white/5 px-3 py-2 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white">
            <span className="flex items-center gap-2"><Globe size={13} /> {label("sidebar_language", "Ngôn ngữ")}</span>
            <select
              value={lang}
              onChange={(event) => onLanguageChange(event.target.value)}
              title="Switch language / Đổi ngôn ngữ"
              className="cursor-pointer rounded-full border-none bg-white/10 px-2 py-1 text-[10px] text-white hover:bg-white/20"
            >
              <option value="vi" className="text-ink">🇻🇳 VI</option>
              <option value="en" className="text-ink">🇺🇸 EN</option>
              <option value="zh" className="text-ink">🇨🇳 中文</option>
              <option value="ja" className="text-ink">🇯🇵 日本語</option>
              <option value="th" className="text-ink">🇹🇭 ไทย</option>
            </select>
          </label>
          {taskReminderEligible && (
            <button type="button" onClick={onToggleTaskSound} className="flex w-full items-center justify-between gap-2 rounded-md bg-white/5 px-3 py-2 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white">
              <span className="flex items-center gap-2">{taskSoundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />} {label("sidebar_sound", "Âm thanh nhắc việc")}</span>
              <span className={`relative h-4 w-8 rounded-full transition-colors ${taskSoundEnabled ? "bg-ledger-green" : "bg-white/20"}`}><span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${taskSoundEnabled ? "left-4" : "left-0.5"}`} /></span>
            </button>
          )}
        </div>

        <button type="button" onClick={onOpenCommandPalette} className="mx-4 mb-1 mt-2 flex items-center justify-between gap-2 rounded-md bg-white/5 px-3 py-2 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white">
          <span className="flex items-center gap-2"><Search size={13} /> {label("sidebar_search", "Tìm nhanh...")}</span>
          <span className="ktns-mono rounded border border-white/20 px-1.5 py-0.5 text-[10px]">⌘K</span>
        </button>

        <nav className="ktns-sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain py-3">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-1">
              <div className="px-5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-white/35">{group.label}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`relative flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm transition-all duration-150 ${active ? "ktns-tab-active text-white" : "text-white/70 hover:bg-white/5 hover:pl-6 hover:text-white"}`}
                  >
                    <Icon size={16} />
                    <span className="truncate">{item.label}</span>
                    {item.beta && <span className="rounded-full border border-gold/40 bg-gold/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gold" title="Tính năng đang phát triển" aria-label="Beta — Tính năng đang phát triển">Beta</span>}
                    {item.id === "chat" && chatUnread > 0 && <CountBadge>{chatUnread > 99 ? "99+" : chatUnread}</CountBadge>}
                    {item.id === "giaoviec" && taskBadgeCount > 0 && <CountBadge className={isReviewer ? "bg-gold text-ink" : "animate-pulse bg-stamp-red text-white"}>{taskBadgeCount > 99 ? "99+" : taskBadgeCount}</CountBadge>}
                    {item.id === "chamcong" && attendancePendingCount > 0 && <CountBadge className={isReviewer ? "animate-pulse bg-gold text-ink" : "bg-[#315fae] text-white"}>{attendancePendingCount > 99 ? "99+" : attendancePendingCount}</CountBadge>}
                    {item.id === "luong" && payrollActionCount > 0 && (
                      <span className="ml-auto flex items-center gap-1">
                        {payrollActionSummary.monthly > 0 && <span className="flex h-5 min-w-6 items-center justify-center rounded bg-[#315fae] px-1 text-[9px] font-bold text-white">LT {payrollActionSummary.monthly > 9 ? "9+" : payrollActionSummary.monthly}</span>}
                        {payrollActionSummary.midmonth > 0 && <span className="flex h-5 min-w-6 items-center justify-center rounded bg-gold px-1 text-[9px] font-bold text-ink">GT {payrollActionSummary.midmonth > 9 ? "9+" : payrollActionSummary.midmonth}</span>}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="flex flex-col gap-2 border-t border-white/10 px-5 py-4">
          <div className="flex items-center gap-2"><Building2 size={13} className="shrink-0 text-gold" /><span className="text-[11px] font-medium text-white/80">{company.name}</span></div>
          <div className="flex items-center gap-2"><MapPin size={13} className="shrink-0 text-gold" /><span className="line-clamp-2 text-[11px] text-white/70">{company.address}</span></div>
          <div className="flex items-center gap-2"><Phone size={13} className="shrink-0 text-gold" /><span className="ktns-mono text-[11px] text-white/70">{company.phone}</span></div>
        </div>
      </aside>
    </>
  );
}
