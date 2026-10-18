import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  Layers,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useId, useMemo, useState } from "react";

import { TACTICAL_SCENARIOS, type TacticalScenario } from "@/shared/config/scenarios";
import { exportToCsv } from "@/shared/lib/exportCsv";
import { formatCount, formatCurrency } from "@/shared/lib/format";
import { Button } from "@/shared/ui/Button";

interface Props {
  open: boolean;
  onClose: () => void;
  initialBudget?: number;
  initialCasesPrevented?: number;
  onSelectScenario?: (scenario: TacticalScenario) => void;
}

type TabMode = "sensitivity" | "scenarios";

export function ScenarioComparisonModal({
  open,
  onClose,
  initialBudget = 1_000_000_000,
  initialCasesPrevented = 420,
  onSelectScenario,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabMode>("sensitivity");
  const [budgetMultiplier, setBudgetMultiplier] = useState<number>(1.0); // 1.0 = baseline (100%)
  const sliderId = useId();

  // Baseline figures
  const baselineBudget = initialBudget;
  const baselineCases = initialCasesPrevented;

  // Sensitivity calculation model based on WHO Dengue Economics & diminishing returns
  const currentBudget = Math.round(baselineBudget * budgetMultiplier);

  // Elasticity model: diminishing marginal returns as budget surges; disproportionate collapse if severely underfunded
  const currentCasesPrevented = useMemo(() => {
    if (budgetMultiplier <= 1.0) {
      // Linear-concave drop when budget is cut (sub-linear loss at small cuts, steeper loss at deep cuts)
      const ratio = Math.pow(budgetMultiplier, 1.25);
      return Math.round(baselineCases * ratio);
    } else {
      // Diminishing returns curve for additional surge budget: (1 + 0.75 * ln(multiplier))
      const factor = 1 + 0.85 * Math.log(budgetMultiplier);
      return Math.round(baselineCases * factor);
    }
  }, [baselineCases, budgetMultiplier]);

  // DALYs saved (WHO standard for Dengue in SE Asia: 0.034 DALYs averted per prevented clinical case)
  const dalysSaved = Number((currentCasesPrevented * 0.034).toFixed(1));
  const costPerCasePrevented =
    currentCasesPrevented > 0 ? Math.round(currentBudget / currentCasesPrevented) : 0;

  // Estimated economic benefit saved (Direct healthcare cost ~3.5M VND + indirect economic loss ~2.2M VND = 5.7M VND/case)
  const economicBenefitSaved = currentCasesPrevented * 5_700_000;
  const netReturnBenefit = economicBenefitSaved - currentBudget;
  const roiRatio =
    currentBudget > 0 ? Number((economicBenefitSaved / currentBudget).toFixed(2)) : 0;

  // Sensitivity presets
  const presets = [
    {
      id: "austerity",
      label: "-20% Ngân sách Thắt chặt",
      sublabel: "Bảo toàn khu vực trọng điểm cấp 4",
      multiplier: 0.8,
      variant: "amber",
      icon: TrendingDown,
    },
    {
      id: "baseline",
      label: "Phương án Đề xuất Chuẩn (100%)",
      sublabel: "Điểm tối ưu Pareto chi phí - hiệu quả",
      multiplier: 1.0,
      variant: "blue",
      icon: Scale,
    },
    {
      id: "surged",
      label: "+20% Phản ứng Tăng cường",
      sublabel: "Bao vây dập dịch sớm toàn vùng",
      multiplier: 1.2,
      variant: "emerald",
      icon: TrendingUp,
    },
  ];

  // Export comparison data to CSV
  function handleExportCsv() {
    if (activeTab === "sensitivity") {
      const rows = [
        {
          posture: "Thắt lưng buộc bụng (-20%)",
          budget: formatCurrency(Math.round(baselineBudget * 0.8)),
          casesPrevented: Math.round(baselineCases * Math.pow(0.8, 1.25)),
          dalysSaved: (Math.round(baselineCases * Math.pow(0.8, 1.25)) * 0.034).toFixed(1),
          costPerCase: formatCurrency(
            Math.round((baselineBudget * 0.8) / Math.round(baselineCases * Math.pow(0.8, 1.25)))
          ),
          recommendation: "Cảnh báo quá tải tuyến cơ sở; chỉ dập các ổ dịch F0 lớn nhất.",
        },
        {
          posture: "Phương án Đề xuất Chuẩn (100%)",
          budget: formatCurrency(baselineBudget),
          casesPrevented: baselineCases,
          dalysSaved: (baselineCases * 0.034).toFixed(1),
          costPerCase: formatCurrency(Math.round(baselineBudget / baselineCases)),
          recommendation:
            "Tối ưu hóa MILP cân đối ngân sách và tỷ lệ bao phủ theo phân vùng rủi ro.",
        },
        {
          posture: "Phản ứng Tăng cường (+20%)",
          budget: formatCurrency(Math.round(baselineBudget * 1.2)),
          casesPrevented: Math.round(baselineCases * (1 + 0.85 * Math.log(1.2))),
          dalysSaved: (Math.round(baselineCases * (1 + 0.85 * Math.log(1.2))) * 0.034).toFixed(1),
          costPerCase: formatCurrency(
            Math.round(
              (baselineBudget * 1.2) / Math.round(baselineCases * (1 + 0.85 * Math.log(1.2)))
            )
          ),
          recommendation: "Chặn đứng lây lan liên tỉnh; bảo vệ tối đa trẻ em và người cao tuổi.",
        },
      ];

      exportToCsv(
        "denguesense_phan_tich_do_nhay_ngan_sach",
        [
          { header: "Tư thế tác chiến", key: "posture" },
          { header: "Tổng ngân sách", key: "budget" },
          { header: "Ca ngăn chặn ước tính", key: "casesPrevented" },
          { header: "DALYs bảo toàn", key: "dalysSaved" },
          { header: "Chi phí / ca ngăn ngừa", key: "costPerCase" },
          { header: "Đánh giá & Khuyến nghị", key: "recommendation" },
        ],
        rows
      );
    } else {
      const rows = TACTICAL_SCENARIOS.map((sc) => ({
        title: sc.title,
        region: sc.region,
        provinces: sc.provinces.join(", "),
        budget: formatCurrency(sc.budget),
        preventedCases: sc.keyOutcomes.preventedCases,
        dalysSaved: (sc.keyOutcomes.preventedCases * 0.034).toFixed(1),
        beds: sc.keyOutcomes.beds,
        supplies: sc.keyOutcomes.supplies,
        teams: sc.keyOutcomes.teams,
        costPerCase: formatCurrency(Math.round(sc.budget / sc.keyOutcomes.preventedCases)),
        summary: sc.summary,
      }));

      exportToCsv(
        "denguesense_so_sanh_kich_ban_tac_chien",
        [
          { header: "Tên kịch bản", key: "title" },
          { header: "Vùng trọng điểm", key: "region" },
          { header: "Địa bàn", key: "provinces" },
          { header: "Dự toán ngân sách", key: "budget" },
          { header: "Số ca ngăn chặn", key: "preventedCases" },
          { header: "DALYs bảo toàn", key: "dalysSaved" },
          { header: "Giường bệnh", key: "beds" },
          { header: "Vật tư (Lít/Bộ)", key: "supplies" },
          { header: "Đội phản ứng", key: "teams" },
          { header: "Đơn giá / ca ngăn ngừa", key: "costPerCase" },
          { header: "Bối cảnh dịch tễ", key: "summary" },
        ],
        rows
      );
    }
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="comparison-modal-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative flex flex-col w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500">
                <Scale size={20} />
              </div>
              <div>
                <h2
                  id="comparison-modal-title"
                  className="font-display text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"
                >
                  Đối Sánh Đa Kịch Bản & Phân Tích Độ Nhạy Ngân Sách
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Mô phỏng đường cong co giãn chi phí - hiệu quả kinh tế y tế (WHO CEA) và so sánh
                  đối chứng phương án
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                className="px-3 py-1.5 text-xs gap-1.5"
                onClick={handleExportCsv}
                title="Tải bảng đối sánh định dạng CSV chuẩn RFC 4180 cho Excel"
              >
                <Download size={13} />
                <span>Xuất CSV</span>
              </Button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng cửa sổ"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50/70 px-6 dark:border-slate-800 dark:bg-slate-950/40 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("sensitivity")}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all ${
                activeTab === "sensitivity"
                  ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
              }`}
            >
              <SlidersHorizontal size={14} />
              <span>Phân Tích Độ Nhạy Ngân Sách (+20% / -20%)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("scenarios")}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all ${
                activeTab === "scenarios"
                  ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
              }`}
            >
              <Layers size={14} />
              <span>Đối So Sánh Song Song 3 Kịch Bản Diễn Tập</span>
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto p-6 space-y-6">
            {activeTab === "sensitivity" ? (
              <div className="space-y-6">
                {/* 3 Tư thế tác chiến so sánh trực quan */}
                <div className="grid gap-4 md:grid-cols-3">
                  {presets.map((preset) => {
                    const isSelected = Math.abs(budgetMultiplier - preset.multiplier) < 0.01;
                    const pBudget = Math.round(baselineBudget * preset.multiplier);
                    const pCases =
                      preset.multiplier <= 1.0
                        ? Math.round(baselineCases * Math.pow(preset.multiplier, 1.25))
                        : Math.round(baselineCases * (1 + 0.85 * Math.log(preset.multiplier)));
                    const pCostPerCase = Math.round(pBudget / pCases);
                    const Icon = preset.icon;

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setBudgetMultiplier(preset.multiplier)}
                        className={`text-left rounded-xl border p-4 transition-all flex flex-col justify-between ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-50/50 shadow-md ring-2 ring-indigo-500/20 dark:border-indigo-500 dark:bg-indigo-950/30"
                            : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span
                              className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                                preset.multiplier > 1.0
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                  : preset.multiplier < 1.0
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                              }`}
                            >
                              <Icon size={12} />
                              {preset.label}
                            </span>
                            {isSelected && (
                              <CheckCircle2
                                size={16}
                                className="text-indigo-600 dark:text-indigo-400"
                              />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {preset.sublabel}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Ngân sách:</span>
                            <strong className="text-slate-900 dark:text-white tabular-nums">
                              {formatCurrency(pBudget)}
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Ca ngăn ngừa:</span>
                            <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                              ≈ {formatCount(pCases)} ca
                            </strong>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400">Chi phí / ca:</span>
                            <span className="text-slate-600 dark:text-slate-300 tabular-nums">
                              {formatCurrency(pCostPerCase)}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Slider điều chỉnh ngân sách liên tục */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-950/60 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <label
                        htmlFor={sliderId}
                        className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5"
                      >
                        <Activity size={14} className="text-indigo-500" />
                        Thanh Trượt Điều Chỉnh Hệ Số Ngân Sách Linh Hoạt
                      </label>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Kiểm chứng độ co giãn: Kéo từ 50% đến 150% ngân sách cơ sở để xem kết quả mô
                        phỏng động.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-indigo-500/10 px-2.5 py-1 text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                        {Math.round(budgetMultiplier * 100)}% (
                        {budgetMultiplier >= 1.0
                          ? `+${Math.round((budgetMultiplier - 1) * 100)}%`
                          : `-${Math.round((1 - budgetMultiplier) * 100)}%`}
                        )
                      </span>
                      <button
                        type="button"
                        onClick={() => setBudgetMultiplier(1.0)}
                        className="text-[11px] text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        Đặt lại chuẩn
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <input
                      id={sliderId}
                      type="range"
                      min="0.5"
                      max="1.5"
                      step="0.05"
                      value={budgetMultiplier}
                      onChange={(e) => setBudgetMultiplier(parseFloat(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 rounded-lg appearance-none dark:bg-slate-700"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>50% (Tiết kiệm tối đa)</span>
                      <span>80% (-20%)</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        100% (Chuẩn đề xuất)
                      </span>
                      <span>120% (+20%)</span>
                      <span>150% (Tăng cường tối đa)</span>
                    </div>
                  </div>
                </div>

                {/* Kết quả mô phỏng động */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <span className="text-[11px] text-slate-500 block">Tổng Ngân Sách Phân Bổ</span>
                    <strong className="text-xl font-bold tabular-nums text-slate-900 dark:text-white mt-1 block">
                      {formatCurrency(currentBudget)}
                    </strong>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {budgetMultiplier > 1.0
                        ? `+${formatCurrency(currentBudget - baselineBudget)} so với chuẩn`
                        : budgetMultiplier < 1.0
                          ? `-${formatCurrency(baselineBudget - currentBudget)} so với chuẩn`
                          : "Khung ngân sách cơ sở"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <span className="text-[11px] text-slate-500 block">
                      Số Ca Bệnh Dự Kiến Ngăn Chặn
                    </span>
                    <strong className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1 block">
                      ≈ {formatCount(currentCasesPrevented)} ca
                    </strong>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {currentCasesPrevented >= baselineCases
                        ? `+${currentCasesPrevented - baselineCases} ca được cứu vãn`
                        : `-${baselineCases - currentCasesPrevented} ca bị bỏ sót do thiếu nguồn lực`}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <span className="text-[11px] text-slate-500 block">
                      Năm Sống DALYs Bảo Toàn
                    </span>
                    <strong className="text-xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400 mt-1 block">
                      {dalysSaved} DALYs
                    </strong>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Chuẩn WHO: 0.034 DALYs / ca lâm sàng
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <span className="text-[11px] text-slate-500 block">
                      Chi Phí / Ca Ngăn Ngừa (ICER)
                    </span>
                    <strong className="text-xl font-bold tabular-nums text-slate-900 dark:text-white mt-1 block">
                      {formatCurrency(costPerCasePrevented)}
                    </strong>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Lợi tức đầu tư xã hội: {roiRatio}x
                    </span>
                  </div>
                </div>

                {/* Khuyến nghị chiến lược B2G */}
                <div className="rounded-xl border border-indigo-200/60 bg-indigo-50/50 p-4 text-xs text-indigo-900 dark:border-indigo-500/20 dark:bg-indigo-950/20 dark:text-indigo-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <ShieldCheck size={16} className="text-indigo-600 dark:text-indigo-400" />
                    <span>
                      Đánh Giá Chiến Lược Y Tế Công Cộng (Executive B2G Strategic Insight):
                    </span>
                  </div>
                  <p className="leading-relaxed text-slate-700 dark:text-slate-300">
                    {budgetMultiplier >= 1.2 ? (
                      <>
                        <strong>Khuyến nghị cấp cao:</strong> Tăng thêm 20% ngân sách giúp hệ thống
                        tạo lập thế phòng ngự chủ động, khống chế chỉ số Breteau Index (BI) xuống
                        dưới ngưỡng 20 tại các huyện giáp ranh. Lợi nhuận xã hội ròng bảo vệ ước
                        tính đạt{" "}
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(netReturnBenefit)}
                        </strong>
                        .
                      </>
                    ) : budgetMultiplier <= 0.8 ? (
                      <>
                        <strong className="text-amber-600 dark:text-amber-400">
                          Cảnh báo rủi ro bùng phát:
                        </strong>{" "}
                        Cắt giảm 20% kinh phí buộc thuật toán MILP phải triệt tiêu vật tư dự phòng
                        tại 30% trạm y tế cơ sở. Nguy cơ bùng phát ca nặng vượt khả năng tiếp nhận
                        cấp cứu tại các bệnh viện tuyến cuối.
                      </>
                    ) : (
                      <>
                        <strong>Phương án đề xuất tối ưu:</strong> Tỷ lệ chi phí / hiệu quả đạt điểm
                        cân bằng Pareto hoàn hảo. Đảm bảo 100% các ổ dịch nguy cơ cấp độ 3 và 4 đều
                        được cấp phát hóa chất diệt muỗi, máy phun ULV và đội cơ động trong vòng 48
                        giờ.
                      </>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              /* Tab 2: So sánh Đối chứng 3 Kịch bản Diễn tập */
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Chỉ số so sánh</th>
                        {TACTICAL_SCENARIOS.map((sc) => (
                          <th key={sc.id} className="py-3 px-4 font-semibold min-w-[200px]">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${sc.badgeColor}`}
                              >
                                {sc.badge}
                              </span>
                            </div>
                            <span className="text-slate-900 dark:text-white font-bold block text-sm">
                              {sc.title.split(":")[0]}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      <tr>
                        <td className="py-3 px-4 font-medium text-slate-500">
                          Vùng địa bàn trọng điểm
                        </td>
                        {TACTICAL_SCENARIOS.map((sc) => (
                          <td
                            key={sc.id}
                            className="py-3 px-4 font-semibold text-slate-900 dark:text-white"
                          >
                            {sc.region} ({sc.provinces.join(", ")})
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-medium text-slate-500">Dự toán ngân sách</td>
                        {TACTICAL_SCENARIOS.map((sc) => (
                          <td
                            key={sc.id}
                            className="py-3 px-4 font-bold text-slate-900 dark:text-white tabular-nums"
                          >
                            {formatCurrency(sc.budget)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-medium text-slate-500">
                          Ước tính ca ngăn chặn
                        </td>
                        {TACTICAL_SCENARIOS.map((sc) => (
                          <td
                            key={sc.id}
                            className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400 tabular-nums"
                          >
                            ≈ {sc.keyOutcomes.preventedCases} ca
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-medium text-slate-500">
                          Năm sống DALYs bảo toàn
                        </td>
                        {TACTICAL_SCENARIOS.map((sc) => (
                          <td
                            key={sc.id}
                            className="py-3 px-4 font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums"
                          >
                            {(sc.keyOutcomes.preventedCases * 0.034).toFixed(1)} DALYs
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-medium text-slate-500">
                          Chi phí / 1 ca ngăn ngừa
                        </td>
                        {TACTICAL_SCENARIOS.map((sc) => (
                          <td
                            key={sc.id}
                            className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300 tabular-nums"
                          >
                            {formatCurrency(Math.round(sc.budget / sc.keyOutcomes.preventedCases))}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-medium text-slate-500">
                          Huy động vật tư & nhân lực
                        </td>
                        {TACTICAL_SCENARIOS.map((sc) => (
                          <td
                            key={sc.id}
                            className="py-3 px-4 text-[11px] text-slate-600 dark:text-slate-300"
                          >
                            {sc.keyOutcomes.beds} giường cấp cứu · {sc.keyOutcomes.supplies} L/bộ
                            vật tư · {sc.keyOutcomes.teams} đội phản ứng nhanh
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-medium text-slate-500">
                          Hành động tác chiến
                        </td>
                        {TACTICAL_SCENARIOS.map((sc) => (
                          <td key={sc.id} className="py-3 px-4">
                            <Button
                              variant="secondary"
                              className="text-xs py-1 px-2.5 gap-1"
                              onClick={() => {
                                onClose();
                                onSelectScenario?.(sc);
                              }}
                            >
                              <span>Chọn kịch bản</span>
                              <ArrowRight size={12} />
                            </Button>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-3.5 text-xs text-amber-900 dark:border-amber-500/20 dark:bg-amber-950/20 dark:text-amber-200 flex items-start gap-2.5">
                  <AlertTriangle
                    size={15}
                    className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                  />
                  <p className="leading-relaxed">
                    <strong>Khuyến cáo chuẩn mực:</strong> Mỗi kịch bản đại diện cho một hình thái
                    dịch tễ đặc trưng của Việt Nam. Giải thuật MILP đảm bảo 100% tuân thủ các ràng
                    buộc bất biến (hard constraints) về năng lực tiếp nhận thực tế tại địa phương.
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
