package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/eventx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/adapters/httpapi"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/adapters/postgres"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/api"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/app"
)

// Dummy client cho Demo. Thực tế sẽ dùng thư viện HTTP client gọi nội bộ sang `forecast`
type dummyForecastClient struct{}

func (d *dummyForecastClient) CheckRunAlerts(ctx context.Context, runID uuid.UUID) ([]int, error) {
	// Giả lập logic: Trả về provinceID 1 và 2 nếu có cảnh báo.
	return []int{1, 2}, nil
}

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/denguesense_dev?sslmode=disable"
	}
	natsURL := os.Getenv("NATS_URL")
	if natsURL == "" {
		natsURL = nats.DefaultURL
	}

	ctx := context.Background()

	// Init DB
	db, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		slog.Error("Không thể kết nối DB", "err", err)
		os.Exit(1)
	}
	repo := postgres.NewRepo(db)

	// Init Service
	svc := app.NewWorkflowService(repo, &dummyForecastClient{})

	// Init NATS
	nc, err := nats.Connect(natsURL)
	if err != nil {
		slog.Error("Không thể kết nối NATS", "err", err)
		os.Exit(1)
	}
	js, err := jetstream.New(nc)
	if err != nil {
		slog.Error("Không thể init JetStream", "err", err)
		os.Exit(1)
	}
	_ = js // TODO: Dùng js.Consume thay vì core NATS pub/sub nếu cần bền vững

	// Init Event Consumer
	inbox := eventx.NewPgxInboxStore(db, "inbox")
	consumerHandler := func(ctx context.Context, env eventx.Envelope) error {
		if env.Type == "forecast.run.completed" {
			return svc.HandleForecastRunCompleted(ctx, env)
		}
		return nil
	}
	consumer := eventx.NewConsumer(inbox, consumerHandler, eventx.ConsumerOptions{})

	// Subscription manually fetching from core NATS
	sub, err := nc.Subscribe("events.forecast.run.completed", func(msg *nats.Msg) {
		if err := consumer.HandleMessage(context.Background(), msg.Data); err != nil {
			slog.Error("Lỗi xử lý event", "err", err)
		} else {
			msg.Ack()
		}
	})
	if err != nil {
		slog.Error("Không thể subscribe NATS", "err", err)
	} else {
		slog.Info("Đã subscribe events.forecast.run.completed", "subject", sub.Subject)
	}

	// HTTP Server
	r := gin.Default()
	server := httpapi.NewServer(svc, repo)
	api.RegisterHandlers(r, server)

	slog.Info("Workflow service listening trên :8001")
	if err := http.ListenAndServe(":8001", r); err != nil {
		slog.Error("Server lỗi", "err", err)
	}
}
