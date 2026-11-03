# Tích hợp retrieval với main

1. Giữ nguyên bộ module phục vụ và callers của main tại `app/genai_rag/{corpus,retrieve,evaluate}.py`. Chuyển bốn module baseline `corpus`, `chunking`, `retrieve`, `evaluate` vào `app/genai_rag/offline/`; cập nhật imports nội bộ và `bm25_dev.py`.
2. Giữ tests serving/main dưới tên hiện tại; chuyển bốn test baseline thành `test_offline_{corpus,chunking,retrieve,evaluate}.py`, kể cả đường dẫn monkeypatch. Giữ CLI trích xuất baseline riêng nếu main có phiên bản cùng tên.
3. Hợp nhất lịch sử `EXTRACTION-STATUS.md` có ghi nguồn; giữ manifest, corpus, splits, hash và báo cáo khóa của baseline đồng thời bảo toàn metadata, artifacts và báo cáo teammate trên main. Không thay trạng thái review.
4. Kiểm tests offline và tests retrieval/serving main, quality checks service và so lại output baseline/hash. Kiểm Ruff trên base trước khi cân nhắc sửa cơ học ngoài retrieval. Sau review diff, commit/push, kiểm PR #16 và CI; chưa merge hoặc chạy encoder.
