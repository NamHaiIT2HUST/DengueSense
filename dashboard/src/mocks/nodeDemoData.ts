/**
 * Nguồn dữ liệu demo cho TEST (Node/Vitest): đọc thẳng `public/demo/*.json` qua `import.meta.glob` của Vite (file nằm
 * trong thư mục dự án nên được phép). Test chạy trên SỐ THẬT của exp_016, không phải fixture rút gọn — nên các bất biến
 * trung thực (T1–T10) được kiểm trên đúng dữ liệu người dùng sẽ thấy.
 *
 * Ranh giới tỉnh: dùng `public/data/provinces.geojson` (đủ 34 tỉnh) qua glob.
 */
import type { GeoJsonFeatureCollection } from "@/shared/api";

import type { DemoData, DemoIndex, DemoObservations, DemoRunFile } from "./demoData";

const files = import.meta.glob<unknown>("/public/demo/*.json", { eager: true, import: "default" });
// `.geojson` không phải module JSON của Vite → đọc dạng chuỗi rồi tự parse.
const geo = import.meta.glob<string>("/public/data/provinces.geojson", {
  eager: true,
  query: "?raw",
  import: "default",
});

function file<T>(name: string): T {
  const v = files[`/public/demo/${name}`];
  if (v === undefined)
    throw new Error(`Thiếu file demo ${name} — chạy python -m app.serving.forecast_api.replay`);
  return v as T;
}

export const nodeDemoData: DemoData = {
  index: async () => file<DemoIndex>("index.json"),
  run: async (origin) => {
    const idx = file<DemoIndex>("index.json");
    return idx.runs.some((r) => r.origin_month === origin)
      ? file<DemoRunFile>(`run-${origin}.json`)
      : null;
  },
  observations: async () => file<DemoObservations>("observations.json"),
  geometry: async () => JSON.parse(Object.values(geo)[0] as string) as GeoJsonFeatureCollection,
};
