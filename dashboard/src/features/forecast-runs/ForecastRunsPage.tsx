import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useCreateForecastRun, useForecastRuns, useJob } from "@/entities/forecast";
import { hasAnyRole, useCurrentUser } from "@/entities/user";
import { ApiError, toUserFacing, type ForecastRun } from "@/shared/api";
import { formatDateTime, formatMonth, formatPercent } from "@/shared/lib/format";
import { vi } from "@/shared/i18n/vi";
import { Alert } from "@/shared/ui/Alert";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { ErrorState } from "@/shared/ui/ErrorState";
import { Skeleton } from "@/shared/ui/Skeleton";
import { TextField } from "@/shared/ui/TextField";

const schema = z.object({
  origin_month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, vi.runs.create.invalid),
});
type FormValues = z.infer<typeof schema>;

const CREATE_ROLES = ["analyst", "officer", "approver", "data_manager", "admin"] as const;

export function ForecastRunsPage() {
  const runs = useForecastRuns();
  const user = useCurrentUser();
  const canCreate = hasAnyRole(user, ...CREATE_ROLES);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-3xl font-semibold">{vi.runs.title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--ink-secondary)]">{vi.runs.lead}</p>
      </header>

      <Card>
        <h2 className="text-lg font-semibold">{vi.runs.create.title}</h2>
        {canCreate ? (
          <CreateRun />
        ) : (
          <p className="mt-2 text-sm text-[var(--ink-secondary)]">{vi.runs.create.analystOnly}</p>
        )}
      </Card>

      {runs.isPending ? (
        <div role="status" aria-label={vi.common.loading}>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : runs.isError ? (
        <ErrorState error={runs.error} onRetry={() => void runs.refetch()} />
      ) : runs.data.items.length === 0 ? (
        <p className="text-sm text-[var(--ink-secondary)]">{vi.runs.empty}</p>
      ) : (
        <RunsTable runs={runs.data.items} />
      )}
    </div>
  );
}

function RunsTable({ runs }: { runs: readonly ForecastRun[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border-hairline)]">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <caption className="sr-only">{vi.runs.title}</caption>
        <thead className="bg-[var(--bg-surface)] text-xs text-[var(--ink-secondary)]">
          <tr>
            {Object.values(vi.runs.columns).map((label) => (
              <th key={label} scope="col" className="px-3 py-2 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.run_id} className="border-t border-[var(--border-hairline)]">
              <th scope="row" className="px-3 py-2 font-medium tabular-nums">
                {formatMonth(r.origin_month)}
              </th>
              <td className="px-3 py-2">{vi.forecast.modes[r.run_mode] ?? r.run_mode}</td>
              <td className="px-3 py-2">{vi.forecast.statuses[r.status] ?? r.status}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.model_version}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.data_version}</td>
              <td className="px-3 py-2 tabular-nums">{formatDateTime(r.created_at)}</td>
              <td className="px-3 py-2">
                {r.status === "completed" ? (
                  <Link
                    to="/app/ban-do"
                    search={{ run: r.run_id, h: 3 }}
                    className="text-[var(--accent)] underline hover:text-[var(--accent-ink)]"
                    aria-label={vi.runs.open(formatMonth(r.origin_month))}
                  >
                    {vi.runs.columns.open}
                  </Link>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CreateRun() {
  const create = useCreateForecastRun();
  const [jobId, setJobId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { origin_month: "2010-03" },
  });

  const onSubmit = handleSubmit(async ({ origin_month }) => {
    setServerError(null);
    setJobId(null);
    try {
      const job = await create.mutateAsync({ mode: "backtest", origin_month });
      setJobId(job.job_id);
    } catch (err) {
      // Lỗi theo trường của server → gắn vào ô nhập; còn lại là lỗi chung của form.
      const field =
        err instanceof ApiError
          ? err.fieldErrors.find((f) => f.field === "origin_month")
          : undefined;
      if (field) setError("origin_month", { message: field.message });
      else setServerError(toUserFacing(err).message);
    }
  });

  return (
    <div className="mt-3 space-y-4">
      <p className="text-sm text-[var(--ink-secondary)]">{vi.runs.create.lead}</p>
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex flex-wrap items-start gap-3"
        aria-label={vi.runs.create.title}
      >
        <div className="w-48">
          <TextField
            label={vi.runs.create.origin}
            inputMode="numeric"
            placeholder="2010-03"
            autoComplete="off"
            error={errors.origin_month?.message}
            {...register("origin_month")}
          />
        </div>
        <Button type="submit" loading={isSubmitting} className="mt-[26px]">
          {isSubmitting ? vi.runs.create.submitting : vi.runs.create.submit}
        </Button>
      </form>
      {serverError ? <Alert tone="error">{serverError}</Alert> : null}
      <p className="text-xs text-[var(--ink-muted)]">{vi.runs.create.demoNote}</p>
      {jobId ? <JobStatus jobId={jobId} /> : null}
    </div>
  );
}

/** Job chạy nền: hỏi lại mỗi giây tới khi xong. Tiến độ và trạng thái đều có chữ (không chỉ thanh). */
function JobStatus({ jobId }: { jobId: string }) {
  const job = useJob(jobId);
  if (job.isError) return <ErrorState error={job.error} onRetry={() => void job.refetch()} />;
  const j = job.data;
  if (!j) return <Skeleton className="h-10 w-full" />;

  const runId = j.result_ref?.split("/").pop();
  if (j.status === "succeeded" && runId) {
    return (
      <Alert tone="info">
        {vi.runs.create.done}{" "}
        <Link to="/app/ban-do" search={{ run: runId, h: 3 }} className="font-medium underline">
          {vi.runs.create.openResult}
        </Link>
      </Alert>
    );
  }
  if (j.status === "failed" || j.status === "cancelled") {
    return <Alert tone="error">{vi.runs.create.failed}</Alert>;
  }
  const pct = formatPercent(j.progress ?? 0);
  return (
    <div role="status" aria-live="polite" className="space-y-1.5 text-sm">
      <p className="text-[var(--ink-secondary)]">
        {j.status === "queued" ? vi.runs.create.accepted : vi.runs.create.progress(pct)}
      </p>
      <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-[var(--bg-surface-2)]">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width]"
          style={{ width: `${Math.round((j.progress ?? 0) * 100)}%` }}
        />
      </div>
    </div>
  );
}
