# 07 — Model Card: DengueSense Layer 1 (dự báo sốt xuất huyết theo tỉnh)

> Tài liệu này gom **mọi con số đã đo** và **mọi giới hạn đã biết** của Layer 1 vào một chỗ, để bất kỳ ai (hội đồng, đối tác y tế,
> người vận hành) biết mô hình làm được gì, không làm được gì, và dựa trên bằng chứng nào. Mỗi con số có nguồn (experiment) để kiểm chứng.
> Nguồn sự thật cho bảng xếp hạng: [MODEL_ZOO_RESULTS.md](../ai-service/experiments/MODEL_ZOO_RESULTS.md). Nhật ký từng bước:
> [PROGRESS_LOG.md](../PROGRESS_LOG.md). Cập nhật: 2026-09-25, panel v0.2.0.

---

## 1. Tóm tắt một đoạn

Layer 1 dự báo **số ca sốt xuất huyết/100k dân theo tháng cho 34 tỉnh, ở 4 horizon (1, 2, 3, 6 tháng)** và cho ra **xác suất tháng dự
báo vượt ngưỡng P75 lịch sử của chính tỉnh đó**. Bản hiện hành (**M4-R2**) là ensemble của GLM NegBin + XGBoost + LightGBM, định
tuyến theo vùng. **Điểm mạnh:** thắng mốc mạnh nhất 15–23% ở mọi horizon; có kỹ năng thật ở miền Nam và miền Trung; khái quát sang tỉnh
chưa thấy khi train gần như không mất chất lượng (+0.9%); chịu được nhiễu/khuyết dữ liệu khí hậu nếu có bước điền khuyết. **Giới hạn
chính:** chưa thắng seasonal-naive ở miền Bắc và ở dự báo 6 tháng; dự báo thấp có hệ thống khi bùng dịch; cảnh báo chỉ đạt ROC-AUC
~0.76 (dưới mốc D-MOSS 0.83) và chưa đạt precision 0.8 ở recall hữu ích; toàn bộ đánh giá dựa trên **một mùa dịch, dữ liệu thật kết
thúc 2010**.

## 2. Mục đích sử dụng

| | |
|---|---|
| **Dùng cho** | Hỗ trợ ra quyết định của cán bộ y tế (human-in-the-loop): đầu vào cho Layer 2 (phân bổ nguồn lực) và tín hiệu cảnh báo sớm để **kiểm tra thêm**, không thay thế phán đoán chuyên môn. |
| **KHÔNG dùng cho** | Ra quyết định tự động không có người xem xét; dự báo cấp huyện/xã (chưa kiểm chứng); dự báo cá nhân; dùng trực tiếp trên dữ liệu sau 2010 mà chưa huấn luyện lại (xem §3, §11-L8); khẳng định "báo trước 5–9 tuần" như một khả năng chung (xem §7.3). |
| **Người dùng dự kiến** | Trung tâm kiểm soát bệnh tật cấp tỉnh/khu vực; nhóm phát triển Layer 2. |

## 3. Dữ liệu

- **Panel v0.2.0:** 9.326 dòng (34 tỉnh × tháng), sinh lại bằng 1 lệnh (`python -m app.data.build_panel`). Nguồn: OpenDengue (ca bệnh),
  ERA5-Land (nhiệt/mưa/ẩm), WorldPop (dân số), NOAA ONI. Chi tiết, giấy phép, bẫy đã gặp: [data-sources/](data-sources/).
- **34 tỉnh** theo ranh giới hành chính sau sáp nhập (crosswalk từ 63 tỉnh cũ, xem [01](01-chien-luoc-du-lieu.md)).
- **Dữ liệu dùng để huấn luyện và đánh giá: CHỈ `data_source == "real"`, 1994-02 → 2010-12.** Giai đoạn 2011–2025 ở cấp tỉnh chỉ là
  ước lượng (`estimated`, tổng quốc gia × tỉ trọng lịch sử) nên **bị loại khỏi cả huấn luyện lẫn đánh giá** — không được gộp chung với dữ
  liệu thật (docs/01 §2.1c, §8).
- **Hệ quả:** mô hình chưa từng thấy dữ liệu sau 2010, chưa thấy các đợt dịch/khí hậu hiện đại (2019, 2022–2023).

## 4. Mô hình

