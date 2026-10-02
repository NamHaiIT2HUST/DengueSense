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
    map: "Bản đồ rủi ro",
    runs: "Lượt dự báo",
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

  forecast: {
    modes: { backtest: "Tái hiện lịch sử", live_experimental: "Thử nghiệm trực tiếp" } as Record<
      string,
      string
    >,
    statuses: {
      queued: "Đang chờ",
      running: "Đang chạy",
      completed: "Hoàn tất",
      failed: "Thất bại",
      interrupted: "Bị gián đoạn",
      cancelled: "Đã huỷ",
    } as Record<string, string>,
    backtestBanner: (origin: string) =>
      `Tái hiện lịch sử: dự báo từ tháng neo ${origin} bằng dữ liệu đo thật. Kết quả sau tháng neo chỉ để đối chiếu với thực tế — không phải dự báo cho hiện tại.`,
    liveBanner:
      "Thử nghiệm trực tiếp: đầu vào có thể là dữ liệu ước lượng và/hoặc ngoài giai đoạn đã kiểm chứng (đến 2010). Không dùng làm dự báo chính thức.",
    provenance: {
      label: "Nguồn gốc số liệu",
      mode: "Chế độ",
      origin: "Tháng neo",
      model: "Mô hình",
      data: "Phiên bản dữ liệu",
      generated: "Tạo lúc",
      limitsLink: "Giới hạn của mô hình",
    },
    baseRate: {
      label: "Mức nền",
      help: "Tỉ lệ tháng vượt ngưỡng trong dữ liệu huấn luyện (nhân quả — biết được tại tháng neo). Mức nền đổi theo năm nên thực tế có thể lệch.",
      ratio: (times: string) => `≈ ${times} lần mức nền`,
      ariaLabel: (p: string, base: string) => `Xác suất vượt ngưỡng ${p}, mức nền ${base}`,
    },
    flagsLabel: "Cờ của dự báo",
    exceedProb: "Xác suất vượt ngưỡng",
    exceedProbHelp:
      "Xác suất số ca tháng đích vượt ngưỡng P75 của chính tỉnh, cùng tháng dương lịch.",
    casesPred: "Số ca dự báo",
    incidencePred: "Tỉ suất dự báo",
    per100k: "/ 100.000 dân",
    threshold: "Ngưỡng P75",
    noInterval:
      "Chưa có khoảng dự báo đã kiểm chứng độ phủ — hệ thống không vẽ khoảng khi chưa có.",
    noForecast: "Không có dự báo",
    horizon: (h: number) => `sau ${h} tháng`,
    horizonTarget: (h: number, month: string) => `sau ${h} tháng (${month})`,
    flags: {
      outbreak_underprediction_risk: {
        label: "Có thể dự báo thấp hơn thực tế",
        note: "Mô hình có xu hướng dự báo thấp khi bùng dịch — cần chuyên môn xem xét.",
      },
      estimated_inputs: {
        label: "Đầu vào ước lượng",
        note: "Một phần dữ liệu đầu vào là số ước lượng, không phải số đo trực tiếp.",
      },
      stale_data: {
        label: "Dữ liệu quá hạn",
        note: "Phiên bản dữ liệu đã quá hạn so với thời điểm dự báo.",
      },
      out_of_validated_period: {
        label: "Ngoài giai đoạn đã kiểm chứng",
        note: "Tháng neo sau giai đoạn đã kiểm chứng (đến 2010) — độ tin cậy chưa được đo.",
      },
    } as Record<string, { label: string; note: string }>,
    inputSources: {
      label: "Nguồn dữ liệu đầu vào",
      real: "đo thật",
      estimated: "ước lượng",
      imputed: "điền khuyết",
    },
    dataSource: {
      real: "Dữ liệu thật",
      estimated: "Ước lượng",
      imputed: "Điền khuyết",
      simulated: "Giả lập",
    } as Record<string, string>,
  },

  map: {
    title: "Bản đồ rủi ro",
    lead: "Dự báo 34 tỉnh cho một lượt và một tầm dự báo. Bảng bên dưới có cùng dữ liệu với bản đồ.",
    controls: {
      run: "Lượt dự báo",
      horizon: "Tầm dự báo",
      metric: "Tô màu theo",
      region: "Vùng",
      allRegions: "Cả nước",
    },
    metrics: {
      exceed_prob: "Xác suất vượt ngưỡng",
      incidence: "Tỉ suất ca dự báo / 100.000 dân",
    },
    legendTitle: {
      exceed_prob: "Xác suất vượt ngưỡng P75",
      incidence: "Ca dự báo / 100.000 dân",
    },
    legendNote:
      "Ngưỡng các lớp màu cố định (xác suất) hoặc do máy chủ tính từ phân vị lịch sử (tỉ suất) — không co giãn theo dữ liệu đang xem.",
    estimatedOutline: "Viền nét đứt: tỉnh có đầu vào ước lượng",
    noForecastColor: "Xám: không có dự báo",
    mapLabel:
      "Bản đồ 34 tỉnh tô màu theo dự báo. Dùng bảng dữ liệu bên dưới để đọc bằng bàn phím hoặc trình đọc màn hình.",
    tableTitle: "Bảng xếp hạng tỉnh",
    columns: {
      rank: "Hạng",
      province: "Tỉnh",
      region: "Vùng",
      exceed: "Xác suất vượt ngưỡng",
      incidence: "Tỉ suất / 100k",
      cases: "Số ca dự báo",
      flags: "Cờ",
    },
    sortBy: (col: string) => `Sắp xếp theo ${col}`,
    openProvince: (name: string) => `Xem chi tiết ${name}`,
    warnings: "Lưu ý về dữ liệu",
    empty: "Chưa có lượt dự báo nào hoàn tất.",
    hoverHint: "Rê chuột vào một tỉnh (hoặc dùng bảng) để xem chi tiết",
  },

  province: {
    back: "Về bản đồ",
    backtestCompare:
      "Phần sau đường “tháng neo” là số đo thật chỉ có trong tái hiện lịch sử — dùng để đối chiếu, không phải thứ mô hình đã biết lúc dự báo.",
    chart: {
      title: "Ca bệnh hàng tháng và dự báo",
      yAxis: "Số ca / tháng",
      observed: "Số ca đo thật",
      observedEstimated: "Số ca ước lượng",
      forecast: "Dự báo",
      threshold: "Ngưỡng P75 (theo tháng)",
      origin: "Tháng neo",
      ariaLabel: (name: string) =>
        `Biểu đồ số ca bệnh hàng tháng của ${name} cùng 4 điểm dự báo. Bảng dữ liệu tương đương nằm ngay bên dưới.`,
      tableSummary: "Bảng dữ liệu của biểu đồ",
      month: "Tháng",
      cases: "Số ca",
      source: "Nguồn",
      kind: "Loại",
      kindObserved: "Quan sát",
      kindForecast: "Dự báo",
    },
    horizons: "Dự báo theo tầm",
    explanation: {
      title: "Yếu tố ảnh hưởng đến dự báo",
      lead: "Năm yếu tố đóng góp nhiều nhất vào dự báo số ca. Đây là giải thích của mô hình, không phải quan hệ nhân quả.",
      component:
        "Giải thích này là của thành phần LightGBM chuẩn — chỉ một phần của mô hình tổ hợp. Các phần còn lại (XGBoost, hồi quy tuyến tính, biến thể riêng của miền Bắc và bước pha với dự báo theo mùa ở miền Nam) không nằm trong giải thích.",
      up: (pct: string) => `làm dự báo tăng khoảng ${pct}`,
      down: (pct: string) => `làm dự báo giảm khoảng ${pct}`,
      inputValue: "Giá trị đầu vào",
      pick: "Tầm dự báo",
      families: {
        recent_cases: "Ca bệnh gần đây",
        seasonal_norm: "Mức mùa vụ",
        climate: "Khí hậu",
        other: "Khác",
      } as Record<string, string>,
    },
    reliability: "Độ tin cậy",
    inputs: "Đầu vào của dự báo",
    notFound: "Không tìm thấy tỉnh này.",
  },

  features: {
    sin_month: "Thời điểm trong năm (mùa vụ), thành phần 1",
    cos_month: "Thời điểm trong năm (mùa vụ), thành phần 2",
    temp_mean_lag_1: "Nhiệt độ trung bình tháng trước",
    temp_mean_lag_2: "Nhiệt độ trung bình 2 tháng trước",
    precip_total_lag_1: "Lượng mưa tháng trước",
    precip_total_lag_2: "Lượng mưa 2 tháng trước",
    humidity_mean_lag_1: "Độ ẩm trung bình tháng trước",
    temp_mean_roll_mean_3: "Nhiệt độ trung bình 3 tháng gần nhất",
    precip_total_roll_mean_3: "Lượng mưa trung bình 3 tháng gần nhất",
    incidence_per_100k_lag_2: "Tỉ suất ca 2 tháng trước",
    incidence_per_100k_lag_3: "Tỉ suất ca 3 tháng trước",
    momentum: "Đà tăng/giảm của ca bệnh",
    acceleration: "Gia tốc của ca bệnh",
    oni_lag_3: "Chỉ số El Niño (ONI) 3 tháng trước",
    oni_lag_6: "Chỉ số El Niño (ONI) 6 tháng trước",
    incidence_per_100k_same_month_last_year: "Tỉ suất ca cùng tháng năm ngoái",
    incidence_per_100k_deviation_from_median: "Độ lệch so với mức trung vị của tháng này",
  } as Record<string, string>,

  /** Đơn vị hiển thị cạnh giá trị đầu vào của yếu tố (chỉ khi chắc chắn về đơn vị). */
  featureUnits: {
    incidence_per_100k_lag_2: "ca / 100.000 dân",
    incidence_per_100k_lag_3: "ca / 100.000 dân",
    incidence_per_100k_same_month_last_year: "ca / 100.000 dân",
    incidence_per_100k_deviation_from_median: "ca / 100.000 dân",
    momentum: "ca / 100.000 dân",
    acceleration: "ca / 100.000 dân",
    temp_mean_lag_1: "°C",
    temp_mean_lag_2: "°C",
    temp_mean_roll_mean_3: "°C",
  } as Record<string, string>,
  /** Yếu tố mà giá trị thô không có ý nghĩa với người đọc (chỉ là mã hoá tuần hoàn của tháng). */
  featureHideValue: ["sin_month", "cos_month"] as readonly string[],

  runs: {
    title: "Lượt dự báo",
    lead: "Mỗi lượt là một kết quả bất biến: tháng neo, phiên bản mô hình và dữ liệu được ghi cố định.",
    columns: {
      origin: "Tháng neo",
      mode: "Chế độ",
      status: "Trạng thái",
      model: "Mô hình",
      data: "Dữ liệu",
      created: "Tạo lúc",
      open: "Mở",
    },
    open: (origin: string) => `Mở bản đồ của lượt tháng neo ${origin}`,
    create: {
      title: "Tạo lượt dự báo tái hiện lịch sử",
      lead: "Chạy nền và có thể mất vài phút. Chỉ tháng neo đến 06/2010 (giai đoạn có dữ liệu thật) được chấp nhận.",
      origin: "Tháng neo",
      submit: "Tạo lượt",
      submitting: "Đang gửi…",
      analystOnly:
        "Chỉ vai trò phân tích trở lên được tạo lượt dự báo. Bạn vẫn xem được danh sách.",
      demoNote: "Bản demo chỉ có sẵn 8 tháng neo từ 11/2009 đến 06/2010; tháng khác sẽ bị từ chối.",
      invalid: "Nhập tháng dạng năm-tháng (ví dụ 2010-03).",
      accepted: "Đã nhận, đang chạy nền.",
      progress: (pct: string) => `Tiến độ ${pct}`,
      done: "Hoàn tất.",
      openResult: "Mở kết quả",
      failed: "Lượt dự báo thất bại.",
    },
    empty: "Chưa có lượt dự báo nào.",
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
