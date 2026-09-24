# exp_016 — Đánh giá NHIỀU MÙA (2005–2010): mùa 2010 là mùa KHÓ NHẤT; M4-R2 thắng B3 ở cả 6 mùa

- **Ngày chạy:** 2026-09-26 · 6 mùa × 8 origin × 4 horizon (192 fold), real-only, `calendarize=True`
- **File:** `results.json` (dự báo + cảnh báo theo mùa), `results_ablation.json`, `analysis_output.txt`, `analysis_output_ablation.txt`
  (`run.py`, `analyze.py`, `run_ablation.py`, `analyze_ablation.py`). Khung dùng lại: `app/forecast/multiseason.py` (6 test),
  `app/forecast/alert_classifier.py` (3 test).

> Xem [MODEL_ZOO_RESULTS.md](../MODEL_ZOO_RESULTS.md), [docs/07-model-card.md](../../../docs/07-model-card.md), [docs/08-ban-giao-layer1.md](../../../docs/08-ban-giao-layer1.md).

## Câu hỏi

Mọi đánh giá trước đó chỉ có **một mùa** (2010: 8 origin, target 2009-12→2010-12). Kết quả đổi thế nào giữa các năm? Chênh lệch ±1% có ý nghĩa
không? Con số "headline" (MASE 0.404/0.625/0.851/1.394; ROC-AUC cảnh báo 0.758; Bắc >1) đại diện cho hiệu năng điển hình hay chỉ một năm?

## Thiết lập

- Mùa Y: 8 origin, `train_end` từ (Y−1)-11 đến Y-06, target ≤ Y-12; mỗi origin huấn luyện CHỈ trên dữ liệu ≤ `train_end`. Mùa 2010 = outer cũ.
- Đánh giá M4-R2 (`predict_m4`), B3 (climatology), B2 (seasonal naive = giá trị cùng tháng năm trước), classifier cảnh báo; MASE mẫu số theo origin.
- Thống kê: bootstrap có hoàn lại **theo origin** (5000 lần) + kiểm định dấu. **Lạc quan** vì origin liền kề cùng mùa tự tương quan — đọc cùng biến thiên giữa mùa.
- **Sanity:** mùa 2010 khớp `exp_015` **tuyệt đối** (1088 dòng, sai lệch 0.0); cấu hình M4-R2 trong ablation khớp `results.json` tuyệt đối (6528 dòng).

### ⚠️ Cảnh báo về tính "sạch" của các mùa

**Không mùa nào hoàn toàn sạch cho M4-R2:** thiết kế (định tuyến vùng, đòn bẩy, dùng classifier) được chọn trên cửa sổ validation ≤2008-12 và outer 2010. Do đó
số tuyệt đối ở mùa 2005–2008 **lạc quan** (nằm trong cửa sổ đã dùng để chọn), mùa 2009 một phần. Ngược lại **baseline B2/B3 không bị nhiễm** (không fit theo mùa nào) nên
cho biết độ khó tương đối thật của từng mùa; và mức cải thiện so với B3 ở mùa 2009–2010 ít nhiễm nhất.

## Kết quả 1 — Dự báo số ca (MASE gộp mọi horizon; thấp = tốt)

| Mùa | M4-R2 | B3 | B2 | M4-R2 vs B3 |
|---|---|---|---|---|
| 2005 | 0.429 | 0.556 | 0.569 | +22.8% |
| 2006 | 0.320 | 0.523 | 0.393 | +38.8% |
| 2007 | 0.566 | 0.754 | 0.747 | +25.0% |
| 2008 | 0.502 | 0.658 | 0.891 | +23.7% |
| 2009 | 0.453 | 0.597 | 0.673 | +24.2% |
| **2010** | **0.820** | **0.996** | **1.291** | **+17.7%** |
| **TB ± sd** | **0.515 ± 0.170** | | | |

- **2010 là mùa khó nhất với TẤT CẢ model** (M4-R2 0.820; B3 0.996; B2 1.291) → **con số headline của dự án (mùa 2010) là kịch bản BI QUAN**, không phải điển hình. Các mùa còn
  lại M4-R2 đạt 0.32–0.57. Đây không phải do thiếu dữ liệu (mùa muộn có nhiều dữ liệu huấn luyện hơn) mà do bản chất dịch tễ (mùa 2009–2010 có đợt dịch mạnh, đặc biệt miền Bắc).
