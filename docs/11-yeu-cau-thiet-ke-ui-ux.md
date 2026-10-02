# Tài Liệu Yêu Cầu Thiết Kế Giao Diện (UI/UX) - DengueSense

Tài liệu này cung cấp đặc tả chi tiết các màn hình (Screens), tính năng (Features) và luồng người dùng (User Flows) của hệ thống DengueSense. Mục tiêu là để Design Team (UI/UX Designer) có bức tranh toàn cảnh nhằm thiết kế bản prototype/Figma hoàn chỉnh, chính xác với logic của Backend và định hướng của dự án.

---

## 1. Tổng quan Hệ thống & Vai trò Người dùng

**DengueSense** là hệ thống hỗ trợ ra quyết định y tế công cộng (Sốt xuất huyết) dựa trên AI. Hệ thống có 3 cấp độ tính năng (tương ứng 3 Layer AI):
1. **Layer 1 (Dự báo):** Bản đồ rủi ro, dự báo ca mắc.
2. **Layer 2 (Phân bổ):** Tối ưu hóa nguồn lực phòng dịch.
3. **Layer 3 (Soạn thảo):** Tự động sinh văn bản chỉ đạo (B2G/B2B) với AI.

### Các vai trò (Roles):
- **Viewer (Cán bộ xem báo cáo):** Chỉ xem bản đồ, số liệu, không thao tác nghiệp vụ.
- **Analyst (Chuyên viên phân tích):** Xem số liệu, mô hình, quản lý các lượt chạy dự báo (chạy lại lịch sử - backtest).
- **Officer (Cán bộ xử lý):** Tiếp nhận cảnh báo, tạo hồ sơ, chạy thuật toán phân bổ nguồn lực, yêu cầu AI soạn dự thảo văn bản.
- **Approver (Lãnh đạo):** Xem, chỉnh sửa, từ chối hoặc phê duyệt (duyệt/ký) dự thảo văn bản để phát hành.

---

## 2. Bố cục chung (Console Layout)

Thiết kế nhắm tới màn hình **Desktop (≥ 1280px)** là chủ đạo, phục vụ công việc văn phòng phức tạp.

- **Thanh điều hướng (Sidebar/Top Nav):**
  - Chứa Logo DengueSense.
  - Các menu chính: Bản đồ rủi ro, Lượt dự báo, Cảnh báo & Hồ sơ, Dự thảo chờ duyệt, Thư viện Mô hình.
  - Hiển thị người dùng hiện tại, Role, Nút Đăng xuất.
- **Thanh trạng thái chung (Global Banner):** 
  - Hiển thị chế độ dữ liệu hiện tại (VD: Cảnh báo chữ màu vàng: *"Đang xem dữ liệu quá khứ (Backtest) gốc Tháng 03/2010"*).
- **Khu vực nội dung (Main Content):** Hiển thị màn hình chi tiết.

---

## 3. Đặc tả Chi tiết Các Màn Hình (Screens)

### S2: Bản đồ rủi ro (Risk Map) - Màn hình chính
*Mục đích: Cung cấp cái nhìn tổng quan về tình hình dịch bệnh của 34 tỉnh thành.*
- **Bộ lọc / Điều khiển:**
  - Chọn Lượt dự báo (Mặc định là mới nhất).
  - Chọn Tầm dự báo (Horizon): 1 tháng, 2 tháng, 3 tháng, 6 tháng tới.
  - Chế độ hiển thị: Tô màu theo *Xác suất vượt ngưỡng (Exceed Prob)* hoặc *Số ca dự báo / 100k dân*.
- **Bản đồ (Map View):**
  - Bản đồ Việt Nam (34 tỉnh thành trọng điểm).
  - Tô màu theo mức độ (Legend: Xanh, Vàng, Cam, Đỏ).
  - **Trạng thái đặc biệt:** Tỉnh nào đang có **Cảnh báo (Alert) mở** sẽ có viền sáng/đậm để gây chú ý.
  - Hover vào tỉnh: Hiển thị Tooltip tóm tắt (Tên tỉnh, Số ca dự báo, Tỉ lệ chuẩn/Base rate).
  - Click vào tỉnh: Chuyển sang màn hình **S3 (Chi tiết tỉnh)**.
