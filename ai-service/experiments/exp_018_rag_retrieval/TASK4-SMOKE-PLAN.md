# Task 4 — điều chỉnh dependencies và smoke encoder

Điều chỉnh plan `2026-10-29-layer3-retrieval-offline-implementation-plan.md`: tách runtime encoder vào `ai-service/requirements-embeddings.txt`, tùy chọn và không được thêm vào `requirements-rag.txt` hay job CI hiện tại. Resolver và cài đặt dùng virtualenv `denguesense-rag` bền vững, kiểm prefix và đường dẫn thư viện; không cài global hoặc thay môi trường Layer 1.

- Pin model và tokenizer theo commit tương ứng đã khóa: GTE `9bbca17d9273fd0d03d5725c7a4b0f6b45142062`, BGE-M3 `5617a9f61b028005a4858fdac845db406aefb181`. Config GTE trỏ đến repo mã riêng `Alibaba-NLP/new-impl`; pin thêm code revision `40ced75c3017eb27626c9d4ea981bde21a2662f4` và rà mã trước khi thực thi. Chỉ dùng attention PyTorch trên CPU.
- Chạy GTE trước, BGE sau, từng process riêng, CPU float32, batch 1, intra-op 4/inter-op 1; tối đa 20 chunk dài nhất và 5 câu dev. Không dùng eval hoặc chạy full dense/hybrid trong mốc smoke.
- Đo token sau preprocessing không truncate, dimension và vector hữu hạn, runtime, RSS đỉnh, áp lực bộ nhớ/swap; giữ cache và checkpoint. Dừng khi RSS vượt 8 GiB, memory pressure vàng/đỏ kéo dài hoặc swap tăng liên tục. Nếu không thể giám sát các điều kiện dừng, không chạy smoke.
- Ghi cấu hình, phiên bản đã giải quyết và kết quả thật, kể cả lỗi; checkpoint/push sau từng smoke. Chỉ tiếp tục triển khai dense/hybrid khi hai smoke đạt.
