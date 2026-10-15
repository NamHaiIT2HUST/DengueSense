import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  CloudRain,
  Radio,
  SlidersHorizontal,
  FileCheck2,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

interface TimelineStage {
  step: string;
  timeTag: string;
  shortLabel: string;
  phase: string;
  title: string;
  desc: string;
  icon: typeof Clock;
  badge: string;
  color: string;
  metrics: { label: string; value: string; highlight?: boolean }[];
  actionNote: string;
}

const STAGES: TimelineStage[] = [
  {
    step: "01",
    timeTag: "T - 120 Ngày",
    shortLabel: "Viễn thám ERA5",
    phase: "Giai đoạn 1: Giám Sát Khí Hậu Viễn Thám",
    title: "Phát Hiện Tín Hiệu Khí Hậu Sớm 4 Tháng",
    desc: "Vệ tinh ECMWF ERA5 ghi nhận nhiệt độ bề mặt tăng cao và lượng mưa tích lũy dồn dập tại lưu vực sông Mekong. Mô hình M4-R2 bắt đầu phát hiện các tín hiệu nhân quả dịch tễ đầu tiên với độ trễ 2 tháng trước khi có ca thực tế.",
    icon: CloudRain,
    badge: "Viễn thám ERA5",
    color: "from-cyan-500/20 to-blue-500/10 border-cyan-500/40 text-cyan-400",
    metrics: [
      { label: "Lượng mưa tích lũy", value: "+340 mm", highlight: true },
      { label: "Nhiệt độ bề mặt", value: "28.6 °C" },
      { label: "Thời gian đón đầu", value: "T - 120 ngày" },
    ],
    actionNote: "Tự động kích hoạt luồng theo dõi đặc biệt cho 34 tỉnh thành trọng điểm.",
  },
  {
    step: "02",
    timeTag: "T - 60 Ngày",
    shortLabel: "Cảnh báo dịch",
    phase: "Giai đoạn 2: Nhận Diện Rủi Ro Bùng Phát",
    title: "Khoanh Vùng Nguy Cơ & Cảnh Báo Bản Đồ",
    desc: "Mô hình tổ hợp M4-R2 xác định xác suất vượt ngưỡng dịch (P75) đạt 89.5% tại An Giang, Đồng Tháp và TP. Hồ Chí Minh. Hệ thống hiển thị bản đồ nhiệt trực quan, giải trình TreeSHAP minh bạch cho hội đồng chuyên môn.",
    icon: Radio,
    badge: "Độ chính xác 89.5%",
    color: "from-blue-500/20 to-indigo-500/10 border-blue-500/40 text-blue-400",
    metrics: [
      { label: "Độ chính xác AI", value: "89.5%", highlight: true },
      { label: "Tỷ trọng ERA5", value: "27.9%" },
      { label: "Mức cảnh báo", value: "BÁO ĐỘNG ĐỎ" },
    ],
    actionNote: "Gửi cảnh báo sớm đến Ban Giám đốc Sở Y tế và CDC các địa phương có nguy cơ cao.",
  },
  {
    step: "03",
    timeTag: "T - 30 Ngày",
    shortLabel: "Tối ưu nguồn lực",
    phase: "Giai đoạn 3: Tối Ưu Nguồn Lực Đa Mục Tiêu",
    title: "Phân Bổ Nguồn Lực Google OR-Tools MILP",
    desc: "Trước khi ca bệnh kịp bùng phát, bộ giải toán MILP tính toán phương án phân bổ tối ưu dưới 1 phút. Cân đối 3 trụ cột thiết yếu: cấp phát trước Cloramin B, tăng cường giường ICU tại bệnh viện vệ tinh và điều phối đội phản ứng nhanh.",
    icon: SlidersHorizontal,
    badge: "MILP Solver < 1 Phút",
    color: "from-amber-500/20 to-orange-500/10 border-amber-500/40 text-amber-400",
    metrics: [
      { label: "Thời gian giải toán", value: "42 ms", highlight: true },
      { label: "Giường cấp cứu", value: "85 giường" },
      { label: "Dự kiến ngăn ngừa", value: "340 ca" },
    ],
    actionNote: "Vật tư và hóa chất được chuyển tới kho dự trữ thực địa 30 ngày trước mùa dịch.",
  },
  {
    step: "04",
    timeTag: "T - 0 Ngày",
    shortLabel: "Công điện B2G",
    phase: "Giai đoạn 4: Ban Hành & Triệt Tiêu Đỉnh Dịch",
    title: "Ban Hành Công Điện Khẩn & Khống Chế Ổ Dịch",
    desc: "GenAI RAG tự động sinh dự thảo công điện B2G chuẩn Nghị định 30/2020/NĐ-CP và điều kiện công bố dịch Quyết định 02/2016/QĐ-TTg. Lãnh đạo thẩm định và ký số theo quy trình 4 mắt. Các đội cơ động xuất quân xử lý ổ bọ gậy, triệt tiêu đỉnh dịch.",
    icon: FileCheck2,
    badge: "Chuẩn NĐ 30/2020",
    color: "from-indigo-500/20 to-blue-500/10 border-indigo-500/40 text-indigo-300",
    metrics: [
      { label: "Thời gian soạn thảo", value: "5 phút", highlight: true },
      { label: "Khóa số liệu Guardrail", value: "100%" },
      { label: "Ký số điện tử CA", value: "Quy trình 4 mắt" },
    ],
    actionNote:
      "Bảo vệ hệ thống y tế tuyến trên không bị vỡ trận, giảm tối đa tỷ lệ tử vong do sốt xuất huyết.",
  },
];

