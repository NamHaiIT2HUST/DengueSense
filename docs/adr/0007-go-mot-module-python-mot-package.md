# ADR-0007 — Go: 1 module nhiều service; Python: 1 package nhiều image

**Trạng thái:** accepted · 2026-09-25

## Bối cảnh
Đội 2 người, tooling và phụ thuộc phải dùng chung để không tốn thời gian bảo trì 8 bộ cấu hình. Đồng thời phải giữ ranh giới để tách repo/cụm về sau nếu cần.

## Quyết định
- **Go:** 1 module `backend/`, mỗi service là `cmd/<svc>` + `services/<svc>`, thư viện chung ở `pkg/*` (httpx, authx, eventx, dbx, obsx, configx) **không chứa nghiệp vụ**. `depguard` chặn: `services/X` không import `services/Y`; `pkg/*` không import `services/*`.
- **Python:** 1 package `app/` (thư viện Layer 1 đã có ở `app/forecast`, `app/data`) + lớp mới `app/serving/` với 3 API (`forecast_api`, `optimize_api`, `genai_api`) + `common`. **Mỗi API là một image riêng** (entrypoint khác), dùng chung code, không chung tiến trình hay schema. `import-linter` chặn import chéo giữa các API.
- Logic ML **không** nằm ở `serving/` — chỉ gọi `app/forecast/*` (đã có 148 test).
- `mypy --strict` áp cho `app/serving/`; không áp cho `experiments/`.

## Phương án đã cân nhắc
- **Mỗi service một repo/module:** cô lập tối đa nhưng nhân bội chi phí CI, phiên bản, cập nhật phụ thuộc — quá đắt cho 2 người.
- **Python tách package cho từng service:** phải publish/quản lý phiên bản package nội bộ; lợi ích không tương xứng.

## Hệ quả
- (+) 1 lần cập nhật phụ thuộc, 1 cấu hình lint, refactor xuyên service trong 1 PR (khi cần).
- (−) Dễ "rò" phụ thuộc giữa service nếu không có công cụ chặn — vì vậy `depguard`/`import-linter` là bắt buộc trong CI, không phải khuyến nghị.
