// Command gateway là cửa vào duy nhất của hệ thống (docs/09 §4.2).
package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/httpx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/obsx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/gateway/app"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/gateway/handler"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/gateway/upstream"
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

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	httpClient := &http.Client{Timeout: cfg.UpstreamTimeout}
	keys := upstream.NewRemoteKeySet(cfg.IdentityURL, httpClient, log)
	go keys.Run(ctx, cfg.JWKSRefresh)

	verifier, err := authx.NewKeySetVerifier(keys, cfg.JWTIssuer, cfg.JWTAudience)
	if err != nil {
		log.Error("khởi tạo verifier thất bại", "error", err.Error())
		return 2
	}
	tokens := upstream.NewTokenSource(cfg.IdentityURL, cfg.ServiceClientSecret, httpClient)
	client := upstream.NewClient(map[string]string{
		upstream.Identity:     cfg.IdentityURL,
		upstream.Surveillance: cfg.SurveillanceURL,
		upstream.Forecast:     cfg.ForecastURL,
	}, tokens, httpClient, log)

	router := app.NewRouter(app.Deps{
		Log:      log,
		Verifier: verifier,
		Server:   &handler.Gateway{Up: client, CookieSecure: cfg.CookieSecure},
		Ready:    keys.Ready, // sẵn sàng khi đã nạp được JWKS (không có khoá thì mọi request có token đều 401)
		MaxBody:  cfg.MaxBodyBytes,
		Limiter:  app.NewAuthLimiter(cfg.AuthRateLimit, cfg.AuthRateWindow),
	})

	if err := httpx.Run(ctx, cfg.ListenAddr, router, cfg.ShutdownTimeout, log); err != nil {
		log.Error("server dừng bất thường", "error", err.Error())
		return 1
	}
	return 0
}
