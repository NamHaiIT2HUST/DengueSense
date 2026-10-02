import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  api,
  newIdempotencyKey,
  qk,
  unwrap,
  type CreateForecastRunRequest,
  type Horizon,
  type RunMode,
} from "@/shared/api";

/** Danh mục đóng (34 tỉnh) — gần như không đổi. */
export function useProvinces() {
  return useQuery({
    queryKey: qk.provinces(),
    queryFn: async () => unwrap(await api.GET("/provinces")),
    staleTime: 60 * 60_000,
  });
}

/** Ranh giới tỉnh: có phiên bản, tải một lần (bất biến theo phiên bản). */
export function useGeometry() {
  return useQuery({
    queryKey: qk.geometry(),
    queryFn: async () => unwrap(await api.GET("/geo/provinces", { params: { query: {} } })),
    staleTime: Infinity,
  });
}

export function useForecastRuns(filter: { mode?: RunMode; limit?: number } = {}) {
  return useQuery({
    queryKey: qk.forecastRuns(filter),
    queryFn: async () => unwrap(await api.GET("/forecast-runs", { params: { query: filter } })),
    staleTime: 30_000,
  });
}

/** Bản đồ rủi ro của một lượt + tầm dự báo. Lượt đã hoàn tất là bất biến nên cache lâu; giữ dữ liệu cũ khi đổi tầm. */
export function useRiskMap(runId: string | undefined, horizon: Horizon) {
  return useQuery({
    queryKey: qk.riskMap(runId ?? "latest", horizon),
    queryFn: async () =>
      unwrap(
        await api.GET("/risk-map", {
          params: { query: { horizon, ...(runId ? { run_id: runId } : {}) } },
        })
      ),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useProvinceForecasts(provinceId: string, runId: string | undefined) {
  return useQuery({
    queryKey: qk.provinceForecasts(provinceId, runId ?? "latest"),
    queryFn: async () =>
      unwrap(
        await api.GET("/provinces/{province_id}/forecasts", {
          params: { path: { province_id: provinceId }, query: runId ? { run_id: runId } : {} },
        })
      ),
    staleTime: 5 * 60_000,
  });
}

export function useExplanation(provinceId: string, runId: string | undefined, horizon: Horizon) {
  return useQuery({
    queryKey: qk.provinceExplanation(provinceId, runId ?? "latest", horizon),
    queryFn: async () =>
      unwrap(
        await api.GET("/provinces/{province_id}/explanations", {
          params: {
            path: { province_id: provinceId },
            query: { horizon, ...(runId ? { run_id: runId } : {}) },
          },
        })
      ),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useObservations(provinceId: string, range: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: qk.observations(provinceId, range),
    queryFn: async () =>
      unwrap(
        await api.GET("/observations", {
          params: { query: { province_id: provinceId, ...range } },
        })
      ),
    staleTime: 60 * 60_000,
  });
}

/**
 * Tạo lượt dự báo (chạy nền → trả Job). Idempotency-Key MỚI cho mỗi lần người dùng bấm gửi; nếu lời gọi bị lặp ở tầng
 * mạng (client không tự thử lại thao tác ghi), gửi lại cùng key sẽ trả đúng job cũ (docs/09 §6.6).
 */
export function useCreateForecastRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateForecastRunRequest) => {
      const key = newIdempotencyKey();
      return unwrap(
        await api.POST("/forecast-runs", { params: { header: { "Idempotency-Key": key } }, body })
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["forecast-runs"] }),
  });
}

const JOB_POLL_MS = 1000;

/** Theo dõi job: hỏi lại mỗi giây cho tới khi kết thúc (succeeded/failed/cancelled). */
export function useJob(jobId: string | null) {
  return useQuery({
    queryKey: qk.job(jobId ?? "none"),
    enabled: jobId !== null,
    queryFn: async () =>
      unwrap(await api.GET("/jobs/{job_id}", { params: { path: { job_id: jobId as string } } })),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "succeeded" || status === "failed" || status === "cancelled"
        ? false
        : JOB_POLL_MS;
    },
  });
}
