import { createFileRoute } from "@tanstack/react-router";

import { DraftPage } from "@/features/dispatch-review";

export const Route = createFileRoute("/app/du-thao/$draftId")({
  component: DraftPage,
});
