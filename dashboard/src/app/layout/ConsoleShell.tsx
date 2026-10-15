import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Award,
  Eye,
  FolderKanban,
  Home,
  LogOut,
  Map,
  ShieldCheck,
  TrendingUp,
  Check,
} from "lucide-react";

import { useSession } from "@/entities/user";
import { login, logout } from "@/features/auth";
import { DEMO_ACCOUNTS } from "@/shared/config/demo";
import { env } from "@/shared/config/env";
import { vi } from "@/shared/i18n/vi";
import { Button } from "@/shared/ui/Button";
import { ThemeToggle } from "@/shared/ui/ThemeToggle";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Map;
  category: "operations" | "system";
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: "/app/ban-do", label: vi.nav.map, icon: Map, category: "operations" },
  { to: "/app/canh-bao", label: vi.nav.alerts, icon: AlertTriangle, category: "operations" },
  { to: "/app/ho-so", label: vi.nav.cases, icon: FolderKanban, category: "operations" },
  { to: "/app/luot-du-bao", label: vi.nav.runs, icon: TrendingUp, category: "system" },
  { to: "/app/mo-hinh", label: vi.nav.model, icon: ShieldCheck, category: "system" },
];

const ACCOUNT_SHORT_META: Record<string, { shortName: string; icon: typeof Activity }> = {
  "demo.xem": { shortName: "Người xem", icon: Eye },
  "demo.phan-tich": { shortName: "Chuyên viên", icon: TrendingUp },
  officer: { shortName: "Điều hành", icon: Activity },
  approver: { shortName: "Lãnh đạo", icon: Award },
};

/**
 * Khung console: liên kết bỏ qua điều hướng, thanh trên (tên người dùng, đăng xuất), điều hướng chính, nội dung.
 * Khi phiên mất giữa chừng (làm mới token thất bại, đăng xuất ở tab khác…) tự chuyển về đăng nhập và XOÁ cache truy
 * vấn — dữ liệu của người dùng trước không được lộ ra cho người dùng sau (docs/10 §14).
 */
