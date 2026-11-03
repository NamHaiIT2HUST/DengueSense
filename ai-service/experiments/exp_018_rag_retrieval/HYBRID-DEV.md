# Hybrid và lựa chọn trên dev v0.1

Hybrid dùng RRF k=60, pool tối đa 20 kết quả mỗi nhánh và top-5; không cộng trực tiếp điểm BM25 với cosine. Runner kiểm fingerprint cache, tính lại top-20 và đối chiếu top-5 của từng nhánh với ranking BM25/dense đã lưu trước khi hợp nhất. Không nạp encoder hoặc dùng eval.

| Hybrid | Chunk | Recall@5 | MRR | Noise@5 |
| --- | ---: | ---: | ---: | ---: |
| BM25 + GTE | 256 | 0,800 | 0,678 | 0,813 |
| BM25 + GTE | 512 | 0,800 | 0,717 | 0,840 |
| BM25 + GTE | 1024 | 0,800 | 0,647 | 0,840 |
| BM25 + BGE | 256 | 0,933 | 0,693 | 0,787 |
| BM25 + BGE | 512 | 0,800 | 0,683 | 0,840 |
| BM25 + BGE | 1024 | 0,867 | 0,658 | 0,827 |

Các số trên 15 câu dev dương, metric `source-span-coverage-v1`; ranking và thời gian từng câu trong [hybrid-dev-v0.1.json](hybrid-dev-v0.1.json). Tất cả là kết quả dev, không chứng minh hiệu quả ngoài corpus này.

Theo thứ tự đã định Recall@5 → MRR → Noise@5 → thời gian, chọn **dense BGE-M3, chunk 512**: Recall 1,000, MRR 0,956, Noise 0,800. Mức 1024 có cùng các metric và nội dung chunks; trong lượt đo này median/p95 tìm cosine tương ứng khoảng 0,077/0,087 ms ở 512 và 0,083/0,148 ms ở 1024. Đây là thời gian tìm trên vector đã có, không gồm encoding; chênh lệch rất nhỏ và không là cam kết độ trễ.

[selection-dev-v0.1.json](selection-dev-v0.1.json) khóa cấu hình và hash đầu vào/code cho đánh giá tiếp theo. Policy hiện là retrieval-only, không dùng score threshold và không suy ra answerability hay căn cứ hợp lệ từ việc có hit; chưa đánh giá cơ chế từ chối cho câu âm. Không mở eval hay điều chỉnh lựa chọn theo eval trong mốc này. Rà chuyên môn vẫn pending.
