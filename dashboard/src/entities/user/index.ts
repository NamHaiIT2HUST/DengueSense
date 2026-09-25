import { useSyncExternalStore } from "react";

import { session, type Role, type SessionState, type User } from "@/shared/api";

/** Phiên hiện tại (token + người dùng), tự cập nhật khi đăng nhập/đăng xuất/hết phiên. */
export function useSession(): SessionState {
  return useSyncExternalStore(session.subscribe, session.getState, session.getState);
}

/** Người dùng đang đăng nhập, hoặc null. */
export function useCurrentUser(): User | null {
  return useSession().user;
}

/** Người dùng có ÍT NHẤT MỘT trong các vai trò. Chỉ để ẩn/hiện giao diện — quyền thật do backend kiểm. */
export function hasAnyRole(user: User | null, ...roles: Role[]): boolean {
  return !!user && user.roles.some((r) => roles.includes(r));
}
