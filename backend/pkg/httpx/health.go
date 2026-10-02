package httpx

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// ReadyFunc kiểm tra phụ thuộc (DB, NATS…). Trả lỗi ⇒ service chưa sẵn sàng nhận request.
type ReadyFunc func(ctx context.Context) error

const readyTimeout = 2 * time.Second

// RegisterHealth đăng ký:
//
//	GET /healthz — tiến trình còn sống (KHÔNG kiểm phụ thuộc; dùng để quyết định restart).
//	GET /readyz  — sẵn sàng nhận tải (kiểm phụ thuộc; dùng cho healthcheck compose / load balancer).
//
// Không lộ chi tiết lỗi phụ thuộc ra ngoài (chỉ 503 + mã lỗi chuẩn).
func RegisterHealth(r gin.IRoutes, ready ReadyFunc) {
	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	r.GET("/readyz", func(c *gin.Context) {
		if ready != nil {
			ctx, cancel := context.WithTimeout(c.Request.Context(), readyTimeout)
			defer cancel()
			if err := ready(ctx); err != nil {
				WriteProblem(c, DependencyUnavailable())
				return
			}
		}
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	})
}

// HealthcheckMain dùng cho `<service> -healthcheck` (image distroless không có curl/wget):
// GET url, trả mã thoát 0 nếu 200, 1 nếu khác.
func HealthcheckMain(url string) int {
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(url) //nolint:noctx // tiến trình ngắn, đã có timeout ở client
	if err != nil {
		return 1
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}
