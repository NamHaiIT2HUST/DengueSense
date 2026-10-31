import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Scale, ShieldAlert, Target, X } from "lucide-react";

import { TACTICAL_SCENARIOS, type TacticalScenario } from "@/shared/config/scenarios";
import { formatCurrency } from "@/shared/lib/format";
import { Button } from "@/shared/ui/Button";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectScenario: (scenario: TacticalScenario) => void;
  onOpenComparison?: () => void;
}

export function TacticalScenarioModal({
  open,
  onClose,
  onSelectScenario,
  onOpenComparison,
}: Props) {
  if (!open) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scenario-modal-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative flex flex-col w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 text-red-500">
                <Target size={20} />
              </div>
              <div>
                <h2
                  id="scenario-modal-title"
                  className="font-display text-lg font-bold text-slate-900 dark:text-white"
                >
                  Bảng Điều Khiển Diễn Tập Tình Huống Mẫu
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Chọn kịch bản thực tế để hệ thống tự động nạp dữ liệu dịch tễ và chuyển đúng vai
                  trò tác chiến.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onOpenComparison && (
                <Button
                  variant="secondary"
                  className="px-3 py-1.5 text-xs gap-1.5"
                  onClick={() => {
                    onClose();
                    onOpenComparison();
                  }}
                  title="Mở giao diện so sánh đối chứng đa kịch bản và phân tích độ nhạy ngân sách (+20% / -20%)"
                >
                  <Scale size={13} />
                  <span>Đối sánh A/B & Độ nhạy</span>
                </Button>
              )}
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

          {/* Body */}
          <div className="overflow-y-auto p-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {TACTICAL_SCENARIOS.map((sc) => (
                <div
                  key={sc.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-all hover:border-blue-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-cyan-500/40"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${sc.badgeColor}`}
                      >
                        {sc.badge}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {sc.region}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                        {sc.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {sc.summary}
                      </p>
                    </div>

                    {/* Outcome Box */}
                    <div className="rounded-lg border border-slate-200/80 bg-white p-2.5 text-xs space-y-1.5 dark:border-slate-800/80 dark:bg-slate-900/80">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-500">Ngân sách dự kiến:</span>
                        <strong className="text-slate-900 dark:text-white tabular-nums">
                          {formatCurrency(sc.budget)}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-500">Ước tính ca ngăn chặn:</span>
                        <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                          ≈ {sc.keyOutcomes.preventedCases} ca
                        </strong>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-500">Giường / Vật tư:</span>
                        <span className="text-slate-700 dark:text-slate-300">
                          {sc.keyOutcomes.beds}G · {sc.keyOutcomes.supplies} đơn vị
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <Button
                      variant="primary"
                      className="w-full py-1.5 text-xs gap-1.5 justify-center"
                      onClick={() => onSelectScenario(sc)}
                    >
                      <span>Tác chiến ngay</span>
                      <ArrowRight size={13} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-blue-200/60 bg-blue-50/60 p-3.5 text-xs text-blue-900 dark:border-cyan-500/20 dark:bg-cyan-500/5 dark:text-cyan-200 flex items-start gap-3">
              <ShieldAlert size={16} className="text-blue-600 dark:text-cyan-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Ghi chú cho Giám khảo & Tester:</strong> Mỗi kịch bản sẽ tự động chuyển tài
                khoản demo sang đúng vai trò phụ trách (Điều hành hoặc Lãnh đạo) và mở hồ sơ can
                thiệp tương ứng để bạn kiểm chứng trọn vẹn luồng phân bổ MILP và quy tắc 4 mắt.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
