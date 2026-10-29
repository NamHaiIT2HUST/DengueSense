import { createFileRoute, redirect } from "@tanstack/react-router";

import { hasAnyRole } from "@/entities/user";
import { CaseDetailPage } from "@/features/cases";
import { session } from "@/shared/api";

export const Route = createFileRoute("/app/ho-so/$caseId")({
  beforeLoad: () => {
    const user = session.getState().user;
    if (!hasAnyRole(user, "officer", "approver", "admin")) {
      throw redirect({ to: "/app/ban-do" });
    }
  },
  component: CaseDetailPage,
});
