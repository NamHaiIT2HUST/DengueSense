import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Console ở chế độ DEMO trên bản build: máy chủ giả (MSW) chạy trong trình duyệt và trả SỐ THẬT của exp_016 (tái hiện mùa
 * 2010) — đi qua ĐÚNG đường mã production (client API sinh từ hợp đồng, làm mới token bằng "cookie" demo, route guard,
 * Leaflet thật), không mock ở tầng component.
 */
const VIEWER = { username: "demo.xem", password: "demo-2026-xem" };
const ANALYST = { username: "demo.phan-tich", password: "demo-2026-phan-tich" };
const RUN_2010_03 = "0f6bac6d-b0cc-5177-83a7-ab3e02ae3fe4";

async function login(page: Page, account = VIEWER) {
  await page.getByLabel("Tên đăng nhập").fill(account.username);
  await page.getByLabel("Mật khẩu").fill(account.password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

const mapHeading = (page: Page) => page.getByRole("heading", { level: 1, name: "Bản đồ rủi ro" });
const modelHeading = (page: Page) =>
  page.getByRole("heading", { level: 1, name: "Mô hình & giới hạn" });

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "critical" || v.impact === "serious")
    .map((v) => `${v.id} (${v.nodes.length}): ${v.help} — ${v.nodes[0]?.html.slice(0, 140)}`);
}

async function mapReady(page: Page) {
  await expect(mapHeading(page)).toBeVisible();
  await expect(page.locator("path.leaflet-interactive")).toHaveCount(34);
  await expect(page.getByRole("table", { name: "Bảng xếp hạng tỉnh" })).toBeVisible();
}

test.describe("console (bản build, chế độ demo)", () => {
  test("chưa đăng nhập → về trang đăng nhập; đăng nhập → vào đúng trang được yêu cầu", async ({
    page,
  }) => {
    await page.goto("/app/mo-hinh");
    await expect(page).toHaveURL(/\/dang-nhap\?redirect=%2Fapp%2Fmo-hinh/);
    await expect(page.getByRole("heading", { level: 1, name: "Đăng nhập" })).toBeVisible();

    await login(page);
    await expect(page).toHaveURL(/\/app\/mo-hinh$/);
    await expect(modelHeading(page)).toBeVisible();
    await expect(page.getByText("0,52 ± 0,17")).toBeVisible();
  });

  test("sai mật khẩu → thông báo chung, không vào console", async ({ page }) => {
    await page.goto("/dang-nhap");
    await page.getByLabel("Tên đăng nhập").fill(VIEWER.username);
    await page.getByLabel("Mật khẩu").fill("sai-mat-khau-xxxx");
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Sai tên đăng nhập hoặc mật khẩu" })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/dang-nhap/);
  });

  test("tham số redirect độc hại bị bỏ qua → vào trang đầu của console", async ({ page }) => {
    await page.goto("/dang-nhap?redirect=https%3A%2F%2Fke-xau.example%2F");
    await login(page);
    await expect(page).toHaveURL(/\/app\/ban-do/);
    expect(new URL(page.url()).hostname).toBe("127.0.0.1");
  });

  test("tải lại trang vẫn giữ phiên (khôi phục bằng refresh, không bắt đăng nhập lại)", async ({
    page,
  }) => {
    await page.goto("/dang-nhap");
    await login(page);
    await expect(mapHeading(page)).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/app\/ban-do/);
    await expect(mapHeading(page)).toBeVisible();
  });

  test("đăng xuất → về đăng nhập; tải lại vào /app không còn phiên", async ({ page }) => {
    await page.goto("/dang-nhap");
    await login(page);
    await expect(mapHeading(page)).toBeVisible();

    await page.getByRole("button", { name: "Đăng xuất" }).click();
    await expect(page).toHaveURL(/\/dang-nhap$/);

    await page.goto("/app");
    await expect(page).toHaveURL(/\/dang-nhap\?redirect=/);
  });

  test("điều hướng bàn phím: liên kết bỏ qua điều hướng là phần tử đầu tiên được focus", async ({
    page,
  }) => {
    await page.goto("/dang-nhap");
    await login(page);
    await expect(mapHeading(page)).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: /Bỏ qua điều hướng/ })).toBeFocused();
  });
});

