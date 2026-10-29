import { describe, expect, it } from "vitest";
import {
  calculateVectorIndices,
  DEFAULT_PROVINCE_SURVEY_BASELINES,
  getProvinceVectorSurvey,
} from "./vectorSurveillance";

describe("vectorSurveillance (QĐ 3711/QĐ-BYT)", () => {
  it("calculates BI, HI, CI, DI correctly for normal survey", () => {
    const survey = {
      housesInspected: 100,
      housesPositiveLarvae: 15,
      containersInspected: 200,
      containersPositiveLarvae: 30,
      totalLarvaeContainers: 25,
      femaleAedesCount: 40,
    };

    const res = calculateVectorIndices(survey);
    expect(res.breteauIndex).toBe(25);
    expect(res.houseIndex).toBe(15.0);
    expect(res.containerIndex).toBe(15.0);
    expect(res.densityIndex).toBe(0.4);
    expect(res.riskLevel).toBe("moderate");
    expect(res.thresholds.biAlarmThreshold).toBe(30);
  });

  it("triggers alarm risk level when BI >= 30 per QĐ 3711", () => {
    const survey = {
      housesInspected: 50,
      housesPositiveLarvae: 12,
      containersInspected: 100,
      containersPositiveLarvae: 20,
      totalLarvaeContainers: 18, // BI = (18 / 50) * 100 = 36
      femaleAedesCount: 26, // DI = 0.52
    };

    const res = calculateVectorIndices(survey);
    expect(res.breteauIndex).toBe(36);
    expect(res.densityIndex).toBe(0.52);
    expect(res.riskLevel).toBe("alarm");
    expect(res.levelLabel).toContain("Báo động đỏ");
  });

  it("triggers outbreak_imminent when BI >= 50 or DI >= 1.0", () => {
    const survey = {
      housesInspected: 100,
      housesPositiveLarvae: 35,
      containersInspected: 200,
      containersPositiveLarvae: 60,
      totalLarvaeContainers: 55, // BI = 55
      femaleAedesCount: 110, // DI = 1.10
    };

    const res = calculateVectorIndices(survey);
    expect(res.breteauIndex).toBe(55);
    expect(res.riskLevel).toBe("outbreak_imminent");
    expect(res.recommendedAction).toContain("phun hóa chất ULV");
  });

  it("retrieves province survey baseline or safe default", () => {
    const hcm = getProvinceVectorSurvey("hcm");
    expect(hcm.housesInspected).toBe(DEFAULT_PROVINCE_SURVEY_BASELINES.hcm!.housesInspected);

    const unknown = getProvinceVectorSurvey("unknown_province");
    expect(unknown.housesInspected).toBe(100);
    expect(unknown.totalLarvaeContainers).toBe(28);
  });
});
