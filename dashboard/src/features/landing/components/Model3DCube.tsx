import { useState, useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import {
  Radar,
  Cpu,
  FileText,
  Activity,
  ShieldCheck,
  RotateCw,
  Zap,
  CheckCircle2,
} from "lucide-react";

interface CubeFace {
  id: string;
  face: "front" | "right" | "back" | "left" | "top" | "bottom";
  name: string;
  tag: string;
  icon: typeof Radar;
  title: string;
  metric: string;
  metricLabel: string;
  desc: string;
  accent: string;
  borderColor: string;
  glow: string;
  rotateY: number;
  rotateX: number;
}

const FACES: CubeFace[] = [
  {
    id: "lead-time",
    face: "front",
    name: "Cảnh Báo Sớm",
    tag: "Khí Tượng Viễn Thám",
    icon: Radar,
    title: "Tầm Dự Báo 1–6 Tháng",
    metric: "180 Ngày",
    metricLabel: "Thời gian đón đầu dịch",
    desc: "Tích hợp chuỗi thời gian khí hậu ECMWF ERA5 phát hiện mầm mống trước chu kỳ nở bọ gậy.",
    accent: "text-cyan-400 bg-cyan-500/15 border-cyan-500/30",
    borderColor: "border-cyan-500/40",
    glow: "rgba(14, 165, 233, 0.4)",
    rotateY: 0,
    rotateX: 0,
  },
  {
    id: "accuracy",
    face: "right",
    name: "Độ Chính Xác",
    tag: "Học Máy Tổ Hợp",
    icon: ShieldCheck,
    title: "Mô Hình AI M4-R2",
    metric: "89,5%",
    metricLabel: "Độ chính xác kiểm nghiệm",
    desc: "XGBoost + Random Forest kết hợp cơ chế kiểm chuẩn không-thời gian trên 34 tỉnh trọng điểm.",
    accent: "text-blue-400 bg-blue-500/15 border-blue-500/30",
    borderColor: "border-blue-500/40",
    glow: "rgba(37, 99, 235, 0.4)",
    rotateY: 90,
    rotateX: 0,
  },
  {
    id: "optimization",
    face: "back",
    name: "Tối Ưu Nguồn Lực",
    tag: "Quy Hoạch MILP",
    icon: Cpu,
    title: "Google OR-Tools",
    metric: "< 60 Giây",
    metricLabel: "Thời gian giải toán",
    desc: "Cân đối giường bệnh, Cloramin B và đội phản ứng nhanh dập dịch đón đầu không quá tải.",
    accent: "text-indigo-400 bg-indigo-500/15 border-indigo-500/30",
    borderColor: "border-indigo-500/40",
    glow: "rgba(99, 102, 241, 0.4)",
    rotateY: 180,
    rotateX: 0,
  },
  {
    id: "dispatch",
    face: "left",
    name: "Thể Thức B2G",
    tag: "Nghị Định 30/2020",
    icon: FileText,
    title: "Tự Động Soạn Công Điện",
    metric: "Chuẩn 100%",
    metricLabel: "Thể thức hành chính",
    desc: "RAG Guardrail G1 khóa cứng số liệu, tự sinh dự thảo công văn chỉ đạo gửi CDC và UBND tỉnh.",
    accent: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
    borderColor: "border-emerald-500/40",
    glow: "rgba(16, 185, 129, 0.4)",
    rotateY: 270,
    rotateX: 0,
  },
  {
    id: "explainability",
    face: "top",
    name: "Giải Trình AI",
    tag: "TreeSHAP Explainability",
    icon: Activity,
    title: "Bóc Tách Nhân Quả Dịch",
    metric: "12 Chỉ Số",
    metricLabel: "Viễn thám & Dịch tễ",
    desc: "Minh bạch hóa lý do cảnh báo đỏ qua đóng góp biên của nhiệt độ, lượng mưa và mật độ dân cư.",
    accent: "text-amber-400 bg-amber-500/15 border-amber-500/30",
    borderColor: "border-amber-500/40",
    glow: "rgba(245, 158, 11, 0.4)",
    rotateY: 0,
    rotateX: 90,
  },
  {
    id: "hitl",
    face: "bottom",
    name: "Thẩm Định 4 Mắt",
    tag: "HITL Governance",
    icon: Zap,
    title: "An Toàn Ra Quyết Định",
    metric: "4 Mắt",
    metricLabel: "Thẩm định hai cấp",
    desc: "Người soạn thảo không được tự phê duyệt; chữ ký số EdDSA đảm bảo toàn vẹn pháp lý.",
    accent: "text-red-400 bg-red-500/15 border-red-500/30",
    borderColor: "border-red-500/40",
    glow: "rgba(239, 68, 68, 0.4)",
    rotateY: 0,
    rotateX: -90,
  },
];

export function Model3DCube() {
  const [currentFaceIdx, setCurrentFaceIdx] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse tilt drag interaction
  const rotY = useMotionValue(0);
  const rotX = useMotionValue(-12);

  const springRotY = useSpring(rotY, { stiffness: 200, damping: 25 });
  const springRotX = useSpring(rotX, { stiffness: 200, damping: 25 });

  const activeFace = FACES[currentFaceIdx]!;

  const handleSelectFace = (idx: number) => {
    setCurrentFaceIdx(idx);
    const f = FACES[idx]!;
    rotY.set(-f.rotateY);
    rotX.set(f.rotateX === 0 ? -12 : -f.rotateX);
  };

  const handleNext = () => {
    handleSelectFace((currentFaceIdx + 1) % FACES.length);
  };

  return (
    <div className="relative mx-auto my-12 flex flex-col items-center justify-center max-w-4xl px-4 select-none">
      {/* Section Title & Subtitle */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-semibold text-cyan-400 mb-3 backdrop-blur-sm">
          <RotateCw size={13} className="animate-spin" />
          <span>KHỐI ĐA CHIỀU NĂNG LỰC CÔNG NGHỆ 3D</span>
        </div>
        <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Hộp Trí Tuệ Nhân Tạo & Điều Phối Đa Lớp
        </h3>
        <p className="mt-2 text-slate-300 text-xs sm:text-sm max-w-2xl mx-auto">
          Mỗi mặt của khối lập phương đại diện cho một trụ cột kỹ thuật khép kín bảo đảm an toàn,
          chính xác và minh bạch trong y tế công cộng.
        </p>
      </div>

      {/* 3D Cube Stage Container */}
      <div
        ref={containerRef}
        className="relative flex items-center justify-center w-[280px] sm:w-[320px] h-[320px] sm:h-[360px] [perspective:1200px]"
      >
        {/* Ambient backlight glow */}
        <div
          className="pointer-events-none absolute inset-0 rounded-full blur-3xl opacity-40 transition-colors duration-500"
          style={{ background: activeFace.glow }}
        />

        {/* 3D Cube Rotator */}
        <motion.div
          style={{
            rotateY: springRotY,
            rotateX: springRotX,
            transformStyle: "preserve-3d",
          }}
          className="relative w-[220px] sm:w-[250px] h-[220px] sm:h-[250px]"
        >
          {FACES.map((f, idx) => {
            const Icon = f.icon;
            const isCurrent = currentFaceIdx === idx;

            // Cube face transforms: size = 220px/250px -> translateZ is 110px / 125px
            let transformStr = "";
            if (f.face === "front") transformStr = "translateZ(125px)";
            else if (f.face === "right") transformStr = "rotateY(90deg) translateZ(125px)";
            else if (f.face === "back") transformStr = "rotateY(180deg) translateZ(125px)";
            else if (f.face === "left") transformStr = "rotateY(-90deg) translateZ(125px)";
            else if (f.face === "top") transformStr = "rotateX(90deg) translateZ(125px)";
            else if (f.face === "bottom") transformStr = "rotateX(-90deg) translateZ(125px)";

            return (
              <div
                key={f.id}
                onClick={() => handleSelectFace(idx)}
                style={{
                  transform: transformStr,
                  transformStyle: "preserve-3d",
                }}
                className={`absolute inset-0 flex flex-col justify-between rounded-3xl border bg-slate-950/90 p-5 backdrop-blur-2xl transition-all duration-300 cursor-pointer ${
                  f.borderColor
                } ${isCurrent ? "shadow-[0_0_30px_rgba(14,165,233,0.35)] ring-1 ring-white/20" : "opacity-85"}`}
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm ${f.accent}`}
                  >
                    <Icon size={18} />
                  </div>
                  <span className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {f.tag}
                  </span>
                </div>

                {/* Body Content */}
                <div>
                  <h4 className="font-display text-base font-bold text-white leading-snug">
                    {f.title}
                  </h4>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="font-mono text-2xl font-black text-cyan-300">{f.metric}</span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      ({f.metricLabel})
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                    {f.desc}
                  </p>
                </div>

                {/* Active Indicator Bar */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>MẶT KHỐI: {f.face.toUpperCase()}</span>
                  <CheckCircle2
                    size={12}
                    className={isCurrent ? "text-cyan-400" : "text-slate-600"}
                  />
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* Face Navigation Buttons */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {FACES.map((f, idx) => {
          const isCurrent = currentFaceIdx === idx;
          const Icon = f.icon;
          return (
            <button
              key={f.id}
              onClick={() => handleSelectFace(idx)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isCurrent
                  ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-500/25 border border-cyan-400/40"
                  : "bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              <Icon size={13} className={isCurrent ? "text-cyan-200" : "text-slate-400"} />
              <span>{f.name}</span>
            </button>
          );
        })}

        <button
          onClick={handleNext}
          title="Xoay sang mặt tiếp theo"
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 transition-colors"
        >
          <RotateCw size={12} />
          <span>Xoay khối 3D</span>
        </button>
      </div>
    </div>
  );
}
