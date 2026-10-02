import { HttpResponse, delay, http } from "msw";
import { describe, expect, it, vi } from "vitest";

import { API_BASE, provincesFixture } from "@/mocks/handlers";
import { server } from "@/mocks/server";

import { createApiClient, newIdempotencyKey, unwrap, unwrapVoid } from "./client";
import { ApiError, ClientContractError, NetworkError } from "./errors";

function problem(status: number, code: string, requestId = "srv-req-1") {
  return HttpResponse.json(
    { type: "about:blank", title: code, status, code, request_id: requestId },
    { status, headers: { "content-type": "application/problem+json" } }
  );
}

/** Dựng client với token có thể đổi và bộ đếm gọi refresh / mất phiên. */
function setup(initialToken: string | null = "old-token", refreshTo: string | null = "new-token") {
  const state = { token: initialToken, refreshCalls: 0, authLost: 0 };
  const api = createApiClient({
    baseUrl: API_BASE,
    getAccessToken: () => state.token,
    refreshAccessToken: async () => {
      state.refreshCalls++;
      await delay(20);
      state.token = refreshTo;
      return refreshTo;
    },
    onAuthLost: () => {
      state.authLost++;
    },
    newId: () => "test-request-id",
  });
  return { api, state };
}

describe("gắn header", () => {
  it("gắn Authorization và X-Request-ID cho request thường", async () => {
    let seen: Headers | undefined;
    server.use(
      http.get(`${API_BASE}/provinces`, ({ request }) => {
        seen = request.headers;
        return HttpResponse.json({ items: provincesFixture });
      })
    );
    const { api } = setup("tok-1");
    const data = unwrap(await api.GET("/provinces"));

    expect(data.items).toHaveLength(2);
    expect(seen?.get("authorization")).toBe("Bearer tok-1");
    expect(seen?.get("x-request-id")).toBe("test-request-id");
  });

  it("KHÔNG gắn Authorization cho /auth/*", async () => {
    let seen: Headers | undefined;
    server.use(
      http.post(`${API_BASE}/auth/login`, ({ request }) => {
        seen = request.headers;
        return problem(401, "auth.invalid_credentials");
      })
    );
    const { api } = setup("tok-1");
    await api.POST("/auth/login", { body: { username: "a", password: "b" } });
    expect(seen?.get("authorization")).toBeNull();
    expect(seen?.get("x-request-id")).toBe("test-request-id");
  });
});

