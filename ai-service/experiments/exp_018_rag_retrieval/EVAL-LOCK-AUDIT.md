# Audit cấu hình trước eval

CI của checkpoint dev đã pass. `selection-dev-v0.1.json` giữ nguyên; 14 hash nguồn trong khóa đã được đối chiếu trước khi mở eval. Phương án được chọn trên dev là dense BGE-M3 revision `5617a9f61b028005a4858fdac845db406aefb181`, tokenizer cùng revision, chunk BGE 512, top-5 và metric `source-span-coverage-v1`.

Khóa ghi CLS và cosine; code có hash khóa làm rõ tiền xử lý: `AutoTokenizer` theo revision với special tokens mặc định, `truncation=False`, giới hạn input 1152, model CPU float32 batch 1, lấy `last_hidden_state[0,0,:]`, chuẩn hóa L2 từng vector ở bước cosine chính xác. Các mục này được cố định bằng hash của encoder runner, dense runner và dense code; không thay selection để bổ sung mô tả.

Matrix đối chiếu giữ 3 mức chunk × BM25, dense GTE, dense BGE, hybrid GTE và hybrid BGE. Không thay lựa chọn theo eval. Câu âm chỉ mô tả hit: policy khóa là retrieval-only, chưa có ngưỡng từ chối hoặc xác nhận căn cứ. Rà chuyên môn pending.
