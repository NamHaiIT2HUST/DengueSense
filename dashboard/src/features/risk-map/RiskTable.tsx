import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp } from "lucide-react";

import type { Horizon, LegendClass } from "@/shared/api";
import { formatCount, formatIncidence } from "@/shared/lib/format";
import { classColorVar } from "@/shared/lib/riskClass";
import { vi } from "@/shared/i18n/vi";
import { ProbabilityWithBaseRate } from "@/shared/ui/ProbabilityWithBaseRate";

import type { Row, SortDir, SortKey } from "./model";

interface Props {
  rows: readonly Row[];
  /** Hạng theo chỉ số đang tô màu (không đổi khi đổi cách sắp xếp bảng). */
  ranks: ReadonlyMap<string, number>;
  legend: readonly LegendClass[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  runId: string;
  horizon: Horizon;
  selectedId: string | null;
  onHover: (provinceId: string | null) => void;
}

const COLS: { key: Exclude<SortKey, "rank">; label: string; numeric?: boolean }[] = [
  { key: "province", label: vi.map.columns.province },
  { key: "exceed", label: vi.map.columns.exceed },
  { key: "incidence", label: vi.map.columns.incidence, numeric: true },
  { key: "cases", label: vi.map.columns.cases, numeric: true },
];

/**
 * Bảng xếp hạng: cùng dữ liệu với bản đồ (docs/10 §8.1) — đường truy cập chính cho bàn phím và trình đọc màn hình.
 * Mỗi dòng có: mức của lớp màu bằng CHỮ (không chỉ màu, luật T9), xác suất kèm mức nền (T1), cờ (T6).
 */
export function RiskTable({
  rows,
  ranks,
  legend,
  sortKey,
  sortDir,
  onSort,
  runId,
  horizon,
  selectedId,
  onHover,
}: Props) {
  const ariaSort = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none";

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border-hairline)]">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <caption className="sr-only">{vi.map.tableTitle}</caption>
        <thead className="bg-[var(--bg-surface)] text-xs text-[var(--ink-secondary)]">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium" aria-sort={ariaSort("rank")}>
              <button
                type="button"
                className="inline-flex items-center gap-1 hover:text-[var(--ink-primary)]"
                onClick={() => onSort("rank")}
                aria-label={vi.map.sortBy(vi.map.columns.rank)}
              >
                {vi.map.columns.rank}
                <SortIcon active={sortKey === "rank"} dir="desc" />
              </button>
            </th>
            {COLS.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`px-3 py-2 font-medium ${c.numeric ? "text-right" : ""}`}
                aria-sort={ariaSort(c.key)}
              >
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-[var(--ink-primary)]"
                  onClick={() => onSort(c.key)}
                  aria-label={vi.map.sortBy(c.label)}
                >
                  {c.label}
                  <SortIcon active={sortKey === c.key} dir={sortDir} />
                </button>
              </th>
            ))}
            <th scope="col" className="px-3 py-2 font-medium">
              {vi.map.columns.flags}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const f = r.item.forecast;
            const id = r.item.province_id;
            const cls = r.cls == null ? null : legend[r.cls];
            return (
              <tr
                key={id}
                onMouseEnter={() => onHover(id)}
                onMouseLeave={() => onHover(null)}
                className={`border-t border-[var(--border-hairline)] ${
                  selectedId === id ? "bg-[var(--bg-surface-hover)]" : ""
                }`}
              >
                <td className="px-3 py-2 tabular-nums text-[var(--ink-muted)]">
                  {ranks.get(id) ?? vi.common.notAvailable}
                </td>
                <th scope="row" className="px-3 py-2 font-medium">
                  <Link
                    to="/app/tinh/$provinceId"
                    params={{ provinceId: id }}
                    search={{ run: runId, h: horizon }}
                    className="text-[var(--ink-primary)] underline decoration-dotted underline-offset-2 hover:text-[var(--accent)]"
                    aria-label={vi.map.openProvince(r.item.name)}
                  >
                    {r.item.name}
                  </Link>
                  <div className="text-xs font-normal text-[var(--ink-muted)]">
                    {vi.regions[r.item.region] ?? r.item.region}
                  </div>
                </th>
                <td className="px-3 py-2">
                  {f ? (
                    <div>
                      <ProbabilityWithBaseRate
                        probability={f.exceed_prob}
                        baseRate={f.base_rate}
                        showBar={false}
                      />
                      {cls ? (
                        <div className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-[var(--ink-secondary)]">
                          <span
                            aria-hidden="true"
                            className="inline-block h-2.5 w-2.5 rounded-sm border border-[var(--border-strong)]"
                            style={{ background: `var(${classColorVar(r.cls)})` }}
                          />
                          {cls.label}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-[var(--ink-muted)]">{vi.forecast.noForecast}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {f ? formatIncidence(f.incidence_pred_per_100k) : vi.common.notAvailable}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {f ? formatCount(f.cases_pred) : vi.common.notAvailable}
                </td>
                <td className="px-3 py-2 text-xs">
                  {f && f.flags.length > 0
                    ? f.flags.map((flag) => vi.forecast.flags[flag]?.label ?? flag).join(", ")
                    : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span aria-hidden="true" className="inline-block w-3" />;
  return dir === "asc" ? (
    <ArrowUp size={12} aria-hidden="true" />
  ) : (
    <ArrowDown size={12} aria-hidden="true" />
  );
}
