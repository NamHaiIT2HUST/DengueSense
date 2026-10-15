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
} from "lucide-react";
import { Link } from "@tanstack/react-router";

interface TimelineStage {
  step: string;
  timeTag: string;
  phase: string;
  title: string;
  desc: string;
  icon: typeof Clock;
  badge: string;
  color: string;
  metrics: { label: string; value: string }[];
  actionNote: string;
}

const STAGES: TimelineStage[] = [
  {
    step: "01",
    timeTag: "T - 120 Ngày",
    phase: "Giai đoạn 1: Giám Sát Khí Hậu Viễn Thám",
    title: "Phát Hiện Bất Thường ERA5 Vệ Tinh",
    desc: "Vệ tinh ECMWF ERA5 ghi nhận nhiệt độ bề mặt tăng cao và lượng mưa tích lũy dồn dập tại lưu vực sông Mekong. Mô hình M4-R2 bắt đầu phát hiện các tín hiệu nhân quả dịch tễ đầu tiên với độ trễ 2 tháng.",
    icon: CloudRain,
    badge: "Viễn thám ERA5",
    color: "from-cyan-500/20 to-blue-500/10 border-cyan-500/40 text-cyan-400",
    metrics: [
      { label: "Lượng mưa tích lũy", value: "+340 mm" },
      { label: "Nhiệt độ bề mặt", value: "28.6 °C" },
      { label: "Độ trễ báo cáo", value: "Lag 2 tháng" },
    ],
    actionNote: "Tự động kích hoạt luồng theo dõi đặc biệt cho 34 tỉnh thành trọng điểm.",
  },
  {
    step: "02",
    timeTag: "T - 60 Ngày",
    phase: "Giai đoạn 2: Nhận Diện Rủi Ro Bùng Phát",
    title: "Cảnh Báo Vàng / Đỏ Trên Bản Đồ Dịch Tễ",
    desc: "Mô hình tổ hợp M4-R2 xác định xác suất vượt ngưỡng dịch (P75) đạt 89.5% tại An Giang, Đồng Tháp và TP. Hồ Chí Minh. Hệ thống hiển thị bản đồ nhiệt trực quan, giải trình TreeSHAP minh bạch cho hội đồng chuyên môn.",
    icon: Radio,
    badge: "Độ chính xác 89.5%",
    color: "from-blue-500/20 to-indigo-500/10 border-blue-500/40 text-blue-400",
    metrics: [
      { label: "Độ chính xác AI", value: "89.5%" },
      { label: "Tỷ trọng ERA5", value: "27.9%" },
      { label: "Mức cảnh báo", value: "BÁO ĐỘNG ĐỎ" },
    ],
    actionNote: "Gửi cảnh báo sớm đến Ban Giám đốc Sở Y tế và CDC các địa phương có nguy cơ cao.",
  },
  {
    step: "03",
    timeTag: "T - 30 Ngày",
    phase: "Giai đoạn 3: Tối Ưu Nguồn Lực Đa Mục Tiêu",
    title: "Google OR-Tools MILP Phân Bổ Nguồn Lực",
    desc: "Trước khi ca bệnh kịp bùng phát, bộ giải toán MILP tính toán phương án phân bổ tối ưu dưới 1 phút. Cân đối 3 trụ cột thiết yếu: cấp phát trước Cloramin B, tăng cường giường ICU tại bệnh viện vệ tinh và điều phối đội phản ứng nhanh.",
    icon: SlidersHorizontal,
    badge: "MILP Solver < 1 Phút",
    color: "from-amber-500/20 to-orange-500/10 border-amber-500/40 text-amber-400",
    metrics: [
      { label: "Thời gian giải toán", value: "42 ms" },
      { label: "Giường cấp cứu", value: "85 giường" },
      { label: "Ca ngăn ngừa", value: "340 ca" },
    ],
    actionNote: "Vật tư và hóa chất được chuyển tới kho dự trữ thực địa 30 ngày trước mùa dịch.",
  },
  {
    step: "04",
    timeTag: "T - 0 Ngày",
    phase: "Giai đoạn 4: Ban Hành & Triệt Tiêu Đỉnh Dịch",
    title: "Ban Hành Công Điện Khẩn & Khống Chế Ổ Dịch",
    desc: "GenAI RAG tự động sinh công điện B2G chuẩn Nghị định 30/2020/NĐ-CP và phác đồ điều trị B2B Quyết định 02/2016. Lãnh đạo thẩm duyệt và ký số điện tử. Các đội cơ động xuất quân diệt lăng quăng, triệt tiêu đỉnh dịch.",
    icon: FileCheck2,
    badge: "Chuẩn NĐ 30/2020",
    color: "from-red-500/20 to-rose-500/10 border-red-500/40 text-red-400",
    metrics: [
      { label: "Thời gian soạn thảo", value: "5 phút" },
      { label: "Khóa số liệu Guardrail", value: "100%" },
      { label: "Ký số điện tử CA", value: "Hợp pháp" },
    ],
    actionNote:
      "Bảo vệ hệ thống y tế tuyến trên không bị vỡ trận, giảm tối đa tỷ lệ tử vong do sốt xuất huyết.",
  },
];

