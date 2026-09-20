# 00 — Review hiện trạng dự án

Rà soát bản thuyết minh đề án DengueSense (bản 15/08/2026) dưới góc nhìn kỹ thuật, trước khi khởi động code. Mục đích: xác định cái gì chắc, cái gì đang là giả định, và cái gì phải sửa trước khi đưa ra hội đồng.

---

## A. Những điểm đã vững

| Hạng mục | Nhận xét |
|---|---|
| Định vị sản phẩm | "Khép kín dự báo → tối ưu → ra lệnh" là điểm khác biệt thật so với D-MOSS (chỉ dừng ở dự báo). Đây là luận điểm bán hàng mạnh nhất và cũng là cái hội đồng sẽ hỏi kỹ nhất. |
| Human-in-the-loop | Đúng hướng cả về pháp lý lẫn kỹ thuật. Giữ nguyên, đừng vì muốn "AI tự động hoàn toàn" nghe kêu hơn mà bỏ. |
| Chọn ML cổ điển thay vì deep learning | Hợp lý với quy mô dữ liệu (xem mục C.4). Là lựa chọn đúng, không phải điểm yếu — cần biết cách bảo vệ luận điểm này trước hội đồng. |
| Tách kênh B2G / B2B | Phản ánh đúng thực tế chu kỳ bán hàng. Kiến trúc kỹ thuật (đa tenant) cần hỗ trợ từ đầu. |

---

## B. Rủi ro phải xử lý ngay (chặn tiến độ nếu không giải quyết)

### B.1 — Chưa có dữ liệu ca bệnh thật ⚠️ RỦI RO SỐ 1

Bản thuyết minh tự ghi nhận: *"nhóm chưa có quyền truy cập chính thức vào dữ liệu ca bệnh chi tiết theo khu vực của HCDC/Bộ Y tế"*, và con số 89.5% được train trên *"dữ liệu công khai kết hợp một phần dữ liệu mô phỏng"*.

**Hệ quả:** toàn bộ luận điểm kỹ thuật đang đứng trên dữ liệu một phần giả lập. Nếu hội đồng hoặc bên tài trợ hỏi "dữ liệu mô phỏng chiếm bao nhiêu %, sinh bằng cách nào", cần trả lời được ngay.

**Xử lý:**
- Song song 2 đường: (A) gửi công văn xin dữ liệu chính thức qua kênh GVHD/Khoa; (B) dựng pipeline trên nguồn công khai có thật (chi tiết ở [01-chien-luoc-du-lieu.md](01-chien-luoc-du-lieu.md)).
- Đường B phải đủ tốt để đứng một mình. Không lên kế hoạch dựa trên giả định "sẽ xin được dữ liệu".
- Mọi số liệu báo cáo phải ghi rõ nguồn: *thực* hay *mô phỏng*. Không trộn hai loại vào một con số duy nhất rồi báo cáo chung.

### B.2 — Cải cách hành chính 2025 làm vỡ đơn vị không gian ⚠️ CHƯA AI XỬ LÝ

Nghị quyết 202/2025/QH15 (hiệu lực 01/7/2025): cả nước còn **34 tỉnh/thành**, **cấp huyện chấm dứt hoạt động**, còn 3.321 đơn vị cấp xã.

Trong khi đó bản thuyết minh:
- Dùng dữ liệu lịch sử 2001–2024 → nằm trong ranh giới **63 tỉnh / ~700 quận-huyện cũ**
- Tính toán và pitch trên **"570 quận/huyện"** → đơn vị hành chính **không còn tồn tại**
- Triển khai thực tế lại ở **34 tỉnh mới**

Ba hệ quy chiếu không gian khác nhau trong cùng một đề án.

