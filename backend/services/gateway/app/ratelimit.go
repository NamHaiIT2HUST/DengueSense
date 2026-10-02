package app

import (
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/httpx"
)

// authRoutes là các route bị giới hạn tần suất theo IP (dò mật khẩu, dò refresh token).
var authRoutes = map[string]struct{}{
	"POST " + BasePath + "/auth/login":   {},
	"POST " + BasePath + "/auth/refresh": {},
	"POST " + BasePath + "/auth/logout":  {},
}

// AuthLimiter giới hạn cửa sổ cố định theo IP, trong bộ nhớ (một instance gateway — đủ cho Đợt 1; nhiều instance
// cần bộ đếm dùng chung, ghi ở docs/09). Khoá là IP kết nối trực tiếp: gateway KHÔNG tin X-Forwarded-For
// (xem SetTrustedProxies trong NewRouter), nếu không kẻ tấn công đổi header là lách được.
type AuthLimiter struct {
	limit  int
	window time.Duration
	now    func() time.Time

	mu      sync.Mutex
	buckets map[string]*bucket
}

type bucket struct {
	count int
	reset time.Time
}

// NewAuthLimiter: tối đa `limit` lần mỗi `window` cho mỗi IP. limit <= 0 tắt giới hạn.
func NewAuthLimiter(limit int, window time.Duration) *AuthLimiter {
	return &AuthLimiter{limit: limit, window: window, now: time.Now, buckets: map[string]*bucket{}}
}

// allow ghi nhận một lần và báo còn được phép không; trả thêm số giây phải chờ khi bị chặn.
func (l *AuthLimiter) allow(key string) (bool, int) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	if len(l.buckets) > 10000 { // dọn khi phình to; kẻ tấn công đổi IP không làm tràn bộ nhớ
		for k, b := range l.buckets {
			if now.After(b.reset) {
				delete(l.buckets, k)
			}
		}
	}
	b, ok := l.buckets[key]
	if !ok || now.After(b.reset) {
		b = &bucket{reset: now.Add(l.window)}
		l.buckets[key] = b
	}
	b.count++
	if b.count > l.limit {
		wait := int(b.reset.Sub(now).Seconds()) + 1
		return false, wait
	}
	return true, 0
}

// Middleware chặn route xác thực khi vượt hạn mức (429 + Retry-After).
func (l *AuthLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if l == nil || l.limit <= 0 {
			c.Next()
			return
		}
		if _, ok := authRoutes[c.Request.Method+" "+c.FullPath()]; !ok {
			c.Next()
			return
		}
		if ok, wait := l.allow(c.ClientIP()); !ok {
			c.Header("Retry-After", strconv.Itoa(wait))
			httpx.WriteProblem(c, httpx.New(429, "common.rate_limited", "Thao tác quá nhanh",
				"thử lại sau "+strconv.Itoa(wait)+" giây"))
			return
		}
		c.Next()
	}
}
