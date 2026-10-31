import { Link, useParams, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Download,
  FileEdit,
  FileText,
  PieChart,
  Plus,
  Printer,
  SlidersHorizontal,
  Truck,
} from "lucide-react";

import { useAlerts } from "@/entities/alert";
import {
  useCase,
  useConfirmAllocationPlan,
  useCreateAllocationPlan,
  useCreateDraft,
  useDraft,
  useGenerateDraft,
} from "@/entities/draft";
import { useProvinces } from "@/entities/forecast";
import { hasAnyRole, useCurrentUser } from "@/entities/user";
import { exportToCsv } from "@/shared/lib/exportCsv";
import { formatCount, formatCurrency, formatDateTime } from "@/shared/lib/format";
import { vi } from "@/shared/i18n/vi";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { ErrorState } from "@/shared/ui/ErrorState";
import { Skeleton } from "@/shared/ui/Skeleton";
import { TextField } from "@/shared/ui/TextField";
import { HealthEconomicsEvaluation } from "./HealthEconomicsEvaluation";
import { InterProvincialSupplyTransferModal } from "./InterProvincialSupplyTransferModal";
import { PilotEvaluationBenchmark } from "./PilotEvaluationBenchmark";

const OFFICER_ROLES = ["officer", "approver", "admin"] as const;

