# Dense retrieval trên dev v0.1

Cosine chính xác trên 20 câu dev (15 câu dương), metric `source-span-coverage-v1`, top-5. Corpus, nhãn, tokenizer và model giữ revision/hash ghi trong kết quả; chưa chạy eval. Đây là đánh giá kỹ thuật, rà chuyên môn vẫn pending.

| Encoder | Chunk | Recall@5 | MRR | Noise@5 |
| --- | ---: | ---: | ---: | ---: |
| GTE | 256 | 0,867 | 0,800 | 0,800 |
| GTE | 512 | 0,933 | 0,867 | 0,813 |
| GTE | 1024 | 0,933 | 0,867 | 0,813 |
| BGE-M3 | 256 | 1,000 | 0,911 | 0,773 |
| BGE-M3 | 512 | 1,000 | 0,956 | 0,800 |
| BGE-M3 | 1024 | 1,000 | 0,956 | 0,800 |

Trong sáu câu WHO `dev-10`–`dev-15` mà BM25 miss, GTE tìm đủ năm câu (`dev-11`–`dev-15`), BGE tìm đủ cả sáu, ở cả ba mức. Không suy luận nguyên nhân duy nhất của khác biệt từ phép đo này. 512 và 1024 có cùng nội dung chunk trên corpus này.

GTE từng bị dừng do memory pressure: xem [lần dừng](DENSE-DEV-STATUS.md). Sau khi bốn mẫu nền bình thường và swap không tăng, lượt resume hoàn tất: 2,26 giây từ lúc nạp tokenizer/model đến khi chạy xong, peak RSS 2.329.690.112 bytes; tái sử dụng 53 input đã hoàn thành từ lượt dừng, tính mới 13 vector. Tổng 138 cache hit trên 151 lượt lookup bao gồm cả 85 lần dùng lại nội dung giữa các mức chunk trong lượt resume. BGE chạy sau GTE: 8,51 giây cùng phạm vi thời gian, peak RSS 2.175.107.072 bytes, 66 vector mới và 85 cache hit giữa các mức chunk. Thời gian không gồm tải model trước đó, import thư viện ban đầu hoặc thời gian chờ pressure ổn định.

Trong hai lượt hoàn tất, các mẫu memory pressure đều ở mức 1 và swap bằng 6427,75 MiB; watchdog giữ giới hạn ban đầu. [Kết quả GTE](dense-gte-dev-resume-v0.1.json) và [BGE](dense-bge-dev-v0.1.json) lưu ranking từng câu, spans, metrics, thời gian và mẫu tài nguyên. Vector cache nằm ngoài Git.

Chưa có hybrid hay cấu hình khóa cho eval; không chọn cấu hình chỉ từ bảng này. Smoke trước đó chỉ xác nhận đầu vào đến 500 token; các run này không chứng minh đường đầu vào dài hơn.