- **M4-R2 thắng B3 ở CẢ 6/6 mùa, ở cả 4 horizon** (24/24 ô mùa×horizon). Theo horizon (TB 6 mùa): h=1 0.319, h=2 0.411, h=3 0.523, **h=6 0.807** — h=6 có MASE < 1 ở **5/6 mùa** (chỉ 2010 = 1.389 > 1).
- **Khoảng tin cậy 95% (bootstrap theo origin) của cải thiện M4-R2 so với B3:** gộp **+22.2% [18.2%, 26.0%]**, thắng **45/48 origin**; h=1 +27.1% [21.9, 32.2] (44/48); h=2 +19.8% [13.1, 26.1] (39/48);
  h=3 +19.1% [12.0, 25.7] (40/48); h=6 +16.1% [10.5, 21.3] (41/48). Kiểm định dấu p ≤ 1.6·10⁻⁵ ở mọi horizon (h=2 yếu nhất: 39/48).

## Kết quả 2 — Theo vùng (mẫu số riêng từng vùng)

| Mùa | Bắc M4-R2 (B3) | Trung M4-R2 (B3) | Nam M4-R2 (B3) |
|---|---|---|---|
| 2005 | 0.398 (0.477) | 0.350 (0.619) | 0.555 (0.518) |
| 2006 | 0.399 (0.603) | 0.270 (0.630) | 0.394 (0.416) |
| 2007 | 0.378 (0.530) | 0.246 (0.417) | 0.996 (1.219) |
| 2008 | 0.342 (0.574) | 0.206 (0.536) | 0.872 (0.833) |
| 2009 | **2.404 (2.601)** | 0.293 (0.490) | 0.511 (0.603) |
| 2010 | **1.338 (1.089)** | 0.902 (1.295) | 0.731 (0.730) |
| TB ± sd | 0.877 ± 0.841 | 0.378 ± 0.261 | 0.676 ± 0.230 |
| số mùa < 1 (thắng seasonal-naive) | **4/6** | 6/6 | 6/6 |
| số mùa thắng B3 | 5/6 | **6/6** | **3/6** |

- **"Miền Bắc thua seasonal-naive" chỉ đúng ở 2 mùa dịch miền Bắc (2009: 2.40; 2010: 1.34)**; 4 mùa còn lại M4-R2 rất tốt (0.34–0.40, gần một nửa B3). Kể cả B3 cũng thất bại ở 2009 (2.60): các mùa
  dịch bất thường không lặp lại mùa vụ lịch sử. **Điểm yếu thật là "năm dịch bất thường", không phải "miền Bắc nói chung".**
- **Miền Trung mạnh nhất và ổn định** (6/6 mùa thắng cả seasonal-naive lẫn B3).
- **Miền Nam: chỉ thắng seasonal-naive (6/6) nhưng HÒA với B3 (thắng 3/6 mùa)** — kết luận "có kỹ năng thật ở Nam" chỉ đúng so với seasonal-naive, không so với climatology (phù hợp thiết kế: Nam pha 50% B3).

## Kết quả 3 — Bùng dịch (M4-R2, tháng > P90 của tỉnh)

| Mùa | Bias (ca/100k) | Tỉ lệ dự báo < 50% thực tế |
|---|---|---|
| 2005 | −3.6 | 49% |
| 2006 | −9.1 | 53% |
| 2007 | −21.3 | 47% |
| 2008 | **−37.5** | **98%** |
| 2009 | −9.7 | 73% |
| 2010 | −15.4 | 46% |

Dự báo thấp khi bùng dịch **có ở MỌI mùa** (bias luôn âm) nhưng độ nặng biến thiên mạnh (−3.6 → −37.5); mùa 2010 (−15.4) là mức trung bình chứ không phải tệ nhất (2008 tệ nhất). Đây là điểm yếu **hệ thống**, không phải nhiễu một mùa.

## Kết quả 4 — Cảnh báo (classifier, ngưỡng P75)

| Mùa | Base rate | ROC-AUC | PR-AUC |
|---|---|---|---|
| 2005 | 0.131 | 0.794 | 0.423 |
| 2006 | 0.166 | 0.840 | 0.566 |
| 2007 | 0.266 | 0.835 | 0.640 |
| 2008 | 0.176 | 0.768 | 0.433 |
| 2009 | 0.274 | **0.857** | 0.715 |
| **2010** | 0.351 | **0.757** | 0.642 |
| **TB ± sd** | | **0.809 ± 0.041** | |

- **Mùa 2010 (headline 0.758) là mùa CẢNH BÁO TỆ NHẤT**; trung bình 6 mùa **0.809 ± 0.041**; **3/6 mùa đạt mốc D-MOSS 0.83** (2006, 2007, 2009). Kết luận "dưới mốc" chỉ đúng cho mùa khó nhất.
- Theo horizon (ROC TB 6 mùa): h=1 **0.861**, h=2 0.826, h=3 0.806, h=6 0.754. Theo vùng (TB ± sd): **Bắc 0.845 ± 0.032** (ổn định, ≥ 0.79 mọi mùa), Nam 0.729 ± 0.087, Trung 0.694 ± 0.091 (2005 chỉ 0.527).
  → hình ảnh "Nam gần ngẫu nhiên" (0.60) là của mùa 2010; TB Nam 0.73.
