# Kiểm tra chunking và trần oracle v0.1

Kiểm tra kỹ thuật offline, không chạy retrieval hay encoder. Metric: `source-span-coverage-v1`, top-5. Corpus SHA-256 `3a7cdd649f1f449b6c58923bc8c84899477ce08050442620bdd4c6198888a48a` (43 units). Dev SHA-256 `15f93d2949cb8659097c14b0c1f38c8819ce53cd756be8f6197fe476fd5f0759`; eval SHA-256 `3c351cd7c0313e9f7ecad365891e32578a003f8ff7fabd11b5c59f683a1c6d5c`. Mỗi split có 15 câu dương. Rà chuyên môn vẫn pending.

Tokenizer BGE-M3 revision `5617a9f61b028005a4858fdac845db406aefb181` và GTE revision `9bbca17d9273fd0d03d5725c7a4b0f6b45142062`, không truncate. BGE content tính ngân sách chunk; cả hai tokenizer được kiểm lại gồm special tokens với giới hạn 1152. Hai tokenizer đã pin thêm hai special tokens; builder dành sẵn hai token. Encoder có thể xử lý đầu vào khác và vẫn cần smoke riêng.

| BGE content budget | Tổng chunks | Chunks mục 7 | Trần Recall@5 dev | Trần Recall@5 eval |
| --- | ---: | ---: | ---: | ---: |
| 256 | 45 | 3 | 1,000 | 1,000 |
| 512 | 43 | 1 | 1,000 | 1,000 |
| 1024 | 43 | 1 | 1,000 | 1,000 |

Oracle duyệt các tập tối đa năm chunk thuộc các unit liên quan của từng câu dương, tính hợp span qua evaluator rồi lấy Recall cao nhất; bảng là trung bình trên 15 câu dương mỗi split. Đây chỉ là trần cấu trúc, không đo chất lượng truy hồi. Các câu âm không thuộc mẫu tính Recall. Eval chỉ được kiểm khả năng phủ cấu trúc, không dùng kết quả retrieval để chỉnh splitter.

Mục 7 tại mức 256 gồm span `[0,577)`, `[0,36)+[577,1361)`, `[0,36)+[1361,1660)` trên chuỗi Unicode nguồn. Tiêu đề `[0,36)` được lặp để giữ ngữ cảnh; phần mở đầu và bảy nguyên tắc không bị cắt giữa nguyên tắc. BGE content tương ứng 186, 246, 88; GTE content 185, 245, 88. Sau special tokens: BGE 188, 248, 90; GTE 187, 247, 90. Hai trang nguồn 15–16 được giữ trong provenance. Tập ba chunk phủ toàn unit, do đó `draft-03` có oracle Recall@5 bằng 1,0.

Đã kiểm trên cả 43 units và ba mức: chuỗi ghép từ spans bằng đúng nội dung từng chunk, hợp spans phủ toàn unit, số trang trùng unit, BGE content không vượt mức và hai tokenizer với special tokens không vượt 1152. Bộ chia chỉ xử lý cấu trúc bảy mục đã kiểm của HCDC mục 7; unit quá dài hoặc cấu trúc không khớp sẽ báo lỗi để rà, không cắt ngầm.
