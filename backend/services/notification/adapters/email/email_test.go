package email_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/services/notification/adapters/email"
)

func TestMockSender(t *testing.T) {
	sender := email.NewMockSender()
	err := sender.SendEmail(context.Background(), "user@example.com", "Test Subject", "Test Content")
	require.NoError(t, err)
}

func TestSMTPSender_ConnectionFailure(t *testing.T) {
	sender := email.NewSMTPSender(email.SMTPOptions{
		Host: "127.0.0.1",
		Port: "19999", // Cổng không có server lắng nghe
		From: "no-reply@denguesense.vn",
	})
	err := sender.SendEmail(context.Background(), "user@example.com", "Test Subject", "Test Content")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "không thể kết nối SMTP server")
}
