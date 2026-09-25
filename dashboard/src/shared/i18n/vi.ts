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
      "auth.invalid_service_credentials": "Có lỗi hệ thống. Vui lòng thử lại sau.",
      "auth.refresh_invalid": "Phiên đã hết. Vui lòng đăng nhập lại.",
      "forecast.run_not_found": "Không tìm thấy lượt dự báo.",
      "forecast.no_completed_run": "Chưa có lượt dự báo nào hoàn tất.",
      "forecast.data_version_not_found": "Không tìm thấy phiên bản dữ liệu.",
      "forecast.run_not_ready": "Lượt dự báo chưa chạy xong.",
      "forecast.origin_out_of_range": "Tháng neo không hợp lệ cho chế độ này.",
      "forecast.model_not_approved": "Phiên bản mô hình này chưa được duyệt để chạy.",
      "forecast.run_failed": "Lượt dự báo thất bại.",
      "forecast.run_interrupted": "Lượt dự báo bị gián đoạn và sẽ được chạy lại.",
      "surveillance.province_not_found": "Không tìm thấy tỉnh.",
      "surveillance.invalid_panel": "Dữ liệu nhập không hợp lệ.",
      "surveillance.data_version_conflict": "Phiên bản dữ liệu này đã tồn tại.",
      "surveillance.geometry_version_not_found": "Không tìm thấy phiên bản bản đồ.",
      "gateway.alerts_unavailable": "Không tải được cảnh báo.",
      // Mã phía client (không có trong hợp đồng)
      "client.unexpected_response": "Máy chủ trả về phản hồi không hợp lệ. Vui lòng thử lại.",
      "client.empty_response": "Máy chủ trả về phản hồi trống. Vui lòng thử lại.",
      "client.static_not_found": "Không tải được dữ liệu.",
    } as Record<string, string>,
  },

  nav: {
    skipToContent: "Bỏ qua điều hướng, tới nội dung chính",
    console: "Điều hướng chính",
    model: "Mô hình & giới hạn",
    home: "Trang giới thiệu",
  },

  auth: {
    title: "Đăng nhập",
    subtitle: "Dành cho cán bộ được cấp tài khoản.",
    username: "Tên đăng nhập",
    password: "Mật khẩu",
    submit: "Đăng nhập",
    submitting: "Đang đăng nhập…",
    logout: "Đăng xuất",
    required: "Trường này là bắt buộc.",
    tooLong: "Quá dài.",
    demoBanner:
      "Bản demo — tài khoản và dữ liệu chỉ để minh hoạ, chạy hoàn toàn trên trình duyệt của bạn.",
    demoAccounts: "Tài khoản demo",
    signedInAs: "Đăng nhập với tên",
    backToLanding: "Về trang giới thiệu",
    fillDemo: "Điền sẵn",
  },

  regions: { Bắc: "Miền Bắc", Trung: "Miền Trung", Nam: "Miền Nam" } as Record<string, string>,

  reliability: {
    levels: {
      high: "Cao",
      high_normal_years: "Cao ở năm bình thường",
      low_in_outbreak_years: "Thấp ở năm dịch bất thường",
      equal_to_seasonal_baseline: "Ngang dự báo theo mùa",
    } as Record<string, string>,
    /**
     * Theo `note_code` của API. Câu chữ theo model card (docs/07 §12.4): nêu cả điểm mạnh lẫn giới hạn,
     * không dùng lời tuyệt đối (luật T8).
     */
    notes: {
      bac_outbreak_years:
        "Dự báo tốt ở năm dịch bình thường nhưng thất bại ở năm dịch bất thường (kể cả dự báo theo mùa đơn giản cũng vậy). Khi có dấu hiệu năm bất thường, hãy hạ mức tin cậy.",
      trung_stable: "Mạnh và ổn định: tốt hơn dự báo theo mùa ở cả 6 mùa đã kiểm.",
      nam_equals_baseline:
        "Chỉ ngang dự báo theo mùa đơn giản (hơn ở 3/6 mùa); cảnh báo vượt ngưỡng ở miền này còn yếu.",
    } as Record<string, string>,
    unknownNote: "Chưa có ghi chú về độ tin cậy cho khu vực này.",
  },

  severity: { high: "Nghiêm trọng", moderate: "Đáng kể", info: "Lưu ý" } as Record<string, string>,

  model: {
    title: "Mô hình & giới hạn",
    lead: "Những gì hệ thống dự báo được, chưa dự báo được, và mức độ tin cậy đã đo — để cán bộ dùng đúng chỗ.",
    version: "Phiên bản mô hình",
    updatedAt: "Cập nhật",
    purpose: "Mục đích sử dụng",
    notFor: "KHÔNG dùng cho",
    performance: "Hiệu năng đã đo (nhiều mùa)",
    performanceNote:
      "Đánh giá trên 6 mùa 2005–2010 bằng dữ liệu ca bệnh đo thật. Mùa 2010 là mùa khó nhất với mọi mô hình; các mùa đến 2009 có thể lạc quan do thiết kế được chọn trên chính dữ liệu đó (xem giới hạn L7).",
    forecastAccuracy: "Sai số dự báo số ca (MASE, gộp)",
    forecastAccuracyHelp:
      "Thấp hơn là tốt hơn. 1,00 = ngang cách dự báo đơn giản “bằng tháng này năm ngoái”.",
    beatsBaseline: "Hơn dự báo theo mùa đơn giản",
    beatsBaselineValue: (n: number, total: number) => `${n}/${total} mùa`,
    improvement: "Mức cải thiện so với dự báo theo mùa",
    improvementCi: (lo: string, hi: string) =>
      `khoảng tin cậy 95%: ${lo} – ${hi} (có thể lạc quan)`,
    alerting: "Cảnh báo tháng vượt ngưỡng (ROC-AUC)",
    alertingHelp:
      "0,50 là đoán ngẫu nhiên, 1,00 là hoàn hảo. Mốc tham chiếu của hệ thống đang vận hành ở Việt Nam: 0,83–0,94.",
    baseRate: "Mức nền tháng vượt ngưỡng",
    baseRateHelp: (lo: string, hi: string) =>
      `Thay đổi theo năm (${lo} – ${hi} trong 2005–2010). Luôn đọc xác suất cảnh báo cùng mức nền.`,
    reliability: "Độ tin cậy theo vùng",
    limitations: "Giới hạn đã biết",
    limitationsLead:
      "Mỗi giới hạn đều có số đo và nguồn thí nghiệm. Đây là các điểm cần chú ý khi diễn giải kết quả.",
    evidence: "Nguồn",
  },

  common: {
    retry: "Thử lại",
    reload: "Tải lại",
    login: "Đăng nhập lại",
    requestId: "Mã yêu cầu",
    notAvailable: "—",
    loading: "Đang tải",
  },
} as const;
