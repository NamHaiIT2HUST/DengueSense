import { Link, useNavigate } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Download, Pause, Play, RotateCcw, Scale, Target } from "lucide-react";

import { useForecastRuns, useGeometry, useRiskMap } from "@/entities/forecast";
import type { Horizon, Region, RiskMap } from "@/shared/api";
import { exportToCsv } from "@/shared/lib/exportCsv";
import { formatCount, formatHorizon, formatIncidence, formatMonth } from "@/shared/lib/format";
import { classColorVar } from "@/shared/lib/riskClass";
import { vi } from "@/shared/i18n/vi";
import { Alert } from "@/shared/ui/Alert";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ForecastFlags } from "@/shared/ui/ForecastFlags";
import { ProbabilityWithBaseRate } from "@/shared/ui/ProbabilityWithBaseRate";
import { ProvenanceBar } from "@/shared/ui/ProvenanceBar";
import { Segmented } from "@/shared/ui/Segmented";
import { Select } from "@/shared/ui/Select";
import { Skeleton } from "@/shared/ui/Skeleton";

import { buildRows, legendFor, sortRows, type Metric, type SortDir, type SortKey } from "./model";
import { RiskTable } from "./RiskTable";

// Leaflet chỉ tải khi cần (cùng chunk với bản đồ trang giới thiệu).
const RiskMapCanvas = lazy(() => import("./RiskMapCanvas"));

export interface RiskMapSearch {
  run?: string | undefined;
  h: Horizon;
  metric: Metric;
  region?: Region | undefined;
}

const HORIZONS: readonly Horizon[] = [1, 2, 3, 6];
const REGIONS: readonly Region[] = ["Bắc", "Trung", "Nam"];

