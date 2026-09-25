import type { ReactNode } from "react";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import clsx from "clsx";
import type { DataSource } from "@/shared/api";

export function DataSourceBadge({ source }: { source: DataSource }) {
  const isReal = source === "real";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        isReal
          ? "bg-[color-mix(in_srgb,var(--status-good)_18%,transparent)] text-[#4ade80]"
          : "bg-[color-mix(in_srgb,var(--status-warning)_18%,transparent)] text-[#fbbf24]"
      )}
      title={
        isReal
          ? "Số đo trực tiếp từ dữ liệu dịch tễ thật"
          : "Ước lượng suy diễn (small-area estimation) từ tổng quốc gia thật — xem docs/01 §2.1c"
      }
    >
      {isReal ? (
        <CheckCircle2 size={12} strokeWidth={2.5} />
      ) : (
        <TriangleAlert size={12} strokeWidth={2.5} />
      )}
      {isReal ? "Dữ liệu thật" : "Ước lượng"}
    </span>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
      {children}
    </div>
  );
}

export function ConceptTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-strong)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-muted)]">
      Minh hoạ khái niệm — chưa nối dữ liệu thật
    </span>
  );
}
