/**
 * Handler MSW mặc định: trả dữ liệu KHỚP hợp đồng (kiểu lấy từ schema sinh — sai hình dạng là lỗi biên dịch).
 * Dùng cho test và (Đợt 1) chế độ demo trên Vercel. Backend chưa có vẫn làm frontend song song được (docs/10 §7.4).
 *
 * URL tuyệt đối vì Node/jsdom không hiểu URL tương đối; trình duyệt thật dùng `/api/v1` cùng origin.
 */
import { HttpResponse, http } from "msw";

import type { Province, User } from "@/shared/api";

export const API_BASE = "http://localhost/api/v1";

export const provincesFixture: Province[] = [
  { province_id: "01", name: "Hà Nội", region: "Bắc", population: 8_500_000 },
  { province_id: "79", name: "TP. Hồ Chí Minh", region: "Nam", population: 9_300_000 },
];

export const userFixture: User = {
  id: "0192f3a1-0000-7000-8000-000000000001",
  username: "viewer",
  display_name: "Người xem thử",
  roles: ["viewer"],
  org_id: "cdc-demo",
};

export const handlers = [
  http.get(`${API_BASE}/provinces`, () => HttpResponse.json({ items: provincesFixture })),
  http.get(`${API_BASE}/me`, () => HttpResponse.json(userFixture)),
];
