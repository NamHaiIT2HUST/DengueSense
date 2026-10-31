import { createFileRoute, redirect } from "@tanstack/react-router";

import { hasAnyRole } from "@/entities/user";
import { DraftPage } from "@/features/dispatch-review";
import { session } from "@/shared/api";

export const Route = createFileRoute("/app/du-thao/$draftId")({
  beforeLoad: () => {
    const user = session.getState().user;
    if (!hasAnyRole(user, "officer", "approver", "admin")) {
      throw redirect({ to: "/app/ban-do" });
    }
  },
  component: DraftPage,
});
