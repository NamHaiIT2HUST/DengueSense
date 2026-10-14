package app_test

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/eventx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/notification/app"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/notification/domain"
)

type mockNotiRepo struct {
	createdNotification *domain.Notification
	statusUpdates       []struct {
		id       uuid.UUID
		status   domain.NotificationStatus
		attempts int
		lastErr  string
	}
	createErr error
}

func (m *mockNotiRepo) CreateNotification(_ context.Context, n *domain.Notification) error {
	if m.createErr != nil {
		return m.createErr
	}
	m.createdNotification = n
	return nil
}

func (m *mockNotiRepo) GetNotificationByID(_ context.Context, _ uuid.UUID) (*domain.Notification, error) {
	return nil, nil
}

func (m *mockNotiRepo) UpdateNotificationStatus(_ context.Context, id uuid.UUID, status domain.NotificationStatus, attempts int, lastErr string) error {
	m.statusUpdates = append(m.statusUpdates, struct {
		id       uuid.UUID
		status   domain.NotificationStatus
		attempts int
		lastErr  string
	}{id, status, attempts, lastErr})
	return nil
}

type mockSender struct {
	sentRecipient string
	sentSubject   string
	sentContent   string
	sendErr       error
}

func (m *mockSender) SendEmail(_ context.Context, recipient, subject, content string) error {
	if m.sendErr != nil {
		return m.sendErr
	}
	m.sentRecipient = recipient
	m.sentSubject = subject
	m.sentContent = content
	return nil
}

func computeHash(content string) string {
	sum := sha256.Sum256([]byte(content))
	return hex.EncodeToString(sum[:])
}

func TestNotificationService_HandleOrderApproved_Success(t *testing.T) {
	repo := &mockNotiRepo{}
	sender := &mockSender{}
	svc := app.NewNotificationService(repo, sender)

	content := "Kính gửi Trung tâm Y tế Dự phòng: Lệnh điều phối khẩn cấp số 01"
	contentHash := computeHash(content)

	payload := app.OrderApprovedPayload{
		OrderID:     uuid.New(),
		CaseID:      uuid.New(),
		Recipient:   "cdc-hcm@moh.gov.vn",
		Subject:     "Lệnh điều phối phòng chống dịch",
		Content:     content,
		ContentHash: contentHash,
	}
	data, err := json.Marshal(payload)
	require.NoError(t, err)

	env := eventx.Envelope{
		Type:    "workflow.order.approved",
		Subject: payload.OrderID.String(),
		Data:    data,
	}

	err = svc.HandleOrderApproved(context.Background(), env)
	require.NoError(t, err)

	// Kiểm tra đã lưu notification
	require.NotNil(t, repo.createdNotification)
	assert.Equal(t, payload.OrderID, repo.createdNotification.OrderID)
	assert.Equal(t, payload.Recipient, repo.createdNotification.Recipient)

	// Kiểm tra đã gửi email
	assert.Equal(t, payload.Recipient, sender.sentRecipient)
	assert.Equal(t, payload.Subject, sender.sentSubject)
	assert.Equal(t, payload.Content, sender.sentContent)

	// Kiểm tra trạng thái cuối cùng được cập nhật thành SENT
	require.NotEmpty(t, repo.statusUpdates)
	lastUpdate := repo.statusUpdates[len(repo.statusUpdates)-1]
	assert.Equal(t, domain.StatusSent, lastUpdate.status)
	assert.Empty(t, lastUpdate.lastErr)
}

func TestNotificationService_HandleOrderApproved_TamperingHashMismatch(t *testing.T) {
	repo := &mockNotiRepo{}
	sender := &mockSender{}
	svc := app.NewNotificationService(repo, sender)

	content := "Nội dung ban đầu"
	payload := app.OrderApprovedPayload{
		OrderID:     uuid.New(),
		CaseID:      uuid.New(),
		Recipient:   "cdc-hcm@moh.gov.vn",
		Subject:     "Lệnh điều phối",
		Content:     content,
		ContentHash: "fake_tampered_hash_1234567890abcdef",
	}
	data, _ := json.Marshal(payload)

	env := eventx.Envelope{
		Type:    "workflow.order.approved",
		Subject: payload.OrderID.String(),
		Data:    data,
	}

	err := svc.HandleOrderApproved(context.Background(), env)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "lỗi bảo mật: content_hash không khớp")

	// Không lưu vào repo và không gửi email
	assert.Nil(t, repo.createdNotification)
	assert.Empty(t, sender.sentRecipient)
}

func TestNotificationService_HandleOrderApproved_SenderFailure(t *testing.T) {
	repo := &mockNotiRepo{}
	sender := &mockSender{
		sendErr: errors.New("SMTP connection refused"),
	}
	svc := app.NewNotificationService(repo, sender)

	content := "Nội dung điều phối"
	payload := app.OrderApprovedPayload{
		OrderID:     uuid.New(),
		CaseID:      uuid.New(),
		Recipient:   "cdc-hcm@moh.gov.vn",
		Subject:     "Lệnh điều phối",
		Content:     content,
		ContentHash: computeHash(content),
	}
	data, _ := json.Marshal(payload)

	env := eventx.Envelope{
		Type:    "workflow.order.approved",
		Subject: payload.OrderID.String(),
		Data:    data,
	}

	err := svc.HandleOrderApproved(context.Background(), env)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "gửi thông báo thất bại")

	// Đã tạo notification nhưng cập nhật status thành FAILED
	require.NotNil(t, repo.createdNotification)
	require.NotEmpty(t, repo.statusUpdates)
	assert.Equal(t, domain.StatusFailed, repo.statusUpdates[0].status)
	assert.Contains(t, repo.statusUpdates[0].lastErr, "SMTP connection refused")
}

func TestNotificationService_HandleOrderApproved_InvalidJSON(t *testing.T) {
	repo := &mockNotiRepo{}
	sender := &mockSender{}
	svc := app.NewNotificationService(repo, sender)

	env := eventx.Envelope{
		Type:    "workflow.order.approved",
		Subject: "order-1",
		Data:    []byte("invalid json"),
	}

	err := svc.HandleOrderApproved(context.Background(), env)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "không thể parse event data")
	assert.Nil(t, repo.createdNotification)
}

func TestNotificationService_HandleOrderApproved_RepoError(t *testing.T) {
	repo := &mockNotiRepo{
		createErr: errors.New("lỗi ghi DB"),
	}
	sender := &mockSender{}
	svc := app.NewNotificationService(repo, sender)

	content := "Nội dung điều phối"
	payload := app.OrderApprovedPayload{
		OrderID:     uuid.New(),
		CaseID:      uuid.New(),
		Recipient:   "cdc-hcm@moh.gov.vn",
		Subject:     "Lệnh điều phối",
		Content:     content,
		ContentHash: computeHash(content),
	}
	data, _ := json.Marshal(payload)

	env := eventx.Envelope{
		Type:    "workflow.order.approved",
		Subject: payload.OrderID.String(),
		Data:    data,
	}

	err := svc.HandleOrderApproved(context.Background(), env)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "không thể lưu notification")
	assert.Empty(t, sender.sentRecipient)
}
