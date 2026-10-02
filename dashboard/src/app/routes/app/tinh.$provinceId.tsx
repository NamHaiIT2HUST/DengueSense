import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ProvinceDetailPage } from "@/features/province-detail";
import type { Horizon } from "@/shared/api";

const horizon = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(6)]);

const searchSchema = z.object({
  run: z.uuid().optional().catch(undefined),
  h: horizon.optional().catch(undefined),
});

interface TinhSearch {
  run?: string | undefined;
  h?: Horizon | undefined;
}

export const Route = createFileRoute("/app/tinh/$provinceId")({
  validateSearch: (search: Record<string, unknown>): TinhSearch => searchSchema.parse(search),
  component: function Tinh() {
    const { provinceId } = Route.useParams();
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
      <ProvinceDetailPage
        provinceId={provinceId}
        search={{ run: search.run, h: search.h ?? 3 }}
        onSearchChange={(patch) =>
          void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })
        }
      />
    );
  },
});
