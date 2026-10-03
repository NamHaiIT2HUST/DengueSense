package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nats-io/nats.go"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/eventx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/notification/adapters/email"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/notification/adapters/postgres"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/notification/app"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/notification/domain"
)

func main() {
	migrateFlag := flag.Bool("migrate", false, "Chạy migrations rồi thoát")
	flag.Parse()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		//nolint:gosec // DB URL cho môi trường dev
		dbURL = "postgres://postgres:postgres@localhost:5432/denguesense_dev?sslmode=disable"
	}

	if *migrateFlag {
		if err := postgres.MigrateUp(dbURL); err != nil {
			slog.Error("Migration notification thất bại", "error", err)
			os.Exit(1)
		}
		slog.Info("Migration notification thành công")
		return
	}

	natsURL := os.Getenv("NATS_URL")
	if natsURL == "" {
		natsURL = nats.DefaultURL
	}

	ctx := context.Background()
	db, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		slog.Error("Không thể kết nối CSDL notification", "err", err)
		os.Exit(1)
	}
	defer db.Close()

	nc, err := nats.Connect(natsURL)
	if err != nil {
		slog.Error("Không thể kết nối NATS", "err", err)
		os.Exit(1)
	}
	defer nc.Close()

	repo := postgres.NewRepo(db)
	var sender domain.EmailSender
	smtpHost := os.Getenv("SMTP_HOST")
	if smtpHost != "" {
		slog.Info("Khởi động notification với SMTPSender", "host", smtpHost)
		sender = email.NewSMTPSender(email.SMTPOptions{
			Host:     smtpHost,
			Port:     os.Getenv("SMTP_PORT"),
			Username: os.Getenv("SMTP_USER"),
			Password: os.Getenv("SMTP_PASS"),
			From:     os.Getenv("SMTP_FROM"),
		})
	} else {
		slog.Info("Khởi động notification với MockSender (chưa cấu hình SMTP_HOST)")
		sender = email.NewMockSender()
	}
	svc := app.NewNotificationService(repo, sender)

	inbox := eventx.NewPgxInboxStore(db, "inbox")
	consumerHandler := func(ctx context.Context, env eventx.Envelope) error {
		if env.Type == "workflow.order.approved" {
			return svc.HandleOrderApproved(ctx, env)
		}
		return nil
	}
	consumer := eventx.NewConsumer(inbox, consumerHandler, eventx.ConsumerOptions{})

	sub, err := nc.Subscribe("events.workflow.order.approved", func(msg *nats.Msg) {
		if err := consumer.HandleMessage(context.Background(), msg.Data); err != nil {
			slog.Error("Lỗi xử lý notification event", "err", err)
		} else {
			_ = msg.Ack()
		}
	})
	if err != nil {
		slog.Error("Không thể subscribe NATS", "err", err)
	} else {
		slog.Info("Notification service đã subscribe", "subject", sub.Subject)
	}

	r := gin.Default()
	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	slog.Info("Notification service listening trên :8001")
	//nolint:gosec // Internal notification service
	if err := http.ListenAndServe(":8001", r); err != nil {
		slog.Error("Notification server lỗi", "err", err)
	}
	fmt.Println("Notification service terminated")
}
