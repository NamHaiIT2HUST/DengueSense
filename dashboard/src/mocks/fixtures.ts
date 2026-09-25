/**
 * Dữ liệu mẫu KHỚP hợp đồng (kiểu lấy từ schema sinh — sai hình dạng là lỗi biên dịch). Số liệu mô hình lấy từ
 * kết quả thật của exp_016 / docs/07 (model card), KHÔNG bịa: chế độ demo phải nói đúng cả điểm mạnh lẫn giới hạn.
 */
import type { Limitation, ModelCard, ModelVersion, Province, User } from "@/shared/api";

export const provincesFixture: Province[] = [
  { province_id: "ha_noi", name: "Hà Nội", region: "Bắc", population: 8_500_000 },
  { province_id: "ho_chi_minh", name: "Hồ Chí Minh", region: "Nam", population: 9_300_000 },
];

export const userFixture: User = {
  id: "0192f3a1-0000-7000-8000-000000000001",
  username: "viewer",
  display_name: "Người xem thử",
  roles: ["viewer"],
  org_id: "cdc-demo",
};

export const MODEL_VERSION = "m4-r2@1.0.0";

export const modelCardFixture: ModelCard = {
  model_version: MODEL_VERSION,
  intended_use:
    "Hỗ trợ ra quyết định của cán bộ y tế (con người luôn xem xét): đầu vào cho phân bổ nguồn lực và tín hiệu cảnh báo sớm để kiểm tra thêm, không thay thế phán đoán chuyên môn.",
  not_for: [
    "Ra quyết định tự động không có người xem xét",
    "Dự báo cấp huyện/xã hoặc cá nhân (chưa được kiểm chứng)",
    "Dùng trực tiếp trên dữ liệu sau 2010 khi chưa huấn luyện lại",
    'Khẳng định "báo trước 5–9 tuần" như một khả năng chung',
  ],
  performance: {
    multi_season: {
      seasons: 6,
      mase_pooled_mean: 0.515,
      mase_pooled_sd: 0.17,
      beats_baseline_seasons: 6,
      improvement_vs_baseline: { mean: 0.222, ci95_lower: 0.182, ci95_upper: 0.26 },
    },
    alerting: { roc_auc_mean: 0.809, roc_auc_sd: 0.041, base_rate_range: [0.131, 0.351] },
  },
  reliability_by_region: {
    Bắc: { region_level: "low_in_outbreak_years", note_code: "bac_outbreak_years" },
    Trung: { region_level: "high", note_code: "trung_stable" },
    Nam: { region_level: "equal_to_seasonal_baseline", note_code: "nam_equals_baseline" },
  },
  updated_at: "2026-09-25T02:00:00Z",
};

export const limitationsFixture: Limitation[] = [
  {
    id: "L1",
    title: "Năm dịch bất thường: mô hình và baseline đều thất bại",
    summary:
      "Miền Bắc 2009: MASE 2,40 (baseline 2,60); 2010: 1,34. Bốn mùa còn lại miền Bắc chỉ 0,34–0,40. Ở mùa 2010, mô hình thua cả baseline ở miền Bắc.",
    severity: "high",
    evidence: "exp_006–008, 016",
  },
  {
    id: "L2",
    title: "Dự báo 6 tháng khó nhất",
    summary:
      "h=6 có MASE 1,39 ở mùa 2010 nhưng dưới 1 ở 5/6 mùa (trung bình 0,81); baseline luôn tệ hơn.",
    severity: "moderate",
    evidence: "exp_008, 016",
  },
  {
    id: "L3",
    title: "Dự báo thấp có hệ thống khi bùng dịch (mọi mùa)",
    summary:
      "Độ chệch từ −3,6 đến −37,5 ca/100k; mùa 2008 nặng nhất (98% dự báo dưới một nửa thực tế). Đã thử nhiều cách sửa nhưng chưa khắc phục được.",
    severity: "high",
    evidence: "exp_006–009, 016",
  },
  {
    id: "L4",
    title: "Cảnh báo chỉ đạt mốc tham chiếu ở một nửa số mùa",
    summary:
      "ROC-AUC 0,81 ± 0,04; chỉ 3/6 mùa đạt 0,83 trở lên; mùa 2010 thấp nhất (0,76). Với mức chính xác 80%, chỉ phát hiện khoảng 30% số tháng vượt ngưỡng.",
    severity: "high",
    evidence: "exp_012, 013, 016",
  },
  {
    id: "L5",
    title: "Miền Nam: ngang dự báo theo mùa và phân loại kém",
    summary: "Chỉ hơn baseline theo mùa ở 3/6 mùa; ROC-AUC miền Nam 0,73 ± 0,09.",
    severity: "moderate",
    evidence: "exp_012, 016",
  },
  {
    id: "L6",
    title: "Thời gian báo trước còn yếu",
    summary: "37% sự kiện vượt ngưỡng được báo trước, trung vị 2 tháng, đo trên một mùa dịch.",
    severity: "moderate",
    evidence: "exp_011",
  },
  {
    id: "L7",
    title: "Chỉ có 6 mùa (2005–2010) và 34 tỉnh; các mùa đến 2009 bị nhiễm thiết kế",
    summary:
      "Khoảng tin cậy còn lạc quan; số tuyệt đối 2005–2008 lạc quan hơn thực tế. Chênh lệch dưới 1% giữa các mô hình là nhiễu.",
    severity: "moderate",
    evidence: "exp_016",
  },
  {
    id: "L8",
    title: "Dữ liệu ca bệnh đo thật kết thúc năm 2010",
    summary:
      "Chưa kiểm chứng trên giai đoạn 2011 trở đi, kể cả các năm bất thường 2020–2021 và 2023.",
    severity: "high",
    evidence: "docs/01 §8",
  },
  {
    id: "L9",
    title: "Phân phối dữ liệu thay đổi theo thời gian",
    summary:
      "Tỉ lệ tháng vượt ngưỡng (mức nền) tăng từ 13% lên 35% qua 2005–2010; tham số và hiệu chỉnh tối ưu ở quá khứ không chuyển sang giai đoạn sau.",
    severity: "moderate",
    evidence: "exp_003, 011, 012, 016",
  },
  {
    id: "L10",
    title: "Độ trễ tính theo số dòng, không theo tháng lịch",
    summary:
      "5/34 tỉnh có tháng thiếu → 2,2% dòng lệch đặc trưng. Đã đo: ảnh hưởng đến MASE gộp chỉ +0,17%, không đổi kết luận.",
    severity: "info",
    evidence: "exp_009, 015",
  },
  {
    id: "L11",
    title: "Một số tình huống chưa được kiểm",
    summary:
      "Gián đoạn dữ liệu khí hậu liên tục 2–3 tháng; nhiễu trong dữ liệu huấn luyện; nhiễu có tương quan.",
    severity: "info",
    evidence: "exp_010",
  },
  {
    id: "L12",
    title: "Mô hình tuyến tính dùng hiệu ứng cố định, không phải mô hình phân cấp thật",
    summary: "Không dự báo được cho tỉnh chưa từng có trong dữ liệu huấn luyện.",
    severity: "info",
    evidence: "exp_002",
  },
];

export const modelVersionsFixture: ModelVersion[] = [
  {
    model_version: MODEL_VERSION,
    status: "approved",
    description:
      "Ensemble (M1 + 2×GBM)/3 có định tuyến theo vùng — bản chọn sau đánh giá nhiều mùa.",
    source_experiments: ["exp_008", "exp_016"],
  },
];
