import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radar,
  Cpu,
  FileText,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  TrendingDown,
  Layers,
  Database,
  Building2,
  Stethoscope,
  Award,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { IsometricArchitecture3D } from "./IsometricArchitecture3D";

type StageTab = "forecast" | "allocation" | "directive";

interface TabItem {
  id: StageTab;
  label: string;
  badge: string;
  icon: typeof Radar;
}

const TABS: TabItem[] = [
  {
    id: "forecast",
    label: "1. Dự Báo Khí Tượng & Viễn Thám",
    badge: "M4-R2 (ROC-AUC 0.809)",
    icon: Radar,
  },
  {
    id: "allocation",
    label: "2. Tối Ưu Nguồn Lực Điều Trị",
    badge: "Google OR-Tools",
    icon: Cpu,
  },
  {
    id: "directive",
    label: "3. Công Điện & Thẩm Định 4 Mắt",
    badge: "Chuẩn NĐ 30/2020",
    icon: FileText,
  },
];

export function InteractiveLayers() {
  const [activeTab, setActiveTab] = useState<StageTab>("forecast");

  return (
    <section id="layers" className="relative space-y-8 overflow-hidden">
      {/* Subtle Ambient Backlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-96 h-40 bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-indigo-500/10 blur-3xl rounded-full"
      />

      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto relative z-10">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-cyan-400 mb-3 shadow-sm backdrop-blur-sm">
          <Layers size={13} />
          <span>QUY TRÌNH VẬN HÀNH KHÉP KÍN</span>
        </div>
        <h2 className="font-display text-3xl font-extrabold text-white sm:text-4xl tracking-tight leading-tight">
          Giải Pháp 3 Bước Toàn Diện Cho Y Tế Dự Phòng
        </h2>
        <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed">
          DengueSense giải quyết trọn vẹn chu trình y tế công cộng: từ cảnh báo sớm dựa trên viễn
          thám khí hậu, giải bài toán phân bổ nguồn lực tối ưu toán học đến tự động hóa công điện
          chỉ đạo theo chuẩn thể thức nhà nước.
        </p>
      </div>

      {/* Tabs Switcher with Shared Fluid Active Indicator */}
      <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 max-w-4xl mx-auto backdrop-blur-xl shadow-xl">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors duration-200 ${
                isActive
                  ? "text-[var(--selection-ink)]"
                  : "text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeStageTab"
                  className="absolute inset-0 rounded-xl bg-[var(--selection-bg)] border border-[var(--selection-border)]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon size={16} />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    isActive
                      ? "bg-[var(--bg-surface)] text-[var(--selection-ink)] font-bold"
                      : "bg-[var(--bg-surface-2)] text-[var(--ink-secondary)]"
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
      <div className="relative rounded-3xl border border-slate-800/90 bg-slate-950/80 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl overflow-hidden min-h-[460px]">
        <AnimatePresence mode="wait">
          {activeTab === "forecast" && (
            <motion.div
              key="forecast"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="grid gap-8 lg:grid-cols-12 items-center"
            >
              {/* Left Column: Clinical & AI Framework */}
              <div className="lg:col-span-6 space-y-4 text-left">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-400">
                  <Radar size={13} />
                  <span>Spatio-Temporal Machine Learning</span>
                </div>
                <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                  Cảnh Báo Sớm 1–6 Tháng Với Mô Hình Tổ Hợp M4-R2
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Mô hình tổ hợp M4-R2 (XGBoost + Random Forest) kết hợp chuỗi thời gian dịch tễ học
                  lịch sử với các yếu tố viễn thám khí hậu toàn cầu ECMWF ERA5 (nhiệt độ bề mặt,
                  lượng mưa tích lũy, độ ẩm).
                </p>
                <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-100">
                        17 đặc trưng nhân quả (causal features):
                      </strong>{" "}
                      Tôn trọng độ trễ báo cáo thực tế 1 tháng (embargo), bảo đảm tính nhân quả và
                      chống rò rỉ dữ liệu tương lai.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-100">TreeSHAP Explainability:</strong> Đo lường
                      định lượng tỷ trọng khí hậu ERA5 đóng góp từ 22.6% – 27.9% vào quyết định cảnh
                      báo, loại trừ hoàn toàn tín hiệu giả.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-100">Định tuyến đa vùng:</strong> Hiệu chuẩn
                      ngưỡng dịch P75 riêng biệt cho đặc thù dịch tễ từng miền (Bắc, Trung, Nam)
                      trên 34 tỉnh trọng điểm.
                    </span>
                  </li>
                </ul>
                <div className="pt-2">
                  <Link
                    to="/app/mo-hinh"
                    className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors group"
                  >
                    <span>Xem đầy đủ thông số khoa học tại Hồ sơ Mô hình (Model Card)</span>
                    <ArrowRight
                      size={14}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </Link>
                </div>
              </div>

              {/* Right Column: Architectural Proof Card */}
              <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-inner space-y-4 text-left">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Database size={14} className="text-cyan-400" />
                    Hạ Tầng Dữ Liệu & Kiểm Chứng Khoa Học
                  </span>
                  <span className="text-[11px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                    34 Tỉnh Trọng Điểm
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl bg-slate-950/80 p-3.5 border border-slate-800/80 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-semibold">
                        Tái phân tích khí hậu toàn cầu ECMWF ERA5
                      </span>
                      <span className="text-cyan-400 font-mono font-bold">25km x 25km</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Lưới khí quyển toàn cầu theo dõi nhiệt độ 2m, lượng mưa tích lũy và độ ẩm
                      tương đối từ quỹ đạo vệ tinh.
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-950/80 p-3.5 border border-slate-800/80 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-semibold">
                        Mô hình tổ hợp M4-R2 (Ensemble)
                      </span>
                      <span className="text-blue-400 font-mono font-bold">ROC-AUC 6 mùa 0.809</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Kết hợp sức mạnh phân loại phi tuyến của XGBoost, Random Forest và hồi quy
                      NegBin GLM khử đa cộng tuyến.
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-950/80 p-3.5 border border-slate-800/80 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-semibold">
                        Ngưỡng báo động P75 chuẩn dịch tễ học
                      </span>
                      <span className="text-emerald-400 font-mono font-bold">Theo QĐ 02/2016</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Phát hiện tháng bùng dịch khi số ca vượt phân vị 75 lịch sử của chính tỉnh đó,
                      thích ứng linh hoạt theo mùa.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-xs text-slate-300 leading-relaxed">
                  <span className="font-semibold text-cyan-300">Ý nghĩa thực tiễn:</span> Bác sĩ dự
                  phòng tại CDC địa phương có thể chủ động bố trí nhân lực và hóa chất trước 1–6
                  tháng, không bị động khi đỉnh dịch tràn về.
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "allocation" && (
            <motion.div
              key="allocation"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="grid gap-8 lg:grid-cols-12 items-center"
            >
              {/* Left Column: Mathematical Principles */}
              <div className="lg:col-span-6 space-y-4 text-left">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-400">
                  <Cpu size={13} />
                  <span>Google OR-Tools CP-SAT Solver</span>
                </div>
                <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                  Tối Ưu Hóa Nguồn Lực Toán Học Dưới 1 Phút
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Thay vì phân bổ cảm tính hoặc cào bằng ngân sách, DengueSense mô hình hóa bài toán
                  quy hoạch nguyên hỗn hợp (MILP) nhằm tối đa hóa số ca bệnh được ngăn chặn và bảo
                  đảm công bằng y tế.
                </p>

                <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-blue-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-100">
                        Hàm mục tiêu phi tuyến (Diminishing Returns):
                      </strong>{" "}
                      Đo lường lợi ích biên giảm dần, đảm bảo từng đồng ngân sách chi ra đạt hiệu
                      quả ngăn chặn ca bệnh cao nhất.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-blue-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-100">
                        Sàn công bằng y tế (Equity Floor ≥ 10%):
                      </strong>{" "}
                      Ràng buộc tối thiểu 10% cơ số vật tư cho mọi trạm y tế thuộc diện nguy cơ,
                      không bỏ rơi tuyến y tế cơ sở.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-blue-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-100">Tốc độ giải bài toán siêu tốc:</strong>{" "}
                      Thời gian giải quy mô toàn quốc 34 tỉnh thành chỉ mất từ 40ms đến dưới 1 giây,
                      sẵn sàng phản ứng khẩn cấp.
                    </span>
                  </li>
                </ul>
                <div className="pt-2">
                  <Link
                    to="/app"
                    className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors group"
                  >
                    <span>Mở Bảng điều khiển Console để trải nghiệm thuật toán</span>
                    <ArrowRight
                      size={14}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </Link>
                </div>
              </div>

              {/* Right Column: 3 Pillars Allocation Matrix */}
              <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-inner space-y-4 text-left">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Stethoscope size={14} className="text-blue-400" />3 Trụ Cột Can Thiệp Thiết Yếu
                  </span>
                  <span className="text-[11px] font-mono text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                    Chuẩn Phác Đồ Bộ Y Tế
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-slate-950 p-3.5 border border-slate-800 space-y-1">
                    <span className="text-[11px] text-slate-400 uppercase font-semibold">
                      Trụ Cột 1
                    </span>
                    <div className="font-display text-base font-bold text-white">
                      Giường Hồi Sức
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Ưu tiên cấp cứu tuyến đầu, giảm tải cho bệnh viện đa khoa tuyến trên.
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-3.5 border border-slate-800 space-y-1">
                    <span className="text-[11px] text-slate-400 uppercase font-semibold">
                      Trụ Cột 2
                    </span>
                    <div className="font-display text-base font-bold text-cyan-400">
                      Hóa Chất & Vật Tư
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Cloramin B, máy phun và vật tư diệt lăng quăng tại ổ dịch cơ sở.
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-3.5 border border-slate-800 space-y-1">
                    <span className="text-[11px] text-slate-400 uppercase font-semibold">
                      Trụ Cột 3
                    </span>
                    <div className="font-display text-base font-bold text-amber-400">
                      Đội Phản Ứng Nhanh
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Đội cơ động chi viện khoanh vùng dập dịch ngay từ tuần đầu tiên.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs text-emerald-300 leading-relaxed flex items-start gap-2">
                  <TrendingDown size={18} className="shrink-0 text-emerald-400 mt-0.5" />
                  <div>
                    <span className="font-semibold text-emerald-200">Hiệu quả ngăn chặn:</span> Giảm
                    tải ước tính từ 300 đến hơn 1.000 ca bệnh nặng mỗi đợt can thiệp, tiết kiệm hàng
                    chục tỷ đồng ngân sách y tế dự phòng.
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "directive" && (
            <motion.div
              key="directive"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="grid gap-8 lg:grid-cols-12 items-center"
            >
              {/* Left Column: Legal Foundation & Strict Guardrails */}
              <div className="lg:col-span-6 space-y-4 text-left">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-300">
                  <FileText size={13} />
                  <span>GenAI Soạn Thảo & Chuẩn Thể Thức Nhà Nước</span>
                </div>
                <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                  Soạn Thảo Công Điện Khẩn Từ 2 Ngày Xuống 5 Phút
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Trợ lý GenAI ứng dụng kiểm soát Guardrails tự động sinh dự thảo công điện B2G theo
                  đúng thể thức <strong>Nghị định 30/2020/NĐ-CP</strong> và căn cứ điều hành{" "}
                  <strong>Quyết định 02/2016/QĐ-TTg</strong>.
                </p>
                <div className="space-y-3 text-xs sm:text-sm text-slate-300">
                  <div className="flex items-start gap-3 rounded-xl bg-slate-900/90 border border-indigo-500/30 p-3.5 shadow-sm">
                    <ShieldCheck size={18} className="text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-indigo-200 text-xs sm:text-sm">
                        Cơ chế khóa số liệu an toàn (Strict Data Locking):
                      </strong>
                      <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                        100% số liệu (số ca mắc, ngân sách, số giường, số hóa chất, tên địa bàn)
                        được truyền trực tiếp từ thuật toán. Mô hình ngôn ngữ lớn tuyệt đối không
                        được tự ý sửa đổi số liệu ngoài phương án phân bổ (Guardrail G1).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-100">Quy trình thẩm định 4 mắt:</strong> Chuyên
                      viên dịch tễ lập hồ sơ, Lãnh đạo độc lập thẩm duyệt và ký duyệt mô phỏng trong
                      bản demo. AI không bao giờ tự ý ban hành văn bản.
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-100">Cơ chế ngắt mạch Circuit Breaker:</strong>{" "}
                      Tự động khóa và phục hồi bản mẫu chuẩn nếu phát hiện bất kỳ sai lệch nào so
                      với số liệu đã được phê duyệt.
                    </span>
                  </div>
                </div>
                <div className="pt-2">
                  <Link
                    to="/app"
                    className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-indigo-300 hover:text-white transition-colors group"
                  >
                    <span>Mở danh sách cảnh báo & lập hồ sơ xử lý</span>
                    <ArrowRight
                      size={14}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </Link>
                </div>
              </div>

              {/* Right Column: 4-Eyes Workflow Diagram */}
              <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-inner space-y-4 text-left">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Building2 size={14} className="text-indigo-400" />
                    Quy Trình Phê Duyệt Văn Bản 4 Mắt
                  </span>
                  <span className="text-[11px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    Nghị Định 30/2020/NĐ-CP
                  </span>
                </div>

                {/* Workflow Steps Visual */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/30 text-cyan-300 font-bold text-xs shrink-0">
                      1
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Khóa Cứng Dữ Liệu Tự Động</div>
                      <div className="text-[11px] text-slate-400">
                        Số ca, vật tư và ngân sách được khóa bất biến từ thuật toán
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-bold text-xs shrink-0">
                      2
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">
                        Chuyên Viên Y Tế Lập Dự Thảo
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Rà soát phác đồ điều trị, căn cứ dịch tễ và đối chiếu thực địa
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-xs shrink-0">
                      3
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">
                        Lãnh Đạo Thẩm Duyệt & Ký Duyệt
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Xác thực chữ ký mô phỏng và lưu vết kiểm toán (Audit Trail) phục vụ demo
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-xs text-slate-300 leading-relaxed flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award size={16} className="text-indigo-400 shrink-0" />
                    <span>Tuân thủ bảo vệ dữ liệu cá nhân Nghị định 13/2023/NĐ-CP</span>
                  </div>
                  <span className="text-[11px] font-mono text-cyan-400 font-bold">
                    100% Khép Kín
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3D Exploded Isometric Layer Architecture Showcase */}
      <IsometricArchitecture3D />
    </section>
  );
}
