import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { API_BASE } from "@/mocks/handlers";
import { limitationsFixture } from "@/mocks/fixtures";
import { server } from "@/mocks/server";
import { session } from "@/shared/api";

import { ModelInfoPage } from "./ModelInfoPage";

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ModelInfoPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  session.open("demo-access-test", {
    id: "u",
    username: "demo.xem",
    display_name: "X",
    roles: ["viewer"],
    org_id: "o",
  });
});

describe("Mô hình & giới hạn", () => {
  it("hiện hiệu năng đo được với số định dạng tiếng Việt và nêu rõ mức nền", async () => {
    renderPage();
    expect(await screen.findByText("0,52 ± 0,17")).toBeInTheDocument();
    expect(screen.getByText("6/6 mùa")).toBeInTheDocument();
    expect(screen.getByText("22,2%")).toBeInTheDocument();
    expect(screen.getByText("0,81 ± 0,04")).toBeInTheDocument();
    // Luật T1: xác suất cảnh báo luôn đi cùng mức nền — trang phải nói rõ mức nền và biên độ thay đổi.
    expect(screen.getByText("13% – 35%")).toBeInTheDocument();
    expect(screen.getByText(/Luôn đọc xác suất cảnh báo cùng mức nền/)).toBeInTheDocument();
    // Khoảng tin cậy phải kèm cảnh báo "có thể lạc quan" (docs/07 §6b).
    expect(
      screen.getByText(/khoảng tin cậy 95%: 18,2% – 26,0% \(có thể lạc quan\)/)
    ).toBeInTheDocument();
  });

  it("nêu điểm yếu song song với điểm mạnh: độ tin cậy từng vùng và 12 giới hạn", async () => {
    renderPage();
    const regions = await screen.findByRole("heading", { name: "Độ tin cậy theo vùng" });
    const card = regions.closest("section") as HTMLElement;
    expect(within(card).getByText("Miền Bắc")).toBeInTheDocument();
    expect(within(card).getByText("Thấp ở năm dịch bất thường")).toBeInTheDocument();
    expect(within(card).getByText("Cao")).toBeInTheDocument();
    expect(within(card).getByText("Ngang dự báo theo mùa")).toBeInTheDocument();

    const items = await screen.findAllByRole("heading", { level: 3, name: /./ });
    for (const lim of limitationsFixture) {
      expect(items.some((h) => h.textContent === lim.title)).toBe(true);
    }
    expect(screen.getAllByText("Nghiêm trọng").length).toBeGreaterThanOrEqual(4);
  });

  it("KHÔNG dùng ngôn ngữ tuyệt đối (luật T8) và không khẳng định 'báo trước 5–9 tuần'", async () => {
    const { container } = renderPage();
    await screen.findByText("0,52 ± 0,17");
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/chắc chắn|sẽ xảy ra|đảm bảo|100% chính xác/i);
    expect(text).toMatch(/KHÔNG dùng cho/);
    expect(text).toMatch(/báo trước 5–9 tuần.*như một khả năng chung/);
  });

  it("đang tải: hiện khung chờ có nhãn cho trình đọc màn hình", async () => {
    server.use(
      http.get(`${API_BASE}/model-card`, async () => {
        await new Promise((r) => setTimeout(r, 150));
        return HttpResponse.error();
      })
    );
    renderPage();
    expect((await screen.findAllByRole("status", { name: "Đang tải" })).length).toBeGreaterThan(0);
  });

  it("lỗi máy chủ: hiện thông báo chung + mã yêu cầu + nút thử lại; thử lại thành công thì hiện nội dung", async () => {
    server.use(
      http.get(`${API_BASE}/model-card`, () =>
        HttpResponse.json(
          {
            type: "about:blank",
            title: "x",
            status: 503,
            code: "common.dependency_unavailable",
            request_id: "req-503",
            detail: "dial tcp 10.0.0.5",
          },
          { status: 503, headers: { "content-type": "application/problem+json" } }
        )
      )
    );
    const user = userEvent.setup();
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("tạm thời không khả dụng");
    expect(alert).toHaveTextContent("req-503");
    expect(alert).not.toHaveTextContent("10.0.0.5");

    // Lỗi của MỘT khối không làm sập trang: danh sách giới hạn vẫn hiện.
    expect(await screen.findByText(limitationsFixture[0]!.title)).toBeInTheDocument();

    server.resetHandlers(); // bỏ handler lỗi → quay về handler mặc định (thành công)
    await user.click(within(alert).getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("0,52 ± 0,17")).toBeInTheDocument();
  });
});
