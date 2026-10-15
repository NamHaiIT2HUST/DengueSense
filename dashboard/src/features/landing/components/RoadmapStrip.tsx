import { motion } from "framer-motion";
import { Check, Loader2, CircleDot } from "lucide-react";

interface PhaseItem {
  phase: string;
  title: string;
  period: string;
  status: "done" | "active" | "todo";
  statusText: string;
  desc: string;
}

const PHASES: PhaseItem[] = [
  {
    phase: "Giai đoạn 1",
    title: "Nghiên cứu & MVP",
    period: "Q4/2026",
    status: "done",
    statusText: "Hoàn thành",
    desc: "Hoàn thiện hệ sinh thái AI 3 tầng khép kín: Mô hình M4-R2, bộ giải MILP và chuẩn hóa thể thức B2G.",
  },
  {
    phase: "Giai đoạn 2",
    title: "Hạ tầng & Đàm phán",
    period: "Q1/2027",
    status: "active",
    statusText: "Đang triển khai",
    desc: "Đóng gói Cloud bảo mật y tế, hoàn thiện phân quyền RBAC và đàm phán hợp tác thử nghiệm B2B/B2G.",
  },
  {
    phase: "Giai đoạn 3",
    title: "Pilot Thực địa",
    period: "Q2/2027",
    status: "todo",
    statusText: "Kế hoạch",
    desc: "Triển khai thử nghiệm lâm sàng thực địa tại 2 CDC tỉnh/thành phố và 2 bệnh viện chuyên khoa.",
  },
  {
    phase: "Giai đoạn 4",
    title: "Đánh giá & Tối ưu",
    period: "Q3/2027",
    status: "todo",
    statusText: "Kế hoạch",
    desc: "Đo lường chỉ số đáp ứng y tế công cộng (giảm 50% thời gian phản ứng) và tối ưu hóa chi phí vận hành.",
  },
  {
    phase: "Giai đoạn 5",
    title: "Chuyển giao 34 Tỉnh",
    period: "Q4/2027",
    status: "todo",
    statusText: "Kế hoạch",
    desc: "Phủ sóng hệ thống cảnh báo sớm và điều phối nguồn lực tại toàn bộ 34 địa bàn trọng điểm cả nước.",
  },
  {
    phase: "Giai đoạn 6",
    title: "Mở rộng ASEAN",
    period: "2028+",
    status: "todo",
    statusText: "Định hướng",
    desc: "Bản địa hóa mô hình dịch tễ và chuyển giao công nghệ cho các quốc gia Đông Nam Á có dịch tễ tương đồng.",
  },
];

export function RoadmapStrip() {
  return (
    <div className="relative">
      {/* Connecting horizontal line for desktop */}
      <div className="hidden lg:block absolute left-8 right-8 top-[28px] h-0.5 bg-gradient-to-r from-cyan-500/50 via-blue-500/40 to-slate-800" />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-6 text-left">
        {PHASES.map((p, i) => {
          const isDone = p.status === "done";
          const isActive = p.status === "active";

          return (
            <motion.div
              key={p.phase}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              whileHover={{ y: -4 }}
              className={`group relative flex flex-col justify-between rounded-2xl border p-5 backdrop-blur-xl transition-all duration-300 ${
                isActive
                  ? "border-cyan-400/50 bg-gradient-to-b from-blue-950/40 via-slate-950 to-slate-950 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/30"
                  : isDone
                    ? "border-blue-500/30 bg-gradient-to-b from-slate-900/80 via-slate-950 to-slate-950"
                    : "border-slate-800/80 bg-slate-950/70 hover:border-slate-700"
              }`}
            >
              {/* Step indicator node */}
              <div className="relative z-10 mb-4 flex items-center justify-between">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl border-2 transition-transform group-hover:scale-105 shadow-md ${
                    isActive
                      ? "border-cyan-400 bg-gradient-to-tr from-blue-600 to-cyan-500 text-white shadow-cyan-500/40"
                      : isDone
                        ? "border-blue-500 bg-blue-600 text-white shadow-blue-500/30"
                        : "border-slate-700 bg-slate-900 text-slate-500"
                  }`}
                >
                  {isDone ? (
                    <Check size={18} strokeWidth={2.5} />
                  ) : isActive ? (
                    <Loader2 size={18} strokeWidth={2.5} className="animate-spin" />
                  ) : (
                    <CircleDot size={18} strokeWidth={2} />
                  )}
                </div>

                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    isActive
                      ? "border border-cyan-400/40 bg-cyan-400/15 text-cyan-300"
                      : isDone
                        ? "border border-blue-500/30 bg-blue-500/10 text-blue-300"
                        : "border border-slate-800 bg-slate-900 text-slate-400"
                  }`}
                >
                  {p.statusText}
                </span>
              </div>

              {/* Phase name & title */}
              <div className="space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                  {p.phase}
                </div>
                <h4 className="font-display text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                  {p.title}
                </h4>
                <div className="text-xs font-mono font-semibold text-slate-400">{p.period}</div>
                <p className="pt-2 text-xs leading-relaxed text-slate-300/90">{p.desc}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
