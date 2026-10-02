import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowLeft, ArrowUp } from "lucide-react";
import { useMemo } from "react";

import {
  useExplanation,
  useObservations,
  useProvinceForecasts,
  useProvinces,
} from "@/entities/forecast";
import {
  ApiError,
  type ExplanationFactor,
  type ForecastItem,
  type Horizon,
  type Observation,
} from "@/shared/api";
import {
  addMonths,
  formatCount,
  formatDecimal,
  formatHorizon,
  formatIncidence,
  formatPercent,
} from "@/shared/lib/format";
import { vi } from "@/shared/i18n/vi";
import { Card } from "@/shared/ui/Card";
import { TimeSeriesChart } from "@/shared/ui/charts/TimeSeriesChart";
import { ErrorState } from "@/shared/ui/ErrorState";
import { ForecastFlags } from "@/shared/ui/ForecastFlags";
import { InputSources } from "@/shared/ui/InputSources";
import { ProbabilityWithBaseRate } from "@/shared/ui/ProbabilityWithBaseRate";
import { ProvenanceBar } from "@/shared/ui/ProvenanceBar";
import { ReliabilityNote } from "@/shared/ui/ReliabilityNote";
import { Skeleton } from "@/shared/ui/Skeleton";

import { contributionToPercent, fillMonths } from "./model";

export interface ProvinceSearch {
  run?: string | undefined;
  h: Horizon;
}

const HORIZONS: readonly Horizon[] = [1, 2, 3, 6];

