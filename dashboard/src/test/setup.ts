import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "@/mocks/server";

// Yêu cầu mạng chưa có handler là LỖI (không âm thầm gọi ra ngoài) — test phải khai báo rõ mọi lời gọi.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup(); // Testing Library không tự dọn khi không dùng globals của Vitest
});
afterAll(() => server.close());
