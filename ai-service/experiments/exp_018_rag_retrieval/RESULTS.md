# Báo Cáo Kết Quả Đánh Giá Offline RAG Retrieval (Exp 018)

> **Môi trường & Trạng thái**: Đánh giá benchmark cục bộ ngoại tuyến (Offline Benchmark). Chưa có phê duyệt pháp lý/chuyên môn của người có thẩm quyền để kích hoạt RAG động cho công điện hành chính B2G.

---

## 1. Hiện vật đóng băng & Mã băm (Frozen Artifacts & Hashes)

| Hiện vật | Tệp tin | Phiên bản / SHA-256 | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Manifest** | `corpus-manifest.yaml` | `v0.1-offline` | 3 văn bản nguồn |
| **QĐ 02/2016 PDF** | `RAG_Documents/02.signed.pdf` | `7bc6d356b3cbfd3334fe99574544330e897705301425f825e377efb1324355f6` | 6 trang scan VGP |
| **WHO RCCE PDF** | `RAG_Documents/9789240095274-eng.pdf` | `e5684fb54e39f8e0356608b6c5970f2d772695389ec70f1d8b9fbd2c009c182e` | 64 trang WHO |
| **Cẩm nang HCDC PDF** | `RAG_Documents/Cam nang SXH cap nhat 2025.pdf` | `f27db6740dc0c3e9ab76c019c254954aecfb6227fce92fbeec6eace293c6a9e0` | 24 trang HCDC |
| **Reviewed Units** | `reviewed-units.json` | `79daef0485e815f2f9bff5caa8622f64eba02480f6d31b149b80795f13d01e2b` | 16 đơn vị đã đối chiếu nguyên văn |
| **Queries Dataset** | `queries.jsonl` | `5b332f7aee07b360416d94308c5c1bf908c7140f10d74f210879f26fd3783277` | 16 câu hỏi (8 dev, 8 eval, 4 âm tính) |

---

## 2. Quy tắc phân chia tập Dev / Eval & Chống rò rỉ ngữ nghĩa

- **Không rò rỉ (Zero Leakage)**: Tất cả câu hỏi được gắn nhãn `group_id`. Mọi câu hỏi cùng nhóm chủ đề/khái niệm đều nằm trọn vẹn ở một tập duy nhất (`dev` hoặc `eval`).
- **Dev Groups**: `legal-commune-threshold`, `legal-general-conditions`, `legal-cessation-unknown`, `legal-dengue-interval`, `hcdc-prevent-bites`, `who-coord-taskforce`, `neg-staffing-ratio`, `neg-measles-interval`.
- **Eval Groups**: `legal-district-threshold`, `legal-province-threshold`, `legal-effective-date`, `hcdc-container-7-principles`, `who-team-roles`, `who-surge-budget`, `neg-individual-diagnosis`, `neg-pediatric-dosage`.
- Giao tập giữa nhóm `dev` và `eval` là $\emptyset$ (kiểm tra tự động qua `validate_queries`).

---

## 3. Kết quả đánh giá Benchmark

Bộ truy hồi sử dụng thuật toán BM25 có chuẩn hóa từ khóa và đồng bộ song ngữ Anh-Việt (`app/genai_rag/retrieve.py`):

| Chỉ số đánh giá | Tập Dev (8 truy vấn) | Tập Eval (8 truy vấn) | Toàn bộ Corpus (16 truy vấn) | Mục tiêu / Tiêu chuẩn |
| :--- | :---: | :---: | :---: | :---: |
| **Số truy vấn trả lời được** | 6 | 6 | 12 | - |
| **Số truy vấn âm tính khó** | 2 | 2 | 4 | - |
| **Recall@5** | **1.000 (100%)** | **1.000 (100%)** | **1.000 (100%)** | $\ge 0.80$ |
| **Mean Reciprocal Rank (MRR)** | **1.000** | **0.833** | **0.917** | $\ge 0.80$ |
| **Noise@5** | 0.800 | 0.800 | 0.800 | Top-5 trả về 1 hit đúng |
| **Từ chối truy vấn âm tính** | **2/2 (100%)** | **2/2 (100%)** | **4/4 (100%)** | 100% fail-closed |
| **Độ chính xác trích dẫn (Quote Precision)** | **100% nguyên văn** | **100% nguyên văn** | **100% nguyên văn** | Khớp 100% chuỗi con |

---

## 4. Xử lý các ca giới hạn và lỗi ghi nhận

1. **Hàng 16 Phụ lục QĐ 02/2016 (Bệnh sởi)**:
   - Trên bản scan chính thức từ VGP (`02.signed.pdf`), ô ghi số ngày không phát hiện thêm ca mắc mới của bệnh sởi bị con dấu tròn đỏ của cơ quan ban hành đóng đè che khuất.
   - Để đảm bảo tính trung thực dữ liệu, hàng 16 **không được đánh chỉ mục**. Câu hỏi kiểm thử `dev-08` cố tình truy vấn thời hạn này được hệ thống từ chối fail-closed (trả về 0 kết quả).
2. **Truy vấn ngoài phạm vi y tế / lâm sàng**:
   - `dev-07` (Định mức điều dưỡng/giường bệnh), `eval-07` (Chẩn đoán cá nhân), `eval-08` (Liều lượng Paracetamol trẻ em) đều bị bộ lọc và ngưỡng điểm từ chối triệt để.
3. **Cẩm nang HCDC Mục 7 trải dài hai trang**:
   - Câu hỏi 7 của Cẩm nang SXH HCDC bắt đầu từ trang PDF 15 (trang in 13) và tiếp nối qua trang PDF 16 (trang in 14), bao gồm trọn vẹn 07 nguyên tắc xử lý vật chứa nước. Đơn vị `hcdc-sxh-snapshot-2025/muc-7` lưu chính xác `pdf_pages: [15, 16]` và `printed_pages: "13-14"`.

---

## 5. Trạng thái Pháp lý & Phê duyệt Chuyên môn

- `legal_status`: `unverified` (QĐ 02/2016, Cẩm nang HCDC) / `not_applicable` (Tài liệu WHO).
- `professional_review`: `pending` (Chưa có chuyên gia dịch tễ / y tế công cộng ký duyệt).
- **Cơ chế Fail-Closed trong Serving**:
  - Tuyệt đối **không bật RAG động cho công điện B2G**. B2G dispatches tiếp tục dùng danh mục citation tĩnh đã đối chiếu nguyên văn (`VERIFIED_LEGAL_CITATIONS`).
  - Endpoint `/internal/v1/genai/rag/query` chỉ được kích hoạt với nhãn nghiên cứu đánh giá độc lập (`BENCHMARK_RESEARCH_ONLY`), nghiêm cấm LLM tự sinh địa chỉ URL hay mã văn bản giả mạo.
