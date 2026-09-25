package httpx

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Các hàm dưới đây nối mã strict-server sinh từ oapi-codegen với định dạng lỗi problem+json chuẩn
// (docs/09 §6.3): mọi đường lỗi — đầu vào sai, lỗi nghiệp vụ, lỗi không lường trước — đều ra cùng một hình dạng,
// và lỗi không lường trước chỉ để lại chi tiết trong log, không lộ ra ngoài.

// RequestErrorHandler xử lý thân request không giải mã được (JSON hỏng, sai kiểu).
// Không đưa thông báo của bộ giải mã ra ngoài — chúng có thể lộ cấu trúc nội bộ.
func RequestErrorHandler() func(*gin.Context, error) {
	return func(c *gin.Context, _ error) {
		WriteProblem(c, ValidationError("thân request không phải JSON hợp lệ hoặc sai kiểu dữ liệu"))
	}
}

// ParamErrorHandler xử lý lỗi gắn tham số đường dẫn/query/header do mã sinh phát hiện.
func ParamErrorHandler() func(*gin.Context, error, int) {
	return func(c *gin.Context, err error, status int) {
		if status == 0 || status >= http.StatusInternalServerError {
			status = http.StatusBadRequest
		}
		e := ValidationError(err.Error())
		e.Status = status
		WriteProblem(c, e)
	}
}

// HandlerErrorHandler xử lý lỗi handler trả về: *Error → đúng mã/HTTP của nó; lỗi khác → 500 chung,
// chi tiết ghi vào log.
func HandlerErrorHandler(log *slog.Logger) func(*gin.Context, error) {
	return func(c *gin.Context, err error) {
		e := AsError(err)
		if e.Status >= http.StatusInternalServerError && e.Code == "common.internal_error" {
			log.ErrorContext(c.Request.Context(), "handler_error", slog.String("error", err.Error()))
		}
		WriteProblem(c, e)
	}
}

// ResponseErrorHandler xử lý lỗi khi tuần tự hoá phản hồi (thường là lỗi lập trình) — luôn là 500 chung.
func ResponseErrorHandler(log *slog.Logger) func(*gin.Context, error) {
	return func(c *gin.Context, err error) {
		log.ErrorContext(c.Request.Context(), "response_error", slog.String("error", err.Error()))
		WriteProblem(c, Internal())
	}
}
