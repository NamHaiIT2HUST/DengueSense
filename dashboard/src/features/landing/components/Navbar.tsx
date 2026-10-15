import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Menu, X, Activity } from "lucide-react";

const LINKS = [
  { href: "#overview", label: "Tổng quan" },
  { href: "#framework", label: "Khung giải pháp" },
  { href: "#timeline", label: "Quy trình ứng phó" },
  { href: "#layers", label: "Kiến trúc công nghệ" },
  { href: "#map", label: "Bản đồ 34 tỉnh" },
  { href: "#roadmap", label: "Lộ trình" },
  { href: "#team", label: "Đội ngũ" },
  { href: "#faq", label: "Hỏi đáp" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<string>("#overview");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);

      const sectionIds = LINKS.map((l) => l.href.slice(1));
      const scrollPos = window.scrollY + 140;
      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const id = sectionIds[i]!;
        const el = document.getElementById(id);
        if (el && el.offsetTop <= scrollPos) {
          setActiveSection(`#${id}`);
          break;
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("#")) {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        const top = target.getBoundingClientRect().top + window.scrollY - 70;
        window.scrollTo({
          top,
          behavior: "smooth",
        });
        setActiveSection(href);
        window.history.pushState(null, "", href);
      }
      setMobileOpen(false);
    }
  };

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-slate-800/90 bg-slate-950/90 shadow-2xl shadow-blue-950/20 backdrop-blur-2xl"
          : "border-b border-slate-800/60 bg-slate-950/75 backdrop-blur-xl"
      }`}
    >
      {/* Dynamic bottom glowing neon laser line */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/60 via-blue-500/40 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent opacity-80 blur-[1px]" />

      <div
        className={`mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 transition-all duration-300 ${
          scrolled ? "h-16" : "h-16 sm:h-18"
        }`}
      >
        {/* Brand Lockup */}
        <a href="#" className="flex items-center gap-3 group shrink-0">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600/25 via-slate-900 to-slate-950 p-1.5 ring-1 ring-white/10 shadow-[0_0_15px_rgba(37,99,235,0.2)] transition-all duration-300 group-hover:scale-105 group-hover:ring-cyan-400/60 group-hover:shadow-[0_0_25px_rgba(14,165,233,0.45)]">
            <img
              src="/logo-icon.png"
              alt="DengueSense Logo"
              className="h-full w-full object-contain drop-shadow transition-transform duration-300 group-hover:scale-110"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-lg font-bold tracking-tight text-white leading-none transition-colors group-hover:text-cyan-200">
              Dengue<span className="text-red-500">Sense</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wide leading-none mt-1 hidden sm:block">
              Nền tảng AI Y tế Dự phòng
            </span>
          </div>
        </a>

        {/* Desktop Navigation Links with Sliding Magnetic Glow Pill */}
        <nav
          className="hidden items-center gap-0.5 xl:gap-1 lg:flex"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {LINKS.map((l, idx) => {
            const isHovered = hoveredIdx === idx;
            const isActive = activeSection === l.href;
            return (
              <a
                key={l.href}
                href={l.href}
                onClick={(e) => handleNavClick(e, l.href)}
                onMouseEnter={() => setHoveredIdx(idx)}
                className={`relative rounded-lg px-3 py-1.5 text-xs xl:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  isActive || isHovered ? "text-white" : "text-slate-300 hover:text-white"
                }`}
              >
                {isHovered && (
                  <motion.div
                    layoutId="navbarHoverPill"
                    transition={{ type: "spring", stiffness: 450, damping: 30 }}
                    className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-600/25 via-cyan-500/25 to-blue-600/25 border border-cyan-500/40 shadow-[0_0_15px_rgba(14,165,233,0.25)]"
                  />
                )}
                {!isHovered && isActive && (
                  <motion.div
                    layoutId="navbarActivePill"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className="absolute inset-0 rounded-lg bg-blue-500/15 border border-cyan-400/30 shadow-[0_0_12px_rgba(14,165,233,0.15)]"
                  />
                )}
                <span className="relative z-10">{l.label}</span>
              </a>
            );
          })}
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
          {/* Live Telemetry Pill */}
          <div className="hidden 2xl:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-400 shadow-sm">
            <Activity size={12} className="text-emerald-400 shrink-0" />
            <span>ERA5 TRỰC TUYẾN</span>
          </div>

          <Link
            to="/dang-nhap"
            className="hidden text-xs xl:text-sm font-medium text-slate-300 transition-all hover:text-white whitespace-nowrap md:inline-block px-3 py-1.5 rounded-lg hover:bg-slate-800/60 hover:shadow-sm"
          >
            Đăng nhập
          </Link>

          {/* Shimmering Dynamic Console CTA Button */}
          <Link
            to="/app"
            className="relative group overflow-hidden inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all duration-300 hover:shadow-[0_0_25px_rgba(14,165,233,0.5)] hover:scale-[1.03] active:scale-[0.98] whitespace-nowrap"
          >
            {/* Shimmer sweep effect */}
            <div className="pointer-events-none absolute inset-0 -translate-x-full group-hover:animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            <span className="relative z-10">Vào Console</span>
            <ArrowRight
              size={14}
              className="relative z-10 transition-transform group-hover:translate-x-0.5"
            />
          </Link>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-white lg:hidden"
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
              {LINKS.map((l) => {
                const isActive = activeSection === l.href;
                return (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={(e) => handleNavClick(e, l.href)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                      isActive
                        ? "bg-blue-600/20 text-cyan-300 border-l-2 border-cyan-400 font-semibold"
                        : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                    }`}
                  >
                    {l.label}
                  </a>
                );
              })}
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