| Thành phần | Mô tả |
|---|---|
| **M4-R2** (`app/forecast/m4.py::predict_m4`) | (M1 + 2·GBM)/3. **M1** = GLM Negative Binomial, hiệu ứng cố định theo tỉnh, offset log dân số. **GBM** = trung bình XGBoost + LightGBM (Poisson, tham số mặc định T1). Định tuyến theo vùng: **Bắc** dùng biến thể scale-aware (dự báo tỉ lệ so với quy mô lịch sử của tỉnh) + Tweedie; **Trung** GBM chuẩn; **Nam** GBM chuẩn pha 50% với Climatology (trung bình lịch sử cùng tháng). |
| **17 đặc trưng T1** | Mùa vụ (sin/cos), khí hậu lag 1–2 tháng + trung bình trượt 3 tháng, ca bệnh lag 2–3 + đà tăng, ONI lag 3/6, chuẩn mùa vụ của tỉnh. Mọi đặc trưng **nhân quả**, tôn trọng độ trễ báo cáo 1 tháng. |
| **Direct multi-horizon** | Mỗi horizon 1 model riêng, đặc trưng neo tại origin (không đệ quy). |
| **Cảnh báo** (`app/forecast/alerting.py`, exp_012) | Classifier nhị phân riêng (XGBoost + LightGBM, T1) cho "tháng dự báo có vượt P75 của tỉnh đó cho tháng đó không", nhãn nhân quả; xác suất hiệu chỉnh isotonic **trực tuyến** (chỉ dùng kết quả đã trưởng thành). |
| **Điền khuyết khí hậu** (`features.impute_climate_causal`) | Bắt buộc khi dữ liệu khí hậu thiếu: thay bằng trung bình cùng tháng dương lịch các năm trước (nhân quả). |
| **Đã thử và LOẠI** | M3 hhh4 (thua mọi model kể cả có khí hậu, MASE h=6 2.23); tuning Optuna T2 (không cải thiện, đã kiểm chứng 2 lần); đặc trưng không gian (M4 chỉ cải thiện 0.3%, 15/32 fold). |

## 5. Giao thức đánh giá

Rolling-origin, cửa sổ mở rộng, **8 origin** (train_end 2009-11 → 2010-06), horizon {1, 2, 3, 6}, embargo 1 tháng, độ trễ báo cáo 1 tháng.
Tập test **100% real** (có `assert_test_is_real_only`). Metric chính **MASE** (mẫu số = sai số seasonal-naive trên phần train của từng
origin; **MASE < 1 = thắng seasonal-naive**). Mọi lựa chọn (tuning, biến thể, hiệu chỉnh, định tuyến) được quyết định bằng **cửa sổ
validation riêng (10 origin ≤ 2008-12)** với quy tắc khai báo trước; outer chỉ để báo cáo. Chống rò rỉ: một lỗi rò rỉ tương lai thật (exp_002) và nhiều
lỗi dữ liệu/đơn vị khác đã bắt và sửa trong quá trình (xem PROGRESS_LOG); các hàm đặc trưng đều có test nhân quả.

## 6. Hiệu năng — dự báo số ca (bài toán A)

**MASE trung bình qua 8 origin (thấp hơn = tốt hơn):**

| Model | h=1 | h=2 | h=3 | h=6 |
|---|---|---|---|---|
| B2 Seasonal naive (mốc quy ước) | 0.739 | 1.028 | 1.399 | 1.998 |
| B3 Climatology (mốc thực tế mạnh nhất) | 0.522 | 0.757 | 1.069 | 1.638 |
| M1 GLM NegBin | 0.497 | 0.736 | 1.138 | 1.644 |
| M2b LightGBM (đơn lẻ tốt nhất) | 0.447 | 0.694 | 1.001 | 1.608 |
| M3 hhh4 (+khí hậu) | 0.542 | 1.014 | 1.477 | 2.232 |
| M4 ensemble (exp_005) | 0.429 | 0.671 | 0.898 | 1.479 |
| **M4-R2 (hiện hành, exp_008)** | **0.404** | **0.625** | **0.851** | **1.394** |
| Cải thiện so với B3 | −23% | −17% | −20% | −15% |

- **Cổng G1** (docs/02 §10: MASE < 0.90 ở cả h=1 và h=3): **đạt** (0.404 và 0.851).
- **Theo vùng** (mẫu số riêng từng vùng — kỹ năng thật): **Nam 0.722**, **Trung 0.904**, **Bắc 1.373 (thua seasonal-naive)**.
- **Ổn định:** M4-R2 tốt hơn M4-R ở 27/32 fold; độ lệch chuẩn giữa các origin lớn (xem `results.json` từng experiment) nên chênh lệch nhỏ
  giữa các model không có ý nghĩa thống kê.

## 7. Hiệu năng — cảnh báo vượt ngưỡng P75 (bài toán B)

Base rate ở tập đánh giá: **0.351** (0.31–0.40 tuỳ horizon).