- **Chế độ bảng (Table View):** 
  - Hiển thị song song hoặc tab chuyển đổi với Bản đồ (dành cho người thích nhìn số liệu). Xếp hạng rủi ro từ cao xuống thấp.

### S3: Chi tiết Tỉnh (Province Detail)
*Mục đích: Hiển thị sâu dữ liệu của 1 tỉnh cụ thể, minh bạch hóa lý do AI đưa ra dự báo.*
- **Tổng quan:** Tên tỉnh, Mức cảnh báo hiện tại.
- **Biểu đồ chuỗi thời gian (Time-series Chart):**
  - Trục X: Thời gian (Các tháng trong quá khứ + Tương lai).
  - Trục Y: Số ca mắc.
  - Đường line 1: Dữ liệu lịch sử (Thực tế).
  - Đường line 2: Dữ liệu dự báo (Tương lai).
  - Đường/Khu vực nền (Base rate): Mức độ dịch bệnh trung bình của tỉnh đó trong lịch sử (để người dùng có hệ quy chiếu).
- **Yếu tố ảnh hưởng (SHAP/Explainability):**
  - Biểu đồ Bar chart nằm ngang thể hiện các yếu tố thúc đẩy dịch (VD: Lượng mưa tháng trước, Nhiệt độ, Mật độ dân số) tác động bao nhiêu % tới dự báo.
- **Lưu ý UI:** Có cờ cảnh báo nếu mô hình dự báo "có khả năng bùng dịch bị dự báo thấp" (outbreak underprediction risk).

### S4 & S5: Quản lý Dự báo & Mô hình (Forecast & Model)
*Mục đích: Cho Analyst thấy độ tin cậy của hệ thống.*
- **Lượt dự báo (S4):** Bảng danh sách các lần hệ thống chạy AI (Thời gian chạy, Trạng thái: Thành công/Thất bại, Nút "Chạy lại/Backtest").
- **Thẻ mô hình (S5 - Model Card):** 
  - Trang tài liệu giới thiệu về phiên bản AI hiện tại.
  - Phải có phần **Giới hạn (Limitations)** (VD: "Mô hình có xu hướng dự báo thấp hơn thực tế khi có biến chủng mới"). Giao diện cần làm nổi bật sự minh bạch này.

### S6: Cảnh báo (Alerts)
*Mục đích: Liệt kê các vùng rủi ro do AI tự động phát hiện, chờ con người xác nhận.*
- **Bảng Cảnh báo:**
  - Danh sách tỉnh có nguy cơ cao (Exceed Prob ≥ ngưỡng).
  - Nút hành động: "Xác nhận đã xem" (Acknowledge) hoặc "Tạo hồ sơ xử lý".
- **Bộ lọc:** Theo khu vực (Bắc/Trung/Nam), Theo trạng thái (Mở/Đã đóng).

### S7: Hồ sơ Xử lý (Cases)
*Mục đích: Nơi Officer gom các cảnh báo lại để xử lý chung (VD: Hồ sơ phòng dịch tháng 10 khu vực phía Nam).*
- **Chi tiết Hồ sơ:** 
  - Tên hồ sơ, Trạng thái (Đang mở, Đã chốt phương án, Đang trình duyệt, Hoàn tất).
  - Danh sách các tỉnh/cảnh báo được đính kèm vào hồ sơ này.
- Màn hình này là "Hub" để dẫn tới **S8 (Phân bổ)** và **S9 (Soạn dự thảo)**.

### S8: Phân bổ Nguồn lực (Allocation) - Layer 2
*Mục đích: Thay vì dàn trải nguồn lực, AI gợi ý nơi rót tiền/nhân lực hiệu quả nhất để giảm số ca mắc lớn nhất.*
- **Input (Form nhập liệu):**
  - Tổng ngân sách / Tổng nhân lực có sẵn (VD: 1 tỷ VNĐ hoặc 500 cán bộ).
