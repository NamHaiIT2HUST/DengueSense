import { Link } from "@tanstack/react-router";

import type { Meta } from "@/shared/api";
import { formatDateTime, formatMonth } from "@/shared/lib/format";
import { vi } from "@/shared/i18n/vi";

import { Alert } from "./Alert";

/**
 * Dải nguồn gốc số liệu (luật T3) + banner theo chế độ (luật T4). Mọi màn hình có số liệu mô hình đều dùng cái này:
 * người xem luôn biết số đến từ lượt nào, mô hình/dữ liệu phiên bản nào, và có phải tái hiện lịch sử hay không.
 */
export function ProvenanceBar({ meta }: { meta: Meta }) {
  const origin = formatMonth(meta.origin_month);
  const isBacktest = meta.run_mode === "backtest";
  return (
    <section aria-label={vi.forecast.provenance.label} className="space-y-3">
      <Alert tone={isBacktest ? "info" : "warning"}>
        {isBacktest ? vi.forecast.backtestBanner(origin) : vi.forecast.liveBanner}
      </Alert>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
        {/* <dl> chỉ được chứa cặp dt/dd: liên kết đặt NGOÀI danh sách định nghĩa (axe: definition-list). */}
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          <Item
            label={vi.forecast.provenance.mode}
            value={vi.forecast.modes[meta.run_mode] ?? meta.run_mode}
          />
          <Item label={vi.forecast.provenance.origin} value={origin} />
          <Item label={vi.forecast.provenance.model} value={meta.model_version} mono />
          <Item label={vi.forecast.provenance.data} value={meta.data_version} mono />
          <Item
            label={vi.forecast.provenance.generated}
            value={formatDateTime(meta.generated_at)}
          />
        </dl>
        <Link
          to="/app/mo-hinh"
          className="text-[var(--accent)] underline hover:text-[var(--accent-ink)]"
        >
          {vi.forecast.provenance.limitsLink}
        </Link>
      </div>
    </section>
  );
}

function Item({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[var(--ink-muted)]">{label}</dt>
      <dd className={mono ? "font-mono text-[var(--ink-primary)]" : "text-[var(--ink-primary)]"}>
        {value}
      </dd>
    </div>
  );
}
