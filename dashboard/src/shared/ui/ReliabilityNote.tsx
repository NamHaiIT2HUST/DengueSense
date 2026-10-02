import type { Reliability, Region } from "@/shared/api";
import { vi } from "@/shared/i18n/vi";

/**
 * Độ tin cậy theo vùng (luật T5, model card §12.4): nêu cả điểm mạnh lẫn giới hạn. Câu chữ theo `note_code` của API.
 * Mức tin cậy luôn có chữ; màu chỉ là phụ.
 */
export function ReliabilityNote({
  region,
  reliability,
}: {
  region: Region;
  reliability: Reliability;
}) {
  const level = vi.reliability.levels[reliability.region_level] ?? reliability.region_level;
  const note = vi.reliability.notes[reliability.note_code] ?? vi.reliability.unknownNote;
  return (
    <div className="rounded-lg bg-[var(--bg-surface-2)] p-3 text-sm">
      <p className="text-[var(--ink-secondary)]">
        {vi.regions[region] ?? region}:{" "}
        <strong className="text-[var(--ink-primary)]">{level}</strong>
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--ink-secondary)]">{note}</p>
    </div>
  );
}
