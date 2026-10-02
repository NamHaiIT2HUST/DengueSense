import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { RouterProvider } from "@tanstack/react-router";

import { queryClient } from "./queryClient";
import { router } from "./router";

export function Providers() {
  return (
    // reducedMotion="user": tôn trọng cài đặt "giảm chuyển động" của hệ điều hành (docs/10 §10.5, WCAG 2.3.3).
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MotionConfig>
  );
}
