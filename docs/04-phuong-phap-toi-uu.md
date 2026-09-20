# 04 — Phương pháp tối ưu (Layer 2 — Phân bổ nguồn lực)

> Layer 2 biến kết quả dự báo thành quyết định hành động. Đây là phần tạo khác biệt lớn nhất với D-MOSS — và cũng là phần dễ làm quá tay nhất.

Đọc trước: [00 §C.2 — Layer 2 đang over-engineering](00-review-hien-trang.md#c2--layer-2-đang-over-engineering-️-điểm-cần-quyết-định).

---

## 1. Vấn đề nền tảng: đang tối ưu sai đại lượng ⚠️

> Đây là phát hiện quan trọng nhất từ khảo sát tài liệu. Đọc [06 §3 K1](06-khao-sat-tai-lieu.md#-k1--phân-bổ-theo-lợi-ích-cận-biên-không-phải-theo-xếp-hạng-rủi-ro) trước.

Formulation trong đề án là `max Σ Rᵢ·xᵢ` — nghĩa là **"đổ nguồn lực vào nơi rủi ro cao nhất"**. Nghiên cứu về phân bổ nguồn lực chống sốt xuất huyết ([dengue-allocator, Sri Lanka](https://github.com/Wicky2002/dengue-allocator)) chỉ ra điều này **sai về mặt nhân quả**:

> **Rủi ro cao ≠ can thiệp ở đó hiệu quả nhất.**

Một tỉnh có thể rủi ro rất cao nhưng can thiệp thêm gần như không giảm được ca nào (đã bão hoà nguồn lực, hoặc động lực lan truyền ở đó do yếu tố khác). Trong khi một tỉnh rủi ro trung bình lại có thể giảm được nhiều ca nhất trên mỗi đồng chi ra.

**Đại lượng cần tối ưu là số ca giảm được `ΔCasesᵢ(xᵢ)`, không phải điểm rủi ro `Rᵢ`.**

Điều này vừa làm sản phẩm **đúng hơn về khoa học**, vừa tạo ra **khác biệt cạnh tranh thật** (K1) — và, tình cờ, cũng là thứ khiến phần kỹ thuật tối ưu hoá trở nên đáng giá thật sự (xem §2.3).

---

## 2. Quyết định cần chốt trước khi code

Ba phương án, tăng dần độ đúng đắn và độ khó:

| | **P1 — Knapsack** | **P2 — Lợi ích cận biên** ⭐ khuyến nghị | **P3 — Đa tài nguyên, đa kỳ** |
|---|---|---|---|
| Tối ưu đại lượng | `Rᵢ` (điểm rủi ro) | **`ΔCasesᵢ(xᵢ)`** (số ca giảm được) | như P2 + nhiều loại tài nguyên, nhiều kỳ |
| Dạng toán | Knapsack 0-1 tuyến tính | **Phi tuyến lõm** có ràng buộc | MILP lớn / phi tuyến hỗn hợp |
| Solver | CP-SAT/SCIP, tối ưu chứng minh được | CP-SAT với xấp xỉ tuyến tính từng khúc, hoặc quy hoạch lồi | MILP + metaheuristic **(lúc này SA/Tabu mới có lý do thật)** |
| Thời gian làm | ~3 ngày | **~1 tuần** | ~3 tuần |
| Đúng về khoa học | ❌ Xếp hạng rủi ro, bị tài liệu bác | ✅ Đúng | ✅ Đúng |
| Thông điệp | "Tối ưu chứng minh được < 1s" | **"Tối ưu số ca cứu được, có tính lợi ích giảm dần"** | "Mô hình hoá đủ ràng buộc vận hành thực tế" |

**Khuyến nghị: P2 cho MVP.** Chỉ tốn hơn P1 khoảng 4 ngày nhưng:
- Sửa được lỗi khoa học mà hội đồng chuyên môn có thể bắt
- Tạo ra khác biệt K1 mà D-MOSS/EWARS không có
- Vẫn giải được nhanh (hàm lõm → xấp xỉ tuyến tính từng khúc cho MILP giải trong dưới 1 giây)

Vẫn cài P1 làm **baseline để so sánh** — cần chứng minh bằng số rằng P2 tốt hơn P1 bao nhiêu (§5).

### 2.3 Về Simulated Annealing / Tabu Search

Ở P1, SA và TS là **thừa** — knapsack 570 biến giải tối ưu chứng minh được trong mili-giây. Ở P2/P3 với hàm lõm và nhiều ràng buộc, chúng **bắt đầu có lý do tồn tại**.

→ **Quyết định:** giữ SA/TS trong kế hoạch nhưng chỉ như **đối chứng** ở §5, và chỉ nâng lên vai trò chính nếu P3 được triển khai. Không tuyên bố dùng metaheuristic khi bài toán chưa cần đến.

---

## 2b. Phát biểu bài toán chi tiết

### 2.1 P1 — Knapsack cơ sở (chỉ dùng làm baseline)

```
Biến:      xᵢ ∈ {0,1}    — có phân bổ nguồn lực cho khu vực i hay không
Mục tiêu:  max Z = Σᵢ Rᵢ·xᵢ − λ·Σᵢ Cᵢ·xᵢ
Ràng buộc: Σᵢ Cᵢ·xᵢ ≤ B
```

Trong đó `Rᵢ` = điểm rủi ro từ Layer 1, `Cᵢ` = chi phí hậu cần tới khu vực i, `B` = ngân sách, `λ` = hệ số đánh đổi.

⚠️ **Điểm cần làm rõ về mặt mô hình hoá:** khi đã có ràng buộc ngân sách `Σ Cᵢxᵢ ≤ B`, việc trừ thêm `λ·Σ Cᵢxᵢ` trong hàm mục tiêu là **dư thừa về mặt toán học** ở đa số trường hợp — nó chỉ làm solver bỏ qua những khu vực có tỉ lệ lợi ích/chi phí thấp ngay cả khi còn ngân sách. Cần quyết định rõ:
- Nếu mục tiêu là **tiêu hết ngân sách sao cho rủi ro giảm nhiều nhất** → bỏ `λ`, giữ ràng buộc.
- Nếu mục tiêu là **cân đối, không nhất thiết tiêu hết** → giữ `λ` và phải giải thích được ý nghĩa kinh tế của nó (λ = chi phí bao nhiêu thì đáng đổi lấy 1 đơn vị giảm rủi ro).

Đừng giữ cả hai chỉ vì công thức nhìn phức tạp hơn — hội đồng có người làm tối ưu sẽ hỏi.

### 2.2 P2 — Lợi ích cận biên ⭐ phương án khuyến nghị cho MVP

```
Biến:      xᵢ ∈ [0, xᵢᵐᵃˣ]    — mức nguồn lực phân bổ cho khu vực i (liên tục hoặc nguyên)

Mục tiêu:  max Σᵢ ΔCasesᵢ(xᵢ)
           với  ΔCasesᵢ(xᵢ) = Ĉasesᵢ · eᵢ · f(xᵢ)

Ràng buộc: Σᵢ Cᵢ·xᵢ ≤ B                    (ngân sách)
           xᵢ ≥ xᵢᵐⁱⁿ  ∀i ∈ HighRisk       (công bằng: khu vực rủi ro cao có mức sàn)
```

| Ký hiệu | Ý nghĩa | Lấy từ đâu |
|---|---|---|
| `Ĉasesᵢ` | Số ca dự báo tại khu vực i | Layer 1 |
| `eᵢ` | **Hiệu lực can thiệp** tại khu vực i (giảm được bao nhiêu % ca) | Ước lượng từ dữ liệu can thiệp lịch sử; nếu chưa có → dùng hằng số + **kiểm định độ nhạy** |
| `f(xᵢ)` | Hàm hiệu suất, **lõm** — ví dụ `1 − e^(−k·xᵢ)` | Tham số `k` hiệu chỉnh theo dữ liệu hoặc ý kiến chuyên gia |
| `Cᵢ` | Chi phí đơn vị nguồn lực tới khu vực i | Dữ liệu hậu cần |

**Vì sao hàm lõm là mấu chốt:** `f` lõm nghĩa là **gấp đôi nguồn lực không giảm gấp đôi ca bệnh**. Đây chính là hiệu ứng "lợi ích cận biên giảm dần" mà tài liệu nhấn mạnh — và cũng là lý do lời giải tối ưu **rải nguồn lực ra nhiều khu vực** thay vì dồn hết vào vài khu vực rủi ro cao nhất như P1 làm.

**Cách giải:** xấp xỉ tuyến tính từng khúc (piecewise-linear) hàm lõm → bài toán trở lại MILP, CP-SAT giải trong dưới 1 giây. Không cần metaheuristic.

⚠️ **`eᵢ` là điểm yếu cần trung thực:** nhóm hiện **chưa có dữ liệu hiệu lực can thiệp thực tế**. Phương án: giả định `eᵢ` bằng nhau giữa các khu vực ở MVP (khi đó P2 vẫn khác P1 nhờ hàm lõm), và **ghi rõ đây là giả định**, kèm phân tích độ nhạy cho thấy kết luận thay đổi thế nào khi `eᵢ` biến thiên ±30%. Thu thập `eᵢ` thật là mục tiêu của pilot.

### 2.3 P3 — Đa tài nguyên, đa kỳ (giai đoạn sau)

```
Biến:      xᵢᵣₜ ∈ ℤ≥0   — lượng tài nguyên loại r cho khu vực i ở kỳ t
Mục tiêu:  max Σ ΔCasesᵢₜ(Σᵣ wᵣ·xᵢᵣₜ) − chi phí vận chuyển
Ràng buộc: ngân sách theo kỳ và tổng · năng lực cung ứng mỗi loại
           công bằng · liên tục (không rút nguồn lực đang triển khai giữa chừng)
```

Đây là nơi bài toán **thực sự khó** và metaheuristic (SA/Tabu) có lý do tồn tại thật.

---

## 3. So sánh solver — 5 phương pháp

Tương tự §6 của [02](02-phuong-phap-mo-hinh.md), so sánh có kỷ luật trên cùng bộ bài toán:

| # | Phương pháp | Thư viện | Vai trò |
|---|---|---|---|
| S0 | **Xếp hạng rủi ro thuần** (P1) | numpy | ⭐ **Baseline quan trọng nhất** — đây là cách làm hiện tại của ngành. Cần chứng minh bằng số rằng P2 cứu được nhiều ca hơn (§5b) |
| S1 | **Greedy theo tỉ lệ ΔCases/C** | numpy | Baseline cho P2. Với hàm lõm, greedy cận biên thường rất gần tối ưu |
| S2 | **MILP — CP-SAT** (xấp xỉ tuyến tính từng khúc) | OR-Tools | ⭐ Ứng viên chính. Cho **chứng nhận tối ưu** trên bài toán đã xấp xỉ |
| S3 | **MILP — SCIP** | OR-Tools | Đối chứng cho S2, kiểm tra tính nhất quán |
| S4 | **Simulated Annealing** | tự viết | Đối chứng. Ở P1/P2 dùng để **chứng minh rằng nó không cần thiết**; chỉ lên vai trò chính ở P3 |
| S5 | **Tabu Search** | tự viết | Như S4 |

### Bộ dữ liệu kiểm thử

Sinh bài toán tổng hợp có kiểm soát để đo độ co giãn:

| Quy mô N | Mục đích |
|---|---|
| 34 | Quy mô thật cấp tỉnh (MVP) |
| 100 | Trung gian |
| 570 | Quy mô pitch trong đề án |
| 3.321 | Quy mô cấp xã (sau cải cách 2025) — kiểm tra khả năng mở rộng thật |
| 10.000 | Kiểm tra giới hạn |

Mỗi quy mô sinh ≥20 thực thể với phân phối `Rᵢ`, `Cᵢ` khác nhau (đồng đều, lệch, có tương quan R–C).

### Chỉ số so sánh

| Metric | Ý nghĩa |
|---|---|
| **Giá trị mục tiêu** | Chất lượng lời giải |
| **Khoảng cách tối ưu (optimality gap)** | `(Z* − Z)/Z*` so với lời giải tối ưu từ S2. Đây là con số cho thấy S4/S5 có đáng không |
| **Thời gian chạy** | Trung vị + phân vị 95, theo từng quy mô N |
| **Có chứng nhận tối ưu không** | S2/S3 có, S1/S4/S5 không — đây là khác biệt quan trọng khi bán cho B2G |
| **Độ ổn định** | Cùng đầu vào chạy 10 lần có ra cùng kết quả không? (S4/S5 ngẫu nhiên → không) |

> **Dự đoán trước khi chạy** (ghi lại để đối chiếu — đây là cách phát hiện bug): với P1, S2 sẽ cho tối ưu chứng minh được ở mọi N ≤ 10.000 trong dưới 1 giây, và S4/S5 sẽ **không thắng được S2** ở bất kỳ quy mô nào. Nếu kết quả khác dự đoán này, gần như chắc chắn có lỗi trong cách cài đặt.

---

## 4. Đánh giá dưới bất định — phần quan trọng bị bỏ sót

Đây là điểm **chưa có trong bản thuyết minh** nhưng quyết định giá trị thực của Layer 2.

`Rᵢ` không phải con số chắc chắn — nó là **dự báo có sai số** từ Layer 1. Một phương án phân bổ tối ưu với `Rᵢ` điểm ước lượng có thể rất tệ khi `Rᵢ` lệch đi 20%.

### Giao thức đánh giá

```
1. Layer 1 sinh phân phối dự báo cho Rᵢ (không chỉ điểm ước lượng)
2. Lấy mẫu K = 1000 kịch bản từ phân phối đó
3. Với mỗi phương án phân bổ, tính:
   - Giá trị mục tiêu kỳ vọng qua K kịch bản
   - Giá trị xấu nhất (kịch bản tệ nhất)
   - Độ hối tiếc (regret) so với phương án tối ưu nếu biết trước kịch bản
```

### So sánh 3 chiến lược ra quyết định

| Chiến lược | Nội dung | Khi nào phù hợp |
|---|---|---|
| **Deterministic** | Dùng thẳng `E[Rᵢ]`, giải như P1 | Đơn giản, là baseline |
| **Stochastic (SAA)** | Tối ưu giá trị kỳ vọng qua các kịch bản lấy mẫu | Cân bằng, thường tốt nhất |
| **Robust (minimax regret)** | Tối ưu cho kịch bản xấu nhất | Y tế công cộng ngại rủi ro → có thể là lựa chọn đúng về mặt chính sách |

**Kết quả cần báo cáo:** phương án deterministic mất bao nhiêu % giá trị khi thực tế lệch khỏi dự báo, so với phương án stochastic/robust. Đây là luận điểm kỹ thuật mạnh mà đối thủ không có.

---

## 4b. Thí nghiệm then chốt: P2 có thật sự hơn P1 không? ⭐

Đây là **thí nghiệm tạo ra luận điểm bán hàng mạnh nhất của Layer 2**. Phải làm, và phải ra được con số cụ thể.

### Thiết kế

```
Với mỗi tháng trong tập đánh giá:
   1. Lấy dự báo Ĉasesᵢ từ Layer 1
   2. Phương án A = S0 (xếp hạng rủi ro — cách làm hiện tại của ngành)
      Phương án B = S2 với P2 (lợi ích cận biên, hàm lõm)
   3. Mô phỏng kết quả: với hiệu lực eᵢ và hàm f đã giả định,
      mỗi phương án giảm được bao nhiêu ca?
   4. So sánh tổng số ca giảm được, ở cùng một mức ngân sách B
```

### Kết quả cần báo cáo

| Chỉ tiêu | Ý nghĩa |
|---|---|
| **% ca giảm thêm của P2 so với P1** | Con số bán hàng: *"cùng ngân sách, cứu thêm X% số ca"* |
| **Đường cong ngân sách–hiệu quả** | Vẽ số ca giảm được theo B cho cả hai phương án. Khoảng cách giữa 2 đường chính là giá trị của Layer 2 |
| **Độ nhạy theo `eᵢ`** | Kết luận còn đúng không khi `eᵢ` biến thiên ±30%? Bắt buộc có, vì `eᵢ` đang là giả định |
| **Độ nhạy theo độ lõm `k`** | `f` càng lõm thì P2 càng thắng đậm. Ở mức lõm nào thì P2 hết lợi thế? |

> ⚠️ **Trung thực:** nếu độ nhạy cho thấy P2 chỉ thắng khi `eᵢ` và `k` nằm trong khoảng hẹp, phải nói rõ điều đó thay vì chỉ báo cáo kịch bản đẹp nhất. Luận điểm đúng khi đó là *"P2 thắng trong điều kiện X, và pilot sẽ đo xem thực tế có nằm trong X không"*.

---

## 5. Kiểm thử

Tối ưu hoá dễ sai âm thầm — solver vẫn trả về lời giải trông hợp lý dù mô hình hoá sai. Bắt buộc có test:

| Loại test | Nội dung |
|---|---|
| **Tính hợp lệ** | Mọi lời giải thoả mọi ràng buộc: `Σ Cᵢxᵢ ≤ B`, `xᵢ ∈ {0,1}`, không âm |
| **Trường hợp biên** | `B = 0` (không chọn gì) · `B = ΣCᵢ` (chọn tất cả) · tất cả `Rᵢ` bằng nhau · một khu vực có `Cᵢ > B` |
| **Đối chiếu chéo** | S2 và S3 phải ra **cùng giá trị mục tiêu** trên mọi bài toán test (lời giải có thể khác nếu có nhiều nghiệm tối ưu) |
| **Kiểm chứng brute-force** | Với N ≤ 20, liệt kê toàn bộ 2^N khả năng → so với solver. Đây là test duy nhất chứng minh được cài đặt đúng |
| **Đơn điệu** | Tăng `B` thì giá trị mục tiêu không bao giờ giảm |
| **Tái lập** | Cùng đầu vào + seed → cùng đầu ra |

---

## 6. Giải thích kết quả cho người dùng

Cán bộ y tế phải hiểu **vì sao** hệ thống chọn tỉnh A mà bỏ tỉnh B. Không giải thích được thì không ai ký duyệt.

Mỗi phương án phân bổ trả kèm:
- **Xếp hạng** theo tỉ lệ `Rᵢ/Cᵢ` và vị trí của từng khu vực
- **Ngưỡng cắt** — "ngân sách hết sau khu vực thứ 12"
- **Phân tích cận biên** — "nếu có thêm 10% ngân sách, khu vực tiếp theo được chọn là X"
- **Giá bóng (shadow price)** của ràng buộc ngân sách — thêm 1 đồng ngân sách thì giảm được bao nhiêu rủi ro. Đây là con số **rất mạnh khi đàm phán với Sở Y tế**, vì nó nói trực tiếp bằng ngôn ngữ ngân sách
- **Lý do loại** cho các khu vực rủi ro cao nhưng không được chọn (thường do chi phí quá cao)

---

## 7. Cổng quyết định Layer 2

| # | Điều kiện | Ngưỡng |
|---|---|---|
| O1 | Tính hợp lệ | 100% lời giải thoả ràng buộc trên toàn bộ bộ test |
| O2 | Tối ưu | Chứng nhận tối ưu ở N = 3.321 (trên bài toán đã xấp xỉ tuyến tính từng khúc) |
| O3 | Tốc độ | Trung vị < 1 giây ở N = 570; < 10 giây ở N = 3.321 |
| O4 | Đúng đắn | Test brute-force N ≤ 20 khớp 100% |
| O5 | **P2 > P1 có bằng chứng** | Đã chạy §4b, có con số "% ca giảm thêm" **kèm phân tích độ nhạy** |
| O6 | Độ vững | Đã đo mức mất mát của phương án deterministic dưới bất định (§4) |
| O7 | Giải thích được | API trả đủ các trường ở §6 |

> **Cập nhật bản thuyết minh sau khi qua cổng:** thay "MILP + Simulated Annealing + Tabu Search" bằng phát biểu đúng với cái thực sự làm — *"tối ưu số ca cứu được có tính lợi ích cận biên giảm dần, giải tối ưu chứng minh được dưới 1 giây"*. Đây là luận điểm **mạnh hơn** phát biểu cũ, không phải hạ thấp.
