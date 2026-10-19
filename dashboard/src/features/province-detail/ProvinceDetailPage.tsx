import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowLeft, ArrowUp, Download, Scale, Target, Thermometer } from "lucide-react";
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
import { TACTICAL_SCENARIOS } from "@/shared/config/scenarios";
import { exportToCsv } from "@/shared/lib/exportCsv";
import { evaluateNorthernThermalPhase } from "@/shared/lib/thermalTrigger";
import {
  addMonths,
  formatCount,
  formatDecimal,
  formatHorizon,
  formatIncidence,
  formatPercent,
} from "@/shared/lib/format";
import { vi } from "@/shared/i18n/vi";
import { Button } from "@/shared/ui/Button";
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
  const originMonthNum = parseInt(forecasts.data?.meta.origin_month.split("-")[1] || "6", 10);
  const thermalAssessment = useMemo(
    () => evaluateNorthernThermalPhase(provinceId, originMonthNum),
    [provinceId, originMonthNum]
  );

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

  const relatedScenario = TACTICAL_SCENARIOS.find((sc) => sc.provinces.includes(name));

  function handleExportProvinceCsv() {
    if (!forecasts.data) return;
    const filename = `DengueSense_${name}_Du_Bao_${meta.origin_month}`;
    const rows = items.map((it) => ({
      province: name,
      origin: meta.origin_month,
      horizon: `${it.horizon} tháng`,
      targetMonth: it.target_month,
      casesPred: Math.round(it.cases_pred),
      incidencePred: it.incidence_pred_per_100k.toFixed(1),
      exceedProb: `${Math.round(it.exceed_prob * 100)}%`,
      baseRate: `${Math.round(it.base_rate * 100)}%`,
      thresholdP75: Math.round(it.threshold_p75),
      flags: it.flags.join("; ") || "Bình thường",
    }));

    exportToCsv(
      filename,
      [
        { header: "Tỉnh / Thành", key: "province" },
        { header: "Tháng neo", key: "origin" },
        { header: "Tầm dự báo", key: "horizon" },
        { header: "Tháng đích", key: "targetMonth" },
        { header: "Ca dự báo", key: "casesPred" },
        { header: "Tỉ suất / 100k dân", key: "incidencePred" },
        { header: "Xác suất vượt ngưỡng", key: "exceedProb" },
        { header: "Mức nền lịch sử", key: "baseRate" },
        { header: "Ngưỡng P75", key: "thresholdP75" },
        { header: "Ghi chú & Cờ", key: "flags" },
      ],
      rows
    );
  }

  function handleExportShapCsv() {
    if (!explanation.data) return;
    const filename = `DengueSense_${name}_TreeSHAP_${search.h}T`;
    const rows = explanation.data.factors.map((f) => ({
      feature: vi.features[f.feature] ?? f.feature,
      family: vi.province.explanation.families[f.family] ?? f.family,
      value: f.value != null ? f.value : "N/A",
      contribution: `${(f.contribution * 100).toFixed(2)}%`,
      direction: f.contribution >= 0 ? "Tăng rủi ro (+)" : "Giảm rủi ro (-)",
    }));

    exportToCsv(
      filename,
      [
        { header: "Yếu tố dịch tễ / môi trường", key: "feature" },
        { header: "Nhóm đặc trưng", key: "family" },
        { header: "Giá trị đo đạc", key: "value" },
        { header: "Đóng góp TreeSHAP (%)", key: "contribution" },
        { header: "Chiều tác động", key: "direction" },
      ],
      rows
    );
  }

  return (
    <div className="space-y-5">
      {back}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">{name}</h1>
          {selected ? (
            <p className="mt-1 text-sm text-[var(--ink-secondary)]">
              {vi.regions[selected.region] ?? selected.region} · {items.length} tầm dự báo (1T - 6T)
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {relatedScenario && (
            <Button
              variant="secondary"
              className="gap-1.5 text-xs py-1.5 border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10"
              onClick={() => window.dispatchEvent(new CustomEvent("open-tactical-scenarios"))}
              title={`Tỉnh thuộc kịch bản: ${relatedScenario.title}`}
            >
              <Target size={14} className="text-red-500" />
              <span>{relatedScenario.badge}</span>
            </Button>
          )}
          <Button
            variant="secondary"
            className="gap-1.5 text-xs py-1.5"
            onClick={handleExportProvinceCsv}
            title="Xuất bảng dữ liệu dự báo 4 tầm ra file CSV cho Excel"
          >
            <Download size={14} />
            <span>Xuất CSV (Excel)</span>
          </Button>
        </div>
      </header>

      {/* Liên kết kịch bản tác chiến nếu tỉnh nằm trong danh sách điểm nóng */}
      {relatedScenario && (
        <div className="rounded-xl border border-red-500/30 bg-red-50/50 p-4 dark:border-red-500/20 dark:bg-red-950/20 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <span className="font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <Target size={14} />
              Địa bàn trọng điểm trong {relatedScenario.title}
            </span>
            <p className="text-slate-600 dark:text-slate-300">{relatedScenario.summary}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="text-xs py-1 px-3 border-indigo-500/30 text-indigo-600 dark:text-indigo-400"
              onClick={() => window.dispatchEvent(new CustomEvent("open-scenario-comparison"))}
            >
              <Scale size={13} />
              <span>Độ nhạy & So sánh A/B</span>
            </Button>
            <Link
              to={relatedScenario.targetRoute}
              className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 font-semibold text-white hover:bg-red-700 transition-colors"
            >
              <span>Xem hồ sơ can thiệp MILP</span>
              <ArrowLeft size={12} className="rotate-180" />
            </Link>
          </div>
        </div>
      )}

      {/* Cảnh báo mô hình 2 pha miền Bắc theo nhiệt độ tích lũy GDD */}
      {thermalAssessment.isNorthernProvince && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-50/50 p-4 dark:border-sky-500/20 dark:bg-sky-950/20 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
                <Thermometer size={14} />
                Mô hình Khí hậu 2 Pha Miền Bắc: {thermalAssessment.phaseLabel}
              </span>
              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300">
                GDD: {thermalAssessment.degreeDays}°C·ngày (T = {thermalAssessment.temperatureC}°C)
              </span>
            </div>
            <p className="text-[var(--ink-secondary)]">{thermalAssessment.recommendation}</p>
          </div>
          <span className="text-[10px] text-[var(--ink-muted)] shrink-0">
            * Khắc phục nhược điểm muỗi Aedes tạm ngừng hoạt động khi nhiệt độ dưới 16°C
          </span>
        </div>
      )}

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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">{vi.province.explanation.title}</h2>
              <p className="mt-1 text-sm text-[var(--ink-secondary)]">
                {vi.province.explanation.lead}
              </p>
            </div>
            {explanation.data && (
              <Button
                variant="secondary"
                className="px-2.5 py-1 text-xs gap-1"
                onClick={handleExportShapCsv}
                title="Xuất bảng phân rã TreeSHAP ra file CSV cho Excel"
              >
                <Download size={13} />
                <span>Xuất SHAP CSV</span>
              </Button>
            )}
          </div>
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
