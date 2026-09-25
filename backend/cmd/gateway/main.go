// Command gateway là cửa vào duy nhất của hệ thống (docs/09 §4.2).
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/httpx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/obsx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/gateway/app"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/gateway/handler"
)

// version được gán lúc build: -ldflags "-X main.version=<git sha>".
var version = "dev"

func main() { os.Exit(run()) }

func run() int {
	// `gateway -healthcheck`: dùng cho HEALTHCHECK của Docker (image distroless không có shell/curl).
	if len(os.Args) > 1 && os.Args[1] == "-healthcheck" {
		return httpx.HealthcheckMain(app.HealthURL(os.LookupEnv))
	}

	cfg, err := app.LoadConfig(os.LookupEnv)
	if err != nil {
		fmt.Fprintln(os.Stderr, "cấu hình không hợp lệ:\n"+err.Error())
		return 2
	}
	log := obsx.NewLogger(os.Stdout, "gateway", version, cfg.LogLevel)

	verifier, err := authx.NewEd25519Verifier(cfg.JWTPublicKey, cfg.JWTIssuer, cfg.JWTAudience)
	if err != nil {
		log.Error("khởi tạo verifier thất bại", "error", err.Error())
		return 2
	}

	router := app.NewRouter(app.Deps{
		Log:      log,
		Verifier: verifier,
		Server:   handler.NotImplemented{}, // Đợt 1: thay bằng hiện thực gọi surveillance/forecast/identity
		Ready:    nil,                      // Đợt 1: kiểm kết nối tới các service phía sau
		MaxBody:  cfg.MaxBodyBytes,
	})

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := httpx.Run(ctx, cfg.ListenAddr, router, cfg.ShutdownTimeout, log); err != nil {
		log.Error("server dừng bất thường", "error", err.Error())
		return 1
	}
	return 0
}
