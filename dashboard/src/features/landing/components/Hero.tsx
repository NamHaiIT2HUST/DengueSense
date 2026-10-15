import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Radar, Cpu, FileText, CheckCircle2, Sparkles, MapPin } from "lucide-react";
import { HeroCommandCenter } from "./HeroCommandCenter";

const PILLARS = [
  {
    icon: Radar,
    layer: "Layer 1",
    badge: "Độ chính xác 89,5%",
    title: "Dự báo Dịch tễ (AI)",
    desc: "Mô hình tổ hợp M4-R2 (XGBoost + Random Forest) tích hợp dữ liệu viễn thám ERA5, cảnh báo sớm 1–6 tháng trước khi bùng dịch.",
    color: "from-blue-500/20 to-cyan-500/10 border-blue-500/30 text-cyan-400",
  },
  {
    icon: Cpu,
    layer: "Layer 2",
    badge: "MILP Solver < 1 Phút",
    title: "Tối ưu Phân bổ Nguồn lực",
    desc: "Quy hoạch nguyên hỗn hợp giải bài toán phân bổ 3 trụ cột thiết yếu: Giường bệnh, Hóa chất Cloramin B và Đội phản ứng nhanh.",
    color: "from-blue-600/20 to-indigo-500/10 border-blue-600/30 text-blue-400",
  },
  {
    icon: FileText,
    layer: "Layer 3",
    badge: "Chuẩn NĐ 30/2020",
    title: "Soạn thảo Công điện GenAI",
    desc: "RAG tự động sinh dự thảo công văn chỉ đạo B2G và phác đồ điều trị B2B, tích hợp Guardrail G1 khóa cứng số liệu chống ảo giác.",
    color: "from-red-500/20 to-rose-500/10 border-red-500/30 text-red-400",
  },
];

const TRUST_TAGS = [
  "Dữ liệu khí hậu ERA5 (ECMWF)",
  "Giám sát 34 Tỉnh dịch tễ trọng điểm",
  "Nghị định số 30/2020/NĐ-CP",
  "Quyết định số 02/2016/QĐ-BYT & QĐ 3711",
  "Cơ chế Thẩm định 4 mắt (Human-in-the-loop)",
];

export function Hero() {
  return (
    <section id="overview" className="relative overflow-hidden px-6 pb-20 pt-12 sm:pt-20">
      {/* Dynamic ambient background glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-[-15%] h-[600px] w-[1000px] -translate-x-1/2 rounded-full opacity-30 blur-[130px]"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(37, 99, 235, 0.45) 0%, rgba(14, 165, 233, 0.25) 45%, rgba(239, 68, 68, 0.15) 80%, transparent 100%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl text-center">
        {/* Top Signature Brand Insignia */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-8 inline-flex items-center justify-center"
        >
          <div className="relative group inline-flex items-center gap-3 rounded-full border border-blue-500/30 bg-slate-950/70 px-5 py-2 shadow-[0_0_25px_rgba(37,99,235,0.25)] backdrop-blur-xl transition-all duration-300 hover:border-cyan-400/50 hover:shadow-[0_0_35px_rgba(14,165,233,0.35)]">
            {/* Ambient Background Aura */}
            <div className="absolute -inset-0.5 -z-10 rounded-full bg-gradient-to-r from-blue-600/30 via-cyan-500/30 to-indigo-600/30 opacity-40 blur-sm group-hover:opacity-100 transition duration-500" />

            {/* Telemetry Pulse Indicator */}
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" />
            </span>

            {/* Bespoke MEDSENTINEL Typography */}
            <div className="flex items-center">
              <span className="font-display text-xs sm:text-sm font-black tracking-[0.28em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                MED
              </span>
              <span className="font-display text-xs sm:text-sm font-black tracking-[0.28em] bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(14,165,233,0.5)]">
                SENTINEL
              </span>
            </div>

            {/* Subtle Divider */}
            <span className="h-3.5 w-px bg-slate-700/80" />

            {/* Architecture Tag */}
            <span className="text-[10px] sm:text-[11px] font-semibold tracking-widest text-slate-300 uppercase">
              AI Platform
            </span>
          </div>
        </motion.div>

        {/* Main Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl leading-[1.1]"
        >
          Chuyển từ <span className="text-slate-400">ứng phó bị động</span>
          <br />
          sang{" "}
          <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-red-400 bg-clip-text text-transparent">
            đón đầu dịch sốt xuất huyết
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12 }}
          className="mx-auto mt-6 max-w-3xl text-balance text-base sm:text-lg leading-relaxed text-slate-300"
        >
          DengueSense là nền tảng AI y tế công cộng khép kín đầu tiên tại Việt Nam:{" "}
          <strong className="text-white font-semibold">Cảnh báo sớm 1–6 tháng (89.5%)</strong>, tối
          ưu hoá phân bổ <strong className="text-white font-semibold">3 nguồn lực thiết yếu</strong>{" "}
          dưới 1 phút và tự động soạn thảo công điện điều phối chuẩn{" "}
          <strong className="text-cyan-400 font-semibold">Nghị định 30/2020/NĐ-CP</strong>.
        </motion.p>

        {/* Call to Actions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3.5"
        >
          <Link
            to="/app"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-blue-500/30 transition-all hover:scale-105 hover:shadow-cyan-500/40 active:scale-95"
          >
            <Sparkles size={16} />
            <span>Trải nghiệm Bảng điều khiển Console</span>
            <ArrowRight size={16} />
          </Link>
          <a
            href="#map"
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-6 py-3.5 text-sm font-semibold text-slate-200 backdrop-blur-md transition-all hover:border-slate-500 hover:text-white hover:bg-slate-800"
          >
            <MapPin size={16} className="text-cyan-400" />
            <span>Xem Bản đồ Dịch tễ 34 Tỉnh</span>
          </a>
          <Link
            to="/app/mo-hinh"
            className="rounded-full border border-slate-800 bg-slate-950/60 px-5 py-3.5 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
          >
            Hồ sơ Mô hình (Model Card)
          </Link>
        </motion.div>

        {/* Trust Badges Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-slate-400"
        >
          {TRUST_TAGS.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-cyan-400" />
              <span>{tag}</span>
            </span>
          ))}
        </motion.div>

        {/* Interactive Live Command Center Window */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.28 }}
        >
          <HeroCommandCenter />
        </motion.div>

        {/* 3 Pillars Bento Grid */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mx-auto mt-14 grid gap-5 sm:grid-cols-3 text-left"
        >
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className={`relative overflow-hidden rounded-2xl border bg-gradient-to-b p-6 backdrop-blur-xl transition-all hover:border-slate-600 hover:shadow-xl ${p.color}`}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/80 border border-slate-800 shadow-inner">
                  <p.icon size={20} strokeWidth={2.2} />
                </span>
                <span className="rounded-full border border-slate-700 bg-slate-900/90 px-2.5 py-1 text-[11px] font-bold text-slate-200">
                  {p.badge}
                </span>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {p.layer}
              </span>
              <h3 className="font-display text-lg font-bold text-white mt-1">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{p.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
