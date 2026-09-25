import { TriangleAlert } from "lucide-react";

import type { ForecastFlag } from "@/shared/api";
import { vi } from "@/shared/i18n/vi";

/**
 * Cờ của một dự báo (luật T6 và các cờ khác). Cờ luôn có CHỮ (không chỉ màu/biểu tượng). `notes` hiện câu giải thích
 * đầy đủ — dùng ở trang chi tiết; ở bảng chỉ hiện nhãn ngắn.
 */
export function ForecastFlags({
  flags,
  notes = false,
}: {
  flags: readonly ForecastFlag[];
  notes?: boolean;
}) {
  if (flags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label={vi.forecast.flagsLabel}>
      {flags.map((flag) => {
        const text = vi.forecast.flags[flag];
        return (
          <li
            key={flag}
            className="inline-flex max-w-full items-start gap-1.5 rounded-lg border border-[var(--status-warning)] bg-[color-mix(in_srgb,var(--status-warning)_10%,transparent)] px-2 py-1 text-xs text-[#fbd98a]"
          >
            <TriangleAlert
              size={13}
              strokeWidth={2.5}
              aria-hidden="true"
              className="mt-0.5 shrink-0"
            />
            <span>
              <span className="font-semibold">{text?.label ?? flag}</span>
              {notes && text ? <span className="block text-[#f0d9a6]">{text.note}</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
