import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  api,
  HEADER_IDEMPOTENCY_KEY,
  newIdempotencyKey,
  qk,
  unwrap,
  type AllocationPlan,
  type Case,
  type CaseDetail,
  type CreateAllocationPlanRequest,
  type CreateCaseRequest,
  type CreateDraftRequest,
  type DispatchDraft,
  type DispatchOrder,
  type GenerateDraftCaseRequest,
  type ReviewResult,
  type SubmitReviewRequest,
  type UpdateDraftRequest,
} from "@/shared/api";

export interface CaseFilter {
  status?: "open" | "completed" | "archived" | "all";
}

/** Danh sách hồ sơ xử lý phòng dịch. */
export function useCases(filter: CaseFilter = {}) {
  return useQuery({
    queryKey: qk.cases(filter),
    queryFn: async () =>
      unwrap(
        await api.GET("/cases", {
          params: { query: filter },
        })
      ),
    staleTime: 30_000,
  });
}

/** Chi tiết hồ sơ gồm cảnh báo đính kèm, phương án phân bổ và dự thảo mới nhất. */
export function useCase(caseId: string | undefined) {
  return useQuery({
    queryKey: qk.case(caseId ?? "none"),
    enabled: !!caseId,
    queryFn: async () =>
      unwrap(
        await api.GET("/cases/{case_id}", {
          params: { path: { case_id: caseId as string } },
        })
      ),
    staleTime: 30_000,
  });
}

/** Tạo hồ sơ xử lý mới từ cảnh báo. */
export function useCreateCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateCaseRequest) => {
      const key = newIdempotencyKey();
      return unwrap(
        await api.POST("/cases", {
          headers: { [HEADER_IDEMPOTENCY_KEY]: key },
          body,
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

/** Lập phương án phân bổ nguồn lực (Google OR-Tools MILP). */
export function useCreateAllocationPlan(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateAllocationPlanRequest) => {
      const key = newIdempotencyKey();
      return unwrap(
        await api.POST("/cases/{case_id}/allocation-plans", {
          params: {
            path: { case_id: caseId },
          },
          headers: { [HEADER_IDEMPOTENCY_KEY]: key },
          body,
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

/** Xác nhận phương án phân bổ nguồn lực. */
export function useConfirmAllocationPlan(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (planId: string) => {
      const key = newIdempotencyKey();
      return unwrap(
        await api.POST("/cases/{case_id}/allocation-plans/{plan_id}/confirm", {
          params: {
            path: { case_id: caseId, plan_id: planId },
          },
          headers: { [HEADER_IDEMPOTENCY_KEY]: key },
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

/** Chi tiết dự thảo văn bản chỉ đạo. */
export function useDraft(draftId: string | undefined) {
  return useQuery({
    queryKey: qk.draft(draftId ?? "none"),
    enabled: !!draftId,
    queryFn: async () =>
      unwrap(
        await api.GET("/drafts/{draft_id}", {
          params: { path: { draft_id: draftId as string } },
        })
      ),
    staleTime: 15_000,
  });
}

/** Tạo dự thảo thủ công. */
export function useCreateDraft(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateDraftRequest) => {
      const key = newIdempotencyKey();
      return unwrap(
        await api.POST("/cases/{case_id}/drafts", {
          params: {
            path: { case_id: caseId },
          },
          headers: { [HEADER_IDEMPOTENCY_KEY]: key },
          body,
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case", caseId] });
    },
  });
}

/** Yêu cầu AI sinh dự thảo văn bản (GenAI B2G). */
export function useGenerateDraft(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: GenerateDraftCaseRequest) => {
      const key = newIdempotencyKey();
      return unwrap(
        await api.POST("/cases/{case_id}/drafts/generate", {
          params: {
            path: { case_id: caseId },
          },
          headers: { [HEADER_IDEMPOTENCY_KEY]: key },
          body,
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case", caseId] });
    },
  });
}

/** Cập nhật nội dung dự thảo. */
export function useUpdateDraft(draftId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateDraftRequest) => {
      const key = newIdempotencyKey();
      return unwrap(
        await api.PATCH("/drafts/{draft_id}", {
          params: { path: { draft_id: draftId } },
          headers: { [HEADER_IDEMPOTENCY_KEY]: key },
          body,
        })
      );
    },
    onSuccess: (data) => {
      queryClient.setQueryData(qk.draft(draftId), data);
      queryClient.invalidateQueries({ queryKey: ["case", data.case_id] });
    },
  });
}

/** Thẩm định & Phê duyệt/Từ chối văn bản (luật 4 mắt). */
export function useSubmitReview(draftId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: SubmitReviewRequest) => {
      const key = newIdempotencyKey();
      return unwrap(
        await api.POST("/drafts/{draft_id}/reviews", {
          params: { path: { draft_id: draftId } },
          headers: { [HEADER_IDEMPOTENCY_KEY]: key },
          body,
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["draft", draftId] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

/** Ban hành & Gửi lệnh điều phối đã duyệt. */
export function useDispatchOrder(draftId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { recipient: string; dispatched_by: string }) => {
      const key = newIdempotencyKey();
      return unwrap(
        await api.POST("/drafts/{draft_id}/dispatch", {
          params: { path: { draft_id: draftId } },
          headers: { [HEADER_IDEMPOTENCY_KEY]: key },
          body,
        })
      );
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["draft", draftId] });
      queryClient.invalidateQueries({ queryKey: ["case", order.case_id] });
    },
  });
}

export type { AllocationPlan, Case, CaseDetail, DispatchDraft, DispatchOrder, ReviewResult };
export type Draft = DispatchDraft;
