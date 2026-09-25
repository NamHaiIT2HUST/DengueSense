import { describe, expect, it } from "vitest";

import { ApiError, NetworkError, isProblem, toUserFacing } from "./errors";

function response(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers });
}

describe("ApiError.fromResponse", () => {
  it("đọc problem+json: mã, chi tiết, request_id, lỗi từng trường", () => {
    const err = ApiError.fromResponse(
      {
        type: "https://denguesense.vn/errors/validation-error",
        title: "Đầu vào không hợp lệ",
        status: 400,
        code: "common.validation_error",
        detail: "sai",
        request_id: "req-1",
        errors: [{ field: "horizon", message: "bắt buộc" }],
      },
      response(400)
    );
    expect(err.status).toBe(400);
    expect(err.code).toBe("common.validation_error");
    expect(err.requestId).toBe("req-1");
    expect(err.fieldErrors).toEqual([{ field: "horizon", message: "bắt buộc" }]);
  });

  it("thân không phải problem+json (vd HTML 502 của proxy) → mã chung, lấy request-id từ header", () => {
    const err = ApiError.fromResponse(
      "<html>Bad gateway</html>",
      response(502, { "x-request-id": "hdr-9" })
    );
    expect(err.status).toBe(502);
    expect(err.code).toBe("client.unexpected_response");
    expect(err.requestId).toBe("hdr-9");
    expect(err.detail).toBeUndefined();
  });

  it("isProblem chỉ nhận đúng hình dạng", () => {
    expect(isProblem({ status: 400, code: "x.y" })).toBe(true);
    for (const bad of [
      null,
      undefined,
      "x",
      1,
      {},
      { status: "400", code: "x" },
      { status: 400 },
    ]) {
      expect(isProblem(bad)).toBe(false);
    }
  });
});

describe("toUserFacing", () => {
  it("mã đã biết → thông điệp tiếng Việt, 401 → đăng nhập lại, 409 → tải lại, 429 → thử lại", () => {
    expect(toUserFacing(new ApiError({ status: 401, code: "common.unauthenticated" })).action).toBe(
      "login"
    );
    expect(toUserFacing(new ApiError({ status: 409, code: "common.conflict" })).action).toBe(
      "reload"
    );
    expect(
      toUserFacing(new ApiError({ status: 412, code: "common.precondition_failed" })).action
    ).toBe("reload");
    expect(toUserFacing(new ApiError({ status: 429, code: "common.rate_limited" })).action).toBe(
      "retry"
    );
    expect(toUserFacing(new ApiError({ status: 403, code: "common.forbidden" })).message).toContain(
      "quyền"
    );
    expect(toUserFacing(new ApiError({ status: 404, code: "forecast.run_not_found" })).action).toBe(
      "none"
    );
  });

  it("5xx KHÔNG bao giờ hiện chi tiết của server, luôn kèm request_id để báo lại", () => {
    const out = toUserFacing(
      new ApiError({
        status: 500,
        code: "common.internal_error",
        detail: "pq: password authentication failed",
        requestId: "req-500",
      })
    );
    expect(out.message).not.toContain("pq:");
    expect(out.message).not.toContain("password");
    expect(out.requestId).toBe("req-500");
    expect(out.action).toBe("retry");
  });

  it("mã lạ → thông điệp chung theo nhóm trạng thái, không lộ mã/chi tiết", () => {
    const out4 = toUserFacing(new ApiError({ status: 400, code: "moi.ma_la", detail: "bí mật" }));
    expect(out4.message).not.toContain("bí mật");
    expect(out4.message).not.toContain("moi.ma_la");
    const out5 = toUserFacing(new ApiError({ status: 503, code: "moi.ma_la" }));
    expect(out5.message).toContain("sự cố");
  });

  it("mất mạng → thử lại; lỗi bất kỳ khác → thông điệp chung", () => {
    expect(toUserFacing(new NetworkError())).toMatchObject({ action: "retry" });
    expect(toUserFacing(new Error("Cannot read properties of undefined")).message).not.toContain(
      "undefined"
    );
    expect(toUserFacing("chuỗi").action).toBe("retry");
  });
});
