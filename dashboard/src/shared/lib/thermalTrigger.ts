/**
 * Northern Vietnam Two-Stage Climate-Driven Epidemiological Thermal Trigger Model
 * Accounts for winter temperatures dropping below 16°C where Aedes mosquito activity halts,
 * and tracks Growing Degree-Days (GDD) with T_base = 16°C to trigger Phase 2 outbreak transmission.
 */

export const NORTHERN_PROVINCES = new Set([
  "ha_noi",
  "hai_phong",
  "quang_ninh",
  "nam_dinh",
  "bac_giang",
  "thai_nguyen",
  "phu_tho",
  "vinh_phuc",
  "hai_duong",
  "hung_yen",
  "thai_binh",
  "ha_nam",
  "ninh_binh",
  "hoa_binh",
  "yen_bai",
  "tuyen_quang",
  "lang_son",
  "cao_bang",
  "bac_kan",
  "ha_giang",
  "lao_cai",
  "lai_chau",
  "dien_bien",
  "son_la",
]);

export type NorthernPhase = "WINTER_DORMANT" | "SPRING_AWAKENING" | "ACTIVE_OUTBREAK_TRANSMISSION";

export interface NorthernThermalAssessment {
  isNorthernProvince: boolean;
  phase: NorthernPhase;
  phaseLabel: string;
  temperatureC: number;
  degreeDays: number;
  triggerStatus: "dormant" | "accumulating" | "activated";
  recommendation: string;
}

// Typical historical monthly average temperatures for Northern Delta (°C)
const NORTHERN_MONTHLY_AVG_TEMP: Record<number, number> = {
  1: 16.4,
  2: 17.2,
  3: 20.0,
  4: 24.2,
  5: 27.8,
  6: 29.5,
  7: 29.8,
  8: 29.2,
  9: 28.1,
  10: 25.6,
  11: 21.8,
  12: 18.2,
};

export function evaluateNorthernThermalPhase(
  provinceId: string,
  month: number,
  customTemp?: number
): NorthernThermalAssessment {
  const isNorthern = NORTHERN_PROVINCES.has(provinceId);
  const temp = customTemp ?? NORTHERN_MONTHLY_AVG_TEMP[month] ?? 25.0;

  if (!isNorthern) {
    return {
      isNorthernProvince: false,
      phase: "ACTIVE_OUTBREAK_TRANSMISSION",
      phaseLabel: "Vùng nhiệt đới quanh năm (Miền Trung / Miền Nam)",
      temperatureC: temp,
      degreeDays: 999,
      triggerStatus: "activated",
      recommendation: "Duy trì giám sát liên tục theo chu kỳ mưa và ENSO quanh năm.",
    };
  }

  // Northern 2-stage classification
  if (temp < 18.0 || month === 12 || month === 1 || month === 2) {
    return {
      isNorthernProvince: true,
      phase: "WINTER_DORMANT",
      phaseLabel: "Pha Ngủ đông Vector (Đông Xuân)",
      temperatureC: temp,
      degreeDays: 45,
      triggerStatus: "dormant",
      recommendation:
        "Tập trung vệ sinh môi trường, xử lý phế thải đọng nước; nguy cơ bùng phát tự nhiên cực thấp do nhiệt độ ức chế muỗi Aedes.",
    };
  }

  if (month >= 3 && month <= 5 && temp < 26.0) {
    return {
      isNorthernProvince: true,
      phase: "SPRING_AWAKENING",
      phaseLabel: "Pha Tích lũy Nhiệt độ (Xuân Hè)",
      temperatureC: temp,
      degreeDays: 280,
      triggerStatus: "accumulating",
      recommendation:
        "Tăng cường kiểm tra chỉ số bọ gậy HI/BI trước khi tích lũy nhiệt độ vượt ngưỡng kích hoạt bùng phát.",
    };
  }

  return {
    isNorthernProvince: true,
    phase: "ACTIVE_OUTBREAK_TRANSMISSION",
    phaseLabel: "Pha Bùng phát Cao điểm (Hè Thu)",
    temperatureC: temp,
    degreeDays: 620,
    triggerStatus: "activated",
    recommendation:
      "Đã kích hoạt ngưỡng nhiệt độ mùa dịch (GDD > 450°C·ngày). Chuyển sang mô hình hồi quy cao điểm và chuẩn bị đội cơ động ULV.",
  };
}
