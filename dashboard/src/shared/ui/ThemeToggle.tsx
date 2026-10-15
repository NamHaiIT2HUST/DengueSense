import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/shared/lib/theme";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = "", showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Chuyển sang giao diện Sáng" : "Chuyển sang giao diện Tối"}
      title={isDark ? "Chuyển sang giao diện Sáng" : "Chuyển sang giao diện Tối"}
      className={`group relative inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800/80 bg-slate-900/80 p-2 text-slate-300 transition-all duration-300 hover:border-cyan-500/50 hover:bg-slate-800 hover:text-white hover:shadow-[0_0_15px_rgba(14,165,233,0.25)] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 ${
        showLabel ? "px-3 py-2" : "h-9 w-9"
      } ${className}`}
    >
      <div className="relative flex h-5 w-5 items-center justify-center">
        <motion.div
          key={theme}
          initial={{ rotate: -90, scale: 0, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {isDark ? (
            <Sun
              size={18}
              className="text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] transition-transform duration-300 group-hover:scale-110"
              aria-hidden="true"
            />
          ) : (
            <Moon
              size={18}
              className="text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.4)] transition-transform duration-300 group-hover:scale-110"
              aria-hidden="true"
            />
          )}
        </motion.div>
      </div>

      {showLabel && (
        <span className="text-xs font-medium text-slate-300 group-hover:text-white">
          {isDark ? "Giao diện Sáng" : "Giao diện Tối"}
        </span>
      )}
    </button>
  );
}
