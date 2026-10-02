import { describe, expect, it } from "vitest";

import { riskColor, riskLabel } from "./riskScale";

describe("riskColor", () => {
  it("điểm thấp nhạt, điểm cao đậm; biên 0 và 100 hợp lệ", () => {
    expect(riskColor(0)).toBe("#fff5f0");
    expect(riskColor(100)).toBe("#99000d");
    expect(riskColor(50)).toBe("#fb6a4a");
  });
  it("ngoài [0,100] bị chặn, không trả undefined", () => {
    expect(riskColor(-20)).toBe("#fff5f0");
    expect(riskColor(250)).toBe("#99000d");
    expect(riskColor(Number.NaN)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("riskLabel", () => {
  it("5 mức theo ngưỡng", () => {
    expect(riskLabel(90)).toBe("Rất cao");
    expect(riskLabel(70)).toBe("Cao");
    expect(riskLabel(40)).toBe("Trung bình");
    expect(riskLabel(20)).toBe("Thấp");
    expect(riskLabel(5)).toBe("Rất thấp");
  });
});
