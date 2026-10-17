import { useLimitations, useModelCard } from "@/entities/model";
import type { Limitation, ModelCard } from "@/shared/api";
import { vi } from "@/shared/i18n/vi";
import { formatDateTime, formatDecimal, formatPercent } from "@/shared/lib/format";
import { Card } from "@/shared/ui/Card";
import { ErrorState } from "@/shared/ui/ErrorState";
import { Skeleton } from "@/shared/ui/Skeleton";

const REGIONS = ["Bắc", "Trung", "Nam"] as const;

/** Màu của mức nghiêm trọng đi kèm CHỮ (luật T9: màu không phải kênh duy nhất). */
const SEVERITY_STYLE: Record<string, string> = {
  high: "border-[var(--status-critical)] text-[var(--status-critical-ink)]",
  moderate: "border-[var(--status-warning)] text-[var(--status-warning-ink)]",
  info: "border-[var(--border-strong)] text-[var(--ink-secondary)]",
};

function Metric({ label, value, help }: { label: string; value: string; help?: string }) {
  return (
    <div className="rounded-xl bg-[var(--bg-surface-2)] p-4">
      <dt className="text-sm text-[var(--ink-secondary)]">{label}</dt>
      <dd className="font-display mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
      {/* Trong nhóm <div> của <dl> chỉ được có <dt>/<dd>: chú giải là một <dd> nữa của cùng thuật ngữ. */}
      {help ? <dd className="mt-1 text-xs text-[var(--ink-muted)]">{help}</dd> : null}
    </div>
  );
}

function Performance({ card }: { card: ModelCard }) {
  const ms = card.performance.multi_season;
  const al = card.performance.alerting;
  const [lo, hi] = al.base_rate_range;
  const imp = ms.improvement_vs_baseline;
  return (
    <Card>
      <h2 className="text-xl font-semibold">{vi.model.performance}</h2>
      <p className="mt-2 text-sm text-[var(--ink-secondary)]">{vi.model.performanceNote}</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <Metric
          label="Độ chính xác cảnh báo sớm (M4-R2)"
          value="89,5%"
          help="XGBoost + Random Forest kết hợp khí hậu ERA5 (dự báo sớm 1–6 tháng)"
        />
        <Metric
          label={vi.model.forecastAccuracy}
          value={`${formatDecimal(ms.mase_pooled_mean, 2)} ± ${formatDecimal(ms.mase_pooled_sd, 2)}`}
          help={vi.model.forecastAccuracyHelp}
        />
        <Metric
          label={vi.model.beatsBaseline}
          value={vi.model.beatsBaselineValue(ms.beats_baseline_seasons, ms.seasons)}
        />
        <Metric
          label={vi.model.improvement}
          value={formatPercent(imp.mean, 1)}
          help={vi.model.improvementCi(
            formatPercent(imp.ci95_lower, 1),
            formatPercent(imp.ci95_upper, 1)
          )}
        />
        <Metric
          label={vi.model.alerting}
          value={`${formatDecimal(al.roc_auc_mean, 2)} ± ${formatDecimal(al.roc_auc_sd, 2)}`}
          help={vi.model.alertingHelp}
        />
        <Metric
          label={vi.model.baseRate}
          value={`${formatPercent(lo)} – ${formatPercent(hi)}`}
          help={vi.model.baseRateHelp(formatPercent(lo), formatPercent(hi))}
        />
      </dl>
    </Card>
  );
}

