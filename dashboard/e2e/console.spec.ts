import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Console ở chế độ DEMO trên bản build: máy chủ giả (MSW) chạy trong trình duyệt, nên đi qua ĐÚNG đường mã production
 * — client API sinh từ hợp đồng, làm mới token bằng "cookie" demo, route guard — chứ không phải mock ở tầng component.
 */
const VIEWER = { username: "demo.xem", password: "demo-2026-xem" };

async function login(page: Page) {
  await page.getByLabel("Tên đăng nhập").fill(VIEWER.username);
  await page.getByLabel("Mật khẩu").fill(VIEWER.password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "critical" || v.impact === "serious")
    .map((v) => `${v.id} (${v.nodes.length}): ${v.help} — ${v.nodes[0]?.html.slice(0, 120)}`);
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
    await expect(page.getByRole("heading", { level: 1, name: "Mô hình & giới hạn" })).toBeVisible();
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

  test("tham số redirect độc hại bị bỏ qua", async ({ page }) => {
    await page.goto("/dang-nhap?redirect=https%3A%2F%2Fke-xau.example%2F");
    await login(page);
    await expect(page).toHaveURL(/\/app\/mo-hinh$/);
    expect(new URL(page.url()).hostname).toBe("127.0.0.1");
  });

  test("tải lại trang vẫn giữ phiên (khôi phục bằng refresh, không bắt đăng nhập lại)", async ({
    page,
  }) => {
    await page.goto("/dang-nhap");
    await login(page);
    await expect(page.getByRole("heading", { level: 1, name: "Mô hình & giới hạn" })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/app\/mo-hinh$/);
    await expect(page.getByRole("heading", { level: 1, name: "Mô hình & giới hạn" })).toBeVisible();
  });

  test("đăng xuất → về đăng nhập; tải lại vào /app không còn phiên", async ({ page }) => {
    await page.goto("/dang-nhap");
    await login(page);
    await expect(page.getByRole("heading", { level: 1, name: "Mô hình & giới hạn" })).toBeVisible();

    await page.getByRole("button", { name: "Đăng xuất" }).click();
    await expect(page).toHaveURL(/\/dang-nhap$/);

    await page.goto("/app");
    await expect(page).toHaveURL(/\/dang-nhap\?redirect=/);
  });

  test("không có lỗi JS/console và MSW không chặn trang giới thiệu", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto("/dang-nhap");
    await login(page);
    await expect(page.getByRole("heading", { level: 1, name: "Mô hình & giới hạn" })).toBeVisible();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("tiếp cận: trang đăng nhập và trang mô hình không có vi phạm critical/serious", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dang-nhap");
    await expect(page.getByRole("heading", { level: 1, name: "Đăng nhập" })).toBeVisible();
    expect(await seriousViolations(page), "trang đăng nhập").toEqual([]);

    await login(page);
    await expect(page.getByText("0,52 ± 0,17")).toBeVisible();
    expect(await seriousViolations(page), "trang mô hình").toEqual([]);
  });

  test("điều hướng bàn phím: liên kết bỏ qua điều hướng là phần tử đầu tiên được focus", async ({
    page,
  }) => {
    await page.goto("/dang-nhap");
    await login(page);
    await expect(page.getByRole("heading", { level: 1, name: "Mô hình & giới hạn" })).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: /Bỏ qua điều hướng/ })).toBeFocused();
  });
});
