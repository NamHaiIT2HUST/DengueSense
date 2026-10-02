// Package httpx: nền HTTP dùng chung cho các service Go — lỗi problem+json (RFC 9457), middleware,
// health check, chạy server với tắt êm (docs/09 §6, §12).
package httpx

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/obsx"
)

const (
	problemTypeBase   = "https://denguesense.vn/errors/"
	problemContentTyp = "application/problem+json"
)

// FieldError mô tả lỗi validate trên một trường.
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// Problem là thân phản hồi lỗi (khớp schema `Problem` trong contracts/openapi/public-v1.yaml).
type Problem struct {
	Type      string       `json:"type"`
	Title     string       `json:"title"`
	Status    int          `json:"status"`
	Code      string       `json:"code"`
	Detail    string       `json:"detail,omitempty"`
	Instance  string       `json:"instance,omitempty"`
	RequestID string       `json:"request_id"`
	Errors    []FieldError `json:"errors,omitempty"`
}

// Error là lỗi nghiệp vụ có mã ổn định (contracts/errors.md). Handler trả lỗi này, adapter HTTP
// chuyển thành problem+json ở MỘT chỗ (WriteProblem / ResponseError).
type Error struct {
	Status int
	Code   string
	Title  string
	Detail string
	Fields []FieldError
}

func (e *Error) Error() string { return e.Code + ": " + e.Title }

// New tạo lỗi mới. `code` PHẢI có trong contracts/errors.md.
func New(status int, code, title, detail string) *Error {
	return &Error{Status: status, Code: code, Title: title, Detail: detail}
}

// Các hàm dựng lỗi chuẩn (mã khớp contracts/errors.md).

func ValidationError(detail string, fields ...FieldError) *Error {
	e := New(http.StatusBadRequest, "common.validation_error", "Đầu vào không hợp lệ", detail)
	e.Fields = fields
	return e
}

func Unauthenticated(detail string) *Error {
	return New(http.StatusUnauthorized, "common.unauthenticated", "Chưa xác thực", detail)
}

func Forbidden(detail string) *Error {
	return New(http.StatusForbidden, "common.forbidden", "Không đủ quyền", detail)
}

func NotFound(detail string) *Error {
	return New(http.StatusNotFound, "common.not_found", "Không tìm thấy", detail)
}

func MethodNotAllowed() *Error {
	return New(http.StatusMethodNotAllowed, "common.method_not_allowed", "Phương thức không được hỗ trợ", "")
}

func NotImplemented() *Error {
	return New(http.StatusNotImplemented, "common.not_implemented", "Chức năng chưa được triển khai", "")
}

// Internal KHÔNG mang chi tiết nội bộ — chi tiết chỉ nằm trong log.
func Internal() *Error {
	return New(http.StatusInternalServerError, "common.internal_error", "Có lỗi xảy ra", "")
}

func DependencyUnavailable() *Error {
	return New(http.StatusServiceUnavailable, "common.dependency_unavailable", "Dịch vụ phụ thuộc không khả dụng", "")
}

// AsError chuyển mọi error thành *Error; lỗi lạ trở thành Internal (không lộ nội dung ra ngoài).
func AsError(err error) *Error {
	var e *Error
	if errors.As(err, &e) {
		return e
	}
	return Internal()
}

func (e *Error) problem(requestID, instance string) Problem {
	suffix := e.Code
	if i := strings.IndexByte(e.Code, '.'); i >= 0 {
		suffix = e.Code[i+1:]
	}
	return Problem{
		Type:      problemTypeBase + strings.ReplaceAll(suffix, "_", "-"),
		Title:     e.Title,
		Status:    e.Status,
		Code:      e.Code,
		Detail:    e.Detail,
		Instance:  instance,
		RequestID: requestID,
		Errors:    e.Fields,
	}
}

// WriteProblem ghi problem+json và dừng chuỗi handler.
func WriteProblem(c *gin.Context, e *Error) {
	body, err := json.Marshal(e.problem(obsx.RequestID(c.Request.Context()), c.Request.URL.Path))
	if err != nil { // không thể xảy ra với kiểu tĩnh này; giữ nhánh an toàn thay vì panic
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	c.Data(e.Status, problemContentTyp, body)
	c.Abort()
}