export function ProvinceDetailPage({
  provinceId,
  search,
  onSearchChange,
}: {
  provinceId: string;
  search: ProvinceSearch;
  onSearchChange: (patch: Partial<ProvinceSearch>) => void;
}) {
  const provinces = useProvinces();
  const forecasts = useProvinceForecasts(provinceId, search.run);
  const observations = useObservations(provinceId);
  const explanation = useExplanation(provinceId, search.run, search.h);

  const name = provinces.data?.items.find((p) => p.province_id === provinceId)?.name ?? provinceId;
  const back = (
    <Link
      to="/app/ban-do"
      search={{ ...(search.run ? { run: search.run } : {}), h: search.h }}
      className="inline-flex items-center gap-1 text-sm text-[var(--accent)] underline hover:text-[var(--accent-ink)]"
    >
      <ArrowLeft size={14} aria-hidden="true" />
      {vi.province.back}
    </Link>
  );

  if (forecasts.isPending) {
    return (
      <div role="status" aria-label={vi.common.loading} className="space-y-4">
        {back}
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }
  if (forecasts.isError) {
    const notFound = forecasts.error instanceof ApiError && forecasts.error.status === 404;
    return (
      <div className="space-y-4">
        {back}
        {notFound ? (
          <p className="text-sm text-[var(--ink-secondary)]">{vi.province.notFound}</p>
        ) : (
          <ErrorState error={forecasts.error} onRetry={() => void forecasts.refetch()} />
        )}
      </div>
    );
  }

  const { meta, items } = forecasts.data;
  const byHorizon = new Map(items.map((i) => [i.horizon, i] as const));
  const selected = byHorizon.get(search.h) ?? items[0] ?? null;
  const isBacktest = meta.run_mode === "backtest";

  return (
    <div className="space-y-5">
      {back}
      <header>
        <h1 className="font-display text-3xl font-semibold">{name}</h1>
        {selected ? (
          <p className="mt-1 text-sm text-[var(--ink-secondary)]">
            {vi.regions[selected.region] ?? selected.region}
          </p>
        ) : null}
      </header>

      <ProvenanceBar meta={meta} />

      <section aria-labelledby="horizons-title" className="space-y-3">
        <h2 id="horizons-title" className="text-lg font-semibold">
          {vi.province.horizons}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {HORIZONS.map((h) => {
            const item = byHorizon.get(h);
            return (
              <HorizonCard
                key={h}
                horizon={h}
                item={item ?? null}
                origin={meta.origin_month}
                active={h === search.h}
                onSelect={() => onSearchChange({ h })}
              />
            );
          })}
        </div>
      </section>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">{vi.province.chart.title}</h2>
        {isBacktest ? (
          <p className="mb-3 text-xs text-[var(--ink-secondary)]">{vi.province.backtestCompare}</p>
        ) : null}
        {observations.isPending ? (
          <Skeleton className="h-72 w-full" />
        ) : observations.isError ? (
          <ErrorState error={observations.error} onRetry={() => void observations.refetch()} />
        ) : (
          <ObservationsChart
            name={name}
            observations={observations.data.items}
            items={items}
            origin={meta.origin_month}
            isBacktest={isBacktest}
          />
        )}
        <p className="mt-3 text-xs text-[var(--ink-muted)]">{vi.forecast.noInterval}</p>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <h2 className="text-lg font-semibold">{vi.province.explanation.title}</h2>
          <p className="mt-1 text-sm text-[var(--ink-secondary)]">{vi.province.explanation.lead}</p>
          <p className="mt-2 text-xs text-[var(--ink-muted)]">
            {formatHorizon(meta.origin_month, search.h)}
          </p>
          <div className="mt-3">
            {explanation.isPending ? (
              <Skeleton className="h-48 w-full" />
            ) : explanation.isError ? (
              <ErrorState error={explanation.error} onRetry={() => void explanation.refetch()} />
            ) : (
              <>
                <FactorList factors={explanation.data.factors} />
                <p className="mt-3 text-xs text-[var(--ink-muted)]">
                  {vi.province.explanation.component}
                </p>
              </>
            )}
          </div>
        </Card>

        {selected ? (
          <Card className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{vi.province.reliability}</h2>
              <div className="mt-2">
                <ReliabilityNote region={selected.region} reliability={selected.reliability} />
              </div>
            </div>
            <ForecastFlags flags={selected.flags} notes />
            <div>
              <h2 className="mb-2 text-lg font-semibold">{vi.province.inputs}</h2>
              <InputSources sources={selected.input_data_sources} />
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function HorizonCard({
  horizon,
  item,
  origin,
  active,
  onSelect,
}: {
  horizon: Horizon;
  item: ForecastItem | null;
  origin: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`glass-panel rounded-2xl p-4 ${active ? "outline outline-2 outline-[var(--accent)]" : ""}`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className="text-left text-sm font-semibold text-[var(--ink-primary)] underline decoration-dotted underline-offset-2 hover:text-[var(--accent)]"
      >
        {formatHorizon(origin, horizon)}
      </button>
      {item ? (
        <div className="mt-3 space-y-3">
          <ProbabilityWithBaseRate probability={item.exceed_prob} baseRate={item.base_rate} />
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-[var(--ink-muted)]">{vi.forecast.casesPred}</dt>
              <dd className="text-sm font-semibold tabular-nums">{formatCount(item.cases_pred)}</dd>
            </div>
            <div>
              <dt className="text-[var(--ink-muted)]">{vi.forecast.threshold}</dt>
              <dd className="text-sm tabular-nums">{formatCount(item.threshold_p75)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[var(--ink-muted)]">{vi.forecast.incidencePred}</dt>
              <dd className="tabular-nums">
                {formatIncidence(item.incidence_pred_per_100k)}{" "}
                <span className="text-[var(--ink-muted)]">{vi.forecast.per100k}</span>
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--ink-muted)]">{vi.forecast.noForecast}</p>
      )}
    </div>
  );
}

function ObservationsChart({
  name,
  observations,
  items,
  origin,
  isBacktest,
}: {
  name: string;
  observations: readonly Observation[];
  items: readonly ForecastItem[];
  origin: string;
  isBacktest: boolean;
}) {
  // Chỉ vẽ 3 năm trước tháng neo (và phần sau neo): đủ thấy mùa vụ mà không làm phần đáng chú ý bị nén lại.
  const observed = useMemo(() => {
    const from = addMonths(origin, -35) ?? "0000-00";
    return fillMonths(observations.filter((o) => o.month >= from));
  }, [observations, origin]);
  const forecast = items.map((i) => ({
    month: i.target_month,
    value: i.cases_pred,
    horizon: i.horizon,
  }));
  const threshold = items.map((i) => ({ month: i.target_month, value: i.threshold_p75 }));
  return (
    <TimeSeriesChart
      ariaLabel={vi.province.chart.ariaLabel(name)}
      observed={observed}
      forecast={forecast}
      threshold={threshold}
      originMonth={origin}
      afterOriginIsComparison={isBacktest}
    />
  );
}

function FactorList({ factors }: { factors: readonly ExplanationFactor[] }) {
  const max = Math.max(...factors.map((f) => Math.abs(f.contribution)), 1e-9);
  return (
    <ol className="space-y-3">
      {factors.map((f) => {
        const pct = contributionToPercent(f.contribution);
        const up = f.contribution >= 0;
        const text = up
          ? vi.province.explanation.up(formatPercent(Math.abs(pct)))
          : vi.province.explanation.down(formatPercent(Math.abs(pct)));
        return (
          <li key={f.feature}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-sm font-medium">{vi.features[f.feature] ?? f.feature}</span>
              <span className="text-xs text-[var(--ink-muted)]">
                {vi.province.explanation.families[f.family] ?? f.family}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-surface-2)]"
              >
                <span
                  className={`block h-full rounded-full ${up ? "bg-[var(--accent)]" : "bg-[var(--status-serious)]"}`}
                  style={{ width: `${(Math.abs(f.contribution) / max) * 100}%` }}
                />
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-[var(--ink-secondary)]">
                {up ? (
                  <ArrowUp size={12} aria-hidden="true" />
                ) : (
                  <ArrowDown size={12} aria-hidden="true" />
                )}
                {text}
              </span>
            </div>
            {f.value != null && !vi.featureHideValue.includes(f.feature) ? (
              <div className="mt-0.5 text-xs text-[var(--ink-muted)]">
                {vi.province.explanation.inputValue}: {formatDecimal(f.value, 1)}
                {vi.featureUnits[f.feature] ? ` ${vi.featureUnits[f.feature]}` : ""}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
