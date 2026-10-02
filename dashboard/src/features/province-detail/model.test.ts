import { describe, expect, it } from "vitest";

import type { Observation } from "@/shared/api";

import { contributionToPercent, fillMonths } from "./model";

const obs = (
  month: string,
  cases: number,
  data_source: Observation["data_source"] = "real"
): Observation => ({
  month,
  cases,
  incidence_per_100k: null,
  data_source,
});

describe("fillMonths", () => {
  it("điền tháng thiếu bằng null để biểu đồ ngắt nét thay vì nối liền", () => {
    const out = fillMonths([obs("2010-01", 5), obs("2010-04", 9)]);
    expect(out.map((p) => [p.month, p.value])).toEqual([
      ["2010-01", 5],
      ["2010-02", null],
      ["2010-03", null],
      ["2010-04", 9],
    ]);
    expect(out[1]?.source).toBeNull();
  });

  it("giữ nguồn dữ liệu từng tháng (T2)", () => {
    const out = fillMonths([
      obs("2010-11", 1),
      obs("2010-12", 2, "estimated"),
      obs("2011-01", 3, "estimated"),
    ]);
    expect(out.map((p) => p.source)).toEqual(["real", "estimated", "estimated"]);
  });

  it("qua giao năm; rỗng → rỗng", () => {
    expect(fillMonths([obs("2009-12", 1), obs("2010-01", 2)])).toHaveLength(2);
    expect(fillMonths([])).toEqual([]);
  });
});

describe("contributionToPercent (SHAP trên thang log → % thay đổi)", () => {
  it("0 → không đổi; ln2 → +100%; -ln2 → -50%", () => {
    expect(contributionToPercent(0)).toBe(0);
    expect(contributionToPercent(Math.LN2)).toBeCloseTo(1, 12);
    expect(contributionToPercent(-Math.LN2)).toBeCloseTo(-0.5, 12);
  });
});
