import { useState, useRef, type MouseEvent } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Radar, Cpu, FileText, Layers } from "lucide-react";

interface LayerData {
  id: number;
  number: string;
  title: string;
  subtitle: string;
  badge: string;
  icon: typeof Radar;
  color: string;
  borderColor: string;
  glowColor: string;
  shadowColor: string;
  defaultZ: number;
  hoverZ: number;
  tags: string[];
  metrics: { label: string; value: string }[];
}

const LAYERS: LayerData[] = [
  {
    id: 3,
    number: "03",
    title: "Tầng Điều Phối & Pháp Lý B2G",
    subtitle: "RAG Guardrail G1 & Thể thức NĐ 30/2020",
    badge: "Chuẩn Thẩm Định 4 Mắt",
    icon: FileText,
    color: "from-emerald-950/80 via-slate-900/90 to-slate-950/95",
    borderColor: "border-emerald-500/40 hover:border-emerald-400",
    glowColor: "from-emerald-400 to-teal-400",
    shadowColor: "rgba(16, 185, 129, 0.35)",
    defaultZ: 140,
    hoverZ: 185,
    tags: ["Guardrail G1", "Nghị định 30/2020", "HITL 4 Mắt"],
    metrics: [
      { label: "Soạn thảo", value: "< 2 phút" },
      { label: "Ảo giác", value: "0% (Khóa G1)" },
    ],
  },
  {
    id: 2,
    number: "02",
    title: "Tầng Tối Ưu Hóa Nguồn Lực",
    subtitle: "Thuật toán MILP Google OR-Tools",
    badge: "Giải Toán Tối Ưu < 1 Phút",
    icon: Cpu,
    color: "from-indigo-950/80 via-slate-900/90 to-slate-950/95",
    borderColor: "border-indigo-500/40 hover:border-indigo-400",
    glowColor: "from-indigo-400 to-blue-400",
    shadowColor: "rgba(99, 102, 241, 0.35)",
    defaultZ: 70,
    hoverZ: 110,
    tags: ["Quy hoạch MILP", "3 Nguồn lực", "Cân đối giường/hóa chất"],
    metrics: [
      { label: "Thời gian giải", value: "< 60 Giây" },
      { label: "34 Tỉnh", value: "Tự động phân bổ" },
    ],
  },
  {
    id: 1,
    number: "01",
    title: "Tầng Dự Báo Dịch & Viễn Thám",
    subtitle: "ECMWF ERA5 & Mô hình M4-R2",
    badge: "Độ Chính Xác 89,5%",
    icon: Radar,
    color: "from-cyan-950/80 via-slate-900/90 to-slate-950/95",
    borderColor: "border-cyan-500/40 hover:border-cyan-400",
    glowColor: "from-cyan-400 to-blue-400",
    shadowColor: "rgba(14, 165, 233, 0.35)",
    defaultZ: 0,
    hoverZ: 30,
    tags: ["ECMWF 0.25°", "Spatio-Temporal", "TreeSHAP Explainability"],
    metrics: [
      { label: "Lead time", value: "1–6 Tháng" },
      { label: "Tập dữ liệu", value: "1997–2024" },
    ],
  },
];

export function IsometricArchitecture3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeLayer, setActiveLayer] = useState<number | null>(null);

  // Mouse tilt physics for 3D stage
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { damping: 20, stiffness: 180 });
  const springY = useSpring(mouseY, { damping: 20, stiffness: 180 });

  const rotateX = useTransform(springY, [-0.5, 0.5], [58, 48]);
  const rotateZ = useTransform(springX, [-0.5, 0.5], [-32, -22]);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
    setActiveLayer(null);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative mx-auto my-8 flex flex-col items-center justify-center [perspective:1400px] select-none w-full max-w-4xl min-h-[520px] py-6"
    >
      {/* Dynamic ambient stage backlight */}
      <div className="pointer-events-none absolute inset-x-1/4 top-1/3 -z-10 h-80 rounded-full bg-radial from-cyan-500/20 via-blue-600/10 to-transparent blur-3xl" />

      {/* 3D Isometric Exploded Stage */}
      <motion.div
        style={{
          rotateX,
          rotateZ,
          transformStyle: "preserve-3d",
        }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="relative flex items-center justify-center w-[340px] sm:w-[480px] h-[340px] sm:h-[420px]"
      >
        {/* Central Vertical Neon Data Transmission Laser Beam */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-[380px] rounded-full bg-gradient-to-t from-cyan-500 via-blue-400 to-emerald-400 shadow-[0_0_20px_rgba(14,165,233,0.8)] opacity-75"
          style={{
            transform: "rotateX(-90deg) translateZ(80px)",
            transformStyle: "preserve-3d",
          }}
        />

        {/* 3 Isometric Floating Layer Plates */}
        {LAYERS.map((layer) => {
          const isHovered = activeLayer === layer.id;
          const currentZ = isHovered ? layer.hoverZ : layer.defaultZ;
          const Icon = layer.icon;

          return (
            <motion.div
              key={layer.id}
              animate={{
                z: currentZ,
                scale: isHovered ? 1.04 : 1,
              }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
              onMouseEnter={() => setActiveLayer(layer.id)}
              className={`absolute inset-x-0 mx-auto w-[320px] sm:w-[450px] cursor-pointer rounded-2xl border bg-gradient-to-br p-5 sm:p-6 backdrop-blur-2xl transition-shadow duration-300 ${layer.color} ${layer.borderColor}`}
              style={{
                transformStyle: "preserve-3d",
                boxShadow: isHovered
                  ? `0 25px 60px ${layer.shadowColor}, 0 0 35px ${layer.shadowColor}`
                  : "0 15px 35px rgba(0, 0, 0, 0.4)",
              }}
            >
              {/* Dynamic top edge neon laser line */}
              <div
                className={`absolute inset-x-0 top-0 h-[2px] rounded-t-2xl bg-gradient-to-r ${layer.glowColor} transition-opacity duration-300 ${
                  isHovered ? "opacity-100 shadow-[0_0_12px_rgba(14,165,233,0.8)]" : "opacity-40"
                }`}
              />

              {/* Plate Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 shadow-inner transition-transform duration-200 ${
                      isHovered ? "scale-110 shadow-md" : ""
                    }`}
                  >
                    <Icon size={18} className="text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black tracking-widest text-slate-400">
                        {layer.number}
                      </span>
                      <h4 className="font-display text-sm sm:text-base font-bold text-white leading-tight">
                        {layer.title}
                      </h4>
                    </div>
                    <span className="text-[11px] text-slate-300 block">{layer.subtitle}</span>
                  </div>
                </div>

                <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs backdrop-blur-sm">
                  {layer.badge}
                </span>
              </div>

              {/* Tags & Metric Chips */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {layer.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-white/10 bg-slate-900/60 px-2 py-0.5 text-[10px] font-medium text-slate-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-3.5 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs">
                {layer.metrics.map((m) => (
                  <div key={m.label} className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400">{m.label}:</span>
                    <span className="font-mono font-bold text-white">{m.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Interactive Helper Hint */}
      <div className="mt-8 flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-4 py-1.5 text-xs text-slate-400 shadow-md backdrop-blur-md">
        <Layers size={13} className="text-cyan-400 animate-pulse" />
        <span>Rê chuột để nghiêng 3D không gian • Bấm từng tầng kiến trúc để nâng độ cao</span>
      </div>
    </div>
  );
}
