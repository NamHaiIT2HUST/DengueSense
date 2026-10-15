import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { type MouseEvent, useRef, useState } from "react";
import { Globe, Satellite, ShieldCheck, Activity } from "lucide-react";

function checkPrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return isTouch || isReduced;
}

export function HeroGlobe3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [prefersReducedMotion] = useState(checkPrefersReducedMotion);

  // Subtle mouse parallax tilt for holographic depth
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { damping: 20, stiffness: 200 });
  const springY = useSpring(mouseY, { damping: 20, stiffness: 200 });

  const tiltX = useTransform(springY, [-0.5, 0.5], [12, -12]);
  const tiltY = useTransform(springX, [-0.5, 0.5], [-15, 15]);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      aria-hidden="true"
      className="relative mx-auto my-6 flex items-center justify-center select-none [perspective:1000px] w-full max-w-[420px] h-[340px] sm:h-[380px]"
    >
      {/* Dynamic ambient backlight */}
      <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-radial from-cyan-500/20 via-blue-600/10 to-transparent blur-3xl" />

      {/* 3D Holographic Stage */}
      <motion.div
        style={{
          rotateX: prefersReducedMotion ? 0 : tiltX,
          rotateY: prefersReducedMotion ? 0 : tiltY,
          transformStyle: "preserve-3d",
        }}
        className="relative flex items-center justify-center w-[260px] h-[260px] sm:w-[300px] sm:h-[300px]"
      >
        {/* Core Pulsing Radar Sphere */}
        <div
          className="absolute inset-0 rounded-full border border-blue-500/20 bg-slate-950/60 shadow-[0_0_50px_rgba(14,165,233,0.18)] backdrop-blur-sm"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Radar Sweep Beam */}
          <div className="absolute inset-0 rounded-full overflow-hidden opacity-40">
            <div
              className="absolute inset-0 animate-radar-sweep"
              style={{
                background:
                  "conic-gradient(from 0deg at 50% 50%, rgba(14, 165, 233, 0.45) 0deg, rgba(37, 99, 235, 0.1) 60deg, transparent 90deg)",
              }}
            />
          </div>

          {/* Concentric Coordinate Rings */}
          <div className="absolute inset-4 rounded-full border border-cyan-500/20 border-dashed" />
          <div className="absolute inset-12 rounded-full border border-blue-400/25" />
          <div className="absolute inset-20 rounded-full border border-slate-700/50" />
        </div>

        {/* 3D Rotating Longitude & Latitude Wireframe Cage */}
        <div
          className="absolute inset-0 animate-spin-3d-slow pointer-events-none"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Meridian 0° */}
          <div
            className="absolute inset-0 rounded-full border border-cyan-400/35"
            style={{ transform: "rotateY(0deg)" }}
          />
          {/* Meridian 60° */}
          <div
            className="absolute inset-0 rounded-full border border-blue-400/30 border-dashed"
            style={{ transform: "rotateY(60deg)" }}
          />
          {/* Meridian 120° */}
          <div
            className="absolute inset-0 rounded-full border border-cyan-400/30"
            style={{ transform: "rotateY(120deg)" }}
          />

          {/* Equator Plane (X 90deg) */}
          <div
            className="absolute inset-0 rounded-full border-2 border-cyan-300/40 shadow-[0_0_15px_rgba(14,165,233,0.3)]"
            style={{ transform: "rotateX(90deg)" }}
          />
          {/* Tropic of Cancer (+23.5° N - Vietnam Belt) */}
          <div
            className="absolute inset-4 rounded-full border border-red-400/40"
            style={{ transform: "rotateX(90deg) translateZ(42px)" }}
          />
          {/* Tropic of Capricorn (-23.5° S) */}
          <div
            className="absolute inset-4 rounded-full border border-blue-500/30 border-dashed"
            style={{ transform: "rotateX(90deg) translateZ(-42px)" }}
          />
        </div>

        {/* ECMWF ERA5 Satellite Orbital Ring (Tilted 3D Orbit) */}
        <div
          className="absolute inset-[-28px] sm:inset-[-34px] rounded-full animate-orbit-reverse-3d pointer-events-none"
          style={{
            border: "1.5px dashed rgba(14, 165, 233, 0.45)",
            boxShadow: "0 0 25px rgba(37, 99, 235, 0.2)",
            transformStyle: "preserve-3d",
          }}
        >
          {/* Orbiting Satellite Node */}
          <div
            className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-cyan-400/60 bg-slate-900/95 px-2.5 py-0.5 shadow-[0_0_12px_rgba(14,165,233,0.6)] backdrop-blur-md"
            style={{ transform: "rotateX(-65deg)" }}
          >
            <Satellite size={12} className="text-cyan-300 animate-pulse" />
            <span className="font-mono text-[9px] font-bold tracking-wider text-cyan-200 uppercase">
              ERA5 Sat
            </span>
          </div>
        </div>

        {/* Vietnam Epidemiological Hotspot Focus Marker (3D Pinned) */}
        <div
          className="absolute z-20 flex flex-col items-center pointer-events-none"
          style={{
            transform: "translateZ(85px) translateY(-18px)",
          }}
        >
          <div className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-slate-950/90 px-2 py-1 shadow-[0_0_20px_rgba(239,68,68,0.35)] backdrop-blur-md">
            <Activity size={12} className="text-red-400 shrink-0" />
            <span className="font-mono text-[10px] font-black text-red-200 tracking-wide">
              VN-GIS / 34 Tỉnh
            </span>
          </div>
          <div className="h-4 w-px bg-gradient-to-b from-red-400 to-transparent" />
        </div>

        {/* Floating 3D HUD Telemetry Pill 1 (Top Left) */}
        <div
          className="absolute -top-3 -left-10 sm:-left-16 z-10 hidden sm:flex items-center gap-2 rounded-xl border border-blue-500/30 bg-slate-900/85 px-3 py-1.5 shadow-lg backdrop-blur-md pointer-events-none"
          style={{ transform: "translateZ(50px)" }}
        >
          <Globe size={13} className="text-blue-400" />
          <div className="text-left font-mono leading-tight">
            <div className="text-[9px] font-bold text-slate-400 uppercase">Khí hậu toàn cầu</div>
            <div className="text-[10px] font-bold text-cyan-300">ECMWF 0.25° Grid</div>
          </div>
        </div>

        {/* Floating 3D HUD Telemetry Pill 2 (Bottom Right) */}
        <div
          className="absolute -bottom-3 -right-8 sm:-right-14 z-10 hidden sm:flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-slate-900/85 px-3 py-1.5 shadow-lg backdrop-blur-md pointer-events-none"
          style={{ transform: "translateZ(45px)" }}
        >
          <ShieldCheck size={13} className="text-cyan-400" />
          <div className="text-left font-mono leading-tight">
            <div className="text-[9px] font-bold text-slate-400 uppercase">Mô hình AI M4-R2</div>
            <div className="text-[10px] font-bold text-blue-300">Độ chính xác 89.5%</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
