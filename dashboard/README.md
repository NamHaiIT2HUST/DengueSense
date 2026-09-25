# dashboard — DengueSense

SPA **React + TypeScript + Vite** của DengueSense. Kiến trúc, luật và quy trình: [docs/10](../docs/10-kien-truc-frontend.md) — **đọc trước khi viết PR đầu tiên**.

## Trạng thái thật

| Phần | Trạng thái | Ghi chú |
|---|---|---|
| Trang giới thiệu `/` | ✅ Chạy, dữ liệu thật | Bản đồ rủi ro 34 tỉnh + Top 10 từ `public/data/*.json` (tính từ panel ca bệnh — **chưa phải dự báo mô hình**); 72,7% dữ liệu đo thật, phần còn lại gắn nhãn "Ước lượng" |
| Layer 2 / Layer 3 trên trang giới thiệu | 🔶 Minh hoạ khái niệm | Phân bổ greedy phía client và văn bản mẫu tĩnh — có tag "Minh hoạ khái niệm" ngay trên UI; **không** phải MILP/LLM thật |
| Nền móng (Đợt 0) | ✅ Xong | Router, client API sinh từ hợp đồng, lỗi problem+json, định dạng số/ngày, i18n, kiểm cấu hình, test, CI |
| **Console: đăng nhập + khung + "Mô hình & giới hạn"** (`/dang-nhap`, `/app`, `/app/mo-hinh`) | ✅ Lát cắt 1, **chạy trên máy chủ giả** | Route guard, phiên khôi phục bằng cookie refresh, đăng xuất, `safeRedirect`; 94 test đơn vị + 13 E2E (gồm axe). Bản build mặc định là chế độ **demo** (MSW trong trình duyệt) |
| Console: bản đồ dự báo M4-R2, chi tiết tỉnh, lượt dự báo | ⏳ Đợt 1 (tiếp) | Cần `surveillance`, `forecast` thật và gateway nối upstream |

Trang giới thiệu **không gọi backend** (có test E2E kiểm điều này).

### Chế độ chạy (`VITE_APP_MODE`)

| Chế độ | Ai trả lời API | Dùng cho |
|---|---|---|
| `demo` (mặc định) | máy chủ giả MSW chạy trong trình duyệt, tải động (chunk `browser-*.js`, ngân sách riêng ≤ 200 KB gzip, **không** nằm trong đường khởi động chế độ `console`) | bản Vercel công khai; E2E. Tài khoản demo hiện ngay trên trang đăng nhập (chỉ tồn tại trong mock, không phải tài khoản thật) |
| `console` | backend thật qua `VITE_API_BASE_URL` (cùng origin qua reverse proxy) | dev với `docker compose`, pilot |

Đổi chế độ khi build: `VITE_APP_MODE=console npm run build`.

## Chạy local

```bash
npm install
npm run dev            # http://localhost:5173
```

| Lệnh | Việc |
|---|---|
| `npm run check` | lint + format + typecheck + kiểm kiến trúc + unit test (chạy trước khi xin review) |
| `npm run build` | `tsc -b` (nghiêm ngặt) rồi `vite build`; **cũng sinh lại `src/app/routeTree.gen.ts`** — commit nếu đổi |
| `npm run test` / `test:watch` / `test:coverage` | Vitest (jsdom + MSW) |
| `npm run test:e2e` | Playwright + axe trên bản build (`npm run build` trước; lần đầu: `npx playwright install chromium`) |
| `npm run lint` · `format` · `format:check` | oxlint · Prettier |
| `npm run depcruise` | luật kiến trúc (dependency-cruiser) |
| `npm run size:check` | ngân sách bundle (sau `build`) |
| `npm run api:gen` | sinh `src/shared/api/schema.gen.ts` từ `../contracts/openapi/public-v1.yaml` — chạy lại mỗi khi hợp đồng đổi |

## Cấu trúc (`src/`)

