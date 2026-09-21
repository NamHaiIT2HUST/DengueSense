export type DataSource = "real" | "estimated" | "imputed" | "simulated";

export interface ProvinceRisk {
  province_id: string;
  name: string;
  region: "Bắc" | "Trung" | "Nam";
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
