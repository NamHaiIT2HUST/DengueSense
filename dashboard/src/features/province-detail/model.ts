import type { Observation } from "@/shared/api";
import { addMonths } from "@/shared/lib/format";
import type { ObservedPoint } from "@/shared/ui/charts/TimeSeriesChart";

/** Điền các tháng thiếu bằng null để biểu đồ ngắt nét đúng chỗ (không nối liền qua tháng không có số liệu). */
export function fillMonths(items: readonly Observation[]): ObservedPoint[] {
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return [];
  const byMonth = new Map(items.map((o) => [o.month, o] as const));
  const out: ObservedPoint[] = [];
  for (let m: string | null = first.month; m !== null && m <= last.month; m = addMonths(m, 1)) {
    const o = byMonth.get(m);
    out.push({ month: m, value: o ? o.cases : null, source: o ? o.data_source : null });
  }
  return out;
}

/** Hệ số nhân của đóng góp SHAP trên thang log: e^c. Trả % thay đổi (dương = tăng). */
export function contributionToPercent(contribution: number): number {
  return Math.exp(contribution) - 1;
}
