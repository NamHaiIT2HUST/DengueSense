# 06 — Khảo sát tài liệu & Định vị khác biệt

Khảo sát ngày 20/09/2026. Mục đích: biết chính xác **cái gì đã có người làm rồi** để không tốn thời gian làm lại, và tìm ra khoảng trống thật sự cho DengueSense.

> ⚠️ **Đọc mục §2 trước tiên.** Có một phát hiện làm thay đổi căn bản cách định vị sản phẩm: luận điểm "chúng tôi dự báo chính xác hơn" **không đứng vững được**, và cần thay bằng luận điểm khác mạnh hơn.

---

## 1. Các hệ thống/nghiên cứu liên quan

### 1.1 D-MOSS — đối thủ trực tiếp, đang vận hành tại Việt Nam

| | |
|---|---|
| Nguồn | [Performance evaluation of an operational dengue forecasting system (D-MOSS) in Vietnam](https://journals.plos.org/globalpublichealth/article?id=10.1371%2Fjournal.pgph.0005867), PLOS Global Public Health |
| Phạm vi | 63 tỉnh/thành, vận hành từ 6/2019 |
| Phương pháp | Superensemble, mô hình Bayes phân cấp |
| **Kết quả** | Phân loại xác suất vượt ngưỡng dịch: **độ chính xác 0.83 – 0.94** tuỳ kịch bản vận hành |
| Phát hiện đáng chú ý | Độ chính xác **không giảm mạnh** khi tăng lead time tới 6 tháng; giá trị gia tăng so với baseline **lớn nhất ở lead time 4–6 tháng** |
| Điểm yếu | Sai số lớn hơn ở các tỉnh **miền Trung và miền Nam** — đúng những tỉnh có gánh nặng dịch cao nhất |

### 1.2 EWARS (WHO/TDR) — đối thủ bị đánh giá thấp trong đề án

| | |
|---|---|
| Nguồn | [EWARS for dengue outbreaks](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0196811), PLOS One · [Triển khai vận hành tại Mexico](https://journals.plos.org/globalpublichealth/article?id=10.1371%2Fjournal.pgph.0001691) |
| **Kết quả** | **Độ nhạy (recall) 97%**, **PPV (precision) 68%**, cảnh báo trước **6–8 tuần** |
| ⚠️ Điểm quan trọng | EWARS **đã có** phần hành động: *"instant interpretations including a subsequent action plan using the local vector control response protocol"* |

> **Đề án hiện đang nói sai về EWARS.** Luận điểm *"các giải pháp hiện có chỉ dừng ở dự báo, không có hành động"* đúng với D-MOSS nhưng **không đúng với EWARS**. Nếu hội đồng có người biết EWARS, đây là lỗ hổng dễ bị bắt. Phải phát biểu lại chính xác hơn — xem §3.

### 1.3 Mô hình ensemble cấp huyện ĐBSCL — chuẩn tham chiếu sát nhất

| | |
|---|---|
| Nguồn | [A district-level ensemble model... Mekong Delta Region of Vietnam](https://journals.plos.org/plosntds/article?id=10.1371%2Fjournal.pntd.0013571), PLOS NTD 2025 |
| Phương pháp | **Đánh giá 72 mô hình**, chọn top ghép ensemble 5 mô hình: spatiotemporal + supervised PCA + **hhh4 (bán cơ giới)** |
| Chia dữ liệu | 2004–2011 phát triển · 2012–2016 CV · 2017–2022 đánh giá |
| **Kết quả** | **69% độ chính xác ở lead time 3 tháng** |
| Hạn chế | Giảm mạnh ở các năm có mùa vụ bất thường (2019, 2022) |

**Đây là chuẩn tham chiếu quan trọng nhất** — cùng quốc gia, cùng cấp không gian, dữ liệu thật, bình duyệt.

### 1.4 So sánh model qua các nghiên cứu — không có người thắng tuyệt đối

| Nghiên cứu | Model thắng | Ghi chú |
|---|---|---|
| [Bangladesh](https://www.nature.com/articles/s41598-025-19752-7) (Sci Rep 2025) | **XGBoost** | Sai số thấp nhất; SARIMA khá nhưng kém hơn ML |
| [Brazil — Rio](https://link.springer.com/article/10.1186/s41182-025-00723-7) (Trop Med Health 2025) | **LSTM + biến khí hậu**; ensemble **LSTM+ARIMA** tốt hơn nữa | LSTM chậm train/predict |
| [Indonesia — Bandung](https://doi.org/10.3390/su17156777) (Sustainability 2025) | **Bayes spatiotemporal** | ⚠️ **SARIMA và XGBoost đều có dấu hiệu overfit** |
| ĐBSCL Việt Nam (§1.3) | **Ensemble** (spatiotemporal + PCA + hhh4) | Mô hình bán cơ giới nằm trong nhóm thắng |

**Ba kết luận rút ra cho việc chọn model:**

1. **Không có model nào thắng ở mọi nơi.** Kết quả phụ thuộc bối cảnh → bắt buộc phải tự so sánh trên dữ liệu Việt Nam, không thể chép kết quả nước khác.
2. **Ensemble thắng nhất quán.** Cả 4 nghiên cứu đều cho thấy ensemble ≥ model đơn lẻ. Đây là bước ROI cao nhất.
3. **Mô hình thống kê/Bayes phân cấp cạnh tranh ngang ngửa hoặc thắng ML thuần**, và ML thuần **overfit** trong ít nhất 1 nghiên cứu. Với dữ liệu ít, đây là cảnh báo trực tiếp cho kế hoạch ban đầu chỉ dựa vào XGBoost.

### 1.5 Phân bổ nguồn lực — nơi có khoảng trống thật

| Nguồn | Nội dung | Liên quan |
|---|---|---|
| [dengue-allocator](https://github.com/Wicky2002/dengue-allocator) (Sri Lanka) | Pipeline **dự báo → hiệu ứng nhân quả → phân bổ**. Tính **lợi ích cận biên giảm dần** của nỗ lực can thiệp, dùng mô hình lan truyền cơ giới để **phá nhiễu (confounding)**, thay vì chỉ xếp hạng theo ca dự báo | ⭐ **Trực tiếp thách thức thiết kế Layer 2 hiện tại** |
| [Constrained optimization, Thái Lan](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8080389/) (2021) | Tối ưu có ràng buộc ngân sách, tối thiểu ca bệnh/DALY | Formulation tương tự P1 |
| [Multiobjective optimization](https://pmc.ncbi.nlm.nih.gov/articles/PMC10290689/) | Tối ưu đa mục tiêu với mô hình dịch tễ phụ thuộc khí hậu | Tham chiếu cho P2 |
| [Patient allocation during dengue outbreak](https://doi.org/10.3390/healthcare10010163) | Phân bổ bệnh nhân khi bùng dịch | Liên quan hướng B2B |

### 1.6 LLM trong y tế công cộng — đông đúc nhưng lệch hướng

Mảng này đã rất sôi động 2025–2026: [PandemicLLM / dự báo thời gian thực](https://www.nature.com/articles/s43588-025-00798-6) (Nature Comput Sci), [EpiMap-LLM](https://pmc.ncbi.nlm.nih.gov/articles/PMC13260628/), [prompt-to-policy + RL](https://pubmed.ncbi.nlm.nih.gov/41734496/), [LLM agent cho cảnh báo sớm đa tầng](https://openreview.net/forum?id=ASOb5Cw8Rv), [khung LLM cho cúm gia cầm](https://pmc.ncbi.nlm.nih.gov/articles/PMC12925455/).

**Nhưng tất cả đều tập trung vào:** dự báo bằng LLM, truyền thông rủi ro, mô phỏng kịch bản, tra cứu hướng dẫn.

**Không tìm thấy công trình nào làm:** biến đầu ra của bộ tối ưu thành **văn bản chỉ đạo hành chính đúng thể thức pháp lý của một quốc gia cụ thể**, có guardrail chặn số liệu bịa, đi kèm quy trình phê duyệt. Mảng RAG cho văn bản pháp quy hiện có chủ yếu là **kiểm tra tuân thủ văn bản đã có** ([CTRAG](https://arxiv.org/html/2608.02472), [multi-agent compliance](https://dl.acm.org/doi/pdf/10.1145/3785472)), không phải **sinh ra văn bản điều hành**.

→ **Đây là khoảng trống thật.**

---

## 2. Hệ quả: phải đổi cách định vị sản phẩm ⚠️

### 2.1 Luận điểm "dự báo chính xác hơn" đã chết

Đặt các con số cạnh nhau:

| Hệ thống | Con số | Dữ liệu |
|---|---|---|
| **D-MOSS** (đang chạy ở VN) | **0.83 – 0.94** | Thật, 63 tỉnh, vận hành từ 2019 |
| **EWARS** (WHO) | Recall 97% / Precision 68% | Thật, triển khai Mexico |
| **Ensemble ĐBSCL** (PLOS NTD 2025) | **69% @ 3 tháng** | Thật, cấp huyện, bình duyệt |
| **DengueSense (tuyên bố)** | 89.5% precision | **Một phần mô phỏng**, chưa bình duyệt |

Ba vấn đề:

1. **89.5% nằm gọn trong khoảng của D-MOSS (0.83–0.94)** → không thể nói "chính xác hơn D-MOSS".
2. **89.5% cao hơn nhiều so với 69% của nghiên cứu bình duyệt cùng nước cùng cấp** → con số càng cao so với chuẩn tham chiếu, càng dễ bị nghi là do rò rỉ dữ liệu hoặc do dữ liệu mô phỏng. Đây là điểm **nguy hiểm** khi ra hội đồng chuyên môn.
3. D-MOSS còn cho thấy độ chính xác **không giảm mạnh tới 6 tháng** → luận điểm "cảnh báo sớm 1–6 tháng" cũng không phải khác biệt.

> **Kết luận:** không cạnh tranh trên độ chính xác dự báo. Đặt mục tiêu **ngang D-MOSS là đủ tốt**, rồi thắng ở chỗ khác.

### 2.2 Luận điểm "chỉ có chúng tôi có hành động" cần phát biểu lại

EWARS đã có action plan theo response protocol. Phát biểu cũ sai. Phát biểu lại cho chính xác:

| ❌ Nói sai (hiện tại) | ✅ Nói đúng (đề xuất) |
|---|---|
| "Các hệ thống hiện có chỉ dừng ở dự báo" | "D-MOSS dừng ở dự báo. EWARS có phác đồ ứng phó **theo quy trình cố định**, nhưng **không tối ưu hoá việc phân bổ nguồn lực dưới ràng buộc ngân sách**, và không sinh ra văn bản điều hành đúng thể thức pháp lý." |

Khác biệt nằm ở chữ **tối ưu hoá dưới ràng buộc** và **văn bản ban hành được**, không phải ở chữ "có hành động".

---

## 3. Năm khác biệt thật sự — định vị mới

Sau khảo sát, đây là những điểm DengueSense có thể tuyên bố mà **không bị bác**:

### 🥇 K1 — Phân bổ theo **lợi ích cận biên**, không phải theo xếp hạng rủi ro

Đây là khác biệt kỹ thuật mạnh nhất, và hiện **Layer 2 đang làm sai**.

Formulation hiện tại `max Σ Rᵢ·xᵢ` = "đổ nguồn lực vào nơi rủi ro cao nhất". Nhưng nghiên cứu Sri Lanka chỉ ra điều này **sai về mặt nhân quả**:

> Rủi ro cao **≠** can thiệp ở đó hiệu quả nhất.

Một tỉnh có thể rủi ro rất cao nhưng can thiệp thêm gần như không giảm được ca (đã bão hoà, hoặc nguyên nhân lan truyền khác). Trong khi tỉnh rủi ro trung bình lại có thể giảm được nhiều ca nhất trên mỗi đồng chi.

**Cái cần tối ưu là `ΔCasesᵢ(xᵢ)` — số ca giảm được — chứ không phải `Rᵢ`.**

Phiên bản đúng:

```
max  Σᵢ  ΔCasesᵢ(xᵢ)        với  ΔCasesᵢ(xᵢ) = Casesᵢ · eᵢ · f(xᵢ)
s.t. Σᵢ  Cᵢ·xᵢ ≤ B
```
- `eᵢ` = hiệu lực can thiệp ước lượng tại khu vực i (từ dữ liệu lịch sử can thiệp, hoặc giả định có kiểm định độ nhạy)
- `f(·)` **lõm** = lợi ích cận biên giảm dần

⚠️ Hàm `f` lõm làm bài toán **không còn là knapsack tuyến tính** → đây chính là chỗ P2 và các kỹ thuật tối ưu nâng cao có lý do tồn tại thật (xem [04 §2.2](04-phuong-phap-toi-uu.md#22-p2--mở-rộng-giai-đoạn-sau)). Nói cách khác: **làm đúng về mặt khoa học cũng đồng thời làm cho phần kỹ thuật đáng giá hơn.**

### 🥇 K2 — Sinh văn bản chỉ đạo đúng thể thức pháp lý Việt Nam

Khảo sát §1.6 không tìm thấy công trình nào làm việc này. Mảng LLM y tế công cộng làm dự báo/truyền thông/mô phỏng; mảng RAG pháp quy làm kiểm tra tuân thủ. **Không ai sinh ra văn bản điều hành ban hành được từ đầu ra của bộ tối ưu.**

Kết hợp với guardrail chặn số bịa ([05 §4](05-phuong-phap-genai-rag.md#4-guardrail--kiểm-tra-bắt-buộc-trước-khi-hiện-cho-cán-bộ)) → đây là đóng góp có thể viết thành bài báo.

### 🥈 K3 — Địa giới hành chính mới 2025 — lợi thế người đi đầu, **có hạn sử dụng**

Toàn bộ công trình hiện có đều ở địa giới **cũ**:
- D-MOSS: 63 tỉnh (trước cải cách)
- Ensemble ĐBSCL: cấp huyện (cấp hành chính **đã bị bãi bỏ** từ 01/7/2025)

Không ai có mô hình chạy trên **34 tỉnh / 3.321 xã mới**. Việc xây bảng ánh xạ địa giới ([01 §3](01-chien-luoc-du-lieu.md#3-chuẩn-hoá-đơn-vị-không-gian-bắt-buộc-làm-trước)) — thứ ban đầu tưởng là việc dọn dẹp tẻ nhạt — **thực ra là tài sản và rào cản gia nhập**.

⏳ Lợi thế này **hết hạn** khi có nhóm khác làm xong crosswalk. Càng làm sớm càng tốt, và nên công bố sớm để xác lập.

### 🥈 K4 — Ra quyết định dưới bất định của dự báo

Mọi hệ thống hiện có đưa ra **một con số dự báo**. Nhưng phương án phân bổ tối ưu theo điểm ước lượng có thể rất tệ khi dự báo lệch 20%.

DengueSense lan truyền **toàn bộ phân phối dự báo** vào bài toán phân bổ và so sánh 3 chiến lược (deterministic / stochastic / robust) — xem [04 §4](04-phuong-phap-toi-uu.md#4-đánh-giá-dưới-bất-định--phần-quan-trọng-bị-bỏ-sót). Luận điểm bán hàng: *"phương án của chúng tôi vẫn tốt ngay cả khi dự báo sai"*.

### 🥉 K5 — Vòng phản hồi phê duyệt làm dữ liệu độc quyền

Mỗi lần cán bộ sửa văn bản trước khi duyệt = một mẫu huấn luyện. Không ai khác có dữ liệu này. Nhưng **chỉ thành hiện thực nếu lưu ngay từ pilot đầu tiên** ([05 §6](05-phuong-phap-genai-rag.md#6-vòng-phản-hồi)).

---

## 4. Chốt lựa chọn model — cắt bớt để tiết kiệm thời gian

Dựa trên §1.4, cắt danh sách từ 10 model xuống còn **4 bắt buộc + 2 tuỳ chọn**.

### ✅ Bắt buộc (4)

| # | Model | Vì sao giữ |
|---|---|---|
| M1 | **GLM Negative Binomial phân cấp** (statsmodels/PyMC) — mùa vụ + khí hậu + hiệu ứng tỉnh | Nghiên cứu Indonesia & ĐBSCL cho thấy mô hình thống kê/Bayes **thắng hoặc ngang ML**. Dữ liệu đếm quá tán → NegBin đúng bản chất hơn Gaussian. Rẻ, dễ giải thích cho cán bộ y tế |
| M2 | **Gradient Boosting** — chạy XGBoost **và** LightGBM ở cấu hình mặc định (rẻ, ~1 giờ), **chỉ tune model thắng** | XGBoost đã cam kết trong đề án; LightGBM thường nhanh hơn và xử lý biến hạng mục tốt hơn. Chọn 1 để tune, không tune cả hai |
| M3 | **Mô hình bán cơ giới endemic-epidemic** (kiểu hhh4) | Nằm trong ensemble thắng của nghiên cứu ĐBSCL — chuẩn tham chiếu sát nhất với ta. Bắt được thành phần lan truyền không gian mà GBM không có |
| M4 | **Ensemble** (M1+M2+M3) | **Cả 4 nghiên cứu đều cho thấy ensemble thắng.** Đây là bước ROI cao nhất, đừng bỏ |

### 🔶 Tuỳ chọn — chỉ làm nếu Phase 2 xong sớm (2)

| # | Model | Điều kiện |
|---|---|---|
| M5 | **LSTM + biến khí hậu** | Thắng ở nghiên cứu Brazil. Nhưng chậm train và cần nhiều dữ liệu → chỉ làm nếu model global pooled và còn ≥1 tuần |
| M6 | **Bayes spatiotemporal đầy đủ** (PyMC/NumPyro) | Thắng ở Indonesia, cho định lượng bất định tốt nhất (hỗ trợ trực tiếp K4). Giá trị học thuật cao — cân nhắc nếu nhắm bài báo/Nafosted |

### ❌ Cắt bỏ — lý do cụ thể

| Model | Lý do cắt |
|---|---|
| **Random Forest** | Gần như luôn bị gradient boosting vượt trên dữ liệu bảng. Tốn thời gian mà không thêm thông tin |
| **CatBoost** | Cải thiện biên so với LightGBM quá nhỏ, không đáng thêm một thư viện |
| **SARIMAX per-province** | Phải fit 34 lần, bảo trì tốn; nghiên cứu Bangladesh & Indonesia đều cho thấy bị vượt. M1 đã phủ vai trò "đối chứng thống kê" |
| **Prophet** | Không thắng ở bất kỳ nghiên cứu nào khảo sát được |
| **TFT** | Quá nặng so với quy mô dữ liệu và thời gian còn lại |

**Tiết kiệm ước tính: ~2 tuần công sức**, mà vẫn phủ đủ 3 họ phương pháp khác nhau (thống kê / máy học / bán cơ giới) — đúng tinh thần so sánh đa dạng.

---

## 5. Chốt phương pháp tuning — cắt từ 4 xuống 2 (+1 tuỳ chọn)

Chạy 4 phương pháp tuning × nhiều model × nested CV là bùng nổ tổ hợp, tốn hàng chục giờ tính toán để đổi lấy hiểu biết biên.

| # | Phương pháp | Trạng thái | Lý do |
|---|---|---|---|
| T1 | **Cấu hình mặc định hợp lý** | ✅ Bắt buộc | Mốc đối chứng. Nhiều khi đã đủ tốt — và đó là phát hiện đáng giá, tiết kiệm cả tuần |
| T2 | **Optuna TPE + ASHA pruner** | ✅ Bắt buộc | **Gộp cả Bayesian optimization lẫn cắt sớm kiểu Hyperband trong một công cụ** → không cần chạy Hyperband riêng |
| T3 | **Random Search 30 lần thử** | 🔶 Tuỳ chọn | Đối chứng rẻ để chứng minh T2 thực sự đáng. Bỏ được nếu thiếu thời gian |
| T4 | ~~Hyperband riêng~~ | ❌ Cắt | Đã nằm trong T2 qua ASHA pruner |
| T5 | ~~Grid Search~~ | ❌ Cắt | Bùng nổ tổ hợp, không hiệu quả hơn random search |

**Quy tắc quan trọng:** chỉ tune model **thắng ở vòng mặc định**, không tune tất cả. Tune 1 model tốt sâu hơn có giá trị hơn tune 4 model nông.

**Ngân sách:** 100 trial cho T2. Vẽ đường hội tụ — nếu phẳng từ trial 30 thì dừng, đừng chạy hết.

---

## 6. Mục tiêu hiệu năng — đặt lại cho thực tế

Thay vì "89.5% precision", đặt mục tiêu đối chiếu được với tài liệu:

| Chỉ tiêu | Mục tiêu | Căn cứ |
|---|---|---|
| Độ chính xác cảnh báo @ 3 tháng | **≥ 69%** | Ngang ensemble ĐBSCL (PLOS NTD 2025) |
| Phân loại vượt ngưỡng | **0.83 – 0.94** | Ngang D-MOSS |
| Recall @ Precision 0.70 | **≥ 0.70** | EWARS đạt recall 97% @ precision 68% — cho thấy đánh đổi thực tế nằm ở đâu |
| MASE vs seasonal naive | **< 0.90** | Chuẩn nội bộ |

> Đạt **ngang** các hệ thống này là **thành công**, không phải thất bại. Khác biệt của DengueSense nằm ở K1–K5, không nằm ở việc thắng D-MOSS vài phần trăm dự báo.

---

## 7. Việc phải cập nhật vào bản thuyết minh

- [ ] Sửa phát biểu về EWARS (§2.2) — hiện đang nói sai 🤝
- [ ] Bỏ/thay con số 89.5%; đặt mục tiêu theo §6 🧬
- [ ] Viết lại Layer 2 theo lợi ích cận biên (K1) thay vì xếp hạng rủi ro 🧬
- [ ] Đưa K3 (địa giới mới 2025) thành **rào cản gia nhập** trong mục Lợi thế cạnh tranh — hiện chưa có 🤝
- [ ] Đưa K4 (quyết định dưới bất định) vào mục Tính mới — hiện chưa có 🤝
- [ ] Bổ sung bảng so sánh đối thủ có số liệu thật từ §1 (thay bảng định tính hiện tại) 🤝

---

## Nguồn tham khảo

1. [Performance evaluation of an operational dengue forecasting system (D-MOSS) in Vietnam](https://journals.plos.org/globalpublichealth/article?id=10.1371%2Fjournal.pgph.0005867) — PLOS Global Public Health
2. [A district-level ensemble model to enhance dengue prediction and control for the Mekong Delta Region of Vietnam](https://journals.plos.org/plosntds/article?id=10.1371%2Fjournal.pntd.0013571) — PLOS NTD 2025 · [arXiv](https://arxiv.org/abs/2412.15645)
3. [Early warning and response system (EWARS) for dengue outbreaks](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0196811) — PLOS One
4. [EWARS: Moving from research to operational implementation in Mexico](https://journals.plos.org/globalpublichealth/article?id=10.1371%2Fjournal.pgph.0001691) — PLOS GPH
5. [A comparative evaluation of multiple machine learning approaches for forecasting dengue outbreaks in Bangladesh](https://www.nature.com/articles/s41598-025-19752-7) — Scientific Reports 2025
6. [Assessing dengue forecasting methods: statistical models vs machine learning in Rio de Janeiro, Brazil](https://link.springer.com/article/10.1186/s41182-025-00723-7) — Tropical Medicine and Health 2025
7. [Spatiotemporal Dengue Forecasting in Bandung, Indonesia: Classical, Machine Learning, and Bayesian Models](https://doi.org/10.3390/su17156777) — Sustainability 2025
8. [dengue-allocator: Forecast → causal effect → allocation pipeline (Sri Lanka)](https://github.com/Wicky2002/dengue-allocator) — GitHub
9. [Reducing dengue fever cases at the lowest budget: a constrained optimization approach applied to Thailand](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8080389/) — PMC
10. [Multiobjective optimization to assess dengue control costs using a climate-dependent epidemiological model](https://pmc.ncbi.nlm.nih.gov/articles/PMC10290689/) — PMC
11. [Solving Patient Allocation Problem during an Epidemic Dengue Fever Outbreak](https://doi.org/10.3390/healthcare10010163) — Healthcare
12. [Advancing real-time infectious disease forecasting using large language models](https://www.nature.com/articles/s43588-025-00798-6) — Nature Computational Science
13. [Protocol-aware epidemic forecasting across heterogeneous public health surveillance systems (EpiMap-LLM)](https://pmc.ncbi.nlm.nih.gov/articles/PMC13260628/) — PMC
14. [Position: Public Health Systems Should Embrace a Multi-Layered Epidemic Early-Warning with LLM Agents](https://openreview.net/forum?id=ASOb5Cw8Rv) — OpenReview
15. [CTRAG: In-Context Retrieval-based Framework for Automated Compliance Checking using LLMs](https://arxiv.org/html/2608.02472) — arXiv
