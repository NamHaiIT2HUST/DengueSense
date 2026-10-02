import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { RiskMapPage, type RiskMapSearch } from "@/features/risk-map";
import type { Horizon, Region } from "@/shared/api";

const horizon = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(6)]);

/** Đầu vào trên URL KHÔNG tin cậy: giá trị sai thì bỏ (dùng mặc định), không làm hỏng trang. */
const searchSchema = z.object({
  run: z.uuid().optional().catch(undefined),
  h: horizon.optional().catch(undefined),
  metric: z.enum(["exceed_prob", "incidence"]).optional().catch(undefined),
  region: z.enum(["Bắc", "Trung", "Nam"]).optional().catch(undefined),
});

interface BanDoSearch {
  run?: string | undefined;
  h?: Horizon | undefined;
  metric?: RiskMapSearch["metric"] | undefined;
  region?: Region | undefined;
}

export const Route = createFileRoute("/app/ban-do")({
  validateSearch: (search: Record<string, unknown>): BanDoSearch => searchSchema.parse(search),
  component: function BanDo() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
      <RiskMapPage
        search={{
          run: search.run,
          h: search.h ?? 3,
          metric: search.metric ?? "exceed_prob",
          region: search.region,
        }}
        onSearchChange={(patch) =>
          void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })
        }
      />
    );
  },
});
