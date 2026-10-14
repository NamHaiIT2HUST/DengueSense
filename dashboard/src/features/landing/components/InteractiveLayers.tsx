import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radar,
  Cpu,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  ArrowRight,
  TrendingDown,
  Layers,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

type LayerTab = "layer1" | "layer2" | "layer3";

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
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-cyan-400 mb-3">
          <Layers size={13} />
          <span>KIẾN TRÚC ĐỘT PHÁ</span>
        </div>
        <h2 className="font-display text-3xl font-extrabold text-white sm:text-4xl">
          Hệ sinh thái AI 3 Tầng Khép Kín
        </h2>
        <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed">
          Không dừng lại ở việc dự đoán, DengueSense kết nối trực tiếp từ dữ liệu viễn thám khí hậu,
          giải bài toán phân bổ nguồn lực và tự động hóa thể thức chỉ đạo hành chính.
        </p>
      </div>

      {/* Tabs Switcher */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 max-w-2xl mx-auto backdrop-blur-md">
        <button
          onClick={() => setActiveTab("layer1")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "layer1"
              ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-500/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Radar size={16} />
          <span>Layer 1: Dự báo AI (89.5%)</span>
        </button>

        <button
          onClick={() => setActiveTab("layer2")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "layer2"
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-500/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Cpu size={16} />
          <span>Layer 2: Tối ưu MILP</span>
        </button>

        <button
          onClick={() => setActiveTab("layer3")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "layer3"
              ? "bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-500/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <FileText size={16} />
          <span>Layer 3: Công điện GenAI</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="relative rounded-3xl border border-slate-800 bg-slate-950/70 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl overflow-hidden min-h-[460px]">
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
                <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-cyan-400 shrink-0" />
                    <span>
                      <strong>17 đặc trưng nhân quả (causal features):</strong> Tôn trọng độ trễ báo
                      cáo thực tế 1 tháng, tuyệt đối không rò rỉ tương lai.
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-cyan-400 shrink-0" />
                    <span>
                      <strong>TreeSHAP Explainability:</strong> Đo lường định lượng tỷ trọng ERA5
                      đóng góp 22.6% – 27.9% vào quyết định cảnh báo dịch.
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-cyan-400 shrink-0" />
                    <span>
                      <strong>Định tuyến theo vùng:</strong> Tối ưu riêng biệt cho điều kiện dịch tễ
                      khác nhau của Miền Bắc, Miền Trung và Miền Nam.
                    </span>
                  </li>
                </ul>
                <div className="pt-2">
                  <Link
                    to="/app/mo-hinh"
                    className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <span>Xem đầy đủ thông số khoa học tại Model Card</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-inner space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-cyan-400 animate-pulse" />
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

                  <div className="rounded-xl bg-slate-950/80 p-3.5 border border-red-500/30 bg-red-950/20">
                    <div className="flex justify-between text-xs text-red-300 mb-1">
                      <span className="font-semibold">Dự báo nguy cơ bùng phát (Lớp 1 AI)</span>
                      <span className="text-red-400 font-mono font-bold">BÁO ĐỘNG ĐỎ (P89.5%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full w-[89%]" />
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
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Sliders size={14} className="text-blue-400" />
                      <span>Kéo thanh trượt để thử nghiệm ngân sách:</span>
                    </span>
                    <span className="font-mono font-bold text-cyan-400">
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
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>

              <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-inner space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Kết quả Phân bổ Tối ưu (Solver Result)
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
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
                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-400">
                  <FileText size={13} />
                  <span>GenAI RAG & Chuẩn Thể thức Nhà nước</span>
                </span>
                <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                  Soạn thảo công điện khẩn từ 2 ngày xuống 5 phút
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Trợ lý GenAI ứng dụng mô hình RAG tự động sinh công điện B2G và kế hoạch lâm sàng
                  B2B theo chuẩn <strong>Nghị định 30/2020/NĐ-CP</strong> và{" "}
                  <strong>Quyết định 02/2016/QĐ-BYT</strong>.
                </p>
                <div className="space-y-2.5 text-xs sm:text-sm text-slate-300">
                  <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                    <ShieldCheck size={18} className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-red-300">Guardrail G1 (Strict Data Locking):</strong>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Khóa cứng 100% số liệu dự báo và phân bổ từ Layer 1 & 2. Triệt tiêu hoàn
                        toàn rủi ro ảo giác (Zero-Hallucination).
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span>Cơ chế thẩm định 4 mắt (Chuyên viên lập, Lãnh đạo phê duyệt).</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span>Hỗ trợ nút "In / Xuất PDF" định dạng trang in khổ A4 hành chính.</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 bg-white text-slate-900 rounded-2xl p-6 shadow-2xl space-y-3 font-serif text-left border border-slate-300">
                <div className="flex justify-between items-start border-b border-slate-200 pb-2 text-[11px] font-sans">
                  <div>
                    <div className="font-bold">BỘ Y TẾ - BAN CHỈ ĐẠO QUỐC GIA</div>
                    <div className="text-slate-600">Số: 218/CĐ-BYT-DP</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="italic text-slate-600">Độc lập - Tự do - Hạnh phúc</div>
                  </div>
                </div>

                <div className="text-center py-1 font-sans">
                  <h4 className="font-bold text-sm sm:text-base text-red-600 uppercase">
                    CÔNG ĐIỆN CHỈ ĐẠO KHẨN CẤP
                  </h4>
                  <p className="text-xs italic text-slate-600">
                    V/v triển khai cấp bách công tác phòng, chống dịch sốt xuất huyết Dengue
                  </p>
                </div>

                <div className="text-xs font-sans space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px]">
                    <ShieldCheck size={14} />
                    <span>GUARDRAIL G1 VERIFIED: SỐ LIỆU ĐÃ KHÓA CỨNG</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed text-[11px]">
                    Theo số liệu cảnh báo sớm từ hệ thống DengueSense (độ chính xác 89.5%), khu vực
                    các tỉnh trọng điểm dự kiến ghi nhận <strong>1,250 ca mắc</strong>. Ban Chỉ đạo
                    điều phối khẩn cấp: <strong>80 giường bệnh</strong>,{" "}
                    <strong>1,500 cơ số hóa chất Cloramin B</strong> và{" "}
                    <strong>8 đội phản ứng nhanh</strong>.
                  </p>
                </div>

                <div className="flex justify-between items-end pt-2 text-[11px] font-sans">
                  <div className="text-slate-500 italic">
                    Căn cứ: NĐ 30/2020/NĐ-CP & QĐ 02/2016/QĐ-BYT
                  </div>
                  <div className="text-center font-bold">
                    <div>TL. BỘ TRƯỞNG</div>
                    <div className="text-blue-700 font-mono text-[10px] mt-0.5">
                      (Đã ký số điện tử)
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
