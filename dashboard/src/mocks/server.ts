import { setupServer } from "msw/node";

import { API_BASE, createHandlers, memoryStore } from "./handlers";
import { nodeDemoData } from "./nodeDemoData";

/** Máy chủ giả cho Vitest (Node). Test ghi đè từng route bằng `server.use(...)`. */
export const server = setupServer(
  ...createHandlers(API_BASE, memoryStore(), nodeDemoData, { jobDurationMs: 60 })
);
