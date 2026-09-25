/**
 * Luồng xem rủi ro trên router thật + máy chủ giả chạy bằng SỐ THẬT của exp_016 (tái hiện mùa 2010). Đây là bản đối
 * chiếu "cổng Đợt 1": chọn tháng neo 2010-03 → bản đồ/bảng hiện đúng số M4-R2 của exp_016, có mức nền, provenance, giới hạn.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { memoryStore } from "@/mocks/handlers";
import { nodeDemoData } from "@/mocks/nodeDemoData";
import { DEMO_ACCOUNTS } from "@/shared/config/demo";
import { renderApp } from "@/test/app";

const VIEWER = DEMO_ACCOUNTS[0]!;
const ANALYST = DEMO_ACCOUNTS[1]!;
const RUN_2010_03 = "0f6bac6d-b0cc-5177-83a7-ab3e02ae3fe4";

function signedIn(username = VIEWER.username) {
  const store = memoryStore();
  store.set(username);
  return store;
}

async function mapTable() {
  return await screen.findByRole("table", { name: "Bảng xếp hạng tỉnh" });
}

function dataRows(table: HTMLElement) {
  return within(table).getAllByRole("row").slice(1); // bỏ hàng tiêu đề
}

async function expected(origin: string, horizon: number) {
  const file = await nodeDemoData.run(origin);
  if (!file) throw new Error("thiếu run");
  return file.items.filter((i) => i.horizon === horizon);
}

describe("S2 — bản đồ rủi ro", () => {
  it("gate Đợt 1: tháng neo 2010-03, tầm 3 tháng → bảng hiện đúng số exp_016, mọi dòng có mức nền", async () => {
    renderApp(`/app/ban-do?run=${RUN_2010_03}&h=3`, { store: signedIn() });
    const table = await mapTable();
    const rows = dataRows(table);
    expect(rows).toHaveLength(34);

    // dòng đầu = tỉnh có xác suất vượt ngưỡng cao nhất theo exp_016 (p_clf), đúng số làm tròn
    const items = await expected("2010-03", 3);
    const top = [...items].sort((a, b) => b.exceed_prob - a.exceed_prob)[0]!;
    const first = rows[0]!;
    expect(within(first).getByText(`${Math.round(top.exceed_prob * 100)}%`)).toBeInTheDocument();
    expect(within(first).getByRole("link").getAttribute("href")).toContain(
      `/app/tinh/${top.province_id}`
    );

    // luật T1: KHÔNG dòng nào có xác suất mà thiếu mức nền
    for (const r of rows) expect(r).toHaveTextContent(/Mức nền \d+%/);

    // dải provenance + banner tái hiện lịch sử + liên kết giới hạn
    expect(screen.getByText(/Tái hiện lịch sử: dự báo từ tháng neo 03\/2010/)).toBeInTheDocument();
    expect(screen.getByText("m4-r2@1.0.0")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Giới hạn của mô hình" })).toBeInTheDocument();
  });

  it("bản đồ vẽ đủ 34 tỉnh (Leaflet, tải lười)", async () => {
    const { container } = renderApp(`/app/ban-do?run=${RUN_2010_03}&h=3`, { store: signedIn() });
    await mapTable();
    await waitFor(
      () => expect(container.querySelectorAll("path.leaflet-interactive")).toHaveLength(34),
      {
        timeout: 5000,
      }
    );
  });

  it("đổi tầm dự báo → bảng đổi theo (số của tầm 6 khác tầm 3), giữ đúng lượt", async () => {
    const user = userEvent.setup();
    const { router } = renderApp(`/app/ban-do?run=${RUN_2010_03}&h=3`, { store: signedIn() });
    await mapTable();
    await user.click(screen.getByRole("radio", { name: "6 tháng" }));

    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ h: 6, run: RUN_2010_03 })
    );
    const items = await expected("2010-03", 6);
    const top = [...items].sort((a, b) => b.exceed_prob - a.exceed_prob)[0]!;
    await waitFor(() => {
      const first = dataRows(screen.getByRole("table", { name: "Bảng xếp hạng tỉnh" }))[0]!;
      expect(within(first).getByRole("link").getAttribute("href")).toContain(
        `/app/tinh/${top.province_id}`
      );
    });
    expect(screen.getByText(/sau 6 tháng \(09\/2010\)/, { selector: "span" })).toBeInTheDocument();
  });

  it("lọc theo vùng chỉ giữ tỉnh của vùng đó", async () => {
    const user = userEvent.setup();
    renderApp(`/app/ban-do?run=${RUN_2010_03}&h=3`, { store: signedIn() });
    await mapTable();
    await user.selectOptions(screen.getByLabelText("Vùng"), "Bắc");
    await waitFor(() => {
      const rows = dataRows(screen.getByRole("table", { name: "Bảng xếp hạng tỉnh" }));
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.length).toBeLessThan(34);
      for (const r of rows) expect(r).toHaveTextContent("Miền Bắc");
    });
  });

  it("chuyển chỉ số tô màu sang tỉ suất ca → chú giải đổi theo, dùng ngưỡng do máy chủ trả", async () => {
    const user = userEvent.setup();
    renderApp(`/app/ban-do?run=${RUN_2010_03}&h=3`, { store: signedIn() });
    await mapTable();
    expect(screen.getByRole("region", { name: "Xác suất vượt ngưỡng P75" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Tỉ suất ca dự báo / 100.000 dân" }));
    const legend = await screen.findByRole("region", { name: "Ca dự báo / 100.000 dân" });
    const file = await nodeDemoData.run("2010-03");
    for (const c of file!.legend_cases_per_100k) expect(legend).toHaveTextContent(c.label);
  });

  it("sắp xếp bảng theo tên: có aria-sort, tăng dần theo thứ tự tiếng Việt", async () => {
    const user = userEvent.setup();
    renderApp(`/app/ban-do?run=${RUN_2010_03}&h=3`, { store: signedIn() });
    const table = await mapTable();
    await user.click(within(table).getByRole("button", { name: "Sắp xếp theo Tỉnh" }));
    const header = within(table).getByRole("columnheader", { name: /Tỉnh/ });
    expect(header).toHaveAttribute("aria-sort", "ascending");
    const names = dataRows(table).map((r) => within(r).getByRole("link").textContent ?? "");
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "vi")));
  });

  it("tham số URL sai (h=99, run không phải uuid) bị bỏ qua → mặc định, KHÔNG hỏng trang", async () => {
    const { router } = renderApp("/app/ban-do?h=99&run=khong-phai-uuid&metric=xxx&region=Tay", {
      store: signedIn(),
    });
    await mapTable();
    expect(screen.getByRole("radio", { name: "3 tháng" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Xác suất vượt ngưỡng" })).toBeChecked();
    expect(router.state.location.pathname).toBe("/app/ban-do");
  });

  it("không chỉ định lượt → dùng lượt hoàn tất mới nhất (06/2010)", async () => {
    renderApp("/app/ban-do", { store: signedIn() });
    await mapTable();
    expect(screen.getByText(/Tái hiện lịch sử: dự báo từ tháng neo 06\/2010/)).toBeInTheDocument();
  });

  it("bấm tên tỉnh trong bảng → sang trang chi tiết đúng lượt và tầm", async () => {
    const user = userEvent.setup();
    const { router } = renderApp(`/app/ban-do?run=${RUN_2010_03}&h=6`, { store: signedIn() });
    const table = await mapTable();
    await user.click(within(table).getByRole("link", { name: "Xem chi tiết Khánh Hòa" }));
    await screen.findByRole("heading", { level: 1, name: "Khánh Hòa" });
    expect(router.state.location.pathname).toBe("/app/tinh/khanh_hoa");
    expect(router.state.location.search).toMatchObject({ run: RUN_2010_03, h: 6 });
  });
});

describe("S3 — chi tiết tỉnh", () => {
  it("hiện 4 tầm dự báo với số exp_016, biểu đồ có bảng thay thế, giải thích SHAP, độ tin cậy và cờ", async () => {
    renderApp(`/app/tinh/khanh_hoa?run=${RUN_2010_03}&h=3`, { store: signedIn() });
    await screen.findByRole("heading", { level: 1, name: "Khánh Hòa" });
    const items = (await expected("2010-03", 1))
      .concat(
        await expected("2010-03", 2),
        await expected("2010-03", 3),
        await expected("2010-03", 6)
      )
      .filter((i) => i.province_id === "khanh_hoa");
    expect(items).toHaveLength(4);

    // 4 thẻ tầm, mỗi thẻ có xác suất kèm mức nền (T1)
    const horizons = await screen.findByRole("region", { name: "Dự báo theo tầm" });
    for (const i of items) {
      const heading = within(horizons).getByRole("button", {
        name: new RegExp(`sau ${i.horizon} tháng`),
      });
      const card = heading.closest("div.glass-panel") as HTMLElement;
      expect(card).toHaveTextContent(`${Math.round(i.exceed_prob * 100)}%`);
      expect(card).toHaveTextContent(/Mức nền \d+%/);
    }

    // biểu đồ: hình có nhãn + bảng dữ liệu tương đương; không vẽ khoảng dự báo (T7)
    expect(
      screen.getByRole("img", { name: /Biểu đồ số ca bệnh hàng tháng của Khánh Hòa/ })
    ).toBeInTheDocument();
    expect(screen.getByText(/Chưa có khoảng dự báo đã kiểm chứng độ phủ/)).toBeInTheDocument();
    expect(screen.getByText("Bảng dữ liệu của biểu đồ")).toBeInTheDocument();
    expect(
      screen.getByText(/Phần sau đường “tháng neo” là số đo thật chỉ có trong tái hiện lịch sử/)
    ).toBeInTheDocument();

    // giải thích: 5 yếu tố, nói rõ không phải nhân quả và chỉ là thành phần LightGBM
    const expl = (await screen.findByText("Yếu tố ảnh hưởng đến dự báo")).closest(
      "section"
    ) as HTMLElement;
    await waitFor(() => expect(within(expl).getAllByRole("listitem")).toHaveLength(5));
    expect(expl).toHaveTextContent("không phải quan hệ nhân quả");
    expect(expl).toHaveTextContent("thành phần LightGBM chuẩn");
    expect(expl).toHaveTextContent(/làm dự báo (tăng|giảm) khoảng \d+%/);

    // độ tin cậy vùng Trung + cờ
    expect(screen.getByText("Cao")).toBeInTheDocument();
    expect(screen.getByText("Đầu vào của dự báo")).toBeInTheDocument();
    expect(screen.getByText("100% đo thật")).toBeInTheDocument();
  });

  it("đổi tầm ở trang chi tiết → giải thích đổi theo tầm mới", async () => {
    const user = userEvent.setup();
    const { router } = renderApp(`/app/tinh/ha_noi?run=${RUN_2010_03}&h=3`, { store: signedIn() });
    await screen.findByRole("heading", { level: 1, name: "Hà Nội" });
    await user.click(await screen.findByRole("button", { name: /sau 6 tháng/ }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ h: 6 }));
    await waitFor(() =>
      expect(screen.getByText(/sau 6 tháng \(09\/2010\)/, { selector: "p" })).toBeInTheDocument()
    );
  });

  it("tỉnh không tồn tại → thông báo, có đường về bản đồ, không sập", async () => {
    renderApp("/app/tinh/khong_co", { store: signedIn() });
    expect(await screen.findByText("Không tìm thấy tỉnh này.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Về bản đồ" })).toBeInTheDocument();
  });
});

describe("S4 — lượt dự báo", () => {
  it("viewer xem được danh sách nhưng KHÔNG có form tạo lượt", async () => {
    renderApp("/app/luot-du-bao", { store: signedIn(VIEWER.username) });
    expect(await screen.findByRole("table", { name: "Lượt dự báo" })).toBeInTheDocument();
    expect(
      screen.getByText(/Chỉ vai trò phân tích trở lên được tạo lượt dự báo/)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tạo lượt" })).not.toBeInTheDocument();
  });

  it("danh sách có 8 lượt, mới nhất trước, mỗi lượt mở được bản đồ", async () => {
    renderApp("/app/luot-du-bao", { store: signedIn(VIEWER.username) });
    const table = await screen.findByRole("table", { name: "Lượt dự báo" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(8);
    expect(within(rows[0]!).getByRole("rowheader")).toHaveTextContent("06/2010");
    expect(within(rows[7]!).getByRole("rowheader")).toHaveTextContent("11/2009");
    expect(
      within(rows[0]!).getByRole("link", { name: /Mở bản đồ của lượt tháng neo 06\/2010/ })
    ).toBeInTheDocument();
  });

  it("analyst tạo lượt 2010-03 → job chạy nền, có tiến độ, thành công thì mở được kết quả", async () => {
    const user = userEvent.setup();
    renderApp("/app/luot-du-bao", { store: signedIn(ANALYST.username) });
    await screen.findByRole("button", { name: "Tạo lượt" });
    await user.click(screen.getByRole("button", { name: "Tạo lượt" }));
    const link = await screen.findByRole("link", { name: "Mở kết quả" }, { timeout: 5000 });
    expect(link.getAttribute("href")).toContain(`run=${RUN_2010_03}`);
  });

  it("tháng neo ngoài giai đoạn có dữ liệu thật → lỗi gắn vào ô nhập", async () => {
    const user = userEvent.setup();
    renderApp("/app/luot-du-bao", { store: signedIn(ANALYST.username) });
    const input = await screen.findByLabelText("Tháng neo");
    await user.clear(input);
    await user.type(input, "2012-01");
    await user.click(screen.getByRole("button", { name: "Tạo lượt" }));
    expect(await screen.findByText(/Tháng neo không hợp lệ cho chế độ này/)).toBeInTheDocument();
  });

  it("tháng chưa có trong bản demo → lỗi theo trường kèm lý do", async () => {
    const user = userEvent.setup();
    renderApp("/app/luot-du-bao", { store: signedIn(ANALYST.username) });
    const input = await screen.findByLabelText("Tháng neo");
    await user.clear(input);
    await user.type(input, "2008-05");
    await user.click(screen.getByRole("button", { name: "Tạo lượt" }));
    expect(await screen.findByText(/Bản demo chỉ có sẵn các tháng neo/)).toBeInTheDocument();
    expect(screen.getByLabelText("Tháng neo")).toHaveAttribute("aria-invalid", "true");
  });

  it("định dạng tháng sai bị chặn ở client, không gọi máy chủ", async () => {
    const user = userEvent.setup();
    renderApp("/app/luot-du-bao", { store: signedIn(ANALYST.username) });
    const input = await screen.findByLabelText("Tháng neo");
    await user.clear(input);
    await user.type(input, "03/2010");
    await user.click(screen.getByRole("button", { name: "Tạo lượt" }));
    expect(
      await screen.findByText("Nhập tháng dạng năm-tháng (ví dụ 2010-03).")
    ).toBeInTheDocument();
  });
});

describe("điều hướng console", () => {
  it("có 3 mục điều hướng và mục hiện tại được đánh dấu", async () => {
    renderApp(`/app/ban-do?run=${RUN_2010_03}`, { store: signedIn() });
    await mapTable();
    const nav = screen.getByRole("navigation", { name: "Điều hướng chính" });
    expect(within(nav).getByRole("link", { name: "Bản đồ rủi ro" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(nav).getByRole("link", { name: "Lượt dự báo" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Mô hình & giới hạn" })).toBeInTheDocument();
  });
});
