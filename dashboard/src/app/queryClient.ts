import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/shared/api";

/**
 * Không thử lại lỗi 4xx (sai đầu vào/quyền/không thấy — thử lại vô ích); lỗi mạng và 5xx thử tối đa 2 lần.
 * `staleTime` mặc định 30 giây; từng query đặt riêng theo bản chất dữ liệu (docs/10 §6).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});
