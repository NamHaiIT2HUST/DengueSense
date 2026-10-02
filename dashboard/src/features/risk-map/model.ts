/**
 * Logic thuần của màn hình bản đồ rủi ro: chọn chỉ số tô màu, phân lớp, sắp xếp bảng. Tách khỏi component để kiểm thử
 * được mà không cần dựng bản đồ.
 */
import type { LegendClass, Region, RiskMap, RiskMapItem } from "@/shared/api";
import { classIndex } from "@/shared/lib/riskClass";

export type Metric = "exceed_prob" | "incidence";
export type SortKey = "rank" | "province" | "exceed" | "incidence" | "cases";
export type SortDir = "asc" | "desc";

export interface Row {
  item: RiskMapItem;
  /** Giá trị của chỉ số đang tô màu (null nếu tỉnh không có dự báo). */
  value: number | null;
  /** Chỉ số lớp màu (null → xám, "không có dự báo"). */
  cls: number | null;
}

export function legendFor(map: RiskMap, metric: Metric): readonly LegendClass[] {
  return metric === "exceed_prob" ? map.legend.exceed_prob : map.legend.cases_per_100k;
}

export function metricValue(item: RiskMapItem, metric: Metric): number | null {
  const f = item.forecast;
  if (!f) return null;
  return metric === "exceed_prob" ? f.exceed_prob : f.incidence_pred_per_100k;
}

export function buildRows(map: RiskMap, metric: Metric, region: Region | undefined): Row[] {
  const legend = legendFor(map, metric);
  return map.items
    .filter((it) => !region || it.region === region)
    .map((item) => {
      const value = metricValue(item, metric);
      return { item, value, cls: classIndex(value, legend) };
    });
}

const SORTERS: Record<Exclude<SortKey, "rank">, (r: Row) => number | string | null> = {
  province: (r) => r.item.name,
  exceed: (r) => r.item.forecast?.exceed_prob ?? null,
  incidence: (r) => r.item.forecast?.incidence_pred_per_100k ?? null,
  cases: (r) => r.item.forecast?.cases_pred ?? null,
};

/**
 * Sắp xếp bảng. Dòng KHÔNG có dự báo luôn ở cuối (dù sắp xếp tăng hay giảm) — không để "không có số" bị hiểu là 0.
 * `rank` = thứ tự theo chỉ số đang tô màu, giảm dần.
 */
export function sortRows(rows: readonly Row[], key: SortKey, dir: SortDir): Row[] {
  const get = key === "rank" ? (r: Row): number | string | null => r.value : SORTERS[key];
  const effectiveDir: SortDir = key === "rank" ? "desc" : dir;
  const sign = effectiveDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    if (va === null && vb === null) return a.item.name.localeCompare(b.item.name, "vi");
    if (va === null) return 1;
    if (vb === null) return -1;
    const cmp =
      typeof va === "string" && typeof vb === "string"
        ? va.localeCompare(vb, "vi")
        : Number(va) - Number(vb);
    return cmp === 0 ? a.item.name.localeCompare(b.item.name, "vi") : sign * cmp;
  });
}
