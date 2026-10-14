import { createFileRoute } from "@tanstack/react-router";

import { CaseListPage } from "@/features/cases";

export const Route = createFileRoute("/app/ho-so")({
  component: CaseListPage,
});
