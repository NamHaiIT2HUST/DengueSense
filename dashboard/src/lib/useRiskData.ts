import { useQuery } from "@tanstack/react-query";
import type { RiskSummary } from "./types";

async function fetchRiskSummary(): Promise<RiskSummary> {
  const res = await fetch("/data/risk_summary.json");
  if (!res.ok) throw new Error("Không tải được risk_summary.json");
  return res.json();
}

export function useRiskData() {
  return useQuery({
    queryKey: ["risk-summary"],
    queryFn: fetchRiskSummary,
    staleTime: Infinity,
  });
}

/** Nội suy màu thang rủi ro (sequential, đỏ) theo risk_score 0-100. */
const RISK_RAMP = [
  "#fff5f0",
  "#fee0d2",
  "#fcbba1",
  "#fc9272",
  "#fb6a4a",
  "#ef3b2c",
  "#cb181d",
  "#99000d",
];

export function riskColor(score: number): string {
  const idx = Math.min(
    RISK_RAMP.length - 1,
    Math.floor((score / 100) * RISK_RAMP.length)
  );
  return RISK_RAMP[Math.max(0, idx)];
}

export function riskLabel(score: number): string {
  if (score >= 87.5) return "Rất cao";
  if (score >= 62.5) return "Cao";
  if (score >= 37.5) return "Trung bình";
  if (score >= 12.5) return "Thấp";
  return "Rất thấp";
}
