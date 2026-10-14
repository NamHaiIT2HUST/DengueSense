import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";

const LINKS = [
  { href: "#overview", label: "Tổng quan" },
  { href: "#layers", label: "Kiến trúc 3 Tầng" },
  { href: "#map", label: "Bản đồ Dịch tễ" },
  { href: "#comparison", label: "So sánh Giải pháp" },
  { href: "#faq", label: "Hỏi đáp" },
];

export function Navbar() {
  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <a href="#" className="flex items-center gap-3 group">
          <img
            src="/logo.png"
            alt="DengueSense Logo"
            className="h-10 w-auto object-contain transition-transform group-hover:scale-105"
          />
          <div className="hidden flex-col sm:flex">
            <span className="font-display text-lg font-bold tracking-tight text-white leading-tight">
              Dengue<span className="text-red-500">Sense</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wide">
              Nền tảng AI Y tế Dự phòng
            </span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-400">
            <ShieldCheck size={11} /> Đề án 2026
          </span>
        </a>

        <nav className="hidden items-center gap-7 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-slate-300 transition-colors hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/dang-nhap"
            className="hidden text-sm font-medium text-slate-300 transition-colors hover:text-white sm:inline"
          >
            Đăng nhập
          </Link>
          <Link
            to="/app"
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-cyan-500/30 hover:scale-[1.03] active:scale-[0.98]"
          >
            <span>Vào Console</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </motion.header>
  );
}
