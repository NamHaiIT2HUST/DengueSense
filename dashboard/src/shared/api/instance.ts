/**
 * Client API dùng chung của ứng dụng: nối `createApiClient` với phiên trong bộ nhớ.
 *
 *  - token lấy từ `session`; 401 → làm mới MỘT lần (single-flight) bằng cookie refresh HttpOnly;
 *  - làm mới thất bại → xoá phiên (giao diện tự chuyển về đăng nhập, xem ConsoleShell).
 */
import { env } from "@/shared/config/env";

import { createApiClient } from "./client";
import { session } from "./session";

export const api = createApiClient({
  baseUrl: env.VITE_API_BASE_URL,
  getAccessToken: () => session.getAccessToken(),
  refreshAccessToken,
  onAuthLost: () => session.clear(),
});

/**
 * Khôi phục phiên từ cookie refresh. Trả access token mới hoặc null nếu không có phiên hợp lệ.
 * Dùng khi tải lại trang (khởi động) và bởi client khi gặp 401.
 */
export async function refreshSession(): Promise<string | null> {
  return refreshAccessToken();
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const { data, response } = await api.POST("/auth/refresh");
    if (!response.ok || !data) return null;
    session.open(data.access_token, data.user);
    return data.access_token;
  } catch {
    return null; // mất mạng khi làm mới: coi như chưa có phiên; người dùng thử lại được
  }
}
