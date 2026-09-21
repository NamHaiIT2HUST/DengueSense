import { motion } from "framer-motion";
import type { ProvinceRisk } from "../lib/types";

function fmt(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n);
}

export function StatTiles({ provinces }: { provinces: ProvinceRisk[] }) {
  const totalCases = provinces.reduce((s, p) => s + p.cases_last_12m, 0);
  const top = [...provinces].sort((a, b) => b.risk_score - a.risk_score)[0];
  const realPct = Math.round(
    (provinces.filter((p) => p.data_source === "real").length /
      provinces.length) *
      100
  );

  const tiles = [
    {
      label: "Tổng ca (12 tháng gần nhất)",
      value: fmt(totalCases),
      sub: "34/34 tỉnh thành mới (NQ 202/2025/QH15)",
    },
    {
      label: "Tỉnh rủi ro cao nhất",
      value: top?.name ?? "—",
      sub: `Điểm rủi ro ${top?.risk_score.toFixed(0)}/100`,
      accent: true,
    },
    {
      label: "Độ phủ dữ liệu thật",
      value: `${realPct}%`,
      sub: realPct < 100 ? "Phần còn lại là ước lượng có gắn nhãn" : "Toàn bộ đo trực tiếp",
    },
    {
      label: "Độ trễ cảnh báo mục tiêu",
      value: "1–6 tháng",
      sub: "So với ~2–4 tuần báo cáo thủ công hiện nay",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map((t, i) => (
        <motion.div
          key={t.label}
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.4, delay: i * 0.06 }}
          className="glass-panel rounded-2xl p-5"
        >
          <div className="text-[12px] font-medium text-[var(--ink-muted)]">
            {t.label}
          </div>
          <div
            className="mt-1.5 font-display text-2xl font-semibold tabular-nums"
            style={{ color: t.accent ? "var(--risk-6)" : "var(--ink-primary)" }}
          >
            {t.value}
          </div>
          <div className="mt-1 text-[12px] text-[var(--ink-muted)]">{t.sub}</div>
        </motion.div>
      ))}
    </div>
  );
}
