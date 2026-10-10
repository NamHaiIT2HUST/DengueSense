import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, qk, unwrap, type Alert } from "@/shared/api";

export interface AlertFilter {
  run_id?: string;
  province_id?: string;
  status?: "open" | "closed";
}

/** Danh sách cảnh báo rủi ro bùng phát dịch từ hệ thống. */
export function useAlerts(filter: AlertFilter = {}) {
  return useQuery({
    queryKey: qk.alerts(filter),
    queryFn: async () =>
      unwrap(
        await api.GET("/alerts", {
          params: { query: filter },
        })
      ),
    staleTime: 30_000,
  });
}

/** Xác nhận đã tiếp nhận cảnh báo (đóng cảnh báo). */
export function useConfirmAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) =>
      unwrap(
        await api.POST("/alerts/{alert_id}/confirm", {
          params: { path: { alert_id: alertId } },
        })
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

export type { Alert };
