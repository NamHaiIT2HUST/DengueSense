import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";

import { API_BASE, memoryStore } from "@/mocks/handlers";
import { qk, session } from "@/shared/api";
import { DEMO_ACCOUNTS } from "@/shared/config/demo";
import { renderApp } from "@/test/app";

const VIEWER = DEMO_ACCOUNTS[0]!;

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  username: string,
  password: string
) {
  await user.type(screen.getByLabelText("Tên đăng nhập"), username);
  await user.type(screen.getByLabelText("Mật khẩu"), password);
  await user.click(screen.getByRole("button", { name: "Đăng nhập" }));
}

async function expectModelPage() {
  expect(
    await screen.findByRole("heading", { level: 1, name: "Mô hình & giới hạn" })
  ).toBeInTheDocument();
}

describe("cổng vào console", () => {
  it("chưa đăng nhập vào /app → chuyển về đăng nhập kèm đường dẫn để quay lại", async () => {
    const { router } = renderApp("/app");
    expect(await screen.findByRole("heading", { level: 1, name: "Đăng nhập" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dang-nhap");
    expect(router.state.location.search).toEqual({ redirect: "/app" });
  });

  it("tải lại trang khi còn cookie refresh → khôi phục phiên, KHÔNG phải đăng nhập lại", async () => {
    const store = memoryStore();
    store.set(VIEWER.username); // mô phỏng cookie refresh HttpOnly còn hiệu lực
    const { router } = renderApp("/app/mo-hinh", { store });

    await expectModelPage();
    expect(router.state.location.pathname).toBe("/app/mo-hinh");
    expect(session.getState().user?.username).toBe(VIEWER.username);
  });

  it("/app tự chuyển tới trang đầu của console", async () => {
    const store = memoryStore();
    store.set(VIEWER.username);
    const { router } = renderApp("/app", { store });
    await expectModelPage();
    expect(router.state.location.pathname).toBe("/app/mo-hinh");
  });

  it("đã đăng nhập mà vào /dang-nhap → chuyển vào console", async () => {
    session.open("demo-access-x", {
      id: "u",
      username: VIEWER.username,
      display_name: "X",
      roles: ["viewer"],
      org_id: "o",
    });
    const { router } = renderApp("/dang-nhap");
    await expectModelPage();
    expect(router.state.location.pathname).toBe("/app/mo-hinh");
  });
});

describe("đăng nhập", () => {
  it("để trống → báo lỗi từng trường, KHÔNG gọi mạng", async () => {
    let calls = 0;
    const user = userEvent.setup();
    renderApp("/dang-nhap", {
      overrides: [
        http.post(`${API_BASE}/auth/login`, () => {
          calls++;
          return HttpResponse.error();
        }),
      ],
    });

    await user.click(await screen.findByRole("button", { name: "Đăng nhập" }));
    const errors = await screen.findAllByText("Trường này là bắt buộc.");
    expect(errors).toHaveLength(2);
    expect(screen.getByLabelText("Tên đăng nhập")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Tên đăng nhập")).toHaveAccessibleDescription(
      "Trường này là bắt buộc."
    );
    expect(session.getAccessToken()).toBeNull();
    expect(calls).toBe(0);
  });

  it("sai mật khẩu → thông báo CHUNG (không gợi ý trường nào sai), vẫn ở trang đăng nhập", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/dang-nhap");
    await screen.findByRole("heading", { level: 1, name: "Đăng nhập" });

    await fillAndSubmit(user, VIEWER.username, "sai-mat-khau-xxxx");
    expect(await screen.findByRole("alert")).toHaveTextContent("Sai tên đăng nhập hoặc mật khẩu.");
    expect(router.state.location.pathname).toBe("/dang-nhap");
    expect(session.getAccessToken()).toBeNull();
    expect(screen.getByLabelText("Mật khẩu")).not.toHaveAttribute("aria-invalid");
  });

  it("tài khoản không tồn tại và sai mật khẩu cho CÙNG thông báo", async () => {
    const user = userEvent.setup();
    renderApp("/dang-nhap");
    await screen.findByRole("heading", { level: 1, name: "Đăng nhập" });
    await fillAndSubmit(user, "khong.ton.tai", "mat-khau-nao-do-12");
    expect(await screen.findByRole("alert")).toHaveTextContent("Sai tên đăng nhập hoặc mật khẩu.");
  });

  it("tài khoản bị khoá → thông báo riêng, có hướng dẫn thử lại sau", async () => {
    const user = userEvent.setup();
    renderApp("/dang-nhap", {
      overrides: [
        http.post(`${API_BASE}/auth/login`, () =>
          HttpResponse.json(
            {
              type: "about:blank",
              title: "khoá",
              status: 401,
              code: "auth.account_locked",
              request_id: "r1",
            },
            { status: 401, headers: { "content-type": "application/problem+json" } }
          )
        ),
      ],
    });
    await screen.findByRole("heading", { level: 1, name: "Đăng nhập" });
    await fillAndSubmit(user, VIEWER.username, VIEWER.password);
    expect(await screen.findByRole("alert")).toHaveTextContent("tạm khoá");
  });

  it("lỗi máy chủ → thông báo chung, KHÔNG lộ chi tiết", async () => {
    const user = userEvent.setup();
    renderApp("/dang-nhap", {
      overrides: [
        http.post(`${API_BASE}/auth/login`, () =>
          HttpResponse.json(
            {
              type: "about:blank",
              title: "x",
              status: 500,
              code: "common.internal_error",
              detail: "pq: password authentication failed",
              request_id: "r2",
            },
            { status: 500, headers: { "content-type": "application/problem+json" } }
          )
        ),
      ],
    });
    await screen.findByRole("heading", { level: 1, name: "Đăng nhập" });
    await fillAndSubmit(user, VIEWER.username, VIEWER.password);
    const alert = await screen.findByRole("alert");
    expect(alert).not.toHaveTextContent("pq:");
    expect(alert).not.toHaveTextContent("password authentication");
  });

  it("thành công → vào đúng trang được yêu cầu, hiện tên người dùng", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/dang-nhap?redirect=%2Fapp%2Fmo-hinh");
    await screen.findByRole("heading", { level: 1, name: "Đăng nhập" });

    await fillAndSubmit(user, VIEWER.username, VIEWER.password);
    await expectModelPage();
    expect(router.state.location.pathname).toBe("/app/mo-hinh");
    expect(screen.getByText(VIEWER.displayName)).toBeInTheDocument();
    expect(session.getState().user?.roles).toEqual(["viewer"]);
  });

  it.each([
    ["URL tuyệt đối", "https://ke-xau.example/app"],
    ["giao thức tương đối", "//ke-xau.example"],
    ["ngoài console", "/"],
  ])("tham số redirect độc hại (%s) bị bỏ qua → vào /app/mo-hinh", async (_n, target) => {
    const user = userEvent.setup();
    const { router } = renderApp(`/dang-nhap?redirect=${encodeURIComponent(target)}`);
    await screen.findByRole("heading", { level: 1, name: "Đăng nhập" });
    await fillAndSubmit(user, VIEWER.username, VIEWER.password);
    await expectModelPage();
    expect(router.state.location.pathname).toBe("/app/mo-hinh");
    expect(router.state.location.href).not.toContain("ke-xau");
  });

  it("nút gửi bị khoá khi đang xử lý (không gửi hai lần)", async () => {
    let calls = 0;
    const user = userEvent.setup();
    renderApp("/dang-nhap", {
      overrides: [
        http.post(`${API_BASE}/auth/login`, async () => {
          calls++;
          await new Promise((r) => setTimeout(r, 150));
          return HttpResponse.error();
        }),
      ],
    });
    await screen.findByRole("heading", { level: 1, name: "Đăng nhập" });
    await user.type(screen.getByLabelText("Tên đăng nhập"), VIEWER.username);
    await user.type(screen.getByLabelText("Mật khẩu"), VIEWER.password);
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));
    const busy = await screen.findByRole("button", { name: "Đang đăng nhập…" });
    expect(busy).toBeDisabled();
    await user.click(busy); // bấm thêm khi đang xử lý: không được gửi lần hai
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(calls).toBe(1);
  });
});

