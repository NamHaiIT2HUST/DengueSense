import { describe, expect, it } from "vitest";
import {
  evaluateSupplyTransfer,
  getEstimatedRoadDistanceKm,
  PROVINCE_INVENTORY_REGISTRY,
} from "./interProvincialTransfer";

describe("interProvincialTransfer module", () => {
  it("calculates road distance accurately between neighbor provinces", () => {
    expect(getEstimatedRoadDistanceKm("angiang", "can_tho")).toBe(65);
    expect(getEstimatedRoadDistanceKm("can_tho", "angiang")).toBe(65);
    expect(getEstimatedRoadDistanceKm("angiang", "angiang")).toBe(0);
    expect(getEstimatedRoadDistanceKm("hcm", "binh_duong")).toBe(32);
  });

  it("approves viable transfer from safe donor with healthy reserve margin", () => {
    const request = {
      targetProvinceId: "angiang",
      targetProvinceName: "An Giang",
      donorProvinceId: "can_tho",
      donorProvinceName: "Cần Thơ",
      ulvChemicalLiters: 200, // Can Tho has 950
      abateLarvicideKg: 400, // Can Tho has 2100
      dextran40Bags: 80, // Can Tho has 450
      sprayerMachines: 5, // Can Tho has 32
    };

    const res = evaluateSupplyTransfer(request);
    expect(res.isViable).toBe(true);
    expect(res.warnings).toHaveLength(0);
    expect(res.donorStockRemaining.ulvLiters).toBe(750);
    expect(res.transitDistanceKm).toBe(65);
    expect(res.estimatedTransitHours).toBe(1.8);
    expect(res.transferManifestId).toContain("CV-MILP");
    expect(res.donorReserveRatio).toBeGreaterThan(50);
  });

  it("rejects transfer when donor stock would fall below 35% safety threshold", () => {
    const request = {
      targetProvinceId: "angiang",
      targetProvinceName: "An Giang",
      donorProvinceId: "dong_thap",
      donorProvinceName: "Đồng Tháp",
      ulvChemicalLiters: 550, // Dong Thap has 680 -> remaining 130 (19.1% < 35%)
      abateLarvicideKg: 200,
      dextran40Bags: 30,
      sprayerMachines: 2,
    };

    const res = evaluateSupplyTransfer(request);
    expect(res.isViable).toBe(false);
    expect(res.warnings[0]).toContain("dưới ngưỡng an toàn tối thiểu 35%");
  });

  it("warns when donor province is currently under critical/alarm risk", () => {
    const request = {
      targetProvinceId: "dong_thap",
      targetProvinceName: "Đồng Tháp",
      donorProvinceId: "angiang", // An Giang is critical
      donorProvinceName: "An Giang",
      ulvChemicalLiters: 20,
      abateLarvicideKg: 50,
      dextran40Bags: 10,
      sprayerMachines: 1,
    };

    const res = evaluateSupplyTransfer(request);
    expect(res.isViable).toBe(false);
    expect(res.warnings.some((w) => w.includes("nguy cơ dịch CRITICAL"))).toBe(true);
  });

  it("has predefined inventories for key strategic provinces", () => {
    expect(PROVINCE_INVENTORY_REGISTRY.can_tho).toBeDefined();
    expect(PROVINCE_INVENTORY_REGISTRY.angiang).toBeDefined();
    expect(PROVINCE_INVENTORY_REGISTRY.hcm).toBeDefined();
  });
});
