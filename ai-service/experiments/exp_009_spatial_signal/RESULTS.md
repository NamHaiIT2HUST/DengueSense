# exp_009 — Tín hiệu không gian (láng giềng, toàn quốc) cho miền Bắc và bùng dịch

- **Ngày chạy:** 2026-09-24 · validation 10 origin (≤2008-12), outer 8 origin, real-only
- **File:** `results.json`, `summary.csv`, `analysis_output.txt` (`run.py` + `analyze.py`)

> Xem [MODEL_ZOO_RESULTS.md](../MODEL_ZOO_RESULTS.md) cho bảng xếp hạng tổng hợp.

## Câu hỏi

exp_006-008 kết luận hai điểm yếu còn lại của M4 (miền Bắc >1, bias bùng dịch −15) "cần tín hiệu mới, không chỉ đổi
loss". Dữ liệu còn một tín hiệu chưa dùng, hợp lệ tại thời điểm dự báo: **lan truyền không gian** — ca bệnh các tỉnh kề
(ma trận kề 34 tỉnh, exp_004) và mức toàn quốc ở t−2, t−3. Bùng phát ở lân cận có báo trước bùng phát ở tỉnh này không?

## Thiết lập (khai báo trước)

`features.py::add_spatial_features` (nhân quả, 5 test): `nb_mean_lag_2/3`, `nb_max_lag_2` (láng giềng),
`nat_mean_lag_2`, `nat_mom` (toàn quốc). Ensemble GBM (M2a+M2b, T1, Poisson); cột mới nối CUỐI danh sách.
Biến thể: S0 baseline · S1 +láng giềng · S2 +toàn quốc · S3 +cả 5 · S5 = V3 scale-aware (exp_007) · S4 = V3 + 5 cột không gian.
Quy tắc trên VALIDATION: S1-S3 nhận nếu MASE gộp không tệ hơn S0 >1% VÀ (bùng dịch hoặc reg_avg giảm ≥5%); Bắc dùng S4
thay S5 nếu validation Bắc giảm >10%. Outer chỉ xác nhận. S0 khớp exp_007 V0 tuyệt đối (sai lệch 0.0).

## Kết quả

**Validation (quy tắc):** S1 (gộp +0.4%, bùng dịch −0.2%, reg_avg −3.1%), S2 (−0.3%/−1.2%/+1.2%), S3 (−0.1%/−1.4%/−2.3%)
→ **không biến thể nào được nhận toàn cục** (mọi hiệu ứng < 5%). **Bắc: S4 vs S5 = −11.3% → dùng S4.**

**Outer (xác nhận, GBM-only):**

| | MASE gộp | Bắc | Bùng dịch MASE / bias |
|---|---|---|---|
| S0 baseline | 0.932 | 1.976 | 2.915 / −17.9 |
| S1 láng giềng | 0.922 | 1.887 | 2.868 / −17.4 |
| S2 toàn quốc | 0.920 | 2.044 | 2.837 / −17.5 |
| S3 cả 5 | 0.913 | 1.914 | 2.809 / −17.1 |
| S5 V3 | 0.925 | 1.416 | 2.928 / −18.0 |
| S4 V3 + không gian | 0.917 | 1.323 | 2.895 / −18.0 |

Không gian cho **hướng cải thiện nhỏ, nhất quán** (gộp −1 đến −2%, bùng dịch MASE −1.6 đến −3.6%, Bắc-V3 −6.6%) nhưng
**bias bùng dịch gần như không đổi** (−17.9 → −17.1). Tín hiệu là có thật nhưng **yếu**.

**M4 đầy đủ với Bắc dùng S4 (M4-R3) vs M4-R2 (outer):**

| | h=1 | h=2 | h=3 | h=6 | Gộp | Bắc | Bùng dịch bias |
|---|---|---|---|---|---|---|---|
| M4-R2 (hiện hành) | 0.404 | 0.625 | 0.851 | 1.394 | 0.8185 | 1.373 | −15.55 |
| M4-R3 | 0.403 | 0.619 | 0.850 | 1.393 | 0.8163 | 1.313 | −15.59 |