export function OutbreakTimeline() {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const active = STAGES[selectedIdx]!;

  return (
    <section id="timeline" className="relative space-y-10">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-cyan-400">
          <Clock size={13} />
          <span>CHU KỲ PHẢN ỨNG DỊCH TỄ HỌC</span>
        </div>
        <h2 className="font-display text-3xl font-extrabold text-white sm:text-4xl tracking-tight">
          Hành Trình Can Thiệp 4 Giai Đoạn (T-120 → T-0)
        </h2>
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          Cách DengueSense chuyển hóa dữ liệu viễn thám khí hậu thành hành động can thiệp y tế thực
          địa, đón đầu và khống chế dịch bệnh từ trước 4 tháng.
        </p>
      </div>

      {/* Interactive Timeline Stepper Buttons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 max-w-5xl mx-auto">
        {STAGES.map((s, idx) => {
          const isSelected = selectedIdx === idx;
          return (
            <button
              key={s.step}
              onClick={() => setSelectedIdx(idx)}
              className={`rounded-2xl border p-4 text-left transition-all ${
                isSelected
                  ? "border-blue-500/60 bg-blue-950/40 shadow-xl shadow-blue-500/20 ring-1 ring-blue-500/40"
                  : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-cyan-400">{s.timeTag}</span>
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-800 font-mono text-xs font-bold text-slate-300">
                  {s.step}
                </span>
              </div>
              <div className="font-display font-bold text-sm text-white truncate">{s.title}</div>
              <div className="mt-1 text-[11px] text-slate-400 truncate">{s.badge}</div>
            </button>
          );
        })}
      </div>

      {/* Featured Stage Detail Card */}
      <div className="max-w-5xl mx-auto rounded-3xl border border-slate-800 bg-slate-950/90 p-6 sm:p-9 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.3 }}
            className="grid gap-8 lg:grid-cols-12 items-center text-left"
          >
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 font-mono text-xs font-bold text-cyan-400">
                  <active.icon size={13} />
                  <span>{active.timeTag}</span>
                </span>
                <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300">
                  {active.phase}
                </span>
              </div>

              <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                {active.title}
              </h3>

              <p className="text-slate-300 text-sm leading-relaxed">{active.desc}</p>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                  <ShieldCheck size={16} />
                  <span>Hành động can thiệp thực địa:</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{active.actionNote}</p>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-4 shadow-inner">
                <div className="border-b border-slate-800 pb-3 font-mono text-xs font-bold uppercase tracking-wider text-slate-400">
                  Chỉ Số Trọng Yếu Giai Đoạn {active.step}
                </div>

                <div className="space-y-3">
                  {active.metrics.map((m) => (
                    <div
                      key={m.label}
                      className="flex items-center justify-between rounded-xl bg-slate-950 p-3 border border-slate-800"
                    >
                      <span className="text-xs text-slate-400">{m.label}</span>
                      <span className="font-mono text-sm font-bold text-cyan-300">{m.value}</span>
                    </div>
                  ))}
                </div>

                <Link
                  to="/app"
                  className="flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 py-3 text-xs font-bold text-white shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
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
