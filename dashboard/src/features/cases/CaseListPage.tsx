import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Folder, FolderPlus, ArrowRight } from "lucide-react";

import { useCases, useCreateCase, type Case } from "@/entities/draft";
import { hasAnyRole, useCurrentUser } from "@/entities/user";
import { formatDateTime } from "@/shared/lib/format";
import { vi } from "@/shared/i18n/vi";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { ErrorState } from "@/shared/ui/ErrorState";
import { Segmented } from "@/shared/ui/Segmented";
import { Skeleton } from "@/shared/ui/Skeleton";
import { TextField } from "@/shared/ui/TextField";

type StatusFilter = "all" | "open" | "completed" | "archived";

const OFFICER_ROLES = ["officer", "analyst", "approver", "admin"] as const;

export function CaseListPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const canCreate = hasAnyRole(user, ...OFFICER_ROLES);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const casesQuery = useCases(statusFilter === "all" ? {} : { status: statusFilter });
  const createCaseMutation = useCreateCase();

  const cases: readonly Case[] = casesQuery.data ?? [];

  async function handleCreateCase() {
    if (!newTitle.trim()) return;
    const res = await createCaseMutation.mutateAsync({
      title: newTitle.trim(),
      created_by: user?.username ?? "officer",
    });
    setIsCreating(false);
    setNewTitle("");
    void router.navigate({
      to: "/app/ho-so/$caseId",
      params: { caseId: res.id },
    });
  }

  const statusOptions: readonly { value: StatusFilter; label: string }[] = [
    { value: "all", label: vi.alerts.filterAll },
    { value: "open", label: vi.cases.statuses["open"] ?? "Đang mở" },
    { value: "completed", label: vi.cases.statuses["completed"] ?? "Hoàn tất" },
    { value: "archived", label: vi.cases.statuses["archived"] ?? "Lưu trữ" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">{vi.cases.title}</h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--ink-secondary)]">{vi.cases.lead}</p>
        </div>
        {canCreate ? (
          <Button
            variant="primary"
            className="gap-2"
            onClick={() => {
              setNewTitle("");
              setIsCreating(true);
            }}
          >
            <FolderPlus size={16} />
            {vi.cases.createBtn}
          </Button>
        ) : null}
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Segmented<StatusFilter>
            legend={vi.alerts.filterStatus}
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusOptions}
          />
          <div className="text-sm text-[var(--ink-secondary)]">
            Tổng số: <strong className="text-[var(--ink-primary)]">{cases.length}</strong> hồ sơ
          </div>
        </div>
      </Card>

      {casesQuery.isPending ? (
        <div role="status" aria-label={vi.common.loading}>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : casesQuery.isError ? (
        <ErrorState error={casesQuery.error} onRetry={() => void casesQuery.refetch()} />
      ) : cases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-strong)] p-12 text-center">
          <Folder
            className="mx-auto mb-3 text-[var(--accent)] opacity-60"
            size={36}
            aria-hidden="true"
          />
          <p className="text-base font-semibold text-[var(--ink-primary)]">{vi.cases.empty}</p>
          {canCreate ? (
            <div className="mt-4">
              <Button variant="secondary" onClick={() => setIsCreating(true)}>
                {vi.cases.createBtn}
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border-hairline)]">
          <table className="w-full min-w-[700px] border-collapse text-left text-sm">
            <caption className="sr-only">{vi.cases.title}</caption>
            <thead className="bg-[var(--bg-surface)] text-xs text-[var(--ink-secondary)]">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  {vi.cases.columns.title}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {vi.cases.columns.status}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {vi.cases.columns.createdBy}
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  {vi.cases.columns.createdAt}
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  {vi.cases.columns.actions}
                </th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => {
                const isOpen = c.status === "open";
                return (
                  <tr
                    key={c.id}
                    className="border-t border-[var(--border-hairline)] hover:bg-[var(--bg-surface-hover)] transition"
                  >
                    <td className="px-4 py-3.5 font-medium">
                      <Link
                        to="/app/ho-so/$caseId"
                        params={{ caseId: c.id }}
                        className="font-semibold text-[var(--ink-primary)] hover:underline"
                      >
                        {c.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          isOpen
                            ? "bg-[color-mix(in_srgb,var(--status-warning)_15%,transparent)] text-[#fcd34d]"
                            : "bg-[color-mix(in_srgb,var(--status-good)_15%,transparent)] text-[#4ade80]"
                        }`}
                      >
                        {vi.cases.statuses[c.status] ?? c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[var(--ink-secondary)]">
                      {c.created_by}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[var(--ink-secondary)]">
                      {formatDateTime(c.created_at)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        to="/app/ho-so/$caseId"
                        params={{ caseId: c.id }}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                      >
                        Mở hồ sơ
                        <ArrowRight size={13} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal tạo hồ sơ mới */}
      <ConfirmDialog
        open={isCreating}
        title={vi.cases.createModal.title}
        confirmText={vi.cases.createModal.submit}
        cancelText={vi.cases.createModal.cancel}
        disabled={!newTitle.trim()}
        loading={createCaseMutation.isPending}
        onConfirm={() => void handleCreateCase()}
        onCancel={() => {
          setIsCreating(false);
          setNewTitle("");
        }}
      >
        <TextField
          label={vi.cases.createModal.titleLabel}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder={vi.cases.createModal.titlePlaceholder}
          autoFocus
        />
      </ConfirmDialog>
    </div>
  );
}