export function OutbreakTimeline() {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const active = STAGES[selectedIdx]!;

  return (
    <section id="timeline" className="relative space-y-12 overflow-hidden">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/4 h-80 w-[600px] -translate-x-1/2 rounded-full opacity-20 blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, rgba(14, 165, 233, 0.4) 0%, rgba(37, 99, 235, 0.2) 60%, transparent 100%)",
        }}
      />

      {/* Section Header */}
      <div className="relative text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-slate-900/80 px-4 py-1.5 text-xs font-semibold text-cyan-300 shadow-md backdrop-blur-md">
          <Clock size={14} className="text-cyan-400" />
          <span className="uppercase tracking-widest text-[11px] font-bold">
            Chu Kỳ Phản Ứng Dịch Tễ Học Khép Kín
          </span>
        </div>
        <h2 className="font-display text-3xl font-extrabold sm:text-5xl tracking-tight leading-[1.15]">
          <span className="text-white">Hành Trình Can Thiệp </span>
          <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
            4 Giai Đoạn Chủ Động
          </span>
        </h2>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          Cách DengueSense chuyển hóa dữ liệu viễn thám khí hậu thành hành động can thiệp y tế thực
          địa, đón đầu và khống chế dịch bệnh từ trước 4 tháng (T-120 đến T-0).
        </p>
      </div>

      {/* Visual Timeline Track */}
      <div className="relative max-w-5xl mx-auto px-4 hidden lg:block">
        <div className="h-1.5 w-full bg-slate-900 rounded-full relative overflow-hidden border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-red-500 transition-all duration-500 rounded-full"
            style={{ width: `${((selectedIdx + 1) / STAGES.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Interactive Timeline Stepper Buttons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 max-w-5xl mx-auto">
        {STAGES.map((s, idx) => {
          const isSelected = selectedIdx === idx;
          return (
            <button
              key={s.step}
              type="button"
              onClick={() => setSelectedIdx(idx)}
              className={`group relative rounded-2xl border p-4 sm:p-5 text-left transition-all duration-300 cursor-pointer ${
                isSelected
                  ? "border-cyan-400/60 bg-gradient-to-b from-blue-950/60 to-slate-950 shadow-xl shadow-cyan-500/15 ring-1 ring-cyan-400/40"
                  : "border-slate-800/80 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900/90"
              }`}
            >
              {/* Active top line */}
              {isSelected && (
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
              )}

              <div className="flex items-center justify-between mb-2.5">
                <span
                  className={`font-mono text-xs font-bold ${
                    isSelected ? "text-cyan-300" : "text-slate-400"
                  }`}
                >
                  {s.timeTag}
                </span>
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-lg font-mono text-xs font-bold transition-colors ${
                    isSelected
                      ? "bg-cyan-400 text-slate-950 font-black shadow-md shadow-cyan-400/40"
                      : "bg-slate-800 text-slate-400 group-hover:text-white"
                  }`}
                >
                  {s.step}
                </span>
              </div>
              <div
                className={`font-display font-bold text-sm sm:text-base leading-snug transition-colors ${
                  isSelected ? "text-white" : "text-slate-300 group-hover:text-white"
                }`}
              >
                {s.shortLabel}
              </div>
              <div className="mt-1 text-[11px] font-medium text-slate-400">{s.badge}</div>
            </button>
          );
        })}
      </div>

      {/* Featured Stage Detail Card */}
      <div className="max-w-5xl mx-auto rounded-3xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 via-slate-950 to-slate-950 p-6 sm:p-9 backdrop-blur-2xl shadow-2xl relative overflow-hidden ring-1 ring-white/5">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="grid gap-8 lg:grid-cols-12 items-center text-left"
          >
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 font-mono text-xs font-bold text-cyan-300">
                  <active.icon size={13} />
                  <span>{active.timeTag}</span>
                </span>
                <span className="rounded-full border border-slate-700 bg-slate-900/90 px-3 py-1 text-xs font-semibold text-slate-300">
                  {active.phase}
                </span>
              </div>

              <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                {active.title}
              </h3>

              <p className="text-slate-300 text-sm leading-relaxed">{active.desc}</p>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                  <ShieldCheck size={16} />
                  <span>Hành động can thiệp thực địa:</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{active.actionNote}</p>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-4 shadow-inner">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-mono text-xs font-bold uppercase tracking-wider text-slate-400">
                  <span>Chỉ Số Trọng Yếu Giai Đoạn {active.step}</span>
                  <TrendingUp size={14} className="text-cyan-400" />
                </div>

                <div className="space-y-2.5">
                  {active.metrics.map((m) => (
                    <div
                      key={m.label}
                      className="flex items-center justify-between rounded-xl bg-slate-950/80 p-3 border border-slate-800/80 transition-colors hover:border-slate-700"
                    >
                      <span className="text-xs text-slate-400">{m.label}</span>
                      <span
                        className={`font-mono text-sm font-bold ${
                          m.highlight ? "text-cyan-300" : "text-white"
                        }`}
                      >
                        {m.value}
                      </span>
                    </div>
                  ))}
                </div>

                <Link
                  to="/app"
                  className="flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 py-3 text-xs font-bold text-white shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <span>Mô phỏng Giai Đoạn Này trên Console</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
