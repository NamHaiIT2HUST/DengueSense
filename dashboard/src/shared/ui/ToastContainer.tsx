import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Sparkles,
  X,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

import { NOTIFICATION_EVENT, type NotificationItem } from "@/shared/lib/notify";

export interface ActiveToast extends NotificationItem {
  key: string;
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);

  useEffect(() => {
    function handleNotification(e: Event) {
      const customEvent = e as CustomEvent<NotificationItem>;
      const item = customEvent.detail;
      if (!item) return;

      const newToast: ActiveToast = {
        ...item,
        key: `${item.id}-${Date.now()}`,
      };

      setToasts((prev) => [newToast, ...prev].slice(0, 5)); // Tối đa 5 toast cùng lúc

      // Tự động đóng sau durationMs
      const duration = item.durationMs ?? 5000;
      const timer = setTimeout(() => {
        setToasts((current) => current.filter((t) => t.key !== newToast.key));
      }, duration);

      return () => clearTimeout(timer);
    }

    window.addEventListener(NOTIFICATION_EVENT, handleNotification);
    return () => window.removeEventListener(NOTIFICATION_EVENT, handleNotification);
  }, []);

  function removeToast(key: string) {
    setToasts((prev) => prev.filter((t) => t.key !== key));
  }

  const getToneIcon = (tone: NotificationItem["tone"], type: NotificationItem["type"]) => {
    if (tone === "critical") {
      return <ShieldAlert size={18} className="text-red-500 animate-pulse" />;
    }
    if (tone === "warning" || type === "alert") {
      return <AlertTriangle size={18} className="text-amber-500" />;
    }
    if (tone === "success") {
      return <CheckCircle2 size={18} className="text-emerald-500" />;
    }
    if (type === "plan") {
      return <Sparkles size={18} className="text-blue-500 dark:text-cyan-400" />;
    }
    return <Info size={18} className="text-blue-500" />;
  };

  const getBorderTone = (tone: NotificationItem["tone"]) => {
    switch (tone) {
      case "critical":
        return "border-red-500/40 bg-red-500/5 dark:bg-red-950/20";
      case "warning":
        return "border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/20";
      case "success":
        return "border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/20";
      default:
        return "border-blue-500/30 bg-blue-500/5 dark:bg-cyan-950/20";
    }
  };

  return (
    <section
      role="region"
      aria-label="Thông báo nổi hệ thống"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[9990] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.key}
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
            className={`pointer-events-auto rounded-2xl border p-3.5 shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-slate-900/95 transition-all ${getBorderTone(
              toast.tone
            )}`}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5 rounded-xl bg-white p-2 shadow-xs border border-slate-200/80 dark:bg-slate-800 dark:border-slate-700">
                {getToneIcon(toast.tone, toast.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {toast.title}
                  </h4>
                  <button
                    type="button"
                    onClick={() => removeToast(toast.key)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    aria-label="Đóng thông báo"
                  >
                    <X size={14} />
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {toast.message}
                </p>
                {toast.link && (
                  <a
                    href={toast.link}
                    onClick={() => removeToast(toast.key)}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors"
                  >
                    <span>Xem chi tiết</span>
                    <ArrowRight size={12} />
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </section>
  );
}
