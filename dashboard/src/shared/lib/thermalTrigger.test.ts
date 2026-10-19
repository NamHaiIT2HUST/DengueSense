import { describe, expect, it } from "vitest";
import { evaluateNorthernThermalPhase } from "./thermalTrigger";

describe("Northern Thermal Trigger Model", () => {
  it("classifies Hanoi in January as Winter Dormant phase", () => {
    const res = evaluateNorthernThermalPhase("ha_noi", 1);
    expect(res.isNorthernProvince).toBe(true);
    expect(res.phase).toBe("WINTER_DORMANT");
    expect(res.phaseLabel).toContain("Ngủ đông");
    expect(res.recommendation).toContain("ức chế muỗi Aedes");
  });

  it("classifies Hanoi in July as Active Outbreak Transmission phase", () => {
    const res = evaluateNorthernThermalPhase("ha_noi", 7);
    expect(res.isNorthernProvince).toBe(true);
    expect(res.phase).toBe("ACTIVE_OUTBREAK_TRANSMISSION");
    expect(res.triggerStatus).toBe("activated");
    expect(res.degreeDays).toBeGreaterThan(450);
  });

  it("classifies Ho Chi Minh City as year-round tropical transmission", () => {
    const res = evaluateNorthernThermalPhase("ho_chi_minh", 1);
    expect(res.isNorthernProvince).toBe(false);
    expect(res.triggerStatus).toBe("activated");
  });
});
