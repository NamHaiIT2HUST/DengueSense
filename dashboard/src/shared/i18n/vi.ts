/**
 * Chuỗi giao diện tiếng Việt cho CONSOLE (docs/10 §10.6) — không viết chuỗi hiển thị cứng trong JSX của
 * console để dễ rà soát câu chữ (luật T8: không dùng ngôn ngữ tuyệt đối). Chưa cần thư viện i18n.
 *
 * Ngoại lệ: trang giới thiệu (`features/landing`) giữ nội dung truyền thông ngay trong component.
 *
 * Giọng văn: ngắn, nêu rõ hành động, thuật ngữ đời thường ("mức nền", "tầm dự báo") — đồng bộ docs/09 §5.2.
 */
export const vi = {
  appName: "DengueSense",

  errors: {
    generic: "Có lỗi xảy ra. Vui lòng thử lại.",
    server: "Hệ thống đang gặp sự cố. Vui lòng thử lại sau ít phút.",
    network: "Không kết nối được tới máy chủ. Kiểm tra mạng rồi thử lại.",
    /**
     * Theo `code` trong contracts/errors.md. Test `vi.test.ts` đảm bảo MỌI mã trong danh mục đều có ở đây
     * (và ngược lại) — thêm mã mới ở hợp đồng thì test này nhắc thêm thông điệp.
     */
    byCode: {
      "common.validation_error": "Kiểm tra lại các trường được đánh dấu.",
      "common.idempotency_key_required": "Có lỗi xảy ra. Vui lòng thử lại.",
      "common.unauthenticated": "Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.",
      "common.forbidden": "Bạn không có quyền thực hiện thao tác này.",
      "common.not_found": "Không tìm thấy.",
      "common.method_not_allowed": "Có lỗi xảy ra. Vui lòng thử lại.",
      "common.conflict": "Dữ liệu vừa được thay đổi. Hãy tải lại rồi thử lại.",
      "common.precondition_failed": "Dữ liệu vừa được người khác sửa. Hãy tải lại.",
      "common.idempotency_key_reused": "Có lỗi xảy ra. Vui lòng thử lại.",
      "common.precondition_required": "Có lỗi xảy ra. Vui lòng thử lại.",
      "common.rate_limited": "Thao tác quá nhanh. Vui lòng thử lại sau ít giây.",
      "common.internal_error": "Có lỗi xảy ra. Vui lòng thử lại.",
      "common.not_implemented": "Chức năng này chưa sẵn sàng.",
      "common.dependency_unavailable": "Hệ thống tạm thời không khả dụng. Vui lòng thử lại sau.",
      "common.dependency_timeout": "Hệ thống phản hồi chậm. Vui lòng thử lại.",
      "auth.invalid_credentials": "Sai tên đăng nhập hoặc mật khẩu.",
      "auth.account_locked": "Tài khoản tạm khoá do nhập sai nhiều lần. Vui lòng thử lại sau.",
      "auth.refresh_invalid": "Phiên đã hết. Vui lòng đăng nhập lại.",
      "forecast.run_not_found": "Không tìm thấy lượt dự báo.",
      "forecast.no_completed_run": "Chưa có lượt dự báo nào hoàn tất.",
      "forecast.data_version_not_found": "Không tìm thấy phiên bản dữ liệu.",
      "forecast.origin_out_of_range": "Tháng neo không hợp lệ cho chế độ này.",
      "forecast.model_not_approved": "Phiên bản mô hình này chưa được duyệt để chạy.",
      "forecast.run_failed": "Lượt dự báo thất bại.",
      "forecast.run_interrupted": "Lượt dự báo bị gián đoạn và sẽ được chạy lại.",
      "surveillance.province_not_found": "Không tìm thấy tỉnh.",
      "surveillance.geometry_version_not_found": "Không tìm thấy phiên bản bản đồ.",
      "gateway.alerts_unavailable": "Không tải được cảnh báo.",
      // Mã phía client (không có trong hợp đồng)
      "client.unexpected_response": "Máy chủ trả về phản hồi không hợp lệ. Vui lòng thử lại.",
      "client.empty_response": "Máy chủ trả về phản hồi trống. Vui lòng thử lại.",
      "client.static_not_found": "Không tải được dữ liệu.",
    } as Record<string, string>,
  },

  common: {
    retry: "Thử lại",
    reload: "Tải lại",
    login: "Đăng nhập lại",
    requestId: "Mã yêu cầu",
    notAvailable: "—",
  },
} as const;
