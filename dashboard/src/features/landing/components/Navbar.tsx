import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";

const LINKS = [
  { href: "#overview", label: "Tổng quan" },
  { href: "#map", label: "Bản đồ rủi ro" },
  { href: "#optimize", label: "Tối ưu nguồn lực" },
  { href: "#dispatch", label: "Điều phối AI" },
  { href: "#roadmap", label: "Lộ trình" },
];

export function Navbar() {
  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="sticky top-0 z-50 border-b border-[var(--border-hairline)] glass-panel"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
        <a href="#" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)]">
            <Activity size={18} strokeWidth={2.5} className="text-white" />
          </span>
          <span className="font-display text-[17px] font-semibold tracking-tight">DengueSense</span>
          <span className="hidden rounded-full border border-[var(--border-strong)] px-2 py-0.5 text-[10px] font-medium text-[var(--ink-muted)] sm:inline">
            PROTOTYPE
          </span>
        </a>

        <nav className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-[var(--ink-secondary)] transition-colors hover:text-[var(--ink-primary)]"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/dang-nhap"
            className="hidden text-sm font-medium text-[var(--ink-secondary)] transition-colors hover:text-[var(--ink-primary)] sm:inline"
          >
            Đăng nhập
          </Link>
          <a
            href="#roadmap"
            className="rounded-full bg-[var(--accent-solid)] px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            Xem lộ trình
          </a>
        </div>
      </div>
    </motion.header>
  );
}
