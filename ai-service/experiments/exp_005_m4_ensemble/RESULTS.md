# exp_005 — M4 Ensemble (M1 + M2a + M2b, T1 default)

- **Ngày chạy:** 2026-09-24
- **Data version:** panel v0.2.0
- **Thời gian chạy:** ~10-15 phút (26 origin × 4 horizon × 3 model, M1 GLM NegBin là phần chậm nhất)
- **Kết quả thô:** `results.json` (gồm `weights` E2 + 158 dòng chi tiết)

> Xem [MODEL_ZOO_RESULTS.md](../MODEL_ZOO_RESULTS.md) cho bảng xếp hạng tổng hợp.

## Câu hỏi

Ensemble của 3 model Tier 1 (docs/02 §7) có thắng model đơn lẻ tốt nhất ≥ 3% MASE và ổn định qua các
origin không? E1 (trung bình đơn giản) hay E2 (trọng số nghịch đảo sai số validation) tốt hơn?

## Thiết lập

- Thành viên: M1 GLM NegBin, M2a XGBoost, M2b LightGBM — **đúng cấu hình T1 default của exp_002**
  (quyết định ở exp_003: không dùng tham số đã tune). **M3 hhh4 không đưa vào** (exp_004: thua mọi model).
- Outer: 8 origin, horizon {1,2,3,6}, real-only — giống hệt exp_001-004.
- **E2:** trọng số ước lượng trên cửa sổ validation RIÊNG (10 origin, dữ liệu ≤ 2008-12), không dùng
  lại outer để vừa ước lượng trọng số vừa đánh giá. Trọng số: M1 0.265, M2a 0.371, M2b 0.364
  (validation MASE: M1 0.725, M2a 0.518, M2b 0.528).
- Logic kết hợp: `app/forecast/ensemble.py` (6 unit test). Model nào lỗi/NaN ở 1 fold thì bị bỏ khỏi
  fold đó và trọng số tự chuẩn hoá lại (M1 lỗi hội tụ ở vài fold, đã biết từ exp_002).

## Kết quả ✅ (kết quả dương tính đầu tiên của model zoo)

| Model | h=1 | h=2 | h=3 | h=6 |
|---|---|---|---|---|
| M1 GLM NegBin | 0.4975 | 0.7359 | 1.1376 | 1.6442 |
| M2a XGBoost | 0.4494 | 0.6984 | 0.9626 | 1.6113 |
| M2b LightGBM | 0.4465 | 0.6939 | 1.0009 | 1.6085 |
| **E1 trung bình đơn giản** | **0.4290** | **0.6713** | **0.8975** | **1.4793** |
| E2 trung bình có trọng số | 0.4298 | 0.6743 | 0.9068 | 1.4918 |
| Cải thiện E1 vs model đơn lẻ tốt nhất | −3.9% | −3.3% | −6.8% | −8.0% |
| Cải thiện E2 vs model đơn lẻ tốt nhất | −3.7% | −2.8% | −5.8% | −7.3% |

- **E1 vượt ngưỡng ≥3% (docs/02 §7) ở cả 4 horizon**, cải thiện tăng dần theo horizon.
- **Ổn định qua origin:** E1 thắng M2b ở 21/32 và thắng M2a ở 27/32 tổ hợp (origin×horizon) — thắng
  đa số rõ ràng, không phải nhờ 1 origin may mắn (nhưng không tuyệt đối: thua ở một số fold, đặc biệt
  khi M2b vốn tốt sẵn).
- E2 (2.8-3.7%) chỉ vượt ngưỡng ở 3/4 horizon (h=2 dưới 3%), và **kém hơn E1 ở mọi horizon**.

## Kiểm tra nghi vấn ("kết quả đẹp phải nghi")

- M1/M2a/M2b outer MASE **khớp chính xác exp_002** (0.4975/0.4494/0.4465 ở h=1...) → harness đúng, cùng
  giao thức/đặc trưng, không rò rỉ mới.
- Kết quả tái lập y hệt sau khi refactor logic kết hợp sang `app/forecast/ensemble.py`.
- Cải thiện 3-8% là quy mô bình thường của ensemble (giảm phương sai khi sai số các model không tương
  quan hoàn toàn) và khớp khảo sát docs/02 ("cả 4 nghiên cứu ensemble thắng model đơn lẻ") — không
  "quá đẹp".

## Điều bất ngờ nhỏ

E2 (giảm trọng số M1 vì kém nhất) **không** tốt hơn E1. Giải thích khả dĩ (chưa kiểm chứng riêng):
(a) trọng số ước lượng từ giai đoạn ≤2008 không hoàn toàn chuyển sang 2009-2010 — cùng chủ đề dịch
chuyển phân phối theo thời gian đã thấy ở exp_003; (b) M1 tuy kém nhưng sai số ít tương quan với 2
model boosting nên vẫn đóng góp đa dạng; (c) chênh lệch E1/E2 nhỏ (0.2-1%), có thể chỉ là nhiễu.

## Hạn chế đã biết

- Trọng số E2 là 1 bộ cố định (không theo horizon) từ 10 origin — ít dữ liệu để ước lượng.
- Chưa thử E3 stacking (Ridge trên dự báo OOF) và E4 theo chế độ — E1 đơn giản đã đạt ngưỡng nên chưa
  cần, đúng tinh thần docs/02 §7.
- Vẫn chưa đạt ngưỡng G1 (MASE<0.90 ở CẢ h=1 và h=3): E1 h=1 0.429 ✅, h=3 0.8975 ✅ — **đạt lần đầu**
  (mỏng: 0.8975 sát 0.90; std giữa origin lớn, xem exp_001).

## Quyết định

- **Chọn E1 (trung bình đơn giản M1+M2a+M2b) làm M4** — thắng ≥3% ở mọi horizon, ổn định, đơn giản hơn
  E2 và không cần duy trì trọng số.
- E2 không dùng.

## Việc tiếp theo

- [ ] LOPO (leave-one-province-out), robustness (nhiễu khí hậu, dữ liệu thiếu), hiệu chỉnh xác suất,
      SHAP, model card — theo docs/02 protocol đầy đủ.
