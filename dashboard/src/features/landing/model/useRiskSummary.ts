import { useQuery } from "@tanstack/react-query";

import { fetchStaticJson } from "@/shared/api";

import type { RiskSummary } from "./types";

/** Đọc `public/data/risk_summary.json` (sinh bởi ai-service/app/data/export_dashboard_data.py) — KHÔNG phải API. */
export function useRiskSummary() {
  return useQuery({
    queryKey: ["landing", "risk-summary"],
    queryFn: () => fetchStaticJson<RiskSummary>("/data/risk_summary.json"),
    staleTime: Infinity,
  });
}
