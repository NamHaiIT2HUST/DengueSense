import { motion } from "framer-motion";
import { formatCount } from "@/shared/lib/format";
import type { ProvinceRisk } from "../model/types";
import { Activity, Clock, Sliders, MapPin, CheckCircle2 } from "lucide-react";
import { TiltCard3D } from "@/shared/ui/TiltCard3D";

export function StatTiles({ provinces }: { provinces: ProvinceRisk[] }) {
  const totalCases = provinces.reduce((s, p) => s + p.cases_last_12m, 0);

  const tiles = [
    {
      icon: Activity,
      label: "Khả năng phân định dịch (ROC-AUC)",
      modelTag: "M4-R2",
      value: "0.809",
      sub: "ROC-AUC TB 6 mùa (2005–2010)",
      microTag: "Mùa khó nhất: 0.758",
      badgeText: "ECMWF",
      gradient: "from-blue-600/20 via-cyan-500/10 to-slate-950/95",
      border: "border-cyan-500/30 hover:border-cyan-400/60",
      shadow: "hover:shadow-[0_16px_45px_rgba(14,165,233,0.25)]",
      topGlow: "from-cyan-400 via-blue-400 to-cyan-500",
      valueGradient: "from-white via-cyan-200 to-cyan-400",
      iconColor: "text-cyan-400",
      iconBox:
        "bg-cyan-500/15 border-cyan-500/35 text-cyan-400 group-hover:bg-cyan-500/25 group-hover:shadow-[0_0_15px_rgba(14,165,233,0.4)]",
    },
    {
      icon: Clock,
      label: "Tầm cảnh báo đón đầu",
      modelTag: "T-120d",
      value: "1–6 Tháng",
      sub: "Đón đầu chu kỳ muỗi sinh sản",
      microTag: "Lead Time 180 Ngày",
      badgeText: "Sớm 1-6T",
      gradient: "from-indigo-600/20 via-blue-500/10 to-slate-950/95",
      border: "border-blue-500/30 hover:border-blue-400/60",
      shadow: "hover:shadow-[0_16px_45px_rgba(37,99,235,0.25)]",
      topGlow: "from-blue-400 via-indigo-400 to-cyan-400",
      valueGradient: "from-white via-blue-200 to-blue-400",
      iconColor: "text-blue-400",
      iconBox:
        "bg-blue-500/15 border-blue-500/35 text-blue-400 group-hover:bg-blue-500/25 group-hover:shadow-[0_0_15px_rgba(37,99,235,0.4)]",
    },
    {
      icon: Sliders,
      label: "Tối ưu nguồn lực y tế",
      modelTag: "MILP",
      value: "< 1 Phút",
      sub: "Cân đối 3 nguồn lực trọng yếu",
      microTag: "Google OR-Tools",
      badgeText: "MILP < 60s",
      gradient: "from-emerald-600/20 via-teal-500/10 to-slate-950/95",
      border: "border-emerald-500/30 hover:border-emerald-400/60",
      shadow: "hover:shadow-[0_16px_45px_rgba(16,185,129,0.25)]",
      topGlow: "from-emerald-400 via-teal-400 to-cyan-400",
      valueGradient: "from-white via-emerald-200 to-emerald-400",
      iconColor: "text-emerald-400",
      iconBox:
        "bg-emerald-500/15 border-emerald-500/35 text-emerald-400 group-hover:bg-emerald-500/25 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]",
    },
    {
      icon: MapPin,
      label: "Quy mô dữ liệu thực địa",
      modelTag: "GIS-34",
      value: "34 Tỉnh",
      sub: `${formatCount(totalCases)} ca đo lường thực tế`,
      microTag: "Dịch Tễ Trọng Điểm",
      badgeText: "34 Tỉnh VN",
      gradient: "from-red-600/20 via-rose-500/10 to-slate-950/95",
      border: "border-red-500/30 hover:border-red-400/60",
      shadow: "hover:shadow-[0_16px_45px_rgba(244,63,94,0.25)]",
      topGlow: "from-red-400 via-rose-400 to-amber-400",
      valueGradient: "from-white via-rose-200 to-red-400",
      iconColor: "text-red-400",
      iconBox:
        "bg-red-500/15 border-red-500/35 text-red-400 group-hover:bg-red-500/25 group-hover:shadow-[0_0_15px_rgba(244,63,94,0.4)]",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      {tiles.map((t, i) => (
        <motion.div
          key={t.label}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.45, delay: i * 0.07 }}
          className="h-full"
        >
          <TiltCard3D
            maxTilt={6}
            scale={1.02}
            glare={true}
            glareOpacity={0.14}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border ${t.border} bg-gradient-to-b ${t.gradient} p-5 backdrop-blur-2xl shadow-xl transition-all duration-300 ${t.shadow}`}
          >
            {/* Top glowing neon accent line */}
            <div
              className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${t.topGlow} opacity-80 transition-opacity duration-300 group-hover:opacity-100`}
            />

            <div>
              {/* Header: Title & Icon Box */}
              <div
                className="flex items-center justify-between gap-2 mb-3"
                style={{ transform: "translateZ(15px)" }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
                    {t.label}
                  </span>
                  <span className="rounded bg-slate-900/90 px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-400 border border-slate-800">
                    {t.modelTag}
                  </span>
                </div>
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl border shadow-inner transition-transform duration-300 group-hover:scale-110 shrink-0 ${t.iconBox}`}
                >
                  <t.icon size={16} strokeWidth={2.2} />
                </span>
              </div>

              {/* Big Stat Value with Gradient Fill */}
              <div
                className={`font-display text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums bg-gradient-to-r ${t.valueGradient} bg-clip-text text-transparent`}
                style={{ transform: "translateZ(20px)" }}
              >
                {t.value}
              </div>

              {/* Subtitle Description */}
              <div
                className="mt-1 text-xs text-slate-400 font-medium"
                style={{ transform: "translateZ(10px)" }}
              >
                {t.sub}
              </div>
            </div>

            {/* Bottom Telemetry & Standard Bar */}
            <div
              className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400"
              style={{ transform: "translateZ(12px)" }}
            >
              <span className="rounded-md border border-slate-800/80 bg-slate-900/80 px-2 py-0.5 text-[10px] text-slate-300 font-semibold">
                {t.microTag}
              </span>
              <div className="flex items-center gap-1 text-[11px] text-slate-400 font-sans font-medium">
                <CheckCircle2 size={12} className={t.iconColor} />
                <span>Chuẩn hóa</span>
              </div>
            </div>
          </TiltCard3D>
        </motion.div>
      ))}
    </div>
  );
}
