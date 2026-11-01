# Extraction & Retrieval Offline Status (Exp 018)

> Trạng thái cập nhật ngày: 2026-11-01 (Nhánh `codex/complete-local-stack`).

## 1. Xác minh tài liệu gốc & Công cụ trích xuất

- **Môi trường trích xuất**: Python 3.13, PyMuPDF 1.28.2, pypdf 6.21.4, PyYAML 6.0.3, Pydantic 2.13.5.
- **Tệp nguồn (RAG_Documents/)**:
  - `02.signed.pdf`: SHA-256 `7bc6d356b3cbfd3334fe99574544330e897705301425f825e377efb1324355f6` (6 trang scan VGP).
  - `9789240095274-eng.pdf`: SHA-256 `e5684fb54e39f8e0356608b6c5970f2d772695389ec70f1d8b9fbd2c009c182e` (64 trang hướng dẫn WHO).
  - `Cam nang SXH cap nhat 2025.pdf`: SHA-256 `f27db6740dc0c3e9ab76c019c254954aecfb6227fce92fbeec6eace293c6a9e0` (24 trang cẩm nang HCDC).
- **Công cụ trích xuất & OCR (`prepare.py`)**:
  - Hỗ trợ parser dự phòng PyMuPDF khi gặp luồng PDF phức tạp.
  - Khi phát hiện tệp scan (không có lớp text, báo lỗi `OCR_REQUIRED`), công cụ tự động kích hoạt `render_page_images` để xuất ảnh từng trang phục vụ đối chiếu thủ công, đồng thời xuất bản nháp thô đánh dấu `raw_ocr_draft` và `review_status: "unreviewed"`.

## 2. Đối chiếu trực quan & Đóng băng tập đơn vị (`reviewed-units.json`)

- Đã thực hiện đối chiếu văn bản từng câu chữ (visual and textual comparison) với ảnh chụp trang in gốc cho **16 đơn vị văn bản**:
  - **QĐ 02/2016/QĐ-TTg**: 9 đơn vị (`dieu-1`, `dieu-2/khoan-1`, `dieu-2/khoan-2/a`, `dieu-2/khoan-2/b`, `dieu-2/khoan-2/c`, `dieu-7/khoan-1`, `dieu-7/khoan-2`, `dieu-8/khoan-1`, `phu-luc/hang-14`).
  - **Loại trừ Hàng 16 Phụ lục**: Hàng 16 (Bệnh sởi) bị con dấu đỏ đóng đè che khuất ô số ngày hết dịch, giữ nguyên tình trạng không đọc được và **không đưa vào index**.
  - **Cẩm nang SXH HCDC**: 2 đơn vị (`muc-6`, `muc-7`). Trong đó Mục 7 trải dài trên 2 trang PDF 15 và 16 (trang in 13-14) chứa đầy đủ 07 nguyên tắc xử lý vật chứa nước.
  - **WHO RCCE Dengue 2024**: 5 đơn vị trích từ Table 6 (trang PDF 30-31, trang in 22-23) về Hệ thống & điều phối, Dữ liệu cộng đồng, và Kênh truyền thông nguy cơ.
- Toàn bộ 16 đơn vị được đóng băng tại `reviewed-units.json` (SHA-256: `79daef0485e815f2f9bff5caa8622f64eba02480f6d31b149b80795f13d01e2b`).
- Trạng thái: `eligibility: "benchmark_only"`, `review_status: "checked"`.
- Pháp lý & Chuyên môn: `legal_status: "unverified"`, `professional_review: "pending"` (chưa có chữ ký số hoặc phê duyệt của cơ quan/chuyên gia có thẩm quyền).

## 3. Bộ câu hỏi đánh giá & Chống rò rỉ (`queries.jsonl`)

- Đóng băng 16 câu hỏi tại `queries.jsonl` (SHA-256: `5b332f7aee07b360416d94308c5c1bf908c7140f10d74f210879f26fd3783277`).
- Phân chia: 8 câu tập `dev`, 8 câu tập `eval`.
- Chống rò rỉ ngữ nghĩa tuyệt đối qua `group_id`: không có nhóm nào xuất hiện ở cả hai tập.
- Đã kiểm tra 4 truy vấn âm tính khó (định mức điều dưỡng, bệnh sởi bị che dấu, chẩn đoán cá nhân, liều thuốc Paracetamol trẻ em).

## 4. Kết quả Benchmark (`RESULTS.md`)

- **Dev**: Recall@5 = 1.000, MRR = 1.000, Âm tính từ chối = 2/2 (100%).
- **Eval**: Recall@5 = 1.000, MRR = 0.833, Âm tính từ chối = 2/2 (100%).
- **Trích dẫn**: 100% trích dẫn là chuỗi con nguyên văn của đơn vị văn bản nguồn.

## 5. Phục vụ Serving

- B2G dispatches tiếp tục dùng danh mục citation tĩnh đã đối chiếu nguyên văn (`VERIFIED_LEGAL_CITATIONS`).
- Endpoint benchmark `/internal/v1/genai/rag/query` được cung cấp riêng cho mục đích nghiên cứu, kiểm tra tự động và đánh giá hiệu năng truy hồi.
