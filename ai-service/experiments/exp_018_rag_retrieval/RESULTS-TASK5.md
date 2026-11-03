# Task 5 — retrieval dev và eval

Đã chạy 15 cấu hình × 20 câu eval (300 query-runs), trên corpus 43 units và hai split đã khóa. Mỗi split có 15 câu dương, 5 câu âm. Bảng dùng `source-span-coverage-v1`; mỗi ô là Recall@5 / MRR trên câu dương. Chỉ số là đánh giá kỹ thuật trên corpus nhỏ; rà chuyên môn và pháp lý vẫn pending.

| Phương pháp | Chunk | Dev | Eval |
| --- | ---: | ---: | ---: |
| BM25 | 256 | 0,600 / 0,456 | 0,533 / 0,533 |
| BM25 | 512 | 0,600 / 0,500 | 0,533 / 0,533 |
| BM25 | 1024 | 0,600 / 0,500 | 0,533 / 0,533 |
| Dense GTE | 256 | 0,867 / 0,800 | 0,933 / 0,822 |
| Dense GTE | 512 | 0,933 / 0,867 | 0,933 / 0,822 |
| Dense GTE | 1024 | 0,933 / 0,867 | 0,933 / 0,822 |
| Dense BGE | 256 | 1,000 / 0,911 | 0,933 / 0,856 |
| **Dense BGE** | **512** | **1,000 / 0,956** | **0,933 / 0,856** |
| Dense BGE | 1024 | 1,000 / 0,956 | 0,933 / 0,856 |
| Hybrid GTE | 256 | 0,800 / 0,678 | 0,800 / 0,663 |
| Hybrid GTE | 512 | 0,800 / 0,717 | 0,800 / 0,633 |
| Hybrid GTE | 1024 | 0,800 / 0,647 | 0,800 / 0,663 |
| Hybrid BGE | 256 | 0,933 / 0,693 | 0,800 / 0,652 |
| Hybrid BGE | 512 | 0,800 / 0,683 | 0,800 / 0,647 |
| Hybrid BGE | 1024 | 0,867 / 0,658 | 0,800 / 0,656 |

Dense BGE/512 được chọn **trước eval** và không đổi sau eval. Nó truy hồi đủ 14/15 unit liên quan; Noise@5 là 0,813. Câu miss `draft-04` hỏi vai trò và liên kết của nhóm truyền thông; unit đúng là WHO systems/readiness/team, trong khi top-5 gồm các đoạn WHO khác về phối hợp/ứng phó. Kết quả 0,933 vượt ngưỡng điểm kỹ thuật 0,90 trên mẫu này, không đủ để khẳng định tổng quát hóa hay đạt các yêu cầu chuyên môn.

## Câu âm

Tất cả 15 cấu hình đều trả 5 hit cho mỗi câu âm. Với dense BGE/512, top-1 lần lượt là:

| ID | Yêu cầu thiếu căn cứ trong corpus | Unit top-1 |
| --- | --- | --- |
| draft-07 | Chẩn đoán cá nhân | HCDC mục 5 |
| eval-17 | Giường trống Bạch Mai hôm nay | QĐ Điều 7 Khoản 2 |
| eval-18 | Kinh phí phun chính xác quận 1 | HCDC mục 11 |
| eval-19 | Danh sách y tá trực đêm | QĐ phụ lục dòng 14 |
| eval-20 | Runtime M2 trên máy người hỏi | QĐ phụ lục dòng 14 |

Các hit này không được xác nhận là căn cứ trả lời. Không có chính sách ngưỡng/từ chối trong thí nghiệm; không kết luận hệ thống trả lời an toàn. Runtime M2 có thể tồn tại ngoài corpus retrieval v0.1.

## Tài nguyên và tái lập

Encoder chạy offline tuần tự trên CPU, float32, batch 1. GTE eval: 2,25 giây từ nạp tokenizer/model đến xong, peak RSS 2.211.348.480 bytes, pressure mức 1. BGE eval: 4,08 giây, peak RSS 1.868.464.128 bytes; có hai mẫu pressure mức 2 rồi trở lại 1, chưa tới ngưỡng dừng. Swap không đổi ở 6427,75 MiB. Đây không phải thời gian tải model hay SLA; các lượt tái sử dụng document-vector cache. BGE/512 cosine trên vector đã có: median khoảng 0,075 ms, p95 khoảng 0,085 ms trên 20 câu; chưa gồm encoding.

GTE dev từng dừng vì áp lực hệ thống, sau đó resume với 53 input đã lưu; xem [báo cáo dense](DENSE-DEV.md). Checkpoint matrix được ghi atomic ở cache ngoài Git, khóa theo hash selection/eval/corpus, code runner và hai lượt encoder. Matrix được tính lại một lần từ cùng cache sau khi bổ sung fingerprint runner; cả 15 ranking, metrics và hit âm khớp lần đầu, không đổi cấu hình. Model và vector cache không commit. [Audit khóa](EVAL-LOCK-AUDIT.md), [selection từ dev](selection-dev-v0.1.json), [ranking matrix eval](eval-matrix-verified-v0.1.json) và hai file `eval-{gte,bge}-v0.1.json` lưu cấu hình, tài nguyên, lỗi và provenance.

Sau eval đã bổ sung provenance hash BM25, kiểm lại 15 ranking và metric từ vector cache; tất cả khớp artifact lịch sử, không chạy lại encoder. Runner mới yêu cầu digest cho từng cấu hình, tính lại ranking/span/metric khi resume và khóa một writer; checkpoint cũ thiếu digest được giữ làm lịch sử và bị từ chối resume trực tiếp. Dùng `python -m experiments.exp_018_rag_retrieval.run --config experiments/exp_018_rag_retrieval/config-matrix.yaml --out <thư-mục-mới> --stage eval --dry-run`; đặt `RAG_OFFLINE_ROOT` tới thư mục chứa `hf-cache/` và `tokenizers/`. Bỏ `--dry-run` để kiểm lại từ cache; dùng `--resume` cho checkpoint mới cùng fingerprint. Tùy chọn `--encode-eval` chạy lại encoder tuần tự qua watchdog khi thực sự cần tạo vector eval mới. Không tự xóa lock cũ: kiểm tra tiến trình sở hữu trước.

Corpus chỉ gồm ba nguồn đã chọn, không đo tổng quát hóa sang tài liệu mới; câu hỏi/nhãn đã rà kỹ thuật nhưng chưa được chuyên gia độc lập duyệt. Độ phủ toàn unit có tính bảo thủ. Input dài nhất thực chạy 500 token, chưa kiểm đường dài hơn. Không có LLM, chấm chất lượng văn bản sinh, hay kiểm nghiệm end-to-end workflow trong kết quả này.
