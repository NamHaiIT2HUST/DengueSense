import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { SlidersHorizontal } from "lucide-react";
import { ConceptTag } from "./Badge";
import type { ProvinceRisk } from "../lib/types";

interface AllocRow extends ProvinceRisk {
  cost: number;
  selected: boolean;
}

export function OptimizationPreview({ provinces }: { provinces: ProvinceRisk[] }) {
  const [budget, setBudget] = useState(400_000);

  const ranked = useMemo(() => {
    const withCost: AllocRow[] = provinces.map((p) => ({
      ...p,
      cost: Math.round(300_000 * (0.4 + p.risk_score / 100) * 0.35),
      selected: false,
    }));
    // Greedy theo ti le risk/cost — dung lam BASELINE minh hoa (P1 trong docs/04),
    // phuong an that (P2) toi uu so ca giam duoc chu khong phai xep hang rui ro thuan.
    const sorted = [...withCost].sort(
      (a, b) => b.risk_score / b.cost - a.risk_score / a.cost
    );
    let remaining = budget;
    for (const row of sorted) {
      if (row.cost <= remaining) {
        row.selected = true;
        remaining -= row.cost;
      }
    }
    return sorted;
  }, [provinces, budget]);

  const selectedCount = ranked.filter((r) => r.selected).length;
  const spent = ranked.filter((r) => r.selected).reduce((s, r) => s + r.cost, 0);

  return (
    <div className="glass-panel rounded-2xl p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold">
            Layer 2 — Tối ưu phân bổ nguồn lực
          </h3>
          <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-[var(--ink-secondary)]">
            Kéo thanh ngân sách để xem thuật toán chọn tỉnh nào được ưu tiên.
            Bản demo dùng greedy theo tỉ lệ rủi ro/chi phí — bản thật (MILP,
            OR-Tools) tối ưu <b>số ca giảm được</b>, không chỉ xếp hạng rủi ro.
          </p>
        </div>
        <ConceptTag />
      </div>

      <div className="mb-7 rounded-xl bg-[var(--bg-surface-2)] p-5">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-medium text-[var(--ink-secondary)]">
            <SlidersHorizontal size={15} /> Ngân sách khả dụng
          </span>
          <span className="font-display font-semibold tabular-nums text-[var(--accent)]">
            ${new Intl.NumberFormat("en-US").format(budget)}
          </span>
        </div>
        <input
          type="range"
          min={50_000}
          max={1_500_000}
          step={25_000}
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
        />
        <div className="mt-4 flex gap-6 text-[13px] text-[var(--ink-muted)]">
          <span>
            <b className="text-[var(--ink-primary)]">{selectedCount}</b>/34 tỉnh
            được chọn
          </span>
          <span>
            Đã dùng{" "}
            <b className="text-[var(--ink-primary)]">
              ${new Intl.NumberFormat("en-US").format(spent)}
            </b>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
        {ranked.map((r) => (
          <motion.div
            key={r.province_id}
            animate={{
              opacity: r.selected ? 1 : 0.35,
              scale: r.selected ? 1 : 0.96,
            }}
            transition={{ duration: 0.2 }}
            className="rounded-lg border p-2.5 text-center"
            style={{
              borderColor: r.selected ? "var(--accent)" : "var(--border-hairline)",
              background: r.selected ? "var(--accent-soft)" : "transparent",
            }}
          >
            <div className="truncate text-[11px] font-medium">{r.name}</div>
            <div className="mt-0.5 text-[10px] text-[var(--ink-muted)]">
              ${(r.cost / 1000).toFixed(0)}k
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