**Xử lý:** xây bảng ánh xạ (crosswalk) giữa đơn vị cũ và mới là **task bắt buộc của Phase Dữ liệu**, không phải việc phụ. Quyết định đơn vị phân tích chuẩn (khuyến nghị: **tỉnh mới - 34 đơn vị** cho MVP, xã cho giai đoạn sau khi có dữ liệu). Xem [01-chien-luoc-du-lieu.md §3](01-chien-luoc-du-lieu.md#3-chuẩn-hoá-đơn-vị-không-gian-bắt-buộc-làm-trước).

### B.3 — Mâu thuẫn số liệu nội bộ trong bản thuyết minh

| Chỗ | Nói gì | Chỗ khác | Nói gì |
|---|---|---|---|
| Mục 5 (Layer 2) | Giải 570 quận/huyện *"khoảng 1 phút"* | Mục TRL 5 | *"thời gian xử lý < 1 giây"* |
| Mục 5 (Layer 1) | Dữ liệu *"2001-2024"* | Mục TRL 5 | Dữ liệu *"2001-2026"* |
| Tóm tắt | Dự báo sớm *"30-60 ngày"* | Mục 5 | Cảnh báo sớm *"1 đến 6 tháng"* |

Hội đồng đọc kỹ sẽ thấy. **Phải chốt một con số duy nhất cho mỗi chỉ tiêu và sửa đồng bộ toàn văn bản** trước khi nộp bản tiếp theo. Con số nào chưa đo lại được theo quy trình ở [02](02-phuong-phap-mo-hinh.md) thì tạm bỏ, đừng giữ.

---

## C. Nhận xét kỹ thuật cần điều chỉnh

### C.0 — Con số 89.5% không sống nổi khi đặt cạnh tài liệu 🚨 MỚI

Khảo sát tài liệu ([06 §2.1](06-khao-sat-tai-lieu.md#21-luận-điểm-dự-báo-chính-xác-hơn-đã-chết)) cho kết quả:

| Hệ thống | Con số | Dữ liệu |
|---|---|---|
| **D-MOSS** (đang chạy tại VN, 63 tỉnh) | **0.83 – 0.94** | Thật, vận hành từ 2019 |
| **EWARS** (WHO) | Recall 97% / Precision 68% | Thật, Mexico |
| **Ensemble ĐBSCL** (PLOS NTD 2025, cấp huyện VN) | **69% @ 3 tháng** | Thật, bình duyệt |
| **DengueSense** | 89.5% precision | Một phần mô phỏng |

Hai hệ quả:
1. **89.5% nằm gọn trong khoảng của D-MOSS** → không thể tuyên bố "chính xác hơn D-MOSS".
2. **89.5% cao hơn hẳn 69% của nghiên cứu bình duyệt cùng nước cùng cấp** → con số càng vượt chuẩn tham chiếu càng dễ bị nghi do rò rỉ dữ liệu hoặc do phần mô phỏng. Nguy hiểm trước hội đồng chuyên môn.

**Xử lý:** bỏ cạnh tranh trên độ chính xác dự báo. Đặt mục tiêu **ngang D-MOSS/ĐBSCL là đủ**, chuyển khác biệt sang K1–K5 ở [06 §3](06-khao-sat-tai-lieu.md#3-năm-khác-biệt-thật-sự--định-vị-mới).

### C.0b — Phát biểu về EWARS đang sai 🚨 MỚI

Đề án nói *"các giải pháp hiện có chỉ dừng ở dự báo, không có hành động"*. Đúng với D-MOSS, **sai với EWARS** — EWARS đã có action plan theo response protocol địa phương. Phải phát biểu lại chính xác ([06 §2.2](06-khao-sat-tai-lieu.md#22-luận-điểm-chỉ-có-chúng-tôi-có-hành-động-cần-phát-biểu-lại)), nếu không sẽ bị bắt lỗi.

### C.1 — "Precision 89.5%" chưa đủ để diễn giải

Với bài toán cảnh báo bùng dịch, sự kiện dương tính là **hiếm**. Precision đứng một mình có thể được đẩy lên cao một cách vô nghĩa bằng cách cảnh báo rất ít lần (cảnh báo 10 lần, đúng 9 → precision 90%, nhưng bỏ lọt 200 đợt dịch khác).

**Một con số precision không kèm những thứ sau là không diễn giải được:**
- **Recall** — bỏ lọt bao nhiêu đợt bùng dịch? (với y tế công cộng, đây mới là chỉ số quan trọng hơn)
- **Base rate** — tỉ lệ tháng-khu vực thực sự vượt ngưỡng là bao nhiêu? Nếu base rate là 25% thì precision 89.5% mới ấn tượng; nếu là 80% thì đoán bừa "luôn có dịch" đã cho precision 80%.
- **Horizon** — 89.5% ở horizon nào? 1 tháng hay 6 tháng? Độ chính xác luôn giảm theo horizon, báo cáo một con số gộp là che mất điều đó.
- **So với baseline** — seasonal naive (lấy đúng tháng này năm ngoái) đạt bao nhiêu?

**Xử lý:** đo lại đầy đủ theo [02-phuong-phap-mo-hinh.md §5](02-phuong-phap-mo-hinh.md#5-bộ-chỉ-số-đánh-giá). Báo cáo dạng bảng precision/recall/F1 theo từng horizon kèm base rate, không dùng một con số gộp.

### C.2 — Layer 2: vừa over-engineering, vừa tối ưu sai đại lượng ⚠️ ĐIỂM CẦN QUYẾT ĐỊNH

> 🚨 **Cập nhật sau khảo sát tài liệu:** ngoài vấn đề over-engineering nêu dưới đây, Layer 2 còn có vấn đề nghiêm trọng hơn — **đang tối ưu sai đại lượng**. `max Σ Rᵢ·xᵢ` là xếp hạng theo rủi ro, trong khi cái cần tối ưu là **số ca giảm được** `ΔCasesᵢ(xᵢ)`. Rủi ro cao ≠ can thiệp ở đó hiệu quả nhất. Xem [06 §3 K1](06-khao-sat-tai-lieu.md#-k1--phân-bổ-theo-lợi-ích-cận-biên-không-phải-theo-xếp-hạng-rủi-ro) và [04 §1](04-phuong-phap-toi-uu.md#1-vấn-đề-nền-tảng-đang-tối-ưu-sai-đại-lượng-️). Sửa điều này vừa đúng khoa học hơn, vừa tạo ra khác biệt cạnh tranh thật.

Bài toán trong đề án:

```
max Z = Σ Rᵢ·xᵢ − λ Σ Cᵢ·xᵢ      với  xᵢ ∈ {0,1}
s.t.   Σ Cᵢ·xᵢ ≤ B
```

Đây chính xác là **bài toán cái túi 0-1 (0-1 knapsack)** với hàm mục tiêu tuyến tính. Với N = 570 biến nhị phân, một biến ràng buộc:

- CP-SAT / SCIP (OR-Tools) giải **tối ưu chứng minh được** trong **mili-giây**, không phải 1 phút.
- Simulated Annealing và Tabu Search trong trường hợp này là **thừa** — chúng là metaheuristic dùng khi bài toán quá lớn/phi tuyến để giải chính xác. Ở đây dùng chúng cho kết quả *tệ hơn hoặc bằng* MILP nhưng lại *không chứng minh được tối ưu*.

**Đây thực ra là tin tốt và nên tận dụng:** "chúng tôi giải **tối ưu chứng minh được** trong dưới 1 giây" là luận điểm **mạnh hơn** "chúng tôi dùng thuật toán metaheuristic". Không nên giữ SA/TS chỉ vì nghe có vẻ phức tạp.

**Hai lựa chọn — phải chọn một:**

| Phương án | Nội dung | Đánh giá |
|---|---|---|
| **P1 — Giữ formulation đơn giản** | Bỏ SA/TS, dùng MILP exact, đổi thông điệp thành "tối ưu chứng minh được, < 1s" | ✅ Khuyến nghị cho MVP. Trung thực, dễ bảo vệ, đỡ 1-2 tuần công sức |
| **P2 — Làm bài toán giàu hơn** | Thêm đa tài nguyên (giường/vật tư/nhân lực), đa kỳ (rolling horizon), ràng buộc công bằng giữa vùng, tuyến vận chuyển | Bài toán thực sự khó lên → lúc đó metaheuristic mới có lý do tồn tại. Nhưng tốn thời gian, để Phase sau |

Chi tiết ở [04-phuong-phap-toi-uu.md](04-phuong-phap-toi-uu.md).

### C.3 — Tuyên bố TRL 5 đang hơi quá tay

TRL 5 = "công nghệ được kiểm chứng trong **môi trường liên quan** (relevant environment)". Hiện tại: dữ liệu một phần mô phỏng, chưa có người dùng thật, chưa triển khai ở bất kỳ đơn vị y tế nào.

Đánh giá thực tế: **TRL 3–4** (kiểm chứng trong phòng thí nghiệm). Lên TRL 5 khi có pilot thật ở 1 bệnh viện/CDC với dữ liệu thật.

**Xử lý:** hạ xuống TRL 4 và ghi rõ điều kiện để lên TRL 5. Trong các cuộc thi có hội đồng chuyên môn, tuyên bố khiêm tốn nhưng có bằng chứng thường được đánh giá cao hơn tuyên bố cao mà bị hỏi vặn không trả lời được.

### C.4 — Quy mô dữ liệu quyết định lựa chọn model

Ước lượng dữ liệu khả dụng:

| Đơn vị phân tích | Số chuỗi | Điểm/chuỗi (24 năm × 12 tháng) | Tổng dòng |
|---|---|---|---|
| 34 tỉnh mới | 34 | 288 | ~9.800 |
| 63 tỉnh cũ | 63 | 288 | ~18.100 |
| ~700 huyện cũ | 700 | 288 | ~201.000 |

**Hệ quả:**
- Mô hình **per-district** (mỗi khu vực một model riêng): 288 điểm/chuỗi là **quá ít** cho deep learning, thậm chí ít cho cả gradient boosting nhiều feature. Rất dễ overfit.
- Mô hình **global pooled** (một model học chung toàn bộ khu vực, thêm district ID / đặc trưng vùng làm feature): đây là hướng đúng. Với ~200k dòng ở cấp huyện, gradient boosting hoạt động tốt.
- Deep learning (LSTM/TFT): **nên thử nhưng đừng đặt cược**. Ở quy mô này, tree ensemble thường thắng. Nếu LSTM thắng thì tốt, nhưng cần đủ thời gian; xếp vào Tier 2.

### C.5 — Độ trễ báo cáo chưa được tính đến

Bản thuyết minh nêu quy trình báo cáo hiện tại có độ trễ **2–4 tuần**. Nghĩa là khi hệ thống chạy thật ở thời điểm `t`, nó **chưa có** số ca của tháng `t`, thậm chí chưa chắc có đủ tháng `t−1`.

Nếu khi train và backtest lại cho model "nhìn thấy" số ca đến tận tháng `t`, kết quả sẽ đẹp giả tạo và **sụp khi deploy thật**. Đây là dạng rò rỉ dữ liệu (data leakage) phổ biến nhất trong dự báo dịch tễ.

**Xử lý:** mô phỏng đúng độ trễ trong backtest. Chi tiết ở [01-chien-luoc-du-lieu.md §6](01-chien-luoc-du-lieu.md#6-các-bẫy-rò-rỉ-dữ-liệu-phải-tránh).

### C.6 — Chưa có chiến lược cho khu vực mới / không có lịch sử

Luận điểm kinh doanh là "nhân rộng sang tỉnh mới và ASEAN với chi phí biên gần 0". Nhưng về kỹ thuật: model train trên dữ liệu TP.HCM có chạy được ở một tỉnh chưa từng có trong tập train không?

Phải chứng minh bằng thực nghiệm (**leave-one-province-out**), không thể chỉ nói. Đây vừa là yêu cầu kỹ thuật vừa là bằng chứng cho luận điểm gọi vốn. Xem [02-phuong-phap-mo-hinh.md §4.3](02-phuong-phap-mo-hinh.md#43-kiểm-tra-khái-quát-hoá-không-gian-leave-one-province-out).

---

## D. Việc phải làm trước khi nộp bản thuyết minh tiếp theo

- [ ] 🚨 Bỏ/thay con số 89.5%, đặt mục tiêu theo chuẩn tài liệu ([06 §6](06-khao-sat-tai-lieu.md#6-mục-tiêu-hiệu-năng--đặt-lại-cho-thực-tế)) 🧬
- [ ] 🚨 Sửa phát biểu sai về EWARS 🤝
- [ ] 🚨 Viết lại Layer 2 theo lợi ích cận biên thay vì xếp hạng rủi ro 🧬
- [ ] Bổ sung K3 (địa giới mới 2025) và K4 (quyết định dưới bất định) vào mục Lợi thế cạnh tranh / Tính mới 🤝
- [ ] Thay bảng so sánh đối thủ định tính bằng bảng có số liệu thật ([06 §1](06-khao-sat-tai-lieu.md#1-các-hệ-thốngnghiên-cứu-liên-quan)) 🤝
- [ ] Thống nhất một con số duy nhất cho: horizon dự báo, runtime Layer 2, khoảng thời gian dữ liệu 🤝
- [ ] Quyết định P1/P2/P3 cho Layer 2 (khuyến nghị **P2**) 🤝
- [ ] Hạ TRL 5 → TRL 4, ghi rõ điều kiện lên TRL 5 🤝
- [ ] Thay "precision 89.5%" bằng bảng precision/recall/F1 theo horizon + base rate + baseline, đo theo quy trình ở [02](02-phuong-phap-mo-hinh.md) 🧬
- [ ] Chốt đơn vị phân tích chuẩn (khuyến nghị: 34 tỉnh mới cho MVP) 🤝
- [ ] Bỏ phần còn sót nhắc tên dự án cũ *"QuantumShield Health"* ở mục Demo 🤝
