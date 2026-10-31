export interface AuditRecord {
  id: string;
  timestamp: string;
  isoDate: string;
  actor: string;
  actorRole: "approver" | "officer" | "analyst" | "admin" | "system" | "viewer";
  action:
    | "FOUR_EYES_APPROVAL"
    | "DRAFT_REJECTION"
    | "MILP_ALLOCATION"
    | "AI_INFERENCE_RUN"
    | "ALERT_TRIAGE"
    | "SCENARIO_SIMULATION"
    | "CSV_EXPORT";
  actionName: string;
  entityRef: string;
  guardrailStatus: "PASSED" | "REJECTED" | "FLAGGED";
  checksum: string;
  latencyMs?: number;
  details: string;
}

export const INITIAL_AUDIT_LOGS: AuditRecord[] = [
  {
    id: "AUD-2026-0942",
    timestamp: "18/10/2026 14:35:10",
    isoDate: "2026-10-18T14:35:10+07:00",
    actor: "approver",
    actorRole: "approver",
    action: "FOUR_EYES_APPROVAL",
    actionName: "Phê duyệt Công điện B2G (Quy tắc 4 mắt)",
    entityRef: "draft-south-01",
    guardrailStatus: "PASSED",
    checksum: "8f7b2c9e1a4d6e8f0b3c5a7d9e2f4a6c8b0d2e4f6a8c0e2b4d6f8a0c2e4f6a8b",
    latencyMs: 185,
    details:
      "Thẩm định độc lập B2G, khóa cứng số liệu trích xuất từ ca bệnh, đạt kiểm tra Guardrail G1.",
  },
  {
    id: "AUD-2026-0941",
    timestamp: "18/10/2026 14:12:05",
    isoDate: "2026-10-18T14:12:05+07:00",
    actor: "officer",
    actorRole: "officer",
    action: "MILP_ALLOCATION",
    actionName: "Tối ưu hóa nguồn lực toán học (MILP)",
    entityRef: "case-south-2010-06",
    guardrailStatus: "PASSED",
    checksum: "7a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b",
    latencyMs: 420,
    details:
      "Google OR-Tools giải bài toán phân bổ 1.000.000.000 VNĐ, 20 máy ULV, 450kg Cloramin B; bảo toàn 312 DALYs.",
  },
  {
    id: "AUD-2026-0940",
    timestamp: "18/10/2026 11:45:22",
    isoDate: "2026-10-18T11:45:22+07:00",
    actor: "officer",
    actorRole: "officer",
    action: "ALERT_TRIAGE",
    actionName: "Tiếp nhận & Chuyển hóa Cảnh báo dịch",
    entityRef: "alert-hcm-2010-06",
    guardrailStatus: "PASSED",
    checksum: "6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b",
    latencyMs: 95,
    details: "Khởi tạo hồ sơ can thiệp khẩn cấp từ cảnh báo P75 (Xác suất bùng dịch: 82%).",
  },
  {
    id: "AUD-2026-0939",
    timestamp: "18/10/2026 09:15:00",
    isoDate: "2026-10-18T09:15:00+07:00",
    actor: "demo.phan-tich",
    actorRole: "analyst",
    action: "AI_INFERENCE_RUN",
    actionName: "Chu kỳ suy luận AI M4-R2 Spatio-Temporal",
    entityRef: "run-2010-06-hist",
    guardrailStatus: "PASSED",
    checksum: "5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d",
    latencyMs: 1240,
    details:
      "Hoàn tất dự báo 34 tỉnh 4 tầm (1-2-3-6T); tính toán phân rã nhân quả TreeSHAP với 14 đặc trưng dịch tễ.",
  },
  {
    id: "AUD-2026-0938",
    timestamp: "18/10/2026 08:30:15",
    isoDate: "2026-10-18T08:30:15+07:00",
    actor: "officer",
    actorRole: "officer",
    action: "SCENARIO_SIMULATION",
    actionName: "Diễn tập Kịch bản El Niño Miền Nam",
    entityRef: "scenario-el-nino-south",
    guardrailStatus: "PASSED",
    checksum: "4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b",
    latencyMs: 310,
    details: "Chạy mô phỏng tác chiến tình huống bùng phát sớm tại 2 tỉnh trọng điểm phía Nam.",
  },
  {
    id: "AUD-2026-0937",
    timestamp: "17/10/2026 16:50:40",
    isoDate: "2026-10-17T16:50:40+07:00",
    actor: "demo.xem",
    actorRole: "viewer",
    action: "CSV_EXPORT",
    actionName: "Xuất khẩu Báo cáo Ma trận 34 Tỉnh",
    entityRef: "risk-map-export-2010-06",
    guardrailStatus: "PASSED",
    checksum: "3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e",
    latencyMs: 80,
    details: "Tải file CSV định dạng UTF-8 BOM tích hợp tương thích Microsoft Excel.",
  },
];
