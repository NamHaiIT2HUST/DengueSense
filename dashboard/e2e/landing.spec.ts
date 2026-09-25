import { expect, test } from "@playwright/test";

test.describe("trang giới thiệu (bản build)", () => {
  test("hiển thị đủ các khu và bản đồ 34 tỉnh tải theo yêu cầu", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    await page.goto("/");
    await expect(page).toHaveTitle(/DengueSense/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("hành động thực địa");

    await expect(
      page.getByRole("heading", { name: "Bản đồ rủi ro theo 34 tỉnh thành", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Tối ưu phân bổ nguồn lực", exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "GenAI soạn lệnh điều phối", exact: true })
    ).toBeVisible();

    // Bản đồ là chunk lazy: cuộn tới khu bản đồ rồi chờ đủ 34 tỉnh.
    await page.locator("#map").scrollIntoViewIfNeeded();
    await expect(page.locator(".leaflet-container")).toBeVisible();
    await expect(page.locator("path.leaflet-interactive")).toHaveCount(34);

    expect(errors, "không được có lỗi console/JS").toEqual([]);
  });

  test("không gọi API backend (trang giới thiệu chỉ dùng dữ liệu tĩnh)", async ({ page }) => {
    const apiCalls: string[] = [];
    page.on("request", (r) => {
      if (new URL(r.url()).pathname.startsWith("/api/")) apiCalls.push(r.url());
    });
    await page.goto("/");
    await page.locator("#map").scrollIntoViewIfNeeded();
    await expect(page.locator("path.leaflet-interactive")).toHaveCount(34);
    expect(apiCalls).toEqual([]);
  });

  test("dữ liệu ước lượng được gắn nhãn, không giả làm dữ liệu thật (luật T2)", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText("Ước lượng").first()).toBeVisible();
  });
});

test.describe("định tuyến", () => {
  test("đường dẫn lạ hiện trang 404 có đường về trang chủ", async ({ page }) => {
    await page.goto("/khong-co-trang-nay");
    await expect(page.getByText("404")).toBeVisible();
    await page.getByRole("link", { name: "Về trang chủ" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
