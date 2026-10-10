import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileCheck2,
  FileEdit,
  History,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import {
  useCase,
  useDispatchOrder,
  useDraft,
  useSubmitReview,
  useUpdateDraft,
  type DispatchOrder,
} from "@/entities/draft";
import { hasAnyRole, useCurrentUser } from "@/entities/user";
import { formatDateTime } from "@/shared/lib/format";
import { vi } from "@/shared/i18n/vi";
import { Alert as UiAlert } from "@/shared/ui/Alert";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { ErrorState } from "@/shared/ui/ErrorState";
import { Skeleton } from "@/shared/ui/Skeleton";
import { TextField } from "@/shared/ui/TextField";

export function DraftPage() {
  const { draftId } = useParams({ from: "/app/du-thao/$draftId" });
  const user = useCurrentUser();

  const isApprover = hasAnyRole(user, "approver", "admin");
  const isOfficer = hasAnyRole(user, "officer", "analyst", "admin");

  const draftQuery = useDraft(draftId);
  const draft = draftQuery.data;
  const caseQuery = useCase(draft?.case_id);

  const updateDraftMutation = useUpdateDraft(draftId);
  const submitReviewMutation = useSubmitReview(draftId);
  const dispatchOrderMutation = useDispatchOrder(draftId);

  // Chế độ sửa văn bản
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  // Modals cho phê duyệt, từ chối, phát hành
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showDispatchDialog, setShowDispatchDialog] = useState(false);
  const [dispatchRecipient, setDispatchRecipient] = useState<string>(
    vi.drafts.confirmDispatch.recipientDefault
  );
  const [dispatchedOrder, setDispatchedOrder] = useState<DispatchOrder | null>(null);

  if (draftQuery.isPending) {
    return (
      <div role="status" aria-label={vi.common.loading}>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (draftQuery.isError || !draft) {
    return <ErrorState error={draftQuery.error} onRetry={() => void draftQuery.refetch()} />;
  }

  // Kiểm tra quy tắc 4 mắt (four-eyes)
  const isAuthor = draft.created_by === user?.username;
  const isB2G = draft.draft_type === "b2g";
  const fourEyesBlocked = isB2G && isAuthor;

  // Kiểm tra còn chỗ cần bổ sung không
  const hasIncompletePlaceholder = draft.content.includes("[CẦN BỔ SUNG]");

  function startEditing() {
    if (!draft) return;
    setEditTitle(draft.title);
    setEditContent(draft.content);
    setIsEditing(true);
  }

  async function handleSaveDraft() {
    await updateDraftMutation.mutateAsync({
      title: editTitle.trim(),
      content: editContent.trim(),
      updated_by: user?.username ?? "officer",
    });
    setIsEditing(false);
  }

  async function handleApprove() {
    if (!draft) return;
    await submitReviewMutation.mutateAsync({
      reviewer_id: user?.username ?? "approver",
      draft_version: draft.version,
      action: "approve",
    });
    setShowApproveDialog(false);
  }

  async function handleReject() {
    if (!draft || !rejectReason.trim()) return;
    await submitReviewMutation.mutateAsync({
      reviewer_id: user?.username ?? "approver",
      draft_version: draft.version,
      action: "reject",
      note: rejectReason.trim(),
    });
    setShowRejectDialog(false);
    setRejectReason("");
  }

  async function handleDispatch() {
    if (!draft || !dispatchRecipient.trim()) return;
    const order = await dispatchOrderMutation.mutateAsync({
      recipient: dispatchRecipient.trim(),
      dispatched_by: user?.username ?? "officer",
    });
    setDispatchedOrder(order);
    setShowDispatchDialog(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/app/ho-so/$caseId"
          params={{ caseId: draft.case_id }}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] mb-2"
        >
          <ArrowLeft size={14} />
          {vi.drafts.backToCase}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-sm bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-ink)]">
                {vi.drafts.type[draft.draft_type] ?? draft.draft_type.toUpperCase()}
              </span>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--ink-primary)]">
                {draft.title}
              </h1>
            </div>
            <p className="mt-1 text-xs text-[var(--ink-secondary)]">
              Phiên bản: <strong>v{draft.version}</strong> · Người soạn:{" "}
              <strong>{draft.created_by}</strong> · Cập nhật lúc: {formatDateTime(draft.updated_at)}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              draft.status === "APPROVED"
                ? "bg-[color-mix(in_srgb,var(--status-good)_15%,transparent)] text-[#4ade80]"
                : draft.status === "REJECTED"
                  ? "bg-[color-mix(in_srgb,var(--status-critical)_15%,transparent)] text-[#f87171]"
                  : "bg-[color-mix(in_srgb,var(--status-warning)_15%,transparent)] text-[#fcd34d]"
            }`}
          >
            {vi.drafts.statuses[draft.status] ?? draft.status}
          </span>
        </div>
      </div>

      {fourEyesBlocked && isApprover ? (
        <UiAlert tone="warning">{vi.drafts.fourEyesNotice}</UiAlert>
      ) : null}

      {/* Grid 2 cột: Trái (Editor/Viewer 60%) - Phải (Evidence + Guardrails + Dispatch 40%) */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* CỘT TRÁI (60% ~ 7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card>
            <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3 mb-4">
              <h2 className="text-base font-semibold text-[var(--ink-primary)] flex items-center gap-2">
                <FileEdit size={18} className="text-[var(--accent)]" />
                {vi.drafts.editorTitle}
              </h2>
              {isOfficer && draft.status !== "APPROVED" && (
                <div>
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        className="px-3 py-1 text-xs"
                        onClick={() => setIsEditing(false)}
                      >
                        Huỷ
                      </Button>
                      <Button
                        variant="primary"
                        className="px-3 py-1 text-xs"
                        loading={updateDraftMutation.isPending}
                        onClick={() => void handleSaveDraft()}
                      >
                        {vi.drafts.saveBtn}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      className="px-3 py-1 text-xs"
                      onClick={startEditing}
                    >
                      {vi.drafts.editBtn}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4">
                <TextField
                  label="Tiêu đề văn bản"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink-secondary)] mb-1">
                    Nội dung văn bản (Markdown)
                  </label>
                  <textarea
                    rows={16}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full font-mono rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-3 text-sm text-[var(--ink-primary)] outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-2)] p-6 shadow-inner">
                {/* Tiêu ngữ công văn hành chính */}
                <div className="mb-6 border-b border-white/10 pb-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--ink-secondary)]">
                    CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                  </p>
                  <p className="text-[11px] font-medium text-[var(--ink-muted)]">
                    Độc lập - Tự do - Hạnh phúc
                  </p>
                  <div className="mx-auto my-2 h-[1px] w-24 bg-white/20" />
                  <p className="text-xs text-[var(--ink-muted)] font-mono">
                    Số hiệu: {draft.draft_type.toUpperCase()}-{draft.id.slice(0, 8)}
                  </p>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none text-[var(--ink-primary)] whitespace-pre-wrap leading-relaxed font-sans">
                  {draft.content}
                </div>
              </div>
            )}
          </Card>

          {/* Action Bar thẩm định và ban hành */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--ink-primary)]">
                  {vi.drafts.reviewTitle}
                </h3>
                <p className="text-xs text-[var(--ink-secondary)]">
                  Thao tác kiểm duyệt văn bản theo thẩm quyền.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isApprover && draft.status === "PENDING_REVIEW" && (
                  <>
                    <Button
                      variant="secondary"
                      className="px-3 py-1.5 text-xs text-[var(--status-critical)]"
                      onClick={() => setShowRejectDialog(true)}
                    >
                      <XCircle size={14} />
                      {vi.drafts.actions.reject}
                    </Button>
                    <Button
                      variant="primary"
                      className="px-4 py-1.5 text-xs gap-1.5"
                      disabled={fourEyesBlocked || hasIncompletePlaceholder}
                      onClick={() => setShowApproveDialog(true)}
                    >
                      <FileCheck2 size={14} />
                      {vi.drafts.actions.approve}
                    </Button>
                  </>
                )}

                {isOfficer && draft.status === "APPROVED" && (
                  <Button
                    variant="primary"
                    className="px-4 py-1.5 text-xs gap-1.5"
                    onClick={() => setShowDispatchDialog(true)}
                  >
                    <Send size={14} />
                    {vi.drafts.actions.dispatch}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* CỘT PHẢI (40% ~ 5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Card Guardrails */}
          <Card>
            <h2 className="text-sm font-semibold text-[var(--ink-primary)] flex items-center gap-2 mb-3">
              <ShieldCheck size={18} className="text-[var(--status-good)]" />
              {vi.drafts.guardrailsTitle}
            </h2>
            <div className="space-y-2.5">
              {Object.entries(vi.drafts.guardrailItems).map(([key, label]) => (
                <div
                  key={key}
                  className="flex items-start gap-2.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2.5"
                >
                  <CheckCircle2 size={16} className="text-[var(--status-good)] shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-semibold uppercase tracking-wider text-[var(--ink-muted)] block text-[10px]">
                      {key.toUpperCase()}
                    </span>
                    <span className="text-[var(--ink-primary)]">{label}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg bg-[color-mix(in_srgb,var(--status-good)_10%,transparent)] p-2 text-center text-xs font-medium text-[var(--status-good)]">
              {vi.drafts.guardrailsPassed}
            </div>
          </Card>

          {/* Card Căn cứ số liệu nguồn (Evidence) */}
          <Card>
            <h2 className="text-sm font-semibold text-[var(--ink-primary)] flex items-center gap-2 mb-2">
              <History size={16} className="text-[var(--accent)]" />
              {vi.drafts.evidenceTitle}
            </h2>
            <div className="text-xs text-[var(--ink-secondary)] space-y-2">
              <p>
                <strong>Hồ sơ gốc:</strong> {caseQuery.data?.title ?? draft.case_id}
              </p>
              <p>
                <strong>Căn cứ:</strong> Dự báo chuỗi thời gian M4-R2 (tầm 3 tháng) và kết quả tối
                ưu ngân sách phòng dịch.
              </p>
              <p>
                <strong>Hash chữ ký nội dung:</strong>{" "}
                <code className="rounded bg-[var(--bg-surface-2)] px-1 py-0.5 text-[11px] font-mono">
                  {draft.content_hash}
                </code>
              </p>
            </div>
          </Card>

          {/* Card S10: Lệnh điều phối & Trạng thái gửi */}
          {(draft.status === "APPROVED" || dispatchedOrder) && (
            <Card>
              <h2 className="text-sm font-semibold text-[var(--ink-primary)] flex items-center gap-2 mb-3">
                <Send size={16} className="text-[var(--accent)]" />
                {vi.dispatch.title}
              </h2>
              <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--ink-secondary)]">Đơn vị tiếp nhận:</span>
                  <strong className="text-[var(--ink-primary)]">
                    {dispatchedOrder?.recipient ?? "CDC các tỉnh thành trọng điểm"}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--ink-secondary)]">Trạng thái phát hành:</span>
                  <span className="rounded-full bg-[color-mix(in_srgb,var(--status-good)_15%,transparent)] px-2 py-0.5 font-semibold text-[#4ade80]">
                    {vi.dispatch.statuses["SENT"]}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--ink-secondary)]">Thời gian phát hành:</span>
                  <span className="tabular-nums text-[var(--ink-secondary)]">
                    {formatDateTime(dispatchedOrder?.created_at ?? draft.updated_at)}
                  </span>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Modal Phê duyệt văn bản */}
      <ConfirmDialog
        open={showApproveDialog}
        title={vi.drafts.confirmApprove.title}
        description={vi.drafts.confirmApprove.desc}
        confirmText={vi.drafts.actions.approve}
        loading={submitReviewMutation.isPending}
        onConfirm={() => void handleApprove()}
        onCancel={() => setShowApproveDialog(false)}
      />

      {/* Modal Từ chối văn bản */}
      <ConfirmDialog
        open={showRejectDialog}
        title={vi.drafts.confirmReject.title}
        description={vi.drafts.confirmReject.desc}
        confirmText={vi.drafts.actions.reject}
        variant="danger"
        disabled={!rejectReason.trim()}
        loading={submitReviewMutation.isPending}
        onConfirm={() => void handleReject()}
        onCancel={() => {
          setShowRejectDialog(false);
          setRejectReason("");
        }}
      >
        <textarea
          rows={3}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Nhập lý do từ chối cụ thể..."
          className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-2.5 text-xs text-[var(--ink-primary)] outline-none"
        />
      </ConfirmDialog>

      {/* Modal Ban hành & Gửi lệnh điều phối (S10) */}
      <ConfirmDialog
        open={showDispatchDialog}
        title={vi.drafts.confirmDispatch.title}
        description={vi.drafts.confirmDispatch.desc(dispatchRecipient)}
        confirmText={vi.drafts.confirmDispatch.submit}
        loading={dispatchOrderMutation.isPending}
        onConfirm={() => void handleDispatch()}
        onCancel={() => setShowDispatchDialog(false)}
      >
        <TextField
          label={vi.drafts.confirmDispatch.recipientLabel}
          value={dispatchRecipient}
          onChange={(e) => setDispatchRecipient(e.target.value)}
        />
      </ConfirmDialog>
    </div>
  );
}
