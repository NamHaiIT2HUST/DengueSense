package email

import (
	"context"
	"log/slog"
)

type MockSender struct{}

func NewMockSender() *MockSender {
	return &MockSender{}
}

func (s *MockSender) SendEmail(ctx context.Context, recipient, subject, content string) error {
	slog.InfoContext(ctx, "Mock Email Sent", "recipient", recipient, "subject", subject, "bytes", len(content))
	return nil
}
