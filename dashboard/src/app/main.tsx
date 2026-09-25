import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { env } from "@/shared/config/env"; // kiểm tra biến môi trường ngay khi khởi động: sai là dừng, không chạy với cấu hình hỏng
import "./index.css";
import { Providers } from "./providers";

async function bootstrap() {
  // Chế độ demo: máy chủ giả trong trình duyệt (MSW), tải động — KHÔNG có trong đường khởi động của chế độ `console`.
  if (env.VITE_APP_MODE === "demo") {
    const { startDemoWorker } = await import("@/mocks/browser");
    await startDemoWorker(env.VITE_API_BASE_URL);
  }

  const root = document.getElementById("root");
  if (!root) throw new Error("Không tìm thấy phần tử #root");
  createRoot(root).render(
    <StrictMode>
      <Providers />
    </StrictMode>
  );
}

void bootstrap();