| | Gộp | h=1 | h=2 | h=3 | h=6 |
|---|---|---|---|---|---|
| **ROC-AUC** (classifier, exp_012) | **0.758** | 0.796 | 0.739 | 0.738 | 0.748 |
| PR-AUC | 0.646 | 0.688 | 0.635 | 0.616 | 0.637 |

Gộp: Recall @ Precision 0.8 = **0.30**; Precision @ Recall 0.8 = **0.47**; Brier 0.197; ECE 0.089 (sau hiệu chỉnh trực tuyến).
Theo vùng (ROC-AUC): **Bắc 0.839 · Trung 0.766 · Nam 0.597 (gần ngẫu nhiên)**.

**7.1** Hiệu chỉnh xác suất cắt Brier ~25% (đuôi Poisson thô cực kỳ quá tự tin, ECE 0.26 → 0.08–0.10) nhưng **không cải thiện khả năng
phân biệt** (exp_011). **7.2** So với mốc D-MOSS (0.83–0.94): **chưa đạt** (mốc đo trên định nghĩa/dữ liệu khác nên chỉ tham chiếu).
**7.3 Lead time:** với ngưỡng tin cậy cao chỉ **37% sự kiện vượt ngưỡng được báo trước**, trung vị 2 tháng (~9 tuần) *trong số đã phát
hiện*, trên 1 mùa dịch (exp_011). **Không được phát biểu "báo trước 5–9 tuần" như khả năng chung.**

## 8. Độ vững (exp_010)

Mô hình huấn luyện trên dữ liệu sạch, đầu vào lúc dự báo bị nhiễu/khuyết; MASE gộp sạch = 0.8185.

| Điều kiện | MASE gộp | Thay đổi |
|---|---|---|
| Nhiễu khí hậu 5% | 0.832 | +1.7% |
| Nhiễu khí hậu 10% | 0.853 | +4.3% (h=1 +15%) |
| Khuyết 10% (không xử lý) | 0.868 | +6.0% (Trung +12%, bùng dịch +15%) |
| Khuyết 20% (không xử lý) | 0.888 | +8.5% (Trung +17%, bùng dịch +24%) |
| **Khuyết 10% + điền khuyết nhân quả** | **0.819** | **+0.0%** |
| **Khuyết 20% + điền khuyết nhân quả** | **0.822** | **+0.5%** |

Vẫn thắng seasonal-naive (MASE gộp < 1) ở **mọi** điều kiện thử. **Khuyến nghị vận hành:** điền khuyết nhân quả là bước bắt buộc.

## 9. Khái quát hoá

- **Sang tỉnh chưa thấy (LOPO, exp_006):** bỏ hẳn 1 tỉnh khỏi tập huấn luyện chỉ kém **+0.9%** (ensemble GBM; h=1 +5%, h≥2 ≈ 0); 9/34 tỉnh còn
  tốt hơn. Ủng hộ luận điểm nhân rộng, **kèm điều kiện tỉnh mới có lịch sử địa phương** để tính lag/quy mô. M1 (hiệu ứng cố định theo tỉnh)
  không dự báo được tỉnh lạ nên không tham gia; kịch bản không có lịch sử nào chưa kiểm tra.
- **Sang thời gian khác — RỦI RO CHÍNH:** dịch chuyển phân phối theo thời gian xuất hiện ở MỌI so sánh (tuning không tổng quát, base rate
  cảnh báo 0.18 → 0.35, validation phóng đại lợi ích). Mô hình chưa được kiểm chứng ngoài 1994–2010.

## 10. Giải thích (SHAP, exp_014)

Hồi quy dựa vào 3 trụ: **ca bệnh gần đây (26–39%), chuẩn mùa vụ của tỉnh (12–28%), khí hậu (23–28%)**; tín hiệu mùa vụ tăng theo horizon
(9% → 20%); ONI chỉ 4–6%. LightGBM/XGBoost đồng thuận (tương quan hạng 0.94–1.0); chiều tác động hợp lý dịch tễ. Classifier dựa vào
quy mô/ngưỡng của tỉnh (38–48%) và ONI (10–15%, **có thể tương quan giả trong 1 mùa** — ONI là biến toàn cầu). SHAP đo mức dựa vào đặc
trưng, **không phải nhân quả**. Giải thích từng dự báo có sẵn (`explain.py`).

## 11. Giới hạn đã biết (đo được)

