package domain

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

var (
	ErrFourEyesViolation      = errors.New("vi phạm quy tắc 4 mắt: người soạn văn bản B2G không được tự duyệt")
	ErrDraftVersionMismatch   = errors.New("phiên bản dự thảo đã thay đổi kể từ khi tạo yêu cầu duyệt")
	ErrDraftNotApproved       = errors.New("dự thảo chưa được phê duyệt, không thể ban hành lệnh điều phối")
	ErrContentTampered        = errors.New("nội dung dự thảo không khớp với mã băm (content_hash) đã được phê duyệt")
	ErrInvalidDraftTransition = errors.New("trạng thái dự thảo không cho phép thao tác này")
)

type DraftType string

const (
	DraftTypeB2B DraftType = "b2b" // Báo cáo kỹ thuật / dịch tễ chuyên môn
	DraftTypeB2G DraftType = "b2g" // Công điện / văn bản chỉ đạo điều hành hành chính
)

type DraftStatus string

const (
	DraftStatusDraft            DraftStatus = "DRAFT"
	DraftStatusPendingReview    DraftStatus = "PENDING_REVIEW"
	DraftStatusChangesRequested DraftStatus = "CHANGES_REQUESTED"
	DraftStatusApproved         DraftStatus = "APPROVED"
	DraftStatusRejected         DraftStatus = "REJECTED"
)

type DispatchDraft struct {
	ID          uuid.UUID
	CaseID      uuid.UUID
	Version     int
	DraftType   DraftType
	Title       string
	Content     string
	ContentHash string
	Status      DraftStatus
	CreatedBy   string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type ReviewAction string

const (
	ReviewActionApprove        ReviewAction = "approve"
	ReviewActionReject         ReviewAction = "reject"
	ReviewActionRequestChanges ReviewAction = "request_changes"
)

type Review struct {
	ID           uuid.UUID
	DraftID      uuid.UUID
	DraftVersion int
	ReviewerID   string
	Action       ReviewAction
	Note         string
	ReviewedAt   time.Time
}

type OrderStatus string

const (
	OrderStatusPending        OrderStatus = "PENDING"
	OrderStatusSending        OrderStatus = "SENDING"
	OrderStatusSent           OrderStatus = "SENT"
	OrderStatusDeliveryFailed OrderStatus = "DELIVERY_FAILED"
)

type DispatchOrder struct {
	ID          uuid.UUID
	CaseID      uuid.UUID
	DraftID     uuid.UUID
	Recipient   string
	Content     string
	ContentHash string
	Status      OrderStatus
	CreatedAt   time.Time
	SentAt      *time.Time
}

// ComputeHash tính mã SHA-256 cho nội dung văn bản.
func ComputeHash(content string) string {
	h := sha256.Sum256([]byte(content))
	return hex.EncodeToString(h[:])
}

// NewDispatchDraft khởi tạo dự thảo văn bản mới ở trạng thái PENDING_REVIEW.
func NewDispatchDraft(caseID uuid.UUID, draftType DraftType, title, content, createdBy string) *DispatchDraft {
	now := time.Now().UTC()
	return &DispatchDraft{
		ID:          uuid.New(),
		CaseID:      caseID,
		Version:     1,
		DraftType:   draftType,
		Title:       title,
		Content:     content,
		ContentHash: ComputeHash(content),
		Status:      DraftStatusPendingReview,
		CreatedBy:   createdBy,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

// UpdateContent chỉnh sửa nội dung dự thảo: tăng version, tính lại content_hash và chuyển về PENDING_REVIEW.
// Sửa dự thảo đã duyệt bắt buộc phải duyệt lại từ đầu (trạng thái chuyển về DraftStatusPendingReview).
func (d *DispatchDraft) UpdateContent(title, content string) error {
	d.Version++
	if title != "" {
		d.Title = title
	}
	d.Content = content
	d.ContentHash = ComputeHash(content)
	d.Status = DraftStatusPendingReview
	d.UpdatedAt = time.Now().UTC()
	return nil
}

// ValidateReview kiểm tra điều kiện duyệt theo bất biến Human-in-the-loop:
// 1. Version phải khớp đúng với bản hiện tại.
// 2. B2G: reviewer_id != created_by (Quy tắc 4 mắt).
func (d *DispatchDraft) ValidateReview(reviewerID string, draftVersion int, action ReviewAction) error {
	if draftVersion != d.Version {
		return fmt.Errorf("%w: draft version hiện tại là %d, yêu cầu duyệt version %d", ErrDraftVersionMismatch, d.Version, draftVersion)
	}

	// Bất biến 2: B2G bắt buộc tuân thủ quy tắc 4 mắt
	if d.DraftType == DraftTypeB2G && reviewerID == d.CreatedBy {
		return ErrFourEyesViolation
	}

	if d.Status != DraftStatusPendingReview && d.Status != DraftStatusChangesRequested {
		return fmt.Errorf("%w: trạng thái hiện tại là %s", ErrInvalidDraftTransition, d.Status)
	}

	return nil
}

// ApplyReview áp dụng kết quả phê duyệt vào dự thảo.
func (d *DispatchDraft) ApplyReview(action ReviewAction) {
	switch action {
	case ReviewActionApprove:
		d.Status = DraftStatusApproved
	case ReviewActionReject:
		d.Status = DraftStatusRejected
	case ReviewActionRequestChanges:
		d.Status = DraftStatusChangesRequested
	}
	d.UpdatedAt = time.Now().UTC()
}

// CreateDispatchOrder kiểm tra tính toàn vẹn và tạo lệnh ban hành:
// 1. Dự thảo phải ở trạng thái APPROVED.
// 2. Review phê duyệt gần nhất phải khớp version hiện tại.
// 3. Nội dung gửi đi phải khớp đúng content_hash đã được phê duyệt.
func CreateDispatchOrder(d *DispatchDraft, latestReview *Review, recipient string) (*DispatchOrder, error) {
	if d.Status != DraftStatusApproved {
		return nil, ErrDraftNotApproved
	}

	if latestReview == nil || latestReview.Action != ReviewActionApprove || latestReview.DraftVersion != d.Version {
		return nil, fmt.Errorf("%w: không có biên bản phê duyệt hợp lệ cho version %d", ErrDraftNotApproved, d.Version)
	}

	currentHash := ComputeHash(d.Content)
	if currentHash != d.ContentHash {
		return nil, ErrContentTampered
	}

	return &DispatchOrder{
		ID:          uuid.New(),
		CaseID:      d.CaseID,
		DraftID:     d.ID,
		Recipient:   recipient,
		Content:     d.Content,
		ContentHash: currentHash,
		Status:      OrderStatusPending,
		CreatedAt:   time.Now().UTC(),
	}, nil
}

type DraftRepository interface {
	CreateDraft(ctx context.Context, draft *DispatchDraft) error
	GetDraftByID(ctx context.Context, id uuid.UUID) (*DispatchDraft, error)
	UpdateDraft(ctx context.Context, draft *DispatchDraft) error
	ListDraftsByCase(ctx context.Context, caseID uuid.UUID) ([]DispatchDraft, error)

	CreateReview(ctx context.Context, review *Review) error
	GetLatestReviewByDraft(ctx context.Context, draftID uuid.UUID) (*Review, error)

	CreateDispatchOrder(ctx context.Context, order *DispatchOrder) error
	GetOrderByID(ctx context.Context, id uuid.UUID) (*DispatchOrder, error)
	UpdateOrderStatus(ctx context.Context, id uuid.UUID, status OrderStatus) error
}
