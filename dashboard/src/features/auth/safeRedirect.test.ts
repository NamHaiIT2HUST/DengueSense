import { describe, expect, it } from "vitest";

import { safeRedirect } from "./safeRedirect";

describe("safeRedirect (chống open redirect)", () => {
  it("cho phép đường dẫn nội bộ dưới /app, giữ query và hash", () => {
    expect(safeRedirect("/app")).toBe("/app");
    expect(safeRedirect("/app/mo-hinh")).toBe("/app/mo-hinh");
    expect(safeRedirect("/app/ban-do?run_id=abc&horizon=3#chi-tiet")).toBe(
      "/app/ban-do?run_id=abc&horizon=3#chi-tiet"
    );
  });

  it.each([
    ["URL tuyệt đối", "https://ke-xau.example/app"],
    ["giao thức tương đối", "//ke-xau.example/app"],
    ["gạch chéo ngược (trình duyệt hiểu như //)", "/\\ke-xau.example"],
    ["gạch chéo ngược ở giữa", "/app/\\..\\evil"],
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
    ["không bắt đầu bằng /", "app/mo-hinh"],
    ["ngoài /app", "/dang-nhap"],
    ["trang giới thiệu", "/"],
    ["thoát khỏi /app bằng ..", "/app/../dang-nhap"],
    ["/appx không phải /app", "/appx"],
    ["ký tự điều khiển (xuống dòng)", "/app\n//evil.example"],
    ["ký tự NUL", "/app\u0000"],
    ["tab", "/app\t/x"],
  ])("từ chối %s", (_name, target) => {
    expect(safeRedirect(target)).toBe("/app");
  });

  it("đầu vào không phải chuỗi hoặc rỗng → mặc định", () => {
    for (const bad of [undefined, null, 42, {}, [], "", true]) {
      expect(safeRedirect(bad)).toBe("/app");
    }
    expect(safeRedirect(undefined, "/app/mo-hinh")).toBe("/app/mo-hinh");
  });

  it("chuẩn hoá đường dẫn trước khi kiểm", () => {
    expect(safeRedirect("/app/./mo-hinh")).toBe("/app/mo-hinh");
    expect(safeRedirect("/app//x")).toBe("/app//x"); // vẫn nội bộ, không phải giao thức tương đối
  });
});
