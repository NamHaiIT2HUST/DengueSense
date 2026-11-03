# Audit cấu hình trước eval

CI của checkpoint dev đã pass. Trước khi mở eval, 14 hash nguồn trong khóa lựa chọn đã được đối chiếu. Phương án được chọn trên dev là dense BGE-M3 revision `5617a9f61b028005a4858fdac845db406aefb181`, tokenizer cùng revision, chunk BGE 512, top-5 và metric `source-span-coverage-v1`.

Khóa ghi CLS và cosine; code có hash khóa làm rõ tiền xử lý: `AutoTokenizer` theo revision với special tokens mặc định, `truncation=False`, giới hạn input 1152, model CPU float32 batch 1, lấy `last_hidden_state[0,0,:]`, chuẩn hóa L2 từng vector ở bước cosine chính xác. Các mục này được cố định bằng hash của encoder runner, dense runner và dense code; không thay selection để bổ sung mô tả.

Sau eval, bổ sung SHA-256 mã BM25 `c5475455bb9c3f448db97153efa4bdcf76bfad0583cea29aee55fbd45c0446e4` vào khóa như provenance. Trước eval, mã này đã được xác nhận trùng commit chọn dev `4f11045`; hash file selection gốc là `b58009f172f6653b8e32b782806020affc62a03bba9b14580f214e81f11ecf02`. Các trường phương pháp, metric và lựa chọn dev không đổi. Hash selection trong artifact eval lịch sử vẫn là hash gốc; không sửa artifact đó để thay lịch sử.

Runner hybrid sau eval được thêm tùy chọn nhận đường dẫn các artifacts dev hiện hành; thuật toán và mặc định cũ không đổi. Hash runner gốc trước eval là `c9f2f0b6c630b9480cbdac8a223d9694dd0818564563f8e6c314fdaea0cf530f`; selection hiện ghi hash runner mới để nhận diện đúng phiên bản sau tích hợp CLI.

Matrix đối chiếu giữ 3 mức chunk × BM25, dense GTE, dense BGE, hybrid GTE và hybrid BGE. Không thay lựa chọn theo eval. Câu âm chỉ mô tả hit: policy khóa là retrieval-only, chưa có ngưỡng từ chối hoặc xác nhận căn cứ. Rà chuyên môn pending.
