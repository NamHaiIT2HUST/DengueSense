import { createFileRoute } from "@tanstack/react-router";

import { AlertsPage } from "@/features/alerts";

export const Route = createFileRoute("/app/canh-bao")({
  component: AlertsPage,
});
