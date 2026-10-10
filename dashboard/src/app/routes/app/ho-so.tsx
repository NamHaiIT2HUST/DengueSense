import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/ho-so")({
  component: () => <div>Danh sách hồ sơ</div>,
});
