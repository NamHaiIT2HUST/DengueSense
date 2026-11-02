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
      "Bản đồ hiển thị bốn tầm dự báo (1, 2, 3 và 6 tháng). Chọn năm 2010 để xem đối chứng lịch sử hoặc 2026 để xem dự báo thử nghiệm có đầu vào ước tính.",
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
    targetRoute: "/app/ho-so",
    description:
      "Chọn một hồ sơ từ danh sách, kiểm tra cảnh báo đính kèm rồi lập và xác nhận phương án phân bổ nguồn lực. Số liệu hiệu quả can thiệp trong diễn tập là ước tính mô phỏng.",
    highlights: [
      "Thuật toán MILP giải trong < 3 giây với ràng buộc ngân sách thực",
      "Dự báo số ca bệnh ngăn chặn được (Prevented Cases)",
      "Bảng phân bổ chi tiết có thể xuất Excel phục vụ báo cáo",
    ],
    actionPrompt: "Mở danh sách hồ sơ",
  },
  {
    id: "step-draft",
    stageBadge: "Chặng 4/5 • Thể chế hóa B2G",
    stageColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    title: "4. Soạn thảo & Thẩm định công điện theo Nghị định 30/2020/NĐ-CP",
    role: "officer",
    roleName: "Cán bộ điều hành CDC",
    targetRoute: "/app/ho-so",
    description:
      "Mở hồ sơ có dự thảo để kiểm tra nội dung, nguồn số liệu và sáu guardrail G1–G6. Văn bản trong demo chỉ là bản mô phỏng chờ cán bộ rà soát, chưa được ban hành.",
    highlights: [
      "Bản xem trước văn bản dễ đọc, có nhãn mô phỏng",
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
    targetRoute: "/app/ho-so",
    description:
      "Thử luồng duyệt bốn mắt: người tạo dự thảo không tự phê duyệt. Dấu kiểm toán nội bộ trong demo không phải chữ ký số công vụ hay hành vi ban hành thật.",
    highlights: [
      "Mã băm kiểm tra tính toàn vẹn bản mô phỏng",
      "Lịch sử kiểm toán và audit log bất biến",
      "Xuất lệnh can thiệp tới các đơn vị y tế cơ sở",
    ],
    actionPrompt: "Trải nghiệm Phê duyệt Lãnh đạo",
  },
];
