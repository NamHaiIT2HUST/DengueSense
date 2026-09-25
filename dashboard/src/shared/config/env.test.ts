import { describe, expect, it } from "vitest";

import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("dùng mặc định an toàn khi không đặt biến (mặc định demo, không gọi backend)", () => {
    expect(parseEnv({})).toEqual({
      VITE_API_BASE_URL: "/api/v1",
      VITE_APP_MODE: "demo",
      VITE_BUILD_VERSION: "dev",
    });
  });

  it("chuỗi rỗng coi như chưa đặt (Vercel/CI hay truyền rỗng)", () => {
    const env = parseEnv({ VITE_APP_MODE: "  ", VITE_API_BASE_URL: "" });
    expect(env.VITE_APP_MODE).toBe("demo");
    expect(env.VITE_API_BASE_URL).toBe("/api/v1");
  });

  it("nhận giá trị hợp lệ và bỏ qua biến lạ của Vite", () => {
    const env = parseEnv({
      VITE_APP_MODE: "console",
      VITE_BUILD_VERSION: "abc1234",
      MODE: "production",
      BASE_URL: "/",
    });
    expect(env.VITE_APP_MODE).toBe("console");
    expect(env.VITE_BUILD_VERSION).toBe("abc1234");
    expect(env).not.toHaveProperty("MODE");
  });

  it("giá trị sai → lỗi chỉ nêu TÊN biến, không nêu giá trị", () => {
    expect(() => parseEnv({ VITE_APP_MODE: "MAT-KHAU-BI-MAT" })).toThrowError(/VITE_APP_MODE/);
    try {
      parseEnv({ VITE_APP_MODE: "MAT-KHAU-BI-MAT" });
    } catch (e) {
      expect(String(e)).not.toContain("MAT-KHAU");
    }
  });
});
