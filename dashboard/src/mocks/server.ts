import { setupServer } from "msw/node";

import { handlers } from "./handlers";

/** Máy chủ giả cho Vitest (Node). Test ghi đè từng route bằng `server.use(...)`. */
export const server = setupServer(...handlers);
