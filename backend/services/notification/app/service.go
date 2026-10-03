package app

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/eventx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/notification/domain"
)

type NotificationService struct {
	repo   domain.NotificationRepository
	sender domain.EmailSender
}

func NewNotificationService(repo domain.NotificationRepository, sender domain.EmailSender) *NotificationService {
	return &NotificationService{
		repo:   repo,
		sender: sender,
	}
}

type OrderApprovedPayload struct {
	OrderID     uuid.UUID `json:"order_id"`
	CaseID      uuid.UUID `json:"case_id"`
	Recipient   string    `json:"recipient"`
	Subject     string    `json:"subject"`
	Content     string    `json:"content"`
	ContentHash string    `json:"content_hash"`
}

func (s *NotificationService) HandleOrderApproved(ctx context.Context, env eventx.Envelope) error {
	slog.InfoContext(ctx, "Notification service nhận event workflow.order.approved", "subject", env.Subject)

	var payload OrderApprovedPayload
	if err := json.Unmarshal(env.Data, &payload); err != nil {
		return fmt.Errorf("không thể parse event data: %w", err)
	}

	// 1. Kiểm tra tính toàn vẹn: tính lại hash của content
	sum := sha256.Sum256([]byte(payload.Content))
	computedHash := hex.EncodeToString(sum[:])
	if computedHash != payload.ContentHash {
		slog.ErrorContext(ctx, "Cảnh báo bảo mật: content_hash không khớp! Lệnh bị giả mạo.",
			"expected", payload.ContentHash, "computed", computedHash)
		return errors.New("lỗi bảo mật: content_hash không khớp với nội dung lệnh")
	}

	// 2. Tạo bản ghi Notification
	noti := &domain.Notification{
		ID:          uuid.New(),
		OrderID:     payload.OrderID,
		Recipient:   payload.Recipient,
		Subject:     payload.Subject,
		Content:     payload.Content,
		ContentHash: payload.ContentHash,
		Status:      domain.StatusPending,
		Attempts:    1,
		CreatedAt:   time.Now().UTC(),
	}

	if err := s.repo.CreateNotification(ctx, noti); err != nil {
		return fmt.Errorf("không thể lưu notification: %w", err)
	}

	// 3. Gửi email
	err := s.sender.SendEmail(ctx, payload.Recipient, payload.Subject, payload.Content)
	if err != nil {
		slog.ErrorContext(ctx, "Gửi email thất bại", "error", err, "recipient", payload.Recipient)
		_ = s.repo.UpdateNotificationStatus(ctx, noti.ID, domain.StatusFailed, 1, err.Error())
		return fmt.Errorf("gửi thông báo thất bại: %w", err)
	}

	// 4. Cập nhật thành công
	_ = s.repo.UpdateNotificationStatus(ctx, noti.ID, domain.StatusSent, 1, "")
	slog.InfoContext(ctx, "Gửi thông báo thành công", "order_id", payload.OrderID, "recipient", payload.Recipient)
	return nil
}
