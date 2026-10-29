export interface TacticalScenario {
  id: string;
  badge: string;
  badgeColor: string;
  title: string;
  region: string;
  provinces: string[];
  summary: string;
  epidemiologyContext: string;
  budget: number;
  recommendedRole: "officer" | "approver" | "analyst";
  targetRoute: string;
  keyOutcomes: {
    preventedCases: number;
    beds: number;
    supplies: number;
    teams: number;
  };
}

export const TACTICAL_SCENARIOS: readonly TacticalScenario[] = [
  {
    id: "scenario-south-el-nino",
    badge: "Bùng phát diện rộng",
    badgeColor: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
    title: "Kịch bản 1: Bùng phát dịch El Niño phía Nam",
    region: "Miền Nam",
    provinces: ["TP. Hồ Chí Minh", "An Giang"],
    summary:
      "Dự báo tháng 06/2010 ghi nhận xác suất vượt ngưỡng dịch 82% tại TP.HCM và đà tăng mạnh tại An Giang do pha nóng ẩm El Niño.",
    epidemiologyContext:
      "Chỉ số mật độ lăng quăng/bọ gậy BI vượt mức 45, nguy cơ bùng phát dịch diện rộng trong vòng 3 tháng tới.",
    budget: 1_000_000_000,
    recommendedRole: "officer",
    targetRoute: "/app/ho-so/case-south-2010-06",
    keyOutcomes: {
      preventedCases: 420,
      beds: 120,
      supplies: 730,
      teams: 9,
    },
  },
  {
    id: "scenario-central-outbreak",
    badge: "Bất thường trái mùa",
    badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    title: "Kịch bản 2: Nguy cơ bất thường Duyên hải Miền Trung",
    region: "Miền Trung",
    provinces: ["Đà Nẵng", "Quảng Nam"],
    summary:
      "Lượng mưa tích lũy ERA5 tăng vọt 35% so với mức nền nhiều năm, kích hoạt cảnh báo sớm mức P75 tại Đà Nẵng.",
    epidemiologyContext:
      "Đợt dịch trái mùa đe dọa các khu vực đô thị du lịch ven biển. Cần kích hoạt sớm đội phản ứng nhanh cơ động.",
    budget: 600_000_000,
    recommendedRole: "officer",
    targetRoute: "/app/ho-so/case-central-2010-06",
    keyOutcomes: {
      preventedCases: 230,
      beds: 60,
      supplies: 350,
      teams: 4,
    },
  },
  {
    id: "scenario-scarcity-optimization",
    badge: "Ngân sách thắt chặt",
    badgeColor: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
    title: "Kịch bản 3: Tối ưu hoá nguồn lực ngặt nghèo (Scarcity MILP)",
    region: "Toàn quốc",
    provinces: ["TP. Hồ Chí Minh", "An Giang", "Đà Nẵng"],
    summary:
      "Ngân sách khẩn cấp chỉ còn 400 triệu VNĐ từ quỹ dự phòng. MILP giải bài toán đa mục tiêu dồn lực vào điểm nóng nguy kịch.",
    epidemiologyContext:
      "Kiểm chứng tính ưu việt của giải thuật toán học Google OR-Tools: tối đa hóa số ca ngăn chặn trên từng đồng kinh phí.",
    budget: 400_000_000,
    recommendedRole: "approver",
    targetRoute: "/app/du-thao/draft-south-01",
    keyOutcomes: {
      preventedCases: 195,
      beds: 45,
      supplies: 260,
      teams: 3,
    },
  },
];
