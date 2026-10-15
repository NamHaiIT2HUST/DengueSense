import { useState } from "react";
import { motion } from "framer-motion";
import { Radio, Sparkles } from "lucide-react";

export function MedSentinelBadge() {
  const [clicked, setClicked] = useState(false);

  const handleClick = () => {
    setClicked(true);
    setTimeout(() => setClicked(false), 1200);

    const target = document.querySelector("#product");
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: "easeOut" }}
      className="mb-8 inline-flex items-center justify-center gap-2 sm:gap-4 select-none"
    >
      {/* ================= Left Energy Waveguide Wing ================= */}
      <div className="flex items-center gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
        <div className="h-1.5 w-1.5 rotate-45 border border-cyan-400 bg-cyan-400/50 shadow-[0_0_8px_#38bdf8]" />
        <div className="relative h-[2px] w-10 sm:w-20 overflow-hidden rounded-full bg-gradient-to-r from-transparent via-cyan-500/30 to-cyan-400/80">
          <div className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-cyan-300 to-transparent animate-photon-flow-right shadow-[0_0_10px_#00d2ff]" />
        </div>
      </div>

      {/* ================= Central Holographic Sentinel Crest ================= */}
      <motion.button
        type="button"
        onClick={handleClick}
        whileHover={{ scale: 1.04, y: -1 }}
        whileTap={{ scale: 0.98 }}
        className="group relative cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 rounded-full"
        title="DengueSense MedSentinel AI Platform — Xem chi tiết công nghệ"
        aria-label="MedSentinel AI Platform Badge"
      >
        {/* Ambient atmospheric aura behind the pill */}
        <div className="pointer-events-none absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-500/25 via-blue-600/20 to-indigo-500/25 blur-md opacity-60 transition-all duration-500 group-hover:opacity-100 group-hover:blur-lg" />

        {/* Outer Laser Border Beam Frame */}
        <div className="relative overflow-hidden rounded-full p-[1.5px] shadow-[0_0_24px_rgba(37,99,235,0.25)] transition-shadow duration-300 group-hover:shadow-[0_0_35px_rgba(14,165,233,0.5)]">
          {/* Continuous 360° Rotating Conic Laser Beam */}
          <div
            className="absolute inset-[-150%] animate-[spin_5s_linear_infinite]"
            style={{
              background:
                "conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 270deg, #00d2ff 310deg, #38bdf8 340deg, #818cf8 360deg)",
            }}
          />

          {/* Inner Surface Plate */}
          <div className="relative z-10 flex items-center gap-2 sm:gap-3 rounded-full border border-cyan-500/25 bg-slate-950/85 px-4 sm:px-5 py-1.5 backdrop-blur-xl transition-all duration-300 group-hover:border-cyan-400/60 group-hover:bg-slate-900/90 dark:bg-slate-950/90">
            {/* Active Radar Sentinel Blip */}
            <div className="relative flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 transition-colors group-hover:bg-cyan-500/25 group-hover:border-cyan-300">
              <span className="absolute -inset-0.5 rounded-full bg-cyan-400/40 animate-ping opacity-60" />
              <Radio className="relative h-3 w-3 text-cyan-300 transition-transform duration-300 group-hover:rotate-12" />
            </div>

            {/* Brand Title: MED SENTINEL with Holographic Shimmer */}
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs sm:text-sm font-black uppercase tracking-[0.3em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                MED
              </span>
              <span className="font-mono text-xs sm:text-sm font-black uppercase tracking-[0.3em] bg-gradient-to-r from-cyan-400 via-sky-200 via-indigo-300 to-cyan-400 bg-clip-text text-transparent animate-text-shimmer drop-shadow-[0_0_12px_rgba(14,165,233,0.6)]">
                SENTINEL
              </span>
            </div>

            {/* Micro Technical Divider */}
            <span className="text-slate-600 font-light select-none">/</span>

            {/* Sub-label AI Platform */}
            <span className="text-[10px] sm:text-[11px] font-semibold tracking-widest text-slate-300 uppercase">
              AI Platform
            </span>

            {/* Real-time Status Telemetry Chip */}
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider text-emerald-300 uppercase shadow-[0_0_10px_rgba(16,185,129,0.25)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
              </span>
              ONLINE
            </span>

            {/* Interactive Click Ripple Indicator */}
            {clicked && (
              <motion.div
                initial={{ scale: 0.8, opacity: 1 }}
                animate={{ scale: 2.2, opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="pointer-events-none absolute inset-0 rounded-full border-2 border-cyan-400 bg-cyan-400/20"
              />
            )}

            {/* Sparkle Micro Glint on Hover */}
            <Sparkles className="hidden md:block h-3 w-3 text-cyan-300/60 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:scale-110" />
          </div>
        </div>
      </motion.button>

      {/* ================= Right Energy Waveguide Wing ================= */}
      <div className="flex items-center gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
        <div className="relative h-[2px] w-10 sm:w-20 overflow-hidden rounded-full bg-gradient-to-l from-transparent via-cyan-500/30 to-cyan-400/80">
          <div className="absolute inset-y-0 w-8 bg-gradient-to-l from-transparent via-cyan-300 to-transparent animate-photon-flow-left shadow-[0_0_10px_#00d2ff]" />
        </div>
        <div className="h-1.5 w-1.5 rotate-45 border border-cyan-400 bg-cyan-400/50 shadow-[0_0_8px_#38bdf8]" />
      </div>
    </motion.div>
  );
}
