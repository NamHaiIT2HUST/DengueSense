import { useState, useRef, type MouseEvent } from "react";
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from "framer-motion";
import { Radar, Cpu, FileText, Layers, Eye, Box, ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface LayerData {
  id: number;
  number: string;
  title: string;
  subtitle: string;
  badge: string;
  icon: typeof Radar;
  color: string;
  borderColor: string;
  activeBorder: string;
  glowColor: string;
  shadowColor: string;
  defaultZ: number;
  hoverZ: number;
  tags: string[];
  metrics: { label: string; value: string }[];
  description: string;
  techStack: string;
  linkText: string;
  linkTo: string;
}

const LAYERS: LayerData[] = [
  {
    id: 3,
    number: "03",
    title: "Tầng Điều Phối & Pháp Lý B2G",
    subtitle: "RAG Guardrail G1 & Thể thức Nghị định 30/2020/NĐ-CP",
    badge: "Chuẩn Thẩm Định 4 Mắt",
    icon: FileText,
    color: "from-emerald-950/90 via-slate-900/95 to-slate-950/95",
    borderColor: "border-emerald-500/35",
    activeBorder: "border-emerald-400 ring-2 ring-emerald-400/30",
    glowColor: "from-emerald-400 to-teal-300",
    shadowColor: "rgba(16, 185, 129, 0.4)",
    defaultZ: 190,
    hoverZ: 235,
    tags: ["Guardrail G1 RAG", "Nghị định 30/2020", "HITL 4 Mắt"],
    metrics: [
      { label: "Thời gian soạn", value: "< 2 phút" },
      { label: "Kiểm soát ảo giác", value: "100% (Khóa G1)" },
      { label: "Quy trình", value: "Ký số B2G" },
    ],
    description:
      "Tự động hóa dự thảo công điện khẩn và quyết định điều phối theo đúng thể thức hành chính nhà nước. Khóa cứng số liệu nguồn từ thuật toán MILP, bảo đảm 0% ảo giác thông tin.",
    techStack: "RAG Pipeline + LangChain Guardrails + Chữ ký số công vụ",
    linkText: "Xem quy trình thẩm định 4 mắt",
    linkTo: "/app/ho-so",
  },
  {
    id: 2,
    number: "02",
    title: "Tầng Tối Ưu Hóa Nguồn Lực",
    subtitle: "Quy hoạch nguyên hỗn hợp MILP (Google OR-Tools)",
    badge: "Giải Toán Tối Ưu < 60s",
    icon: Cpu,
    color: "from-indigo-950/90 via-slate-900/95 to-slate-950/95",
    borderColor: "border-indigo-500/35",
    activeBorder: "border-indigo-400 ring-2 ring-indigo-400/30",
    glowColor: "from-indigo-400 to-blue-400",
    shadowColor: "rgba(99, 102, 241, 0.4)",
    defaultZ: 95,
    hoverZ: 135,
    tags: ["Quy hoạch MILP", "3 Nguồn lực thiết yếu", "Google OR-Tools"],
    metrics: [
      { label: "Thời gian giải", value: "< 60 Giây" },
      { label: "Quy mô", value: "34 Tỉnh trọng điểm" },
      { label: "Mục tiêu", value: "Tối thiểu hóa ca nặng" },
    ],
    description:
      "Giải bài toán phân bổ đồng thời 3 nguồn lực trọng yếu: Giường bệnh điều trị, Hóa chất Cloramin B và Đội cơ động phản ứng nhanh tới từng điểm nóng dịch.",
    techStack: "Google OR-Tools MILP Solver + C++ Core Bindings",
    linkText: "Khám phá thuật toán phân bổ",
    linkTo: "/app",
  },
  {
    id: 1,
    number: "01",
    title: "Tầng Dự Báo Dịch & Viễn Thám",
    subtitle: "Dữ liệu viễn thám ERA5 & Mô hình tổ hợp M4-R2",
    badge: "Độ Chính Xác 89,5%",
    icon: Radar,
    color: "from-cyan-950/90 via-slate-900/95 to-slate-950/95",
    borderColor: "border-cyan-500/35",
    activeBorder: "border-cyan-400 ring-2 ring-cyan-400/30",
    glowColor: "from-cyan-400 to-sky-300",
    shadowColor: "rgba(14, 165, 233, 0.4)",
    defaultZ: 0,
    hoverZ: 35,
    tags: ["ECMWF ERA5 0.25°", "M4-R2 Ensemble", "TreeSHAP Explainability"],
    metrics: [
      { label: "Lead time", value: "1–6 Tháng" },
      { label: "Tập dữ liệu", value: "1997–2024" },
      { label: "Đặc trưng", value: "17 Causal Features" },
    ],
    description:
      "Tích hợp chuỗi thời gian dịch tễ học 27 năm cùng dữ liệu viễn thám khí tượng toàn cầu (nhiệt độ, lượng mưa, độ ẩm), dự báo trước đỉnh dịch 1–6 tháng với độ chính xác 89,5%.",
    techStack: "ECMWF ERA5 + XGBoost + Random Forest + TreeSHAP",
    linkText: "Xem thông số Hồ sơ Mô hình",
    linkTo: "/app/mo-hinh",
  },
];

export function IsometricArchitecture3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeLayer, setActiveLayer] = useState<number>(3);
  const [viewMode, setViewMode] = useState<"3d" | "flat">("3d");

  // Gentler, natural isometric mouse tilt physics for comfortable reading
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { damping: 22, stiffness: 160 });
  const springY = useSpring(mouseY, { damping: 22, stiffness: 160 });

  // Moderate isometric angles: 36deg X tilt and -14deg Z rotation preserves natural letterforms
  const rotateX = useTransform(springY, [-0.5, 0.5], [40, 32]);
  const rotateZ = useTransform(springX, [-0.5, 0.5], [-16, -10]);

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
  };

  const selectedLayerData = LAYERS.find((l) => l.id === activeLayer) ?? LAYERS[0];
  if (!selectedLayerData) return null;

  return (
    <div className="relative mx-auto my-10 w-full max-w-5xl rounded-3xl border border-slate-800/90 bg-slate-950/70 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
      {/* Top Header & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
            <Layers size={14} />
            <span>Mô Hình Kiến Trúc Phân Tầng Khép Kín</span>
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-extrabold text-white mt-1">
            Bóc Tách 3 Tầng Xử Lý Dữ Liệu & Ra Quyết Định
          </h3>
        </div>

        {/* View Mode Toggle: 3D Isometric vs Direct 2D Flat */}
        <div className="flex items-center rounded-xl bg-slate-900 border border-slate-800 p-1 self-start sm:self-auto shadow-inner">
          <button
            type="button"
            onClick={() => setViewMode("3d")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "3d"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Box size={14} />
            <span>Góc nhìn 3D</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("flat")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "flat"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Eye size={14} />
            <span>Trực diện 2D</span>
          </button>
        </div>
      </div>

      {/* Layer Navigation Tabs */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {LAYERS.map((layer) => {
          const isSelected = activeLayer === layer.id;
          const Icon = layer.icon;
          return (
            <button
              key={layer.id}
              type="button"
              onClick={() => setActiveLayer(layer.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                isSelected
                  ? "bg-cyan-500/20 border border-cyan-400 text-white shadow-[0_0_15px_rgba(14,165,233,0.3)]"
                  : "bg-slate-900/80 border border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <Icon size={15} className={isSelected ? "text-cyan-400" : "text-slate-400"} />
              <span>
                {layer.number}. {layer.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Display: 3D Isometric View or Direct Flat View */}
      {viewMode === "3d" ? (
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="relative mx-auto my-6 flex flex-col items-center justify-center [perspective:1400px] select-none w-full min-h-[480px] sm:min-h-[520px] py-4"
        >
          {/* Dynamic ambient stage backlight */}
          <div className="pointer-events-none absolute inset-x-1/4 top-1/4 -z-10 h-72 rounded-full bg-radial from-cyan-500/15 via-blue-600/10 to-transparent blur-3xl" />

          {/* 3D Isometric Exploded Stage */}
          <motion.div
            style={{
              rotateX,
              rotateZ,
              transformStyle: "preserve-3d",
            }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative flex items-center justify-center w-[340px] sm:w-[520px] md:w-[600px] h-[360px] sm:h-[400px]"
          >
            {/* Side Transmission Bus Conduit (positioned on left flank, does NOT cross text) */}
            <div
              className="pointer-events-none absolute -left-4 sm:-left-8 top-1/2 -translate-y-1/2 w-1.5 h-[340px] rounded-full bg-gradient-to-t from-cyan-500 via-blue-400 to-emerald-400 shadow-[0_0_16px_rgba(14,165,233,0.7)] opacity-60"
              style={{
                transform: "rotateX(-90deg) translateZ(80px)",
                transformStyle: "preserve-3d",
              }}
            />

            {/* 3 Floating Layer Plates with Clear Vertical Spacing */}
            {LAYERS.map((layer) => {
              const isSelected = activeLayer === layer.id;
              const currentZ = isSelected ? layer.hoverZ : layer.defaultZ;
              const Icon = layer.icon;

              return (
                <motion.div
                  key={layer.id}
                  animate={{
                    z: currentZ,
                    scale: isSelected ? 1.03 : 1,
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  onClick={() => setActiveLayer(layer.id)}
                  className={`absolute inset-x-0 mx-auto w-[330px] sm:w-[480px] md:w-[540px] cursor-pointer rounded-2xl border bg-gradient-to-br p-4 sm:p-5 backdrop-blur-2xl transition-all duration-300 ${
                    layer.color
                  } ${isSelected ? layer.activeBorder : layer.borderColor}`}
                  style={{
                    transformStyle: "preserve-3d",
                    boxShadow: isSelected
                      ? `0 20px 50px ${layer.shadowColor}, 0 0 25px ${layer.shadowColor}`
                      : "0 10px 25px rgba(0, 0, 0, 0.45)",
                  }}
                >
                  {/* Dynamic top edge neon laser line */}
                  <div
                    className={`absolute inset-x-0 top-0 h-[2px] rounded-t-2xl bg-gradient-to-r ${
                      layer.glowColor
                    } transition-opacity duration-300 ${
                      isSelected
                        ? "opacity-100 shadow-[0_0_12px_rgba(14,165,233,0.8)]"
                        : "opacity-40"
                    }`}
                  />

                  {/* Plate Header */}
                  <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/10 shadow-inner transition-transform duration-200 ${
                          isSelected ? "scale-105" : ""
                        }`}
                      >
                        <Icon size={18} className="text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black tracking-wider text-cyan-300">
                            {layer.number}
                          </span>
                          <h4 className="font-display text-sm sm:text-base font-bold text-white leading-tight">
                            {layer.title}
                          </h4>
                        </div>
                        <span className="text-[11px] sm:text-xs text-slate-200 block font-medium mt-0.5">
                          {layer.subtitle}
                        </span>
                      </div>
                    </div>

                    <span className="shrink-0 rounded-full border border-white/20 bg-white/15 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-bold text-white shadow-xs backdrop-blur-sm">
                      {layer.badge}
                    </span>
                  </div>

                  {/* Clean Tags Row */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {layer.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-white/15 bg-slate-900/80 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-slate-100 shadow-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Metrics Row */}
                  <div className="mt-3 pt-2.5 border-t border-white/15 flex items-center justify-between text-xs">
                    {layer.metrics.map((m) => (
                      <div key={m.label} className="flex items-center gap-1.5">
                        <span className="text-[10px] sm:text-[11px] text-slate-300">
                          {m.label}:
                        </span>
                        <span className="font-mono font-bold text-white text-[11px] sm:text-xs">
                          {m.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Interactive Hint */}
          <div className="mt-4 flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-4 py-1.5 text-xs text-slate-400 shadow-md backdrop-blur-md">
            <Layers size={13} className="text-cyan-400 animate-pulse" />
            <span>Bấm vào từng tầng để xem chi tiết hoặc chuyển sang "Trực diện 2D"</span>
          </div>
        </div>
      ) : (
        /* Flat 2D Direct View for 100% Ease of Reading */
        <div className="my-6 grid gap-4 md:grid-cols-3">
          {LAYERS.map((layer) => {
            const isSelected = activeLayer === layer.id;
            const Icon = layer.icon;
            return (
              <div
                key={layer.id}
                onClick={() => setActiveLayer(layer.id)}
                className={`cursor-pointer rounded-2xl border p-5 transition-all ${layer.color} ${
                  isSelected
                    ? "border-cyan-400 ring-2 ring-cyan-400/30 shadow-lg shadow-cyan-500/20"
                    : "border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white">
                      <Icon size={16} />
                    </div>
                    <span className="font-mono text-xs font-black text-cyan-300">
                      {layer.number}
                    </span>
                  </div>
                  <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white">
                    {layer.badge}
                  </span>
                </div>

                <h4 className="font-display text-base font-bold text-white">{layer.title}</h4>
                <p className="mt-1 text-xs text-slate-300 font-medium">{layer.subtitle}</p>

                <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
                  {layer.metrics.map((m) => (
                    <div key={m.label} className="flex justify-between text-xs">
                      <span className="text-slate-400">{m.label}</span>
                      <span className="font-mono font-bold text-white">{m.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Layer Detail Inspector Card (Always crystal clear & 100% readable) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedLayerData.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="mt-6 rounded-2xl border border-cyan-500/30 bg-slate-900/90 p-5 sm:p-6 backdrop-blur-xl shadow-xl"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/20 font-mono text-xs font-black text-cyan-300">
                {selectedLayerData.number}
              </span>
              <h4 className="text-base sm:text-lg font-bold text-white">
                {selectedLayerData.title}
              </h4>
            </div>

            <span className="ui-badge ui-badge-cyan self-start sm:self-auto rounded-full border px-3 py-1 text-xs font-semibold">
              Công nghệ: {selectedLayerData.techStack}
            </span>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-slate-200">
            {selectedLayerData.description}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              {selectedLayerData.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-lg border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-xs font-medium text-slate-300"
                >
                  ✓ {t}
                </span>
              ))}
            </div>

            <Link
              to={selectedLayerData.linkTo}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <span>{selectedLayerData.linkText}</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
