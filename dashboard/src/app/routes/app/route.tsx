import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { ConsoleShell } from "@/app/layout/ConsoleShell";
import { ensureSession } from "@/features/auth";

/**
 * Cổng vào console: mọi route con đều đòi phiên. Tải lại trang → phiên trong bộ nhớ mất → thử khôi phục bằng cookie
 * refresh; không được thì về đăng nhập kèm đường dẫn để quay lại (đã kiểm ở LoginPage bằng safeRedirect).
 * Đây chỉ là UX — quyền thật do backend kiểm ở từng request (docs/10 §14).
 */
export const Route = createFileRoute("/app")({
  beforeLoad: async ({ location }) => {
    if (!(await ensureSession())) {
      throw redirect({ to: "/dang-nhap", search: { redirect: location.href } });
    }
  },
  component: function ConsoleLayout() {
    return (
      <ConsoleShell>
        <Outlet />
      </ConsoleShell>
    );
  },
});
