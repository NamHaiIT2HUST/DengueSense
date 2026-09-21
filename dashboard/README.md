# dashboard — DengueSense Prototype

Prototype trực quan cho vòng theo dõi tiến độ cuộc thi Sáng tạo Trẻ 2026. **Đây là bản xem trước (preview), không phải sản phẩm hoàn chỉnh** — xem rõ phần "Trạng thái thật" bên dưới.

## Chạy local

```bash
npm install
npm run dev
```

Build production (dùng để deploy):

```bash
npm run build
npm run preview   # xem thử bản build tại localhost:4173
```

## Trạng thái thật — cái gì thật, cái gì minh hoạ

| Phần | Trạng thái | Ghi chú |
|---|---|---|
| Bản đồ rủi ro 34 tỉnh | ✅ **Dữ liệu thật** | Tính từ `panel_monthly.parquet` (xem `ai-service/`) — 72,7% dữ liệu đo thật, phần còn lại gắn nhãn "Ước lượng" rõ ràng trên UI |
| Bảng xếp hạng Top 10 | ✅ **Dữ liệu thật** | Cùng nguồn với bản đồ |
| Layer 2 — Tối ưu nguồn lực | 🔶 **Minh hoạ khái niệm** | Slider + greedy allocation chạy client-side để demo ý tưởng; **không phải** MILP/OR-Tools thật (xem `docs/04-phuong-phap-toi-uu.md`) |
| Layer 3 — GenAI dispatch | 🔶 **Minh hoạ khái niệm** | Văn bản mẫu tĩnh, không gọi LLM thật |
| Backend / AI service kết nối trực tiếp | ❌ Chưa có | Dashboard hiện đọc thẳng file JSON tĩnh trong `public/data/`, chưa gọi API `backend`/`ai-service` |

Mọi chỗ minh hoạ đều có tag **"Minh hoạ khái niệm — chưa nối dữ liệu thật"** hiển thị ngay trên UI — không giấu.

## Cập nhật dữ liệu bản đồ

Dữ liệu ở `public/data/risk_summary.json` và `public/data/provinces.geojson` được sinh từ pipeline Python thật ở `ai-service/`. Để cập nhật sau khi có dữ liệu mới:

```bash
cd ../ai-service
python -m app.data.build_panel            # ghép lại panel_monthly.parquet
python -m app.data.export_dashboard_data  # xuất dashboard/public/data/risk_summary.json
```

`provinces.geojson` lấy từ [Free-GIS-Data](https://github.com/nguyenduy1133/Free-GIS-Data) (ranh giới 34 tỉnh sau sáp nhập 07/2025), đã sửa 1 lỗi gắn nhãn nhầm (2 polygon cùng tên "Lạng Sơn", 1 trong số đó thực ra là Đồng Tháp — xác minh qua toạ độ centroid) và đơn giản hoá bằng `mapshaper` (15MB → 599KB).

## Stack

Vite + React + TypeScript + Tailwind CSS v4 + Leaflet (react-leaflet) + Framer Motion + TanStack Query. Xem lý do chọn ở [README.md gốc](../README.md#3-tech-stack-đã-chốt).

## Deploy Vercel

Xem hướng dẫn ở README gốc của repo, mục "Deploy prototype".
