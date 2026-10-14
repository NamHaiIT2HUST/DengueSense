import { createFileRoute } from "@tanstack/react-router";

import { CaseDetailPage } from "@/features/cases";

export const Route = createFileRoute("/app/ho-so/$caseId")({
  component: CaseDetailPage,
});
