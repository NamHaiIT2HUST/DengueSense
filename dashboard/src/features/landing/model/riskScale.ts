/**
 * Thang màu rủi ro của TRANG GIỚI THIỆU: xếp hạng tương đối 0–100 trên dữ liệu ca bệnh thô (không phải dự báo
 * mô hình). Console dùng lớp rời rạc có ngưỡng cố định do server trả (docs/10 §11.1) — khác thang này.
 */
const RISK_RAMP = [
  "#fff5f0",
  "#fee0d2",
  "#fcbba1",
  "#fc9272",
  "#fb6a4a",
  "#ef3b2c",
  "#cb181d",
  "#99000d",
] as const;

/** Nội suy màu (sequential đỏ, ColorBrewer "Reds") theo risk_score 0–100; ngoài khoảng bị chặn. */
export function riskColor(score: number): string {
  const idx = Math.floor((score / 100) * RISK_RAMP.length);
  const clamped = Math.min(RISK_RAMP.length - 1, Math.max(0, idx));
  return RISK_RAMP[clamped] ?? RISK_RAMP[0];
}

export function riskLabel(score: number): string {
  if (score >= 87.5) return "Rất cao";
  if (score >= 62.5) return "Cao";
  if (score >= 37.5) return "Trung bình";
  if (score >= 12.5) return "Thấp";
  return "Rất thấp";
}
