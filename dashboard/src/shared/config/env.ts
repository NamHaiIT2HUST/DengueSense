/**
 * Biến môi trường build-time (`VITE_*`), kiểm bằng Zod — sai là KHÔNG khởi động (docs/10 §19.1).
 *
 * Biến `VITE_*` là CÔNG KHAI (nằm trong bundle): tuyệt đối không đặt bí mật ở đây. Chỉ chứa URL API,
 * chế độ chạy, phiên bản build.
 */
import { z } from "zod";

const schema = z.object({
  /** Cùng origin qua reverse proxy → không cần CORS, cookie SameSite=Strict hoạt động (docs/09 §3.3). */
  VITE_API_BASE_URL: z.string().min(1).default("/api/v1"),
  /**
   * `console`: gọi backend thật. `demo`: dữ liệu mock, không gọi backend (bản Vercel công khai).
   * Mặc định `demo` để một lần deploy quên đặt biến KHÔNG cố gọi backend không tồn tại.
   */
  VITE_APP_MODE: z.enum(["console", "demo"]).default("demo"),
  /** git sha, hiện ở chân trang và gửi kèm báo lỗi. */
  VITE_BUILD_VERSION: z.string().min(1).default("dev"),
});

export type Env = z.infer<typeof schema>;

/** Biến rỗng coi như chưa đặt (Vercel/CI hay truyền chuỗi rỗng). Lỗi CHỈ nêu tên biến, không nêu giá trị. */
export function parseEnv(raw: Record<string, unknown>): Env {
  const cleaned: Record<string, unknown> = {};
  for (const key of Object.keys(schema.shape)) {
    const value = raw[key];
    cleaned[key] = typeof value === "string" && value.trim() === "" ? undefined : value;
  }
  const result = schema.safeParse(cleaned);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((i) => i.path.join(".")))];
    throw new Error(`Cấu hình môi trường không hợp lệ: ${names.join(", ")}`);
  }
  return result.data;
}

export const env: Env = parseEnv(import.meta.env);
