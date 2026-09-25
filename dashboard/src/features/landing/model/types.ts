import type { DataSource, Region } from "@/shared/api";

/** Hình dạng file tĩnh `public/data/risk_summary.json` của trang giới thiệu (KHÔNG thuộc hợp đồng API). */
export interface ProvinceRisk {
  province_id: string;
  name: string;
  region: Region;
  cases_last_12m: number;
  risk_score: number;
  data_source: DataSource;
}

export interface RiskSummary {
  meta: {
    window_start: string;
    window_end: string;
    generated_at: string;
    note: string;
  };
  provinces: ProvinceRisk[];
}