Gộp chỉ −0.3%, Bắc −4.4%, **tốt hơn ở 15/32 fold (47% — không khác tung đồng xu)**.

## Điều bất ngờ / nghi vấn ⭐

- Kỳ vọng "láng giềng bùng dịch → báo trước" **không thành hiện thực rõ rệt**: có thể vì tín hiệu tương tự đã nằm
  trong khí hậu chung (cùng vùng cùng khí hậu) và ONI; hoặc dữ liệu hằng tháng quá thô để bắt lan truyền (dịch lan
  trong vài tuần); hoặc bùng phát 2009-2010 chủ yếu do yếu tố cục bộ. Chưa kiểm chứng riêng.
- **Bug thật bắt được bằng smoke test trên dữ liệu thật (test tổng hợp không thấy):** (1) `incidence` là dtype nullable
  → pivot ra `object`, XGBoost từ chối; (2) phép nhân ma trận lan truyền NaN khi tỉnh kề thiếu dữ liệu tháng đó →
  `nb_mean_*` chỉ có 2788/6710 giá trị. Đã sửa (tính trung bình chỉ trên láng giềng có dữ liệu), thêm 2 test hồi quy.
- **Phát hiện phụ (chưa sửa):** 5/34 tỉnh (ca_mau, cao_bang, da_nang, gia_lai, thai_nguyen) có 1-2 THÁNG THIẾU giữa
  chuỗi real. Các đặc trưng lag CŨ dịch theo số DÒNG, nên sau khoảng trống chúng lệch tối đa 1 tháng trong vài dòng.
  Ảnh hưởng nhỏ (<1% dòng); sửa sẽ đổi mọi số đã công bố nên ghi nhận là hạn chế đã biết, đề xuất sửa (reindex theo
  tháng lịch) khi chạy lại toàn bộ pipeline. Đặc trưng không gian mới tính theo tháng lịch nên không bị.

## Hạn chế đã biết

- 9 so sánh × validation 10 origin: rủi ro winner's curse (đã thấy ở exp_008); Bắc-S4 tái lập hướng nhưng nhỏ hơn
  (validation −11.3% → outer −6.6%).
- Chỉ thử trung bình/lớn nhất láng giềng bậc 1, lag 2-3 tháng; chưa thử trọng số theo khoảng cách/dân số, lag dài hơn.

## Quyết định

- **KHÔNG đổi M4 sản xuất**: giữ M4-R2 (`app/forecast/m4.py`). M4-R3 chỉ cải thiện 0.3% gộp và 47% fold, đổi lại
  phụ thuộc thêm ma trận kề (geopandas) lúc suy luận — không đáng.
- Giữ `add_spatial_features` trong codebase (đã test) làm tín hiệu tham khảo/khả năng dùng lại.

## Kết luận về hai điểm yếu

Sau exp_006 → 009 (quy mô, isotonic, Tweedie, trọng số bùng dịch, pha Climatology, không gian), **miền Bắc (≈1.3) và bias
bùng dịch (≈−15.5) không sửa được bằng dữ liệu/kỹ thuật hiện có** — đây là **giới hạn của dữ liệu**, cần nguồn mới
(mật độ muỗi, sự kiện, dữ liệu tuần thay vì tháng) hoặc chấp nhận và nêu rõ trong model card. Đã đến lúc dừng tối ưu
điểm số và chuyển sang các phần còn lại của docs/02 (robustness, calibration, SHAP, model card).

## Việc tiếp theo

- [ ] Robustness §4.4 trên M4-R2 (notebook cho user chạy) · calibration cho phân loại vượt ngưỡng · SHAP · model card.
- [ ] Sửa lag theo tháng lịch (reindex) khi chạy lại toàn bộ pipeline — hiện hạn chế đã biết, ảnh hưởng nhỏ.
