package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nats-io/nats.go"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/eventx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/httpx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/adapters/forecastclient"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/adapters/httpapi"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/adapters/postgres"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/app"
)

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "migrate", "-migrate":
			dbURL := os.Getenv("DATABASE_URL")
			if dbURL == "" {
				//nolint:gosec // Hardcoded DB URL is for local dev only
				dbURL = "postgres://postgres:postgres@localhost:5432/denguesense_dev?sslmode=disable"
			}
			if err := postgres.MigrateUp(dbURL); err != nil {
				slog.Error("Migration workflow thất bại", "error", err)
				os.Exit(1)
			}
			slog.Info("Migration workflow thành công")
			return
		case "-healthcheck":
			os.Exit(httpx.HealthcheckMain("http://127.0.0.1:8001/healthz"))
		}
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		//nolint:gosec // Hardcoded DB URL is for local dev only
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
	forecastURL := os.Getenv("FORECAST_API_URL")
	if forecastURL == "" {
		forecastURL = "http://localhost:8001/internal/v1"
	}
	forecastToken := httpapi.IdentityTokenSourceForAudience(os.Getenv("WORKFLOW_IDENTITY_URL"), os.Getenv("WORKFLOW_SERVICE_CLIENT_SECRET"), "forecast", &http.Client{Timeout: 5 * time.Second})
	forecastAdapter, err := forecastclient.NewAdapter(forecastURL, &http.Client{Timeout: 40 * time.Second}, forecastToken)
	if err != nil {
		slog.Error("Không thể init forecast client", "err", err)
		os.Exit(1)
	}
	svc := app.NewWorkflowService(repo, forecastAdapter)

	// Init NATS
	nc, err := nats.Connect(natsURL)
	if err != nil {
		slog.Error("Không thể kết nối NATS", "err", err)
		os.Exit(1)
	}
	js, err := nc.JetStream()
	if err != nil {
		slog.Error("Không thể init JetStream", "err", err)
		os.Exit(1)
	}

	// Init Event Consumer
	inbox := eventx.NewPgxInboxStore(db, "inbox")
	consumerHandler := func(ctx context.Context, env eventx.Envelope) error {
		if env.Type == "forecast.run.completed" {
			return svc.HandleForecastRunCompleted(ctx, env)
		}
		return nil
	}
	// JetStream đảm nhiệm giao lại; không đánh dấu thất bại là đã xử lý.
	consumer := eventx.NewConsumer(inbox, consumerHandler, eventx.ConsumerOptions{MaxAttempts: 1})

	sub, err := subscribeForecastEvents(js, consumer)
	if err != nil {
		slog.Error("Không thể subscribe NATS", "err", err)
		os.Exit(1)
	} else {
		slog.Info("Đã subscribe forecast.run.completed", "subject", sub.Subject)
	}

	// HTTP Server
	r := gin.Default()
	httpx.RegisterHealth(r, db.Ping)
	publicKey, err := authx.ParsePublicKey(os.Getenv("WORKFLOW_JWT_PUBLIC_KEY"))
	if err != nil {
		slog.Error("Khóa xác thực workflow không hợp lệ", "error", err)
		os.Exit(1)
	}
	verifier, err := authx.NewServiceVerifier(authx.StaticKeySet{"k1": publicKey}, "denguesense-identity", "workflow")
	if err != nil {
		slog.Error("Không thể tạo xác thực workflow", "error", err)
		os.Exit(1)
	}

	opts := []httpapi.ServerOption{httpapi.WithForecastCases(forecastAdapter.CasesPredicted)}
	if genaiURL := os.Getenv("GENAI_API_URL"); genaiURL != "" {
		opts = append(opts, httpapi.WithGenAIURL(genaiURL))
		opts = append(opts, httpapi.WithGenAITokenSource(httpapi.IdentityTokenSource(os.Getenv("WORKFLOW_IDENTITY_URL"), os.Getenv("WORKFLOW_SERVICE_CLIENT_SECRET"), &http.Client{Timeout: 5 * time.Second})))
	}
	if optimizeURL := os.Getenv("OPTIMIZE_API_URL"); optimizeURL != "" {
		opts = append(opts, httpapi.WithOptimizeURL(optimizeURL))
	}

	server := httpapi.NewServer(svc, repo, opts...)
	httpapi.RegisterAuthenticatedHandlers(r, server, verifier)

	slog.Info("Workflow service listening trên :8001")
	//nolint:gosec // Use default HTTP server for internal service without timeout limits
	if err := http.ListenAndServe(":8001", r); err != nil {
		slog.Error("Server lỗi", "err", err)
	}
}

func subscribeForecastEvents(js nats.JetStreamContext, consumer *eventx.Consumer) (*nats.Subscription, error) {
	return js.QueueSubscribe(eventx.TypeForecastRunCompleted, "workflow-forecast", func(msg *nats.Msg) {
		if err := consumer.HandleMessage(context.Background(), msg.Data); err != nil {
			slog.Error("Lỗi xử lý event", "err", err)
			_ = msg.NakWithDelay(10 * time.Second)
		} else {
			_ = msg.Ack()
		}
	}, nats.Durable("workflow-forecast"), nats.BindStream("EVENTS"), nats.ManualAck(), nats.AckExplicit(), nats.AckWait(5*time.Minute), nats.MaxDeliver(-1))
}
