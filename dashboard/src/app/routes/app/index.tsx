import { createFileRoute, redirect } from "@tanstack/react-router";

// Trang đầu của console: bản đồ rủi ro.
export const Route = createFileRoute("/app/")({
  beforeLoad: () => {
    throw redirect({ to: "/app/ban-do" });
  },
});
