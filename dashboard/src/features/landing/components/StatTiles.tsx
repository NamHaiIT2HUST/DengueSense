import { motion } from "framer-motion";
import { formatCount } from "@/shared/lib/format";
import type { ProvinceRisk } from "../model/types";
import { Activity, Clock, Sliders, MapPin } from "lucide-react";

export function StatTiles({ provinces }: { provinces: ProvinceRisk[] }) {
  const totalCases = provinces.reduce((s, p) => s + p.cases_last_12m, 0);

  const tiles = [
    {
      icon: Activity,
      label: "Độ chính xác cảnh báo dịch (Lớp 1)",
      value: "89,5%",
      sub: "XGBoost + Random Forest & ERA5",
      gradient: "from-blue-500/20 via-cyan-500/10 to-transparent",
      valueColor: "text-cyan-400",
      border: "border-cyan-500/30",
    },
    {
      icon: Clock,
      label: "Tầm cảnh báo sớm",
      value: "1–6 Tháng",
      sub: "Đón đầu chu kỳ muỗi sinh sản",
      gradient: "from-indigo-500/20 via-blue-500/10 to-transparent",
      valueColor: "text-blue-400",
      border: "border-blue-500/30",
    },
    {
      icon: Sliders,
      label: "Tối ưu hoá nguồn lực (Lớp 2)",
      value: "< 1 Phút",
      sub: "MILP chia 3 nguồn lực thiết yếu",
      gradient: "from-emerald-500/20 via-teal-500/10 to-transparent",
      valueColor: "text-emerald-400",
      border: "border-emerald-500/30",
    },
    {
      icon: MapPin,
      label: "Quy mô dữ liệu giám sát",
      value: "34 Tỉnh",
      sub: `${formatCount(totalCases)} ca đo lường thực tế`,
      gradient: "from-red-500/20 via-rose-500/10 to-transparent",
      valueColor: "text-red-400",
      border: "border-red-500/30",
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
          className={`relative overflow-hidden rounded-2xl border ${t.border} bg-gradient-to-b ${t.gradient} bg-slate-950/80 p-5 backdrop-blur-xl shadow-lg transition-transform hover:-translate-y-1`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">{t.label}</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 border border-slate-800">
              <t.icon size={15} className={t.valueColor} />
            </span>
          </div>
          <div
            className={`mt-2 font-display text-3xl font-extrabold tracking-tight tabular-nums ${t.valueColor}`}
          >
            {t.value}
          </div>
          <div className="mt-1 text-xs text-slate-400">{t.sub}</div>
        </motion.div>
      ))}
    </div>
  );
}
