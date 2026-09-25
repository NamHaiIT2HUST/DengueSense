// Package configx đọc cấu hình từ biến môi trường theo tiền tố service (12-factor, docs/09 §16.1).
//
// Luật:
//   - Biến bắt buộc thiếu → gom lỗi, service fail ngay lúc khởi động (không chạy với cấu hình thiếu).
//   - Thông báo lỗi CHỈ nêu tên biến, không bao giờ nêu giá trị (có thể là bí mật).
package configx

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Loader đọc biến `<PREFIX>_<KEY>` và gom lỗi để báo một lần (xem Err).
type Loader struct {
	prefix string
	lookup func(string) (string, bool)
	errs   []error
}

// New tạo Loader đọc từ môi trường tiến trình.
func New(prefix string) *Loader {
	return NewWithLookup(prefix, os.LookupEnv)
}

// NewWithLookup cho phép thay nguồn đọc (dùng trong test).
func NewWithLookup(prefix string, lookup func(string) (string, bool)) *Loader {
	return &Loader{prefix: prefix, lookup: lookup}
}

func (l *Loader) name(key string) string { return l.prefix + "_" + key }

// raw trả giá trị đã cắt khoảng trắng; biến rỗng coi như chưa đặt.
func (l *Loader) raw(key string) (string, bool) {
	v, ok := l.lookup(l.name(key))
	v = strings.TrimSpace(v)
	return v, ok && v != ""
}

// String đọc biến tuỳ chọn, thiếu thì dùng def.
func (l *Loader) String(key, def string) string {
	if v, ok := l.raw(key); ok {
		return v
	}
	return def
}

// RequiredString đọc biến bắt buộc; thiếu thì ghi lỗi (trả chuỗi rỗng).
func (l *Loader) RequiredString(key string) string {
	v, ok := l.raw(key)
	if !ok {
		l.errs = append(l.errs, fmt.Errorf("thiếu biến môi trường bắt buộc %s", l.name(key)))
		return ""
	}
	return v
}

// Int đọc số nguyên; giá trị không hợp lệ ghi lỗi (không lộ giá trị).
func (l *Loader) Int(key string, def int) int {
	v, ok := l.raw(key)
	if !ok {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		l.errs = append(l.errs, fmt.Errorf("biến %s phải là số nguyên", l.name(key)))
		return def
	}
	return n
}

// Duration đọc khoảng thời gian dạng Go ("20s", "5m").
func (l *Loader) Duration(key string, def time.Duration) time.Duration {
	v, ok := l.raw(key)
	if !ok {
		return def
	}
	d, err := time.ParseDuration(v)
	if err != nil || d <= 0 {
		l.errs = append(l.errs, fmt.Errorf("biến %s phải là khoảng thời gian dương (vd 20s)", l.name(key)))
		return def
	}
	return d
}

// Bool đọc true/false.
func (l *Loader) Bool(key string, def bool) bool {
	v, ok := l.raw(key)
	if !ok {
		return def
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		l.errs = append(l.errs, fmt.Errorf("biến %s phải là true hoặc false", l.name(key)))
		return def
	}
	return b
}

// Err trả mọi lỗi đã gom (nil nếu cấu hình hợp lệ).
func (l *Loader) Err() error { return errors.Join(l.errs...) }