| # | Giới hạn | Số đo | Nguồn |
|---|---|---|---|
| L1 | **Miền Bắc chưa thắng seasonal-naive** | MASE 1.373 (89% quan sát < 1/100k; sau khi sửa từ 1.755) | exp_006, 007, 008 |
| L2 | **Dự báo 6 tháng chưa hơn mốc nào** | MASE 1.39 (>1); B3 1.64 | exp_008 |
| L3 | **Dự báo thấp có hệ thống khi bùng dịch** | bias ≈ −15.5 ca/100k; MASE bùng dịch 2.5 vs 0.5 tháng thường; đã thử quy mô, isotonic, Tweedie, trọng số, không gian — không sửa được | exp_006–009 |
| L4 | **Cảnh báo dưới mốc tham chiếu** | ROC-AUC 0.76 (< 0.83); Recall@P0.8 = 0.30 | exp_012, 013 |
| L5 | **Miền Nam gần ngẫu nhiên khi phân loại** | ROC-AUC 0.60 dù MASE hồi quy tốt nhất (0.72) | exp_012 |
| L6 | **Lead time yếu** | 37% sự kiện được báo trước, trung vị 2 tháng, 1 mùa | exp_011 |
| L7 | **Chỉ 1 mùa dịch, 34 tỉnh, 8 origin** | chưa có khoảng tin cậy; chênh lệch ROC ±0.01 là nhiễu | mọi exp |
| L8 | **Dữ liệu thật kết thúc 2010** | chưa kiểm chứng trên 2011+, năm bất thường 2020–21, 2023 (docs/02 §4.4) | docs/01 §8 |
| L9 | **Dịch chuyển phân phối theo thời gian** | base rate 0.18 → 0.35; tham số/ hiệu chỉnh tối ưu ở quá khứ không chuyển sang giai đoạn sau | exp_003, 011, 012 |
| L10 | **Lag theo số dòng, không theo tháng lịch** | 5/34 tỉnh có 1–2 tháng thiếu → 2.2% dòng có ≥1 đặc trưng lệch; **đã đo: ảnh hưởng MASE gộp +0.17% (≤ ±1% mọi horizon)**, không đổi kết luận. Bản sửa có sẵn (`calendarize=True`); số công bố giữ nguyên | exp_009, 015 |
| L11 | **Chưa kiểm** | gián đoạn khí hậu liên tục 2–3 tháng; nhiễu ở dữ liệu huấn luyện; nhiễu có tương quan | exp_010 |
| L12 | **M1 là hiệu ứng cố định, không phải phân cấp thật** | không dự báo tỉnh lạ; nâng cấp qua glmmTMB/PyMC chưa làm | exp_002 |

## 12. Khuyến nghị vận hành

1. **Luôn hiển thị base rate** kèm xác suất cảnh báo; không trình bày "xác suất" mà không nói mức nền.
2. **Hiệu chỉnh lại xác suất định kỳ** (isotonic trực tuyến, chỉ dùng kết quả đã trưởng thành); base rate đổi theo năm.
3. **Điền khuyết nhân quả** trước khi dựng đặc trưng; theo dõi tỉ lệ dữ liệu khí hậu thiếu.
4. **Nêu rõ độ tin cậy theo vùng:** Nam/Trung có kỹ năng; Bắc chỉ mang tính tham khảo; cảnh báo ở Nam gần ngẫu nhiên.
5. **Nhấn mạnh có người xem xét** đối với tháng nghi bùng dịch (mô hình dự báo thấp có hệ thống ở đó).
6. **Chạy lại toàn bộ đánh giá khi có dữ liệu thật mới** (NSO cấp tỉnh hoặc dữ liệu HCDC): đây là bước có tác động lớn nhất tới độ tin cậy.

## 13. Tái lập

```bash
cd ai-service
python -m app.data.build_panel                                # sinh panel v0.2.0 (9.326 dòng)
python experiments/exp_005_m4_ensemble/run.py                 # M4 ensemble
python experiments/exp_008_outbreak_north/verify_m4_equivalence.py   # predict_m4 khớp exp_008
python experiments/exp_010_robustness/run.py && python experiments/exp_010_robustness/analyze.py
python experiments/exp_011_alerting/run.py && python experiments/exp_011_alerting/analyze.py
pytest -q                                                     # 138 test
```

Seed cố định 42. Mỗi experiment có `config.yaml`, `RESULTS.md`, `results.json`/`predictions.json`, `analysis_output.txt`. Không có bước nào
dùng dữ liệu `estimated`/`imputed`/`simulated` làm biến mục tiêu ở tập test.

## 14. Lịch sử thay đổi

- 2026-09-25: bản đầu (M4-R2, cảnh báo classifier, độ vững, SHAP). Chuỗi bằng chứng đầy đủ: exp_001 → exp_015.
