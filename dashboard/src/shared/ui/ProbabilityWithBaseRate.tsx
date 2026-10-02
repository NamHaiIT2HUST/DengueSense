import clsx from "clsx";

import { formatDecimal, formatProbability } from "@/shared/lib/format";
import { vi } from "@/shared/i18n/vi";

interface Props {
  /** Xác suất vượt ngưỡng ∈ [0,1]. */
  probability: number;
  /** Mức nền — BẮT BUỘC (luật T1): không có cách render xác suất mà thiếu mức nền. */
  baseRate: number;
  size?: "sm" | "lg";
  /** Thanh so sánh minh hoạ; tắt trong bảng dày đặc (chữ vẫn có đủ mức nền). */
  showBar?: boolean;
  className?: string;
}

/**
 * Xác suất vượt ngưỡng LUÔN đi cùng mức nền (luật T1, model card §12.1). Làm tròn phần trăm nguyên (T7). Kèm thanh so
 * sánh (chỉ là hình minh hoạ — thông tin đầy đủ đã có ở dạng chữ, nên thanh ẩn với trình đọc màn hình).
 */
export function ProbabilityWithBaseRate({
  probability,
  baseRate,
  size = "sm",
  showBar = true,
  className,
}: Props) {
  const p = formatProbability(probability);
  const base = formatProbability(baseRate);
  const times = baseRate > 0 ? probability / baseRate : null;
  const pctP = Math.min(100, Math.max(0, probability * 100));
  const pctB = Math.min(100, Math.max(0, baseRate * 100));

  return (
    <div
      role="group"
      aria-label={vi.forecast.baseRate.ariaLabel(p, base)}
      className={clsx("min-w-0", className)}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span
          className={clsx(
            "font-display font-semibold tabular-nums text-[var(--ink-primary)]",
            size === "lg" ? "text-3xl" : "text-lg"
          )}
        >
          {p}
        </span>
        <span className="text-xs text-[var(--ink-secondary)]">
          {vi.forecast.baseRate.label} <strong className="tabular-nums">{base}</strong>
          {times != null ? (
            <span className="text-[var(--ink-muted)]">
              {" · "}
              {vi.forecast.baseRate.ratio(formatDecimal(times, 1))}
            </span>
          ) : null}
        </span>
      </div>
      {showBar ? (
        <div
          aria-hidden="true"
          className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--bg-surface-2)]"
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent)]"
            style={{ width: `${pctP}%` }}
          />
          <div
            className="absolute inset-y-0 w-0.5 bg-[var(--ink-primary)]"
            style={{ left: `${pctB}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
