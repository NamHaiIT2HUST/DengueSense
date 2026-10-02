import { createFileRoute, redirect } from "@tanstack/react-router";

import { LoginPage } from "@/features/auth";
import { session } from "@/shared/api";

export const Route = createFileRoute("/dang-nhap")({
  // `redirect` là đầu vào KHÔNG tin cậy: chỉ đọc dưới dạng chuỗi, kiểm bằng safeRedirect khi dùng.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === "string" ? { redirect: search.redirect } : {},
  // Đã đăng nhập thì không cần thấy trang đăng nhập.
  beforeLoad: () => {
    if (session.getAccessToken()) throw redirect({ to: "/app" });
  },
  component: function Login() {
    const { redirect: target } = Route.useSearch();
    return <LoginPage redirect={target} />;
  },
});
