import { api, refreshSession, session, unwrap, type User } from "@/shared/api";

/** Đăng nhập: thành công thì mở phiên (token trong bộ nhớ; refresh token là cookie HttpOnly do backend đặt). */
export async function login(username: string, password: string): Promise<User> {
  const data = unwrap(await api.POST("/auth/login", { body: { username, password } }));
  session.open(data.access_token, data.user);
  return data.user;
}

/**
 * Đăng xuất: thu hồi phiên phía server (best-effort) và LUÔN xoá phiên cục bộ — kể cả khi mạng lỗi, người dùng
 * vẫn phải thấy mình đã đăng xuất.
 */
export async function logout(): Promise<void> {
  try {
    await api.POST("/auth/logout");
  } catch {
    // bỏ qua: xoá phiên cục bộ ngay dưới đây
  } finally {
    session.clear();
  }
}

let pending: Promise<boolean> | null = null;

/**
 * Bảo đảm có phiên: đã có token → true; chưa có (vừa tải lại trang) → thử khôi phục bằng cookie refresh.
 * Nhiều nơi gọi cùng lúc dùng chung MỘT lần làm mới.
 */
export function ensureSession(): Promise<boolean> {
  if (session.getAccessToken()) return Promise.resolve(true);
  pending ??= refreshSession()
    .then((token) => token !== null)
    .finally(() => {
      pending = null;
    });
  return pending;
}
