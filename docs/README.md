# Tài liệu kỹ thuật DengueSense

Bộ tài liệu này là **phương pháp luận chuẩn** của dự án — đọc trước khi bắt tay vào code hoặc train model. Mục tiêu: mọi con số đưa ra hội đồng / hồ sơ tài trợ đều có quy trình tái lập được đứng sau, không phải số chạy một lần rồi chép lại.

## Đọc theo thứ tự

| # | Tài liệu | Nội dung | Ai cần đọc |
|---|---|---|---|
| 00 | [Review hiện trạng](00-review-hien-trang.md) | Rà soát bản thuyết minh: điểm mạnh, rủi ro, mâu thuẫn số liệu cần sửa | 🤝 Cả hai + PO |
| 01 | [Chiến lược dữ liệu](01-chien-luoc-du-lieu.md) | Nguồn dữ liệu, thu thập, ranh giới hành chính, versioning, thiết kế chia tập | 🤝 Cả hai |
| 02 | [Phương pháp mô hình (Layer 1)](02-phuong-phap-mo-hinh.md) | Model zoo, tuning, ensemble, calibration, metric, cổng quyết định | 🧬 Minh Dương |
| 03 | [Quy trình thực nghiệm](03-quy-trinh-thuc-nghiem.md) | Cách chạy/ghi nhận thí nghiệm, tracking, tái lập, báo cáo | 🤝 Cả hai |
| 04 | [Phương pháp tối ưu (Layer 2)](04-phuong-phap-toi-uu.md) | Formulation, so sánh solver, đánh giá dưới bất định | 🧬 Minh Dương |
| 05 | [Phương pháp GenAI RAG (Layer 3)](05-phuong-phap-genai-rag.md) | Kiến trúc RAG, guardrail, bộ đánh giá | 🤝 Cả hai |
| 06 | [**Khảo sát tài liệu & Định vị khác biệt**](06-khao-sat-tai-lieu.md) | ⭐ Benchmark thật từ D-MOSS/EWARS/PLOS NTD, 5 khác biệt K1–K5, **chốt model & tuning** | 🤝 Cả hai |

> ⚠️ **Đọc [06](06-khao-sat-tai-lieu.md) sớm.** Khảo sát tài liệu cho thấy luận điểm "dự báo chính xác hơn" không đứng vững được, và Layer 2 đang tối ưu sai đại lượng. Doc 06 chốt lại định vị sản phẩm, danh sách model (cắt từ 10 xuống 4+2) và phương pháp tuning (cắt từ 4 xuống 2+1).

Kế hoạch triển khai theo thời gian: [../ROADMAP.md](../ROADMAP.md)
Quy tắc code & git: [../CONTRIBUTING.md](../CONTRIBUTING.md)

## Ba nguyên tắc xuyên suốt

1. **Không có baseline thì không có kết quả.** Mọi con số accuracy/precision chỉ có nghĩa khi đặt cạnh baseline ngây thơ (seasonal naive). Model phức tạp không thắng được "tháng này năm ngoái" thì kết quả thật là *baseline thắng*, và phải báo cáo đúng như vậy.
2. **Tập test chỉ được chạm một lần.** Mọi vòng thử nghiệm, tuning, chọn model đều diễn ra trên train/validation. Test là tập khoá, mở ra ở cổng quyết định cuối cùng. Chạm nhiều lần = số liệu lạc quan giả.
3. **Số nào đưa vào hồ sơ thì phải chạy lại được.** Mỗi con số trong slide/hồ sơ tài trợ phải truy được về một run ID trong MLflow, với commit hash + data version tương ứng.
