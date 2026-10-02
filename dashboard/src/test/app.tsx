import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { RequestHandler } from "msw";

import { routeTree } from "@/app/routeTree.gen";
import { API_BASE, createHandlers, memoryStore, type DemoStore } from "@/mocks/handlers";
import { nodeDemoData } from "@/mocks/nodeDemoData";
import { server } from "@/mocks/server";

/** Dựng CẢ ỨNG DỤNG (router thật + route thật) trên lịch sử bộ nhớ, với máy chủ giả có kho phiên riêng cho test này. */
export function renderApp(
  initialPath: string,
  opts: { store?: DemoStore; overrides?: RequestHandler[] } = {}
) {
  const store = opts.store ?? memoryStore();
  // `server.use` đặt handler mới lên ĐẦU danh sách: cài mặc định trước, ghi đè sau thì ghi đè mới thắng.
  server.use(...createHandlers(API_BASE, store, nodeDemoData, { jobDurationMs: 60 }));
  if (opts.overrides?.length) server.use(...opts.overrides);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    context: { queryClient },
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  return { ...utils, router, queryClient, store };
}