- **Kết quả Tối ưu (AI Output):**
  - Bảng danh sách các tỉnh được nhận nguồn lực và **Số lượng phân bổ**.
  - **Trường Giải thích (Lý do):** VD: "Được phân bổ 200tr vì hiệu quả giảm ca mắc tại đây cao gấp 3 lần khu vực khác".
  - Nút "Chốt phương án" (Lưu lại vào hồ sơ S7).

### S9: Dự thảo & Duyệt (Drafts & Review) - Layer 3
*Mục đích: Giao diện làm việc với GenAI để tự động hóa việc viết báo cáo, công điện.*
- **Bước 1: Soạn thảo (Dành cho Officer):**
  - Chọn loại văn bản: Báo cáo chuyên môn (B2B) hoặc Công điện chỉ đạo (B2G).
  - Nút "AI Sinh văn bản".
  - **Khu vực Editor:** Văn bản sinh ra nằm trong text editor (giống Word/Google Docs) để Officer có thể sửa thủ công.
  - **Khung Guardrails (Kiểm soát AI):** Bên phải hoặc bên dưới editor, có một bảng các "Checklist An Toàn" do hệ thống tự quét:
    - ✅ Không chẩn đoán bệnh cá nhân.
    - ✅ Số liệu khớp với dự báo (Layer 1).
    - ❌ Cảnh báo: Giọng văn quá gây hoang mang. (Yêu cầu AI viết lại).
- **Bước 2: Phê duyệt (Dành cho Approver):**
  - Lãnh đạo vào xem dự thảo. 
  - Giao diện có 3 nút to, rõ ràng: **Phê duyệt (Approve)**, **Yêu cầu sửa lại (Request Changes)**, **Từ chối (Reject)**.

### S10: Trạng thái Gửi lệnh (Dispatch Status)
- Theo dõi lịch sử văn bản đã được duyệt và gửi đi (Gửi qua Email / Hệ thống HIS của bệnh viện).
- Bảng log: Tên văn bản, Nơi nhận, Trạng thái (Đã gửi, Lỗi, Đang gửi lại).

---

## 4. Chú ý Quan trọng dành cho Design Team

1. **Hiển thị Rủi ro ≠ Hoảng sợ:** 
   - Màu sắc cảnh báo (Đỏ/Cam) cần dùng có chừng mực, không gây cảm giác "tận thế".
   - Luôn hiển thị **Base rate (Mức nền/Trung bình lịch sử)** cạnh các con số rủi ro để người xem có góc nhìn tương quan. Nhấn mạnh việc không bao giờ trình bày số liệu rủi ro mà không có Base Rate đi kèm.
2. **Minh bạch AI (Explainability):**
   - Thiết kế cần có chỗ (Tooltip, Text nhỏ, Icon ℹ️) cho các dòng giải thích: "Vì sao AI đưa ra con số này?".
   - Không được trình bày kết quả AI như một "chân lý tuyệt đối". Luôn có từ khóa "Dự báo", "Khuyến nghị".
3. **Dữ liệu giả lập (Mock data) / Nhãn dán:**
   - Khi thiết kế cần phân biệt rõ dữ liệu `Thực tế` (Nét liền) và `Ước lượng/Dự báo` (Nét đứt/hoa văn) để tránh nhầm lẫn. Không bao giờ để dữ liệu mô phỏng trông giống dữ liệu thực.
4. **Phân bổ không gian:**
   - Màn hình Bản đồ (S2) và Soạn thảo (S9) cần nhiều không gian nhất. Hãy cân nhắc tính năng "Collapse/Thu gọn" thanh Sidebar ở các màn hình này.
5. **Data States (Trạng thái dữ liệu):**
   - Nhớ thiết kế trạng thái Empty (Chưa có dữ liệu), Loading (AI đang chạy - có thể mất 10-30s), và Error (Không gọi được API, Hiển thị khối cảnh báo nhỏ thay vì sập toàn trang).
