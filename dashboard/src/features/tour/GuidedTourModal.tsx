import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  ExternalLink,
  UserCheck,
  X,
} from "lucide-react";

import { GUIDED_TOUR_STEPS, type TourStep } from "@/shared/config/guidedTour";
import { Button } from "@/shared/ui/Button";

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigateStep: (step: TourStep) => void;
}

export function GuidedTourModal({ open, onClose, onNavigateStep }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!open) return null;

  const step = GUIDED_TOUR_STEPS[currentIndex] ?? GUIDED_TOUR_STEPS[0];
  if (!step) return null;
  const currentStep: TourStep = step;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === GUIDED_TOUR_STEPS.length - 1;

  function handleNext() {
    if (isLast) {
      onClose();
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  }

  function handlePrev() {
    if (!isFirst) {
      setCurrentIndex((prev) => prev - 1);
    }
  }

  function handleGoToFeature() {
    onNavigateStep(currentStep);
  }

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-tour-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="relative flex flex-col w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        >
          {/* Top accent bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500">
                <Compass size={20} />
              </div>
              <div>
                <h2
                  id="guided-tour-title"
                  className="font-display text-lg font-bold text-slate-900 dark:text-white"
                >
                  Lộ Trình Trải Nghiệm Đa Vai Trò DengueSense
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Khám phá quy trình tác chiến dịch tễ hoàn chỉnh từ dữ liệu lớn tới quyết định B2G.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng hướng dẫn"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Stepper Dots & Progress */}
          <div className="px-6 pt-4 pb-2 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/30">
            <div className="flex items-center gap-2">
              {GUIDED_TOUR_STEPS.map((step, idx) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`flex h-7 px-2.5 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                    idx === currentIndex
                      ? "bg-blue-600 text-white shadow-xs"
                      : idx < currentIndex
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                        : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Bước {currentIndex + 1} / {GUIDED_TOUR_STEPS.length}
            </span>
          </div>

          {/* Step Body */}
          <div className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${currentStep.stageColor}`}
              >
                {currentStep.stageBadge}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <UserCheck size={14} className="text-blue-500" />
                <span>Vai trò đề xuất:</span>
                <strong className="text-slate-800 dark:text-slate-200">
                  {currentStep.roleName}
                </strong>
              </div>
            </div>

            <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white leading-snug">
              {currentStep.title}
            </h3>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {currentStep.description}
            </p>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-4 dark:border-slate-800/80 dark:bg-slate-950/50">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Trọng tâm công nghệ & nghiệp vụ:
              </span>
              <ul className="mt-2.5 space-y-2">
                {currentStep.highlights.map((highlight) => (
                  <li
                    key={highlight}
                    className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300"
                  >
                    <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              Bỏ qua hướng dẫn
            </button>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                disabled={isFirst}
                onClick={handlePrev}
                className="gap-1.5 px-3 py-1.5 text-xs"
              >
                <ArrowLeft size={14} />
                <span>Trước</span>
              </Button>

              <Button
                variant="secondary"
                onClick={handleGoToFeature}
                className="gap-1.5 border-blue-500/30 text-blue-600 dark:text-cyan-400 hover:bg-blue-500/10 px-3 py-1.5 text-xs"
              >
                <ExternalLink size={14} />
                <span>{currentStep.actionPrompt}</span>
              </Button>

              <Button
                variant="primary"
                onClick={handleNext}
                className="gap-1.5 px-3 py-1.5 text-xs"
              >
                <span>{isLast ? "Hoàn tất" : "Tiếp theo"}</span>
                {!isLast && <ArrowRight size={14} />}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
