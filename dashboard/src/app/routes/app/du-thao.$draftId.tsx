import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/du-thao/$draftId")({
  component: () => <div>Dự thảo văn bản</div>,
});
