package domain_test

import (
	"testing"

	"github.com/google/uuid"

	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/domain"
)

func TestFourEyesRuleForB2G(t *testing.T) {
	caseID := uuid.New()
	officerID := "officer-nguyen-van-a"
	approverID := "approver-le-van-b"

	draftB2G := domain.NewDispatchDraft(
		caseID,
		domain.DraftTypeB2G,
		"Công điện khẩn số 01/CĐ-BYT về phòng chống sốt xuất huyết",
		"Nội dung công điện chỉ đạo...",
		officerID,
	)

	// Case 1: Người tạo tự duyệt B2G -> PHẢI BỊ CHẶN (Quy tắc 4 mắt)
	err := draftB2G.ValidateReview(officerID, draftB2G.Version, domain.ReviewActionApprove)
	if err == nil {
		t.Fatalf("kỳ vọng lỗi ErrFourEyesViolation nhưng lại thành công")
	}
	if err != domain.ErrFourEyesViolation {
		t.Fatalf("kỳ vọng ErrFourEyesViolation, nhận được: %v", err)
	}

	// Case 2: Người khác duyệt B2G -> HỢP LỆ
	err = draftB2G.ValidateReview(approverID, draftB2G.Version, domain.ReviewActionApprove)
	if err != nil {
		t.Fatalf("kỳ vọng duyệt thành công nhưng nhận lỗi: %v", err)
	}
}

func TestFourEyesRuleForB2B(t *testing.T) {
	caseID := uuid.New()
	officerID := "officer-nguyen-van-a"

	draftB2B := domain.NewDispatchDraft(
		caseID,
		domain.DraftTypeB2B,
		"Báo cáo chuyên môn dịch tễ sốt xuất huyết tháng 10",
		"Nội dung báo cáo kỹ thuật...",
		officerID,
	)

	// B2B không áp dụng quy tắc 4 mắt cưỡng chế (cho phép tự xác nhận nếu cần)
	err := draftB2B.ValidateReview(officerID, draftB2B.Version, domain.ReviewActionApprove)
	if err != nil {
		t.Fatalf("kỳ vọng B2B cho phép tự xác nhận nhưng nhận lỗi: %v", err)
	}
}

func TestDraftVersionMismatch(t *testing.T) {
	caseID := uuid.New()
	draft := domain.NewDispatchDraft(caseID, domain.DraftTypeB2G, "Tiêu đề", "Nội dung v1", "officer-1")

	// Chỉnh sửa dự thảo -> lên version 2
	_ = draft.UpdateContent("Tiêu đề", "Nội dung v2 đã sửa")
	if draft.Version != 2 {
		t.Fatalf("kỳ vọng version = 2 sau khi update, nhận: %d", draft.Version)
	}

	// Approver cố duyệt với version 1 cũ -> PHẢI BỊ CHẶN
	err := draft.ValidateReview("approver-1", 1, domain.ReviewActionApprove)
	if err == nil {
		t.Fatalf("kỳ vọng lỗi version mismatch nhưng không có lỗi")
	}
}

func TestCreateDispatchOrderInvariants(t *testing.T) {
	caseID := uuid.New()
	draft := domain.NewDispatchDraft(caseID, domain.DraftTypeB2G, "Công điện", "Nội dung chuẩn", "officer-1")

	// 1. Chưa duyệt mà tạo lệnh -> lỗi
	_, err := domain.CreateDispatchOrder(draft, nil, "so-y-te-hcm@med.gov.vn")
	if err == nil {
		t.Fatalf("kỳ vọng lỗi khi dự thảo chưa duyệt nhưng lại thành công")
	}

	// 2. Duyệt dự thảo
	review := &domain.Review{
		ID:           uuid.New(),
		DraftID:      draft.ID,
		DraftVersion: draft.Version,
		ReviewerID:   "approver-1",
		Action:       domain.ReviewActionApprove,
	}
	draft.ApplyReview(domain.ReviewActionApprove)

	// 3. Tạo lệnh hợp lệ
	order, err := domain.CreateDispatchOrder(draft, review, "so-y-te-hcm@med.gov.vn")
	if err != nil {
		t.Fatalf("tạo lệnh hợp lệ thất bại: %v", err)
	}
	if order.Status != domain.OrderStatusPending {
		t.Fatalf("trạng thái lệnh ban đầu phải là PENDING, nhận: %s", order.Status)
	}
	if order.ContentHash != draft.ContentHash {
		t.Fatalf("content_hash của lệnh không khớp với dự thảo đã duyệt")
	}

	// 4. Nếu dự thảo bị giả mạo nội dung (tampering) -> PHẢI BỊ CHẶN
	draft.Content = "Nội dung bị sửa trộm sau khi lãnh đạo duyệt"
	_, err = domain.CreateDispatchOrder(draft, review, "so-y-te-hcm@med.gov.vn")
	if err == nil {
		t.Fatalf("kỳ vọng lỗi ErrContentTampered nhưng lại thành công")
	}
}
