import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, type ReactNode } from "react";

import { useSession } from "@/entities/user";
import { logout } from "@/features/auth";
import { env } from "@/shared/config/env";
import { vi } from "@/shared/i18n/vi";
import { Alert } from "@/shared/ui/Alert";
import { Button } from "@/shared/ui/Button";

const NAV = [
  { to: "/app/ban-do", label: vi.nav.map },
  { to: "/app/luot-du-bao", label: vi.nav.runs },
  { to: "/app/mo-hinh", label: vi.nav.model },
] as const;

const NAV_LINK =
  "rounded-full px-3 py-1.5 text-sm text-[var(--ink-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--ink-primary)]";

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

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--accent-solid)] focus:px-4 focus:py-2 focus:text-white"
      >
        {vi.nav.skipToContent}
      </a>

      <header className="glass-panel sticky top-0 z-40 flex items-center justify-between gap-4 border-x-0 border-t-0 px-6 py-3">
        <Link to="/app" className="font-display text-lg font-semibold">
          {vi.appName}
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-[var(--ink-secondary)] sm:inline">
            {vi.auth.signedInAs}:{" "}
            <strong className="text-[var(--ink-primary)]">{user?.display_name}</strong>
          </span>
          <Button variant="secondary" onClick={() => void onLogout()}>
            {vi.auth.logout}
          </Button>
        </div>
      </header>

      {env.VITE_APP_MODE === "demo" ? (
        <div className="px-6 pt-4">
          <Alert tone="info">{vi.auth.demoBanner}</Alert>
        </div>
      ) : null}

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label={vi.nav.console} className="flex flex-wrap gap-2 lg:flex-col">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={NAV_LINK}
              activeProps={{
                "aria-current": "page",
                className: `${NAV_LINK} bg-[var(--accent-soft)] text-[var(--accent-ink)]`,
              }}
            >
              {n.label}
            </Link>
          ))}
          <Link to="/" className={NAV_LINK}>
            {vi.nav.home}
          </Link>
        </nav>
        <main id="main" tabIndex={-1} className="min-w-0 outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
