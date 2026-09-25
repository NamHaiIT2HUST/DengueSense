import { Link, Outlet, createRootRoute } from "@tanstack/react-router";

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-5xl font-semibold text-[var(--ink-primary)]">404</p>
      <p className="text-sm text-[var(--ink-secondary)]">Không tìm thấy trang bạn yêu cầu.</p>
      <Link
        to="/"
        className="rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm text-[var(--ink-primary)] hover:bg-[var(--bg-surface-hover)]"
      >
        Về trang chủ
      </Link>
    </div>
  );
}

export const Route = createRootRoute({
  component: Outlet,
  notFoundComponent: NotFound,
});
