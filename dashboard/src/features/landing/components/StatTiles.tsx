import { motion } from "framer-motion";
import { formatCount } from "@/shared/lib/format";
import type { ProvinceRisk } from "../model/types";

export function StatTiles({ provinces }: { provinces: ProvinceRisk[] }) {
  const totalCases = provinces.reduce((s, p) => s + p.cases_last_12m, 0);

  const tiles = [
    {
      label: "Độ chính xác mô hình (Lớp 1)",
      value: "89,5%",
      sub: "XGBoost + Random Forest kết hợp ERA5",
      accent: true,
    },
    {
      label: "Cảnh báo sớm mục tiêu",
      value: "1–6 tháng",
      sub: "Chủ động trước 30–60 ngày so với thủ công",
    },
    {
      label: "Phân bổ tối ưu (Lớp 2)",
      value: "3 nguồn lực",
      sub: "Giường bệnh, vật tư & nhân lực cơ động",
    },
    {
      label: "Quy mô giám sát",
      value: "34 tỉnh/thành",
      sub: `${formatCount(totalCases)} ca tổng hợp toàn quốc`,
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
          <div className="text-[12px] font-medium text-[var(--ink-muted)]">{t.label}</div>
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