```
app/        khởi động, providers, router, routes/ (định tuyến theo file) — tầng ghép
features/   một thư mục / tính năng màn hình (hiện: landing, auth, model-info); chỉ export qua index.ts
entities/   khái niệm miền: hook API + định dạng (hiện: user, model)
shared/     api/ (client, phiên, lỗi, khoá query, kiểu), ui/, lib/ (format), i18n/, config/ — không biết nghiệp vụ
mocks/      handler MSW khớp hợp đồng: dùng cho test VÀ chế độ demo (kho phiên trong bộ nhớ, "cookie refresh" giả)
test/       thiết lập Vitest + renderApp (dựng cả router thật trên lịch sử bộ nhớ)
```

Chiều phụ thuộc **chỉ đi xuống**: `app → features → entities → shared`. `features/A` không import `features/B`. Bên ngoài chỉ import qua `index.ts` của feature/entity.
`schema.gen.ts` chỉ được import trong `shared/api` — nơi khác lấy kiểu từ `@/shared/api`. Các luật này **do CI chặn** (`npm run depcruise`).

## Luật ngắn gọn

1. **Chỉ `shared/api` được gọi `fetch`** (oxlint chặn). Trang giới thiệu tải JSON tĩnh qua `fetchStaticJson`.
2. **Kiểu API không viết tay** — sinh từ hợp đồng. Đổi API = PR hợp đồng riêng trước ([contracts/README.md](../contracts/README.md)).
3. **Thao tác ghi bắt buộc `Idempotency-Key`** (`newIdempotencyKey()`); client ném lỗi nếu thiếu.
4. **Số liệu mô hình phải trung thực** (luật T1–T10, docs/10 §9): xác suất luôn kèm mức nền, dữ liệu ước lượng có nhãn, có provenance, không vẽ khoảng tin cậy khi API không trả.
5. **Access token chỉ ở bộ nhớ**; không `localStorage`, không `dangerouslySetInnerHTML`.
6. **Tiếp cận là yêu cầu, không phải tính năng thêm:** axe không được có vi phạm critical/serious (`e2e/a11y.spec.ts`); tôn trọng `prefers-reduced-motion`.
7. Biến `VITE_*` là **công khai** (nằm trong bundle) — không bao giờ đặt bí mật. Sai cấu hình → app không khởi động (`shared/config/env.ts`). Mặc định `VITE_APP_MODE=demo` để deploy quên đặt biến không cố gọi backend.

## Cập nhật dữ liệu trang giới thiệu

`public/data/risk_summary.json` và `provinces.geojson` sinh từ pipeline Python ở `ai-service/`:

```bash
cd ../ai-service
python -m app.data.build_panel            # ghép lại panel_monthly.parquet
python -m app.data.export_dashboard_data  # xuất dashboard/public/data/risk_summary.json
```

`provinces.geojson` lấy từ [Free-GIS-Data](https://github.com/nguyenduy1133/Free-GIS-Data) (ranh giới 34 tỉnh sau sáp nhập 07/2025), đã sửa 1 lỗi gắn nhãn nhầm (2 polygon cùng tên "Lạng Sơn", 1 trong số đó thực ra là Đồng Tháp — xác minh qua toạ độ centroid) và đơn giản hoá bằng `mapshaper` (15MB → 599KB).

## Deploy Vercel (bản công khai, dữ liệu tĩnh)

Root Directory = `dashboard`, framework Vite (Build `npm run build`, Output `dist`). Không cần biến môi trường (mặc định chế độ `demo`). `vercel.json` rewrite mọi đường dẫn về `index.html` (SPA) trừ `assets/`, `data/`, `mockServiceWorker.js`, `favicon.svg` — nếu thêm thư mục tĩnh mới, thêm vào danh sách loại trừ. Chi tiết ở README gốc, mục "Deploy prototype".

Bản Vercel **không bao giờ** trỏ vào backend pilot (docs/10 §19.3).
