/**
 * Đồng bộ thông điệp lỗi tiếng Việt với danh mục mã lỗi của hợp đồng (contracts/errors.md, nguồn sự thật).
 *
 * Đặt ngoài `src/` vì cần Node (đọc file ở gốc repo, ngoài thư mục Vite được phép phục vụ) — tsconfig.node.json
 * có kiểu Node; mã ứng dụng (`src/`) thì không, để không lỡ dùng API Node trong trình duyệt.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { vi } from "../../src/shared/i18n/vi.ts";

function catalogCodes(): string[] {
  // Vitest chạy với thư mục làm việc là dashboard/; hợp đồng nằm ở gốc repo.
  const text = readFileSync(resolve(process.cwd(), "..", "contracts", "errors.md"), "utf8");
  return [...text.matchAll(/^\| `([a-z]+\.[a-z_]+)` \|/gm)].map((m) => m[1] as string);
}

describe("vi.errors.byCode ↔ contracts/errors.md", () => {
  it("MỌI mã lỗi trong hợp đồng đều có thông điệp tiếng Việt", () => {
    const codes = catalogCodes();
    expect(codes.length).toBeGreaterThan(20);
    const missing = codes.filter((c) => !vi.errors.byCode[c]);
    expect(missing, `thêm thông điệp vào shared/i18n/vi.ts cho: ${missing.join(", ")}`).toEqual([]);
  });

  it("không có thông điệp mồ côi (mã không có trong hợp đồng, trừ mã phía client)", () => {
    const codes = new Set(catalogCodes());
    const orphans = Object.keys(vi.errors.byCode).filter(
      (c) => !codes.has(c) && !c.startsWith("client.")
    );
    expect(orphans).toEqual([]);
  });

  it("thông điệp không rỗng và không lộ thuật ngữ kỹ thuật nội bộ", () => {
    for (const [code, message] of Object.entries(vi.errors.byCode)) {
      expect(message.trim(), code).not.toBe("");
      expect(message, code).not.toMatch(/SQL|stack|exception|null|undefined/i);
    }
  });
});
