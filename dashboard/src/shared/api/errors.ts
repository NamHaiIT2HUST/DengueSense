/**
 * Lỗi từ API: `application/problem+json` (RFC 9457) với `code` ổn định (contracts/errors.md).
 *
 * Giao diện dựa vào `code`, KHÔNG dựa vào `detail` (chuỗi của server có thể đổi). Lỗi 5xx không bao giờ hiển
 * thị `detail` thô cho người dùng — chỉ thông điệp chung kèm `request_id` để báo lại (docs/10 §7.3).
 */
import { vi } from "@/shared/i18n/vi";

export interface FieldError {
  field: string;
  message: string;
}

export interface ProblemDetails {
  type?: string;
  title?: string;
  status: number;
  code: string;
  detail?: string;
  instance?: string;
  request_id?: string;
  errors?: FieldError[];
}

export function isProblem(value: unknown): value is ProblemDetails {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.status === "number" && typeof v.code === "string";
}

/** Server trả lỗi (có mã trạng thái HTTP). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string | undefined;
  readonly requestId: string | undefined;
  readonly fieldErrors: FieldError[];

  constructor(init: {
    status: number;
    code: string;
    detail?: string | undefined;
    requestId?: string | undefined;
    fieldErrors?: FieldError[] | undefined;
  }) {
    super(`${init.code} (HTTP ${init.status})`);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.detail = init.detail;
    this.requestId = init.requestId;
    this.fieldErrors = init.fieldErrors ?? [];
  }

  /** Dựng từ thân lỗi của server; thân không phải problem+json (vd trang HTML 502 của proxy) → mã chung. */
  static fromResponse(body: unknown, response: Response): ApiError {
    const headerId = response.headers.get("x-request-id") ?? undefined;
    if (isProblem(body)) {
      return new ApiError({
        status: body.status,
        code: body.code,
        detail: body.detail,
        requestId: body.request_id ?? headerId,
        fieldErrors: body.errors,
      });
    }
    return new ApiError({
      status: response.status,
      code: "client.unexpected_response",
      requestId: headerId,
    });
  }
}

/** Không nhận được phản hồi (mất mạng, DNS, CORS…). */
export class NetworkError extends Error {
  constructor() {
    super("network_error");
    this.name = "NetworkError";
  }
}

/** Lập trình sai (vd thiếu Idempotency-Key) — phát hiện sớm khi dev/test, không dành cho người dùng. */
export class ClientContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientContractError";
  }
}

export type ErrorAction = "retry" | "login" | "reload" | "none";

export interface UserFacingError {
  message: string;
  action: ErrorAction;
  requestId?: string;
}

/** Chuyển mọi lỗi thành thông điệp tiếng Việt cho người dùng + hành động gợi ý. */
export function toUserFacing(err: unknown): UserFacingError {
  if (err instanceof NetworkError) {
    return { message: vi.errors.network, action: "retry" };
  }
  if (err instanceof ApiError) {
    const known = vi.errors.byCode[err.code];
    const action = actionFor(err.status);
    const base = known ?? (err.status >= 500 ? vi.errors.server : vi.errors.generic);
    // 5xx: không hiện chi tiết; luôn kèm request_id để người dùng báo lại.
    const out: UserFacingError = { message: base, action };
    if (err.requestId) out.requestId = err.requestId;
    return out;
  }
  return { message: vi.errors.generic, action: "retry" };
}

function actionFor(status: number): ErrorAction {
  if (status === 401) return "login";
  if (status === 409 || status === 412) return "reload";
  if (status === 429 || status >= 500) return "retry";
  return "none";
}
