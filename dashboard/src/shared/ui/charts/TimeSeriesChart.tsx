import { useId } from "react";

import type { DataSource } from "@/shared/api";
import { formatCount, formatMonth } from "@/shared/lib/format";
import { vi } from "@/shared/i18n/vi";

export interface ObservedPoint {
  month: string;
  value: number | null;
  source: DataSource | null;
}
export interface ForecastPoint {
  month: string;
  value: number;
  horizon: number;
}
export interface ThresholdPoint {
  month: string;
  value: number;
}

interface Props {
  ariaLabel: string;
  observed: readonly ObservedPoint[];
  forecast: readonly ForecastPoint[];
  threshold: readonly ThresholdPoint[];
  /** Tháng neo: đường dọc; phần bên phải là "sau tháng neo" (chỉ có khi tái hiện lịch sử). */
  originMonth: string;
  /** Có đánh dấu vùng sau tháng neo là "chỉ để đối chiếu" (chế độ backtest). */
  afterOriginIsComparison?: boolean;
}

const W = 800;
const H = 320;
const M = { l: 56, r: 16, t: 20, b: 40 };

/** "YYYY-MM" → số tháng tuyệt đối (để đặt lên trục tuyến tính). */
function idx(month: string): number {
  const [y, m] = month.split("-");
  return Number(y) * 12 + Number(m) - 1;
}

