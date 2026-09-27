import { expect, test, type Page } from "@playwright/test";

/**
 * Console chạy trên backend THẬT: đăng nhập qua gateway → identity, cookie refresh HttpOnly, bản đồ ghép từ
 * surveillance + forecast (số M4-R2 thật), tạo lượt dự báo chạy nền thật. Yêu cầu docker compose đang chạy và mật khẩu dev
 * trong biến môi trường (KHÔNG hard-code ở đây).
 */
const analystPassword = process.env.E2E_ANALYST_PASSWORD;
const viewerPassword = process.env.E2E_VIEWER_PASSWORD;

test.skip(!analystPassword || !viewerPassword, "cần E2E_ANALYST_PASSWORD và E2E_VIEWER_PASSWORD");

async function login(page: Page, username: string, password: string) {
  await page.goto("/dang-nhap");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

const mapHeading = (page: Page) => page.getByRole("heading", { level: 1, name: "Bản đồ rủi ro" });

test.describe.configure({ mode: "serial" });

test("analyst tạo lượt dự báo THẬT (chạy nền ~20 s) rồi mở kết quả", async ({ page }) => {
  await login(page, "dev-analyst", analystPassword ?? "");
  await expect(mapHeading(page)).toBeVisible();
  await page.getByRole("link", { name: "Lượt dự báo" }).click();
  await page.getByRole("button", { name: "Tạo lượt" }).click();
  await page.getByRole("link", { name: "Mở kết quả" }).click({ timeout: 90_000 });
  await expect(page.locator("path.leaflet-interactive")).toHaveCount(34);
});

test("viewer: bản đồ 34 tỉnh từ số thật, mọi dòng có mức nền; provenance đúng; không lỗi console", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await login(page, "dev-viewer", viewerPassword ?? "");
  await expect(mapHeading(page)).toBeVisible();
  await expect(page.locator("path.leaflet-interactive")).toHaveCount(34);
  await expect(page.getByText("m4-r2@1.0.0")).toBeVisible();

  const rows = page.getByRole("table", { name: "Bảng xếp hạng tỉnh" }).getByRole("row");
  await expect(rows).toHaveCount(35);
  for (const text of await rows.allTextContents()) {
    if (text.includes("Hạng")) continue;
    expect(text).toMatch(/Mức nền \d+%/);
  }
  expect(errors).toEqual([]);
});

test("chi tiết tỉnh: biểu đồ, giải thích, độ tin cậy từ backend thật", async ({ page }) => {
  await login(page, "dev-viewer", viewerPassword ?? "");
  await expect(mapHeading(page)).toBeVisible();
  await page.getByRole("link", { name: "Xem chi tiết Khánh Hòa" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Khánh Hòa" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Biểu đồ số ca bệnh hàng tháng/ })).toBeVisible();
  await expect(page.getByText("Yếu tố ảnh hưởng đến dự báo")).toBeVisible();
  await expect(page.getByRole("button", { name: /sau 6 tháng/ })).toBeVisible();
});

test("phiên sống qua tải lại (cookie refresh HttpOnly thật) và mất sau đăng xuất", async ({
  page,
}) => {
  await login(page, "dev-viewer", viewerPassword ?? "");
  await expect(mapHeading(page)).toBeVisible();

  const cookies = await page.context().cookies();
  const refresh = cookies.find((c) => c.name === "refresh_token");
  expect(refresh?.httpOnly).toBe(true);
  expect(refresh?.sameSite).toBe("Strict");
  expect(refresh?.path).toBe("/api/v1/auth");
  // JS của trang không đọc được cookie refresh
  expect(await page.evaluate(() => document.cookie)).not.toContain("refresh_token");

  await page.reload();
  await expect(mapHeading(page)).toBeVisible();

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/dang-nhap$/);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/dang-nhap\?redirect=/);
});

test("sai mật khẩu → thông báo chung từ identity thật", async ({ page }) => {
  await page.goto("/dang-nhap");
  await page.getByLabel("Tên đăng nhập").fill("dev-viewer");
  await page.getByLabel("Mật khẩu").fill("sai-mat-khau-xxxxxxxx");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Sai tên đăng nhập hoặc mật khẩu" })
  ).toBeVisible();
});

test("viewer không thấy form tạo lượt", async ({ page }) => {
  await login(page, "dev-viewer", viewerPassword ?? "");
  await expect(mapHeading(page)).toBeVisible(); // đợi đăng nhập xong — goto ngay sẽ HUỶ request đăng nhập đang bay
  await page.goto("/app/luot-du-bao");
  await expect(page.getByText(/Chỉ vai trò phân tích trở lên/)).toBeVisible();
});
