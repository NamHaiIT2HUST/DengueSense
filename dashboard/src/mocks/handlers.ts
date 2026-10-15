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

import type {
  Alert,
  AllocationPlan,
  CaseDetail,
  CreateAllocationPlanRequest,
  CreateCaseRequest,
  CreateDraftRequest,
  DispatchDraft,
  DispatchOrder,
  ForecastRun,
  GenerateDraftCaseRequest,
  Horizon,
  Job,
  SubmitReviewRequest,
  UpdateDraftRequest,
  User,
} from "@/shared/api";
import { DEMO_ACCOUNTS } from "@/shared/config/demo";

import { httpDemoData, type DemoData, type DemoRunFile } from "./demoData";
import {
  limitationsFixture,
  modelCardFixture,
  modelVersionsFixture,
  provincesFixture,
} from "./fixtures";
import {
  alertsFixture,
  casesFixture,
  draftsFixture,
  ordersFixture,
  plansFixture,
} from "./workflowFixtures";

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

  // --- trạng thái workflow ---
  const alerts: Alert[] = alertsFixture.map((a) => ({ ...a }));
  const cases: CaseDetail[] = casesFixture.map((c) => ({
    ...c,
    alert_ids: c.alert_ids ? [...c.alert_ids] : [],
  }));
  const plans = new Map<string, AllocationPlan>(
    Object.entries(plansFixture).map(([k, v]) => [k, { ...v, allocations: [...v.allocations] }])
  );
  const drafts = new Map<string, DispatchDraft>(
    Object.entries(draftsFixture).map(([k, v]) => [k, { ...v }])
  );
  const orders: DispatchOrder[] = ordersFixture.map((o) => ({ ...o }));

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

    // ----- workflow: alerts -----
    http.get(`${base}/alerts`, ({ request }) => {
      if (!authed(request)) return unauthenticated();
      const url = new URL(request.url);
      const runId = url.searchParams.get("run_id");
      const provinceId = url.searchParams.get("province_id");
      const status = url.searchParams.get("status");

      const filtered = alerts.filter(
        (a) =>
          (!runId || a.run_id === runId) &&
          (!provinceId || a.province_id === provinceId) &&
          (!status || a.status === status)
      );
      return HttpResponse.json(filtered);
    }),
    http.post(`${base}/alerts/:alertId/confirm`, ({ request, params }) => {
      if (!authed(request)) return unauthenticated();
      const alert = alerts.find((a) => a.id === params.alertId);
      if (!alert) return problem(404, "workflow.alert_not_found", "Không tìm thấy cảnh báo");
      alert.status = "closed";
      return HttpResponse.json(alert);
    }),

    // ----- workflow: cases -----
    http.get(`${base}/cases`, ({ request }) => {
      if (!authed(request)) return unauthenticated();
      const url = new URL(request.url);
      const status = url.searchParams.get("status");
      const filtered = cases
        .filter((c) => !status || c.status === status)
        .map((c) => ({
          id: c.id,
          alert_id: c.alert_id,
          title: c.title,
          status: c.status,
          created_by: c.created_by,
          created_at: c.created_at,
        }));
      return HttpResponse.json(filtered);
    }),
    http.post(`${base}/cases`, async ({ request }) => {
      if (!authed(request)) return unauthenticated();
      const body = (await request.json().catch(() => null)) as CreateCaseRequest | null;
      if (!body || !body.title?.trim()) {
        return problem(400, "common.validation_error", "Tiêu đề không được để trống", [
          { field: "title", message: "Bắt buộc nhập tiêu đề" },
        ]);
      }
      const newCase: CaseDetail = {
        id: `case-${Date.now()}`,
        alert_id: body.alert_ids?.[0] ?? "alert-legacy",
        title: body.title.trim(),
        status: "open",
        created_by: body.created_by || "officer",
        created_at: new Date().toISOString(),
        alert_ids: body.alert_ids ?? [],
      };
      cases.unshift(newCase);
      return HttpResponse.json(
        {
          id: newCase.id,
          alert_id: newCase.alert_id,
          title: newCase.title,
          status: newCase.status,
          created_by: newCase.created_by,
          created_at: newCase.created_at,
        },
        { status: 201 }
      );
    }),
    http.get(`${base}/cases/:caseId`, ({ request, params }) => {
      if (!authed(request)) return unauthenticated();
      const found = cases.find((c) => c.id === params.caseId);
      if (!found) return problem(404, "workflow.case_not_found", "Không tìm thấy hồ sơ");
      return HttpResponse.json(found);
    }),

    // ----- workflow: allocation plans -----
    http.post(`${base}/cases/:caseId/allocation-plans`, async ({ request, params }) => {
      if (!authed(request)) return unauthenticated();
      const found = cases.find((c) => c.id === params.caseId);
      if (!found) return problem(404, "workflow.case_not_found", "Không tìm thấy hồ sơ");
      const body = (await request.json().catch(() => null)) as CreateAllocationPlanRequest | null;
      if (!body || typeof body.budget !== "number" || body.budget <= 0) {
        return problem(400, "common.validation_error", "Ngân sách không hợp lệ", [
          { field: "budget", message: "Ngân sách phải lớn hơn 0" },
        ]);
      }
      const planId = `plan-${Date.now()}`;
      const items = body.items ?? [];
      const totalCost = Math.min(body.budget, body.budget * 0.95);
      const estPrevented = Math.round(totalCost / 2_500_000);
      const newPlan: AllocationPlan = {
        id: planId,
        case_id: found.id,
        budget: body.budget,
        total_cost: totalCost,
        estimated_cases_prevented: estPrevented,
        allocations: items.map((it, idx) => {
          const costShare = Math.round(totalCost / Math.max(1, items.length));
          const beds = Math.max(10, Math.round(costShare / 12_500_000));
          const chemicals = Math.max(50, Math.round(costShare / 2_000_000));
          const teams = Math.max(2, Math.round(costShare / 100_000_000));
          return {
            province_id: it.province_id,
            amount: costShare,
            explanation: `Ưu tiên điểm nóng thứ ${idx + 1} (dự kiến ${it.cases_pred} ca). Phân bổ: ${beds} giường dã chiến, ${chemicals}L Cloramin B, ${teams} đội cơ động.`,
          };
        }),
        created_at: new Date().toISOString(),
      };
      plans.set(planId, newPlan);
      found.latest_plan_id = planId;
      return HttpResponse.json(newPlan, { status: 201 });
    }),

    // ----- workflow: drafts -----
    http.post(`${base}/cases/:caseId/drafts`, async ({ request, params }) => {
      if (!authed(request)) return unauthenticated();
      const found = cases.find((c) => c.id === params.caseId);
      if (!found) return problem(404, "workflow.case_not_found", "Không tìm thấy hồ sơ");
      const body = (await request.json().catch(() => null)) as CreateDraftRequest | null;
      if (!body || !body.content?.trim()) {
        return problem(400, "common.validation_error", "Nội dung dự thảo không được để trống", [
          { field: "content", message: "Bắt buộc" },
        ]);
      }
      const draftId = `draft-${Date.now()}`;
      const newDraft: DispatchDraft = {
        id: draftId,
        case_id: found.id,
        version: 1,
        draft_type: body.draft_type || "b2g",
        title: body.title || "Dự thảo công điện chỉ đạo",
        content: body.content,
        content_hash: `hash-${draftId}-v1`,
        status: "DRAFT",
        created_by: body.created_by || "officer",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      drafts.set(draftId, newDraft);
      found.latest_draft_id = draftId;
      return HttpResponse.json(newDraft, { status: 201 });
    }),
    http.post(`${base}/cases/:caseId/drafts/generate`, async ({ request, params }) => {
      if (!authed(request)) return unauthenticated();
      const found = cases.find((c) => c.id === params.caseId);
      if (!found) return problem(404, "workflow.case_not_found", "Không tìm thấy hồ sơ");
      const body = (await request.json().catch(() => null)) as GenerateDraftCaseRequest | null;
      const draftId = `draft-ai-${Date.now()}`;
      const draftType = body?.draft_type ?? "b2g";
      const title =
        body?.title ||
        (draftType === "b2g"
          ? "Công điện chỉ đạo khẩn cấp phòng chống dịch Sốt xuất huyết"
          : "Thông báo dịch tễ & Khuyến nghị thu dung điều trị bệnh viện");
      const generatedContent =
        draftType === "b2g"
          ? `## CÔNG ĐIỆN KHẨN CHỈ ĐẠO PHÒNG CHỐNG DỊCH SỐT XUẤT HUYẾT\n\n**Kính gửi:** Ban Chỉ đạo Phòng chống Dịch bệnh các tỉnh, thành phố và Trung tâm Kiểm soát Bệnh tật (CDC).\n\nCăn cứ vào kết quả mô hình dự báo dịch tễ (XGBoost + Random Forest, ERA5) và phương án tối ưu hoá phân bổ nguồn lực (Google OR-Tools) thuộc hồ sơ "${found.title}":\n\n1. **Kích hoạt phản ứng khẩn cấp:** Huy động đội cơ động phản ứng nhanh và bố trí cơ số giường bệnh thu dung dự phòng tại các cơ sở điều trị.\n2. **Tiếp nhận & cấp phát vật tư:** Khẩn trương tiếp nhận và phân bổ hóa chất Cloramin B, máy phun ULV theo định mức tối ưu đã phê duyệt cho các ổ dịch trọng điểm.\n3. **Giám sát & báo cáo dịch tễ:** Định kỳ tổng hợp, báo cáo ca mắc hàng ngày theo quy định tại Quyết định số 02/2016/QĐ-BYT của Bộ Y tế.\n\n${body?.extra_instructions ? `*Lưu ý chỉ đạo bổ sung:* ${body.extra_instructions}\n\n` : ""}Yêu cầu các đơn vị khẩn trương triển khai thực hiện nghiêm túc.`
          : `## THÔNG BÁO DỊCH TỄ & KHUYẾN NGHỊ THU DUNG ĐIỀU TRỊ\n\n**Kính gửi:** Ban Giám đốc các Bệnh viện Đa khoa và Bệnh viện Tư nhân trên địa bàn.\n\nCăn cứ vào cảnh báo sớm nguy cơ bùng phát dịch Sốt xuất huyết từ hệ thống DengueSense (chu kỳ dự báo sớm 1–6 tháng):\n\n1. **Chủ động công tác thu dung:** Chuẩn bị sẵn cơ số giường bệnh nội trú, dịch truyền chống sốc và thuốc thiết yếu theo phác đồ điều trị sốt xuất huyết của Bộ Y tế.\n2. **Thiết lập phân luồng:** Bố trí khu vực sàng lọc riêng tại khoa Khám bệnh để phát hiện sớm các dấu hiệu cảnh báo chuyển nặng.\n3. **Liên thông số liệu:** Thực hiện báo cáo ca bệnh nội trú qua hệ thống thông tin giám sát bệnh truyền nhiễm.\n\n${body?.extra_instructions ? `*Khuyến nghị đặc biệt:* ${body.extra_instructions}\n\n` : ""}Trân trọng thông báo đến các cơ sở y tế phối hợp thực hiện.`;
      const newDraft: DispatchDraft = {
        id: draftId,
        case_id: found.id,
        version: 1,
        draft_type: draftType,
        title,
        content: generatedContent,
        content_hash: `hash-${draftId}-v1`,
        status: "PENDING_REVIEW",
        created_by: currentUser()?.username || "officer",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      drafts.set(draftId, newDraft);
      found.latest_draft_id = draftId;
      return HttpResponse.json(newDraft, { status: 201 });
    }),
    http.get(`${base}/drafts/:draftId`, ({ request, params }) => {
      if (!authed(request)) return unauthenticated();
      const draft = drafts.get(String(params.draftId));
      if (!draft) return problem(404, "workflow.draft_not_found", "Không tìm thấy dự thảo");
      return HttpResponse.json(draft);
    }),
    http.patch(`${base}/drafts/:draftId`, async ({ request, params }) => {
      if (!authed(request)) return unauthenticated();
      const draft = drafts.get(String(params.draftId));
      if (!draft) return problem(404, "workflow.draft_not_found", "Không tìm thấy dự thảo");
      const body = (await request.json().catch(() => null)) as UpdateDraftRequest | null;
      if (!body) return problem(400, "common.validation_error", "Thiếu dữ liệu cập nhật");
      if (body.title) draft.title = body.title;
      if (body.content) draft.content = body.content;
      draft.version += 1;
      draft.content_hash = `hash-${draft.id}-v${draft.version}`;
      draft.updated_at = new Date().toISOString();
      return HttpResponse.json(draft);
    }),
    http.post(`${base}/drafts/:draftId/reviews`, async ({ request, params }) => {
      if (!authed(request)) return unauthenticated();
      const draft = drafts.get(String(params.draftId));
      if (!draft) return problem(404, "workflow.draft_not_found", "Không tìm thấy dự thảo");
      const body = (await request.json().catch(() => null)) as SubmitReviewRequest | null;
      if (!body) return problem(400, "common.validation_error", "Thiếu thông tin đánh giá");

      // Quy tắc 4 mắt (four-eyes principle) cho B2G
      const current = currentUser();
      if (
        draft.draft_type === "b2g" &&
        draft.created_by === current?.username &&
        body.action === "approve"
      ) {
        return problem(
          400,
          "workflow.four_eyes_violation",
          "Vi phạm quy tắc 4 mắt: người soạn văn bản B2G không được tự duyệt."
        );
      }

      if (body.action === "approve") {
        draft.status = "APPROVED";
      } else if (body.action === "reject") {
        draft.status = "REJECTED";
      } else {
        draft.status = "CHANGES_REQUESTED";
      }
      draft.updated_at = new Date().toISOString();

      return HttpResponse.json({
        id: `review-${Date.now()}`,
        draft_id: draft.id,
        draft_version: body.draft_version,
        reviewer_id: body.reviewer_id,
        action: body.action,
        note: body.note,
        reviewed_at: new Date().toISOString(),
        draft_status: draft.status,
      });
    }),
    http.post(`${base}/drafts/:draftId/dispatch`, async ({ request, params }) => {
      if (!authed(request)) return unauthenticated();
      const draft = drafts.get(String(params.draftId));
      if (!draft) return problem(404, "workflow.draft_not_found", "Không tìm thấy dự thảo");
      if (draft.status !== "APPROVED") {
        return problem(400, "workflow.draft_not_approved", "Dự thảo chưa được phê duyệt");
      }
      const body = (await request.json().catch(() => null)) as {
        recipient?: string;
        dispatched_by?: string;
      } | null;
      const order: DispatchOrder = {
        id: `order-${Date.now()}`,
        case_id: draft.case_id,
        draft_id: draft.id,
        recipient: body?.recipient || "CDC các tỉnh",
        content: draft.content,
        content_hash: draft.content_hash,
        status: "SENT",
        created_at: new Date().toISOString(),
      };
      orders.unshift(order);
      return HttpResponse.json(order, { status: 200 });
    }),
  ];
}
