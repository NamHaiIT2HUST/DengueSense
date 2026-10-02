/**
 * Phân lớp giá trị vào các lớp màu do MÁY CHỦ trả trong `legend` (docs/10 §11.1): frontend không tự đặt ngưỡng.
 * Lớp được chọn theo cận DƯỚI (`min`): giá trị thuộc lớp cuối cùng có `min` ≤ giá trị. Giá trị lớn hơn cận trên của lớp
 * cuối vẫn rơi vào lớp cuối (dữ liệu mới có thể vượt mọi tháng lịch sử).
 */
import type { LegendClass } from "@/shared/api";

export const RISK_CLASS_COUNT = 5;

/** Chỉ số lớp 0..n-1, hoặc null nếu không có giá trị hợp lệ. */
export function classIndex(
  value: number | null | undefined,
  legend: readonly LegendClass[]
): number | null {
  if (value == null || !Number.isFinite(value) || legend.length === 0) return null;
  let idx = 0;
  for (let i = 0; i < legend.length; i++) {
    if (value >= (legend[i] as LegendClass).min) idx = i;
  }
  return idx;
}

/** Tên biến CSS của màu lớp (`--risk-class-1..5`); `none` khi không có dự báo. */
export function classColorVar(index: number | null): string {
  return index == null
    ? "--risk-class-none"
    : `--risk-class-${Math.min(index, RISK_CLASS_COUNT - 1) + 1}`;
}

/** Màu thật (chuỗi CSS) cho Leaflet — đọc biến CSS từ :root để có MỘT nguồn sự thật cho màu. */
export function resolveColor(cssVar: string): string {
  if (typeof document === "undefined") return "#888888";
  const v = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  return v || "#888888";
}
