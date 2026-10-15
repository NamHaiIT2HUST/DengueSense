import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Radar, Cpu, FileText, LayoutDashboard, MapPin } from "lucide-react";
import { HeroCommandCenter } from "./HeroCommandCenter";
import { HeroGlobe3D } from "./HeroGlobe3D";
import { TiltCard3D } from "@/shared/ui/TiltCard3D";

const PILLARS = [
  {
    icon: Radar,
    pillar: "Trụ Cột 01 - Cảnh Báo Sớm",
    badge: "Độ chính xác 89,5%",
    title: "Dự báo Dịch tễ & Khí hậu ERA5",
    desc: "Mô hình tổ hợp M4-R2 (XGBoost + Random Forest) tích hợp dữ liệu viễn thám ERA5, cảnh báo sớm 1–6 tháng trước khi bùng dịch.",
    color: "from-blue-500/20 to-cyan-500/10 border-blue-500/30 text-cyan-400",
  },
  {
    icon: Cpu,
    pillar: "Trụ Cột 02 - Tối Ưu Nguồn Lực",
    badge: "Giải toán MILP < 1 Phút",
    title: "Cân Đối Nguồn Lực Điều Trị",
    desc: "Quy hoạch nguyên hỗn hợp giải bài toán phân bổ 3 trụ cột thiết yếu: Giường bệnh, Hóa chất Cloramin B và Đội phản ứng nhanh.",
    color: "from-blue-600/20 to-indigo-500/10 border-blue-600/30 text-blue-400",
  },
  {
    icon: FileText,
    pillar: "Trụ Cột 03 - Điều Phối Hành Chính",
    badge: "Chuẩn Thể Thức NĐ 30/2020",
    title: "Tự Động Hóa Công Điện Khẩn",
    desc: "RAG tự động sinh dự thảo công văn chỉ đạo B2G và phác đồ điều trị B2B, tích hợp Guardrail G1 khóa cứng số liệu chống ảo giác.",
    color: "from-indigo-500/20 to-violet-500/10 border-indigo-500/30 text-indigo-300",
  },
];

export function Hero() {
  return (
    <section id="overview" className="relative overflow-hidden px-6 pb-20 pt-12 sm:pt-20">
      {/* Dynamic ambient background glow layers */}
      <div
        className="pointer-events-none absolute left-1/2 top-[-12%] h-[650px] w-[1100px] -translate-x-1/2 rounded-full opacity-35 blur-[140px]"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(37, 99, 235, 0.5) 0%, rgba(14, 165, 233, 0.3) 45%, rgba(239, 68, 68, 0.15) 80%, transparent 100%)",
        }}
      />
      {/* Left flank cyan flare */}
      <div className="pointer-events-none absolute -left-20 top-1/3 h-80 w-80 rounded-full bg-cyan-500/15 blur-[120px]" />
      {/* Right flank indigo flare */}
      <div className="pointer-events-none absolute -right-20 top-1/4 h-80 w-80 rounded-full bg-indigo-500/15 blur-[120px]" />

      <div className="relative mx-auto max-w-6xl text-center">
        {/* Top Signature Brand Logotype (Bespoke Minimalist Crest) */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-8 inline-flex items-center justify-center gap-3 sm:gap-4"
        >
          <div className="h-px w-8 sm:w-16 bg-gradient-to-r from-transparent via-cyan-500/40 to-cyan-400" />

          <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-blue-500/25 bg-slate-900/50 backdrop-blur-md shadow-[0_0_20px_rgba(37,99,235,0.15)]">
            <span className="font-mono text-xs sm:text-sm font-black uppercase tracking-[0.32em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
              MED
            </span>
            <span className="font-mono text-xs sm:text-sm font-black uppercase tracking-[0.32em] bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-300 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(14,165,233,0.5)]">
              SENTINEL
            </span>
            <span className="text-slate-600 font-light">/</span>
            <span className="text-[10px] sm:text-[11px] font-semibold tracking-widest text-slate-400 uppercase">
              AI Platform
            </span>
          </div>

          <div className="h-px w-8 sm:w-16 bg-gradient-to-l from-transparent via-cyan-500/40 to-cyan-400" />
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
          dưới 1 phút và tự động soạn thảo dự thảo công điện điều phối chuẩn{" "}
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
            <LayoutDashboard size={16} />
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

        {/* Unified Institutional Verification Ribbon */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mx-auto mt-10 max-w-4xl rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 sm:p-4 backdrop-blur-xl shadow-lg ring-1 ring-white/5"
        >
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 text-xs font-medium text-slate-300">
            <div className="flex items-center gap-2">
              <span className="rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-cyan-400 ring-1 ring-blue-500/20">
                ERA5
              </span>
              <span>Dữ liệu khí hậu ECMWF</span>
            </div>
            <span className="h-3.5 w-px bg-slate-800 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="rounded bg-blue-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-400 ring-1 ring-blue-500/20">
                GIS 34
              </span>
              <span>34 Tỉnh dịch tễ trọng điểm</span>
            </div>
            <span className="h-3.5 w-px bg-slate-800 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-300">
                NĐ 30
              </span>
              <span>Nghị định 30/2020/NĐ-CP</span>
            </div>
            <span className="h-3.5 w-px bg-slate-800 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-cyan-300 ring-1 ring-cyan-500/20">
                HITL
              </span>
              <span>Thẩm định 4 mắt (Cán bộ & Lãnh đạo)</span>
            </div>
          </div>
        </motion.div>

        {/* 3D Holographic Radar Wireframe Globe (ECMWF ERA5 Satellite & Spatial Telemetry) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.26 }}
        >
          <HeroGlobe3D />
        </motion.div>

        {/* Interactive Live Command Center Window */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.28 }}
        >
          <HeroCommandCenter />
        </motion.div>

        {/* 3 Pillars Bento Grid with 3D Tilt & Specular Light */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mx-auto mt-14 grid gap-5 md:grid-cols-3 text-left"
        >
          {PILLARS.map((p) => (
            <TiltCard3D
              key={p.title}
              maxTilt={8}
              scale={1.02}
              glare={true}
              glareOpacity={0.16}
              className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-b p-6 backdrop-blur-xl transition-all duration-300 hover:border-cyan-400/50 hover:shadow-[0_12px_40px_rgba(37,99,235,0.2)] ${p.color}`}
            >
              {/* Dynamic glowing top accent bar */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <div className="flex items-center justify-between mb-4" style={{ transform: "translateZ(20px)" }}>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900/90 border border-slate-800 shadow-inner transition-transform group-hover:scale-110 group-hover:border-blue-500/50">
                  <p.icon size={20} strokeWidth={2.2} />
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-700/80 bg-slate-900/90 px-3 py-1 text-[11px] font-bold text-slate-200 shadow-sm transition-colors group-hover:border-cyan-400/40 group-hover:text-cyan-300">
                  {p.badge}
                </span>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400" style={{ transform: "translateZ(10px)" }}>
                {p.pillar}
              </span>
              <h3 className="font-display text-lg font-bold text-white mt-1 group-hover:text-cyan-300 transition-colors" style={{ transform: "translateZ(15px)" }}>
                {p.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300/90" style={{ transform: "translateZ(10px)" }}>{p.desc}</p>
            </TiltCard3D>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
