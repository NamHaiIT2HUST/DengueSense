# BM25 baseline trên dev v0.1

Đây là phép đo retrieval offline trên 20 câu dev, gồm 15 câu có đáp án và 5 câu thiếu căn cứ. Corpus và nhãn có hash trong `bm25-dev-v0.1.json`; rà chuyên môn vẫn pending. Không dùng eval để chỉnh thuật toán hay ngưỡng từ chối.

BM25Okapi của `rank-bm25` 0.2.2: k1=1,5, b=0,75, top-5; Unicode NFC, casefold, token chữ/số giữ dấu; không dịch. Chỉ các chunk có từ trùng mới được trả, kể cả khi điểm không dương; điểm bằng nhau xếp theo chunk ID. Metric là `source-span-coverage-v1`.

| BGE content budget | Số chunks | Recall@5 | MRR | Noise@5 | Lỗi |
| --- | ---: | ---: | ---: | ---: | ---: |
| 256 | 45 | 0,600 | 0,456 | 0,853 | 0 |
| 512 | 43 | 0,600 | 0,500 | 0,880 | 0 |
| 1024 | 43 | 0,600 | 0,500 | 0,880 | 0 |

Recall và MRR tính trên 15 câu có đáp án. Mục 7 (`draft-03`) được phủ đủ ở cả ba mức; tại 256, cả ba chunk liên quan xuất hiện trong top-5. Sáu câu không đạt Recall ở cả ba mức là `dev-10` đến `dev-15`; cả sáu hỏi tiếng Việt và nhãn trỏ tới WHO tiếng Anh. Khác biệt ngôn ngữ có thể góp phần vào kết quả BM25, nhưng phép đo này không tách riêng được nguyên nhân.

Recall@5 0,600 chưa đạt mục tiêu ≥0,90. Đây là baseline để đối chiếu dense/hybrid, chưa phải lựa chọn thuật toán cuối cùng; không thay đổi corpus hoặc nhãn để cải thiện điểm.

Cả năm câu thiếu căn cứ đều trả 5 lexical hits ở cả ba mức. Có hit không có nghĩa là có căn cứ trả lời; chưa có ngưỡng từ chối hay phép đo false-support đã chốt. Hai mức 512/1024 tạo cùng nội dung unit và điểm, dù chunk ID khác theo mức cấu hình. Oracle chỉ xác nhận có thể phủ đủ, không bảo đảm BM25 tìm được.

Runner `bm25_dev.py` kiểm hash corpus, dev và hai tokenizer trước khi chạy; đầu ra `bm25-dev-v0.1.json` lưu ranking từng câu, score, spans, provenance, metrics và errors. Nó từ chối ghi đè output. Chạy từ `ai-service` trong venv riêng:

```sh
python -m experiments.exp_018_rag_retrieval.bm25_dev \
  --corpus data/processed/rag-offline/corpus-v0.1.json \
  --bge-tokenizer /path/to/pinned-bge/tokenizer.json \
  --gte-tokenizer /path/to/pinned-gte/tokenizer.json \
  --output /path/to/new-bm25-dev.json
```

Tokenizer đã pin chỉ được nạp metadata; chưa chạy encoder. Splitter chỉ chia cấu trúc mục 7 HCDC đã kiểm: unit dài khác hoặc cấu trúc sai sẽ báo lỗi để rà, không cắt ngầm.
