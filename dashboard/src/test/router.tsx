import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * Dựng MỘT component cần bối cảnh router (Link, useNavigate) mà không cần cả cây route thật: route gốc + route "/" chứa
 * component, cộng route giả cho các đích liên kết (`/app/mo-hinh`, `/app/ban-do`, `/app/tinh/$provinceId`) để
 * `href` được dựng đúng. Dùng cho test thành phần dùng chung; test luồng đầy đủ dùng `renderApp`.
 */
export async function renderWithRouter(ui: ReactNode) {
  const rootRoute = createRootRoute();
  const stub = (path: string) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null });
  const index = createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => ui });
  const tree = rootRoute.addChildren([
    index,
    stub("/app/mo-hinh"),
    stub("/app/ban-do"),
    stub("/app/tinh/$provinceId"),
  ]);
  const router = createRouter({
    routeTree: tree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  return render(<RouterProvider router={router} />);
}
