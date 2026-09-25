/**
 * Nhà máy khoá TanStack Query (docs/10 §6): MỌI query dùng khoá từ đây — không viết mảng khoá rải rác,
 * để invalidation và prefetch nhất quán. Khoá phản chiếu tài nguyên của hợp đồng.
 */
import type { Horizon } from "./types";

export const qk = {
  me: () => ["me"] as const,
  provinces: () => ["provinces"] as const,
  modelCard: () => ["model-card"] as const,
  limitations: () => ["model-card", "limitations"] as const,
  forecastRuns: (filter: { mode?: string; status?: string } = {}) =>
    ["forecast-runs", filter] as const,
  forecastRun: (runId: string) => ["forecast-run", runId] as const,
  riskMap: (runId: string | "latest", horizon: Horizon) => ["risk-map", runId, horizon] as const,
  provinceForecasts: (provinceId: string, runId: string | "latest") =>
    ["province", provinceId, "forecasts", runId] as const,
  provinceExplanation: (provinceId: string, runId: string | "latest", horizon: Horizon) =>
    ["province", provinceId, "explanation", runId, horizon] as const,
  observations: (provinceId: string, range: { from?: string; to?: string } = {}) =>
    ["observations", provinceId, range] as const,
  job: (jobId: string) => ["job", jobId] as const,
};
