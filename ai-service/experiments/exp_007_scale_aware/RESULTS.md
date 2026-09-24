# exp_007 — Sửa điểm yếu M4 (exp_006): scale-aware GBM, định tuyến theo vùng, hiệu chỉnh isotonic

- **Ngày chạy:** 2026-09-24
- **Data version:** panel v0.2.0, real-only; validation 10 origin (≤2008-12), outer 8 origin
- **File:** `results.json`, `summary.csv`, `analysis_output.txt` (tái lập bằng `run.py` + `analyze.py`)

> Xem [MODEL_ZOO_RESULTS.md](../MODEL_ZOO_RESULTS.md) cho bảng xếp hạng tổng hợp.

## Câu hỏi

exp_006 lộ 2 điểm yếu của M4: (1) thua seasonal-naive ở miền Bắc (MASE 1.755); (2) dự báo thấp khi bùng
dịch (bias −15). Chẩn đoán ban đầu: 89% quan sát miền Bắc < 1/100k (trung vị 0) — dự báo "toàn 0" cho MAE 0.674 tốt
hơn E1 (0.935); bias trái dấu giữa vùng (Trung −6.9, Nam +3.0, Bắc dương) → model pooled **không biết quy mô
riêng từng tỉnh**. Thêm thông tin quy mô có sửa được không?

## Thiết lập (khai báo trước khi chạy)

4 biến thể GBM (M2a XGBoost + M2b LightGBM, tham số T1, ensemble = trung bình 2 model):
- **V0** baseline (= exp_005/006) · **V1** +quy mô tỉnh (`prov_mean_hist`, `prov_mean_12m`, nhân quả tới t−D)
- **V2** V1 + target là tỉ lệ y/(prov_mean_hist+1), nhân lại quy mô · **V3** V2 + đặc trưng ca bệnh chia cho quy mô
- **Chọn** bằng cửa sổ VALIDATION (trung bình MASE 3 vùng, mẫu số riêng vùng), KHÔNG dùng outer. Outer báo cáo đủ.
- Đặc trưng mới có test nhân quả (`add_province_baseline_features`, 2 test).

## Kết quả

**GBM-only (outer):**

| Biến thể | MASE gộp | h=1 | h=3 | h=6 | Bắc | Trung | Nam | Bias bùng dịch |
|---|---|---|---|---|---|---|---|---|
| V0 baseline | 0.932 | 0.446 | 0.979 | 1.609 | 1.976 | 0.979 | 0.842 | −17.9 |
| V1 +quy mô | 0.982 | 0.472 | 1.092 | 1.584 | 2.244 | 1.021 | 0.884 | −18.1 |
| V2 ratio | 0.955 | 0.541 | 1.001 | 1.528 | 1.553 | 1.024 | 0.878 | −17.1 |
| **V3 ratio+rel** | 0.925 | 0.510 | 0.978 | 1.517 | 1.416 | 1.028 | 0.822 | −18.0 |

Validation chọn V3 (reg_avg 0.528 vs V0 0.616). Chỉ thêm đặc trưng quy mô (V1) **không giúp, còn tệ hơn**; phải
đổi cách dự báo sang tỉ lệ (V2/V3) mới cải thiện miền Bắc.

**M4 đầy đủ = (M1 + M2a + M2b)/3 (M1 lấy từ exp_006), outer:**

| M4 | h=1 | h=2 | h=3 | h=6 | Gộp | Bắc | Trung | Nam | Bùng dịch MASE / bias |
|---|---|---|---|---|---|---|---|---|---|
| hiện tại (V0) | 0.429 | 0.671 | 0.898 | 1.479 | 0.8693 | 1.755 | 0.904 | 0.800 | 2.555 / −15.06 |
| toàn V3 | 0.480 | 0.679 | 0.925 | 1.426 | 0.8777 | 1.366 | 0.951 | 0.802 | 2.569 / −15.12 |
| **định tuyến: Bắc→V3, còn lại V0** | **0.424** | **0.666** | **0.894** | **1.436** | **0.8552** | **1.366** | 0.904 | 0.800 | 2.552 / −15.21 |

- Toàn V3 là **đánh đổi, không phải bản sửa**: Bắc −22% và h=6 tốt hơn, nhưng h=1 kém 12%, h=3 vượt ngưỡng G1
  (0.925 > 0.90), Trung kém 5%.