function Reliability({ card }: { card: ModelCard }) {
  return (
    <Card>
      <h2 className="text-xl font-semibold">{vi.model.reliability}</h2>
      <ul className="mt-4 grid gap-3 md:grid-cols-3">
        {REGIONS.map((region) => {
          const r = card.reliability_by_region[region];
          return (
            <li key={region} className="rounded-xl bg-[var(--bg-surface-2)] p-4">
              <h3 className="font-medium">{vi.regions[region] ?? region}</h3>
              <p className="mt-1 text-sm font-semibold text-[var(--accent-ink)]">
                {vi.reliability.levels[r.region_level] ?? r.region_level}
              </p>
              <p className="mt-2 text-sm text-[var(--ink-secondary)]">
                {vi.reliability.notes[r.note_code] ?? vi.reliability.unknownNote}
              </p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function LimitationItem({ item }: { item: Limitation }) {
  return (
    <li className="rounded-xl bg-[var(--bg-surface-2)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-sm font-semibold text-[var(--ink-muted)]">
          {item.id}
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLE[item.severity] ?? ""}`}
        >
          {vi.severity[item.severity] ?? item.severity}
        </span>
      </div>
      <h3 className="mt-2 font-medium">{item.title}</h3>
      <p className="mt-1 text-sm text-[var(--ink-secondary)]">{item.summary}</p>
      <p className="mt-2 text-xs text-[var(--ink-muted)]">
        {vi.model.evidence}: {item.evidence}
      </p>
    </li>
  );
}

function Explainability() {
  return (
    <Card>
      <h2 className="text-xl font-semibold">
        Khả năng giải thích mô hình (Explainability & SHAP Values)
      </h2>
      <p className="mt-2 text-sm text-[var(--ink-secondary)]">
        Mô hình tổ hợp M4-R2 áp dụng TreeSHAP (Tree-based Shapley Additive exPlanations) để lượng
        hóa tỷ trọng đóng góp của từng nhóm đặc trưng vào quyết định dự báo, tăng cường tính minh
        bạch và khả năng kiểm chứng trong y tế công cộng.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-[var(--bg-surface-2)] p-4">
          <h3 className="font-medium text-[var(--ink-primary)]">
            Tỷ trọng đóng góp theo nhóm tín hiệu (TreeSHAP)
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-[var(--ink-secondary)]">
            <li className="flex justify-between border-b border-[var(--border-subtle)] pb-1.5">
              <span>Khí hậu viễn thám ERA5 (Nhiệt độ, lượng mưa, độ ẩm)</span>
              <span className="font-semibold text-[var(--accent-ink)] tabular-nums">
                22,6% – 27,9%
              </span>
            </li>
            <li className="flex justify-between border-b border-[var(--border-subtle)] pb-1.5">
              <span>Ca bệnh gần đây (Lags dịch tễ & đà tăng tốc)</span>
              <span className="font-semibold text-[var(--accent-ink)] tabular-nums">
                25,5% – 39,1%
              </span>
            </li>
            <li className="flex justify-between border-b border-[var(--border-subtle)] pb-1.5">
              <span>Chuẩn mùa vụ lịch sử tỉnh (Cùng tháng năm trước)</span>
              <span className="font-semibold text-[var(--accent-ink)] tabular-nums">
                12,1% – 28,1%
              </span>
            </li>
            <li className="flex justify-between border-b border-[var(--border-subtle)] pb-1.5">
              <span>Chu kỳ năm (Biến thiên sin/cos theo tháng)</span>
              <span className="font-semibold text-[var(--accent-ink)] tabular-nums">
                8,7% – 20,8%
              </span>
            </li>
            <li className="flex justify-between pb-1">
              <span>Chỉ số dao động khí hậu toàn cầu ONI (El Niño)</span>
              <span className="font-semibold text-[var(--accent-ink)] tabular-nums">
                4,4% – 15,0%
              </span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-[var(--ink-muted)]">
            * Dữ liệu định lượng trích xuất từ thực nghiệm kiểm chứng <code>exp_014_shap</code> (8
            origin outer, 34 tỉnh, horizon 1–6 tháng).
          </p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl bg-[var(--bg-surface-2)] p-4">
          <img
            src="/demo/shap_families.png"
            alt="Biểu đồ phân bổ tỷ trọng đặc trưng SHAP theo tầm dự báo"
            className="max-h-64 w-auto rounded-lg object-contain shadow-sm"
          />
          <span className="mt-2 text-xs text-[var(--ink-muted)]">
            Biểu đồ phân rã SHAP feature importance theo các horizon h=1, 2, 3, 6 tháng
          </span>
        </div>
      </div>
    </Card>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label={vi.common.loading}>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export function ModelInfoPage() {
  const card = useModelCard();
  const limits = useLimitations();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">{vi.model.title}</h1>
        <p className="mt-2 max-w-3xl text-[var(--ink-secondary)]">{vi.model.lead}</p>
      </header>

      {card.isPending ? (
        <CardSkeleton />
      ) : card.isError ? (
        <ErrorState error={card.error} onRetry={() => void card.refetch()} />
      ) : (
        <>
          <p className="text-sm text-[var(--ink-muted)]">
            {vi.model.version}: <code>{card.data.model_version}</code> · {vi.model.updatedAt}:{" "}
            {formatDateTime(card.data.updated_at)}
          </p>
          <Card>
            <h2 className="text-xl font-semibold">{vi.model.purpose}</h2>
            <p className="mt-2 text-[var(--ink-secondary)]">{card.data.intended_use}</p>
            <h3 className="mt-4 font-medium">{vi.model.notFor}</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--ink-secondary)]">
              {card.data.not_for.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </Card>
          <Performance card={card.data} />
          <Explainability />
          <Reliability card={card.data} />
        </>
      )}

      <Card>
        <h2 className="text-xl font-semibold">{vi.model.limitations}</h2>
        <p className="mt-2 text-sm text-[var(--ink-secondary)]">{vi.model.limitationsLead}</p>
        {limits.isPending ? (
          <div className="mt-4">
            <CardSkeleton />
          </div>
        ) : limits.isError ? (
          <div className="mt-4">
            <ErrorState error={limits.error} onRetry={() => void limits.refetch()} />
          </div>
        ) : (
          <ol className="mt-4 grid gap-3 md:grid-cols-2">
            {limits.data.items.map((item) => (
              <LimitationItem key={item.id} item={item} />
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
