/**
 * Access token CHỈ nằm trong bộ nhớ (docs/10 §14, ADR-0005): không localStorage/sessionStorage, không cookie
 * đọc được bằng JS. Refresh token là cookie HttpOnly do backend đặt — JS không thấy.
 *
 * Tải lại trang → token mất → gọi /auth/refresh (cookie tự gửi) để lấy lại.
 */
type Listener = () => void;

let accessToken: string | null = null;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

export const session = {
  getAccessToken(): string | null {
    return accessToken;
  },
  setAccessToken(token: string) {
    accessToken = token;
    notify();
  },
  clear() {
    accessToken = null;
    notify();
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
