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

import { DraftPage } from "./DraftPage";

function renderDraftPage(draftId: string = "draft-south-01", store: DemoStore = memoryStore()) {
  server.use(...createHandlers(API_BASE, store, nodeDemoData));

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  const rootRoute = createRootRoute();
  const caseRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/app/ho-so/$caseId",
    component: () => <div>Case Detail Stub</div>,
  });
  const draftRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/app/du-thao/$draftId",
    component: DraftPage,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([caseRoute, draftRoute]),
    history: createMemoryHistory({ initialEntries: [`/app/du-thao/${draftId}`] }),
    context: { queryClient },
  });

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );

  return { ...utils, router, queryClient };
}

describe("DraftPage (S9 Dự thảo & Phê duyệt, S10 Lệnh điều phối)", () => {
  beforeEach(() => {
    session.open("demo-access-approver", {
      id: "u-approver",
      username: "demo.lanh-dao",
      display_name: "Lãnh đạo Phê duyệt",
      roles: ["approver"],
      org_id: "cdc-demo",
    });
  });

  it("hiển thị nội dung dự thảo, bảng kiểm soát guardrails và căn cứ số liệu", async () => {
    renderDraftPage();

    expect(
      await screen.findByText(
        "Công điện về việc tăng cường công tác phòng chống sốt xuất huyết khu vực phía Nam"
      )
    ).toBeInTheDocument();

    // Guardrails G1-G4
    expect(screen.getByText(vi.drafts.guardrailsTitle)).toBeInTheDocument();
    expect(screen.getByText(vi.drafts.guardrailItems.g1)).toBeInTheDocument();
    expect(screen.getByText(vi.drafts.guardrailItems.g2)).toBeInTheDocument();
    expect(screen.getByText(vi.drafts.guardrailsPassed)).toBeInTheDocument();

    // Evidence
    expect(screen.getByText(vi.drafts.evidenceTitle)).toBeInTheDocument();
    expect(screen.getByText(/hash-draft-south-v1/)).toBeInTheDocument();
  });

  it("nghiêm ngặt thực hiện quy tắc 4 mắt: người soạn B2G không được tự phê duyệt", async () => {
    // Đăng nhập đúng bằng tài khoản đã soạn văn bản (officer)
    session.open("demo-access-author", {
      id: "u-author",
      username: "officer",
      display_name: "Cán bộ soạn thảo",
      roles: ["officer", "approver"],
      org_id: "cdc-demo",
    });

    renderDraftPage();

    await screen.findByText(
      "Công điện về việc tăng cường công tác phòng chống sốt xuất huyết khu vực phía Nam"
    );

    // Cảnh báo quy tắc 4 mắt hiển thị
    expect(screen.getByText(vi.drafts.fourEyesNotice)).toBeInTheDocument();

    // Nút phê duyệt bị disabled
    const approveBtn = screen.getByRole("button", { name: vi.drafts.actions.approve });
    expect(approveBtn).toBeDisabled();
  });

  it("lãnh đạo độc lập phê duyệt văn bản thành công qua modal xác nhận", async () => {
    const user = userEvent.setup();
    renderDraftPage();

    await screen.findByText(
      "Công điện về việc tăng cường công tác phòng chống sốt xuất huyết khu vực phía Nam"
    );

    const approveBtn = screen.getByRole("button", { name: vi.drafts.actions.approve });
    expect(approveBtn).not.toBeDisabled();
    await user.click(approveBtn);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(vi.drafts.confirmApprove.title)).toBeInTheDocument();

    const confirmBtn = within(dialog).getByRole("button", { name: vi.drafts.actions.approve });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    expect(await screen.findByText(/Chữ ký số hợp lệ/)).toBeInTheDocument();
    expect(screen.getByText(/Nghị định 30\/2020\/NĐ-CP/)).toBeInTheDocument();
  });

  it("lãnh đạo từ chối văn bản bắt buộc phải nhập lý do", async () => {
    const user = userEvent.setup();
    renderDraftPage();

    await screen.findByText(
      "Công điện về việc tăng cường công tác phòng chống sốt xuất huyết khu vực phía Nam"
    );

    const rejectBtn = screen.getByRole("button", { name: vi.drafts.actions.reject });
    await user.click(rejectBtn);

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: vi.drafts.confirmReject.title })
    ).toBeInTheDocument();

    // Nút từ chối trong dialog bị disabled khi chưa nhập lý do
    const confirmRejectBtn = within(dialog).getByRole("button", { name: vi.drafts.actions.reject });
    expect(confirmRejectBtn).toBeDisabled();

    // Nhập lý do từ chối
    const textarea = within(dialog).getByPlaceholderText("Nhập lý do từ chối cụ thể...");
    await user.type(textarea, "Cần bổ sung chi tiết kế hoạch hỗ trợ nhân lực tuyến cơ sở.");
    expect(confirmRejectBtn).not.toBeDisabled();

    await user.click(confirmRejectBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
