/**
 * Tên kiểu dễ dùng, lấy từ hợp đồng (schema.gen.ts do `npm run api:gen` sinh từ contracts/openapi/public-v1.yaml).
 *
 * Chỉ `shared/api` và `entities/*` được import `schema.gen.ts` (dependency-cruiser chặn nơi khác) — mọi nơi còn
 * lại lấy kiểu từ đây, nên khi hợp đồng đổi tên/kiểu, chỗ sửa duy nhất là file này.
 */
import type { components } from "./schema.gen";

type Schemas = components["schemas"];

export type DataSource = Schemas["DataSource"];
export type Region = Schemas["Region"];
export type Horizon = Schemas["Horizon"];
export type YearMonth = Schemas["YearMonth"];
export type RunMode = Schemas["RunMode"];
export type RunStatus = Schemas["RunStatus"];
export type Role = Schemas["Role"];
export type ForecastFlag = Schemas["ForecastFlag"];

export type Meta = Schemas["Meta"];
export type ForecastItem = Schemas["ForecastItem"];
export type ForecastRun = Schemas["ForecastRun"];
export type Reliability = Schemas["Reliability"];
export type RiskMap = Schemas["RiskMap"];
export type RiskMapItem = Schemas["RiskMapItem"];
export type Province = Schemas["Province"];
export type Observation = Schemas["Observation"];
export type Explanation = Schemas["Explanation"];
export type ModelCard = Schemas["ModelCard"];
export type ModelVersion = Schemas["ModelVersion"];
export type Limitation = Schemas["Limitation"];
export type User = Schemas["User"];
export type Job = Schemas["Job"];