- **Base rate tăng dần theo thời gian** (0.13 → 0.35) dù ngưỡng là P75: dịch chuyển phân phối theo thời gian được xác nhận qua 6 năm (không chỉ một cặp validation/outer) → hiệu chỉnh xác suất phải làm lại định kỳ.

## Kết quả 5 — Ablation định tuyến vùng (exp_016b): thiết kế KHÁI QUÁT hoá

M4-R2 (định tuyến Bắc + Nam) vs `no_routing` (GBM chuẩn mọi vùng) qua 6 mùa (MASE gộp TB): no_routing 0.550 · bac_only 0.535 · nam_only 0.530 · **M4-R2 0.515**.

- **M4-R2 hơn no_routing +6.9% (CI95 +5.0% … +8.7%), thắng 41/48 origin** (p dấu 6·10⁻⁷); tốt hơn ở 5/6 mùa (2007 hòa: −0.15%).
- **Định tuyến Bắc (scale-aware + Tweedie): thắng 6/6 mùa**, MASE vùng Bắc giảm TB **−43%** (vd 2005: 1.119 → 0.398; 2009: 2.702 → 2.404; 2010: 1.747 → 1.338). Bằng chứng mạnh nhất
  rằng cải tiến "dự báo tỉ lệ so với quy mô tỉnh" là THẬT và không phải tối ưu riêng cho 2010 (2009–2010 ít nhiễm nhất vẫn thắng).
- **Định tuyến Nam (pha 50% B3): thắng 4/6 mùa, TB −6.9%** vùng Nam; hại nhẹ ở 2007 (0.951 → 0.996) và 2009 (0.506 → 0.511) → có lợi trung bình nhưng KHÔNG chắc chắn từng mùa.

## Điều bất ngờ / nghi vấn ⭐

- **Headline đã bi quan hơn thực tế điển hình**: mùa 2010 là mùa khó nhất cho cả dự báo lẫn cảnh báo. Chọn 2010 làm outer duy nhất (vì đó là những tháng cuối của dữ liệu real) đã vô tình
  chọn ĐÚNG mùa khó nhất. Các kết luận "âm tính" (Bắc >1, ROC 0.76, h=6 >1) cần đọc lại có điều kiện theo mùa.
- **Các thí nghiệm âm tính trước đây (tuning T2, đòn bẩy…) được đánh giá trên đúng mùa khó nhất** — kết luận "không cải thiện" có thể khác ở các mùa dễ hơn; chưa kiểm lại.
- Khoảng tin cậy bootstrap theo origin **lạc quan** (tự tương quan). Biến thiên giữa mùa (sd 0.17 trên MASE trung bình 0.515) mới là thước đo thực: chênh lệch ±1% giữa các model vẫn là nhiễu.

## Hạn chế đã biết

- **Nhiễm thiết kế** ở mùa ≤2009 (xem ⚠️ trên): số tuyệt đối 2005–2008 lạc quan; dùng để đo ĐỘ BIẾN THIÊN, không công bố như "kết quả chưa từng thấy".
- Chỉ 6 mùa (dữ liệu real 1994–2010); 2 mùa dịch miền Bắc → kết luận về "năm dịch bất thường" dựa trên 2 mẫu.
- Số dữ liệu huấn luyện thay đổi theo mùa (mùa 2005 có ~11 năm, 2010 có ~16 năm) — đồng biến với độ khó nhưng không phải nguyên nhân (mùa muộn khó hơn dù nhiều dữ liệu hơn).
- Classifier cảnh báo dùng T1 mặc định; chưa hiệu chỉnh xác suất theo mùa ở khung này (chỉ ROC/PR-AUC).

## Quyết định / hệ quả

- **Model card và tài liệu bàn giao được hiệu chỉnh** theo bằng chứng đa mùa (số liệu 2010 = kịch bản bi quan; nêu cả TB±sd 6 mùa; sửa các phát biểu về miền Bắc, Nam, h=6, mốc D-MOSS).
- **Giữ M4-R2 và định tuyến vùng** (đã khái quát hoá); nêu rõ Nam-B3 là lợi ích trung bình, không chắc chắn từng mùa.
- Mọi thí nghiệm cải tiến từ nay nên báo cáo **kết quả theo từng mùa** (dùng `multiseason.py`), không chỉ mùa 2010.

## Việc tiếp theo

- [ ] Chạy lại các đòn bẩy âm tính (tuning T2, cảnh báo) trên khung nhiều mùa: có thể khác ở mùa dễ.
- [ ] Bootstrap theo mùa/khối (block) thay vì theo origin để khoảng tin cậy bớt lạc quan.
- [ ] Phân tích "năm dịch bất thường" (2009 Bắc): điều gì làm cả model lẫn B3 thất bại? (cần dữ liệu tuần/nguồn mới).