export function RiskMapPage({
  search,
  onSearchChange,
}: {
  search: RiskMapSearch;
  onSearchChange: (patch: Partial<RiskMapSearch>) => void;
}) {
  const runs = useForecastRuns();
  const riskMap = useRiskMap(search.run, search.h);
  const geometry = useGeometry();
  const navigate = useNavigate();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "rank", dir: "desc" });
  const [isPlaying, setIsPlaying] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<number | "all">("all");

  // Playback timer cycling through horizons [1, 2, 3, 6]
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const idx = HORIZONS.indexOf(search.h);
      const nextIdx = (idx + 1) % HORIZONS.length;
      const nextH = HORIZONS[nextIdx];
      if (nextH !== undefined) {
        onSearchChange({ h: nextH });
      }
    }, 2400);
    return () => clearInterval(interval);
  }, [isPlaying, search.h, onSearchChange]);

  const map = riskMap.data;
  const baseRows = useMemo(
    () => (map ? buildRows(map, search.metric, search.region) : []),
    [map, search.metric, search.region]
  );

  // Apply severity filter if chosen
  const rows = useMemo(() => {
    if (severityFilter === "all") return baseRows;
    return baseRows.filter((r) => r.cls === severityFilter);
  }, [baseRows, severityFilter]);

  const ranks = useMemo(() => {
    // Hạng theo chỉ số đang tô màu (độc lập với cách sắp xếp bảng); tỉnh không có dự báo không có hạng.
    const ranked = sortRows(rows, "rank", "desc").filter((r) => r.value !== null);
    return new Map(ranked.map((r, i) => [r.item.province_id, i + 1] as const));
  }, [rows]);
  const sorted = useMemo(() => sortRows(rows, sort.key, sort.dir), [rows, sort]);

  // Threat overview statistics
  const threatStats = useMemo(() => {
    if (!map) return { redCount: 0, amberCount: 0, totalCases: 0 };
    let redCount = 0;
    let amberCount = 0;
    let totalCases = 0;
    for (const it of map.items) {
      if (it.forecast) {
        totalCases += Math.round(it.forecast.cases_pred);
        if (it.forecast.exceed_prob >= 0.75) redCount++;
        else if (it.forecast.exceed_prob >= 0.5) amberCount++;
      }
    }
    return { redCount, amberCount, totalCases };
  }, [map]);

  const completedRuns = (runs.data?.items ?? []).filter((r) => r.status === "completed");
  const selectedRunId = search.run ?? map?.meta.run_id ?? "";
  const hovered = hoveredId ? (map?.items.find((i) => i.province_id === hoveredId) ?? null) : null;

  const onSort = (key: SortKey) =>
    setSort((s) => ({
      key,
      // Bấm lại cột đang chọn thì đảo chiều; cột mới: tên tăng dần, số giảm dần.
      dir: s.key === key ? (s.dir === "asc" ? "desc" : "asc") : key === "province" ? "asc" : "desc",
    }));

  function handleExportCsv() {
    if (!map) return;
    const filename = `DengueSense_Du_Bao_${map.meta.origin_month}_Tam_${search.h}T`;
    exportToCsv(
      filename,
      [
        { header: "Mã tỉnh", key: (r) => r.item.province_id },
        { header: "Tỉnh / Thành phố", key: (r) => r.item.name },
        { header: "Vùng", key: (r) => r.item.region },
        { header: "Tầm dự báo (tháng)", key: () => search.h },
        {
          header: "Xác suất vượt ngưỡng (%)",
          key: (r) => (r.item.forecast ? Math.round(r.item.forecast.exceed_prob * 100) : "N/A"),
        },
        {
          header: "Mức nền (%)",
          key: (r) => (r.item.forecast ? Math.round(r.item.forecast.base_rate * 100) : "N/A"),
        },
        {
          header: "Tỉ suất ca / 100k dân",
          key: (r) =>
            r.item.forecast ? r.item.forecast.incidence_pred_per_100k.toFixed(1) : "N/A",
        },
        {
          header: "Số ca dự báo",
          key: (r) => (r.item.forecast ? Math.round(r.item.forecast.cases_pred) : "N/A"),
        },
        {
          header: "Ngưỡng cảnh báo P75",
          key: (r) => (r.item.forecast ? Math.round(r.item.forecast.threshold_p75) : "N/A"),
        },
        {
          header: "Cờ ghi chú",
          key: (r) => r.item.forecast?.flags?.join("; ") || "Bình thường",
        },
      ],
      sorted
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">{vi.map.title}</h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--ink-secondary)]">{vi.map.lead}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="gap-1.5 text-xs py-1.5 border-red-500/30 text-red-700 dark:text-red-300 hover:bg-red-500/10"
            onClick={() => window.dispatchEvent(new CustomEvent("open-tactical-scenarios"))}
          >
            <Target size={14} className="text-red-600 dark:text-red-400" />
            Diễn tập Mẫu
          </Button>
          <Button
            variant="secondary"
            className="gap-1.5 text-xs py-1.5 border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/10"
            onClick={() => window.dispatchEvent(new CustomEvent("open-scenario-comparison"))}
          >
            <Scale size={14} className="text-indigo-600 dark:text-indigo-400" />
            Độ nhạy & So sánh A/B
          </Button>
        </div>
      </header>

      <Card className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <Select
          className="min-w-[17rem]"
          label={vi.map.controls.run}
          value={selectedRunId}
          onChange={(run) => onSearchChange({ run })}
          disabled={completedRuns.length === 0}
          options={
            completedRuns.length === 0
              ? [{ value: selectedRunId, label: map ? formatMonth(map.meta.origin_month) : "…" }]
              : completedRuns.map((r) => ({
                  value: r.run_id,
                  label: `${vi.forecast.provenance.origin} ${formatMonth(r.origin_month)} · ${vi.forecast.modes[r.run_mode] ?? r.run_mode}`,
                }))
          }
        />
        <div className="flex items-end gap-2">
          <Segmented
            legend={vi.map.controls.horizon}
            value={search.h}
            onChange={(h) => onSearchChange({ h })}
            options={HORIZONS.map((h) => ({ value: h, label: `${h} tháng` }))}
          />
          <Button
            variant="secondary"
            className="px-3 py-1.5 text-xs gap-1.5 h-[38px]"
            onClick={() => setIsPlaying((p) => !p)}
            title="Tự động phát tiến trình dịch bệnh qua các tầm dự báo 1-2-3-6 tháng"
          >
            {isPlaying ? (
              <>
                <Pause size={13} className="text-amber-500 animate-pulse" />
                <span>Tạm dừng</span>
              </>
            ) : (
              <>
                <Play size={13} className="text-emerald-500" />
                <span>Phát (1T → 6T)</span>
              </>
            )}
          </Button>
        </div>
        <Segmented
          legend={vi.map.controls.metric}
          value={search.metric}
          onChange={(metric) => onSearchChange({ metric })}
          options={[
            { value: "exceed_prob", label: vi.map.metrics.exceed_prob },
            { value: "incidence", label: vi.map.metrics.incidence },
          ]}
        />
        <Select
          className="min-w-[10rem]"
          label={vi.map.controls.region}
          value={search.region ?? ""}
          onChange={(v) => onSearchChange({ region: v === "" ? undefined : (v as Region) })}
          options={[
            { value: "", label: vi.map.controls.allRegions },
            ...REGIONS.map((r) => ({ value: r, label: vi.regions[r] ?? r })),
          ]}
        />
      </Card>

      {riskMap.isPending ? (
        <MapSkeleton />
      ) : riskMap.isError ? (
        <ErrorState error={riskMap.error} onRetry={() => void riskMap.refetch()} />
      ) : map ? (
        <div aria-busy={riskMap.isPlaceholderData || undefined} className="space-y-5">
          <ProvenanceBar meta={map.meta} />
          {map.warnings.length > 0 ? (
            <Alert tone="warning">
              <p className="font-medium">{vi.map.warnings}</p>
              <ul className="mt-1 list-disc pl-5">
                {map.warnings.map((w) => (
                  <li key={w.code}>{w.message}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          {/* Tactical Outbreak Overview Stats */}
          <div className="grid gap-3 sm:grid-cols-4 text-xs">
            <div className="glass-panel p-3.5 rounded-xl flex items-center justify-between border border-red-500/20 bg-red-500/5">
              <div>
                <span className="text-[11px] text-[var(--ink-muted)] block">
                  Ổ dịch Báo động Đỏ
                </span>
                <strong className="text-base font-bold text-red-700 dark:text-red-300 tabular-nums">
                  {threatStats.redCount} tỉnh
                </strong>
              </div>
              <span className="rounded-md bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-800 dark:text-red-300">
                P ≥ 75%
              </span>
            </div>

            <div className="glass-panel p-3.5 rounded-xl flex items-center justify-between border border-amber-500/20 bg-amber-500/5">
              <div>
                <span className="text-[11px] text-[var(--ink-muted)] block">
                  Khu vực Nguy cơ Cảnh báo
                </span>
                <strong className="text-base font-bold text-amber-800 dark:text-amber-300 tabular-nums">
                  {threatStats.amberCount} tỉnh
                </strong>
              </div>
              <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                P 50 - 75%
              </span>
            </div>

            <div className="glass-panel p-3.5 rounded-xl flex items-center justify-between border border-blue-500/20 bg-blue-500/5">
              <div>
                <span className="text-[11px] text-[var(--ink-muted)] block">
                  Tổng ca dự báo toàn quốc
                </span>
                <strong className="text-base font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                  ≈ {formatCount(threatStats.totalCases)} ca
                </strong>
              </div>
              <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:text-blue-300">
                Tầm {search.h}T
              </span>
            </div>

            <div className="glass-panel p-3.5 rounded-xl flex items-center justify-between border border-emerald-500/20 bg-emerald-500/5">
              <div>
                <span className="text-[11px] text-[var(--ink-muted)] block">
                  Tháng mục tiêu can thiệp
                </span>
                <strong className="text-base font-bold text-emerald-800 dark:text-emerald-300">
                  {formatMonth(map.meta.origin_month)} (+{search.h}T)
                </strong>
              </div>
              <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                Chuẩn hóa
              </span>
            </div>
          </div>

          <div
            className={`grid gap-5 lg:grid-cols-[1fr_320px] ${riskMap.isPlaceholderData ? "opacity-70" : ""}`}
          >
            <div className="glass-panel relative h-[520px] overflow-hidden rounded-2xl">
              {geometry.isError ? (
                <div className="p-4">
                  <ErrorState error={geometry.error} onRetry={() => void geometry.refetch()} />
                </div>
              ) : geometry.data ? (
                <Suspense fallback={<Skeleton className="h-full w-full" />}>
                  <RiskMapCanvas
                    geometry={geometry.data}
                    rows={rows}
                    styleKey={`${map.meta.run_id}|${map.horizon}|${search.metric}|${search.region ?? "all"}|${severityFilter}`}
                    selectedId={hoveredId}
                    onHover={setHoveredId}
                    onOpen={(id) =>
                      void navigate({
                        to: "/app/tinh/$provinceId",
                        params: { provinceId: id },
                        search: { run: map.meta.run_id, h: search.h },
                      })
                    }
                  />
                </Suspense>
              ) : (
                <Skeleton className="h-full w-full" />
              )}
            </div>

            <HoverPanel item={hovered} map={map} runId={map.meta.run_id} horizon={search.h} />
          </div>

          <Legend
            map={map}
            metric={search.metric}
            activeFilter={severityFilter}
            onSelectFilter={setSeverityFilter}
          />

          <section aria-labelledby="risk-table-title" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="risk-table-title" className="text-lg font-semibold">
                {vi.map.tableTitle}
                <span className="ml-2 text-sm font-normal text-[var(--ink-secondary)]">
                  {formatHorizon(map.meta.origin_month, map.horizon)}
                </span>
              </h2>
              <Button
                variant="secondary"
                className="px-3 py-1.5 text-xs gap-1.5"
                onClick={handleExportCsv}
                title="Tải bảng dữ liệu dự báo định dạng CSV hỗ trợ mở trực tiếp bằng Microsoft Excel"
              >
                <Download size={14} />
                Xuất CSV (Excel)
              </Button>
            </div>
            <RiskTable
              rows={sorted}
              ranks={ranks}
              legend={legendFor(map, search.metric)}
              sortKey={sort.key}
              sortDir={sort.dir}
              onSort={onSort}
              runId={map.meta.run_id}
              horizon={search.h}
              selectedId={hoveredId}
              onHover={setHoveredId}
            />
          </section>
        </div>
      ) : null}
    </div>
  );
}

function MapSkeleton() {
  return (
    <div role="status" aria-label={vi.common.loading} className="space-y-4">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-[520px] w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function Legend({
  map,
  metric,
  activeFilter,
  onSelectFilter,
}: {
  map: RiskMap;
  metric: Metric;
  activeFilter: number | "all";
  onSelectFilter: (filter: number | "all") => void;
}) {
  const legend = legendFor(map, metric);
  return (
    <section aria-label={vi.map.legendTitle[metric]} className="glass-panel rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{vi.map.legendTitle[metric]}</h2>
        {activeFilter !== "all" && (
          <button
            type="button"
            onClick={() => onSelectFilter("all")}
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
          >
            <RotateCcw size={12} />
            <span>Hiện tất cả 34 tỉnh</span>
          </button>
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--ink-secondary)]">
        {legend.map((c, i) => {
          const isSelected = activeFilter === i;
          return (
            <li key={c.label}>
              <button
                type="button"
                onClick={() => onSelectFilter(isSelected ? "all" : i)}
                className={`inline-flex items-center gap-2 rounded-md px-1.5 py-0.5 transition-all text-sm ${
                  isSelected
                    ? "ring-2 ring-indigo-500 font-bold text-[var(--ink-primary)] bg-indigo-50 dark:bg-indigo-950/40"
                    : "hover:text-[var(--ink-primary)]"
                }`}
                title={`Bấm để lọc hiển thị riêng mức ${c.label}`}
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-3.5 w-6 rounded-sm border border-[var(--border-strong)]"
                  style={{ background: `var(${classColorVar(i)})` }}
                />
                {c.label}
              </button>
            </li>
          );
        })}
        <li className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-3.5 w-6 rounded-sm border border-[var(--border-strong)]"
            style={{ background: "var(--risk-class-none)" }}
          />
          {vi.map.noForecastColor}
        </li>
        <li className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-3.5 w-6 rounded-sm border border-dashed border-[var(--ink-secondary)]"
          />
          {vi.map.estimatedOutline}
        </li>
      </ul>
      <p className="mt-2 text-xs text-[var(--ink-muted)]">{vi.map.legendNote}</p>
    </section>
  );
}

function HoverPanel({
  item,
  map,
  runId,
  horizon,
}: {
  item: RiskMap["items"][number] | null;
  map: RiskMap;
  runId: string;
  horizon: Horizon;
}) {
  const f = item?.forecast ?? null;
  return (
    <aside
      aria-label="Chi tiết tỉnh đang chọn"
      className="glass-panel flex min-h-[220px] flex-col rounded-2xl p-5 lg:h-[520px]"
    >
      {item ? (
        <div className="space-y-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
              {vi.regions[item.region] ?? item.region}
            </div>
            <h3 className="font-display mt-1 text-xl font-semibold">{item.name}</h3>
          </div>
          {f ? (
            <>
              <ProbabilityWithBaseRate
                probability={f.exceed_prob}
                baseRate={f.base_rate}
                size="lg"
              />
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-[var(--ink-muted)]">{vi.forecast.casesPred}</dt>
                  <dd className="font-display text-xl font-semibold tabular-nums">
                    {formatCount(f.cases_pred)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--ink-muted)]">{vi.forecast.incidencePred}</dt>
                  <dd className="tabular-nums">
                    {formatIncidence(f.incidence_pred_per_100k)}{" "}
                    <span className="text-xs text-[var(--ink-muted)]">{vi.forecast.per100k}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--ink-muted)]">{vi.forecast.threshold}</dt>
                  <dd className="tabular-nums">{formatCount(f.threshold_p75)}</dd>
                </div>
              </dl>
              <ForecastFlags flags={f.flags} />
            </>
          ) : (
            <p className="text-sm text-[var(--ink-secondary)]">{vi.forecast.noForecast}</p>
          )}
          <Link
            to="/app/tinh/$provinceId"
            params={{ provinceId: item.province_id }}
            search={{ run: runId, h: horizon }}
            className="inline-block text-sm text-[var(--accent)] underline hover:text-[var(--accent-ink)]"
          >
            {vi.map.openProvince(item.name)}
          </Link>
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <div className="mb-3 h-10 w-10 rounded-full border-2 border-dashed border-[var(--border-strong)]" />
          <p className="text-sm text-[var(--ink-muted)]">{vi.map.hoverHint}</p>
          <p className="mt-2 text-xs text-[var(--ink-muted)]">
            {formatHorizon(map.meta.origin_month, map.horizon)}
          </p>
        </div>
      )}
    </aside>
  );
}
