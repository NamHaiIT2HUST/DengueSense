import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { type MouseEvent, useRef, useState } from "react";
import { Globe, Satellite, ShieldCheck, Activity, Compass, Cpu, Radio } from "lucide-react";

function checkPrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return isTouch || isReduced;
}

export function HeroGlobe3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [prefersReducedMotion] = useState(checkPrefersReducedMotion);
  const [isScanning, setIsScanning] = useState(false);

  // Subtle mouse parallax tilt for holographic depth
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { damping: 18, stiffness: 180 });
  const springY = useSpring(mouseY, { damping: 18, stiffness: 180 });

  const tiltX = useTransform(springY, [-0.5, 0.5], [18, -18]);
  const tiltY = useTransform(springX, [-0.5, 0.5], [-22, 22]);

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

  const handleTriggerPulse = () => {
    setIsScanning(true);
    setTimeout(() => setIsScanning(false), 1200);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleTriggerPulse}
      aria-hidden="true"
      title="Rê chuột để nghiêng 3D • Nhấn để phát sóng radar quét"
      className="relative mx-auto my-6 flex items-center justify-center select-none [perspective:1200px] w-full max-w-[460px] h-[360px] sm:h-[400px] cursor-pointer"
    >
      {/* Dynamic ambient backlight */}
      <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-radial from-cyan-500/25 via-blue-600/15 to-transparent blur-3xl" />

      {/* 3D Holographic Stage */}
      <motion.div
        style={{
          rotateX: prefersReducedMotion ? 0 : tiltX,
          rotateY: prefersReducedMotion ? 0 : tiltY,
          transformStyle: "preserve-3d",
        }}
        className="relative flex items-center justify-center w-[270px] h-[270px] sm:w-[320px] sm:h-[320px]"
      >
        {/* Core Pulsing Radar Sphere */}
        <div
          className="absolute inset-0 rounded-full border border-blue-500/30 bg-slate-950/70 shadow-[0_0_60px_rgba(14,165,233,0.25)] backdrop-blur-md"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Radar Sweep Beam */}
          <div className="absolute inset-0 rounded-full overflow-hidden opacity-50">
            <div
              className={`absolute inset-0 ${isScanning ? "animate-radar-sweep-fast" : "animate-radar-sweep"}`}
              style={{
                background:
                  "conic-gradient(from 0deg at 50% 50%, rgba(14, 165, 233, 0.6) 0deg, rgba(37, 99, 235, 0.15) 75deg, transparent 110deg)",
              }}
            />
          </div>

          {/* Concentric Coordinate Rings */}
          <div className="absolute inset-4 rounded-full border border-cyan-500/25 border-dashed" />
          <div className="absolute inset-12 rounded-full border border-blue-400/30" />
          <div className="absolute inset-20 rounded-full border border-slate-700/60" />
          <div className="absolute inset-[110px] rounded-full border border-red-500/20" />
        </div>

        {/* 3D Rotating Longitude & Latitude Wireframe Cage */}
        <div
          className="absolute inset-0 animate-spin-3d-slow pointer-events-none"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Meridian 0° */}
          <div
            className="absolute inset-0 rounded-full border border-cyan-400/40"
            style={{ transform: "rotateY(0deg)" }}
          />
          {/* Meridian 45° */}
          <div
            className="absolute inset-0 rounded-full border border-blue-400/30 border-dashed"
            style={{ transform: "rotateY(45deg)" }}
          />
          {/* Meridian 90° */}
          <div
            className="absolute inset-0 rounded-full border border-cyan-400/30"
            style={{ transform: "rotateY(90deg)" }}
          />
          {/* Meridian 135° */}
          <div
            className="absolute inset-0 rounded-full border border-indigo-400/30 border-dashed"
            style={{ transform: "rotateY(135deg)" }}
          />

          {/* Equator Plane (X 90deg) with glowing neon rim */}
          <div
            className="absolute inset-0 rounded-full border-2 border-cyan-300/50 shadow-[0_0_20px_rgba(14,165,233,0.4)]"
            style={{ transform: "rotateX(90deg)" }}
          />
          {/* Tropic of Cancer (+23.5° N - Vietnam Belt) */}
          <div
            className="absolute inset-4 rounded-full border-2 border-red-400/50 shadow-[0_0_12px_rgba(239,68,68,0.3)]"
            style={{ transform: "rotateX(90deg) translateZ(46px)" }}
          />
          {/* Tropic of Capricorn (-23.5° S) */}
          <div
            className="absolute inset-4 rounded-full border border-blue-500/40 border-dashed"
            style={{ transform: "rotateX(90deg) translateZ(-46px)" }}
          />
        </div>

        {/* ECMWF ERA5 Satellite Orbital Ring (Tilted 3D Orbit 1) */}
        <div
          className="absolute inset-[-30px] sm:inset-[-38px] rounded-full animate-orbit-reverse-3d pointer-events-none"
          style={{
            border: "1.5px dashed rgba(14, 165, 233, 0.55)",
            boxShadow: "0 0 30px rgba(37, 99, 235, 0.25)",
            transformStyle: "preserve-3d",
          }}
        >
          {/* Orbiting Satellite Node */}
          <div
            className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-cyan-400/70 bg-slate-900/95 px-2.5 py-0.5 shadow-[0_0_15px_rgba(14,165,233,0.7)] backdrop-blur-md"
            style={{ transform: "rotateX(-65deg)" }}
          >
            <Satellite size={12} className="text-cyan-300 animate-pulse" />
            <span className="font-mono text-[9px] font-bold tracking-wider text-cyan-200 uppercase">
              ERA5 Sat
            </span>
          </div>
        </div>

        {/* Second Counter-Orbit Ring (AI Telemetry Node) */}
        <div
          className="absolute inset-[-14px] sm:inset-[-18px] rounded-full pointer-events-none"
          style={{
            border: "1px dotted rgba(99, 102, 241, 0.4)",
            transform: "rotateX(45deg) rotateY(60deg)",
            transformStyle: "preserve-3d",
          }}
        >
          <div
            className="absolute -bottom-2 right-1/4 flex items-center gap-1 rounded-full border border-indigo-500/50 bg-slate-900/90 px-2 py-0.5 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
            style={{ transform: "rotateX(-45deg)" }}
          >
            <Radio size={10} className="text-indigo-400 animate-ping" />
            <span className="font-mono text-[8px] font-bold text-indigo-300 uppercase">
              MILP Grid
            </span>
          </div>
        </div>

        {/* Vietnam Epidemiological Hotspot Focus Marker (3D Pinned Center Stage) */}
        <div
          className="absolute z-20 flex flex-col items-center pointer-events-none"
          style={{
            transform: "translateZ(95px) translateY(-20px)",
          }}
        >
          <div className="flex items-center gap-1.5 rounded-xl border border-red-500/50 bg-slate-950/95 px-2.5 py-1 shadow-[0_0_25px_rgba(239,68,68,0.45)] backdrop-blur-md ring-1 ring-red-400/30">
            <Activity size={13} className="text-red-400 shrink-0 animate-pulse" />
            <span className="font-mono text-[10px] font-black text-red-200 tracking-wider">
              VN-GIS / 34 Tỉnh
            </span>
          </div>
          <div className="h-5 w-px bg-gradient-to-b from-red-400 to-transparent" />
        </div>

        {/* Floating 3D HUD Telemetry Pill 1 (Top Left - High Z Depth) */}
        <div
          className="absolute -top-4 -left-12 sm:-left-20 z-10 hidden sm:flex items-center gap-2 rounded-xl border border-blue-500/40 bg-slate-900/90 px-3 py-1.5 shadow-xl backdrop-blur-md pointer-events-none ring-1 ring-blue-400/20"
          style={{ transform: "translateZ(70px)" }}
        >
          <Globe size={14} className="text-blue-400" />
          <div className="text-left font-mono leading-tight">
            <div className="text-[9px] font-bold text-slate-400 uppercase">Khí hậu toàn cầu</div>
            <div className="text-[10px] font-bold text-cyan-300">ECMWF 0.25° Grid</div>
          </div>
        </div>

        {/* Floating 3D HUD Telemetry Pill 2 (Bottom Right - High Z Depth) */}
        <div
          className="absolute -bottom-4 -right-10 sm:-right-18 z-10 hidden sm:flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-slate-900/90 px-3 py-1.5 shadow-xl backdrop-blur-md pointer-events-none ring-1 ring-cyan-400/20"
          style={{ transform: "translateZ(65px)" }}
        >
          <ShieldCheck size={14} className="text-cyan-400" />
          <div className="text-left font-mono leading-tight">
            <div className="text-[9px] font-bold text-slate-400 uppercase">Mô hình AI M4-R2</div>
            <div className="text-[10px] font-bold text-blue-300">Độ chính xác 89.5%</div>
          </div>
        </div>

        {/* Floating 3D HUD Telemetry Pill 3 (Top Right - Medium Z Depth) */}
        <div
          className="absolute -top-2 -right-8 sm:-right-14 z-10 hidden lg:flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-slate-900/85 px-2.5 py-1 shadow-md backdrop-blur-sm pointer-events-none"
          style={{ transform: "translateZ(45px)" }}
        >
          <Cpu size={12} className="text-emerald-400" />
          <span className="font-mono text-[9px] font-bold text-emerald-300 uppercase">
            MILP &lt; 60s
          </span>
        </div>

        {/* Floating 3D HUD Telemetry Pill 4 (Bottom Left - Medium Z Depth) */}
        <div
          className="absolute -bottom-2 -left-8 sm:-left-14 z-10 hidden lg:flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-slate-900/85 px-2.5 py-1 shadow-md backdrop-blur-sm pointer-events-none"
          style={{ transform: "translateZ(40px)" }}
        >
          <Compass size={12} className="text-amber-400" />
          <span className="font-mono text-[9px] font-bold text-amber-300 uppercase">
            Lead Time 1–6T
          </span>
        </div>
      </motion.div>
    </div>
  );
}
