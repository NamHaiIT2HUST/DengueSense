import { describe, expect, it } from "vitest";

import type { LegendClass } from "@/shared/api";

import { classColorVar, classIndex } from "./riskClass";

const LEGEND: LegendClass[] = [
  { min: 0, max: 0.2, label: "Dưới 20%" },
  { min: 0.2, max: 0.4, label: "20–40%" },
  { min: 0.4, max: 0.6, label: "40–60%" },
  { min: 0.6, max: 0.8, label: "60–80%" },
  { min: 0.8, max: 1, label: "Từ 80%" },
];

describe("classIndex", () => {
  it("chọn lớp theo cận dưới, cận thuộc lớp trên", () => {
    expect(classIndex(0, LEGEND)).toBe(0);
    expect(classIndex(0.199, LEGEND)).toBe(0);
    expect(classIndex(0.2, LEGEND)).toBe(1);
    expect(classIndex(0.79, LEGEND)).toBe(3);
    expect(classIndex(0.8, LEGEND)).toBe(4);
    expect(classIndex(1, LEGEND)).toBe(4);
  });

  it("giá trị vượt cận trên lớp cuối vẫn vào lớp cuối; âm vào lớp đầu", () => {
    expect(classIndex(500, LEGEND)).toBe(4);
    expect(classIndex(-1, LEGEND)).toBe(0);
  });

  it("thiếu giá trị / không hữu hạn / không có legend → null (tô xám, không đoán)", () => {
    expect(classIndex(null, LEGEND)).toBeNull();
    expect(classIndex(undefined, LEGEND)).toBeNull();
    expect(classIndex(Number.NaN, LEGEND)).toBeNull();
    expect(classIndex(0.5, [])).toBeNull();
  });
});

describe("classColorVar", () => {
  it("ánh xạ chỉ số → biến CSS, null → màu 'không có dự báo'", () => {
    expect(classColorVar(0)).toBe("--risk-class-1");
    expect(classColorVar(4)).toBe("--risk-class-5");
    expect(classColorVar(9)).toBe("--risk-class-5");
    expect(classColorVar(null)).toBe("--risk-class-none");
  });
});
