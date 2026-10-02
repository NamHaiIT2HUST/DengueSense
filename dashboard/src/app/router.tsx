import { createRouter } from "@tanstack/react-router";

import { queryClient } from "./queryClient";
import { routeTree } from "./routeTree.gen";

export const router = createRouter({
  routeTree,
  context: { queryClient },
  // Tải trước dữ liệu/chunk khi rê chuột hoặc focus vào liên kết.
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