export function CaseDetailPage() {
  const router = useRouter();
  const { caseId } = useParams({ from: "/app/ho-so/$caseId" });
  const user = useCurrentUser();
  const canAct = hasAnyRole(user, ...OFFICER_ROLES);

  const caseQuery = useCase(caseId);
  const provincesQuery = useProvinces();
  const alertsQuery = useAlerts();

  const caseData = caseQuery.data;
  const draftQuery = useDraft(caseData?.latest_draft_id);

  // States cho modal phân bổ (S8)
  const [isAllocating, setIsAllocating] = useState(false);
  const [budgetInput, setBudgetInput] = useState("1000000000"); // 1 tỷ mặc định
  const [showTransferModal, setShowTransferModal] = useState(false);
  const createAllocationMutation = useCreateAllocationPlan(caseId);
  const confirmPlanMutation = useConfirmAllocationPlan(caseId);

  // States cho modal AI sinh dự thảo
  const [isGenerating, setIsGenerating] = useState(false);
  const [draftType, setDraftType] = useState<"b2g" | "b2b">("b2g");
  const [extraInstructions, setExtraInstructions] = useState("");
  const generateDraftMutation = useGenerateDraft(caseId);

  // States cho modal soạn dự thảo thủ công
  const [isCreatingManual, setIsCreatingManual] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualContent, setManualContent] = useState("");
  const createDraftMutation = useCreateDraft(caseId);

  const provincesMap = new Map((provincesQuery.data?.items ?? []).map((p) => [p.province_id, p]));
  const allAlerts = alertsQuery.data ?? [];
  const attachedAlertIds = new Set(
    caseData?.alert_ids ?? (caseData?.alert_id ? [caseData.alert_id] : [])
  );
  const attachedAlerts = allAlerts.filter((a) => attachedAlertIds.has(a.id));

  async function handleCreateAllocation() {
    const budget = Number(budgetInput);
    if (!budget || budget <= 0) return;

    const items = attachedAlerts.map((a) => ({
      province_id: a.province_id,
      cases_pred: 150,
      cost: 200_000_000,
    }));

    await createAllocationMutation.mutateAsync({
      budget,
      items:
        items.length > 0
          ? items
          : [{ province_id: "ho_chi_minh", cases_pred: 200, cost: 300_000_000 }],
    });
    setIsAllocating(false);
  }

  async function handleGenerateDraft() {
    const body: {
      draft_type: "b2g" | "b2b";
      title: string;
      extra_instructions?: string;
      plan_id?: string;
    } = {
      draft_type: draftType,
      title:
        draftType === "b2g"
          ? "Công điện khẩn phòng chống dịch Sốt xuất huyết"
          : "Báo cáo giám sát dịch tễ",
    };
    if (caseData?.latest_plan && caseData.latest_plan.status === "confirmed") {
      body.plan_id = caseData.latest_plan.id;
    }
    if (extraInstructions.trim()) {
      body.extra_instructions = extraInstructions.trim();
    }
    const res = await generateDraftMutation.mutateAsync(body);
    setIsGenerating(false);
    void router.navigate({
      to: "/app/du-thao/$draftId",
      params: { draftId: res.id },
    });
  }

  async function handleCreateManualDraft() {
    if (!manualTitle.trim() || !manualContent.trim()) return;
    const res = await createDraftMutation.mutateAsync({
      draft_type: "b2g",
      title: manualTitle.trim(),
      content: manualContent.trim(),
      created_by: user?.username ?? "officer",
    });
    setIsCreatingManual(false);
    void router.navigate({
      to: "/app/du-thao/$draftId",
      params: { draftId: res.id },
    });
  }

  function handleExportPlanCsv() {
    if (!caseData?.latest_plan) return;
    const plan = caseData.latest_plan;
    const filename = `DengueSense_Phan_Bo_${caseId}`;
    exportToCsv(
      filename,
      [
        {
          header: "Tỉnh / Thành phố",
          key: (a) => provincesMap.get(a.province_id)?.name ?? a.province_id,
        },
        { header: "Mã tỉnh", key: (a) => a.province_id },
        { header: "Kinh phí phân bổ (VNĐ)", key: (a) => a.amount },
        {
          header: "Vật tư hóa chất",
          key: (a) => (a.supplies ? `${a.supplies} L/kg Cloramin B` : "Theo định mức"),
        },
        {
          header: "Giường bệnh cấp cứu",
          key: (a) => (a.beds ? `${a.beds} giường` : "Theo định mức"),
        },
        {
          header: "Đội phản ứng nhanh",
          key: (a) => (a.teams ? `${a.teams} đội` : "Theo tổ cơ động"),
        },
        { header: "Căn cứ & Giải trình", key: (a) => a.explanation },
      ],
      plan.allocations
    );
  }

  if (caseQuery.isPending) {
    return (
      <div role="status" aria-label={vi.common.loading}>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (caseQuery.isError || !caseData) {
    return <ErrorState error={caseQuery.error} onRetry={() => void caseQuery.refetch()} />;
  }

  const latestDraft = draftQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/app/ho-so"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] mb-2"
        >
          <ArrowLeft size={14} />
          {vi.cases.detail.back}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--ink-primary)]">
              {caseData.title}
            </h1>
            <p className="mt-1 text-xs text-[var(--ink-secondary)]">
              {vi.cases.detail.createdBy}:{" "}
              <strong className="text-[var(--ink-primary)]">{caseData.created_by}</strong> ·{" "}
              {vi.cases.detail.createdAt}: {formatDateTime(caseData.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="px-3 py-1.5 text-xs gap-1.5 print:hidden"
              onClick={() => window.print()}
              title="In hoặc xuất PDF toàn bộ hồ sơ phương án can thiệp dịch tễ và đánh giá kinh tế y tế"
            >
              <Printer size={14} />
              In / Xuất PDF Hồ sơ
            </Button>
            <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-ink)]">
              {vi.cases.statuses[caseData.status] ?? caseData.status}
            </span>
          </div>
        </div>
      </div>

      {/* Workflow Stepper: Tiến trình ra quyết định dịch tễ 4 bước */}
      <div className="glass-panel rounded-2xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500 text-white font-bold text-xs">
              1
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-400">Tiếp nhận cảnh báo</p>
              <p className="text-[10px] text-[var(--ink-muted)]">
                {attachedAlerts.length} tỉnh đính kèm
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500 text-white font-bold text-xs">
              2
            </div>
            <div>
              <p className="text-xs font-semibold text-indigo-400">Tối ưu phân bổ</p>
              <p className="text-[10px] text-[var(--ink-muted)]">Google OR-Tools</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500 text-white font-bold text-xs">
              3
            </div>
            <div>
              <p className="text-xs font-semibold text-purple-400">Soạn thảo GenAI</p>
              <p className="text-[10px] text-[var(--ink-muted)]">Kiểm soát Guardrails</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-white font-bold text-xs">
              4
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-400">Duyệt & Ban hành</p>
              <p className="text-[10px] text-[var(--ink-muted)]">Quy tắc 4 mắt</p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: Cảnh báo đính kèm */}
      <Card>
        <h2 className="text-base font-semibold text-[var(--ink-primary)] mb-3 flex items-center gap-2">
          <AlertTriangle size={18} className="text-[var(--status-warning)]" />
          {vi.cases.detail.attachedAlerts} ({attachedAlerts.length})
        </h2>
        {attachedAlerts.length === 0 ? (
          <p className="text-sm text-[var(--ink-secondary)]">{vi.cases.detail.noAlerts}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {attachedAlerts.map((alert) => {
              const prov = provincesMap.get(alert.province_id);
              return (
                <div
                  key={alert.id}
                  className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3 flex items-center justify-between"
                >
                  <div>
                    <Link
                      to="/app/tinh/$provinceId"
                      params={{ provinceId: alert.province_id }}
                      className="font-medium text-sm text-[var(--ink-primary)] hover:underline"
                    >
                      {prov?.name ?? alert.province_id}
                    </Link>
                    <div className="text-xs text-[var(--ink-secondary)]">
                      {prov?.region ?? "Vùng"} · Lượt: {alert.run_id}
                    </div>
                  </div>
                  <span className="rounded-full bg-[var(--bg-surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--status-critical-ink)]">
                    {alert.status === "open" ? vi.alerts.statusOpen : vi.alerts.statusClosed}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* SECTION 2: Phân bổ nguồn lực (Layer 2 - S8) */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-[var(--ink-primary)] flex items-center gap-2">
                <PieChart size={18} className="text-[var(--accent)]" />
                {vi.cases.detail.allocationPlan}
              </h2>
              {caseData?.latest_plan &&
                (caseData.latest_plan.status === "confirmed" ? (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 dark:border-transparent dark:bg-[color-mix(in_srgb,var(--status-good)_18%,transparent)] dark:text-[#4ade80]">
                    <CheckCircle2 size={12} strokeWidth={2.5} />
                    Đã xác nhận (v{caseData.latest_plan.version})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-200 dark:border-transparent dark:bg-[color-mix(in_srgb,var(--status-warning)_18%,transparent)] dark:text-[#fbbf24]">
                    Bản nháp (chưa xác nhận)
                  </span>
                ))}
            </div>
            <p className="text-xs text-[var(--ink-secondary)] mt-0.5">{vi.allocation.lead}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {caseData?.latest_plan && (
              <>
                {canAct && caseData.latest_plan.status !== "confirmed" && (
                  <Button
                    variant="primary"
                    className="px-3 py-1 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={confirmPlanMutation.isPending}
                    onClick={async () => {
                      if (caseData.latest_plan) {
                        await confirmPlanMutation.mutateAsync(caseData.latest_plan.id);
                      }
                    }}
                    title="Xác nhận phương án phân bổ để đưa số liệu vào dự thảo văn bản"
                  >
                    <CheckCircle2 size={14} />
                    {confirmPlanMutation.isPending ? "Đang xác nhận..." : "Xác nhận phương án"}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  className="px-3 py-1 text-xs gap-1.5"
                  onClick={() => window.dispatchEvent(new CustomEvent("open-scenario-comparison"))}
                  title="Phân tích độ nhạy ngân sách và so sánh đối chứng đa phương án A/B (+20% / -20%)"
                >
                  <SlidersHorizontal size={14} className="text-indigo-500" />
                  Độ nhạy & So sánh A/B
                </Button>
                <Button
                  variant="secondary"
                  className="px-3 py-1 text-xs gap-1.5"
                  onClick={handleExportPlanCsv}
                  title="Tải bảng phương án phân bổ nguồn lực MILP định dạng CSV cho Excel"
                >
                  <Download size={14} />
                  Xuất CSV (Excel)
                </Button>
                <Button
                  variant="secondary"
                  className="px-3 py-1 text-xs gap-1.5 border-blue-500/30 text-blue-600 dark:text-blue-400"
                  onClick={() => setShowTransferModal(true)}
                  title="Điều phối và chi viện kho vật tư liên tỉnh giữa các CDC khu vực"
                >
                  <Truck size={14} />
                  Chi viện liên tỉnh
                </Button>
              </>
            )}
            {canAct ? (
              <Button
                variant="secondary"
                className="px-3 py-1 text-xs gap-1.5"
                onClick={() => setIsAllocating(true)}
              >
                <Plus size={14} />
                {vi.cases.detail.createPlan}
              </Button>
            ) : null}
          </div>
        </div>

        {/* Nội dung kết quả phân bổ */}
        {caseData?.latest_plan ? (
          <div className="rounded-xl border border-[var(--border-hairline)] p-4 bg-[var(--bg-surface)] space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-[var(--bg-surface-2)] p-3">
                <span className="block text-xs text-[var(--ink-secondary)]">Ngân sách dự kiến</span>
                <span className="text-lg font-semibold tabular-nums text-[var(--ink-primary)]">
                  {formatCurrency(caseData.latest_plan.budget)}
                </span>
              </div>
              <div className="rounded-lg bg-[var(--bg-surface-2)] p-3">
                <span className="block text-xs text-[var(--ink-secondary)]">
                  {vi.allocation.totalCost}
                </span>
                <span className="text-lg font-semibold tabular-nums text-[var(--accent)]">
                  {formatCurrency(caseData.latest_plan.total_cost)}
                </span>
              </div>
              <div className="rounded-lg bg-[var(--bg-surface-2)] p-3">
                <span className="block text-xs text-[var(--ink-secondary)]">
                  {vi.allocation.casesPrevented}
                </span>
                <span className="text-lg font-semibold tabular-nums text-[var(--status-good-ink)]">
                  ≈ {formatCount(caseData.latest_plan.estimated_cases_prevented)} ca
                </span>
              </div>
            </div>

            <HealthEconomicsEvaluation
              casesPrevented={caseData.latest_plan.estimated_cases_prevented}
              interventionCost={caseData.latest_plan.total_cost}
            />

            <PilotEvaluationBenchmark
              casesPrevented={caseData.latest_plan.estimated_cases_prevented}
              interventionCost={caseData.latest_plan.total_cost}
              provinceCount={caseData.latest_plan.allocations.length}
              caseTitle={caseData.title}
            />

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b border-[var(--border-hairline)] text-[var(--ink-secondary)]">
                  <tr>
                    <th className="py-2">{vi.allocation.columns.province}</th>
                    <th className="py-2">Vật tư y tế</th>
                    <th className="py-2">Giường bệnh</th>
                    <th className="py-2">Đội cơ động</th>
                    <th className="py-2">{vi.allocation.columns.amount}</th>
                    <th className="py-2">{vi.allocation.columns.explanation}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-hairline)]">
                  {caseData.latest_plan.allocations.map((alloc, idx) => {
                    const prov = provincesMap.get(alloc.province_id);
                    const provName = prov?.name ?? alloc.province_id;
                    const suppliesText = alloc.supplies
                      ? `${alloc.supplies}L Cloramin B / vật tư`
                      : "Theo cơ số y tế";
                    const bedsText = alloc.beds ? `${alloc.beds} giường cấp cứu` : "Theo định mức";
                    const teamsText = alloc.teams
                      ? `${alloc.teams} đội phản ứng nhanh`
                      : "Theo tổ cơ động";

                    return (
                      <tr key={alloc.province_id || idx}>
                        <td className="py-2.5 font-medium text-[var(--ink-primary)] whitespace-nowrap">
                          {provName}
                        </td>
                        <td className="py-2.5 text-[var(--ink-secondary)] whitespace-nowrap">
                          {suppliesText}
                        </td>
                        <td className="py-2.5 text-[var(--ink-secondary)] whitespace-nowrap">
                          {bedsText}
                        </td>
                        <td className="py-2.5 text-[var(--ink-secondary)] whitespace-nowrap">
                          {teamsText}
                        </td>
                        <td className="py-2.5 font-semibold text-[var(--accent)] tabular-nums whitespace-nowrap">
                          {formatCurrency(alloc.amount)}
                        </td>
                        <td className="py-2.5 text-[var(--ink-secondary)] min-w-[200px]">
                          {alloc.explanation}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border-hairline)] p-6 text-center text-xs text-[var(--ink-secondary)]">
            <p>Chưa có phương án phân bổ nguồn lực nào cho hồ sơ này.</p>
            {canAct ? (
              <Button
                variant="secondary"
                className="mt-3 px-3 py-1.5 text-xs gap-1.5 mx-auto"
                onClick={() => setIsAllocating(true)}
              >
                <Plus size={14} />
                {vi.cases.detail.createPlan}
              </Button>
            ) : null}
          </div>
        )}
      </Card>

      {/* SECTION 3: Dự thảo văn bản chỉ đạo (Layer 3 - S9 hub) */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--ink-primary)] flex items-center gap-2">
              <FileText size={18} className="text-[var(--accent)]" />
              {vi.cases.detail.drafts}
            </h2>
            <p className="text-xs text-[var(--ink-secondary)] mt-0.5">{vi.drafts.lead}</p>
          </div>
          {canAct ? (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                className="px-3 py-1 text-xs gap-1.5"
                onClick={() => {
                  setManualTitle(`Dự thảo công điện — ${caseData.title}`);
                  setManualContent("");
                  setIsCreatingManual(true);
                }}
              >
                <FileEdit size={14} />
                {vi.cases.detail.createDraft}
              </Button>
              <Button
                variant="primary"
                className="px-3 py-1 text-xs gap-1.5"
                onClick={() => setIsGenerating(true)}
              >
                <Bot size={14} />
                {vi.cases.detail.generateDraft}
              </Button>
            </div>
          ) : null}
        </div>

        {latestDraft ? (
          <div className="rounded-xl border border-[var(--border-hairline)] p-4 bg-[var(--bg-surface)] flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="rounded-sm bg-[var(--bg-surface-2)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                  {latestDraft.draft_type.toUpperCase()}
                </span>
                <span className="font-semibold text-sm text-[var(--ink-primary)]">
                  {latestDraft.title}
                </span>
              </div>
              <p className="text-xs text-[var(--ink-secondary)]">
                Phiên bản: v{latestDraft.version} · Soạn bởi: {latestDraft.created_by} · Trạng thái:{" "}
                <strong className="text-[var(--ink-primary)]">
                  {vi.drafts.statuses[latestDraft.status] ?? latestDraft.status}
                </strong>
              </p>
            </div>
            <Link to="/app/du-thao/$draftId" params={{ draftId: latestDraft.id }}>
              <Button variant="primary" className="px-4 py-1.5 text-xs">
                Xem & Phê duyệt dự thảo
              </Button>
            </Link>
          </div>
        ) : (
          <p className="text-sm text-[var(--ink-secondary)]">{vi.cases.detail.noDrafts}</p>
        )}
      </Card>

      {/* Modal Lập phương án phân bổ (S8) */}
      <ConfirmDialog
        open={isAllocating}
        title={vi.allocation.title}
        confirmText={vi.allocation.submit}
        cancelText="Huỷ bỏ"
        loading={createAllocationMutation.isPending}
        onConfirm={() => void handleCreateAllocation()}
        onCancel={() => setIsAllocating(false)}
      >
        <div className="space-y-3">
          <TextField
            label={vi.allocation.budgetLabel}
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            placeholder="1000000000"
            type="number"
          />
          <p className="text-xs text-[var(--ink-secondary)]">{vi.allocation.budgetHelp}</p>
        </div>
      </ConfirmDialog>

      {/* Modal AI sinh dự thảo văn bản */}
      <ConfirmDialog
        open={isGenerating}
        title={vi.drafts.generateModal.title}
        confirmText={vi.drafts.generateModal.submit}
        cancelText="Huỷ bỏ"
        loading={generateDraftMutation.isPending}
        onConfirm={() => void handleGenerateDraft()}
        onCancel={() => setIsGenerating(false)}
      >
        <div className="space-y-3">
          {caseData?.latest_plan &&
            (caseData.latest_plan.status === "confirmed" ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-2.5 text-xs text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:text-emerald-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>
                    Đính kèm phương án phân bổ v{caseData.latest_plan.version} (
                    {formatCurrency(caseData.latest_plan.total_cost)})
                  </span>
                </div>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  Đã xác nhận
                </span>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-2.5 text-xs text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300 flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Phương án phân bổ hiện tại đang là bản nháp. Dự thảo sẽ không có bảng số liệu
                    phân bổ trừ khi được xác nhận.
                  </span>
                </div>
                {canAct && (
                  <Button
                    variant="secondary"
                    className="self-end px-2.5 py-1 text-xs border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200"
                    disabled={confirmPlanMutation.isPending}
                    onClick={async () => {
                      if (caseData.latest_plan) {
                        await confirmPlanMutation.mutateAsync(caseData.latest_plan.id);
                      }
                    }}
                  >
                    <CheckCircle2 size={12} className="mr-1" />
                    {confirmPlanMutation.isPending ? "Đang xác nhận..." : "Xác nhận phương án ngay"}
                  </Button>
                )}
              </div>
            ))}
          <div>
            <label className="block text-xs font-semibold text-[var(--ink-secondary)] mb-1">
              {vi.drafts.generateModal.draftType}
            </label>
            <select
              value={draftType}
              onChange={(e) => setDraftType(e.target.value as "b2g" | "b2b")}
              className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--ink-primary)] outline-none"
            >
              <option value="b2g">{vi.drafts.type["b2g"]}</option>
              <option value="b2b">{vi.drafts.type["b2b"]}</option>
            </select>
          </div>
          <TextField
            label={vi.drafts.generateModal.instructions}
            value={extraInstructions}
            onChange={(e) => setExtraInstructions(e.target.value)}
            placeholder="Ví dụ: Nhấn mạnh ưu tiên can thiệp tại các ổ dịch quận 8 và huyện Bình Chánh"
          />
        </div>
      </ConfirmDialog>

      {/* Modal Soạn dự thảo thủ công */}
      <ConfirmDialog
        open={isCreatingManual}
        title={vi.cases.detail.createDraft}
        confirmText="Tạo dự thảo"
        cancelText="Huỷ bỏ"
        disabled={!manualTitle.trim() || !manualContent.trim()}
        loading={createDraftMutation.isPending}
        onConfirm={() => void handleCreateManualDraft()}
        onCancel={() => setIsCreatingManual(false)}
      >
        <div className="space-y-3">
          <TextField
            label="Tiêu đề văn bản"
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
          />
          <div>
            <label className="block text-xs font-semibold text-[var(--ink-secondary)] mb-1">
              Nội dung văn bản (hỗ trợ Markdown)
            </label>
            <textarea
              rows={5}
              value={manualContent}
              onChange={(e) => setManualContent(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-3 text-sm text-[var(--ink-primary)] outline-none"
              placeholder="Nhập nội dung văn bản chỉ đạo..."
            />
          </div>
        </div>
      </ConfirmDialog>

      {/* Modal Điều phối & Chi viện kho vật tư liên tỉnh */}
      <InterProvincialSupplyTransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        initialTargetProvinceId={caseData.latest_plan?.allocations[0]?.province_id || "angiang"}
      />
    </div>
  );
}
