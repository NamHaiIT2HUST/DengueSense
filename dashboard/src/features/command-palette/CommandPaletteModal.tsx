import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Compass,
  FolderKanban,
  Map,
  MapPin,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
  UserCheck,
  X,
} from "lucide-react";

import { useProvinces } from "@/entities/forecast";
import { DEMO_ACCOUNTS } from "@/shared/config/demo";

export interface PaletteAction {
  id: string;
  category: "actions" | "roles" | "provinces";
  title: string;
  subtitle?: string;
  icon: typeof Search;
  iconColor: string;
  badge?: string;
  badgeColor?: string;
  onSelect: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenScenarios: () => void;
  onOpenTour: () => void;
  onNavigate: (route: string) => void;
  onSwitchRole: (username: string, password: string) => void;
}

export function CommandPaletteModal({
  open,
  onClose,
  onOpenScenarios,
  onOpenTour,
  onNavigate,
  onSwitchRole,
}: Props) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const provincesQuery = useProvinces();
  const provinces = useMemo(() => provincesQuery.data?.items ?? [], [provincesQuery.data?.items]);

  const handleClose = useCallback(() => {
    setQuery("");
    setSelectedIndex(0);
    onClose();
  }, [onClose]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  // Build searchable items
  const allActions: readonly PaletteAction[] = useMemo(() => {
    const list: PaletteAction[] = [
      // Core actions
      {
        id: "act-scenarios",
        category: "actions",
        title: "🎯 Diễn tập Tình huống Mẫu",
        subtitle: "Nạp kịch bản El Niño Nam Bộ, Miền Trung hoặc Ngân sách thắt chặt",
        icon: Target,
        iconColor: "text-red-500",
        badge: "Sandbox",
        badgeColor: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
        onSelect: () => {
          onClose();
          onOpenScenarios();
        },
      },
      {
        id: "act-tour",
        category: "actions",
        title: "🧭 Lộ trình Trải nghiệm 5 Bước",
        subtitle: "Khám phá quy trình tác chiến khép kín từ AI đến quyết định B2G",
        icon: Compass,
        iconColor: "text-blue-500",
        badge: "Guided Tour",
        badgeColor: "bg-blue-500/10 text-blue-600 dark:text-cyan-400 border-blue-500/20",
        onSelect: () => {
          onClose();
          onOpenTour();
        },
      },
      {
        id: "nav-map",
        category: "actions",
        title: "Bản đồ phân vùng dịch tễ 34 tỉnh",
        subtitle: "Giám sát rủi ro 4 tầm dự báo 1-3-6-12 tháng",
        icon: Map,
        iconColor: "text-emerald-500",
        onSelect: () => {
          onClose();
          onNavigate("/app/ban-do");
        },
      },
      {
        id: "nav-cases",
        category: "actions",
        title: "Danh sách hồ sơ can thiệp",
        subtitle: "Xem hồ sơ tác chiến và phương án tối ưu MILP",
        icon: FolderKanban,
        iconColor: "text-amber-500",
        onSelect: () => {
          onClose();
          onNavigate("/app/ho-so");
        },
      },
      {
        id: "nav-alerts",
        category: "actions",
        title: "Giám sát cảnh báo sớm",
        subtitle: "Danh sách tín hiệu cảnh báo vượt ngưỡng dịch",
        icon: AlertTriangle,
        iconColor: "text-orange-500",
        onSelect: () => {
          onClose();
          onNavigate("/app/canh-bao");
        },
      },
      {
        id: "nav-runs",
        category: "actions",
        title: "Lượt chạy dự báo & Thống kê M4-R2",
        subtitle: "Tái hiện lịch sử và kiểm định hiệu năng mô hình",
        icon: TrendingUp,
        iconColor: "text-indigo-500",
        onSelect: () => {
          onClose();
          onNavigate("/app/luot-du-bao");
        },
      },
      {
        id: "nav-model",
        category: "actions",
        title: "Hồ sơ Mô hình AI & 12 Giới hạn kỹ thuật",
        subtitle: "Model Card minh bạch hoá năng lực và độ tin cậy từng vùng",
        icon: ShieldCheck,
        iconColor: "text-purple-500",
        onSelect: () => {
          onClose();
          onNavigate("/app/mo-hinh");
        },
      },
    ];

    // Role switcher actions
    DEMO_ACCOUNTS.forEach((account) => {
      list.push({
        id: `role-${account.username}`,
        category: "roles",
        title: `Chuyển vai trò: ${account.displayName}`,
        subtitle: `Tài khoản: ${account.username} (Quyền: ${account.roles.join(", ")})`,
        icon: UserCheck,
        iconColor: "text-cyan-500",
        badge: "Đổi quyền",
        badgeColor: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
        onSelect: () => {
          onClose();
          onSwitchRole(account.username, account.password);
        },
      });
    });

    // 34 Provinces actions
    provinces.forEach((prov) => {
      list.push({
        id: `prov-${prov.province_id}`,
        category: "provinces",
        title: `Tỉnh ${prov.name}`,
        subtitle: `Khu vực: Miền ${prov.region} • Chi tiết dịch tễ & Giải trình TreeSHAP`,
        icon: MapPin,
        iconColor: "text-blue-500",
        badge: `Miền ${prov.region}`,
        badgeColor: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        onSelect: () => {
          onClose();
          onNavigate(`/app/tinh/${prov.province_id}`);
        },
      });
    });

    return list;
  }, [onClose, onOpenScenarios, onOpenTour, onNavigate, onSwitchRole, provinces]);

  // Filter actions by query
  const filteredActions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allActions;
    return allActions.filter(
      (action) =>
        action.title.toLowerCase().includes(q) ||
        (action.subtitle && action.subtitle.toLowerCase().includes(q)) ||
        (action.badge && action.badge.toLowerCase().includes(q))
    );
  }, [allActions, query]);

  // Clamp selection index
  const safeSelectedIndex = Math.min(selectedIndex, Math.max(0, filteredActions.length - 1));

  // Keyboard navigation within modal
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredActions.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev <= 0 ? Math.max(0, filteredActions.length - 1) : prev - 1
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = filteredActions[safeSelectedIndex];
        if (selected) {
          selected.onSelect();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, filteredActions, safeSelectedIndex, handleClose]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24 bg-slate-950/70 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Thanh lệnh tác chiến nhanh"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="relative flex flex-col w-full max-w-xl max-h-[75vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        >
          {/* Search Input Bar */}
          <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
            <Search size={18} className="text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Tìm kiếm tỉnh thành, kịch bản, lệnh tác chiến..."
              className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSelectedIndex(0);
                  inputRef.current?.focus();
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            ) : (
              <kbd className="hidden sm:inline-block rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 dark:border-slate-700">
                ESC
              </kbd>
            )}
          </div>

          {/* Results List */}
          <div
            ref={listRef}
            className="overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800/40"
          >
            {filteredActions.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                Không tìm thấy kết quả nào phù hợp với &quot;{query}&quot;.
              </div>
            ) : (
              <div className="space-y-1">
                {filteredActions.map((action, idx) => {
                  const isSelected = idx === safeSelectedIndex;
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => action.onSelect()}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-blue-50 text-blue-900 dark:bg-blue-600/15 dark:text-blue-200"
                          : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                            isSelected
                              ? "border-blue-300 bg-white dark:border-blue-500/40 dark:bg-slate-900"
                              : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60"
                          }`}
                        >
                          <Icon size={16} className={action.iconColor} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate leading-tight">
                            {action.title}
                          </p>
                          {action.subtitle && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {action.subtitle}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {action.badge && (
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                              action.badgeColor || ""
                            }`}
                          >
                            {action.badge}
                          </span>
                        )}
                        {isSelected && (
                          <ArrowRight
                            size={14}
                            className="text-blue-600 dark:text-cyan-400 shrink-0"
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Shortcuts Help */}
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-950/40">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-slate-200 px-1 font-mono text-[10px] dark:border-slate-700">
                  ↑
                </kbd>
                <kbd className="rounded border border-slate-200 px-1 font-mono text-[10px] dark:border-slate-700">
                  ↓
                </kbd>
                <span>chuyển mục</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-slate-200 px-1 font-mono text-[10px] dark:border-slate-700">
                  ↵
                </kbd>
                <span>chọn</span>
              </span>
            </div>
            <span>DengueSense Command Center</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
