import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radar,
  Cpu,
  FileText,
  ShieldCheck,
  Activity,
  Sliders,
  TrendingDown,
  Brain,
  MapPin,
  Printer,
  ChevronRight,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

type ViewMode = "radar" | "milp" | "dispatch";

interface Hotspot {
  id: string;
  name: string;
  score: number;
  level: "critical" | "warning" | "elevated";
  casesExpected: number;
  rainfall: string;
  temp: string;
  trend: string;
}

const HOTSPOTS: Hotspot[] = [
  {
    id: "hcm",
    name: "TP. Hồ Chí Minh",
    score: 100.0,
    level: "critical",
    casesExpected: 1250,
    rainfall: "+380 mm",
    temp: "29.2 °C",
    trend: "+34% so với mức nền",
  },
  {
    id: "angiang",
    name: "An Giang",
    score: 91.2,
    level: "critical",
    casesExpected: 840,
    rainfall: "+340 mm",
    temp: "28.6 °C",
    trend: "+28% so với mức nền",
  },
  {
    id: "dongthap",
    name: "Đồng Tháp",
    score: 97.1,
    level: "critical",
    casesExpected: 910,
    rainfall: "+310 mm",
    temp: "28.4 °C",
    trend: "+25% so với mức nền",
  },
  {
    id: "binhduong",
    name: "Bình Dương",
    score: 84.5,
    level: "warning",
    casesExpected: 620,
    rainfall: "+270 mm",
    temp: "28.1 °C",
    trend: "+18% so với mức nền",
  },
];

