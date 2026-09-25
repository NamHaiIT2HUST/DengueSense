/**
 * Nguồn dữ liệu của máy chủ giả. Dữ liệu demo là KẾT QUẢ THẬT của tái hiện lịch sử exp_016 (mùa 2010, 8 tháng neo)
 * do `ai-service/app/serving/forecast_api/replay.py` sinh ra (`public/demo/*.json`) — không bịa số nào.
 *
 * Trong trình duyệt: tải từng file khi cần (chỉ file của lượt đang xem, ~165 KB), không nằm trong bundle JS.
 * Trong test (Node): xem `nodeDemoData.ts`.
 */
import type {
  DataVersion,
  ExplanationFactor,
  ForecastItem,
  ForecastRun,
  GeoJsonFeatureCollection,
  LegendClass,
  Province,
} from "@/shared/api";
import { fetchStaticJson } from "@/shared/api";

export interface DemoRunFile {
  run: ForecastRun;
  as_of: string;
  legend_exceed_prob: LegendClass[];
  legend_cases_per_100k: LegendClass[];
  items: ForecastItem[];
  /** Khoá `${province_id}|${horizon}`. */
  explanations: Record<string, { base_value: number; factors: ExplanationFactor[] }>;
}

export interface DemoIndex {
  provinces: Province[];
  runs: ForecastRun[];
  data_versions: DataVersion[];
}

/** Chuỗi quan sát dạng cột: tháng bắt đầu + mảng song song theo tháng liên tiếp. */
export type DemoObservations = Record<
  string,
  {
    start: string;
    cases: (number | null)[];
    incidence_per_100k: (number | null)[];
    data_source: (string | null)[];
  }
>;

export interface DemoData {
  index(): Promise<DemoIndex>;
  /** null nếu không có lượt của tháng neo này. */
  run(originMonth: string): Promise<DemoRunFile | null>;
  observations(): Promise<DemoObservations>;
  geometry(): Promise<GeoJsonFeatureCollection>;
}

/** Nguồn qua HTTP (trình duyệt): mỗi file tải một lần rồi nhớ lại. */
export function httpDemoData(baseUrl = "/demo", geometryUrl = "/data/provinces.geojson"): DemoData {
  const cache = new Map<string, Promise<unknown>>();
  const once = <T>(url: string): Promise<T> => {
    let p = cache.get(url);
    if (!p) {
      p = fetchStaticJson<T>(url);
      // Lỗi tải không được nhớ: lần sau thử lại.
      p.catch(() => cache.delete(url));
      cache.set(url, p);
    }
    return p as Promise<T>;
  };
  return {
    index: () => once<DemoIndex>(`${baseUrl}/index.json`),
    run: async (origin) => {
      const index = await once<DemoIndex>(`${baseUrl}/index.json`);
      return index.runs.some((r) => r.origin_month === origin)
        ? once<DemoRunFile>(`${baseUrl}/run-${origin}.json`)
        : null;
    },
    observations: () => once<DemoObservations>(`${baseUrl}/observations.json`),
    geometry: () => once<GeoJsonFeatureCollection>(geometryUrl),
  };
}
