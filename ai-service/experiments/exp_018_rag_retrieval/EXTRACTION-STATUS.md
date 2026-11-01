# Trạng thái trích xuất Exp 018 — 2026-11-01

- Ba PDF gốc được kiểm tra SHA-256 và số trang theo `corpus-manifest.yaml`; không commit PDF vào Git.
- `prepare.py` dùng pypdf hoặc PyMuPDF để lấy lớp text. Với PDF scan không có text, công cụ xuất ảnh trang, tạo bản ghi `ocr_required`, để `text` rỗng và `review_status: unreviewed`. Công cụ **không thực hiện OCR**.
- QĐ 02/2016: 9 đơn vị chép và so thủ công với ảnh trang 1, 3, 5; hàng 14 phụ lục là bản chép bảng có cấu trúc. Không đưa hàng 16 bệnh sởi bị dấu che vào index.
- HCDC: 2 đơn vị từ lớp text, trong đó Mục 7 trải trang PDF 15–16. WHO: 5 đoạn ngắn từ lớp text trang PDF 30–31.
- `reviewed-units.json`: SHA-256 `26043a3805f6d1093332cf495e564e859d2fdc02f040935c033e17747b8687d8`. `queries.jsonl`: SHA-256 `b135014a33e2dfba66b9e40b6136fbab76c3633e3323873198fa0c1bcc993c21`.
- 16 câu hỏi gồm 8 dev, 8 eval và 4 âm tính. Dev Recall@5 1.000, MRR 1.000; eval Recall@5 1.000, MRR 0.783. Xem [RESULTS.md](RESULTS.md) để biết giới hạn của phép đo.
- Corpus chỉ phục vụ benchmark đóng. Chưa được duyệt pháp lý/chuyên môn; B2G runtime không sử dụng truy hồi này.
