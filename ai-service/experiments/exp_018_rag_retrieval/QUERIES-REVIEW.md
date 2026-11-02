# Rà nhãn retrieval — corpus v0.1

Corpus: `corpus-v0.1.json`, SHA-256 `3a7cdd649f1f449b6c58923bc8c84899477ce08050442620bdd4c6198888a48a`, 43 units. Đây là corpus benchmark kỹ thuật; `professional_review: pending`. Người dùng đã rà 40 câu trên 43 units; Codex ghi nhận và rà nhãn kỹ thuật. Đây không phải rà chuyên môn độc lập.

## Quy tắc chấm

Relevant là unit chứa bằng chứng đủ để trả lời yêu cầu của câu hỏi. Unit chỉ cùng chủ đề hoặc cung cấp một phần thông tin không tự động được tính đúng. Nếu câu cần nhiều units để trả lời đầy đủ, phải gán đủ các units đó.

## Kết quả rà

- Giữ `answerable` của cả 40 câu; mỗi split có 15 câu có đáp án và 5 câu thiếu căn cứ hoặc ngoài phạm vi.
- Sửa cách hỏi của `draft-05`, `dev-08`, `dev-10`, `dev-14` và `eval-12` theo ý kiến review, giữ unit chính. Mỗi câu có `reason` riêng nêu bằng chứng hoặc lý do thiếu căn cứ.
- Bảy câu gốc `draft-01`–`draft-07`: giữ unit của năm câu dương; hai câu âm không có căn cứ trả lời trong 43 units. Kết luận chỉ áp dụng cho corpus này.
- Mười câu âm giữ `answerable: false`: corpus không có định mức, giá, tồn kho, dự báo cấp phường, dữ liệu bệnh nhân, giường trống, kinh phí cụ thể, danh sách trực hoặc runtime M2. Runtime có thể có tại nơi khác trong repo nhưng không nằm trong corpus retrieval.
- Không thấy paraphrase trùng nghĩa rõ ràng xuyên split theo rà soát; các câu WHO cùng chủ đề có thể hỏi khác nội dung hoặc giai đoạn. Các truy vấn tiếng Việt có nguồn WHO là truy hồi xuyên ngôn ngữ.
- `annotation_review: checked` và `annotation_reviewer: Codex — rà nhãn kỹ thuật` là kết quả rà nhãn kỹ thuật, không hàm ý chuyên môn được phê duyệt; mỗi dòng giữ `professional_review: pending`.

Kiểm tự động ID, group, số lượng và hash được thực hiện trước khi khóa; các kiểm tra đó không thay thế việc đọc nội dung nguồn.
