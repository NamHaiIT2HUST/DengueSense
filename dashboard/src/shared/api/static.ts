/**
 * Tải file JSON tĩnh trong `public/` (trang giới thiệu dùng `public/data/*.json`, KHÔNG phải API).
 * Cùng `client.ts`, đây là nơi được phép gọi `fetch` (oxlint chặn `fetch` ở nơi khác).
 */
import { ApiError, NetworkError } from "./errors";

export async function fetchStaticJson<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path);
  } catch {
    throw new NetworkError();
  }
  if (!response.ok) {
    throw new ApiError({ status: response.status, code: "client.static_not_found" });
  }
  return (await response.json()) as T;
}
