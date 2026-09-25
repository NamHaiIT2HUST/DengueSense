/**
 * Handler MSW khớp hợp đồng public-v1.yaml, dùng cho (1) test (Node) và (2) chế độ demo trong trình duyệt.
 * Backend chưa có vẫn làm frontend song song được (docs/10 §7.4).
 *
 * `createHandlers(base, store)`: `base` tuyệt đối trong Node ("http://localhost/api/v1"), tương đối trong trình duyệt
 * ("/api/v1"). `store` giữ "phiên demo" — thay cho cookie refresh HttpOnly mà MSW không đặt được: trong demo dùng
 * sessionStorage (chỉ là giá trị GIẢ để mô phỏng, không phải bí mật thật).
 */
import { HttpResponse, http } from "msw";

import type { User } from "@/shared/api";
import { DEMO_ACCOUNTS } from "@/shared/config/demo";

import {
  limitationsFixture,
  modelCardFixture,
  modelVersionsFixture,
  provincesFixture,
} from "./fixtures";

export { provincesFixture, userFixture } from "./fixtures";

export const API_BASE = "http://localhost/api/v1";

/** Kho phiên demo: chỉ cần đọc/ghi/xoá một chuỗi. */
export interface DemoStore {
  get(): string | null;
  set(value: string): void;
  clear(): void;
}

export function memoryStore(): DemoStore {
  let v: string | null = null;
  return { get: () => v, set: (x) => void (v = x), clear: () => void (v = null) };
}

export function sessionStorageStore(key = "denguesense.demo.session"): DemoStore {
  return {
    get: () => sessionStorage.getItem(key),
    set: (v) => sessionStorage.setItem(key, v),
    clear: () => sessionStorage.removeItem(key),
  };
}

const ACCESS_PREFIX = "demo-access-";

function problem(status: number, code: string, title: string) {
  return HttpResponse.json(
    {
      type: `https://denguesense.vn/errors/${code.split(".")[1]?.replaceAll("_", "-")}`,
      title,
      status,
      code,
      request_id: "demo-request",
    },
    { status, headers: { "content-type": "application/problem+json" } }
  );
}

function toUser(username: string): User | null {
  const acc = DEMO_ACCOUNTS.find((a) => a.username === username);
  return acc
    ? {
        id: `demo-${acc.username}`,
        username: acc.username,
        display_name: acc.displayName,
        roles: acc.roles,
        org_id: "cdc-demo",
      }
    : null;
}

export function createHandlers(base: string, store: DemoStore = memoryStore()) {
  let counter = 0;
  const newAccess = () => `${ACCESS_PREFIX}${++counter}-${Math.random().toString(36).slice(2, 8)}`;
  const authed = (request: Request) =>
    (request.headers.get("authorization") ?? "").startsWith(`Bearer ${ACCESS_PREFIX}`);
  const unauthenticated = () => problem(401, "common.unauthenticated", "Chưa xác thực");
  const tokenResponse = (user: User) =>
    HttpResponse.json({ access_token: newAccess(), token_type: "Bearer", expires_in: 900, user });

  return [
    http.post(`${base}/auth/login`, async ({ request }) => {
      const body = (await request.json().catch(() => null)) as {
        username?: string;
        password?: string;
      } | null;
      const acc = DEMO_ACCOUNTS.find((a) => a.username === body?.username?.trim().toLowerCase());
      if (!acc || acc.password !== body?.password) {
        return problem(401, "auth.invalid_credentials", "Sai tên đăng nhập hoặc mật khẩu");
      }
      store.set(acc.username);
      return tokenResponse(toUser(acc.username) as User);
    }),
    http.post(`${base}/auth/refresh`, () => {
      const username = store.get();
      const user = username ? toUser(username) : null;
      return user
        ? tokenResponse(user)
        : problem(401, "auth.refresh_invalid", "Phiên không hợp lệ");
    }),
    http.post(`${base}/auth/logout`, () => {
      store.clear();
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(`${base}/me`, ({ request }) => {
      const username = store.get();
      const user = username ? toUser(username) : null;
      return authed(request) && user ? HttpResponse.json(user) : unauthenticated();
    }),
    http.get(`${base}/provinces`, ({ request }) =>
      authed(request) ? HttpResponse.json({ items: provincesFixture }) : unauthenticated()
    ),
    http.get(`${base}/model-card`, ({ request }) =>
      authed(request) ? HttpResponse.json(modelCardFixture) : unauthenticated()
    ),
    http.get(`${base}/model-card/limitations`, ({ request }) =>
      authed(request)
        ? HttpResponse.json({
            model_version: modelCardFixture.model_version,
            items: limitationsFixture,
          })
        : unauthenticated()
    ),
    http.get(`${base}/model-versions`, ({ request }) =>
      authed(request) ? HttpResponse.json({ items: modelVersionsFixture }) : unauthenticated()
    ),
  ];
}

/** Handler mặc định cho test Node (URL tuyệt đối, kho trong bộ nhớ). */
export const handlers = createHandlers(API_BASE);
