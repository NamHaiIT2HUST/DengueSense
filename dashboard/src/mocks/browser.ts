/**
 * Máy chủ giả trong TRÌNH DUYỆT cho chế độ demo (`VITE_APP_MODE=demo`) — tải động từ app/main.tsx, không nằm trong
 * chunk khởi đầu và không được nạp ở chế độ `console` (backend thật).
 */
import { setupWorker } from "msw/browser";

import { createHandlers, sessionStorageStore } from "./handlers";

export async function startDemoWorker(baseUrl: string): Promise<void> {
  const worker = setupWorker(...createHandlers(baseUrl, sessionStorageStore()));
  await worker.start({
    // Mọi yêu cầu khác (ảnh, JSON tĩnh của trang giới thiệu, bản đồ nền…) đi thẳng ra mạng.
    onUnhandledRequest: "bypass",
    quiet: true,
  });
}
