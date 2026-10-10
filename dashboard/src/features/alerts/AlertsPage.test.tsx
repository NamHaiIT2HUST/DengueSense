import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { API_BASE, createHandlers, memoryStore, type DemoStore } from "@/mocks/handlers";
import { nodeDemoData } from "@/mocks/nodeDemoData";
import { server } from "@/mocks/server";
import { session } from "@/shared/api";
import { vi } from "@/shared/i18n/vi";

import { AlertsPage } from "./AlertsPage";

function renderAlertsPage(store: DemoStore = memoryStore()) {
  server.use(...createHandlers(API_BASE, store, nodeDemoData));

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: AlertsPage,
  });
  const stubProvince = createRoute({
    getParentRoute: () => rootRoute,
    path: "/app/tinh/$provinceId",
    component: () => <div>Province Detail</div>,
  });
  const stubCase = createRoute({
    getParentRoute: () => rootRoute,
    path: "/app/ho-so/$caseId",
    component: () => <div>Case Detail</div>,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, stubProvince, stubCase]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
    context: { queryClient },
  });

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );

  return { ...utils, router, queryClient };
}

describe("AlertsPage (S6 Cảnh báo rủi ro)", () => {
  beforeEach(() => {
    session.open("demo-access-officer", {
      id: "u-officer",
      username: "demo.xuly",
      display_name: "Cán bộ Xử lý",
      roles: ["officer"],
      org_id: "cdc-demo",
    });
  });

  it("hiển thị danh sách cảnh báo từ hệ thống kèm trạng thái và thông tin tỉnh", async () => {
    renderAlertsPage();

    expect(await screen.findByRole("heading", { name: vi.alerts.title })).toBeInTheDocument();
    expect(screen.getByText(vi.alerts.lead)).toBeInTheDocument();

    // Các tỉnh trong fixture
    expect(await screen.findByText("Hồ Chí Minh")).toBeInTheDocument();
    expect(screen.getByText("An Giang")).toBeInTheDocument();
    expect(screen.getByText("Đà Nẵng")).toBeInTheDocument();
    expect(screen.getByText("Đồng Nai")).toBeInTheDocument();
  });

  it("lọc cảnh báo theo trạng thái đang mở và đã đóng", async () => {
    const user = userEvent.setup();
    renderAlertsPage();

    await screen.findByText("Hồ Chí Minh");

    // Bấm lọc "Đang mở"
    const openFilter = screen.getByRole("radio", { name: vi.alerts.statusOpen });
    await user.click(openFilter);

    await waitFor(() => {
      expect(screen.queryByText("Đồng Nai")).not.toBeInTheDocument(); // Đồng Nai đã đóng
      expect(screen.getByText("Hồ Chí Minh")).toBeInTheDocument();
      expect(screen.getByText("An Giang")).toBeInTheDocument();
    });

    // Bấm lọc "Đã đóng"
    const closedFilter = screen.getByRole("radio", { name: vi.alerts.statusClosed });
    await user.click(closedFilter);

    await waitFor(() => {
      expect(screen.getByText("Đồng Nai")).toBeInTheDocument();
      expect(screen.queryByText("Hồ Chí Minh")).not.toBeInTheDocument();
    });
  });

  it("lọc cảnh báo theo khu vực", async () => {
    const user = userEvent.setup();
    renderAlertsPage();

    await screen.findByText("Hồ Chí Minh");

    // Chọn Miền Trung
    const centralFilter = screen.getByRole("radio", { name: vi.regions["Trung"] ?? "Miền Trung" });
    await user.click(centralFilter);

    await waitFor(() => {
      expect(screen.getByText("Đà Nẵng")).toBeInTheDocument();
      expect(screen.queryByText("Hồ Chí Minh")).not.toBeInTheDocument();
      expect(screen.queryByText("An Giang")).not.toBeInTheDocument();
    });
  });

  it("vai trò viewer chỉ xem được, không có các nút thao tác tiếp nhận và lập hồ sơ", async () => {
    session.open("demo-access-viewer", {
      id: "u-viewer",
      username: "demo.xem",
      display_name: "Cán bộ Xem",
      roles: ["viewer"],
      org_id: "cdc-demo",
    });

    renderAlertsPage();

    await screen.findByText("Hồ Chí Minh");

    // Có thông báo vai trò
    expect(screen.getByText(vi.alerts.officerOnly)).toBeInTheDocument();

    // Không có nút tiếp nhận hay lập hồ sơ
    expect(
      screen.queryByRole("button", { name: vi.alerts.actions.confirm })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: vi.alerts.actions.createCase })
    ).not.toBeInTheDocument();
  });

  it("officer xác nhận tiếp nhận cảnh báo thành công qua modal xác nhận", async () => {
    const user = userEvent.setup();
    renderAlertsPage();

    await screen.findByText("Hồ Chí Minh");

    // Tìm dòng của Hồ Chí Minh và bấm Tiếp nhận cảnh báo
    const hcmLink = screen.getByText("Hồ Chí Minh");
    const row = hcmLink.closest("tr") as HTMLElement;
    const confirmBtn = within(row).getByRole("button", { name: vi.alerts.actions.confirm });

    await user.click(confirmBtn);

    // Modal xác nhận xuất hiện
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: vi.alerts.confirmModal.title })
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/xác nhận đã tiếp nhận cảnh báo dịch cho Hồ Chí Minh/)
    ).toBeInTheDocument();

    // Bấm nút xác nhận trong dialog
    const confirmActionBtn = within(dialog).getByRole("button", {
      name: vi.alerts.actions.confirm,
    });
    await user.click(confirmActionBtn);

    // Chờ cập nhật trạng thái
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("officer mở modal lập hồ sơ xử lý từ cảnh báo", async () => {
    const user = userEvent.setup();
    renderAlertsPage();

    await screen.findByText("Hồ Chí Minh");

    const hcmLink = screen.getByText("Hồ Chí Minh");
    const row = hcmLink.closest("tr") as HTMLElement;
    const createCaseBtn = within(row).getByRole("button", { name: vi.alerts.actions.createCase });

    await user.click(createCaseBtn);

    // Modal tạo hồ sơ xuất hiện với tiêu đề gợi ý sẵn
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(vi.cases.createModal.title)).toBeInTheDocument();
    expect(
      within(dialog).getByDisplayValue("Hồ sơ ứng phó dịch SXH — Hồ Chí Minh")
    ).toBeInTheDocument();

    // Bấm huỷ bỏ
    const cancelBtn = within(dialog).getByRole("button", { name: vi.cases.createModal.cancel });
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
