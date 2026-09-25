import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Tiếp cận (WCAG 2.1 AA — docs/10 §10.4). Ngân sách: KHÔNG có vi phạm critical hoặc serious.
 * Vi phạm chưa sửa được phải khai báo ở KNOWN_SERIOUS kèm lý do và việc xử lý — thêm mục vào danh sách là quyết
 * định có chủ đích được review, không phải cách để "cho CI xanh".
 */
const KNOWN_SERIOUS: Record<string, string> = {};

/** Cuộn hết trang để kích hoạt animation `whileInView`, rồi chờ chúng dừng — axe đo màu theo trạng thái ĐANG hiển thị. */
async function settle(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1200);
}

test("trang giới thiệu không có vi phạm tiếp cận critical/serious", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator("#map").scrollIntoViewIfNeeded();
  await expect(page.locator("path.leaflet-interactive")).toHaveCount(34);
  await settle(page);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();

  const describe = (impact: string) =>
    results.violations
      .filter((v) => v.impact === impact && !(v.id in KNOWN_SERIOUS))
      .map((v) => {
        const nodes = v.nodes
          .slice(0, 3)
          .map((n) => `${n.target.join(" ")} ⇒ ${n.html.slice(0, 120)}`);
        return `${v.id} (${v.nodes.length} phần tử): ${v.help}\n    ${nodes.join("\n    ")}`;
      });

  expect(describe("critical"), "vi phạm CRITICAL").toEqual([]);
  expect(describe("serious"), "vi phạm SERIOUS chưa được khai báo").toEqual([]);
});
