const BASE = "http://x.invalid";

/**
 * Đường dẫn quay về sau đăng nhập — CHỈ chấp nhận đường dẫn NỘI BỘ dưới `/app` (chống open redirect:
 * `/dang-nhap?redirect=https://ke-xau.example` không được đưa người dùng ra ngoài). Không hợp lệ → `fallback`.
 */
export function safeRedirect(target: unknown, fallback = "/app"): string {
  if (typeof target !== "string" || target === "") return fallback;
  // "//host" và "/\host" đều bị trình duyệt hiểu là URL tuyệt đối cùng giao thức; ký tự điều khiển dùng để lách bộ lọc.
  if (!target.startsWith("/") || target.startsWith("//") || target.includes("\\")) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(target)) return fallback;

  let url: URL;
  try {
    url = new URL(target, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;
  // Dùng pathname ĐÃ chuẩn hoá: "/app/../dang-nhap" → "/dang-nhap" → ngoài /app → fallback.
  if (url.pathname !== "/app" && !url.pathname.startsWith("/app/")) return fallback;
  return url.pathname + url.search + url.hash;
}
