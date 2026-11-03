import { useEffect, useId, useRef, useState } from "react";

import type { DataSource } from "@/shared/api";
import { formatCount, formatMonth } from "@/shared/lib/format";
import { vi } from "@/shared/i18n/vi";
import { Button } from "@/shared/ui/Button";

import { forecastLabels, monthAt, monthIndex as idx, timeTicks } from "./timeSeriesLayout";

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

const H = 360;

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
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [scope, setScope] = useState<"focus" | "all">("focus");
  const hasData = observed.length + forecast.length + threshold.length > 0;
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const measure = () => {
      const measured = element.getBoundingClientRect().width;
      if (measured > 0) setWidth(Math.max(200, Math.round(measured)));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasData]);

  if (!hasData) return null;

  const months = [
    ...observed.map((o) => o.month),
    ...forecast.map((f) => f.month),
    ...threshold.map((t) => t.month),
  ];
  const allLo = Math.min(...months.map(idx));
  const allHi = Math.max(...months.map(idx));
  const focusLo = Math.max(allLo, idx(originMonth) - 23);
  const focusHi = Math.min(
    allHi,
    Math.max(idx(originMonth) + 6, ...forecast.map((f) => idx(f.month)))
  );
  const focused = scope === "focus" && focusLo <= focusHi;
  const lo = focused ? focusLo : allLo;
  const hi = focused ? focusHi : allHi;
  const inRange = (point: { month: string }) => idx(point.month) >= lo && idx(point.month) <= hi;
  const visibleObserved = observed.filter(inRange);
  const sortedForecast = forecast.filter(inRange).sort((a, b) => idx(a.month) - idx(b.month));
  const sortedThreshold = threshold.filter(inRange).sort((a, b) => idx(a.month) - idx(b.month));
  const values = [
    ...visibleObserved.flatMap((o) => (o.value == null ? [] : [o.value])),
    ...sortedForecast.map((f) => f.value),
    ...sortedThreshold.map((t) => t.value),
  ];
  const yMax = niceMax(Math.max(...values, 0) * 1.05);
  const W = width;
  const M = { l: Math.max(56, formatCount(yMax).length * 8 + 16), r: 16, t: 56, b: 48 };
  // Inset points so diamonds at the first/last month stay wholly inside the plot.
  const plotWidth = W - M.l - M.r - 20;
  const x = (month: string) => M.l + 10 + ((idx(month) - lo) / Math.max(1, hi - lo)) * plotWidth;
  const y = (v: number) => H - M.b - (v / yMax) * (H - M.t - M.b);

  // Đoạn liền theo nguồn: đổi nguồn (thật ↔ ước lượng) hoặc gặp tháng thiếu thì ngắt nét.
  const segments: { source: DataSource; pts: string[] }[] = [];
  for (const o of visibleObserved) {
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
  const hasEstimated = visibleObserved.some((o) => o.source != null && o.source !== "real");

  const originPoint = observed.find((o) => o.month === originMonth && o.value != null);
  const connector = [
    ...(originPoint && originPoint.value != null
      ? [`${x(originMonth)},${y(originPoint.value)}`]
      : []),
    ...sortedForecast.map((f) => `${x(f.month)},${y(f.value)}`),
  ].join(" ");
  const yTicks = [0, 1, 2, 3, 4].map((i) => (yMax / 4) * i);
  const xTicks = timeTicks(lo, hi, plotWidth);
  const labels = forecastLabels(
    sortedForecast.map((f) => ({ x: x(f.month), y: y(f.value) })),
    { left: M.l, right: W - M.r, top: M.t, bottom: H - M.b }
  );

  const clipId = `${uid}-clip`;
  const showOriginLine = idx(originMonth) >= lo && idx(originMonth) <= hi;
  const rows = [
    ...observed.map((o) => ({
      month: o.month,
      value: o.value,
      kind: "obs" as const,
      source: o.source,
    })),
    ...forecast.map((f) => ({
      month: f.month,
      value: f.value,
      kind: "fc" as const,
      source: null,
    })),
  ].sort((a, b) => a.month.localeCompare(b.month) || (a.kind === "obs" ? -1 : 1));

  return (
    <figure className="min-w-0">
      <div role="group" aria-label={vi.province.chart.range} className="mb-3 flex flex-wrap gap-2">
        <Button
          variant={scope === "focus" ? "primary" : "secondary"}
          aria-pressed={scope === "focus"}
          onClick={() => setScope("focus")}
        >
          {vi.province.chart.focus}
        </Button>
        <Button
          variant={scope === "all" ? "primary" : "secondary"}
          aria-pressed={scope === "all"}
          onClick={() => setScope("all")}
        >
          {vi.province.chart.all}
        </Button>
      </div>
      <p className="mb-2 text-xs text-[var(--ink-secondary)]" aria-live="polite">
        {vi.province.chart.visibleRange(formatMonth(monthAt(lo)), formatMonth(monthAt(hi)))}
      </p>
      <div ref={container} className="min-w-0">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={ariaLabel}
          className="block h-auto w-full"
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} />
            </clipPath>
          </defs>

          <text x={4} y={16} textAnchor="start" fontSize="12" fill="var(--ink-muted)">
            {vi.province.chart.yAxis}
          </text>
          {/* lưới ngang + trục y (bắt đầu từ 0) */}
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="var(--border-hairline)" />
              <text x={M.l - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--ink-muted)">
                {formatCount(t)}
              </text>
            </g>
          ))}
          <g data-chart-axis="time">
            {xTicks.map((m, i) => (
              <g key={m}>
                <line
                  x1={x(m)}
                  x2={x(m)}
                  y1={H - M.b}
                  y2={H - M.b + 6}
                  stroke="var(--border-strong)"
                />
                <text
                  data-month={m}
                  x={x(m)}
                  y={H - M.b + 26}
                  textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
                  fontSize="12"
                  fill="var(--ink-muted)"
                >
                  {formatMonth(m)}
                </text>
              </g>
            ))}
          </g>

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
                x={
                  x(originMonth) - M.l >= 170
                    ? x(originMonth) - 6
                    : Math.min(x(originMonth) + 6, W - M.r - 170)
                }
                y={M.t - 16}
                textAnchor={x(originMonth) - M.l >= 170 ? "end" : "start"}
                fontSize="12"
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
            <g key={`f-${f.horizon}`} data-forecast-horizon={f.horizon}>
              <line
                x1={x(f.month)}
                y1={y(f.value)}
                x2={labels[i]!.x}
                y2={labels[i]!.y}
                stroke="var(--ink-secondary)"
                strokeWidth="1"
              />
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
              <rect
                x={labels[i]!.x - 16}
                y={labels[i]!.y - 10}
                width="32"
                height="20"
                rx="5"
                fill="var(--bg-surface)"
                stroke="var(--border-hairline)"
              />
              <text
                x={labels[i]!.x}
                y={labels[i]!.y + 4}
                textAnchor="middle"
                fontSize="12"
                fill="var(--ink-primary)"
              >
                {`+${f.horizon}`}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p className="text-xs text-[var(--ink-muted)]">{vi.province.chart.timelineHint}</p>

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
