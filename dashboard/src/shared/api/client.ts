/**
 * Client API duy nhất của dashboard (docs/10 §7). Đây là NƠI DUY NHẤT gọi `fetch` tới backend.
 *
 *  - gắn `Authorization: Bearer` (trừ /auth/*) và `X-Request-ID` (hiện trong thông báo lỗi để báo lại);
 *  - bắt buộc `Idempotency-Key` cho mọi thao tác ghi (POST/PUT/PATCH/DELETE) ngoài /auth/* — thiếu là lỗi lập trình;
 *  - 401 → gọi refresh ĐÚNG MỘT LẦN cho mọi request song song → gửi lại; refresh thất bại → onAuthLost;
 *  - lỗi problem+json → ApiError (xem `unwrap`); mất mạng → NetworkError.
 */
import createClient, { type Middleware } from "openapi-fetch";

import { ApiError, ClientContractError, NetworkError } from "./errors";
import type { paths } from "./schema.gen";

export const HEADER_REQUEST_ID = "X-Request-ID";
export const HEADER_IDEMPOTENCY_KEY = "Idempotency-Key";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken: () => string | null;
  /** Gọi /auth/refresh; trả access token mới, hoặc null nếu phiên đã hết. */
  refreshAccessToken: () => Promise<string | null>;
  /** Phiên hết hẳn (refresh thất bại) — thường là xoá phiên và chuyển về trang đăng nhập. */
  onAuthLost: () => void;
  fetch?: typeof globalThis.fetch;
  newId?: () => string;
}

/** Sinh Idempotency-Key cho MỘT lần thao tác của người dùng; giữ nguyên khi thử lại (docs/09 §6.6). */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

function isAuthPath(schemaPath: string): boolean {
  return schemaPath.startsWith("/auth/");
}

export function createApiClient(options: ApiClientOptions) {
  const doFetch = options.fetch ?? ((input: Request) => globalThis.fetch(input));
  const newId = options.newId ?? (() => crypto.randomUUID());
  const client = createClient<paths>({ baseUrl: options.baseUrl, fetch: doFetch });

  // Bản sao request để gửi lại sau khi refresh (thân request chỉ đọc được một lần).
  const replayable = new Map<string, Request>();
  let refreshing: Promise<string | null> | null = null;

  const refreshOnce = (): Promise<string | null> => {
    refreshing ??= options.refreshAccessToken().finally(() => {
      refreshing = null;
    });
    return refreshing;
  };

  const middleware: Middleware = {
    onRequest({ request, schemaPath, id }) {
      const isWrite = WRITE_METHODS.has(request.method);
      if (isWrite && !isAuthPath(schemaPath) && !request.headers.has(HEADER_IDEMPOTENCY_KEY)) {
        throw new ClientContractError(
          `${request.method} ${schemaPath} thiếu header ${HEADER_IDEMPOTENCY_KEY} (dùng newIdempotencyKey())`
        );
      }
      request.headers.set(HEADER_REQUEST_ID, newId());
      const token = options.getAccessToken();
      if (token && !isAuthPath(schemaPath)) {
        request.headers.set("Authorization", `Bearer ${token}`);
      }
      if (!isAuthPath(schemaPath)) replayable.set(id, request.clone());
      return request;
    },

    async onResponse({ response, schemaPath, id }) {
      const original = replayable.get(id);
      replayable.delete(id);
      if (response.status !== 401 || isAuthPath(schemaPath) || !original) return response;

      // Request gửi bằng token cũ nhưng token đã được làm mới bởi request song song → chỉ gửi lại, không refresh nữa.
      const current = options.getAccessToken();
      const sentWith = original.headers.get("Authorization");
      const token = current && sentWith !== `Bearer ${current}` ? current : await refreshOnce();
      if (!token) {
        options.onAuthLost();
        return response;
      }
      const retry = new Request(original, { headers: original.headers });
      retry.headers.set("Authorization", `Bearer ${token}`);
      retry.headers.set(HEADER_REQUEST_ID, newId());
      const second = await doFetch(retry);
      if (second.status === 401) options.onAuthLost();
      return second;
    },

    onError({ id }) {
      replayable.delete(id);
      return new NetworkError();
    },
  };
  client.use(middleware);
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;

interface FetchResult<D> {
  data?: D;
  error?: unknown;
  response: Response;
}

/** Trả `data` nếu thành công; ngược lại ném ApiError (từ problem+json hoặc mã chung). */
export function unwrap<D>(result: FetchResult<D>): D {
  if (result.response.ok && result.data !== undefined) return result.data;
  if (result.response.ok) {
    throw new ApiError({ status: result.response.status, code: "client.empty_response" });
  }
  throw ApiError.fromResponse(result.error, result.response);
}

/** Như unwrap cho phản hồi không có thân (204). */
export function unwrapVoid(result: FetchResult<unknown>): void {
  if (result.response.ok) return;
  throw ApiError.fromResponse(result.error, result.response);
}
