# Exp 018 — truy hồi tài liệu offline cho bản demo

## Nguồn và phạm vi

Manifest cố định SHA-256 của ba PDF trong `RAG_Documents/`. Thư mục này không được commit; khi chạy Docker local, mount read-only. Bộ 16 `reviewed-units.json` chỉ được dùng cho benchmark. Đối với QĐ 02/2016/QĐ-TTg dạng scan, các đoạn được chép thủ công từ ảnh trang 1, 3 và 5; hàng 14 của phụ lục là bản chép có cấu trúc từ bảng. WHO và HCDC có lớp text và đã được đối chiếu theo trang. `review_status: checked` chỉ có nghĩa là so nội dung, **không** phải phê duyệt pháp lý/chuyên môn. Manifest vẫn ghi `legal_status: unverified`, `professional_review: pending`.

| Hiện vật | SHA-256 |
| --- | --- |
| `reviewed-units.json` | `26043a3805f6d1093332cf495e564e859d2fdc02f040935c033e17747b8687d8` |
| `queries.jsonl` | `b135014a33e2dfba66b9e40b6136fbab76c3633e3323873198fa0c1bcc993c21` |

## Kết quả trên bộ 16 câu hỏi đã gắn nhãn

| Chỉ số | Dev: 6 câu dương tính | Eval: 6 câu dương tính | Tổng |
| --- | ---: | ---: | ---: |
| Recall@5 | 1.000 | 1.000 | 1.000 |
| MRR | 1.000 | 0.783 | 0.892 |
| Noise@5 | 0.792 | 0.800 | 0.796 |

Bốn câu âm tính đã định trước không trả kết quả. Trích dẫn do retriever trả về là chuỗi con của `reviewed-units.json`; kiểm thử này **không** chứng minh chính xác đối với mọi câu hỏi mới hoặc văn bản PDF chưa được rà soát. `group_id` không trùng giữa dev và eval, nhưng các chủ đề pháp lý liên quan nhau và tập rất nhỏ; không gọi eval là blind hoặc không rò rỉ ngữ nghĩa. MRR eval thấp hơn ngưỡng mục tiêu 0.8.

## Guardrail khi phục vụ

`/internal/v1/genai/rag/query` tắt mặc định. Chỉ khi `GENAI_RAG_BENCHMARK_ENABLED=true`, PDF gốc khớp hash, và câu hỏi trùng chính xác một câu dương tính trong `queries.jsonl`, endpoint mới trả hit; mọi câu khác trả `answerable=false`. Điều này là chế độ trình diễn benchmark đóng, **không** phải hỏi đáp RAG tự do. B2G vẫn dùng danh mục citation tĩnh, không dùng corpus này. Chưa có chuyên gia được ủy quyền ký duyệt để mở rộng phạm vi.
