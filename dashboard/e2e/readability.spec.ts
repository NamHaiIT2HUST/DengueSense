import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { DEMO_ACCOUNTS } from "../src/shared/config/demo.js";

type Role = "viewer" | "analyst" | "officer" | "approver";

async function login(page: Page, role: Role) {
  const account = DEMO_ACCOUNTS.find((a) => a.roles.includes(role))!;
  await page.goto("/dang-nhap");
  await page.getByLabel("Tên đăng nhập").fill(account.username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/ban-do/);
}

async function contrast(text: Locator, surface: Locator) {
  const foreground = await text.evaluate((el) => getComputedStyle(el).color);
  const background = await surface.evaluate((el) => getComputedStyle(el).backgroundColor);
  const luminance = (color: string) => {
    const channels = color
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map(Number);
    return channels.reduce((sum, channel, index) => {
      const srgb = channel / 255;
      const linear = srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
      return sum + linear * [0.2126, 0.7152, 0.0722][index]!;
    }, 0);
  };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

async function waitForOpaqueContent(text: Locator) {
  await expect(text).toBeVisible();
  await expect
    .poll(() =>
      text.evaluate((el) => {
        let opacity = 1;
        for (let node: Element | null = el; node; node = node.parentElement) {
          opacity *= Number(getComputedStyle(node).opacity);
        }
        return opacity;
      })
    )
    .toBe(1);
}

const screens: { name: string; path: string; role?: Role }[] = [
  { name: "landing", path: "/" },
  { name: "login", path: "/dang-nhap" },
  { name: "map", path: "/app/ban-do", role: "viewer" },
  { name: "models", path: "/app/mo-hinh", role: "viewer" },
  { name: "alerts", path: "/app/canh-bao", role: "officer" },
  { name: "cases", path: "/app/ho-so", role: "officer" },
  { name: "draft", path: "/app/du-thao/draft-south-01", role: "approver" },
];

for (const theme of ["light", "dark"] as const) {
  test.describe(`readability ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript((value) => localStorage.setItem("denguesense-theme", value), theme);
    });

    for (const screen of screens) {
      test(`${screen.name}: text contrast`, async ({ page }, info) => {
        if (screen.role) await login(page, screen.role);
        await page.goto(screen.path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        if (screen.name === "map")
          await expect(page.locator("path.leaflet-interactive")).toHaveCount(34);
        if (screen.name === "models")
          await expect(page.getByText("L12", { exact: true })).toBeVisible();
        if (screen.name === "alerts" || screen.name === "cases")
          await expect(page.getByRole("table")).toBeVisible();
        if (screen.name === "draft")
          await expect(page.getByText("Kiểm soát an toàn văn bản (Guardrails)")).toBeVisible();
        const result = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
        await info.attach("contrast.json", {
          body: JSON.stringify(result.violations, null, 2),
          contentType: "application/json",
        });
        expect(
          result.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => ({ html: n.html, detail: n.failureSummary })),
          }))
        ).toEqual([]);
      });
    }

    test("selected sidebar stays readable on its background", async ({ page }) => {
      await login(page, "viewer");
      await page.getByRole("link", { name: "Mô hình & giới hạn", exact: true }).first().click();
      const link = page
        .getByRole("navigation")
        .getByRole("link", { name: "Mô hình & giới hạn", exact: true });
      await expect(link).toHaveAttribute("aria-current", "page");
      expect(
        await contrast(link.locator("span"), link.locator(".console-nav-selection"))
      ).toBeGreaterThanOrEqual(4.5);
    });

    test("segmented controls keep every option readable and respond to keyboard", async ({
      page,
    }) => {
      await login(page, "viewer");
      const group = page.getByRole("group", { name: "Tầm dự báo", exact: true });
      const radio = group.getByRole("radio", { name: "3 tháng", exact: true });
      await radio.focus();
      await page.keyboard.press("ArrowRight");
      await expect(group.getByRole("radio", { name: "6 tháng", exact: true })).toBeChecked();
      await expect(page).toHaveURL(/h=6/);
      const container = group.locator("div").first();
      for (const label of await group.locator("label").all()) {
        const span = label.locator("span");
        const checked = await label.locator("input").isChecked();
        expect(await contrast(span, checked ? span : container)).toBeGreaterThanOrEqual(4.5);
      }
    });

    test("hero badges, GIS label and technology pill have readable color pairs", async ({
      page,
    }, info) => {
      await page.goto("/");
      await expect(page.locator("#overview")).toBeVisible();
      for (const label of [
        "ROC-AUC 6 mùa: 0.809",
        "Giải toán MILP < 1 Phút",
        "Chuẩn Thể Thức NĐ 30/2020",
      ]) {
        const badge = page.locator("#overview").getByText(label, { exact: true });
        await expect(badge).toBeVisible();
        expect(await contrast(badge, badge)).toBeGreaterThanOrEqual(4.5);
      }
      for (const label of ["VN-GIS / 34 Tỉnh", "ERA5 Sat", "MILP Grid", "Lead Time 1–6T"]) {
        const telemetry = page.getByText(label, { exact: true });
        expect(await contrast(telemetry, telemetry.locator(".."))).toBeGreaterThanOrEqual(4.5);
      }
      const tech = page.getByText(/^Công nghệ:/).first();
      await tech.scrollIntoViewIfNeeded();
      expect(await contrast(tech, tech)).toBeGreaterThanOrEqual(4.5);
      await page.locator("#overview").screenshot({ path: info.outputPath("hero.png") });
    });

    test("landing tabs remain readable after changing content", async ({ page }, info) => {
      await page.goto("/");
      for (const [name, heading] of [
        ["2. Tối Ưu Nguồn Lực", "Tối ưu hóa Phân bổ Nguồn lực"],
        ["3. Dự Thảo Công Điện", "Soạn Thảo Dự Thảo Công Điện B2G"],
      ]) {
        await page.getByRole("button", { name, exact: true }).click();
        await waitForOpaqueContent(page.getByRole("heading", { name: heading, exact: true }));
        const result = await new AxeBuilder({ page })
          .include("#overview")
          .withRules(["color-contrast"])
          .analyze();
        await info.attach(`${name}-contrast.json`, {
          body: JSON.stringify(result.violations, null, 2),
          contentType: "application/json",
        });
        expect(
          result.violations.map((v) =>
            v.nodes.map((n) => ({ html: n.html, detail: n.failureSummary }))
          )
        ).toEqual([]);
      }
      for (const [name, heading] of [
        [/2\. Tối Ưu Nguồn Lực Điều Trị/, "Tối Ưu Hóa Nguồn Lực Toán Học Dưới 1 Phút"],
        [/3\. Công Điện & Thẩm Định 4 Mắt/, "Soạn Thảo Công Điện Khẩn Từ 2 Ngày Xuống 5 Phút"],
      ] as const) {
        await page.getByRole("button", { name }).click();
        await waitForOpaqueContent(page.getByRole("heading", { name: heading, exact: true }));
        const result = await new AxeBuilder({ page })
          .include("#layers")
          .withRules(["color-contrast"])
          .analyze();
        await info.attach("layer-tab-contrast.json", {
          body: JSON.stringify(result.violations, null, 2),
          contentType: "application/json",
        });
        expect(
          result.violations.map((v) =>
            v.nodes.map((n) => ({ html: n.html, detail: n.failureSummary }))
          )
        ).toEqual([]);
      }
    });

    test("mobile filters keep all horizon labels visible", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await login(page, "viewer");
      const group = page.getByRole("group", { name: "Tầm dự báo", exact: true });
      for (const h of [1, 2, 3, 6]) {
        await expect(group.getByText(`${h} tháng`, { exact: true })).toBeVisible();
      }
      await group.getByRole("radio", { name: "2 tháng", exact: true }).check({ force: true });
      await expect(page).toHaveURL(/h=2/);
      const result = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
      expect(result.violations.map((v) => v.id)).toEqual([]);
    });
  });
}

test("native cursor has no colored tracking overlay on landing or console", async ({ page }) => {
  await page.goto("/");
  await page.mouse.move(350, 250);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator('[class*="z-[9999]"]')).toHaveCount(0);
  expect(await page.locator("body").evaluate((el) => getComputedStyle(el).cursor)).not.toBe("none");
  await login(page, "viewer");
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).hover();
  await expect(page.locator('[class*="z-[9999]"]')).toHaveCount(0);
});
