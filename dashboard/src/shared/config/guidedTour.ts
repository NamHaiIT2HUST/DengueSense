export interface TourStep {
  id: string;
  stageBadge: string;
  stageColor: string;
  title: string;
  role: "viewer" | "analyst" | "officer" | "approver";
  roleName: string;
  targetRoute: string;
  description: string;
  highlights: readonly string[];
  actionPrompt: string;
}

export const GUIDED_TOUR_STEPS: readonly TourStep[] = [
  {
    id: "step-overview",
    stageBadge: "Chặng 1/5 • Giám sát vĩ mô",
    stageColor: "bg-blue-500/10 text-blue-600 dark:text-cyan-400 border-blue-500/30",
    title: "1. Giám sát rủi ro dịch bệnh 34 tỉnh thành",
    role: "viewer",
    roleName: "Người quan sát / Chuyên viên",
    targetRoute: "/app/ban-do",
    description:
      "Nền tảng hiển thị bản đồ trực quan với 4 tầm dự báo (1, 3, 6, 12 tháng) ứng dụng mô hình AI M4-R2 (LightGBM + LSTM-ResNet) trên chuỗi dữ liệu 1997–2020.",
    highlights: [
      "Bản đồ phân vùng dịch tễ Leaflet theo 3 vùng miền",
      "Bảng xếp hạng 34 tỉnh với chỉ số tỉ suất ca và xác suất vượt ngưỡng",
      "Tính năng xuất CSV báo cáo đạt chuẩn RFC 4180 và UTF-8 BOM",
    ],
    actionPrompt: "Khám phá Bản đồ Dịch tễ",
  },
  {
    id: "step-shap",
    stageBadge: "Chặng 2/5 • Phân tích chuyên sâu",
    stageColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
    title: "2. Giải trình nhân quả AI (TreeSHAP) & Viễn thám ERA5",
    role: "analyst",
    roleName: "Chuyên viên phân tích",
    targetRoute: "/app/tinh/79",
    description:
      "Minh bạch hóa mọi quyết định của AI với cơ chế TreeSHAP: xem đóng góp định lượng của các yếu tố khí hậu ERA5 (nhiệt độ, lượng mưa, độ ẩm) và độ trễ sinh học của vector muỗi vằn.",
    highlights: [
      "Giải trình đóng góp từng đặc trưng khí tượng thủy văn",
      "Biểu đồ chuỗi thời gian đối sánh số ca thực tế và dự báo",
      "Cảnh báo độ tin cậy và 12 ranh giới khoa học minh bạch",
    ],
    actionPrompt: "Xem Chi tiết Dịch tễ TP.HCM",
  },
  {
    id: "step-case",
    stageBadge: "Chặng 3/5 • Tác chiến can thiệp",
    stageColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    title: "3. Khởi tạo hồ sơ & Tối ưu nguồn lực can thiệp (MILP)",
    role: "officer",
    roleName: "Cán bộ điều hành CDC",
    targetRoute: "/app/ho-so/case-south-2010-06",
    description:
      "Tự động tích hợp cảnh báo dịch vào hồ sơ tác chiến. Chạy thuật toán quy hoạch nguyên hỗn hợp (MILP) để phân bổ tối ưu giường bệnh, hóa chất diệt muỗi và đội cơ động dưới trần ngân sách ngặt nghèo.",
    highlights: [
      "Thuật toán MILP giải trong < 3 giây với ràng buộc ngân sách thực",
      "Dự báo số ca bệnh ngăn chặn được (Prevented Cases)",
      "Bảng phân bổ chi tiết có thể xuất Excel phục vụ báo cáo",
    ],
    actionPrompt: "Mở Hồ sơ Tác chiến Nam Bộ",
  },
  {
    id: "step-draft",
    stageBadge: "Chặng 4/5 • Thể chế hóa B2G",
    stageColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    title: "4. Soạn thảo & Thẩm định công điện theo Nghị định 30/2020/NĐ-CP",
    role: "officer",
    roleName: "Cán bộ điều hành CDC",
    targetRoute: "/app/du-thao/draft-south-2010-06",
    description:
      "Hệ sinh thái B2G tự động sinh dự thảo công điện khẩn cấp theo thể thức hành chính chuẩn quốc gia. Hệ thống kích hoạt 5 lớp guardrails kiểm soát nghiêm ngặt số liệu.",
    highlights: [
      "Thể thức văn bản hành chính Việt Nam chuẩn xác 100%",
      "Guardrails ngăn chặn số liệu ảo và sai lệch ngân sách",
      "Chế độ xem trước trang in A4 chuẩn công vụ",
    ],
    actionPrompt: "Xem Dự thảo Công điện Khẩn",
  },
  {
    id: "step-approval",
    stageBadge: "Chặng 5/5 • Quyết định & Phê duyệt",
    stageColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    title: "5. Phê duyệt 4 mắt & Ban hành văn bản chỉ đạo",
    role: "approver",
    roleName: "Lãnh đạo phê duyệt",
    targetRoute: "/app/du-thao/draft-south-2010-06",
    description:
      "Thực thi nghiêm ngặt nguyên tắc Four-Eyes (người soạn không được tự phê duyệt). Lãnh đạo Sở/Bộ thẩm định, ghi nhận chữ ký số mật mã và ban hành chính thức.",
    highlights: [
      "Chữ ký số xác thực tính toàn vẹn văn bản",
      "Lịch sử kiểm toán và audit log bất biến",
      "Xuất lệnh can thiệp tới các đơn vị y tế cơ sở",
    ],
    actionPrompt: "Trải nghiệm Phê duyệt Lãnh đạo",
  },
];