export function ConsoleShell({ children }: { children: ReactNode }) {
  const { accessToken, user } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const href = useRouterState({ select: (s) => s.location.href });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const signingOut = useRef(false);

  useEffect(() => {
    // Chỉ chuyển khi còn đứng trong console: sau khi đã chuyển, `href` đổi thành trang đăng nhập nhưng khung này
    // còn sống thêm một nhịp — không có điều kiện này nó sẽ chuyển tiếp lần nữa, lồng `redirect` vô hạn.
    if (accessToken || signingOut.current || !pathname.startsWith("/app")) return;
    queryClient.clear();
    void router.navigate({ to: "/dang-nhap", search: { redirect: href }, replace: true });
  }, [accessToken, href, pathname, queryClient, router]);

  if (!accessToken) return null; // đang chuyển về đăng nhập

  async function onLogout() {
    signingOut.current = true; // đăng xuất chủ động: về đăng nhập trơn, không mang đường dẫn cũ theo
    await logout();
    queryClient.clear();
    await router.navigate({ to: "/dang-nhap", replace: true });
  }

  async function onSwitchRole(username: string, password: string) {
    try {
      await login(username, password);
      await queryClient.invalidateQueries();
    } catch {
      // Bỏ qua lỗi nếu chuyển thất bại
    }
  }

  type AppRole = "approver" | "officer" | "analyst" | "admin" | "viewer";

  const userRoles = user?.roles ?? [];
  const primaryRole: AppRole = userRoles.includes("approver")
    ? "approver"
    : userRoles.includes("officer")
      ? "officer"
      : userRoles.includes("analyst")
        ? "analyst"
        : userRoles.includes("admin")
          ? "admin"
          : "viewer";

  const ROLE_CONFIG: Record<
    AppRole,
    {
      name: string;
      badge: string;
      color: string;
      borderColor: string;
      glowBar: string;
      avatarBg: string;
      accentText: string;
      guidance: string;
      icon: typeof Activity;
    }
  > = {
    approver: {
      name: "Lãnh đạo phê duyệt",
      badge: "Approver",
      color: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
      borderColor: "border-emerald-500/40",
      glowBar: "via-emerald-400",
      avatarBg: "from-emerald-500 to-teal-600",
      accentText: "text-emerald-400",
      guidance:
        "Quyền lãnh đạo: Thẩm định văn bản, phê duyệt và ban hành công điện khẩn cấp theo Nghị định 30/2020/NĐ-CP.",
      icon: Award,
    },
    officer: {
      name: "Cán bộ điều hành",
      badge: "Officer",
      color: "bg-amber-500/10 text-amber-300 border-amber-500/30",
      borderColor: "border-amber-500/40",
      glowBar: "via-amber-400",
      avatarBg: "from-amber-500 to-orange-600",
      accentText: "text-amber-400",
      guidance:
        "Quyền điều hành: Giám sát cảnh báo, khởi tạo hồ sơ ca bệnh và lập dự thảo phân bổ vật tư can thiệp.",
      icon: Activity,
    },
    analyst: {
      name: "Chuyên viên phân tích",
      badge: "Analyst",
      color: "bg-blue-500/10 text-blue-300 border-blue-500/30",
      borderColor: "border-blue-500/40",
      glowBar: "via-blue-400",
      avatarBg: "from-blue-500 to-indigo-600",
      accentText: "text-blue-400",
      guidance:
        "Quyền phân tích: Khởi tạo lượt chạy dự báo M4-R2, tra cứu viễn thám ERA5 và giải trình nhân quả TreeSHAP.",
      icon: TrendingUp,
    },
    admin: {
      name: "Quản trị viên",
      badge: "Admin",
      color: "bg-purple-500/10 text-purple-300 border-purple-500/30",
      borderColor: "border-purple-500/40",
      glowBar: "via-purple-400",
      avatarBg: "from-purple-500 to-indigo-600",
      accentText: "text-purple-400",
      guidance: "Quyền quản trị toàn quyền trên toàn bộ các phân hệ của nền tảng.",
      icon: ShieldCheck,
    },
    viewer: {
      name: "Người xem",
      badge: "Viewer",
      color: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
      borderColor: "border-cyan-500/40",
      glowBar: "via-cyan-400",
      avatarBg: "from-cyan-500 to-blue-600",
      accentText: "text-cyan-400",
      guidance:
        "Quyền quan sát: Tra cứu bản đồ phân vùng rủi ro 34 tỉnh, chi tiết dịch tễ và hồ sơ mô hình AI.",
      icon: Eye,
    },
  };

  const roleMeta = ROLE_CONFIG[primaryRole];
  const RoleIcon = roleMeta.icon;

  return (
    <div className="min-h-screen text-[var(--ink-primary)] transition-colors duration-200">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-white"
      >
        {vi.nav.skipToContent}
      </a>

      {/* Main Console Top Header */}
      <header className="glass-panel sticky top-0 z-40 border-x-0 border-t-0 px-4 sm:px-6 py-3.5 backdrop-blur-2xl bg-slate-950/85 border-b border-slate-800/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/app" className="group flex items-center gap-3">
              {/* Official Project Logo */}
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600/30 via-slate-900 to-slate-950 p-1.5 ring-1 ring-cyan-500/30 shadow-[0_0_15px_rgba(14,165,233,0.3)] transition-transform duration-200 group-hover:scale-105">
                <img
                  src="/logo-icon.png"
                  alt="DengueSense Logo"
                  className="h-full w-full object-contain drop-shadow"
                />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg font-bold tracking-tight text-white leading-none">
                    Dengue<span className="text-red-500">Sense</span>
                  </span>
                  <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                    Console v1.0
                  </span>
                </div>
                <span className="text-[11px] text-[var(--ink-muted)] mt-0.5">
                  Quyết định dịch tễ thông minh
                </span>
              </div>
            </Link>

            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400 md:flex">
              <Activity size={13} className="text-emerald-400" />
              <span>AI Dịch tễ: Trực tuyến</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 text-sm">
            <ThemeToggle />

            {/* User Profile Badge with Dynamic Role Color */}
            <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-slate-900/90 px-3 py-1.5 shadow-sm">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr ${roleMeta.avatarBg} text-xs font-bold text-white shadow-sm`}
              >
                {user?.display_name ? user.display_name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-white leading-tight">
                  {user?.display_name || user?.username}
                </span>
                <span className={`text-[10px] font-semibold leading-tight ${roleMeta.accentText}`}>
                  {roleMeta.name}
                </span>
              </div>
            </div>

            <Button
              variant="secondary"
              onClick={() => void onLogout()}
              className="px-3 py-1.5 text-xs flex items-center gap-1.5 hover:border-red-500/40 hover:text-red-300 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{vi.auth.logout}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Dynamic Role Mission & 1-Click Fast Role Switcher Ribbon (Demo Mode) */}
      {env.VITE_APP_MODE === "demo" && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-4">
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 sm:p-4 backdrop-blur-xl shadow-lg">
            {/* Top glowing accent bar */}
            <div
              className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent ${roleMeta.glowBar} to-transparent`}
            />

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              {/* Current Role Identity & Mission */}
              <div className="flex items-start sm:items-center gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${roleMeta.color}`}
                >
                  <RoleIcon size={18} />
                </div>
                <div className="flex flex-col">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      Tài khoản: {user?.display_name || user?.username}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${roleMeta.color}`}
                    >
                      {roleMeta.name}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                    {roleMeta.guidance}
                  </span>
                </div>
              </div>

              {/* 1-Click Fast Role Switcher */}
              <div className="flex flex-wrap items-center gap-1.5 pt-2 sm:pt-0 border-t border-slate-800/80 lg:border-t-0 shrink-0">
                <span className="text-[11px] font-semibold text-slate-400 mr-1 hidden sm:inline">
                  Chuyển nhanh vai trò:
                </span>
                {DEMO_ACCOUNTS.map((a) => {
                  const isCurrent = user?.username === a.username;
                  const meta = ACCOUNT_SHORT_META[a.username] ?? {
                    shortName: a.displayName,
                    icon: Activity,
                  };
                  const AccIcon = meta.icon;
                  return (
                    <button
                      key={a.username}
                      type="button"
                      disabled={isCurrent}
                      onClick={() => void onSwitchRole(a.username, a.password)}
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                        isCurrent
                          ? "bg-cyan-500/15 border border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(14,165,233,0.25)] font-semibold cursor-default"
                          : "bg-slate-950/80 border border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200 cursor-pointer"
                      }`}
                    >
                      <AccIcon
                        size={12}
                        className={isCurrent ? "text-cyan-400" : "text-slate-500"}
                      />
                      <span>{meta.shortName}</span>
                      {isCurrent && <Check size={11} className="stroke-[3] text-cyan-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Console Grid: Sidebar + Content */}
      <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 py-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-4">
          <nav
            aria-label={vi.nav.console}
            className="glass-panel flex flex-wrap gap-1.5 rounded-2xl p-3 lg:flex-col border border-slate-800/80 bg-slate-900/60"
          >
            <div className="hidden px-3 py-1.5 text-[10px] font-semibold tracking-wider text-[var(--ink-muted)] uppercase lg:block">
              Nghiệp vụ phòng dịch
            </div>
            {NAV_ITEMS.filter((i) => i.category === "operations").map((n) => {
              const Icon = n.icon;
              const isActive = pathname === n.to || (n.to !== "/app" && pathname.startsWith(n.to));
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className="relative group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors duration-150 active:scale-[0.98]"
                  activeProps={{
                    "aria-current": "page",
                  }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebarActivePill"
                      transition={{ type: "spring", stiffness: 480, damping: 32 }}
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-[var(--accent-soft)] to-transparent border-l-2 border-[var(--accent)] shadow-sm"
                    />
                  )}
                  <div className="relative z-10 flex items-center gap-3">
                    <Icon
                      className={`h-4 w-4 transition-colors duration-150 ${
                        isActive
                          ? "text-[var(--accent-ink)]"
                          : "text-[var(--ink-secondary)] group-hover:text-[var(--ink-primary)]"
                      }`}
                      aria-hidden="true"
                    />
                    <span
                      className={`transition-colors duration-150 ${
                        isActive
                          ? "font-semibold text-[var(--accent-ink)]"
                          : "text-[var(--ink-secondary)] group-hover:text-[var(--ink-primary)]"
                      }`}
                    >
                      {n.label}
                    </span>
                  </div>
                </Link>
              );
            })}

            <div className="hidden pt-2 px-3 py-1.5 text-[10px] font-semibold tracking-wider text-[var(--ink-muted)] uppercase lg:block">
              Hệ thống & Trí tuệ AI
            </div>
            {NAV_ITEMS.filter((i) => i.category === "system").map((n) => {
              const Icon = n.icon;
              const isActive = pathname === n.to || (n.to !== "/app" && pathname.startsWith(n.to));
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className="relative group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors duration-150 active:scale-[0.98]"
                  activeProps={{
                    "aria-current": "page",
                  }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebarActivePill"
                      transition={{ type: "spring", stiffness: 480, damping: 32 }}
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-[var(--accent-soft)] to-transparent border-l-2 border-[var(--accent)] shadow-sm"
                    />
                  )}
                  <div className="relative z-10 flex items-center gap-3">
                    <Icon
                      className={`h-4 w-4 transition-colors duration-150 ${
                        isActive
                          ? "text-[var(--accent-ink)]"
                          : "text-[var(--ink-secondary)] group-hover:text-[var(--ink-primary)]"
                      }`}
                      aria-hidden="true"
                    />
                    <span
                      className={`transition-colors duration-150 ${
                        isActive
                          ? "font-semibold text-[var(--accent-ink)]"
                          : "text-[var(--ink-secondary)] group-hover:text-[var(--ink-primary)]"
                      }`}
                    >
                      {n.label}
                    </span>
                  </div>
                </Link>
              );
            })}

            <div className="my-1 border-t border-[var(--border-hairline)]" />
            <Link
              to="/"
              className="relative group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-[var(--ink-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--ink-primary)] transition-colors active:scale-[0.98]"
            >
              <Home
                className="h-4 w-4 text-[var(--ink-secondary)] group-hover:text-[var(--ink-primary)]"
                aria-hidden="true"
              />
              <span>{vi.nav.home}</span>
            </Link>
          </nav>
        </aside>

        <main id="main" tabIndex={-1} className="min-w-0 outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
