# Prompt hoàn thiện Layer 3 RAG cho Antigravity

> Chỉ dùng prompt này cho phần truy hồi còn thiếu. Repo đã tích hợp nhánh `feature/layer3-retrieval-offline` và ba PDF nguồn đã được đặt trong `RAG_Documents/` trên máy demo (thư mục bị Git bỏ qua). Không tải bản khác hoặc sửa hash để qua kiểm tra.

## Prompt giao việc

```text
Bạn là coding agent tiếp tục DengueSense trên nhánh hiện tại. Đọc .agents/skills/denguesense/SKILL.md, denguesense-layer3-genai/SKILL.md, README.md, ai-service/experiments/exp_018_rag_retrieval/EXTRACTION-STATUS.md và corpus-manifest.yaml trước khi sửa.

Mục tiêu: hoàn thiện bộ truy hồi tài liệu offline có thể kiểm chứng, rồi chỉ nối vào GenAI serving khi corpus, nhãn đánh giá và guardrail đạt điều kiện. Không được tự nâng `professional_review` thành approved hoặc `legal_status` thành effective nếu chưa có người đủ thẩm quyền ký duyệt. Không gọi benchmark-only là RAG runtime.

1. Xác minh ba PDF tại RAG_Documents/ theo SHA-256 và số trang trong manifest. Nguồn: PDF QĐ 02/2016/QĐ-TTg trên datafiles.chinhphu.vn (trang vanban.chinhphu.vn docid=183327), WHO ISBN 9789240095274 từ nút Download của who.int, cẩm nang SXH 2025 từ trang mnrangdonghocmon.hcm.edu.vn. Không commit PDF hoặc bản trích xuất chưa rõ quyền phân phối. Nếu thiếu file, ghi rõ file và hash cần thiết; không thay bằng dữ liệu giả.
2. Sửa công cụ prepare để xử lý PDF scan bằng pipeline OCR riêng và tệp HCDC phức tạp bằng parser dự phòng PyMuPDF. OCR phải lưu bản nháp và ảnh trang để đối chiếu; không tự coi OCR là trích dẫn đã duyệt. Test case về OCR_REQUIRED, PAGE_COUNT_MISMATCH và fallback parser phải pass.
3. Hiệu đính từng đơn vị văn bản được chọn bằng ảnh trang gốc; ghi document_id, trang PDF, trang in, điều/mục, đoạn nguyên văn, hash PDF, người và ngày đối chiếu văn bản. Không index hàng 16 phụ lục QĐ 02 đang bị dấu che; giữ nguyên tình trạng không đọc được. Đối chiếu tiếp toàn bộ đơn vị WHO/HCDC cần dùng, kể cả câu hỏi 7 HCDC trải qua hai trang. Chỉ đưa đơn vị đã kiểm tra vào tập benchmark.
4. Đóng băng corpus và bộ câu hỏi dev/eval cùng âm tính khó, chống rò rỉ đơn vị trùng nghĩa giữa hai tập. Lưu version/hash, quy tắc tách, đánh giá Recall@k/MRR/citation precision và các ca cố tình hỏi ngoài phạm vi. Công bố cả lỗi và giới hạn.
5. Thiết kế route serving dùng retrieval với fail-closed: chỉ trích dẫn đơn vị có nguồn, trang, nguyên văn và trạng thái được phép; không để LLM tự tạo source_url, document_id hoặc quote. Đồng bộ OpenAPI/Go/TS nếu schema đổi. Guardrail B2G vẫn phải từ chối căn cứ thiếu hoặc chưa được duyệt. Nếu không có phê duyệt pháp lý/chuyên môn, giữ runtime danh mục citation tĩnh hiện tại và báo rõ là chưa thể bật RAG cho B2G. Có thể bật endpoint benchmark độc lập, gắn nhãn nghiên cứu, nếu an toàn.
6. Chạy toàn bộ quality gate trong skill: contracts, dashboard format/lint/typecheck/depcruise/Vitest/build/E2E, backend vet/test, Python Ruff/Black/Mypy/import-linter/Pytest và Docker local integration. Không sửa tests để che lỗi. Cập nhật README và competition-readiness.md theo năng lực thực tế, không tuyên bố nguồn dữ liệu hay phê duyệt chưa có.

Chỉ commit/push khi toàn bộ phần được triển khai đã được kiểm thử. Không merge PR. Nếu cần người có thẩm quyền xác nhận quyền phân phối, hiệu lực pháp lý hoặc tính đúng chuyên môn, ghi chính xác tài liệu, đơn vị văn bản và quyết định cần họ cung cấp; tiếp tục làm phần độc lập.
```

## Prompt yêu cầu báo cáo lại

```text
Hãy báo cáo cho CodeX bằng bằng chứng có thể kiểm tra: branch/commit SHA; các file đã đổi; SHA-256 và số trang từng PDF; số đơn vị OCR thô/đã hiệu đính/đã được chuyên gia duyệt; corpus version/hash; dev/eval split và metric kèm số truy vấn; trạng thái legal_status/professional_review thực tế; sơ đồ luồng serving và cơ chế fail-closed; câu trả lời rõ B2G đã dùng RAG runtime hay vẫn dùng danh mục tĩnh; lệnh quality gate và kết quả từng tầng; URL PR/checks; các việc còn cần người duyệt hoặc cung cấp. Đừng chỉ ghi “100% pass” nếu không có lệnh, số test và commit tương ứng.
```
