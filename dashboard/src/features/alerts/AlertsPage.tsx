import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, FolderPlus } from "lucide-react";

import { useAlerts, useConfirmAlert, type Alert } from "@/entities/alert";
import { useCreateCase } from "@/entities/draft";
import { useProvinces } from "@/entities/forecast";
import { hasAnyRole, useCurrentUser } from "@/entities/user";
import { formatDateTime } from "@/shared/lib/format";
import { vi } from "@/shared/i18n/vi";
import { Alert as UiAlert } from "@/shared/ui/Alert";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { ErrorState } from "@/shared/ui/ErrorState";
import { Segmented } from "@/shared/ui/Segmented";
import { Skeleton } from "@/shared/ui/Skeleton";
import { TextField } from "@/shared/ui/TextField";

type StatusFilter = "all" | "open" | "closed";
type RegionFilter = "all" | "Bắc" | "Trung" | "Nam";

const OFFICER_ROLES = ["officer", "approver", "admin"] as const;

export function AlertsPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const canAct = hasAnyRole(user, ...OFFICER_ROLES);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("all");

  const [confirmingAlert, setConfirmingAlert] = useState<Alert | null>(null);
  const [creatingCaseAlert, setCreatingCaseAlert] = useState<Alert | null>(null);
  const [caseTitle, setCaseTitle] = useState("");

  const alertsQuery = useAlerts(statusFilter === "all" ? {} : { status: statusFilter });
  const provincesQuery = useProvinces();
  const confirmMutation = useConfirmAlert();
  const createCaseMutation = useCreateCase();

  const provincesMap = new Map((provincesQuery.data?.items ?? []).map((p) => [p.province_id, p]));

  const rawAlerts: readonly Alert[] = alertsQuery.data ?? [];
  const filteredAlerts = rawAlerts.filter((a) => {
    if (regionFilter === "all") return true;
    const p = provincesMap.get(a.province_id);
    return p?.region === regionFilter;
  });

  const statusOptions: readonly { value: StatusFilter; label: string }[] = [
    { value: "all", label: vi.alerts.filterAll },
    { value: "open", label: vi.alerts.statusOpen },
    { value: "closed", label: vi.alerts.statusClosed },
  ];

  const regionOptions: readonly { value: RegionFilter; label: string }[] = [
    { value: "all", label: vi.alerts.filterAll },
    { value: "Bắc", label: vi.regions["Bắc"] ?? "Miền Bắc" },
    { value: "Trung", label: vi.regions["Trung"] ?? "Miền Trung" },
    { value: "Nam", label: vi.regions["Nam"] ?? "Miền Nam" },
  ];

  async function handleConfirmAlert() {
    if (!confirmingAlert) return;
    await confirmMutation.mutateAsync(confirmingAlert.id);
    setConfirmingAlert(null);
  }

  async function handleCreateCase() {
    if (!creatingCaseAlert || !caseTitle.trim()) return;
    const res = await createCaseMutation.mutateAsync({
      title: caseTitle.trim(),
      alert_ids: [creatingCaseAlert.id],
      created_by: user?.username ?? "officer",
    });
    setCreatingCaseAlert(null);
    setCaseTitle("");
    void router.navigate({
      to: "/app/ho-so/$caseId",
      params: { caseId: res.id },
    });
  }

  function openCreateCaseModal(alert: Alert) {
    const prov = provincesMap.get(alert.province_id)?.name ?? alert.province_id;
    setCreatingCaseAlert(alert);
    setCaseTitle(`Hồ sơ ứng phó dịch SXH — ${prov}`);
  }

  const openAlertsCount = rawAlerts.filter((a) => a.status === "open").length;
  const confirmedAlertsCount = rawAlerts.filter((a) => a.status !== "open").length;
  const affectedProvincesCount = new Set(rawAlerts.map((a) => a.province_id)).size;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold text-white">{vi.alerts.title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--ink-secondary)]">{vi.alerts.lead}</p>
      </header>

      {!canAct ? <UiAlert tone="info">{vi.alerts.officerOnly}</UiAlert> : null}

      {/* KPI Stat Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-panel rounded-2xl p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <span className="text-xs text-[var(--ink-secondary)]">Tổng số cảnh báo</span>
            <p className="text-xl font-bold text-white tabular-nums">{rawAlerts.length}</p>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <span className="text-xs text-[var(--ink-secondary)]">Đang mở (Cần xử lý)</span>
            <p className="text-xl font-bold text-red-400 tabular-nums">{openAlertsCount}</p>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <span className="text-xs text-[var(--ink-secondary)]">Đã tiếp nhận</span>
            <p className="text-xl font-bold text-emerald-400 tabular-nums">
              {confirmedAlertsCount}
            </p>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <FolderPlus className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <span className="text-xs text-[var(--ink-secondary)]">Địa bàn ảnh hưởng</span>
            <p className="text-xl font-bold text-amber-400 tabular-nums">
              {affectedProvincesCount} tỉnh
            </p>
          </div>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <Segmented<StatusFilter>
                legend={vi.alerts.filterStatus}
                value={statusFilter}
                onChange={setStatusFilter}
                options={statusOptions}
              />
            </div>
            <div>
              <Segmented<RegionFilter>
                legend={vi.alerts.filterRegion}
                value={regionFilter}
                onChange={setRegionFilter}
                options={regionOptions}
              />
            </div>
          </div>
          <div className="text-sm text-[var(--ink-secondary)]">
            Tổng số: <strong className="text-[var(--ink-primary)]">{filteredAlerts.length}</strong>{" "}
            cảnh báo
          </div>
        </div>
      </Card>

      {alertsQuery.isPending ? (
        <div role="status" aria-label={vi.common.loading}>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : alertsQuery.isError ? (
        <ErrorState error={alertsQuery.error} onRetry={() => void alertsQuery.refetch()} />
      ) : filteredAlerts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-strong)] p-12 text-center">
          <CheckCircle2
            className="mx-auto mb-3 text-[var(--status-good)] opacity-80"
            size={36}
            aria-hidden="true"
          />
          <p className="text-base font-semibold text-[var(--ink-primary)]">{vi.alerts.empty}</p>
          <p className="mt-1 text-sm text-[var(--ink-secondary)]">
            Thử thay đổi bộ lọc trạng thái hoặc khu vực.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border-hairline)]">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <caption className="sr-only">{vi.alerts.title}</caption>
            <thead className="bg-[var(--bg-surface)] text-xs text-[var(--ink-secondary)]">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  {vi.alerts.columns.province}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {vi.alerts.columns.run}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {vi.alerts.columns.createdAt}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {vi.alerts.columns.status}
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  {vi.alerts.columns.actions}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.map((alert) => {
                const prov = provincesMap.get(alert.province_id);
                const provName = prov?.name ?? alert.province_id;
                const isOpen = alert.status === "open";

                return (
                  <tr
                    key={alert.id}
                    className="border-t border-[var(--border-hairline)] hover:bg-[var(--bg-surface-hover)] transition"
                  >
                    <td className="px-4 py-3.5 font-medium">
                      <div className="flex items-center gap-2">
                        {isOpen ? (
                          <AlertTriangle
                            size={16}
                            className="text-[var(--status-critical)]"
                            aria-hidden="true"
                          />
                        ) : (
                          <CheckCircle2
                            size={16}
                            className="text-[var(--status-good)]"
                            aria-hidden="true"
                          />
                        )}
                        <Link
                          to="/app/tinh/$provinceId"
                          params={{ provinceId: alert.province_id }}
                          className="font-semibold text-[var(--ink-primary)] hover:underline"
                        >
                          {provName}
                        </Link>
                        {prov?.region ? (
                          <span className="rounded-full bg-[var(--bg-surface-2)] px-2 py-0.5 text-[11px] text-[var(--ink-secondary)]">
                            {prov.region}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-[var(--ink-secondary)]">
                      {alert.run_id}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[var(--ink-secondary)]">
                      {formatDateTime(alert.created_at)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          isOpen
                            ? "bg-[color-mix(in_srgb,var(--status-critical)_15%,transparent)] text-[var(--status-critical-ink)]"
                            : "bg-[color-mix(in_srgb,var(--status-good)_15%,transparent)] text-[var(--status-good-ink)]"
                        }`}
                      >
                        {isOpen ? vi.alerts.statusOpen : vi.alerts.statusClosed}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to="/app/tinh/$provinceId"
                          params={{ provinceId: alert.province_id }}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-[var(--ink-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--ink-primary)]"
                          title={vi.alerts.actions.viewProvince}
                        >
                          {vi.alerts.actions.viewProvince}
                          <ExternalLink size={12} />
                        </Link>

                        {canAct && isOpen ? (
                          <>
                            <Button
                              variant="secondary"
                              className="px-3 py-1 text-xs"
                              onClick={() => setConfirmingAlert(alert)}
                            >
                              {vi.alerts.actions.confirm}
                            </Button>
                            <Button
                              variant="primary"
                              className="px-3 py-1 text-xs gap-1.5"
                              onClick={() => openCreateCaseModal(alert)}
                            >
                              <FolderPlus size={13} />
                              {vi.alerts.actions.createCase}
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal xác nhận đã xem cảnh báo */}
      <ConfirmDialog
        open={confirmingAlert !== null}
        title={vi.alerts.confirmModal.title}
        description={
          confirmingAlert
            ? vi.alerts.confirmModal.desc(
                provincesMap.get(confirmingAlert.province_id)?.name ?? confirmingAlert.province_id
              )
            : ""
        }
        confirmText={vi.alerts.actions.confirm}
        loading={confirmMutation.isPending}
        onConfirm={() => void handleConfirmAlert()}
        onCancel={() => setConfirmingAlert(null)}
      />

      {/* Modal tạo hồ sơ xử lý từ cảnh báo */}
      <ConfirmDialog
        open={creatingCaseAlert !== null}
        title={vi.cases.createModal.title}
        confirmText={vi.cases.createModal.submit}
        cancelText={vi.cases.createModal.cancel}
        disabled={!caseTitle.trim()}
        loading={createCaseMutation.isPending}
        onConfirm={() => void handleCreateCase()}
        onCancel={() => {
          setCreatingCaseAlert(null);
          setCaseTitle("");
        }}
      >
        <div className="space-y-3">
          <TextField
            label={vi.cases.createModal.titleLabel}
            value={caseTitle}
            onChange={(e) => setCaseTitle(e.target.value)}
            placeholder={vi.cases.createModal.titlePlaceholder}
            autoFocus
          />
          <p className="text-xs text-[var(--ink-secondary)]">
            Cảnh báo được gán:{" "}
            <strong className="text-[var(--ink-primary)]">
              {creatingCaseAlert
                ? (provincesMap.get(creatingCaseAlert.province_id)?.name ??
                  creatingCaseAlert.province_id)
                : ""}
            </strong>
          </p>
        </div>
      </ConfirmDialog>
    </div>
  );
}
