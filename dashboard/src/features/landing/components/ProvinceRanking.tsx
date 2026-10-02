import { motion } from "framer-motion";
import { riskColor } from "../model/riskScale";
import { DataSourceBadge } from "@/shared/ui/Badge";
import type { ProvinceRisk } from "../model/types";

/**
 * Bảng xếp hạng — vừa là nội dung, vừa là "table view" thay thế bản đồ
 * cho người không phân biệt được thang màu (yêu cầu accessibility ở
 * dataviz skill: identity/magnitude không chỉ dựa vào màu).
 */
export function ProvinceRanking({ provinces }: { provinces: ProvinceRisk[] }) {
  const top10 = [...provinces].sort((a, b) => b.risk_score - a.risk_score).slice(0, 10);
  const max = top10[0]?.risk_score ?? 100;

  return (
    <div className="glass-panel rounded-2xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Top 10 tỉnh rủi ro cao nhất</h3>
        <span className="text-[12px] text-[var(--ink-muted)]">12 tháng gần nhất</span>
      </div>

      <div className="space-y-3.5">
        {top10.map((p, i) => (
          <motion.div
            key={p.province_id}
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: i * 0.04 }}
            className="grid grid-cols-[20px_120px_1fr_auto] items-center gap-3"
          >
            <span className="text-[12px] tabular-nums text-[var(--ink-muted)]">{i + 1}</span>
            <span className="truncate text-[13px] font-medium">{p.name}</span>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-surface-2)]">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${(p.risk_score / max) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.04, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ background: riskColor(p.risk_score) }}
              />
            </div>
            <span className="w-8 text-right text-[13px] font-semibold tabular-nums">
              {p.risk_score.toFixed(0)}
            </span>
          </motion.div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-[var(--border-hairline)] pt-4">
        <span className="text-[11px] text-[var(--ink-muted)]">
          Nguồn: OpenDengue + small-area estimation
        </span>
        <DataSourceBadge source={top10[0]?.data_source ?? "estimated"} />
      </div>
    </div>
  );
}
