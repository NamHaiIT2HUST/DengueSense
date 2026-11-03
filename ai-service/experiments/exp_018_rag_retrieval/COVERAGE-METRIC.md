# Độ phủ unit khi đánh giá retrieval

Phiên bản: `source-span-coverage-v1`; evaluator ghi giá trị này trong kết quả. Phiên bản cũ dựa trên unit ID không có trường phiên bản và không so sánh trực tiếp được với kết quả này.

Corpus và nhãn v0.1 giữ nguyên. Mỗi chunk ghi các khoảng ký tự `[start, end)` trong văn bản gốc của từng unit. Offset là chỉ số ký tự Python trên văn bản unit đã khóa; không tính tiêu đề hoặc nội dung thêm vào chunk nếu không có khoảng tương ứng trong unit.

Trong top-k, hợp các khoảng của từng unit; phần chồng lặp chỉ tính một lần. Một unit liên quan chỉ được tính là tìm đủ khi hợp khoảng phủ toàn bộ văn bản unit, không có khoảng thiếu. Recall là tỷ lệ unit liên quan đã phủ đủ. Reciprocal rank là nghịch đảo hạng đầu tiên mà các chunk từ đầu danh sách đến hạng đó phủ đủ một unit liên quan; không có unit nào đủ thì bằng 0. MRR là trung bình trên các câu có đáp án. Noise vẫn tính tỷ lệ chunk không gắn unit liên quan, không đồng nghĩa chunk đó chứa đủ căn cứ.

Đây là tiêu chí bảo thủ cho nhãn cấp unit: có thể đánh giá thấp một mảnh thực sự đủ trả lời. Phủ đủ văn bản cũng không tự xác nhận tính chính xác chuyên môn. Mapping phải được tạo từ văn bản gốc và kiểm lại khi chia; không suy ra độ phủ từ unit ID. Corpus và bộ nhãn không thay đổi; rà chuyên môn vẫn pending.
