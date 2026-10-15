import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radar,
  Cpu,
  FileText,
  ShieldCheck,
  Check,
  Sliders,
  ArrowRight,
  TrendingDown,
  Layers,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

type LayerTab = "layer1" | "layer2" | "layer3";

interface TabItem {
  id: LayerTab;
  label: string;
  badge: string;
  icon: typeof Radar;
}

const TABS: TabItem[] = [
  {
    id: "layer1",
    label: "Layer 1: Dự báo AI",
    badge: "89.5%",
    icon: Radar,
  },
  {
    id: "layer2",
    label: "Layer 2: Tối ưu MILP",
    badge: "OR-Tools",
    icon: Cpu,
  },
  {
    id: "layer3",
    label: "Layer 3: Công điện GenAI",
    badge: "Chuẩn B2G",
    icon: FileText,
  },
];

export function InteractiveLayers() {
  const [activeTab, setActiveTab] = useState<LayerTab>("layer1");
  const [simBudget, setSimBudget] = useState<number>(600000000);

  // Dynamic calculations for Layer 2 interactive preview
  const beds = Math.round((simBudget / 600000000) * 80);
  const supplies = Math.round((simBudget / 600000000) * 1500);
  const teams = Math.round((simBudget / 600000000) * 8);
  const preventedCases = Math.round((simBudget / 600000000) * 320);

  return (
    <section id="layers" className="relative space-y-8">
      {/* Subtle Ambient Backlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-96 h-40 bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-indigo-500/10 blur-3xl rounded-full"
      />

      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto relative z-10">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-cyan-400 mb-3 shadow-sm backdrop-blur-sm">
          <Layers size={13} />
          <span>KIẾN TRÚC ĐỘT PHÁ</span>
        </div>
        <h2 className="font-display text-3xl font-extrabold text-white sm:text-4xl tracking-tight">
          Hệ sinh thái AI 3 Tầng Khép Kín
        </h2>
        <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed">
          Không dừng lại ở việc dự đoán, DengueSense kết nối trực tiếp từ dữ liệu viễn thám khí hậu,
          giải bài toán phân bổ nguồn lực và tự động hóa thể thức chỉ đạo hành chính.
        </p>
      </div>

      {/* Tabs Switcher with Shared Fluid Active Indicator */}
      <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 max-w-3xl mx-auto backdrop-blur-xl shadow-xl">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors duration-200 ${
                isActive ? "text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeLayerTab"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 shadow-md shadow-blue-500/20 border border-cyan-400/30"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon size={16} className={isActive ? "text-cyan-200" : "text-slate-400"} />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    isActive ? "bg-white/20 text-white font-bold" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {tab.badge}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="relative rounded-3xl border border-slate-800/90 bg-slate-950/80 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl overflow-hidden min-h-[480px]">
        <AnimatePresence mode="wait">
          {activeTab === "layer1" && (
            <motion.div
              key="layer1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="grid gap-8 lg:grid-cols-12 items-center"
            >
              <div className="lg:col-span-6 space-y-4 text-left">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-400">
                  <Radar size={13} />
                  <span>Spatio-Temporal Machine Learning</span>
                </span>
                <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                  Cảnh báo sớm 1–6 tháng với độ chính xác 89.5%
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Mô hình tổ hợp M4-R2 (XGBoost + Random Forest) kết hợp chuỗi thời gian dịch tễ học
                  với các yếu tố viễn thám khí hậu toàn cầu ERA5 (nhiệt độ bề mặt, lượng mưa tích
                  lũy, độ ẩm).
                </p>
                <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 shrink-0 mt-0.5">
                      <Check size={12} />
                    </span>
                    <span>
                      <strong className="text-slate-100">
                        17 đặc trưng nhân quả (causal features):
                      </strong>{" "}
                      Tôn trọng độ trễ báo cáo thực tế 1 tháng, tuyệt đối không rò rỉ tương lai.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 shrink-0 mt-0.5">
                      <Check size={12} />
                    </span>
                    <span>
                      <strong className="text-slate-100">TreeSHAP Explainability:</strong> Đo lường
                      định lượng tỷ trọng ERA5 đóng góp 22.6% – 27.9% vào quyết định cảnh báo dịch.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 shrink-0 mt-0.5">
                      <Check size={12} />
                    </span>
                    <span>
                      <strong className="text-slate-100">Định tuyến theo vùng:</strong> Tối ưu riêng
                      biệt cho điều kiện dịch tễ khác nhau của Miền Bắc, Miền Trung và Miền Nam.
                    </span>
                  </li>
                </ul>
                <div className="pt-2">
                  <Link
                    to="/app/mo-hinh"
                    className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors group"
                  >
                    <span>Xem đầy đủ thông số khoa học tại Model Card</span>
                    <ArrowRight
                      size={14}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-inner space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Mô phỏng Tương quan Khí hậu ERA5 & Ca bệnh
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400">Tỉnh An Giang</span>
                </div>

                {/* Simulated Waveform & Correlation */}
                <div className="space-y-3">
                  <div className="rounded-xl bg-slate-950/80 p-3.5 border border-slate-800/80">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Lượng mưa tích lũy ERA5 (Lag 2 tháng)</span>
                      <span className="text-cyan-400 font-mono font-semibold">+340 mm</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-cyan-500 rounded-full w-[78%]" />
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950/80 p-3.5 border border-slate-800/80">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Nhiệt độ bề mặt trung bình (Lag 1 tháng)</span>
                      <span className="text-amber-400 font-mono font-semibold">28.4 °C</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full w-[65%]" />
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950/80 p-3.5 border border-rose-500/30 bg-rose-950/20">
                    <div className="flex justify-between text-xs text-rose-300 mb-1">
                      <span className="font-semibold">Dự báo nguy cơ bùng phát (Lớp 1 AI)</span>
                      <span className="text-rose-400 font-mono font-bold">
                        BÁO ĐỘNG ĐỎ (P89.5%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-rose-500 rounded-full w-[89%]" />
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/20 text-xs text-slate-300">
                  💡 <strong>Quy luật dịch tễ:</strong> Khi mưa lớn kết hợp nhiệt độ cao ở độ trễ
                  1–2 tháng, mật độ muỗi vằn bùng phát mạnh mẽ, đưa xác suất vượt ngưỡng dịch lên
                  mức cao nhất.
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "layer2" && (
            <motion.div
              key="layer2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="grid gap-8 lg:grid-cols-12 items-center"
            >
              <div className="lg:col-span-6 space-y-4 text-left">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-400">
                  <Cpu size={13} />
                  <span>Google OR-Tools CP-SAT Solver</span>
                </span>
                <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                  Tối ưu hóa nguồn lực toán học dưới 1 phút
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Thay vì phân bổ cảm tính, DengueSense mô hình hóa bài toán quy hoạch nguyên hỗn
                  hợp (MILP) theo hàm lợi ích biên giảm dần (piecewise-linear diminishing returns)
                  và sàn công bằng (equity floor).
                </p>

                <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 shrink-0 mt-0.5">
                      <Check size={12} />
                    </span>
                    <span>
                      <strong className="text-slate-100">Hàm mục tiêu phi tuyến:</strong> Đo lường
                      lợi ích biên giảm dần, đảm bảo từng đồng ngân sách chi ra đạt hiệu quả ngăn
                      chặn ca bệnh cao nhất.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 shrink-0 mt-0.5">
                      <Check size={12} />
                    </span>
                    <span>
                      <strong className="text-slate-100">Sàn công bằng y tế (Equity Floor):</strong>{" "}
                      Ràng buộc tối thiểu 10% cơ số vật tư cho mọi địa phương thuộc nhóm nguy cơ.
                    </span>
                  </li>
                </ul>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                      <Sliders size={14} className="text-cyan-400" />
                      <span>Kéo thanh trượt để thử nghiệm ngân sách:</span>
                    </span>
                    <span className="font-mono font-bold text-cyan-300 text-sm">
                      {(simBudget / 1000000).toLocaleString()} Triệu VNĐ
                    </span>
                  </div>
                  <input
                    type="range"
                    min={200000000}
                    max={1000000000}
                    step={50000000}
                    value={simBudget}
                    onChange={(e) => setSimBudget(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                    <span>200 Tr</span>
                    <span>600 Tr (Chuẩn)</span>
                    <span>1,000 Tr</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-inner space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Kết quả Phân bổ Tối ưu (Solver Result)
                  </span>
                  <span className="text-[11px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                    Thời gian giải: 42ms
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-950 p-3.5 border border-slate-800">
                    <span className="text-xs text-slate-400">Giường bệnh hồi sức</span>
                    <div className="font-display text-2xl font-bold text-white mt-1">
                      {beds} <span className="text-xs font-normal text-slate-400">giường</span>
                    </div>
                    <span className="text-[11px] text-blue-400">Chống quá tải cơ sở</span>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-3.5 border border-slate-800">
                    <span className="text-xs text-slate-400">Hóa chất & Vật tư</span>
                    <div className="font-display text-2xl font-bold text-cyan-400 mt-1">
                      {supplies.toLocaleString()}{" "}
                      <span className="text-xs font-normal text-slate-400">cơ số</span>
                    </div>
                    <span className="text-[11px] text-cyan-400">Cloramin B & Máy phun</span>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-3.5 border border-slate-800">
                    <span className="text-xs text-slate-400">Đội phản ứng nhanh</span>
                    <div className="font-display text-2xl font-bold text-amber-400 mt-1">
                      {teams} <span className="text-xs font-normal text-slate-400">đội</span>
                    </div>
                    <span className="text-[11px] text-amber-400">Chi viện thực địa</span>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-3.5 border border-emerald-500/30 bg-emerald-950/20">
                    <span className="text-xs text-emerald-300">Ca ngăn ngừa ước tính</span>
                    <div className="font-display text-2xl font-bold text-emerald-400 mt-1 flex items-center gap-1">
                      <TrendingDown size={20} />
                      <span>{preventedCases} ca</span>
                    </div>
                    <span className="text-[11px] text-emerald-400">Giảm tải tuyến trên</span>
                  </div>
                </div>

                <div className="text-xs text-slate-400 text-center">
                  * Phân bổ ưu tiên tự động cho các ổ dịch nóng: An Giang, TP. Hồ Chí Minh, Bình
                  Dương.
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "layer3" && (
            <motion.div
              key="layer3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="grid gap-8 lg:grid-cols-12 items-center"
            >
              <div className="lg:col-span-5 space-y-4 text-left">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-300">
                  <FileText size={13} />
                  <span>GenAI RAG & Chuẩn Thể Thức Nhà Nước</span>
                </span>
                <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                  Soạn thảo công điện khẩn từ 2 ngày xuống 5 phút
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Trợ lý GenAI ứng dụng mô hình RAG tự động sinh công điện B2G và kế hoạch lâm sàng
                  B2B theo chuẩn <strong>Nghị định 30/2020/NĐ-CP</strong> và{" "}
                  <strong>Quyết định 02/2016/QĐ-BYT</strong>.
                </p>
                <div className="space-y-3 text-xs sm:text-sm text-slate-300">
                  <div className="flex items-start gap-3 rounded-xl bg-slate-900/90 border border-indigo-500/30 p-3.5 shadow-sm">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 shrink-0">
                      <ShieldCheck size={16} />
                    </div>
                    <div>
                      <strong className="text-indigo-200 text-xs sm:text-sm">
                        Guardrail G1 (Strict Data Locking):
                      </strong>
                      <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                        Khóa cứng 100% số liệu dự báo và phân bổ từ Layer 1 & 2. Triệt tiêu hoàn
                        toàn rủi ro ảo giác (Zero-Hallucination).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 shrink-0">
                      <Check size={12} />
                    </div>
                    <span>
                      Cơ chế thẩm định 4 mắt (Chuyên viên lập dự thảo, Lãnh đạo phê duyệt).
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 shrink-0">
                      <Check size={12} />
                    </div>
                    <span>
                      Hỗ trợ định dạng trang in khổ A4 hành chính và xuất file chuẩn điện tử.
                    </span>
                  </div>
                </div>
              </div>

              {/* Redesigned Official Executive Document Card */}
              <div className="lg:col-span-7 relative rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 p-6 sm:p-7 shadow-2xl backdrop-blur-xl text-left space-y-4">
                {/* Official Header */}
                <div className="flex justify-between items-start border-b border-slate-800 pb-3 text-[11px]">
                  <div>
                    <div className="font-bold text-slate-200 uppercase tracking-wider text-[11px] sm:text-xs">
                      BỘ Y TẾ - BAN CHỈ ĐẠO QUỐC GIA
                    </div>
                    <div className="text-cyan-400 font-mono text-[10px] sm:text-[11px] mt-0.5">
                      Số: 218/CĐ-BYT-DP
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-200 uppercase tracking-wider text-[11px] sm:text-xs">
                      CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                    </div>
                    <div className="italic text-slate-400 text-[10px] sm:text-[11px] mt-0.5">
                      Độc lập - Tự do - Hạnh phúc
                    </div>
                    <div className="w-20 h-px bg-slate-700 ml-auto mt-1" />
                  </div>
                </div>

                {/* Document Title */}
                <div className="text-center py-1">
                  <div className="inline-flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                      HỎA TỐC
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      Hà Nội, ngày 15 tháng 10 năm 2026
                    </span>
                  </div>
                  <h4 className="font-display font-bold text-sm sm:text-base text-rose-200 uppercase tracking-wide">
                    CÔNG ĐIỆN CHỈ ĐẠO ĐIỀU PHỐI KHẨN CẤP
                  </h4>
                  <p className="text-xs italic text-slate-300 mt-0.5">
                    V/v triển khai cấp bách công tác phòng, chống dịch sốt xuất huyết Dengue
                  </p>
                </div>

                {/* Guardrail Verified Content Box */}
                <div className="rounded-xl border border-blue-500/30 bg-blue-950/25 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-cyan-300 font-bold text-[11px]">
                      <ShieldCheck size={14} className="text-cyan-400" />
                      <span>GUARDRAIL G1 VERIFIED: SỐ LIỆU ĐÃ KHÓA CỨNG</span>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded">
                      ZERO-HALLUCINATION
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-xs">
                    Theo số liệu cảnh báo sớm từ hệ thống DengueSense (độ chính xác{" "}
                    <strong className="text-white">89.5%</strong>), khu vực các tỉnh trọng điểm dự
                    kiến ghi nhận <strong className="text-cyan-300 font-mono">1,250 ca mắc</strong>.
                    Ban Chỉ đạo phê duyệt phương án tối ưu MILP điều phối khẩn cấp:
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center font-sans">
                    <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-2">
                      <div className="text-[10px] text-slate-400">Giường hồi sức</div>
                      <div className="font-mono font-bold text-white text-sm sm:text-base">
                        80 <span className="text-[10px] font-normal text-slate-400">giường</span>
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-2">
                      <div className="text-[10px] text-slate-400">Hóa chất & Vật tư</div>
                      <div className="font-mono font-bold text-cyan-300 text-sm sm:text-base">
                        1,500 <span className="text-[10px] font-normal text-slate-400">cơ số</span>
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-2">
                      <div className="text-[10px] text-slate-400">Đội phản ứng nhanh</div>
                      <div className="font-mono font-bold text-amber-300 text-sm sm:text-base">
                        8 <span className="text-[10px] font-normal text-slate-400">đội</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Official Signature & Legal Foundation */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[11px] border-t border-slate-800/80">
                  <div className="text-slate-400 italic">
                    Căn cứ: NĐ 30/2020/NĐ-CP & QĐ 02/2016/QĐ-BYT
                  </div>
                  <div className="flex items-center gap-2.5 rounded-lg bg-slate-900/90 border border-cyan-500/30 px-3 py-1.5 shadow-sm">
                    <div className="text-right">
                      <div className="font-bold text-slate-200 text-[10px]">TL. BỘ TRƯỞNG</div>
                      <div className="text-cyan-400 font-mono text-[10px] font-semibold">
                        [ĐÃ KÝ SỐ ĐIỆN TỬ]
                      </div>
                    </div>
                    <div className="h-6 w-6 rounded-full bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center text-cyan-300 text-xs">
                      ✓
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
