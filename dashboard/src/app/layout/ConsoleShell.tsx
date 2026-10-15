import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  FolderKanban,
  Home,
  LogOut,
  Map,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import { useSession } from "@/entities/user";
import { logout } from "@/features/auth";
import { env } from "@/shared/config/env";
import { vi } from "@/shared/i18n/vi";
import { Alert } from "@/shared/ui/Alert";
import { Button } from "@/shared/ui/Button";

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

const NAV_LINK_BASE =
  "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150 text-[var(--ink-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--ink-primary)]";
const NAV_LINK_ACTIVE =
  "bg-gradient-to-r from-[var(--accent-soft)] to-transparent text-[var(--accent-ink)] border-l-2 border-[var(--accent)] font-semibold shadow-sm";

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

  const primaryRole = user?.roles?.[0];
  const roleName = primaryRole
    ? primaryRole === "officer"
      ? "Cán bộ điều hành"
      : primaryRole === "approver"
        ? "Lãnh đạo phê duyệt"
        : primaryRole === "analyst"
          ? "Chuyên viên phân tích"
          : primaryRole === "admin"
            ? "Quản trị viên"
            : "Người dùng"
    : "Người dùng";

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--accent-solid)] focus:px-4 focus:py-2 focus:text-white"
      >
        {vi.nav.skipToContent}
      </a>

      <header className="glass-panel sticky top-0 z-40 border-x-0 border-t-0 px-6 py-3.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/app" className="group flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/20 transition-transform duration-200 group-hover:scale-105">
                <Activity className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg font-bold tracking-tight text-white">
                    {vi.appName}
                  </span>
                  <span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                    MVP v1.0
                  </span>
                </div>
                <span className="text-[11px] text-[var(--ink-muted)]">
                  Quyết định dịch tễ thông minh
                </span>
              </div>
            </Link>

            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400 md:flex">
              <Activity size={13} className="text-emerald-400" />
              <span>AI Dịch tễ: Trực tuyến</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <div className="hidden sm:flex items-center gap-3 rounded-full border border-white/10 bg-[var(--bg-surface-2)] px-3.5 py-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 text-xs font-bold text-white shadow-sm">
                {user?.display_name ? user.display_name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-medium text-[var(--ink-primary)] leading-tight">
                  {user?.display_name}
                </span>
                <span className="text-[10px] font-medium text-sky-400 leading-tight">
                  {roleName}
                </span>
              </div>
            </div>

            <Button
              variant="secondary"
              onClick={() => void onLogout()}
              className="px-3.5 py-1.5 text-xs flex items-center gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{vi.auth.logout}</span>
            </Button>
          </div>
        </div>
      </header>

      {env.VITE_APP_MODE === "demo" ? (
        <div className="mx-auto max-w-7xl px-6 pt-4">
          <Alert tone="info">{vi.auth.demoBanner}</Alert>
        </div>
      ) : null}

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-4">
          <nav
            aria-label={vi.nav.console}
            className="glass-panel flex flex-wrap gap-1.5 rounded-2xl p-3 lg:flex-col"
          >
            <div className="hidden px-3 py-1.5 text-[10px] font-semibold tracking-wider text-[var(--ink-muted)] uppercase lg:block">
              Nghiệp vụ phòng dịch
            </div>
            {NAV_ITEMS.filter((i) => i.category === "operations").map((n) => {
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={NAV_LINK_BASE}
                  activeProps={{
                    "aria-current": "page",
                    className: `${NAV_LINK_BASE} ${NAV_LINK_ACTIVE}`,
                  }}
                >
                  <Icon
                    className="h-4 w-4 text-[var(--ink-secondary)] group-hover:text-[var(--ink-primary)]"
                    aria-hidden="true"
                  />
                  <span>{n.label}</span>
                </Link>
              );
            })}

            <div className="hidden pt-2 px-3 py-1.5 text-[10px] font-semibold tracking-wider text-[var(--ink-muted)] uppercase lg:block">
              Hệ thống & AI
            </div>
            {NAV_ITEMS.filter((i) => i.category === "system").map((n) => {
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={NAV_LINK_BASE}
                  activeProps={{
                    "aria-current": "page",
                    className: `${NAV_LINK_BASE} ${NAV_LINK_ACTIVE}`,
                  }}
                >
                  <Icon
                    className="h-4 w-4 text-[var(--ink-secondary)] group-hover:text-[var(--ink-primary)]"
                    aria-hidden="true"
                  />
                  <span>{n.label}</span>
                </Link>
              );
            })}

            <div className="my-1 border-t border-[var(--border-hairline)]" />
            <Link to="/" className={NAV_LINK_BASE}>
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
