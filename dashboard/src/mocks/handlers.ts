/**
 * Handler MSW khớp hợp đồng public-v1.yaml, dùng cho (1) test (Node) và (2) chế độ demo trong trình duyệt.
 * Backend chưa có vẫn làm frontend song song được (docs/10 §7.4).
 *
 * `createHandlers(base, store, data, opts)`:
 *  - `base`: tuyệt đối trong Node ("http://localhost/api/v1"), tương đối trong trình duyệt ("/api/v1");
 *  - `store`: "phiên demo" — thay cho cookie refresh HttpOnly mà MSW không đặt được (sessionStorage trong demo; chỉ là
 *    giá trị GIẢ để mô phỏng, không phải bí mật thật);
 *  - `data`: nguồn dữ liệu dự báo THẬT của tái hiện lịch sử exp_016 (xem demoData.ts) — máy chủ giả chỉ cắt/ghép,
 *    không tự sinh số.
 */
import { HttpResponse, http } from "msw";

import type { ForecastRun, Horizon, Job, User } from "@/shared/api";
import { DEMO_ACCOUNTS } from "@/shared/config/demo";

import { httpDemoData, type DemoData, type DemoRunFile } from "./demoData";
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

export interface HandlerOptions {
  /** Thời gian một job "chạy" (ms) trước khi báo thành công. Test đặt nhỏ. */
  jobDurationMs?: number;
}