export function HeroCommandCenter() {
  const [activeTab, setActiveTab] = useState<ViewMode>("radar");
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot>(HOTSPOTS[0]!);
  const [budget, setBudget] = useState<number>(650000000);

  // Dynamic calculations for solver
  const beds = Math.round((budget / 650000000) * 85);
  const supplies = Math.round((budget / 650000000) * 1650);
  const teams = Math.round((budget / 650000000) * 9);
  const preventedCases = Math.round((budget / 650000000) * 340);

  return (
    <div className="relative mx-auto mt-12 w-full max-w-5xl rounded-3xl border border-slate-700/80 bg-slate-950/90 p-2 sm:p-3 shadow-[0_20px_70px_rgba(0,0,0,0.65)] backdrop-blur-2xl ring-1 ring-white/10">
      {/* Window Title Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Activity size={15} className="text-cyan-400 shrink-0" />
          <span className="font-display text-xs sm:text-sm font-bold text-white tracking-wide">
            Bảng Điều Khiển Điều Phối Y Tế Dự Phòng DengueSense
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <Activity size={12} className="text-emerald-400" />
            <span>Khí tượng ERA5: Trực tuyến</span>
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
            <ShieldCheck size={12} className="text-cyan-400" />
            <span>Khóa số liệu an toàn</span>
          </span>
        </div>
      </div>

      {/* Internal Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 bg-slate-900/40 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveTab("radar")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold transition-all ${
              activeTab === "radar"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <Radar size={14} className={activeTab === "radar" ? "text-cyan-300" : ""} />
            <span>1. Điểm Nóng Dịch</span>
          </button>

          <button
            onClick={() => setActiveTab("milp")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold transition-all ${
              activeTab === "milp"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <Cpu size={14} className={activeTab === "milp" ? "text-indigo-300" : ""} />
            <span>2. Tối Ưu Nguồn Lực</span>
          </button>

          <button
            onClick={() => setActiveTab("dispatch")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold transition-all ${
              activeTab === "dispatch"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <FileText size={14} className={activeTab === "dispatch" ? "text-cyan-300" : ""} />
            <span>3. Dự Thảo Công Điện</span>
          </button>
        </div>

        <Link
          to="/app"
          className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <span>Mở toàn màn hình</span>
          <ChevronRight size={13} />
        </Link>
      </div>

      {/* Main Interactive Screen Content */}
      <div className="p-4 sm:p-6 min-h-[380px]">
        <AnimatePresence mode="wait">
          {activeTab === "radar" && (
            <motion.div
              key="radar"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="grid gap-5 lg:grid-cols-12"
            >
              {/* Left Column: Live Hotspots List */}
              <div className="lg:col-span-5 space-y-2.5 text-left">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span className="font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Activity size={13} className="text-cyan-400" />
                    <span>Vùng Trọng Điểm Giám Sát</span>
                  </span>
                  <span className="font-mono text-[11px] text-cyan-400">4 / 34 Tỉnh</span>
                </div>

                <div className="space-y-2">
                  {HOTSPOTS.map((h) => {
                    const isSelected = selectedHotspot.id === h.id;
                    return (
                      <button
                        key={h.id}
                        onClick={() => setSelectedHotspot(h)}
                        className={`w-full rounded-xl border p-3 text-left transition-all ${
                          isSelected
                            ? "border-blue-500/50 bg-blue-950/40 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/30"
                            : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-display font-bold text-sm text-white">
                            {h.name}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              h.level === "critical"
                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            }`}
                          >
                            P{h.score.toFixed(0)}% Nguy cơ
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-400 font-mono">
                          <span>Dự kiến: {h.casesExpected} ca</span>
                          <span className="text-cyan-400">{h.trend}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Telemetry & Waveform Card */}
              <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 text-left space-y-4 shadow-inner">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div>
                    <span className="text-xs text-slate-400">Dữ liệu viễn thám khí hậu ECMWF</span>
                    <h4 className="font-display text-lg font-bold text-white flex items-center gap-2 mt-0.5">
                      <MapPin size={16} className="text-red-400" />
                      <span>{selectedHotspot.name}</span>
                    </h4>
                  </div>
                  <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-400">
                    BÁO ĐỘNG ĐỎ DỊCH
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-950/80 p-3.5 border border-slate-800">
                    <span className="text-xs text-slate-400">Lượng mưa tích lũy (Lag 2 tháng)</span>
                    <div className="font-mono text-xl font-bold text-cyan-400 mt-1">
                      {selectedHotspot.rainfall}
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-cyan-500 rounded-full w-[82%]" />
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950/80 p-3.5 border border-slate-800">
                    <span className="text-xs text-slate-400">Nhiệt độ bề mặt (Lag 1 tháng)</span>
                    <div className="font-mono text-xl font-bold text-amber-400 mt-1">
                      {selectedHotspot.temp}
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full w-[68%]" />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-950/90 p-3.5 border border-slate-800/80 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                      <Brain size={13} className="text-cyan-400 shrink-0" />
                      <span>Giải trình nguyên nhân TreeSHAP (Explainable AI)</span>
                    </span>
                    <span className="font-mono text-[11px] text-emerald-400">Khớp quy luật</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Sự kết hợp giữa mưa dồn dập (Lag 2 tháng) và nền nhiệt độ cao tạo điều kiện tối
                    ưu cho mật độ lăng quăng bùng nổ, đóng góp <strong>27.9%</strong> vào xác suất
                    vượt ngưỡng dịch tại địa phương.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "milp" && (
            <motion.div
              key="milp"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="grid gap-6 lg:grid-cols-12 text-left"
            >
              {/* Left Column: Interactive Budget Slider */}
              <div className="lg:col-span-5 space-y-4">
                <div className="space-y-1">
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-indigo-400">
                    Google OR-Tools CP-SAT Solver
                  </span>
                  <h4 className="font-display text-xl font-bold text-white">
                    Tối ưu hóa Phân bổ Nguồn lực
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Giải bài toán quy hoạch nguyên hỗn hợp (MILP) theo hàm lợi ích biên giảm dần và
                    sàn công bằng y tế cộng đồng.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                      <Sliders size={14} className="text-indigo-400" />
                      <span>Kéo điều chỉnh ngân sách:</span>
                    </span>
                    <span className="font-mono font-bold text-cyan-400 text-sm">
                      {(budget / 1000000).toLocaleString()} Triệu VNĐ
                    </span>
                  </div>
                  <input
                    type="range"
                    min={200000000}
                    max={1200000000}
                    step={50000000}
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                    <span>200 Tr</span>
                    <span>650 Tr (Tiêu chuẩn)</span>
                    <span>1,2 Tỷ</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-mono">
                  <span>Thời gian giải: 42ms</span>
                  <span className="text-emerald-400 font-semibold">MIP Gap: 0.00% (Tối ưu)</span>
                </div>
              </div>

              {/* Right Column: Dynamic Resource Metric Grid */}
              <div className="lg:col-span-7 grid grid-cols-2 gap-3.5">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-1">
                  <span className="text-xs text-slate-400">Giường hồi sức cấp cứu</span>
                  <div className="font-display text-3xl font-extrabold text-white">
                    {beds} <span className="text-xs font-normal text-slate-400">giường</span>
                  </div>
                  <span className="text-[11px] text-blue-400 font-medium">
                    Ngăn chặn quá tải tuyến trên
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-1">
                  <span className="text-xs text-slate-400">Hóa chất & Máy phun ULV</span>
                  <div className="font-display text-3xl font-extrabold text-cyan-400">
                    {supplies.toLocaleString()}{" "}
                    <span className="text-xs font-normal text-slate-400">cơ số</span>
                  </div>
                  <span className="text-[11px] text-cyan-400 font-medium">
                    Cloramin B dập dịch thực địa
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-1">
                  <span className="text-xs text-slate-400">Đội phản ứng nhanh</span>
                  <div className="font-display text-3xl font-extrabold text-amber-400">
                    {teams} <span className="text-xs font-normal text-slate-400">đội</span>
                  </div>
                  <span className="text-[11px] text-amber-400 font-medium">
                    Chi viện trực tiếp vùng nóng
                  </span>
                </div>

                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-1">
                  <span className="text-xs text-emerald-300">Ca ngăn ngừa ước tính</span>
                  <div className="font-display text-3xl font-extrabold text-emerald-400 flex items-center gap-1.5">
                    <TrendingDown size={24} />
                    <span>{preventedCases} ca</span>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-medium">
                    Tiết kiệm chi phí bảo hiểm y tế
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "dispatch" && (
            <motion.div
              key="dispatch"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="grid gap-6 lg:grid-cols-12 text-left"
            >
              {/* Left Column: Governance & Explanations */}
              <div className="lg:col-span-5 space-y-4">
                <div className="space-y-1">
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-indigo-300">
                    GenAI RAG - Chuẩn Thể Thức NĐ 30/2020
                  </span>
                  <h4 className="font-display text-xl font-bold text-white">
                    Soạn Thảo Dự Thảo Công Điện B2G
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Tự động tạo dự thảo chỉ đạo hành chính tuân thủ chặt chẽ{" "}
                    <strong>Nghị định 30/2020/NĐ-CP</strong> và{" "}
                    <strong>Quyết định 02/2016/QĐ-TTg</strong>.
                  </p>
                </div>

                <div className="rounded-2xl border border-indigo-500/30 bg-slate-900/90 p-4 space-y-2 shadow-sm">
                  <div className="flex items-center gap-2 font-bold text-xs text-indigo-300">
                    <ShieldCheck size={16} className="text-cyan-400 shrink-0" />
                    <span>Guardrail G1 (Strict Data Locking)</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Khóa cứng 100% số liệu: Số ca dự báo (
                    {selectedHotspot.casesExpected.toLocaleString()} ca), ngân sách và số vật tư
                    điều phối đều được truyền trực tiếp từ mô hình dự báo và bài toán tối ưu nguồn
                    lực. Triệt tiêu hoàn toàn rủi ro ảo giác.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Link
                    to="/app"
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/25"
                  >
                    <Printer size={14} />
                    <span>Mở Bàn Phê Duyệt 4 Mắt</span>
                  </Link>
                  <span className="text-xs text-slate-400">Chuyên viên soạn, Lãnh đạo ký số</span>
                </div>
              </div>

              {/* Right Column: Executive Digital Document Deck */}
              <div className="lg:col-span-7 relative rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 p-5 shadow-2xl backdrop-blur-xl space-y-3.5 text-left">
                {/* Official Header */}
                <div className="flex justify-between items-start border-b border-slate-800 pb-2.5 text-[10px]">
                  <div>
                    <div className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                      BỘ Y TẾ - BAN CHỈ ĐẠO QUỐC GIA
                    </div>
                    <div className="text-cyan-400 font-mono text-[10px] mt-0.5">
                      Số: 218/CĐ-BYT-DP
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                      CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                    </div>
                    <div className="italic text-slate-400 text-[10px] mt-0.5">
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
                    <span className="text-[10px] font-mono text-slate-400">
                      Hà Nội, ngày 15 tháng 10 năm 2026
                    </span>
                  </div>
                  <h5 className="font-display font-bold text-xs sm:text-sm text-rose-200 uppercase tracking-wide">
                    DỰ THẢO CÔNG ĐIỆN CHỈ ĐẠO ĐIỀU PHỐI KHẨN CẤP
                  </h5>
                  <p className="text-[11px] italic text-slate-300 mt-0.5">
                    V/v triển khai cấp bách phương án đón đầu dịch sốt xuất huyết tại{" "}
                    {selectedHotspot.name}
                  </p>
                </div>

                {/* Guardrail Verified Content Box */}
                <div className="rounded-xl border border-blue-500/30 bg-blue-950/25 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-cyan-300 font-bold text-[11px]">
                      <ShieldCheck size={13} className="text-cyan-400" />
                      <span>GUARDRAIL G1 VERIFIED: SỐ LIỆU ĐÃ KHÓA CỨNG</span>
                    </div>
                    <span className="text-[9px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-1.5 py-0.5 rounded">
                      ZERO-HALLUCINATION
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    Căn cứ dự báo viễn thám ERA5 (độ chính xác{" "}
                    <strong className="text-white">89.5%</strong>), địa bàn{" "}
                    <strong className="text-cyan-300">{selectedHotspot.name}</strong> ghi nhận nguy
                    cơ{" "}
                    <strong className="text-cyan-300 font-mono">
                      {selectedHotspot.casesExpected.toLocaleString()} ca mắc
                    </strong>
                    . Ban Chỉ đạo phê duyệt phương án tối ưu MILP điều phối khẩn cấp:
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-0.5 text-center font-sans">
                    <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-1.5">
                      <div className="text-[9px] text-slate-400">Giường hồi sức</div>
                      <div className="font-mono font-bold text-white text-xs sm:text-sm">
                        {beds} <span className="text-[9px] font-normal text-slate-400">giường</span>
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-1.5">
                      <div className="text-[9px] text-slate-400">Hóa chất & Vật tư</div>
                      <div className="font-mono font-bold text-cyan-300 text-xs sm:text-sm">
                        {supplies.toLocaleString()}{" "}
                        <span className="text-[9px] font-normal text-slate-400">cơ số</span>
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-1.5">
                      <div className="text-[9px] text-slate-400">Đội phản ứng nhanh</div>
                      <div className="font-mono font-bold text-amber-300 text-xs sm:text-sm">
                        {teams} <span className="text-[9px] font-normal text-slate-400">đội</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Official Legal Footer & Four-Eyes Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 text-[10px] border-t border-slate-800/80">
                  <div className="text-slate-400 italic">
                    Căn cứ: NĐ 30/2020/NĐ-CP & QĐ 02/2016/QĐ-TTg
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-slate-900/90 border border-cyan-500/30 px-2.5 py-1 shadow-sm">
                    <div className="text-right">
                      <div className="font-bold text-slate-200 text-[9px]">TL. BỘ TRƯỞNG</div>
                      <div className="text-cyan-400 font-mono text-[9px] font-semibold">
                        [QUY TRÌNH 4 MẮT - CHỜ LÃNH ĐẠO KÝ SỐ]
                      </div>
                    </div>
                    <div className="h-5 w-5 rounded-full bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center text-cyan-300 text-[10px]">
                      ✓
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
