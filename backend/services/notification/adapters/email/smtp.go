package email

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"strings"
	"time"
)

type SMTPOptions struct {
	Host     string
	Port     string
	Username string
	Password string
	From     string
}

type SMTPSender struct {
	opts SMTPOptions
}

func NewSMTPSender(opts SMTPOptions) *SMTPSender {
	if opts.Port == "" {
		opts.Port = "587"
	}
	return &SMTPSender{opts: opts}
}

func (s *SMTPSender) SendEmail(ctx context.Context, recipient, subject, content string) error {
	addr := net.JoinHostPort(s.opts.Host, s.opts.Port)

	// Format RFC 822 / MIME message
	header := make(map[string]string)
	header["From"] = s.opts.From
	header["To"] = recipient
	header["Subject"] = subject
	header["MIME-Version"] = "1.0"
	header["Content-Type"] = "text/plain; charset=UTF-8"
	header["Date"] = time.Now().Format(time.RFC1123Z)

	var msgBuilder strings.Builder
	for k, v := range header {
		fmt.Fprintf(&msgBuilder, "%s: %s\r\n", k, v)
	}
	msgBuilder.WriteString("\r\n")
	msgBuilder.WriteString(content)

	msg := []byte(msgBuilder.String())

	var auth smtp.Auth
	if s.opts.Username != "" {
		auth = smtp.PlainAuth("", s.opts.Username, s.opts.Password, s.opts.Host)
	}

	var d net.Dialer
	conn, err := d.DialContext(ctx, "tcp", addr)
	if err != nil {
		return fmt.Errorf("không thể kết nối SMTP server %s: %w", addr, err)
	}

	c, err := smtp.NewClient(conn, s.opts.Host)
	if err != nil {
		_ = conn.Close()
		return fmt.Errorf("lỗi khởi tạo SMTP client: %w", err)
	}
	defer func() { _ = c.Quit() }()

	if ok, _ := c.Extension("STARTTLS"); ok {
		config := &tls.Config{
			ServerName: s.opts.Host,
			MinVersion: tls.VersionTLS12,
		}
		if err = c.StartTLS(config); err != nil {
			return fmt.Errorf("lỗi STARTTLS: %w", err)
		}
	}

	if auth != nil {
		if ok, _ := c.Extension("AUTH"); ok {
			if err = c.Auth(auth); err != nil {
				return fmt.Errorf("lỗi xác thực SMTP: %w", err)
			}
		}
	}

	if err = c.Mail(s.opts.From); err != nil {
		return fmt.Errorf("lỗi đặt sender: %w", err)
	}
	if err = c.Rcpt(recipient); err != nil {
		return fmt.Errorf("lỗi đặt recipient: %w", err)
	}

	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("lỗi mở data stream: %w", err)
	}
	if _, err = w.Write(msg); err != nil {
		_ = w.Close()
		return fmt.Errorf("lỗi ghi nội dung email: %w", err)
	}
	if err = w.Close(); err != nil {
		return fmt.Errorf("lỗi đóng data stream: %w", err)
	}

	return nil
}
