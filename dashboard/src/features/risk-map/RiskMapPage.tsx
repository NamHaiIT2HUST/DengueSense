import { Link, useNavigate } from "@tanstack/react-router";
import { Suspense, lazy, useMemo, useState } from "react";

import { useForecastRuns, useGeometry, useRiskMap } from "@/entities/forecast";
import type { Horizon, Region, RiskMap } from "@/shared/api";
import { formatCount, formatHorizon, formatIncidence, formatMonth } from "@/shared/lib/format";
import { classColorVar } from "@/shared/lib/riskClass";
import { vi } from "@/shared/i18n/vi";
import { Alert } from "@/shared/ui/Alert";
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

  const map = riskMap.data;
  const rows = useMemo(
    () => (map ? buildRows(map, search.metric, search.region) : []),
    [map, search.metric, search.region]
  );
  const ranks = useMemo(() => {
    // Hạng theo chỉ số đang tô màu (độc lập với cách sắp xếp bảng); tỉnh không có dự báo không có hạng.
    const ranked = sortRows(rows, "rank", "desc").filter((r) => r.value !== null);
    return new Map(ranked.map((r, i) => [r.item.province_id, i + 1] as const));
  }, [rows]);
  const sorted = useMemo(() => sortRows(rows, sort.key, sort.dir), [rows, sort]);

  const completedRuns = (runs.data?.items ?? []).filter((r) => r.status === "completed");
  const selectedRunId = search.run ?? map?.meta.run_id ?? "";
  const hovered = hoveredId ? (map?.items.find((i) => i.province_id === hoveredId) ?? null) : null;

  const onSort = (key: SortKey) =>
    setSort((s) => ({
      key,
      // Bấm lại cột đang chọn thì đảo chiều; cột mới: tên tăng dần, số giảm dần.
      dir: s.key === key ? (s.dir === "asc" ? "desc" : "asc") : key === "province" ? "asc" : "desc",
    }));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-3xl font-semibold">{vi.map.title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--ink-secondary)]">{vi.map.lead}</p>
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
        <Segmented
          legend={vi.map.controls.horizon}
          value={search.h}
          onChange={(h) => onSearchChange({ h })}
          options={HORIZONS.map((h) => ({ value: h, label: `${h} tháng` }))}
        />
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
                    styleKey={`${map.meta.run_id}|${map.horizon}|${search.metric}|${search.region ?? "all"}`}
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

          <Legend map={map} metric={search.metric} />

          <section aria-labelledby="risk-table-title" className="space-y-2">
            <h2 id="risk-table-title" className="text-lg font-semibold">
              {vi.map.tableTitle}
              <span className="ml-2 text-sm font-normal text-[var(--ink-secondary)]">
                {formatHorizon(map.meta.origin_month, map.horizon)}
              </span>
            </h2>
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

function Legend({ map, metric }: { map: RiskMap; metric: Metric }) {
  const legend = legendFor(map, metric);
  return (
    <section aria-label={vi.map.legendTitle[metric]} className="glass-panel rounded-2xl p-4">
      <h2 className="text-sm font-semibold">{vi.map.legendTitle[metric]}</h2>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--ink-secondary)]">
        {legend.map((c, i) => (
          <li key={c.label} className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-3.5 w-6 rounded-sm border border-[var(--border-strong)]"
              style={{ background: `var(${classColorVar(i)})` }}
            />
            {c.label}
          </li>
        ))}
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
