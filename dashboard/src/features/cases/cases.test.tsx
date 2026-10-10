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

import { CaseDetailPage } from "./CaseDetailPage";
import { CaseListPage } from "./CaseListPage";

function renderCaseList(store: DemoStore = memoryStore()) {
  server.use(...createHandlers(API_BASE, store, nodeDemoData));

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  const rootRoute = createRootRoute();
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/app/ho-so",
    component: CaseListPage,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/app/ho-so/$caseId",
    component: CaseDetailPage,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([listRoute, detailRoute]),
    history: createMemoryHistory({ initialEntries: ["/app/ho-so"] }),
    context: { queryClient },
  });

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );

  return { ...utils, router, queryClient };
}

function renderCaseDetail(caseId: string, store: DemoStore = memoryStore()) {
  server.use(...createHandlers(API_BASE, store, nodeDemoData));

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  const rootRoute = createRootRoute();
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/app/ho-so",
    component: CaseListPage,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/app/ho-so/$caseId",
    component: CaseDetailPage,
  });
  const draftRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/app/du-thao/$draftId",
    component: () => <div>Draft Detail Stub</div>,
  });
  const provRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/app/tinh/$provinceId",
    component: () => <div>Province Detail Stub</div>,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([listRoute, detailRoute, draftRoute, provRoute]),
    history: createMemoryHistory({ initialEntries: [`/app/ho-so/${caseId}`] }),
    context: { queryClient },
  });

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );

  return { ...utils, router, queryClient };
}

describe("CaseListPage (S7 Danh sách hồ sơ)", () => {
  beforeEach(() => {
    session.open("demo-access-officer", {
      id: "u-officer",
      username: "demo.xuly",
      display_name: "Cán bộ Xử lý",
      roles: ["officer"],
      org_id: "cdc-demo",
    });
  });

  it("hiển thị danh sách hồ sơ từ hệ thống", async () => {
    renderCaseList();

    expect(await screen.findByRole("heading", { name: vi.cases.title })).toBeInTheDocument();
    expect(
      await screen.findByText(
        "Kế hoạch ứng phó dịch Sốt xuất huyết khu vực miền Nam (Tháng 06/2010)"
      )
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Giám sát dịch SXH khu vực Duyên hải Miền Trung")
    ).toBeInTheDocument();
  });

  it("cho phép tạo hồ sơ mới qua modal", async () => {
    const user = userEvent.setup();
    renderCaseList();

    await screen.findByText(
      "Kế hoạch ứng phó dịch Sốt xuất huyết khu vực miền Nam (Tháng 06/2010)"
    );

    const createBtn = screen.getByRole("button", { name: vi.cases.createBtn });
    await user.click(createBtn);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(vi.cases.createModal.title)).toBeInTheDocument();

    const input = within(dialog).getByRole("textbox", { name: vi.cases.createModal.titleLabel });
    await user.type(input, "Hồ sơ phòng dịch mới test");

    const submitBtn = within(dialog).getByRole("button", { name: vi.cases.createModal.submit });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});

describe("CaseDetailPage (S7 Chi tiết hồ sơ & S8 Phân bổ nguồn lực)", () => {
  beforeEach(() => {
    session.open("demo-access-officer", {
      id: "u-officer",
      username: "demo.xuly",
      display_name: "Cán bộ Xử lý",
      roles: ["officer"],
      org_id: "cdc-demo",
    });
  });

  it("hiển thị chi tiết hồ sơ gồm cảnh báo đính kèm, phương án phân bổ và dự thảo", async () => {
    renderCaseDetail("case-south-2010-06");

    expect(
      await screen.findByRole("heading", {
        name: "Kế hoạch ứng phó dịch Sốt xuất huyết khu vực miền Nam (Tháng 06/2010)",
      })
    ).toBeInTheDocument();

    // Section 1: Cảnh báo đính kèm
    expect(screen.getByText(/Cảnh báo đính kèm/)).toBeInTheDocument();

    // Section 2: Phương án phân bổ Layer 2
    expect(screen.getByText(vi.cases.detail.allocationPlan)).toBeInTheDocument();
    expect(screen.getByText("1.000.000.000 đ")).toBeInTheDocument();
    expect(screen.getByText("950.000.000 đ")).toBeInTheDocument();
    expect(screen.getByText(/420 ca/)).toBeInTheDocument();
    expect(screen.getByText("600.000.000 đ")).toBeInTheDocument();

    // Section 3: Dự thảo văn bản Layer 3
    expect(screen.getByText(vi.cases.detail.drafts)).toBeInTheDocument();
    expect(
      await screen.findByText(
        "Công điện về việc tăng cường công tác phòng chống sốt xuất huyết khu vực phía Nam"
      )
    ).toBeInTheDocument();
  });

  it("cho phép officer mở modal lập phương án phân bổ mới", async () => {
    const user = userEvent.setup();
    renderCaseDetail("case-south-2010-06");

    await screen.findByText(
      "Kế hoạch ứng phó dịch Sốt xuất huyết khu vực miền Nam (Tháng 06/2010)"
    );

    const planBtn = screen.getByRole("button", { name: vi.cases.detail.createPlan });
    await user.click(planBtn);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(vi.allocation.title)).toBeInTheDocument();

    const cancelBtn = within(dialog).getByRole("button", { name: "Huỷ bỏ" });
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("cho phép officer mở modal yêu cầu AI sinh dự thảo văn bản", async () => {
    const user = userEvent.setup();
    renderCaseDetail("case-south-2010-06");

    await screen.findByText(
      "Kế hoạch ứng phó dịch Sốt xuất huyết khu vực miền Nam (Tháng 06/2010)"
    );

    const genBtn = screen.getByRole("button", { name: vi.cases.detail.generateDraft });
    await user.click(genBtn);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(vi.drafts.generateModal.title)).toBeInTheDocument();

    const cancelBtn = within(dialog).getByRole("button", { name: "Huỷ bỏ" });
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