- **Định tuyến theo vùng** (docs/02 §7 E4 — điều kiện "model mạnh yếu khác nhau rõ giữa các vùng" thoả theo
  exp_006): quy tắc "vùng nào V3 cải thiện >10% trên VALIDATION thì dùng V3" chọn đúng **1 vùng: Bắc**
  (validation −37.3%; Trung −3.1%, Nam +2.8% tệ hơn). Kết quả: cải thiện **mọi horizon, không hồi quy ở đâu**
  (h=1 −1.2%, h=2 −0.7%, h=3 −0.4%, h=6 −2.9%; gộp −1.6%), G1 vẫn đạt (h=3 0.894).
- Hiệu chỉnh cải thiện ở Bắc nhất quán giữa validation (−37%) và outer (−22%) → không phải may mắn outer.

**Isotonic (fit validation theo horizon) cho bias bùng dịch — ÂM TÍNH:** bias bùng dịch giảm nhẹ (−17.9→−13.1)
nhưng sai số chung tệ đi rõ (0.932→1.062; Bắc 1.98→2.58, Nam 0.84→1.15). Không dùng.

## Điều bất ngờ / nghi vấn ⭐

- **Chỉ thêm đặc trưng quy mô (V1) làm tệ đi** (Bắc 1.98→2.24): model cây trên target tuyệt đối vẫn dự báo theo
  thang chung; phải dự báo tỉ lệ mới "nhìn" quy mô. Đặc trưng ≠ cấu trúc bài toán.
- **Miền Bắc vẫn 1.366 > 1** sau khi sửa: vẫn thua seasonal-naive; 89% quan sát gần 0, chuỗi thưa+bùng phát đột
  ngột. Cải thiện thật (−22%) nhưng chưa đủ để nói M4 có kỹ năng ở miền Bắc.
- **Bias bùng dịch KHÔNG sửa được** bằng quy mô (−15) hay isotonic (hiệu chỉnh trên giai đoạn ≤2008 không chuyển
  sang 2009-2010 — cùng chủ đề dịch chuyển phân phối theo thời gian như exp_003). Giữ nguyên là hạn chế đã biết.
- **GBM nhạy với THỨ TỰ cột** (bagging/colsample): cùng tập đặc trưng, đổi thứ tự → dự báo lệch tới ~6 đơn vị/100k
  ở 1 tỉnh (phát hiện khi kiểm tra hàm `fit_predict_scale_aware` khớp exp_007; sau khi cố định thứ tự, khớp tuyệt
  đối 0.0 ở 3 origin/horizon × 2 model). Ghi vào docstring hàm.

## Hạn chế đã biết

- Quy tắc định tuyến và biến thể được chọn trên validation 10 origin — ít; 1 vùng được chọn. Outer chỉ 8 origin.
- Cải thiện gộp của định tuyến khiêm tốn (−1.6%), dưới ngưỡng 3% docs/02 §7 dùng để chọn ensemble so với model đơn;
  ở đây so với M4 hiện tại (đã là ensemble), nên chỉ coi là **tinh chỉnh không hồi quy**, không phải bước nhảy.
- Bias bùng dịch vẫn còn; định nghĩa bùng dịch là p90 theo tỉnh (xấp xỉ).

## Quyết định

- **Chấp nhận M4 định tuyến (M4-R)** thay M4 toàn cục: cải thiện mọi horizon, giữ G1, không hồi quy ở vùng nào,
  quy tắc chọn dựa trên validation. Cài đặt: `app/forecast/models.py::fit_predict_scale_aware` (khớp exp_007 tuyệt
  đối) + `app/forecast/ensemble.py::route_by_group`.
- **Không dùng** V1/V2 toàn cục, không dùng isotonic.
- Model card phải ghi rõ: miền Bắc vẫn chưa thắng seasonal-naive (1.366); bùng dịch dự báo thấp có hệ thống.

## Việc tiếp theo

- [ ] Bias bùng dịch: thử hướng khác (mục tiêu phân vị/quantile, trọng số mẫu bùng dịch, feature sớm phát hiện bùng
      dịch) — isotonic và quy mô đều không đủ.
- [ ] Miền Bắc: thử mô hình 2 giai đoạn (có/không ca → quy mô) cho chuỗi thưa.
- [ ] Robustness §4.4 (nhiễu/khuyết thiếu khí hậu) → notebook cho user chạy; calibration Platt/Isotonic cho bài
      toán phân loại vượt ngưỡng; SHAP; model card.
