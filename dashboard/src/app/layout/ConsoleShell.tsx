import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
  Target,
  Compass,
} from "lucide-react";

import { useSession } from "@/entities/user";
import { login, logout } from "@/features/auth";
import { DEMO_ACCOUNTS } from "@/shared/config/demo";
import { env } from "@/shared/config/env";
import { vi } from "@/shared/i18n/vi";
import { Button } from "@/shared/ui/Button";
import { NotificationCenter } from "@/shared/ui/NotificationCenter";
import { ThemeToggle } from "@/shared/ui/ThemeToggle";
import { TacticalScenarioModal } from "@/features/scenarios";
import { GuidedTourModal } from "@/features/tour";
import type { TacticalScenario } from "@/shared/config/scenarios";
import type { TourStep } from "@/shared/config/guidedTour";

export type AppRole = "approver" | "officer" | "analyst" | "admin" | "viewer";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Map;
  category: "operations" | "system";
  roles: readonly AppRole[];
}

const NAV_ITEMS: readonly NavItem[] = [
  {
    to: "/app/ban-do",
    label: vi.nav.map,
    icon: Map,
    category: "operations",
    roles: ["viewer", "analyst", "officer", "approver", "admin"],
  },
  {
    to: "/app/canh-bao",
    label: vi.nav.alerts,
    icon: AlertTriangle,
    category: "operations",
    roles: ["officer", "approver", "admin"],
  },
  {
    to: "/app/ho-so",
    label: vi.nav.cases,
    icon: FolderKanban,
    category: "operations",
    roles: ["officer", "approver", "admin"],
  },
  {
    to: "/app/luot-du-bao",
    label: vi.nav.runs,
    icon: TrendingUp,
    category: "system",
    roles: ["analyst", "admin"],
  },
  {
    to: "/app/mo-hinh",
    label: vi.nav.model,
    icon: ShieldCheck,
    category: "system",
    roles: ["viewer", "analyst", "officer", "approver", "admin"],
  },
];

const ACCOUNT_SHORT_META: Record<string, { shortName: string; icon: typeof Activity }> = {
  "demo.xem": { shortName: "Người xem", icon: Eye },
  "demo.phan-tich": { shortName: "Chuyên viên", icon: TrendingUp },
  officer: { shortName: "Điều hành", icon: Activity },
  approver: { shortName: "Lãnh đạo", icon: Award },
};