function niceMax(v: number): number {
  if (v <= 0) return 10;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

/**
 * Biểu đồ chuỗi thời gian tự vẽ bằng SVG (docs/10 §11.2): trục tháng, trục số ca BẮT ĐẦU TỪ 0, phân biệt bằng KIỂU NÉT
 * (không chỉ màu), không vẽ khoảng dự báo (chưa có khoảng đã kiểm chứng — luật T7). Có bảng dữ liệu tương đương.
 * Tự vẽ thay vì thêm thư viện biểu đồ: chỉ cần một dạng biểu đồ và toàn bộ nét/nhãn phải do ta kiểm soát để đúng luật T2/T7.
 */
export function TimeSeriesChart({
  ariaLabel,
  observed,
  forecast,
  threshold,
  originMonth,
  afterOriginIsComparison = false,
}: Props) {
  const uid = useId();
  const months = [
    ...observed.map((o) => o.month),
    ...forecast.map((f) => f.month),
    ...threshold.map((t) => t.month),
  ];
  if (months.length === 0) return null;
  const lo = Math.min(...months.map(idx));
  const hi = Math.max(...months.map(idx));
  const values = [
    ...observed.flatMap((o) => (o.value == null ? [] : [o.value])),
    ...forecast.map((f) => f.value),
    ...threshold.map((t) => t.value),
  ];
  const yMax = niceMax(Math.max(...values, 0) * 1.05);
  const x = (month: string) => M.l + ((idx(month) - lo) / Math.max(1, hi - lo)) * (W - M.l - M.r);
  const y = (v: number) => H - M.b - (v / yMax) * (H - M.t - M.b);

  // Đoạn liền theo nguồn: đổi nguồn (thật ↔ ước lượng) hoặc gặp tháng thiếu thì ngắt nét.
  const segments: { source: DataSource; pts: string[] }[] = [];
  for (const o of observed) {
    if (o.value == null || o.source == null) {
      segments.push({ source: "real", pts: [] });
      continue;
    }
    const last = segments[segments.length - 1];
    if (!last || last.pts.length === 0 || last.source !== o.source) {
      segments.push({ source: o.source, pts: [`${x(o.month)},${y(o.value)}`] });
    } else {
      last.pts.push(`${x(o.month)},${y(o.value)}`);
    }
  }
  const hasEstimated = observed.some((o) => o.source != null && o.source !== "real");

  const sortedForecast = [...forecast].sort((a, b) => idx(a.month) - idx(b.month));
  const originPoint = observed.find((o) => o.month === originMonth && o.value != null);
  const connector = [
    ...(originPoint && originPoint.value != null
      ? [`${x(originMonth)},${y(originPoint.value)}`]
      : []),
    ...sortedForecast.map((f) => `${x(f.month)},${y(f.value)}`),
  ].join(" ");
  const sortedThreshold = [...threshold].sort((a, b) => idx(a.month) - idx(b.month));

  const yTicks = [0, 1, 2, 3, 4].map((i) => (yMax / 4) * i);
  const xTicks: string[] = [];
  for (let i = lo; i <= hi; i++) {
    const m = (i % 12) + 1;
    if (m === 1 || m === 7) xTicks.push(`${Math.floor(i / 12)}-${String(m).padStart(2, "0")}`);
  }

  const clipId = `${uid}-clip`;
  const showOriginLine = idx(originMonth) >= lo && idx(originMonth) <= hi;
  const rows = [
    ...observed
      .filter((o) => o.value != null)
      .map((o) => ({
        month: o.month,
        value: o.value as number,
        kind: "obs" as const,
        source: o.source,
      })),
    ...sortedForecast.map((f) => ({
      month: f.month,
      value: f.value,
      kind: "fc" as const,
      source: null,
    })),
  ];

  return (
    <figure className="min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="h-auto w-full">
        <defs>
          <clipPath id={clipId}>
            <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} />
          </clipPath>
        </defs>

        <text x={4} y={12} textAnchor="start" fontSize="11" fill="var(--ink-muted)">
          {vi.province.chart.yAxis}
        </text>
        {/* lưới ngang + trục y (bắt đầu từ 0) */}
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="var(--border-hairline)" />
            <text x={M.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--ink-muted)">
              {formatCount(t)}
            </text>
          </g>
        ))}
        {xTicks.map((m) => (
          <text
            key={m}
            x={x(m)}
            y={H - M.b + 18}
            textAnchor="middle"
            fontSize="11"
            fill="var(--ink-muted)"
          >
            {formatMonth(m)}
          </text>
        ))}

        {/* vùng sau tháng neo: chỉ để đối chiếu */}
        {afterOriginIsComparison && showOriginLine ? (
          <rect
            x={x(originMonth)}
            y={M.t}
            width={Math.max(0, W - M.r - x(originMonth))}
            height={H - M.t - M.b}
            fill="var(--bg-surface-2)"
            opacity="0.55"
          />
        ) : null}

        <g clipPath={`url(#${clipId})`}>
          {sortedThreshold.length > 0 ? (
            <polyline
              points={sortedThreshold.map((t) => `${x(t.month)},${y(t.value)}`).join(" ")}
              fill="none"
              stroke="var(--ink-secondary)"
              strokeWidth="1.5"
              strokeDasharray="2 4"
            />
          ) : null}
          {segments
            .filter((s) => s.pts.length > 1)
            .map((s, i) => (
              <polyline
                key={i}
                points={s.pts.join(" ")}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeDasharray={s.source === "real" ? undefined : "6 4"}
                strokeLinejoin="round"
              />
            ))}
          {connector && sortedForecast.length > 0 ? (
            <polyline
              points={connector}
              fill="none"
              stroke="var(--ink-primary)"
              strokeWidth="1.5"
              strokeDasharray="7 4"
            />
          ) : null}
        </g>

        {showOriginLine ? (
          <g>
            <line
              x1={x(originMonth)}
              x2={x(originMonth)}
              y1={M.t}
              y2={H - M.b}
              stroke="var(--ink-secondary)"
              strokeWidth="1"
            />
            <text
              x={x(originMonth) - 4}
              y={M.t + 10}
              textAnchor="end"
              fontSize="11"
              fill="var(--ink-secondary)"
            >
              {vi.province.chart.origin} {formatMonth(originMonth)}
            </text>
          </g>
        ) : null}

        {sortedThreshold.map((t) => (
          <line
            key={`t-${t.month}`}
            x1={x(t.month) - 6}
            x2={x(t.month) + 6}
            y1={y(t.value)}
            y2={y(t.value)}
            stroke="var(--ink-secondary)"
            strokeWidth="2"
          />
        ))}
        {sortedForecast.map((f, i) => (
          <g key={`f-${f.horizon}`}>
            <rect
              x={x(f.month) - 5}
              y={y(f.value) - 5}
              width="10"
              height="10"
              transform={`rotate(45 ${x(f.month)} ${y(f.value)})`}
              fill="var(--ink-primary)"
              stroke="var(--bg-page)"
              strokeWidth="1"
            >
              <title>{`${vi.province.chart.forecast} ${formatMonth(f.month)}: ${formatCount(f.value)}`}</title>
            </rect>
            <text
              x={x(f.month)}
              // Nhãn tầm dự báo so le lên xuống: các tháng liền kề (+1, +2, +3) không đè lên nhau.
              y={y(f.value) - 10 - (i % 2) * 11}
              textAnchor="middle"
              fontSize="10"
              fill="var(--ink-secondary)"
            >
              {`+${f.horizon}`}
            </text>
          </g>
        ))}
      </svg>

      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--ink-secondary)]">
        <LegendItem
          sample={<line x1="0" x2="26" y1="6" y2="6" stroke="var(--accent)" strokeWidth="2" />}
        >
          {vi.province.chart.observed}
        </LegendItem>
        {hasEstimated ? (
          <LegendItem
            sample={
              <line
                x1="0"
                x2="26"
                y1="6"
                y2="6"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
            }
          >
            {vi.province.chart.observedEstimated}
          </LegendItem>
        ) : null}
        <LegendItem
          sample={
            <>
              <line
                x1="0"
                x2="26"
                y1="6"
                y2="6"
                stroke="var(--ink-primary)"
                strokeWidth="1.5"
                strokeDasharray="7 4"
              />
              <rect
                x="9"
                y="2"
                width="8"
                height="8"
                transform="rotate(45 13 6)"
                fill="var(--ink-primary)"
              />
            </>
          }
        >
          {vi.province.chart.forecast}
        </LegendItem>
        {threshold.length > 0 ? (
          <LegendItem
            sample={
              <line
                x1="0"
                x2="26"
                y1="6"
                y2="6"
                stroke="var(--ink-secondary)"
                strokeWidth="1.5"
                strokeDasharray="2 4"
              />
            }
          >
            {vi.province.chart.threshold}
          </LegendItem>
        ) : null}
      </figcaption>

      <details className="mt-3 text-xs text-[var(--ink-secondary)]">
        <summary className="cursor-pointer text-[var(--accent)]">
          {vi.province.chart.tableSummary}
        </summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-[var(--border-hairline)]">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-[var(--bg-surface)]">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-medium">
                  {vi.province.chart.month}
                </th>
                <th scope="col" className="px-3 py-1.5 font-medium">
                  {vi.province.chart.kind}
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  {vi.province.chart.cases}
                </th>
                <th scope="col" className="px-3 py-1.5 font-medium">
                  {vi.province.chart.source}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.kind}-${r.month}`}
                  className="border-t border-[var(--border-hairline)]"
                >
                  <td className="px-3 py-1 tabular-nums">{formatMonth(r.month)}</td>
                  <td className="px-3 py-1">
                    {r.kind === "obs"
                      ? vi.province.chart.kindObserved
                      : vi.province.chart.kindForecast}
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums">{formatCount(r.value)}</td>
                  <td className="px-3 py-1">
                    {r.source ? (vi.forecast.dataSource[r.source] ?? r.source) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

function LegendItem({ sample, children }: { sample: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true">
        {sample}
      </svg>
      {children}
    </span>
  );
}
