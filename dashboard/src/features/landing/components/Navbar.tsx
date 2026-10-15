import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Menu, X } from "lucide-react";

const LINKS = [
  { href: "#overview", label: "Tổng quan" },
  { href: "#framework", label: "Giải pháp" },
  { href: "#timeline", label: "Lộ trình" },
  { href: "#layers", label: "Kiến trúc AI" },
  { href: "#map", label: "Bản đồ 34 tỉnh" },
  { href: "#comparison", label: "So sánh" },
  { href: "#faq", label: "Hỏi đáp" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 sm:h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Lockup */}
        <a href="#" className="flex items-center gap-3 group shrink-0">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600/20 via-slate-900 to-slate-950 p-1.5 ring-1 ring-white/10 shadow-md group-hover:ring-blue-500/40 group-hover:shadow-blue-500/20 transition-all">
            <img
              src="/logo-icon.png"
              alt="DengueSense Logo"
              className="h-full w-full object-contain drop-shadow transition-transform group-hover:scale-105"
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-bold tracking-tight text-white leading-none">
                Dengue<span className="text-red-500">Sense</span>
              </span>
              <span className="hidden xl:inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-400 leading-none shrink-0">
                <ShieldCheck size={10} className="text-cyan-400" />
                <span>Đề án 2026</span>
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium tracking-wide leading-none mt-1 hidden sm:block">
              Nền tảng AI Y tế Dự phòng
            </span>
          </div>
        </a>

        {/* Desktop Navigation Links */}
        <nav className="hidden items-center gap-1 xl:gap-1.5 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-2.5 py-1.5 text-xs xl:text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-white whitespace-nowrap"
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            to="/dang-nhap"
            className="hidden text-xs xl:text-sm font-medium text-slate-300 transition-colors hover:text-white whitespace-nowrap md:inline-block px-3 py-1.5 rounded-lg hover:bg-slate-800/50"
          >
            Đăng nhập
          </Link>
          <Link
            to="/app"
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-cyan-500/30 hover:scale-[1.03] active:scale-[0.98] whitespace-nowrap"
          >
            <span>Vào Console</span>
            <ArrowRight size={14} />
          </Link>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white lg:hidden"
            aria-label={mobileOpen ? "Đóng danh mục" : "Mở danh mục"}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-slate-800/80 bg-slate-950/95 px-6 py-4 backdrop-blur-2xl lg:hidden overflow-hidden"
          >
            <div className="flex flex-col gap-1">
              {LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-white"
                >
                  {l.label}
                </a>
              ))}
              <div className="mt-3 border-t border-slate-800/80 pt-3 flex flex-col gap-2">
                <Link
                  to="/dang-nhap"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-white"
                >
                  Đăng nhập
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
