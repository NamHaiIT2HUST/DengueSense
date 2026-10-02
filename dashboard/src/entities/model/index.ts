import { useQuery } from "@tanstack/react-query";

import { api, qk, unwrap } from "@/shared/api";

/** Model card của phiên bản mô hình đang dùng. Đổi theo phiên bản nên cache vừa phải (5 phút). */
export function useModelCard() {
  return useQuery({
    queryKey: qk.modelCard(),
    queryFn: async () => unwrap(await api.GET("/model-card")),
    staleTime: 5 * 60_000,
  });
}

/** Danh sách giới hạn đã biết (đo được) của mô hình. */
export function useLimitations() {
  return useQuery({
    queryKey: qk.limitations(),
    queryFn: async () => unwrap(await api.GET("/model-card/limitations")),
    staleTime: 5 * 60_000,
  });
}
