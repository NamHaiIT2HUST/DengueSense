import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Check, Pencil, X } from "lucide-react";
import { ConceptTag } from "./Badge";
import type { ProvinceRisk } from "../lib/types";

type Decision = null | "accepted" | "denied";

export function DispatchPreview({ top }: { top?: ProvinceRisk }) {
  const [decision, setDecision] = useState<Decision>(null);
  const name = top?.name ?? "Hồ Chí Minh";
  const score = top?.risk_score.toFixed(0) ?? "—";

  return (
    <div className="glass-panel rounded-2xl p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display flex items-center gap-2 text-xl font-semibold">
            <Sparkles size={18} className="text-[var(--accent)]" />
            Layer 3 — Dự thảo điều phối bằng GenAI
          </h3>
          <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-[var(--ink-secondary)]">
            Ví dụ minh hoạ định dạng đầu ra cho luồng B2G. Số liệu điền vào mẫu
            luôn lấy từ Layer 1/2 (không để LLM tự sinh số) — xem guardrail ở
            docs/05.
          </p>
        </div>
        <ConceptTag />
      </div>

      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-2)] p-5 font-mono text-[13px] leading-relaxed text-[var(--ink-secondary)]">
        <div className="mb-3 flex items-center justify-between border-b border-[var(--border-hairline)] pb-3 text-[11px] uppercase tracking-wide text-[var(--ink-muted)]">
          <span>Dự thảo · Luồng B2G</span>
          <span>Căn cứ QĐ 02/2016/QĐ-TTg · Hướng dẫn HCDC</span>
        </div>
        <p className="text-[var(--ink-primary)]">
          Kính gửi: Trung tâm Kiểm soát bệnh tật {name}
        </p>
        <p className="mt-3">
          Căn cứ dữ liệu giám sát dịch tễ và kết quả mô hình dự báo, khu vực{" "}
          <b className="text-[var(--ink-primary)]">{name}</b> hiện có điểm rủi
          ro <b className="text-[var(--ink-primary)]">{score}/100</b>, thuộc
          nhóm cần theo dõi ưu tiên trong 30 ngày tới.
        </p>
        <p className="mt-3">
          Đề nghị: (1) tăng cường giám sát ổ dịch tại khu vực dân cư mật độ
          cao; (2) chuẩn bị vật tư phun hoá chất theo phương án phân bổ đính
          kèm; (3) đẩy mạnh truyền thông diệt lăng quăng tới hộ dân.
        </p>
        <p className="mt-3 text-[var(--ink-muted)]">
          [CẦN CÁN BỘ BỔ SUNG]: đơn vị đầu mối tiếp nhận vật tư, thời hạn báo
          cáo kết quả triển khai.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[12px] text-[var(--ink-muted)]">
          Cơ chế human-in-the-loop — không có đường nào ban hành mà không qua
          duyệt
        </span>

        <AnimatePresence mode="wait">
          {decision ? (
            <motion.span
              key={decision}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium " +
                (decision === "accepted"
                  ? "bg-[color-mix(in_srgb,var(--status-good)_18%,transparent)] text-[#4ade80]"
                  : "bg-[color-mix(in_srgb,var(--status-critical)_18%,transparent)] text-[#f87171]")
              }
            >
              {decision === "accepted" ? <Check size={14} /> : <X size={14} />}
              {decision === "accepted" ? "Đã duyệt (minh hoạ)" : "Đã từ chối (minh hoạ)"}
            </motion.span>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setDecision("accepted")}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white transition-transform hover:scale-[1.03] active:scale-[0.98]"
              >
                <Check size={14} /> Duyệt
              </button>
              <button className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-4 py-2 text-[13px] font-medium text-[var(--ink-secondary)] transition-colors hover:text-[var(--ink-primary)]">
                <Pencil size={14} /> Sửa
              </button>
              <button
                onClick={() => setDecision("denied")}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-4 py-2 text-[13px] font-medium text-[var(--ink-secondary)] transition-colors hover:text-[var(--ink-primary)]"
              >
                <X size={14} /> Từ chối
              </button>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
