# Danh mục mã lỗi (`code`)

Nguồn sự thật cho trường `code` trong `application/problem+json` (docs/09 §6.3).

**Luật:**
- Dạng `<service>.<snake_case>`; **ổn định** — frontend dựa vào `code`, không dựa vào `detail`. Không đổi nghĩa mã đã phát hành; muốn đổi thì thêm mã mới.
- Thêm mã mới ⇒ thêm 1 dòng vào bảng này **trong cùng PR**.
- Không bao giờ đưa chi tiết nội bộ (SQL, stack trace, tên bảng) vào `detail`.
- Cột "HTTP" là `—` khi mã không phải phản hồi lỗi HTTP mà là giá trị trong trường khác (`error_code`, `warnings[].code`).

| Mã | HTTP | Khi nào | Người dùng thấy (gợi ý) |
|---|---|---|---|
| `common.validation_error` | 400 | Đầu vào sai định dạng / thiếu trường (`errors[]` chỉ rõ trường) | Kiểm tra lại các trường được đánh dấu |
| `common.idempotency_key_required` | 400 | Thiếu header `Idempotency-Key` ở POST có tác dụng phụ | (lỗi lập trình — không hiển thị) |
| `common.unauthenticated` | 401 | Thiếu / hết hạn / sai chữ ký token | Đăng nhập lại |
| `common.forbidden` | 403 | Đủ xác thực nhưng không đủ vai trò / phạm vi đơn vị | Bạn không có quyền thực hiện thao tác này |
| `common.not_found` | 404 | Tài nguyên không tồn tại (hoặc không được phép biết là tồn tại) | Không tìm thấy |
| `common.method_not_allowed` | 405 | Đường dẫn có nhưng sai phương thức HTTP | (lỗi lập trình — không hiển thị) |
| `common.conflict` | 409 | Xung đột trạng thái | Dữ liệu vừa được thay đổi, hãy tải lại |
| `common.precondition_failed` | 412 | `If-Match` không khớp phiên bản hiện tại | Dữ liệu vừa được người khác sửa |
| `common.idempotency_key_reused` | 422 | Cùng `Idempotency-Key` nhưng khác nội dung request | (lỗi lập trình — không hiển thị) |
| `common.precondition_required` | 428 | Thiếu `If-Match` khi cập nhật | (lỗi lập trình — không hiển thị) |
| `common.rate_limited` | 429 | Vượt giới hạn tần suất (kèm `Retry-After`) | Thao tác quá nhanh, thử lại sau N giây |
| `common.internal_error` | 500 | Lỗi không lường trước | Có lỗi xảy ra — kèm mã yêu cầu `request_id` |
| `common.not_implemented` | 501 | Operation có trong hợp đồng nhưng chưa được hiện thực (chỉ ở giai đoạn dựng khung) | Chức năng chưa sẵn sàng |
| `common.dependency_unavailable` | 503 | Service phụ thuộc không phản hồi / mạch hở | Tạm thời không khả dụng |
| `common.dependency_timeout` | 504 | Service phụ thuộc quá thời gian | Hệ thống phản hồi chậm, thử lại |
| `auth.invalid_credentials` | 401 | Sai tên đăng nhập / mật khẩu (không tiết lộ cái nào sai) | Sai tên đăng nhập hoặc mật khẩu |
| `auth.account_locked` | 401 | Khoá tạm sau 5 lần sai | Tài khoản tạm khoá, thử lại sau |
| `auth.invalid_service_credentials` | 401 | `client_secret` của service sai / service không được phép xin token cho `audience` đó | (lỗi hệ thống — không hiển thị) |
| `auth.refresh_invalid` | 401 | Refresh token không hợp lệ / đã thu hồi / bị dùng lại | Phiên đã hết, hãy đăng nhập lại |
| `forecast.run_not_found` | 404 | `run_id` không tồn tại | Không tìm thấy lượt dự báo |
| `forecast.no_completed_run` | 404 | Chưa có lượt `completed` để làm mặc định | Chưa có lượt dự báo nào |
| `forecast.data_version_not_found` | 404 | Phiên bản dữ liệu không tồn tại | Không tìm thấy phiên bản dữ liệu |
| `forecast.run_not_ready` | 409 | Lượt dự báo chưa `completed` nên chưa có kết quả để đọc | Lượt dự báo chưa chạy xong |
| `forecast.origin_out_of_range` | 400 | `origin_month` ngoài khoảng cho phép của chế độ (backtest > 2010-06) | Tháng neo không hợp lệ cho chế độ này |
| `forecast.model_not_approved` | 409 | Phiên bản mô hình chưa `approved` mà đòi chạy live | Phiên bản mô hình chưa được duyệt |
| `forecast.run_failed` | — | `error_code` của `ForecastRun`/`Job` khi run thất bại | Lượt dự báo thất bại |
| `forecast.run_interrupted` | — | `error_code` khi tiến trình dừng giữa chừng | Lượt dự báo bị gián đoạn, sẽ được chạy lại |
| `surveillance.province_not_found` | 404 | `province_id` không có trong danh mục | Không tìm thấy tỉnh |
| `surveillance.invalid_panel` | 400 | Panel nhập vào không hợp lệ (thiếu cột, không đủ 34 tỉnh, tháng không liên tục, `sha256` không khớp) | Dữ liệu nhập không hợp lệ |
| `surveillance.data_version_conflict` | 409 | `version` đã tồn tại với nội dung khác (phiên bản dữ liệu bất biến) | Phiên bản dữ liệu này đã tồn tại |
| `surveillance.geometry_version_not_found` | 404 | Phiên bản ranh giới không tồn tại | Không tìm thấy phiên bản bản đồ |
| `gateway.alerts_unavailable` | — | `warnings[].code` khi nguồn cảnh báo lỗi (BFF vẫn trả phần còn lại) | Không tải được cảnh báo |
