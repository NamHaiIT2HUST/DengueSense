import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bell, CheckCheck, FileText, Send, Sparkles } from "lucide-react";

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: "alert" | "plan" | "draft" | "system";
  link: string;
  read: boolean;
}

const DEFAULT_NOTIFICATIONS: SystemNotification[] = [
  {
    id: "notif-01",
    title: "Cảnh báo vượt ngưỡng P75",
    message: "TP. Hồ Chí Minh xác suất bùng phát dịch 82% (ngưỡng nền: 35%). Cần chú ý giám sát.",
    timestamp: "10 phút trước",
    type: "alert",
    link: "/app/canh-bao",
    read: false,
  },
  {
    id: "notif-02",
    title: "Tối ưu phân bổ nguồn lực MILP",
    message: "Hồ sơ Miền Nam đã hoàn tất giải bài toán phân bổ 1 tỷ VNĐ cho 2 tỉnh trọng điểm.",
    timestamp: "35 phút trước",
    type: "plan",
    link: "/app/ho-so/case-south-2010-06",
    read: false,
  },
  {
    id: "notif-03",
    title: "Công điện B2G chờ phê duyệt",
    message: "Dự thảo Công điện khẩn gửi UBND các tỉnh phía Nam đang chờ thẩm định 4 mắt.",
    timestamp: "1 giờ trước",
    type: "draft",
    link: "/app/du-thao/draft-south-01",
    read: false,
  },
  {
    id: "notif-04",
    title: "Lượt dự báo M4-R2 mới",
    message: "Hệ thống AI vừa hoàn tất chu kỳ dự báo đợt 2010-06 với 34 tỉnh thành.",
    timestamp: "3 giờ trước",
    type: "system",
    link: "/app/ban-do",
    read: true,
  },
];

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>(() => {
    try {
      const stored = localStorage.getItem("denguesense_notifications");
      return stored ? (JSON.parse(stored) as SystemNotification[]) : DEFAULT_NOTIFICATIONS;
    } catch {
      return DEFAULT_NOTIFICATIONS;
    }
  });

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem("denguesense_notifications", JSON.stringify(notifications));
    } catch {
      // Bỏ qua lỗi quota storage
    }
  }, [notifications]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  function markAllAsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function markAsRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setIsOpen(false);
  }

  const getIcon = (type: SystemNotification["type"]) => {
    switch (type) {
      case "alert":
        return <AlertTriangle size={15} className="text-amber-500" />;
      case "plan":
        return <Sparkles size={15} className="text-blue-500 dark:text-cyan-400" />;
      case "draft":
        return <FileText size={15} className="text-emerald-500" />;
      case "system":
        return <Send size={15} className="text-purple-500" />;
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Thông báo hệ thống"
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-white/80 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        title="Thông báo hệ thống y tế"
      >
        <Bell size={15} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-xs animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-950/95 z-50"
          >
            {/* Header popup */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 px-1 dark:border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Trung tâm thông báo
                </span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-cyan-500/15 dark:text-cyan-300">
                    {unreadCount} mới
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-cyan-300 transition-colors"
                >
                  <CheckCheck size={13} />
                  <span>Đọc tất cả</span>
                </button>
              )}
            </div>

            {/* Danh sách thông báo */}
            <div className="mt-2 max-h-80 overflow-y-auto space-y-1.5 pr-0.5">
              {notifications.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Không có thông báo nào
                </div>
              ) : (
                notifications.map((item) => (
                  <a
                    key={item.id}
                    href={item.link}
                    onClick={() => markAsRead(item.id)}
                    className={`block rounded-xl p-2.5 transition-colors border ${
                      item.read
                        ? "border-transparent bg-transparent hover:bg-slate-50 dark:hover:bg-slate-900/60 text-slate-600 dark:text-slate-300"
                        : "border-blue-100 bg-blue-50/50 hover:bg-blue-50 dark:border-cyan-500/20 dark:bg-cyan-500/5 dark:hover:bg-cyan-500/10 text-slate-900 dark:text-white"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 shrink-0 rounded-lg bg-white p-1.5 shadow-2xs border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800">
                        {getIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-semibold truncate leading-tight">
                            {item.title}
                          </p>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {item.timestamp}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-2">
                          {item.message}
                        </p>
                      </div>
                      {!item.read && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600 dark:bg-cyan-400" />
                      )}
                    </div>
                  </a>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