function canAccessPath(path: string, role: AppRole): boolean {
  if (path.startsWith("/app/canh-bao") || path.startsWith("/app/ho-so")) {
    return role === "officer" || role === "approver" || role === "admin";
  }
  if (path.startsWith("/app/du-thao")) {
    return role === "officer" || role === "approver" || role === "admin";
  }
  return true; // /app/ban-do, /app/tinh, /app/mo-hinh, /app/luot-du-bao
}

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
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [showTourModal, setShowTourModal] = useState(false);

  const userRoles = user?.roles ?? [];
  const primaryRole: AppRole = userRoles.includes("admin")
    ? "admin"
    : userRoles.includes("approver")
      ? "approver"
      : userRoles.includes("officer")
        ? "officer"
        : userRoles.includes("analyst")
          ? "analyst"
          : "viewer";

  useEffect(() => {
    // Chỉ chuyển khi còn đứng trong console: sau khi đã chuyển, `href` đổi thành trang đăng nhập nhưng khung này
    // còn sống thêm một nhịp — không có điều kiện này nó sẽ chuyển tiếp lần nữa, lồng `redirect` vô hạn.
    if (accessToken || signingOut.current || !pathname.startsWith("/app")) return;
    queryClient.clear();
    void router.navigate({ to: "/dang-nhap", search: { redirect: href }, replace: true });
  }, [accessToken, href, pathname, queryClient, router]);

  // Ngăn chặn truy cập hoặc xem giao diện không thuộc role hiện tại
  useEffect(() => {
    if (accessToken && pathname.startsWith("/app") && !canAccessPath(pathname, primaryRole)) {
      void router.navigate({ to: "/app/ban-do", replace: true });
    }
  }, [accessToken, pathname, primaryRole, router]);

  useEffect(() => {
    const handleOpenScenarios = () => setShowScenarioModal(true);
    const handleOpenTour = () => setShowTourModal(true);
    window.addEventListener("open-tactical-scenarios", handleOpenScenarios);
    window.addEventListener("open-guided-tour", handleOpenTour);
    return () => {
      window.removeEventListener("open-tactical-scenarios", handleOpenScenarios);
      window.removeEventListener("open-guided-tour", handleOpenTour);
    };
  }, []);

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

      const targetAccount = DEMO_ACCOUNTS.find((a) => a.username === username);
      const targetRoles: readonly string[] = targetAccount?.roles ?? [];
      const newRole: AppRole = targetRoles.includes("admin")
        ? "admin"
        : targetRoles.includes("approver")
          ? "approver"
          : targetRoles.includes("officer")
            ? "officer"
            : targetRoles.includes("analyst")
              ? "analyst"
              : "viewer";

      if (!canAccessPath(pathname, newRole)) {
        void router.navigate({ to: "/app/ban-do", replace: true });
      }
    } catch {
      // Bỏ qua lỗi nếu chuyển thất bại
    }
  }

  async function handleSelectScenario(scenario: TacticalScenario) {
    setShowScenarioModal(false);
    if (primaryRole !== scenario.recommendedRole) {
      const targetAcc = DEMO_ACCOUNTS.find((a) => a.roles.includes(scenario.recommendedRole));
      if (targetAcc) {
        await login(targetAcc.username, targetAcc.password);
        await queryClient.invalidateQueries();
      }
    }
    void router.navigate({ to: scenario.targetRoute });
  }

  async function handleNavigateTourStep(step: TourStep) {
    setShowTourModal(false);
    if (primaryRole !== step.role) {
      const targetAcc = DEMO_ACCOUNTS.find((a) => a.roles.includes(step.role));
      if (targetAcc) {
        await login(targetAcc.username, targetAcc.password);
        await queryClient.invalidateQueries();
      }
    }
    void router.navigate({ to: step.targetRoute });
  }

  const visibleNavItems = NAV_ITEMS.filter((item) => item.roles.includes(primaryRole));
  const operationItems = visibleNavItems.filter((i) => i.category === "operations");
  const systemItems = visibleNavItems.filter((i) => i.category === "system");

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
      color:
        "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30",
      borderColor: "border-emerald-300 dark:border-emerald-500/40",
      glowBar: "via-emerald-500",
      avatarBg: "from-emerald-500 to-teal-600",
      accentText: "text-emerald-700 dark:text-emerald-400",
      guidance:
        "Quyền lãnh đạo: Thẩm định văn bản, phê duyệt và ban hành công điện khẩn cấp theo Nghị định 30/2020/NĐ-CP.",
      icon: Award,
    },
    officer: {
      name: "Cán bộ điều hành",
      badge: "Officer",
      color:
        "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30",
      borderColor: "border-amber-300 dark:border-amber-500/40",
      glowBar: "via-amber-500",
      avatarBg: "from-amber-500 to-orange-600",
      accentText: "text-amber-800 dark:text-amber-400",
      guidance:
        "Quyền điều hành: Giám sát cảnh báo, khởi tạo hồ sơ ca bệnh và lập dự thảo phân bổ vật tư can thiệp.",
      icon: Activity,
    },
    analyst: {
      name: "Chuyên viên phân tích",
      badge: "Analyst",
      color:
        "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30",
      borderColor: "border-blue-300 dark:border-blue-500/40",
      glowBar: "via-blue-500",
      avatarBg: "from-blue-500 to-indigo-600",
      accentText: "text-blue-700 dark:text-blue-400",
      guidance:
        "Quyền phân tích: Khởi tạo lượt chạy dự báo M4-R2, tra cứu viễn thám ERA5 và giải trình nhân quả TreeSHAP.",
      icon: TrendingUp,
    },
    admin: {
      name: "Quản trị viên",
      badge: "Admin",
      color:
        "bg-purple-50 text-purple-900 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/30",
      borderColor: "border-purple-300 dark:border-purple-500/40",
      glowBar: "via-purple-500",
      avatarBg: "from-purple-500 to-indigo-600",
      accentText: "text-purple-800 dark:text-purple-400",
      guidance: "Quyền quản trị toàn quyền trên toàn bộ các phân hệ của nền tảng.",
      icon: ShieldCheck,
    },
    viewer: {
      name: "Người xem",
      badge: "Viewer",
      color:
        "bg-sky-50 text-sky-800 border-sky-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/30",
      borderColor: "border-sky-300 dark:border-cyan-500/40",
      glowBar: "via-sky-500",
      avatarBg: "from-sky-500 to-blue-600",
      accentText: "text-sky-700 dark:text-cyan-400",
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
      <header className="glass-panel sticky top-0 z-40 border-x-0 border-t-0 px-3 sm:px-6 lg:px-8 py-3.5 backdrop-blur-2xl bg-white/90 border-b border-slate-200/90 shadow-xs dark:bg-slate-950/85 dark:border-slate-800/80 print:hidden">
        <div className="flex w-full items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link to="/app" className="group flex items-center gap-2.5 sm:gap-3">
              {/* Official Project Logo */}
              <div className="relative flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600/30 via-slate-900 to-slate-950 p-1.5 ring-1 ring-cyan-500/30 shadow-[0_0_15px_rgba(14,165,233,0.3)] transition-transform duration-200 group-hover:scale-105">
                <img
                  src="/logo-icon.png"
                  alt="DengueSense Logo"
                  className="h-full w-full object-contain drop-shadow"
                />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-display text-base sm:text-lg font-bold tracking-tight text-[var(--ink-primary)] leading-none">
                    Dengue<span className="text-red-500">Sense</span>
                  </span>
                  <span className="hidden sm:inline-block rounded-full border border-blue-200 bg-blue-50/80 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300">
                    Console v1.0
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-[var(--ink-muted)] mt-0.5 hidden md:block">
                  Quyết định dịch tễ thông minh
                </span>
              </div>
            </Link>

            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 lg:flex">
              <Activity size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span>AI Dịch tễ: Trực tuyến</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 text-sm shrink-0">
            <NotificationCenter />

            <div className="flex items-center px-0.5">
              <ThemeToggle />
            </div>

            <div
              className="h-4 w-px bg-slate-300/40 dark:bg-slate-800 hidden sm:block"
              aria-hidden="true"
            />

            {/* User Profile Badge with Dynamic Role Color */}
            <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/90 dark:border-white/10 dark:bg-slate-900/90 p-1 sm:px-3 sm:py-1.5 shadow-xs shrink-0">
              <div
                className={`role-avatar flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr ${roleMeta.avatarBg} text-xs font-bold text-white shadow-xs shrink-0`}
              >
                {user?.display_name ? user.display_name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                  {user?.display_name || user?.username}
                </span>
                <span className={`text-[10px] font-semibold leading-tight ${roleMeta.accentText}`}>
                  {roleMeta.name}
                </span>
              </div>
            </div>

            <div
              className="h-4 w-px bg-slate-300/40 dark:bg-slate-800 hidden sm:block"
              aria-hidden="true"
            />

            <Button
              variant="secondary"
              onClick={() => void onLogout()}
              className="px-2.5 sm:px-3 py-1.5 text-xs flex items-center gap-1.5 hover:border-red-500/40 hover:text-red-500 dark:hover:text-red-300 transition-colors shrink-0"
              title={vi.auth.logout}
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{vi.auth.logout}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Dynamic Role Mission & 1-Click Fast Role Switcher Ribbon (Demo Mode) */}
      {env.VITE_APP_MODE === "demo" && (
        <div className="w-full px-3 sm:px-6 lg:px-8 pt-4 print:hidden">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 p-3.5 sm:p-4 backdrop-blur-xl shadow-xs dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-lg">
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
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Tài khoản: {user?.display_name || user?.username}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${roleMeta.color}`}
                    >
                      {roleMeta.name}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    {roleMeta.guidance}
                  </span>
                </div>
              </div>

              {/* 1-Click Fast Role Switcher */}
              <div className="flex flex-wrap items-center gap-1.5 pt-2 sm:pt-0 border-t border-slate-200 lg:border-t-0 dark:border-slate-800/80 shrink-0">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-1 hidden sm:inline">
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
                          ? "bg-blue-50 border border-blue-500 text-blue-700 shadow-xs font-semibold cursor-default dark:bg-cyan-500/15 dark:border-cyan-400 dark:text-cyan-300 dark:shadow-[0_0_10px_rgba(14,165,233,0.25)]"
                          : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900 hover:bg-slate-50 cursor-pointer dark:bg-slate-950/80 dark:border-slate-800 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200"
                      }`}
                    >
                      <AccIcon
                        size={12}
                        className={
                          isCurrent
                            ? "text-blue-600 dark:text-cyan-400"
                            : "text-slate-400 dark:text-slate-500"
                        }
                      />
                      <span>{meta.shortName}</span>
                      {isCurrent && (
                        <Check size={11} className="stroke-[3] text-blue-600 dark:text-cyan-400" />
                      )}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setShowScenarioModal(true)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold bg-gradient-to-r from-red-500/10 to-amber-500/10 border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-all cursor-pointer shadow-xs ml-1"
                  title="Mở bảng kịch bản diễn tập dịch tễ thực tế"
                >
                  <Target size={12} className="text-red-500" />
                  <span>Diễn tập Tình huống</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowTourModal(true)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/30 text-blue-600 dark:text-cyan-400 hover:bg-blue-500/20 hover:border-blue-500/50 transition-all cursor-pointer shadow-xs ml-1"
                  title="Lộ trình trải nghiệm 5 bước tác chiến đa vai trò"
                >
                  <Compass size={12} className="text-blue-500 dark:text-cyan-400" />
                  <span>Lộ trình Trải nghiệm</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Console Grid: Sidebar + Content */}
      <div className="grid w-full gap-6 px-3 sm:px-6 lg:px-8 py-6 lg:grid-cols-[240px_1fr] xl:grid-cols-[260px_1fr] print:block print:p-0">
        <aside className="space-y-4 print:hidden">
          <nav
            aria-label={vi.nav.console}
            className="glass-panel flex flex-wrap gap-1.5 rounded-2xl p-3 lg:flex-col border border-slate-200/90 bg-white/95 shadow-xs dark:border-slate-800/80 dark:bg-slate-900/60"
          >
            {operationItems.length > 0 && (
              <>
                <div className="hidden px-3 py-1.5 text-[10px] font-semibold tracking-wider text-slate-400 dark:text-[var(--ink-muted)] uppercase lg:block">
                  Nghiệp vụ phòng dịch
                </div>
                {operationItems.map((n) => {
                  const Icon = n.icon;
                  const isActive =
                    pathname === n.to || (n.to !== "/app" && pathname.startsWith(n.to));
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
                          className="console-nav-selection absolute inset-0 rounded-xl"
                        />
                      )}
                      <div className="relative z-10 flex items-center gap-3">
                        <Icon
                          className={`h-4 w-4 transition-colors duration-150 ${
                            isActive
                              ? "text-[var(--selection-ink)]"
                              : "text-slate-600 dark:text-[var(--ink-secondary)] group-hover:text-slate-900 dark:group-hover:text-[var(--ink-primary)]"
                          }`}
                          aria-hidden="true"
                        />
                        <span
                          className={`transition-colors duration-150 ${
                            isActive
                              ? "font-semibold text-[var(--selection-ink)]"
                              : "text-slate-600 dark:text-[var(--ink-secondary)] group-hover:text-slate-900 dark:group-hover:text-[var(--ink-primary)]"
                          }`}
                        >
                          {n.label}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </>
            )}

            {systemItems.length > 0 && (
              <>
                <div className="hidden pt-2 px-3 py-1.5 text-[10px] font-semibold tracking-wider text-slate-400 dark:text-[var(--ink-muted)] uppercase lg:block">
                  Hệ thống & Trí tuệ AI
                </div>
                {systemItems.map((n) => {
                  const Icon = n.icon;
                  const isActive =
                    pathname === n.to || (n.to !== "/app" && pathname.startsWith(n.to));
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
                          className="console-nav-selection absolute inset-0 rounded-xl"
                        />
                      )}
                      <div className="relative z-10 flex items-center gap-3">
                        <Icon
                          className={`h-4 w-4 transition-colors duration-150 ${
                            isActive
                              ? "text-[var(--selection-ink)]"
                              : "text-slate-600 dark:text-[var(--ink-secondary)] group-hover:text-slate-900 dark:group-hover:text-[var(--ink-primary)]"
                          }`}
                          aria-hidden="true"
                        />
                        <span
                          className={`transition-colors duration-150 ${
                            isActive
                              ? "font-semibold text-[var(--selection-ink)]"
                              : "text-slate-600 dark:text-[var(--ink-secondary)] group-hover:text-slate-900 dark:group-hover:text-[var(--ink-primary)]"
                          }`}
                        >
                          {n.label}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </>
            )}

            <div className="my-1 border-t border-slate-200 dark:border-slate-800/80 hidden lg:block" />
            <Link
              to="/"
              className="relative group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-600 dark:text-[var(--ink-secondary)] hover:bg-slate-100 dark:hover:bg-[var(--bg-surface-hover)] hover:text-slate-900 dark:hover:text-[var(--ink-primary)] transition-colors active:scale-[0.98]"
            >
              <Home
                className="h-4 w-4 text-slate-500 dark:text-[var(--ink-secondary)] group-hover:text-slate-900 dark:group-hover:text-[var(--ink-primary)]"
                aria-hidden="true"
              />
              <span>{vi.nav.home}</span>
            </Link>

            <div className="hidden lg:flex items-center justify-between px-3.5 py-2.5 text-xs text-slate-500 dark:text-[var(--ink-muted)] mt-1 pt-2.5 border-t border-slate-200/80 dark:border-slate-800/80">
              <span className="font-medium">Chế độ sáng/tối</span>
              <ThemeToggle />
            </div>
          </nav>
        </aside>

        <main
          id="main"
          tabIndex={-1}
          className="min-w-0 outline-none print:w-full print:p-0 print:m-0"
        >
          {children}
        </main>
      </div>

      <TacticalScenarioModal
        open={showScenarioModal}
        onClose={() => setShowScenarioModal(false)}
        onSelectScenario={handleSelectScenario}
      />

      <GuidedTourModal
        open={showTourModal}
        onClose={() => setShowTourModal(false)}
        onNavigateStep={handleNavigateTourStep}
      />
    </div>
  );
}
