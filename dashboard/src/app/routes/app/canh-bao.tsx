import { createFileRoute, redirect } from "@tanstack/react-router";

import { hasAnyRole } from "@/entities/user";
import { AlertsPage } from "@/features/alerts";
import { session } from "@/shared/api";

export const Route = createFileRoute("/app/canh-bao")({
  beforeLoad: () => {
    const user = session.getState().user;
    if (!hasAnyRole(user, "officer", "approver", "admin")) {
      throw redirect({ to: "/app/ban-do" });
    }
  },
  component: AlertsPage,
});
