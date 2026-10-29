import { describe, expect, it } from "vitest";
import {
  calculateExtrinsicIncubationRate,
  DEFAULT_SEIRV_PARAMS,
  PRESET_SCENARIOS,
  simulateSeirv,
} from "./seirvModel";

describe("SEIR-V Epidemiological Model", () => {
  it("calculates extrinsic incubation rate correctly as a function of temperature", () => {
    // Under 16°C, transmission is dormant
    const coldRate = calculateExtrinsicIncubationRate(15);
    expect(coldRate).toBeLessThanOrEqual(0.001);

    // At 28°C: EIP = 111 / (28 - 11.2) = 111 / 16.8 ≈ 6.6 days -> sigma_v ≈ 0.151
    const warmRate = calculateExtrinsicIncubationRate(28);
    expect(warmRate).toBeGreaterThan(0.14);
    expect(warmRate).toBeLessThan(0.16);

    // Warmer temperature accelerates viral replication in mosquito
    const hotRate = calculateExtrinsicIncubationRate(32);
    expect(hotRate).toBeGreaterThan(warmRate);
  });

  it("simulates baseline epidemic dynamics and yields plausible outbreak metrics", () => {
    const result = simulateSeirv(DEFAULT_SEIRV_PARAMS);

    expect(result.timeline.length).toBe(121); // Day 0 to 120
    expect(result.r0).toBeGreaterThan(1.0); // Baseline Dengue R0 > 1
    expect(result.peakCases).toBeGreaterThan(10);
    expect(result.totalCases).toBeGreaterThan(result.peakCases);
    expect(result.peakDay).toBeGreaterThan(0);
    expect(result.peakDay).toBeLessThanOrEqual(120);

    // Verify timeline monotonic cumulative cases
    for (let i = 1; i < result.timeline.length; i++) {
      expect(result.timeline[i]!.cumulativeCases).toBeGreaterThanOrEqual(
        result.timeline[i - 1]!.cumulativeCases
      );
    }
  });

  it("demonstrates that intensive vector management significantly suppresses peak cases and Rt", () => {
    const baseline = simulateSeirv(PRESET_SCENARIOS.baseline.params);
    const ivm = simulateSeirv(PRESET_SCENARIOS.integrated_ivm.params);

    // Integrated Vector Management must avert cases and drop R0
    expect(ivm.r0).toBeLessThan(baseline.r0);
    expect(ivm.peakCases).toBeLessThan(baseline.peakCases);
    expect(ivm.totalCases).toBeLessThan(baseline.totalCases);
    expect(ivm.attackRatePercent).toBeLessThan(baseline.attackRatePercent);
  });

  it("maintains human population conservation (Sh + Eh + Ih + Rh <= Nh)", () => {
    const pop = 50000;
    const result = simulateSeirv({ population: pop, simulationDays: 60 });

    for (const step of result.timeline) {
      const totalHumans = step.sh + step.eh + step.ih + step.rh;
      // Allow minor rounding tolerances (within 5 individuals out of 50,000)
      expect(Math.abs(totalHumans - pop)).toBeLessThanOrEqual(5);
    }
  });
});
