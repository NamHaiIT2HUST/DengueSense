import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/ho-so/$caseId")({
  component: () => <div>Chi tiết hồ sơ</div>,
});