describe("Idempotency-Key", () => {
  it("thao tác ghi thiếu key là lỗi lập trình (ném ngay, không gửi request)", async () => {
    let called = false;
    server.use(
      http.post(`${API_BASE}/forecast-runs`, () => {
        called = true;
        return HttpResponse.json({}, { status: 202 });
      })
    );
    const { api } = setup();
    await expect(
      api.POST("/forecast-runs", {
        // @ts-expect-error — cố ý thiếu header bắt buộc để kiểm tra lớp bảo vệ lúc chạy (kiểu cũng chặn)
        params: { header: {} },
        body: { mode: "backtest", origin_month: "2010-03" },
      })
    ).rejects.toBeInstanceOf(ClientContractError);
    expect(called).toBe(false);
  });

  it("gửi key khi có; newIdempotencyKey sinh UUID khác nhau mỗi lần", async () => {
    let key: string | null = null;
    server.use(
      http.post(`${API_BASE}/forecast-runs`, ({ request }) => {
        key = request.headers.get("idempotency-key");
        return HttpResponse.json(
          {
            job_id: "j",
            kind: "forecast_run",
            status: "queued",
            created_at: "2026-09-25T00:00:00Z",
          },
          { status: 202 }
        );
      })
    );
    const { api } = setup();
    const k = newIdempotencyKey();
    await api.POST("/forecast-runs", {
      params: { header: { "Idempotency-Key": k } },
      body: { mode: "backtest", origin_month: "2010-03" },
    });
    expect(key).toBe(k);
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
    expect(k).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("unwrap / lỗi", () => {
  it("problem+json → ApiError có mã, HTTP và request_id", async () => {
    server.use(
      http.get(`${API_BASE}/provinces`, () => problem(403, "common.forbidden", "srv-403"))
    );
    const { api } = setup();
    const err = await (async () => unwrap(await api.GET("/provinces")))().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, code: "common.forbidden", requestId: "srv-403" });
  });

  it("phản hồi không phải problem+json (502 HTML) → mã chung, không ném lỗi phân tích", async () => {
    server.use(
      http.get(`${API_BASE}/provinces`, () =>
        HttpResponse.text("<html>Bad Gateway</html>", {
          status: 502,
          headers: { "x-request-id": "px-1" },
        })
      )
    );
    const { api } = setup();
    const err = await (async () => unwrap(await api.GET("/provinces")))().catch((e: unknown) => e);
    expect(err).toMatchObject({
      status: 502,
      code: "client.unexpected_response",
      requestId: "px-1",
    });
  });

  it("mất mạng → NetworkError", async () => {
    server.use(http.get(`${API_BASE}/provinces`, () => HttpResponse.error()));
    const { api } = setup();
    await expect(api.GET("/provinces")).rejects.toBeInstanceOf(NetworkError);
  });

  it("unwrapVoid chấp nhận 204 và ném lỗi khi thất bại", async () => {
    server.use(http.post(`${API_BASE}/auth/logout`, () => new HttpResponse(null, { status: 204 })));
    const { api } = setup();
    expect(() => unwrapVoid(undefinedResult())).not.toThrow();
    unwrapVoid(await api.POST("/auth/logout"));

    server.use(http.post(`${API_BASE}/auth/logout`, () => problem(401, "common.unauthenticated")));
    await expect(async () => unwrapVoid(await api.POST("/auth/logout"))).rejects.toBeInstanceOf(
      ApiError
    );
  });
});

function undefinedResult() {
  return { response: new Response(null, { status: 204 }) };
}

describe("401 → refresh → gửi lại", () => {
  /** Handler /provinces: 401 nếu token cũ, 200 nếu token mới. */
  function provincesByToken() {
    const seenTokens: string[] = [];
    server.use(
      http.get(`${API_BASE}/provinces`, ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        seenTokens.push(auth);
        if (auth === "Bearer new-token") return HttpResponse.json({ items: provincesFixture });
        return problem(401, "common.unauthenticated");
      })
    );
    return seenTokens;
  }

  it("token hết hạn → refresh rồi gửi lại thành công", async () => {
    const seen = provincesByToken();
    const { api, state } = setup();
    const data = unwrap(await api.GET("/provinces"));
    expect(data.items).toHaveLength(2);
    expect(state.refreshCalls).toBe(1);
    expect(state.authLost).toBe(0);
    expect(seen).toEqual(["Bearer old-token", "Bearer new-token"]);
  });

  it("nhiều request song song cùng nhận 401 → refresh ĐÚNG MỘT LẦN", async () => {
    provincesByToken();
    const { api, state } = setup();
    const results = await Promise.all([
      api.GET("/provinces"),
      api.GET("/provinces"),
      api.GET("/provinces"),
    ]);
    expect(results.every((r) => r.response.ok)).toBe(true);
    expect(state.refreshCalls).toBe(1);
  });

  it("401 đến muộn sau khi token đã được làm mới → chỉ gửi lại, KHÔNG refresh lần hai", async () => {
    const seen: string[] = [];
    server.use(
      http.get(`${API_BASE}/provinces`, async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        seen.push(auth);
        // Request chậm: 401 của nó về SAU khi request nhanh đã kịp refresh xong.
        if (request.headers.get("x-test") === "slow") await delay(150);
        return auth === "Bearer new-token"
          ? HttpResponse.json({ items: provincesFixture })
          : problem(401, "common.unauthenticated");
      })
    );
    const { api, state } = setup();
    const [slow, fast] = await Promise.all([
      api.GET("/provinces", { headers: { "x-test": "slow" } }),
      api.GET("/provinces"),
    ]);
    expect(slow.response.ok && fast.response.ok).toBe(true);
    expect(state.refreshCalls).toBe(1);
  });

  it("refresh thất bại (phiên hết) → onAuthLost đúng một lần, lỗi 401 được trả nguyên", async () => {
    provincesByToken();
    const { api, state } = setup("old-token", null);
    const err = await (async () => unwrap(await api.GET("/provinces")))().catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 401, code: "common.unauthenticated" });
    expect(state.authLost).toBe(1);
    expect(state.refreshCalls).toBe(1);
  });

  it("gửi lại vẫn 401 → onAuthLost (không lặp vô hạn)", async () => {
    server.use(http.get(`${API_BASE}/provinces`, () => problem(401, "common.unauthenticated")));
    const { api, state } = setup();
    const res = await api.GET("/provinces");
    expect(res.response.status).toBe(401);
    expect(state.refreshCalls).toBe(1);
    expect(state.authLost).toBe(1);
  });

  it("401 của /auth/login (sai mật khẩu) KHÔNG kích hoạt refresh", async () => {
    server.use(http.post(`${API_BASE}/auth/login`, () => problem(401, "auth.invalid_credentials")));
    const { api, state } = setup();
    const err = await (async () =>
      unwrap(await api.POST("/auth/login", { body: { username: "a", password: "b" } })))().catch(
      (e: unknown) => e
    );
    expect(err).toMatchObject({ status: 401, code: "auth.invalid_credentials" });
    expect(state.refreshCalls).toBe(0);
    expect(state.authLost).toBe(0);
  });

  it("request có thân (POST) được gửi lại đủ thân và CÙNG Idempotency-Key", async () => {
    const attempts: { auth: string | null; key: string | null; body: unknown }[] = [];
    server.use(
      http.post(`${API_BASE}/forecast-runs`, async ({ request }) => {
        const body: unknown = await request.json();
        const auth = request.headers.get("authorization");
        attempts.push({ auth, key: request.headers.get("idempotency-key"), body });
        if (auth !== "Bearer new-token") return problem(401, "common.unauthenticated");
        return HttpResponse.json(
          {
            job_id: "j1",
            kind: "forecast_run",
            status: "queued",
            created_at: "2026-09-25T00:00:00Z",
          },
          { status: 202 }
        );
      })
    );
    const { api, state } = setup();
    const key = newIdempotencyKey();
    const job = unwrap(
      await api.POST("/forecast-runs", {
        params: { header: { "Idempotency-Key": key } },
        body: { mode: "backtest", origin_month: "2010-03" },
      })
    );
    expect(job.job_id).toBe("j1");
    expect(state.refreshCalls).toBe(1);
    expect(attempts).toHaveLength(2);
    expect(attempts[1]?.body).toEqual({ mode: "backtest", origin_month: "2010-03" });
    expect(attempts.map((a) => a.key)).toEqual([key, key]);
  });
});

describe("không rò rỉ", () => {
  it("không có token thì không gửi Authorization", async () => {
    let auth: string | null = "x";
    server.use(
      http.get(`${API_BASE}/provinces`, ({ request }) => {
        auth = request.headers.get("authorization");
        return HttpResponse.json({ items: [] });
      })
    );
    const { api } = setup(null);
    await api.GET("/provinces");
    expect(auth).toBeNull();
  });

  it("không ghi token vào console", async () => {
    const spy = vi.spyOn(console, "log");
    const { api } = setup("tok-secret");
    await api.GET("/provinces");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
