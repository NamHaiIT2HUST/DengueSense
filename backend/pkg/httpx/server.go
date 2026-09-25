package httpx

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"time"
)

// Serve chạy HTTP server trên `ln` tới khi `ctx` bị huỷ (SIGTERM), rồi tắt êm: ngừng nhận kết nối
// mới, chờ request đang xử lý tối đa `shutdownTimeout` (docs/09 §12.4). Trả nil nếu tắt êm.
func Serve(ctx context.Context, ln net.Listener, h http.Handler, shutdownTimeout time.Duration, log *slog.Logger) error {
	srv := &http.Server{
		Handler:           h,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 16,
	}

	errCh := make(chan error, 1)
	go func() { errCh <- srv.Serve(ln) }()
	log.InfoContext(ctx, "server_started", slog.String("addr", ln.Addr().String()))

	select {
	case err := <-errCh:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return fmt.Errorf("server: %w", err)
	case <-ctx.Done():
	}

	log.InfoContext(ctx, "server_shutting_down", slog.String("timeout", shutdownTimeout.String()))
	// Context mới: ctx gốc đã bị huỷ nhưng vẫn phải chờ request đang dở.
	shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), shutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		_ = srv.Close()
		return fmt.Errorf("shutdown: %w", err)
	}
	if err := <-errCh; err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("server: %w", err)
	}
	log.InfoContext(ctx, "server_stopped")
	return nil
}

// Run mở cổng `addr` rồi gọi Serve.
func Run(ctx context.Context, addr string, h http.Handler, shutdownTimeout time.Duration, log *slog.Logger) error {
	var lc net.ListenConfig
	ln, err := lc.Listen(ctx, "tcp", addr)
	if err != nil {
		return fmt.Errorf("listen %s: %w", addr, err)
	}
	return Serve(ctx, ln, h, shutdownTimeout, log)
}
