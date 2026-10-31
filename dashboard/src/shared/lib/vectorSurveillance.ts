/**
 * DengueSense Entomological Vector Surveillance Module
 * Conforms to Decision 3711/QĐ-BYT of the Ministry of Health (Vietnam):
 * "Hướng dẫn giám sát và phòng, chống bệnh sốt xuất huyết Dengue"
 */

export interface EntomologicalSurveyData {
  housesInspected: number;
  housesPositiveLarvae: number; // HI
  containersInspected: number;
  containersPositiveLarvae: number; // CI
  totalLarvaeContainers: number; // For Breteau Index calculation
  femaleAedesCount: number; // For Density Index
}

export type VectorRiskLevel = "safe" | "moderate" | "alarm" | "outbreak_imminent";

export interface VectorSurveillanceAssessment {
  breteauIndex: number; // BI: số dụng cụ chứa lăng quăng / 100 nhà
  houseIndex: number; // HI: % nhà có lăng quăng
  containerIndex: number; // CI: % dụng cụ có lăng quăng
  densityIndex: number; // DI: muỗi cái Aedes / nhà
  riskLevel: VectorRiskLevel;
  levelLabel: string;
  recommendedAction: string;
  thresholds: {
    biAlarmThreshold: number; // 30 theo QĐ 3711/QĐ-BYT
    diAlarmThreshold: number; // 0.5 con/nhà
  };
}

/**
 * Calculates vector indices according to QĐ 3711/QĐ-BYT:
 * - Breteau Index (BI) = (Total positive containers / Houses inspected) * 100
 * - House Index (HI) = (Positive houses / Houses inspected) * 100 (%)
 * - Container Index (CI) = (Positive containers / Containers inspected) * 100 (%)
 * - Density Index (DI) = Female Aedes mosquitoes / Houses inspected (con/nhà)
 */
export function calculateVectorIndices(
  survey: EntomologicalSurveyData
): VectorSurveillanceAssessment {
  const houses = Math.max(1, survey.housesInspected);
  const containers = Math.max(1, survey.containersInspected);

  const bi = Math.round((survey.totalLarvaeContainers / houses) * 100);
  const hi = Number(((survey.housesPositiveLarvae / houses) * 100).toFixed(1));
  const ci = Number(((survey.containersPositiveLarvae / containers) * 100).toFixed(1));
  const di = Number((survey.femaleAedesCount / houses).toFixed(2));

  let riskLevel: VectorRiskLevel = "safe";
  let levelLabel = "An toàn sinh học (Dưới ngưỡng)";
  let recommendedAction = "Duy trì tuyên truyền diệt lăng quăng hàng tuần tại hộ gia đình.";

  if (bi >= 50 || di >= 1.0) {
    riskLevel = "outbreak_imminent";
    levelLabel = "Cực kỳ nguy cấp (Bùng dịch diện rộng)";
    recommendedAction =
      "Kích hoạt phun hóa chất ULV dập dịch khẩn cấp 2 vòng cách nhau 7 ngày; tổng vệ sinh môi trường, diệt bọ gậy toàn xã/phường.";
  } else if (bi >= 30 || di >= 0.5) {
    riskLevel = "alarm";
    levelLabel = "Báo động đỏ (Ngưỡng bùng dịch QĐ 3711)";
    recommendedAction =
      "Chiến dịch diệt lăng quăng/bọ gậy khẩn cấp; chuẩn bị phun sương ULV diện rộng nếu xuất hiện ca bệnh chỉ điểm.";
  } else if (bi >= 20 || di >= 0.3) {
    riskLevel = "moderate";
    levelLabel = "Nguy cơ tiềm ẩn (Tiệm cận ngưỡng)";
    recommendedAction =
      "Tăng cường giám sát côn trùng định kỳ 2 tuần/lần; thả cá bảy màu, phát tờ rơi tại các tổ dân phố trọng điểm.";
  }

  return {
    breteauIndex: bi,
    houseIndex: hi,
    containerIndex: ci,
    densityIndex: di,
    riskLevel,
    levelLabel,
    recommendedAction,
    thresholds: {
      biAlarmThreshold: 30,
      diAlarmThreshold: 0.5,
    },
  };
}

/**
 * Standard province baseline vector data estimated from historical CDC entomological surveillance
 */
export const DEFAULT_PROVINCE_SURVEY_BASELINES: Record<string, EntomologicalSurveyData> = {
  hanoi: {
    housesInspected: 100,
    housesPositiveLarvae: 18,
    containersInspected: 240,
    containersPositiveLarvae: 32,
    totalLarvaeContainers: 35, // BI = 35 (Alarm)
    femaleAedesCount: 52, // DI = 0.52 (Alarm)
  },
  hcm: {
    housesInspected: 100,
    housesPositiveLarvae: 26,
    containersInspected: 310,
    containersPositiveLarvae: 58,
    totalLarvaeContainers: 62, // BI = 62 (Outbreak imminent)
    femaleAedesCount: 110, // DI = 1.10
  },
  angiang: {
    housesInspected: 100,
    housesPositiveLarvae: 22,
    containersInspected: 280,
    containersPositiveLarvae: 42,
    totalLarvaeContainers: 45, // BI = 45 (Alarm)
    femaleAedesCount: 65, // DI = 0.65
  },
  danang: {
    housesInspected: 100,
    housesPositiveLarvae: 12,
    containersInspected: 210,
    containersPositiveLarvae: 20,
    totalLarvaeContainers: 22, // BI = 22 (Moderate)
    femaleAedesCount: 28, // DI = 0.28
  },
  khanh_hoa: {
    housesInspected: 100,
    housesPositiveLarvae: 19,
    containersInspected: 260,
    containersPositiveLarvae: 34,
    totalLarvaeContainers: 38, // BI = 38 (Alarm)
    femaleAedesCount: 58, // DI = 0.58
  },
};

export function getProvinceVectorSurvey(provinceId: string): EntomologicalSurveyData {
  return (
    DEFAULT_PROVINCE_SURVEY_BASELINES[provinceId.toLowerCase()] ?? {
      housesInspected: 100,
      housesPositiveLarvae: 15,
      containersInspected: 220,
      containersPositiveLarvae: 25,
      totalLarvaeContainers: 28, // BI = 28
      femaleAedesCount: 35, // DI = 0.35
    }
  );
}
