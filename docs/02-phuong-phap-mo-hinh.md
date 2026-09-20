# 02 — Phương pháp mô hình (Layer 1 — Dự báo)

> Mục tiêu: chọn ra model tốt nhất bằng **quy trình có kỷ luật**, không phải bằng cảm giác hay bằng con số chạy may mắn một lần.

Điều kiện tiên quyết: đã hoàn thành checklist ở [01-chien-luoc-du-lieu.md §9](01-chien-luoc-du-lieu.md#9-checklist-nghiệm-thu-phase-dữ-liệu).

---

## 1. Phát biểu bài toán

Hệ thống cần trả lời **hai câu hỏi khác nhau** — đừng gộp làm một:

| | Bài toán A — Hồi quy | Bài toán B — Cảnh báo |
|---|---|---|
| Câu hỏi | Tháng tới tỉnh X có bao nhiêu ca? | Tháng tới tỉnh X có vượt ngưỡng bùng dịch không? |
| Đầu ra | `incidence_per_100k` (số thực ≥ 0) | Xác suất vượt ngưỡng `p ∈ [0,1]` |
| Dùng cho | Đầu vào `Rᵢ` cho Layer 2 (phân bổ nguồn lực) | Cảnh báo cho cán bộ y tế, chỉ số `ProbExceed75th` |
| Metric chính | MASE, MAE | PR-AUC, Recall @ Precision cố định |

**Cách làm khuyến nghị:** train model hồi quy (A) trước, suy ra xác suất (B) từ phân phối dự báo của nó. Lý do: một model duy nhất, nhất quán giữa hai đầu ra, và số ca dự báo vẫn cần cho Layer 2. Nếu (B) suy ra từ (A) cho kết quả kém, khi đó mới train riêng classifier — và phải ghi rõ lý do.

### Đa horizon

Dự báo ở **h ∈ {1, 2, 3, 6} tháng**. Quy tắc: **train model riêng cho mỗi horizon** (direct multi-horizon), không dùng đệ quy (recursive) vì sai số tích luỹ rất nhanh ở h=6.

⚠️ **Báo cáo kết quả phải tách theo từng horizon.** Gộp 4 horizon vào một con số trung bình là che mất thông tin quan trọng nhất: độ chính xác giảm bao nhiêu khi dự báo xa hơn. Hội đồng sẽ hỏi chính xác câu này.

---

## 2. Kỹ thuật đặc trưng (Feature Engineering)

Toàn bộ đặc trưng phải **nhân quả** — tại thời điểm `t` chỉ dùng thông tin có thật tại `t`, có tính độ trễ báo cáo `D` ([01 §6 Bẫy 3](01-chien-luoc-du-lieu.md#6-các-bẫy-rò-rỉ-dữ-liệu-phải-tránh)).

### 2.1 Nhóm đặc trưng

| Nhóm | Đặc trưng | Ghi chú |
|---|---|---|
| **Mùa vụ** | `sin(2πm/12)`, `cos(2πm/12)` | Mã hoá lượng giác — tháng 12 và tháng 1 gần nhau, mã hoá số thứ tự thường không nắm được |
| **Độ trễ khí hậu** | `temp_lag_1..6`, `precip_lag_1..6`, `humidity_lag_1..6` | Vòng đời muỗi + ủ bệnh → độ trễ 1–3 tháng thường mạnh nhất. Để EDA xác nhận, đừng đoán |
| **Cửa sổ trượt khí hậu** | Trung bình/tổng/max trượt 2, 3, 6 tháng | Mưa dồn 3 tháng có ý nghĩa sinh học hơn mưa 1 tháng đơn lẻ |
| **Lịch sử dịch** | `cases_lag_{D+1}..{D+12}` | Bắt buộc lùi thêm `D` tháng độ trễ báo cáo |
| **Động lượng dịch** | `momentum = cases_lag_D − cases_lag_{D+1}`, `acceleration` = sai phân bậc 2 | Bắt điểm chuyển pha sớm |
| **ENSO** | `oni`, `oni_lag_3`, `oni_lag_6` | El Niño ảnh hưởng có độ trễ dài |
| **Chuẩn mùa vụ** | `cases_same_month_last_year`, độ lệch so với trung vị lịch sử của tháng đó | Kênh nội sinh (endemic channel) |
| **Không gian** | `province_id` (categorical), vĩ độ, kinh độ, vùng (Bắc/Trung/Nam), mật độ dân số | Cho model global pooled học khác biệt vùng miền |
| **Lân cận** | Trung bình ca bệnh các tỉnh giáp ranh ở `t−D` | Bắt lan truyền không gian. Cần ma trận kề từ dữ liệu GIS |

### 2.2 Quy tắc

- Mọi hàm sinh feature viết trong `app/forecast/features.py`, mỗi nhóm là một hàm riêng, **có unit test kiểm tra tính nhân quả** (đưa vào chuỗi có giá trị tương lai bất thường → feature tại `t` không được đổi).
- Biến mục tiêu lệch phải (right-skewed) mạnh → thử `log1p` transform, so sánh có/không như một thí nghiệm riêng.
- Số ca là dữ liệu đếm và thường phân tán quá mức (overdispersed) → cân nhắc `objective='count:poisson'` (XGBoost) hoặc hồi quy Tweedie, so với hồi quy bình phương tối thiểu thông thường.

---

## 3. Model zoo — các mô hình phải thử

> Nguyên tắc: **mọi model chạy trên cùng một tập đặc trưng, cùng một bộ fold, cùng một metric.** Khác đi thì so sánh vô nghĩa.

### Tier 0 — Baseline (BẮT BUỘC, làm trước tiên)

Không có baseline thì không diễn giải được kết quả nào. Bốn baseline này phải chạy xong **trước khi** train bất kỳ model ML nào:

| # | Baseline | Cách làm |
|---|---|---|
| B1 | **Persistence** | Dự báo `t+h` = giá trị tại `t−D` |
| B2 | **Seasonal naive** ⭐ | Dự báo `t+h` = giá trị cùng tháng năm trước |
| B3 | **Climatology** | Trung bình lịch sử của tháng đó tại tỉnh đó |
| B4 | **GLM Poisson** | Hồi quy Poisson đơn giản với mùa vụ + 2-3 biến khí hậu |

⭐ **B2 là mốc chuẩn.** Mọi model đều báo cáo MASE so với B2. MASE > 1 nghĩa là **thua baseline** — nếu XGBoost cho MASE = 1.05 thì kết quả thật là "baseline thắng", và phải báo cáo đúng như vậy chứ không chọn metric khác cho đẹp.

### Tier 1 — Bắt buộc thử (4 model)

> Danh sách này đã được **cắt gọn dựa trên khảo sát tài liệu** — xem [06 §4](06-khao-sat-tai-lieu.md#4-chốt-lựa-chọn-model--cắt-bớt-để-tiết-kiệm-thời-gian) để biết vì sao cắt Random Forest, CatBoost, SARIMAX, Prophet, TFT (tiết kiệm ~2 tuần). Bốn model còn lại phủ đủ **ba họ phương pháp khác nhau**: thống kê / máy học / bán cơ giới.

| # | Model | Thư viện | Lý do có mặt |
|---|---|---|---|
| M1 | **GLM Negative Binomial phân cấp**<br/>(mùa vụ + khí hậu + hiệu ứng tỉnh) | statsmodels / PyMC | Nghiên cứu Indonesia và ĐBSCL cho thấy mô hình thống kê/Bayes **thắng hoặc ngang ML thuần**, và XGBoost **bị overfit** trong ít nhất 1 nghiên cứu. NegBin đúng bản chất dữ liệu đếm quá tán. Rẻ, dễ giải thích cho cán bộ y tế |
| M2 | **Gradient Boosting**<br/>XGBoost **+** LightGBM ở cấu hình mặc định | xgboost, lightgbm | XGBoost đã cam kết trong đề án; LightGBM thường nhanh hơn và xử lý `province_id` tốt hơn. ⚠️ Chạy cả hai ở mặc định (rẻ, ~1 giờ) nhưng **chỉ tune model thắng** |
| M3 | **Bán cơ giới endemic-epidemic**<br/>(kiểu hhh4) | surveillance (R) / tự cài Python | Nằm trong ensemble thắng của [nghiên cứu ĐBSCL](06-khao-sat-tai-lieu.md#13-mô-hình-ensemble-cấp-huyện-đbscl--chuẩn-tham-chiếu-sát-nhất) — chuẩn tham chiếu sát nhất với ta. Bắt được thành phần **lan truyền không gian** mà GBM không có |
| M4 | **Ensemble** (M1+M2+M3) | — | **Cả 4 nghiên cứu khảo sát được đều cho thấy ensemble thắng model đơn lẻ.** Đây là bước ROI cao nhất — đừng bỏ vì hết thời gian |

### Tier 2 — Chỉ làm nếu Phase 2 xong sớm (2 model)

| # | Model | Điều kiện nên thử |
|---|---|---|
| M5 | **LSTM / GRU + biến khí hậu** | Thắng ở [nghiên cứu Brazil](06-khao-sat-tai-lieu.md#14-so-sánh-model-qua-các-nghiên-cứu--không-có-người-thắng-tuyệt-đối). Chỉ làm khi model global pooled và còn ≥1 tuần dư — **đừng đặt cược** ([00 §C.4](00-review-hien-trang.md#c4--quy-mô-dữ-liệu-quyết-định-lựa-chọn-model)) |
| M6 | **Bayes spatiotemporal đầy đủ** | PyMC/NumPyro. Thắng ở nghiên cứu Indonesia, cho định lượng bất định tốt nhất → hỗ trợ trực tiếp khác biệt **K4** ([06 §3](06-khao-sat-tai-lieu.md#-k4--ra-quyết-định-dưới-bất-định-của-dự-báo)). Giá trị học thuật cao nếu nhắm bài báo/Nafosted |

### Quy tắc dừng

Không cần chạy hết Tier 2. **Điều kiện dừng:** khi model tốt nhất đã ổn định qua ≥3 thí nghiệm liên tiếp (chênh lệch < 2% MASE) thì dừng, chuyển sang tuning. Chạy thêm model chỉ để "cho đủ số" là lãng phí thời gian mà không tăng chất lượng.

### Mục tiêu hiệu năng — đối chiếu tài liệu

Không đặt mục tiêu trong chân không. Các mốc tham chiếu thật từ [06 §6](06-khao-sat-tai-lieu.md#6-mục-tiêu-hiệu-năng--đặt-lại-cho-thực-tế):

| Chỉ tiêu | Mục tiêu | Ai đạt mốc này |
|---|---|---|
| Độ chính xác cảnh báo @ 3 tháng | ≥ 69% | Ensemble ĐBSCL (PLOS NTD 2025) |
| Phân loại vượt ngưỡng | 0.83 – 0.94 | D-MOSS (đang vận hành tại VN) |
| Recall @ Precision 0.70 | ≥ 0.70 | EWARS đạt recall 97% @ precision 68% |

> ⚠️ **Nếu kết quả vượt xa các mốc này (ví dụ > 95%), nghi ngờ rò rỉ dữ liệu trước khi ăn mừng.** Con số cao bất thường so với tài liệu bình duyệt gần như luôn là dấu hiệu của lỗi, không phải của đột phá.

---

## 4. Giao thức đánh giá

### 4.1 Rolling-origin backtest

Theo đúng [01 §7.2](01-chien-luoc-du-lieu.md#72-rolling-origin-backtest-dùng-trong-train--validation). Tối thiểu 5 origin, báo cáo **trung bình ± độ lệch chuẩn** giữa các origin.

⚠️ Một model thắng ở 1 origin nhưng thua ở 4 origin còn lại **không phải là model tốt hơn** — đó là nhiễu. Luôn nhìn độ lệch chuẩn trước khi kết luận.

### 4.2 Phân rã kết quả

Một con số tổng che rất nhiều thứ. Bắt buộc báo cáo phân rã theo:

- **Horizon** (h = 1, 2, 3, 6) — độ chính xác giảm thế nào?
- **Vùng miền** (Bắc / Trung / Nam) — dịch tễ SXH khác nhau rõ rệt giữa các vùng
- **Mùa** (cao điểm vs thấp điểm) — model chỉ đúng lúc thấp điểm thì vô dụng
- **Chế độ dịch** (tháng bình thường vs tháng bùng dịch) — **quan trọng nhất**. Model dự báo tốt lúc bình thường nhưng trượt đúng lúc bùng dịch là model vô dụng cho mục đích của sản phẩm này

### 4.3 Kiểm tra khái quát hoá không gian (Leave-one-province-out)

Đây là **bằng chứng cho luận điểm kinh doanh "nhân rộng chi phí biên gần 0"**, không chỉ là bài tập kỹ thuật.

```
Với mỗi tỉnh p:
    train trên tất cả tỉnh ≠ p  (vẫn tuân thủ chia theo thời gian)
    test trên tỉnh p
```

Câu hỏi cần trả lời: model chạy ở một tỉnh **chưa từng thấy trong tập train** thì kém đi bao nhiêu %? Nếu kém quá nhiều → luận điểm "mở rộng sang tỉnh mới / ASEAN" cần được phát biểu lại (ví dụ: "cần 2 năm dữ liệu lịch sử của địa phương trước khi triển khai").

### 4.4 Kiểm định độ vững (Robustness)

- **Kiểm định trên dữ liệu nhiễu:** thêm nhiễu vào đầu vào khí hậu (±5%, ±10%) → kết quả tụt bao nhiêu?
- **Kiểm định khuyết thiếu:** bỏ ngẫu nhiên 10%, 20% dữ liệu khí hậu → model còn chạy được không? (liên quan trực tiếp tới rủi ro "gián đoạn data pipeline" trong đề án)
- **Kiểm định năm bất thường:** kết quả riêng cho 2020–2021 (COVID làm nhiễu mạnh báo cáo ca bệnh) và 2023 (năm dịch bất thường ở Hà Nội)

---

## 5. Bộ chỉ số đánh giá

### 5.1 Bài toán hồi quy

| Metric | Công thức / ý nghĩa | Vai trò |
|---|---|---|
| **MASE** ⭐ | MAE model ÷ MAE seasonal naive | **Metric chính.** Không thứ nguyên → so sánh được giữa các tỉnh có quy mô rất khác nhau. `< 1` = thắng baseline |
| MAE | Sai số tuyệt đối trung bình | Dễ giải thích cho cán bộ y tế ("lệch trung bình ~X ca") |
| RMSE | Căn sai số bình phương | Phạt nặng sai số lớn — phù hợp vì trượt đợt bùng dịch tốn kém hơn nhiều |
| **Poisson deviance** | Độ lệch cho dữ liệu đếm | Phù hợp bản chất dữ liệu hơn MSE |
| Bias (ME) | Sai số trung bình có dấu | Model dự báo thiếu hệ thống? → nguy hiểm cho y tế công cộng |

### 5.2 Bài toán cảnh báo

Ngưỡng cảnh báo: **bách phân vị thứ 75 lịch sử của chính tỉnh đó cho chính tháng đó** (kênh nội sinh), theo đúng `ProbExceed75th` trong đề án.

| Metric | Vai trò |
|---|---|
| **PR-AUC** ⭐ | **Metric chính** cho lớp hiếm. ROC-AUC gây hiểu nhầm khi mất cân bằng → không dùng làm metric chính |
| **Recall @ Precision = 0.8** | Câu hỏi vận hành thật: "nếu chấp nhận 20% báo động giả, bắt được bao nhiêu % đợt dịch?" |
| **Precision @ Recall = 0.8** | Chiều ngược lại: "muốn bắt 80% đợt dịch thì phải chịu bao nhiêu báo động giả?" |
| **Base rate** | **Bắt buộc báo cáo kèm.** Không có nó thì precision vô nghĩa ([00 §C.1](00-review-hien-trang.md#c1--precision-895-chưa-đủ-để-diễn-giải)) |
| **Brier score** | Chất lượng xác suất (không chỉ nhãn nhị phân) |
| **Reliability diagram** | Model nói 70% thì có thật sự xảy ra ~70% số lần không? |
| **Lead time** | Trung vị số tuần cảnh báo trước khi dịch đạt đỉnh — **đây là con số bán hàng**, trực tiếp hỗ trợ luận điểm "5–9 tuần chuẩn bị chủ động" |

### 5.3 Hiệu chỉnh xác suất (Calibration)

Model boosting thường cho xác suất **quá tự tin**. Với sản phẩm mà cán bộ y tế phải ra quyết định dựa trên con số xác suất, hiệu chỉnh là bắt buộc:

- So sánh 3 phương án: không hiệu chỉnh / **Platt scaling** / **Isotonic regression**
- Fit bộ hiệu chỉnh **trên fold validation, không phải fold train**
- Đánh giá bằng Brier score + reliability diagram

---

## 6. Tuning siêu tham số — 2 phương pháp bắt buộc (+1 tuỳ chọn)

> Câu hỏi cần trả lời không chỉ là "siêu tham số nào tốt nhất" mà còn là **"phương pháp tuning nào đáng tiền nhất"** — vì ngân sách tính toán của nhóm có hạn.

### 6.1 Danh sách đã cắt gọn

Chạy 4 phương pháp tuning × nhiều model × nested CV là bùng nổ tổ hợp — hàng chục giờ tính toán đổi lấy hiểu biết biên. Xem [06 §5](06-khao-sat-tai-lieu.md#5-chốt-phương-pháp-tuning--cắt-từ-4-xuống-2-1-tuỳ-chọn).

| # | Phương pháp | Trạng thái | Công cụ | Ngân sách | Lý do |
|---|---|---|---|---|---|
| T1 | **Cấu hình mặc định hợp lý** | ✅ Bắt buộc | — | 1 lần chạy | Mốc đối chứng. Nhiều khi đã đủ tốt — và đó là phát hiện đáng giá, tiết kiệm cả tuần |
| T2 | **Optuna TPE + ASHA pruner** | ✅ Bắt buộc | Optuna | 100 trial | **Gộp cả Bayesian optimization lẫn cắt sớm kiểu Hyperband trong một công cụ** → không cần chạy Hyperband riêng |
| T3 | **Random Search** | 🔶 Tuỳ chọn | `RandomizedSearchCV` | 30 trial | Đối chứng rẻ để chứng minh T2 thực sự đáng tiền. Bỏ được nếu thiếu thời gian |
| ~~T4~~ | ~~Hyperband riêng~~ | ❌ Cắt | — | — | Đã nằm trong T2 qua ASHA pruner |
| ~~T5~~ | ~~Grid Search~~ | ❌ Cắt | — | — | Bùng nổ tổ hợp, không hiệu quả hơn random search |

⭐ **Quy tắc quan trọng nhất:** chỉ tune model **thắng ở vòng mặc định**, không tune tất cả. Tune sâu 1 model tốt có giá trị hơn tune nông 4 model.

**Ngân sách:** 100 trial cho T2. Vẽ đường hội tụ — nếu phẳng từ trial 30 thì **dừng**, đừng chạy cho hết.

### 6.2 Quy tắc so sánh công bằng

- Cả 4 phương pháp chạy trên **cùng không gian tìm kiếm**, **cùng bộ fold**, **cùng seed**.
- Báo cáo **cả metric lẫn chi phí**: kết quả tốt nhất đạt được **và** tổng thời gian tính toán. T3 hơn T2 0.3% nhưng tốn gấp 5 lần thời gian thì kết luận thực tế là **T2 thắng**.
- Vẽ đường hội tụ: metric tốt nhất theo số lần thử. Nếu đường phẳng từ lần thử thứ 20 → tăng ngân sách là lãng phí.
- Tuning chỉ chạy trên **vòng trong của nested CV** ([01 §7.3](01-chien-luoc-du-lieu.md#73-nested-cv-khi-tuning)).

### 6.3 Không gian tìm kiếm khởi điểm (XGBoost/LightGBM)

```python
{
  "n_estimators":      (100, 2000),      # log-uniform
  "learning_rate":     (0.005, 0.3),     # log-uniform
  "max_depth":         (3, 10),
  "min_child_weight":  (1, 20),
  "subsample":         (0.5, 1.0),
  "colsample_bytree":  (0.5, 1.0),
  "reg_alpha":         (1e-4, 10.0),     # log-uniform
  "reg_lambda":        (1e-4, 10.0),     # log-uniform
}
```

Dữ liệu ít → **ưu tiên vùng chính quy hoá mạnh**: `max_depth` nhỏ, `reg_lambda` lớn, `learning_rate` nhỏ kèm `n_estimators` lớn + early stopping.

---

## 7. Ensemble — sau khi đã chọn được model đơn lẻ

Chỉ làm **sau khi** đã có model đơn lẻ tốt nhất, và chỉ giữ nếu thực sự tốt hơn rõ rệt (ensemble làm hệ thống phức tạp hơn khi vận hành — phải xứng đáng).

| # | Phương pháp | Cách làm |
|---|---|---|
| E1 | **Trung bình đơn giản** | Trung bình dự báo của top-3 model. Đơn giản, thường hiệu quả bất ngờ |
| E2 | **Trung bình có trọng số** | Trọng số tỉ lệ nghịch với sai số validation |
| E3 | **Stacking** | Meta-model (Ridge) học trên **dự báo out-of-fold** của các model cơ sở. ⚠️ Phải dùng OOF từ rolling-origin, dùng dự báo in-sample là rò rỉ |
| E4 | **Ensemble theo chế độ** | Model khác nhau cho mùa cao điểm/thấp điểm, hoặc theo vùng miền. Chỉ làm nếu §4.2 cho thấy model mạnh yếu khác nhau rõ giữa các chế độ |

**Ngưỡng chấp nhận:** ensemble chỉ được chọn nếu cải thiện ≥ 3% MASE so với model đơn lẻ tốt nhất, **và** ổn định qua các origin (không phải thắng nhờ 1 origin may mắn).

---

## 8. Giải thích model (Explainability)

Không phải mục "làm cho đẹp" — bản thuyết minh đã cam kết Explainable AI với khách hàng B2G, và cán bộ y tế sẽ không ký duyệt một lệnh điều phối mà họ không hiểu vì sao.

- **SHAP values** — độ quan trọng đặc trưng toàn cục + giải thích từng dự báo cụ thể ("tỉnh X rủi ro cao vì mưa 3 tháng trước + động lượng ca bệnh tăng")
- **Partial Dependence Plot** — quan hệ nhiệt độ/mưa với rủi ro có khớp hiểu biết sinh học về vòng đời muỗi không? Nếu model học ra quan hệ ngược đời → dấu hiệu dữ liệu có vấn đề
- **Đối chiếu chuyên môn:** Minh Dương (nền y sinh) rà soát top-20 đặc trưng quan trọng. Feature vô lý về mặt sinh học nhưng quan trọng về mặt thống kê = cờ đỏ, thường là rò rỉ

---

## 9. Model card (bắt buộc trước khi promote)

Mỗi model được chọn phải có `docs/model-cards/<model-id>.md`:

```markdown
# Model Card: forecast-xgb-v1.2.0

## Thông tin
- Run ID (MLflow): abc123    - Data version: v1.0.0    - Commit: e4d5981
- Ngày train: 2026-10-15     - Horizon: h=1,2,3,6

## Dữ liệu
- Train: 2001-2016 | Validation: 2017-2020 | Test: 2021-2024 (chạm 1 lần, ngày 2026-11-20)
- Tỉ lệ dữ liệu thật: 87.3%   - Đơn vị không gian: 34 tỉnh (chuẩn 2025)

## Kết quả (tập test, chạm 1 lần)
| Horizon | MASE | MAE | PR-AUC | Recall@P=0.8 | Base rate |
|---------|------|-----|--------|--------------|-----------|
| h=1     |      |     |        |              |           |
| h=3     |      |     |        |              |           |
| h=6     |      |     |        |              |           |

## Hạn chế đã biết
- (ví dụ) Kém ở tỉnh miền núi phía Bắc, dữ liệu lịch sử thưa
- (ví dụ) Chưa xử lý revision của số liệu công bố
- (ví dụ) Chưa kiểm chứng ngoài Việt Nam

## Không nên dùng để
- (ví dụ) Dự báo cấp xã — model train ở cấp tỉnh
- (ví dụ) Ra quyết định lâm sàng cho cá nhân người bệnh
```

---

## 10. Cổng quyết định — điều kiện promote model

Model **chỉ** được đưa vào `ai-service` production khi đạt **tất cả** các điều kiện:

| # | Điều kiện | Ngưỡng |
|---|---|---|
| G1 | Thắng seasonal naive | MASE < 0.90 ở h=1 và h=3 (tức tốt hơn ≥10%) |
| G2 | Ổn định giữa các origin | Độ lệch chuẩn MASE giữa các origin < 0.15 |
| G3 | Hữu dụng cho cảnh báo | Recall ≥ 0.70 tại Precision ≥ 0.70 |
| G4 | Không thiên lệch hệ thống | \|Bias\| < 10% giá trị trung bình thực tế |
| G5 | Đủ độ vững | Nhiễu khí hậu ±10% → MASE tăng < 20% |
| G6 | Có model card đầy đủ | Đã điền hết, đã review chéo |
| G7 | Tái lập được | Người còn lại chạy lại từ commit + data version → ra cùng kết quả (sai khác < 1%) |

> **Nếu không đạt G1** (không thắng nổi baseline): đó là một **kết quả nghiên cứu hợp lệ**, không phải thất bại. Xử lý đúng đắn là báo cáo trung thực và điều tra nguyên nhân (dữ liệu quá thô? tín hiệu khí hậu yếu ở cấp tỉnh? cần độ phân giải không gian mịn hơn?) — **không phải** thử metric khác cho tới khi ra số đẹp. Chọn metric sau khi nhìn kết quả là hành vi làm hỏng toàn bộ giá trị của quy trình này.
