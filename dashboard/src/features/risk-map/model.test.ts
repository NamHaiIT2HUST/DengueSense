import { describe, expect, it } from "vitest";

import type { ForecastItem, RiskMap, RiskMapItem } from "@/shared/api";

import { buildRows, metricValue, sortRows } from "./model";

function fc(over: Partial<ForecastItem> & { province_id: string }): ForecastItem {
  return {
    region: "Nam",
    target_month: "2010-06",
    horizon: 3,
    cases_pred: 100,
    incidence_pred_per_100k: 5,
    cases_pred_interval: null,
    exceed_prob: 0.5,
    threshold_p75: 80,
    base_rate: 0.22,
    input_data_sources: { real: 1, estimated: 0, imputed: 0 },
    reliability: { region_level: "high", note_code: "trung_stable" },
    flags: [],
    ...over,
  };
}

const item = (
  id: string,
  name: string,
  region: RiskMapItem["region"],
  f: ForecastItem | null
): RiskMapItem => ({
  province_id: id,
  name,
  region,
  forecast: f,
  open_alert_count: 0,
});

const MAP: RiskMap = {
  meta: {
    run_id: "r",
    run_mode: "backtest",
    model_version: "m",
    data_version: "d",
    origin_month: "2010-03",
    generated_at: "2026-01-01T00:00:00Z",
    limitations_ref: "/x",
  },
  horizon: 3,
  legend: {
    exceed_prob: [
      { min: 0, max: 0.2, label: "a" },
      { min: 0.2, max: 0.4, label: "b" },
      { min: 0.4, max: 0.6, label: "c" },
      { min: 0.6, max: 0.8, label: "d" },
      { min: 0.8, max: 1, label: "e" },
    ],
    cases_per_100k: [
      { min: 0, max: 1, label: "p" },
      { min: 1, max: 5, label: "q" },
      { min: 5, max: 10, label: "r" },
      { min: 10, max: 20, label: "s" },
      { min: 20, max: 500, label: "t" },
    ],
  },
  items: [
    item(
      "a",
      "An Giang",
      "Nam",
      fc({ province_id: "a", exceed_prob: 0.9, incidence_pred_per_100k: 3, cases_pred: 300 })
    ),
    item(
      "b",
      "Bắc Ninh",
      "Bắc",
      fc({
        province_id: "b",
        region: "Bắc",
        exceed_prob: 0.1,
        incidence_pred_per_100k: 25,
        cases_pred: 50,
      })
    ),
    item("c", "Cà Mau", "Nam", null),
    item(
      "d",
      "Đà Nẵng",
      "Trung",
      fc({
        province_id: "d",
        region: "Trung",
        exceed_prob: 0.5,
        incidence_pred_per_100k: 8,
        cases_pred: 700,
      })
    ),
  ],
  warnings: [],
};

describe("buildRows", () => {
  it("phân lớp theo legend của MÁY CHỦ theo chỉ số đang chọn", () => {
    const byProb = buildRows(MAP, "exceed_prob", undefined);
    expect(byProb.map((r) => r.cls)).toEqual([4, 0, null, 2]);
    const byInc = buildRows(MAP, "incidence", undefined);
    expect(byInc.map((r) => r.cls)).toEqual([1, 4, null, 2]);
  });

  it("lọc theo vùng", () => {
    expect(buildRows(MAP, "exceed_prob", "Nam").map((r) => r.item.name)).toEqual([
      "An Giang",
      "Cà Mau",
    ]);
    expect(buildRows(MAP, "exceed_prob", "Bắc")).toHaveLength(1);
  });

  it("tỉnh không có dự báo: giá trị null, lớp null (xám) — không bị coi là 0", () => {
    const [none] = buildRows(MAP, "exceed_prob", undefined).filter(
      (r) => r.item.province_id === "c"
    );
    expect(none?.value).toBeNull();
    expect(none?.cls).toBeNull();
    expect(metricValue(MAP.items[2] as RiskMapItem, "incidence")).toBeNull();
  });
});

describe("sortRows", () => {
  const rows = buildRows(MAP, "exceed_prob", undefined);
  const names = (r: ReturnType<typeof sortRows>) => r.map((x) => x.item.name);

  it("hạng: chỉ số đang tô màu giảm dần, tỉnh không dự báo ở cuối", () => {
    expect(names(sortRows(rows, "rank", "asc"))).toEqual([
      "An Giang",
      "Đà Nẵng",
      "Bắc Ninh",
      "Cà Mau",
    ]);
  });

  it("tỉnh không có dự báo luôn ở cuối, dù sắp tăng hay giảm", () => {
    expect(names(sortRows(rows, "exceed", "asc")).at(-1)).toBe("Cà Mau");
    expect(names(sortRows(rows, "exceed", "desc")).at(-1)).toBe("Cà Mau");
    expect(names(sortRows(rows, "cases", "asc")).at(-1)).toBe("Cà Mau");
  });

  it("theo tên dùng thứ tự tiếng Việt", () => {
    expect(names(sortRows(rows, "province", "asc"))).toEqual([
      "An Giang",
      "Bắc Ninh",
      "Cà Mau",
      "Đà Nẵng",
    ]);
  });

  it("theo số ca / tỉ suất, cả hai chiều", () => {
    expect(names(sortRows(rows, "cases", "desc")).slice(0, 3)).toEqual([
      "Đà Nẵng",
      "An Giang",
      "Bắc Ninh",
    ]);
    expect(names(sortRows(rows, "incidence", "asc")).slice(0, 3)).toEqual([
      "An Giang",
      "Đà Nẵng",
      "Bắc Ninh",
    ]);
  });

  it("không đổi mảng đầu vào", () => {
    const before = names(rows);
    sortRows(rows, "cases", "desc");
    expect(names(rows)).toEqual(before);
  });
});
