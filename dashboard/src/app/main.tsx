import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@/shared/config/env"; // kiểm tra biến môi trường ngay khi khởi động: sai là dừng, không chạy với cấu hình hỏng
import "./index.css";
import { Providers } from "./providers";

const root = document.getElementById("root");
if (!root) throw new Error("Không tìm thấy phần tử #root");

createRoot(root).render(
  <StrictMode>
    <Providers />
  </StrictMode>
);
