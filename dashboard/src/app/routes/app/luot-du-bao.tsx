import { createFileRoute } from "@tanstack/react-router";

import { ForecastRunsPage } from "@/features/forecast-runs";

export const Route = createFileRoute("/app/luot-du-bao")({
  component: ForecastRunsPage,
});
