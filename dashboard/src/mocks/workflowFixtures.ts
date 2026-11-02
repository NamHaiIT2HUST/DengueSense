import type { Alert, AllocationPlan, CaseDetail, DispatchDraft, DispatchOrder } from "@/shared/api";

export const alertsFixture: Alert[] = [
  {
    id: "alert-hcm-01",
    run_id: "demo-run-2010-06",
    province_id: "ho_chi_minh",
    status: "open",
    created_at: "2010-06-01T08:00:00Z",
  },
  {
    id: "alert-angiang-01",
    run_id: "demo-run-2010-06",
    province_id: "an_giang",
    status: "open",
    created_at: "2010-06-01T08:30:00Z",
  },
  {
    id: "alert-danang-01",
    run_id: "demo-run-2010-06",
    province_id: "da_nang",
    status: "open",
    created_at: "2010-06-01T09:00:00Z",
  },
  {
    id: "alert-dongnai-01",
    run_id: "demo-run-2010-05",
    province_id: "dong_nai",
    status: "closed",
    created_at: "2010-05-15T10:00:00Z",
  },
];

export const planSouth01: AllocationPlan = {
  id: "plan-south-01",
  case_id: "case-south-2010-06",
  budget: 1_000_000_000,
  total_cost: 950_000_000,
  estimated_cases_prevented: 420,
  allocations: [
    {
      province_id: "ho_chi_minh",
      amount: 600_000_000,
      explanation: "Đô thị mật độ dân số cao, xác suất vượt ngưỡng 82%, dự kiến giảm 280 ca.",
      beds: 80,
      supplies: 450,
      teams: 6,
      cases_pred: 1000,
    },
    {
      province_id: "an_giang",
      amount: 350_000_000,
      explanation: "Vùng biên giới có đà dịch tăng nhanh, dự kiến ngăn chặn 140 ca mắc.",
      beds: 40,
      supplies: 280,
      teams: 3,
      cases_pred: 500,
    },
  ],
  status: "confirmed",
  version: 1,
  confirmed_by: "officer",
  confirmed_at: "2010-06-02T15:00:00Z",
  created_at: "2010-06-02T14:00:00Z",
};

export const planCentral01: AllocationPlan = {
  id: "plan-central-01",
  case_id: "case-central-2010-06",
  budget: 500_000_000,
  total_cost: 480_000_000,
  estimated_cases_prevented: 180,
  allocations: [
    {
      province_id: "da_nang",
      amount: 480_000_000,
      explanation: "Dự phòng vùng trọng điểm miền Trung",
      beds: 30,
      supplies: 150,
      teams: 2,
      cases_pred: 350,
    },
  ],
  status: "draft",
  version: 1,
  created_at: "2010-06-03T11:00:00Z",
};

export const plansFixture: Record<string, AllocationPlan> = {
  "plan-south-01": planSouth01,
  "plan-central-01": planCentral01,
};

export const casesFixture: CaseDetail[] = [
  {
    id: "case-south-2010-06",
    alert_id: "alert-hcm-01",
    title: "Kế hoạch ứng phó dịch Sốt xuất huyết khu vực miền Nam (Tháng 06/2010)",
    status: "open",
    created_by: "officer",
    created_at: "2010-06-02T09:00:00Z",
    alert_ids: ["alert-hcm-01", "alert-angiang-01"],
    latest_plan_id: "plan-south-01",
    latest_draft_id: "draft-south-01",
    latest_plan: planSouth01,
  },
  {
    id: "case-central-2010-06",
    alert_id: "alert-danang-01",
    title: "Giám sát dịch SXH khu vực Duyên hải Miền Trung",
    status: "open",
    created_by: "officer",
    created_at: "2010-06-03T10:00:00Z",
    alert_ids: ["alert-danang-01"],
    latest_plan_id: "plan-central-01",
    latest_plan: planCentral01,
  },
];

export const draftsFixture: Record<string, DispatchDraft> = {
  "draft-south-01": {
    id: "draft-south-01",
    case_id: "case-south-2010-06",
    version: 1,
    draft_type: "b2g",
    title: "Dự thảo điều phối mô phỏng phòng, chống sốt xuất huyết khu vực phía Nam",
    content: `BẢN MÔ PHỎNG CUỘC THI — CHƯA BAN HÀNH, CHƯA KÝ

Kính gửi: Các đơn vị tham gia diễn tập tại TP. Hồ Chí Minh và An Giang.

Hồ sơ tham chiếu: Kế hoạch ứng phó dịch sốt xuất huyết khu vực miền Nam, tháng 06/2010. Đây là tình huống đối chứng lịch sử, không phải cảnh báo hiện tại.

Phương án phân bổ trong hồ sơ đang chờ cán bộ xác nhận; các chỉ số nguồn lực chỉ phục vụ diễn tập.

Đề nghị cán bộ rà soát số liệu dự báo, địa bàn và khả năng đáp ứng trước khi đề xuất biện pháp cụ thể.

Nơi nhận: Các đơn vị tham gia diễn tập.`,
    content_hash: "hash-draft-south-v1",
    status: "PENDING_REVIEW",
    created_by: "officer",
    created_at: "2010-06-02T16:00:00Z",
    updated_at: "2010-06-02T16:00:00Z",
  },
};

export const ordersFixture: DispatchOrder[] = [];