const ACCESS_PREFIX = "demo-access-";
const HORIZONS: readonly Horizon[] = [1, 2, 3, 6];
const LAST_BACKTEST_ORIGIN = "2010-06";
const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function problem(
  status: number,
  code: string,
  title: string,
  errors?: { field: string; message: string }[]
) {
  return HttpResponse.json(
    {
      type: `https://denguesense.vn/errors/${code.split(".")[1]?.replaceAll("_", "-")}`,
      title,
      status,
      code,
      request_id: "demo-request",
      ...(errors ? { errors } : {}),
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

/** Lượt mới nhất trước: theo thời điểm tạo, hoà thì tháng neo mới hơn trước. */
function newestFirst(a: ForecastRun, b: ForecastRun): number {
  return b.created_at.localeCompare(a.created_at) || b.origin_month.localeCompare(a.origin_month);
}

interface JobRecord {
  id: string;
  runId: string;
  createdMs: number;
  createdAt: string;
}

export function createHandlers(
  base: string,
  store: DemoStore = memoryStore(),
  data: DemoData = httpDemoData(),
  opts: HandlerOptions = {}
) {
  const jobDurationMs = opts.jobDurationMs ?? 2500;
  let counter = 0;
  const newAccess = () => `${ACCESS_PREFIX}${++counter}-${Math.random().toString(36).slice(2, 8)}`;
  const authed = (request: Request) =>
    (request.headers.get("authorization") ?? "").startsWith(`Bearer ${ACCESS_PREFIX}`);
  const unauthenticated = () => problem(401, "common.unauthenticated", "Chưa xác thực");
  const tokenResponse = (user: User) =>
    HttpResponse.json({ access_token: newAccess(), token_type: "Bearer", expires_in: 900, user });
  const currentUser = () => {
    const username = store.get();
    return username ? toUser(username) : null;
  };

  // --- trạng thái job (mỗi bộ handler một kho, như một server nhỏ) ---
  const jobs = new Map<string, JobRecord>();
  const jobsByKey = new Map<string, string>();

  const jobView = (rec: JobRecord): Job => {
    const elapsed = Date.now() - rec.createdMs;
    const queuedMs = Math.min(400, jobDurationMs / 4);
    if (elapsed < queuedMs) {
      return {
        job_id: rec.id,
        kind: "forecast_run",
        status: "queued",
        progress: 0,
        result_ref: null,
        error_code: null,
        created_at: rec.createdAt,
        finished_at: null,
      };
    }
    if (elapsed < jobDurationMs) {
      const progress = Math.min(0.95, (elapsed - queuedMs) / (jobDurationMs - queuedMs));
      return {
        job_id: rec.id,
        kind: "forecast_run",
        status: "running",
        progress,
        result_ref: null,
        error_code: null,
        created_at: rec.createdAt,
        finished_at: null,
      };
    }
    return {
      job_id: rec.id,
      kind: "forecast_run",
      status: "succeeded",
      progress: 1,
      result_ref: `/api/v1/forecast-runs/${rec.runId}`,
      error_code: null,
      created_at: rec.createdAt,
      finished_at: new Date(rec.createdMs + jobDurationMs).toISOString(),
    };
  };

  /** Tìm lượt theo `run_id`, hoặc lượt `completed` mới nhất. Trả lỗi problem nếu không có. */
  async function resolveRun(
    runId: string | null
  ): Promise<{ run: ForecastRun; file: DemoRunFile } | { error: Response }> {
    const index = await data.index();
    let run: ForecastRun | undefined;
    if (runId) {
      run = index.runs.find((r) => r.run_id === runId);
      if (!run)
        return { error: problem(404, "forecast.run_not_found", "Không tìm thấy lượt dự báo") };
    } else {
      run = [...index.runs].filter((r) => r.status === "completed").sort(newestFirst)[0];
      if (!run)
        return { error: problem(404, "forecast.no_completed_run", "Chưa có lượt hoàn tất") };
    }
    if (run.status !== "completed") {
      return { error: problem(409, "forecast.run_not_ready", "Lượt dự báo chưa chạy xong") };
    }
    const file = await data.run(run.origin_month);
    if (!file)
      return { error: problem(404, "forecast.run_not_found", "Không tìm thấy lượt dự báo") };
    return { run, file };
  }

  const parseHorizon = (raw: string | null): Horizon | null => {
    const n = Number(raw);
    return HORIZONS.find((h) => h === n) ?? null;
  };

  const metaOf = (run: ForecastRun, file: DemoRunFile) => ({
    run_id: run.run_id,
    run_mode: run.run_mode,
    model_version: run.model_version,
    data_version: run.data_version,
    origin_month: run.origin_month,
    as_of: file.as_of,
    generated_at: run.created_at,
    limitations_ref: "/api/v1/model-card/limitations",
  });

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
      const user = currentUser();
      return user
        ? tokenResponse(user)
        : problem(401, "auth.refresh_invalid", "Phiên không hợp lệ");
    }),
    http.post(`${base}/auth/logout`, () => {
      store.clear();
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(`${base}/me`, ({ request }) => {
      const user = currentUser();
      return authed(request) && user ? HttpResponse.json(user) : unauthenticated();
    }),

    // ----- danh mục -----
    http.get(`${base}/provinces`, async ({ request }) => {
      if (!authed(request)) return unauthenticated();
      const index = await data.index().catch(() => null);
      return HttpResponse.json({ items: index?.provinces ?? provincesFixture });
    }),
    http.get(`${base}/provinces/:provinceId`, async ({ request, params }) => {
      if (!authed(request)) return unauthenticated();
      const found = (await data.index()).provinces.find((p) => p.province_id === params.provinceId);
      return found
        ? HttpResponse.json(found)
        : problem(404, "surveillance.province_not_found", "Không tìm thấy tỉnh");
    }),
    http.get(`${base}/geo/provinces`, async ({ request }) => {
      if (!authed(request)) return unauthenticated();
      return new HttpResponse(JSON.stringify(await data.geometry()), {
        headers: { "content-type": "application/geo+json" },
      });
    }),
    http.get(`${base}/data-versions`, async ({ request }) => {
      if (!authed(request)) return unauthenticated();
      return HttpResponse.json({ items: (await data.index()).data_versions });
    }),
    http.get(`${base}/observations`, async ({ request }) => {
      if (!authed(request)) return unauthenticated();
      const url = new URL(request.url);
      const provinceId = url.searchParams.get("province_id");
      if (!provinceId) {
        return problem(400, "common.validation_error", "Thiếu tham số", [
          { field: "province_id", message: "Bắt buộc" },
        ]);
      }
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const series = (await data.observations())[provinceId];
      if (!series) return problem(404, "surveillance.province_not_found", "Không tìm thấy tỉnh");
      const [sy, sm] = series.start.split("-").map(Number) as [number, number];
      const items = series.cases.flatMap((cases, i) => {
        if (cases == null) return [];
        const t = sy * 12 + (sm - 1) + i;
        const month = `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
        if ((from && month < from) || (to && month > to)) return [];
        return [
          {
            month,
            cases,
            incidence_per_100k: series.incidence_per_100k[i] ?? null,
            data_source: (series.data_source[i] ?? "real") as
              "real" | "estimated" | "imputed" | "simulated",
          },
        ];
      });
      return HttpResponse.json({
        data_version: (await data.index()).data_versions[0]?.version ?? "v0.2.0",
        items,
      });
    }),

    // ----- lượt dự báo -----
    http.get(`${base}/forecast-runs`, async ({ request }) => {
      if (!authed(request)) return unauthenticated();
      const url = new URL(request.url);
      const mode = url.searchParams.get("mode");
      const status = url.searchParams.get("status");
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));
      const offset = Number(url.searchParams.get("cursor") ?? 0) || 0;
      const all = [...(await data.index()).runs]
        .filter((r) => (!mode || r.run_mode === mode) && (!status || r.status === status))
        .sort(newestFirst);
      const page = all.slice(offset, offset + limit);
      const next = offset + limit < all.length ? String(offset + limit) : null;
      return HttpResponse.json({ items: page, next_cursor: next });
    }),
    http.post(`${base}/forecast-runs`, async ({ request }) => {
      if (!authed(request)) return unauthenticated();
      const user = currentUser();
      if (
        !user?.roles.some((r) =>
          ["analyst", "officer", "approver", "data_manager", "admin"].includes(r)
        )
      ) {
        return problem(403, "common.forbidden", "Không đủ quyền");
      }
      const key = request.headers.get("idempotency-key");
      if (!key) return problem(400, "common.idempotency_key_required", "Thiếu Idempotency-Key");
      const existing = jobsByKey.get(key);
      const found = existing ? jobs.get(existing) : undefined;
      if (found)
        return HttpResponse.json(jobView(found), {
          status: 202,
          headers: { Location: `/api/v1/jobs/${found.id}` },
        });

      const body = (await request.json().catch(() => null)) as {
        mode?: string;
        origin_month?: string;
      } | null;
      if (!body || typeof body.origin_month !== "string" || !YEAR_MONTH.test(body.origin_month)) {
        return problem(400, "common.validation_error", "Đầu vào không hợp lệ", [
          { field: "origin_month", message: "Định dạng YYYY-MM" },
        ]);
      }
      if (body.mode !== "backtest") {
        return problem(
          409,
          "forecast.model_not_approved",
          "Chưa có mô hình được duyệt để chạy trực tiếp"
        );
      }
      if (body.origin_month > LAST_BACKTEST_ORIGIN) {
        return problem(400, "forecast.origin_out_of_range", "Tháng neo ngoài khoảng cho phép");
      }
      const target = (await data.index()).runs.find((r) => r.origin_month === body.origin_month);
      if (!target) {
        return problem(400, "common.validation_error", "Bản demo chưa có tháng neo này", [
          {
            field: "origin_month",
            message: "Bản demo chỉ có sẵn các tháng neo từ 2009-11 đến 2010-06",
          },
        ]);
      }
      const rec: JobRecord = {
        id: crypto.randomUUID(),
        runId: target.run_id,
        createdMs: Date.now(),
        createdAt: new Date().toISOString(),
      };
      jobs.set(rec.id, rec);
      jobsByKey.set(key, rec.id);
      return HttpResponse.json(jobView(rec), {
        status: 202,
        headers: { Location: `/api/v1/jobs/${rec.id}` },
      });
    }),
    http.get(`${base}/forecast-runs/:runId`, async ({ request, params }) => {
      if (!authed(request)) return unauthenticated();
      const run = (await data.index()).runs.find((r) => r.run_id === params.runId);
      return run
        ? HttpResponse.json(run)
        : problem(404, "forecast.run_not_found", "Không tìm thấy lượt dự báo");
    }),
    http.get(`${base}/jobs/:jobId`, ({ request, params }) => {
      if (!authed(request)) return unauthenticated();
      const rec = jobs.get(String(params.jobId));
      return rec
        ? HttpResponse.json(jobView(rec))
        : problem(404, "common.not_found", "Không tìm thấy");
    }),

    // ----- kết quả dự báo -----
    http.get(`${base}/risk-map`, async ({ request }) => {
      if (!authed(request)) return unauthenticated();
      const url = new URL(request.url);
      const horizon = parseHorizon(url.searchParams.get("horizon"));
      if (horizon === null) {
        return problem(400, "common.validation_error", "Tham số không hợp lệ", [
          { field: "horizon", message: "Chỉ nhận 1, 2, 3 hoặc 6" },
        ]);
      }
      const resolved = await resolveRun(url.searchParams.get("run_id"));
      if ("error" in resolved) return resolved.error;
      const { run, file } = resolved;
      const provinces = (await data.index()).provinces;
      const byProvince = new Map(
        file.items.filter((i) => i.horizon === horizon).map((i) => [i.province_id, i] as const)
      );
      return HttpResponse.json({
        meta: metaOf(run, file),
        horizon,
        legend: {
          exceed_prob: file.legend_exceed_prob,
          cases_per_100k: file.legend_cases_per_100k,
        },
        items: provinces.map((p) => ({
          province_id: p.province_id,
          name: p.name,
          region: p.region,
          forecast: byProvince.get(p.province_id) ?? null,
          open_alert_count: 0,
        })),
        warnings: [],
      });
    }),
    http.get(`${base}/provinces/:provinceId/forecasts`, async ({ request, params }) => {
      if (!authed(request)) return unauthenticated();
      const provinceId = String(params.provinceId);
      const known = (await data.index()).provinces.some((p) => p.province_id === provinceId);
      if (!known) return problem(404, "surveillance.province_not_found", "Không tìm thấy tỉnh");
      const resolved = await resolveRun(new URL(request.url).searchParams.get("run_id"));
      if ("error" in resolved) return resolved.error;
      const { run, file } = resolved;
      return HttpResponse.json({
        meta: metaOf(run, file),
        items: file.items
          .filter((i) => i.province_id === provinceId)
          .sort((a, b) => a.horizon - b.horizon),
      });
    }),
    http.get(`${base}/provinces/:provinceId/explanations`, async ({ request, params }) => {
      if (!authed(request)) return unauthenticated();
      const url = new URL(request.url);
      const horizon = parseHorizon(url.searchParams.get("horizon"));
      if (horizon === null) {
        return problem(400, "common.validation_error", "Tham số không hợp lệ", [
          { field: "horizon", message: "Chỉ nhận 1, 2, 3 hoặc 6" },
        ]);
      }
      const provinceId = String(params.provinceId);
      const resolved = await resolveRun(url.searchParams.get("run_id"));
      if ("error" in resolved) return resolved.error;
      const { run, file } = resolved;
      const expl = file.explanations[`${provinceId}|${horizon}`];
      if (!expl)
        return problem(404, "surveillance.province_not_found", "Không có giải thích cho tỉnh này");
      return HttpResponse.json({
        meta: metaOf(run, file),
        province_id: provinceId,
        horizon,
        explained_component: "m2b_lightgbm_poisson",
        base_value: expl.base_value,
        factors: expl.factors,
      });
    }),

    // ----- mô hình -----
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
