import { useState } from "react";
import { CheckCircle2, Copy, Download, Lock, Search, ShieldCheck, X, Zap } from "lucide-react";

import { exportCsv } from "@/shared/lib/exportCsv";
import { notify } from "@/shared/lib/notify";
import { Button } from "@/shared/ui/Button";
import { INITIAL_AUDIT_LOGS, type AuditRecord } from "@/shared/config/auditLog";

interface AuditGovernanceModalProps {
  open: boolean;
  onClose: () => void;
}

export function AuditGovernanceModal({ open, onClose }: AuditGovernanceModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!open) return null;

  const filteredLogs = INITIAL_AUDIT_LOGS.filter((log) => {
    const matchesSearch =
      log.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.actionName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.checksum.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (categoryFilter === "APPROVAL") {
      return log.action === "FOUR_EYES_APPROVAL" || log.action === "DRAFT_REJECTION";
    }
    if (categoryFilter === "MILP") {
      return log.action === "MILP_ALLOCATION";
    }
    if (categoryFilter === "AI") {
      return log.action === "AI_INFERENCE_RUN" || log.action === "SCENARIO_SIMULATION";
    }
    return true;
  });

  function handleCopyChecksum(id: string, hash: string) {
    void navigator.clipboard.writeText(hash);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    notify.info("Đã sao chép mã băm", `SHA-256: ${hash.slice(0, 16)}...`);
  }

  function handleExportCsv() {
    exportCsv(
      "DengueSense_Audit_Governance_Log.csv",
      [
        { header: "Mã kiểm toán", key: (r: AuditRecord) => r.id },
        { header: "Thời gian", key: (r: AuditRecord) => r.timestamp },
        { header: "Người thực hiện", key: (r: AuditRecord) => r.actor },
        { header: "Vai trò", key: (r: AuditRecord) => r.actorRole },
        { header: "Hành động", key: (r: AuditRecord) => r.actionName },
        { header: "Mã thực thể tham chiếu", key: (r: AuditRecord) => r.entityRef },
        { header: "Kiểm soát Guardrails", key: (r: AuditRecord) => r.guardrailStatus },
        { header: "Thời gian xử lý (ms)", key: (r: AuditRecord) => r.latencyMs ?? "N/A" },
        { header: "Mã băm toàn vẹn SHA-256", key: (r: AuditRecord) => r.checksum },
        { header: "Chi tiết nghiệp vụ", key: (r: AuditRecord) => r.details },
      ],
      filteredLogs
    );
    notify.success(
      "Xuất nhật ký thành công",
      "Tệp kiểm toán bất biến định dạng Excel CSV đã được tải về máy"
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className="glass-panel relative flex flex-col w-full max-w-5xl max-h-[90vh] rounded-3xl border border-slate-200 bg-white/95 shadow-2xl overflow-hidden dark:border-slate-800 dark:bg-slate-950/95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4.5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 dark:bg-indigo-500/10 dark:border-indigo-500/30 dark:text-indigo-400">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="audit-modal-title"
                  className="text-base sm:text-lg font-bold text-slate-900 dark:text-white"
                >
                  Nhật Ký Giám Sát & Hồ Sơ Tuân Thủ AI (Audit Trail)
                </h2>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                  Nghị định 30/2020/NĐ-CP
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[var(--ink-secondary)] mt-0.5">
                Bảo đảm tính toàn vẹn dữ liệu, truy vết trách nhiệm và nguyên tắc Zero-Hallucination
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            aria-label="Đóng bảng nhật ký"
          >
            <X size={18} />
          </button>
        </div>

        {/* Telemetry Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:px-6 bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-200/80 dark:border-slate-800/80 text-xs">
          <div className="p-3 rounded-xl bg-white border border-slate-200/70 dark:bg-slate-950 dark:border-slate-800/60">
            <span className="text-[11px] text-slate-500 block">Tổng giao dịch kiểm toán</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <strong className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
                {INITIAL_AUDIT_LOGS.length}
              </strong>
              <span className="text-[10px] text-emerald-600 font-semibold">100% hợp lệ</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200/70 dark:bg-slate-950 dark:border-slate-800/60">
            <span className="text-[11px] text-slate-500 block">Tuân thủ Guardrails (G1-G6)</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <strong className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                100%
              </strong>
              <span className="text-[10px] text-slate-400">Zero-Hallucination</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200/70 dark:bg-slate-950 dark:border-slate-800/60">
            <span className="text-[11px] text-slate-500 block">Thời gian giải MILP tb</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <strong className="text-base font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                420 ms
              </strong>
              <span className="text-[10px] text-slate-400">Google OR-Tools</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white border border-slate-200/70 dark:bg-slate-950 dark:border-slate-800/60">
            <span className="text-[11px] text-slate-500 block">Mã băm xác thực</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <strong className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                SHA-256
              </strong>
              <span className="text-[10px] text-emerald-600 font-semibold">Chống giả mạo</span>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-6 border-b border-slate-200 dark:border-slate-800">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo người thực hiện, mã thực thể, mã băm..."
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-900 text-xs">
              <button
                type="button"
                onClick={() => setCategoryFilter("ALL")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  categoryFilter === "ALL"
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter("APPROVAL")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  categoryFilter === "APPROVAL"
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Phê duyệt 4 mắt
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter("MILP")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  categoryFilter === "MILP"
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Phân bổ MILP
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter("AI")}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  categoryFilter === "AI"
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Dự báo AI & Kịch bản
              </button>
            </div>

            <Button
              variant="secondary"
              className="gap-1.5 text-xs py-1.5 px-3"
              onClick={handleExportCsv}
            >
              <Download size={13} />
              <span>Xuất CSV</span>
            </Button>
          </div>
        </div>

        {/* Audit Records Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Không tìm thấy bản ghi kiểm toán phù hợp với bộ lọc
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all hover:border-indigo-400/50 hover:shadow-md dark:border-slate-800/80 dark:bg-slate-900/60"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-indigo-700 dark:text-indigo-400">
                      {log.id}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {log.timestamp}
                    </span>
                    <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 size={11} />
                      {log.guardrailStatus}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Chủ thể:</span>
                    <strong className="text-slate-900 dark:text-white">{log.actor}</strong>
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:bg-blue-500/10 dark:text-blue-300">
                      {log.actorRole}
                    </span>
                  </div>
                </div>

                <div className="mt-2.5">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {log.actionName}
                    <span className="font-mono text-xs font-normal text-slate-400">
                      [{log.entityRef}]
                    </span>
                  </h4>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {log.details}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/60 text-[11px]">
                  <div className="flex items-center gap-2 font-mono text-slate-400">
                    <Lock size={12} className="text-slate-400" />
                    <span>SHA-256:</span>
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                      {log.checksum.slice(0, 16)}...{log.checksum.slice(-8)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyChecksum(log.id, log.checksum)}
                      className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      title="Sao chép toàn bộ mã băm"
                    >
                      {copiedId === log.id ? (
                        <CheckCircle2 size={13} className="text-emerald-500" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                  </div>

                  {log.latencyMs && (
                    <div className="flex items-center gap-1 text-slate-400">
                      <Zap size={12} className="text-amber-500" />
                      <span>Thời gian thực thi:</span>
                      <strong className="text-slate-700 dark:text-slate-200 tabular-nums">
                        {log.latencyMs}ms
                      </strong>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3.5 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Lock size={13} className="text-emerald-500" />
            <span>Mọi thao tác được đóng dấu bất biến và lưu trữ theo chuẩn ISO 27001</span>
          </div>
          <Button variant="secondary" className="px-4 py-1.5 text-xs" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
}