test.describe("bản đồ rủi ro và chi tiết tỉnh (số thật exp_016)", () => {
  test("gate Đợt 1: tháng neo 03/2010 → bản đồ 34 tỉnh, mọi dòng có mức nền, provenance và giới hạn", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    await page.goto("/dang-nhap");
    await login(page);
    await mapReady(page);

    await page
      .getByLabel("Lượt dự báo")
      .selectOption({ label: "Tháng neo 03/2010 · Tái hiện lịch sử" });
    await expect(page).toHaveURL(new RegExp(`run=${RUN_2010_03}`));
    await expect(page.getByText(/dự báo từ tháng neo 03\/2010/)).toBeVisible();
    await expect(page.getByText("m4-r2@1.0.0")).toBeVisible();

    const rows = page.getByRole("table", { name: "Bảng xếp hạng tỉnh" }).getByRole("row");
    await expect(rows).toHaveCount(35); // 34 tỉnh + tiêu đề
    // mọi xác suất đi cùng mức nền (T1)
    for (const text of await rows.allTextContents()) {
      if (text.includes("Hạng")) continue;
      expect(text).toMatch(/Mức nền \d+%/);
    }
    expect(errors).toEqual([]);
  });

  test("đổi tầm dự báo và chỉ số tô màu cập nhật URL và chú giải", async ({ page }) => {
    await page.goto("/dang-nhap");
    await login(page);
    await mapReady(page);

    await page.getByRole("radio", { name: "6 tháng" }).check({ force: true });
    await expect(page).toHaveURL(/h=6/);
    await page
      .getByRole("radio", { name: "Tỉ suất ca dự báo / 100.000 dân" })
      .check({ force: true });
    await expect(page).toHaveURL(/metric=incidence/);
    await expect(page.getByRole("region", { name: "Ca dự báo / 100.000 dân" })).toBeVisible();
  });

  test("bấm tỉnh trong bảng → trang chi tiết: 4 tầm, biểu đồ, giải thích, độ tin cậy", async ({
    page,
  }) => {
    await page.goto("/dang-nhap");
    await login(page);
    await mapReady(page);

    await page.getByRole("link", { name: "Xem chi tiết Khánh Hòa" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Khánh Hòa" })).toBeVisible();
    await expect(page).toHaveURL(/\/app\/tinh\/khanh_hoa/);
    await expect(page.getByRole("img", { name: /Biểu đồ số ca bệnh hàng tháng/ })).toBeVisible();
    await expect(page.getByText("Yếu tố ảnh hưởng đến dự báo")).toBeVisible();
    await expect(page.getByText(/không phải quan hệ nhân quả/)).toBeVisible();
    await expect(page.getByRole("button", { name: /sau 1 tháng/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /sau 6 tháng/ })).toBeVisible();
    await page.getByRole("link", { name: "Về bản đồ" }).click();
    await mapReady(page);
  });

  test("analyst tạo lượt dự báo tái hiện lịch sử và mở kết quả", async ({ page }) => {
    await page.goto("/dang-nhap");
    await login(page, ANALYST);
    await expect(mapHeading(page)).toBeVisible();
    await page.getByRole("link", { name: "Lượt dự báo" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Lượt dự báo" })).toBeVisible();
    await page.getByRole("button", { name: "Tạo lượt" }).click();
    await page.getByRole("link", { name: "Mở kết quả" }).click({ timeout: 15_000 });
    await mapReady(page);
    await expect(page).toHaveURL(new RegExp(`run=${RUN_2010_03}`));
  });

  test("viewer không thấy form tạo lượt", async ({ page }) => {
    await page.goto("/dang-nhap");
    await login(page, VIEWER);
    await page.goto("/app/luot-du-bao");
    await expect(page.getByText(/Chỉ vai trò phân tích trở lên/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Tạo lượt" })).toHaveCount(0);
  });
});

test.describe("tiếp cận (WCAG 2.1 AA): không có vi phạm critical/serious", () => {
  test("đăng nhập", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dang-nhap");
    await expect(page.getByRole("heading", { level: 1, name: "Đăng nhập" })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("mô hình & giới hạn", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dang-nhap");
    await login(page);
    await page.goto("/app/mo-hinh");
    await expect(page.getByText("0,52 ± 0,17")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("bản đồ rủi ro (bản đồ + chú giải + bảng)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dang-nhap");
    await login(page);
    await mapReady(page);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("bản đồ rủi ro tô theo tỉ suất ca", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dang-nhap");
    await login(page);
    await page.goto("/app/ban-do?metric=incidence&h=6");
    await mapReady(page);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("chi tiết tỉnh (biểu đồ + giải thích + độ tin cậy)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dang-nhap");
    await login(page);
    await page.goto(`/app/tinh/khanh_hoa?run=${RUN_2010_03}&h=3`);
    await expect(page.getByRole("heading", { level: 1, name: "Khánh Hòa" })).toBeVisible();
    await expect(page.getByText("Yếu tố ảnh hưởng đến dự báo")).toBeVisible();
    await expect(page.getByRole("img", { name: /Biểu đồ số ca bệnh hàng tháng/ })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test("lượt dự báo", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dang-nhap");
    await login(page, ANALYST);
    await page.goto("/app/luot-du-bao");
    await expect(page.getByRole("table", { name: "Lượt dự báo" })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
});
