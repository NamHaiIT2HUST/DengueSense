/**
 * Phiên đăng nhập CHỈ trong bộ nhớ (docs/10 §14, ADR-0005): không localStorage/sessionStorage/cookie đọc được bằng JS.
 * Refresh token là cookie HttpOnly do backend đặt — JS không thấy. Tải lại trang → phiên mất → khôi phục bằng
 * `/auth/refresh` (cookie tự gửi).
 *
 * `getState()` trả CÙNG tham chiếu cho tới khi phiên đổi (yêu cầu của useSyncExternalStore).
 */
import type { User } from "./types";

export interface SessionState {
  accessToken: string | null;
  user: User | null;
}

type Listener = () => void;

const EMPTY: SessionState = { accessToken: null, user: null };

let state: SessionState = EMPTY;
const listeners = new Set<Listener>();

function set(next: SessionState) {
  state = next;
  for (const listener of listeners) listener();
}

export const session = {
  getState(): SessionState {
    return state;
  },
  getAccessToken(): string | null {
    return state.accessToken;
  },
  /** Mở/làm mới phiên với token và người dùng từ phản hồi đăng nhập/làm mới. */
  open(accessToken: string, user: User) {
    set({ accessToken, user });
  },
  clear() {
    if (state !== EMPTY) set(EMPTY);
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
