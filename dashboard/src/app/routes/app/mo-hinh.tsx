import { createFileRoute } from "@tanstack/react-router";

import { ModelInfoPage } from "@/features/model-info";

export const Route = createFileRoute("/app/mo-hinh")({
  component: ModelInfoPage,
});
