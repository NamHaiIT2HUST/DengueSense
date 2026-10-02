import type { InputDataSources } from "@/shared/api";
import { formatProbability } from "@/shared/lib/format";
import { vi } from "@/shared/i18n/vi";

const ORDER = ["real", "estimated", "imputed"] as const;
const STYLE: Record<(typeof ORDER)[number], string> = {
  real: "bg-[var(--status-good)]",
  // Hoa văn gạch chéo: dữ liệu không-thật KHÔNG giống dữ liệu thật ngay cả khi mù màu (luật T2)
  estimated:
    "bg-[repeating-linear-gradient(45deg,var(--status-warning)_0_4px,transparent_4px_8px)] outline outline-1 outline-[var(--status-warning)]",
  imputed:
    "bg-[repeating-linear-gradient(-45deg,var(--status-serious)_0_4px,transparent_4px_8px)] outline outline-1 outline-[var(--status-serious)]",
};

/** Tỉ trọng nguồn dữ liệu đầu vào của một dự báo (luật T2): thanh ghép + chữ. Cộng lại ≈ 1. */
export function InputSources({ sources }: { sources: InputDataSources }) {
  const parts = ORDER.filter((k) => sources[k] > 0);
  const summary = ORDER.filter((k) => sources[k] > 0)
    .map((k) => `${formatProbability(sources[k])} ${vi.forecast.inputSources[k]}`)
    .join(" · ");
  return (
    <div>
      <div className="text-xs text-[var(--ink-muted)]">{vi.forecast.inputSources.label}</div>
      <div
        aria-hidden="true"
        className="mt-1 flex h-2 overflow-hidden rounded-full bg-[var(--bg-surface-2)]"
      >
        {parts.map((k) => (
          <div key={k} className={STYLE[k]} style={{ width: `${sources[k] * 100}%` }} />
        ))}
      </div>
      <div className="mt-1 text-xs text-[var(--ink-secondary)]">{summary}</div>
    </div>
  );
}