describe("đăng xuất và mất phiên", () => {
  it("đăng xuất → về đăng nhập, xoá phiên và cache, phiên phía server bị thu hồi", async () => {
    const store = memoryStore();
    store.set(VIEWER.username);
    const user = userEvent.setup();
    const { router, queryClient } = renderApp("/app/mo-hinh", { store });
    await expectModelPage();
    await waitFor(() => expect(queryClient.getQueryData(qk.modelCard())).toBeDefined());

    await user.click(screen.getByRole("button", { name: "Đăng xuất" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Đăng nhập" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dang-nhap");
    expect(session.getAccessToken()).toBeNull();
    expect(queryClient.getQueryData(qk.modelCard())).toBeUndefined();
    expect(store.get()).toBeNull();
  });

  it("phiên mất giữa chừng (refresh thất bại) → tự về đăng nhập kèm đường dẫn cũ, cache bị xoá", async () => {
    const store = memoryStore();
    store.set(VIEWER.username);
    const { router, queryClient } = renderApp("/app/mo-hinh", { store });
    await expectModelPage();
    await waitFor(() => expect(queryClient.getQueryData(qk.modelCard())).toBeDefined());

    session.clear(); // như khi client báo onAuthLost
    expect(await screen.findByRole("heading", { level: 1, name: "Đăng nhập" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dang-nhap");
    expect(router.state.location.search).toEqual({ redirect: "/app/mo-hinh" });
    expect(queryClient.getQueryData(qk.modelCard())).toBeUndefined();
  });

  it("đăng xuất vẫn xoá phiên cục bộ khi mất mạng", async () => {
    const store = memoryStore();
    store.set(VIEWER.username);
    const user = userEvent.setup();
    renderApp("/app/mo-hinh", {
      store,
      overrides: [http.post(`${API_BASE}/auth/logout`, () => HttpResponse.error())],
    });
    await expectModelPage();
    await user.click(screen.getByRole("button", { name: "Đăng xuất" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Đăng nhập" })).toBeInTheDocument();
    expect(session.getAccessToken()).toBeNull();
  });
});

describe("khung console", () => {
  it("có liên kết bỏ qua điều hướng, landmark chuẩn và mục điều hướng đang chọn", async () => {
    const store = memoryStore();
    store.set(VIEWER.username);
    renderApp("/app/mo-hinh", { store });
    await expectModelPage();

    expect(screen.getByRole("link", { name: /Bỏ qua điều hướng/ })).toHaveAttribute(
      "href",
      "#main"
    );
    expect(screen.getByRole("main")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Điều hướng chính" });
    expect(within(nav).getByRole("link", { name: "Mô hình & giới hạn" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("đường dẫn lạ trong /app hiện trang 404", async () => {
    const store = memoryStore();
    store.set(VIEWER.username);
    renderApp("/app/khong-co", { store });
    expect(await screen.findByText("404")).toBeInTheDocument();
  });
});
