import { motion } from "framer-motion";
import { ArrowRight, Radar, Cpu, FileText } from "lucide-react";

const PILLARS = [
  {
    icon: Radar,
    title: "Dự báo",
    desc: "AI dự báo rủi ro dịch theo tỉnh, sớm 1–6 tháng",
  },
  {
    icon: Cpu,
    title: "Tối ưu",
    desc: "Phân bổ nguồn lực theo số ca giảm được, không chỉ theo rủi ro",
  },
  {
    icon: FileText,
    title: "Điều phối",
    desc: "GenAI soạn lệnh, con người luôn duyệt cuối",
  },
];

export function Hero() {
  return (
    <section id="overview" className="relative overflow-hidden px-6 pb-20 pt-16 sm:pt-24">
      {/* glow nền, tiết chế theo trend glassmorphism 2026 */}
      <div
        className="pointer-events-none absolute left-1/2 top-[-10%] h-[520px] w-[900px] -translate-x-1/2 rounded-full opacity-[0.16] blur-[120px]"
        style={{ background: "radial-gradient(circle, var(--risk-6), transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-5xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] px-3.5 py-1.5 text-xs font-medium text-[var(--ink-secondary)]"
        >
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-[var(--status-critical)]" />
          Đội thi MedSentinel · Cuộc thi Sáng tạo Trẻ 2026
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl"
        >
          Từ dự báo dịch tới{" "}
          <span className="bg-gradient-to-r from-[var(--risk-6)] to-[var(--risk-4)] bg-clip-text text-transparent">
            hành động thực địa
          </span>
          <br />
          trong một hệ thống khép kín
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12 }}
          className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-[var(--ink-secondary)]"
        >
          DengueSense tích hợp AI dự báo, tối ưu hoá phân bổ nguồn lực và GenAI
          soạn lệnh điều phối — chuyển phòng chống sốt xuất huyết từ bị động
          sang chủ động.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18 }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <a
            href="#map"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            Xem bản đồ rủi ro thật
            <ArrowRight size={16} />
          </a>
          <a
            href="https://github.com/NamHaiIT2HUST/DengueSense"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-[var(--border-strong)] px-6 py-3 text-sm font-semibold text-[var(--ink-secondary)] transition-colors hover:border-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
          >
            Xem mã nguồn
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.28 }}
          className="mx-auto mt-16 grid max-w-3xl gap-4 sm:grid-cols-3"
        >
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className="glass-panel rounded-2xl p-5 text-left"
            >
              <p.icon size={20} strokeWidth={2} className="mb-3 text-[var(--accent)]" />
              <h3 className="font-display text-[15px] font-semibold">{p.title}</h3>
              <p className="mt-1 text-[13px] leading-snug text-[var(--ink-muted)]">
                {p.desc}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
