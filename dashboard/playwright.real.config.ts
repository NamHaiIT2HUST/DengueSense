import { defineConfig, devices } from "@playwright/test";

/**
 * E2E trên BACKEND THẬT (gateway + identity + surveillance + forecast trong docker compose), không có MSW.
 * Chạy:  docker compose up (xem infra/README.md) → đặt E2E_ANALYST_PASSWORD, E2E_VIEWER_PASSWORD (tài khoản dev-analyst /
 * dev-viewer, mật khẩu trong infra/.env.devtool) → `npm run test:e2e:real`. Thiếu biến thì các test bị bỏ qua.
 * Dev server chạy `--mode console` và proxy /api tới gateway (DEV_API_PROXY, mặc định http://127.0.0.1:8080).
 */
const PORT = 5174;

export default defineConfig({
  testDir: "./e2e-real",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev:console -- --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
