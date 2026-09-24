# exp_006 — Phân rã kết quả M4 (§4.2) + Leave-one-province-out (§4.3)

- **Ngày chạy:** 2026-09-24
- **Data version:** panel v0.2.0, real-only, 8 origin outer, horizon {1,2,3,6}
- **Thời gian:** ~15 phút (phần standard ~5 phút, LOPO ~10 phút)
- **File:** `results.json` (dự báo từng tỉnh), `analysis_output.txt` (toàn bộ bảng), `analyze.py`

> Xem [MODEL_ZOO_RESULTS.md](../MODEL_ZOO_RESULTS.md) cho bảng xếp hạng tổng hợp.

## Câu hỏi

1. (§4.2) MASE gộp 0.43/0.67/0.90/1.48 của M4 E1 che giấu điều gì? Kỹ năng khác nhau thế nào theo vùng, mùa,
   chế độ dịch (đặc biệt tháng bùng dịch — docs/02 gọi là "quan trọng nhất")?
2. (§4.3) Chạy ở tỉnh chưa từng thấy khi train thì kém đi bao nhiêu? (luận điểm "nhân rộng chi phí biên ≈ 0")

## Thiết lập

- Sanity: E1/M2b standard khớp chính xác exp_005 (E1 0.429/0.671/0.898/1.479).
- Định nghĩa **cố định trước khi xem kết quả**: mùa cao điểm = tháng 6-11; tháng bùng dịch = `y_true` >
  phân vị 90 của chính tỉnh đó trong lịch sử ≤ `train_end` (194/1088 quan sát); vùng từ
  `province_metadata.csv` (Bắc 15, Trung 11, Nam 8 tỉnh).
- LOPO: train trên 33 tỉnh còn lại (cùng origin), dự báo tỉnh bị loại; **M1 không tham gia** (hiệu ứng
  cố định theo tỉnh, không dự báo được tỉnh lạ) → so sánh "ensemble GBM" (M2a+M2b) LOPO với **cùng ensemble
  GBM** ở chế độ standard. Đặc trưng suy từ lịch sử của chính tỉnh đó (lag, median lịch sử) vẫn dùng.

## Kết quả §4.2 — phân rã (E1 = M4)

**MASE theo vùng với mẫu số RIÊNG từng vùng (kỹ năng thật; <1 = thắng seasonal-naive của chính vùng đó):**

| | Bắc | Trung | Nam |
|---|---|---|---|
| M2b LightGBM | 1.932 | 0.995 | 0.840 |
| **M4 E1** | **1.755** | **0.904** | **0.800** |

⚠️ **M4 thua seasonal-naive ở miền Bắc (MASE 1.755 > 1)**; chỉ có kỹ năng thật ở Trung (0.90, sát 1) và Nam
(0.80). MASE gộp toàn quốc ~0.9 bị kéo bởi miền Nam/Trung (incidence cao). (MASE theo vùng với mẫu số gộp
toàn quốc, xem `analysis_output.txt`, chỉ phản ánh độ lớn sai số tuyệt đối — không dùng để kết luận kỹ năng.)

**Mùa** (mẫu số gộp): thấp điểm 0.406, cao điểm 1.395 — sai số tuyệt đối tập trung ở mùa cao điểm (dĩ
nhiên vì incidence cao); cần đọc cùng phần bùng dịch dưới.

**Chế độ dịch (quan trọng nhất):**

| E1, MASE (mẫu số gộp) | h=1 | h=2 | h=3 | h=6 | Gộp |
|---|---|---|---|---|---|
| Tháng bình thường | 0.321 | 0.450 | 0.553 | 0.745 | 0.503 |
| **Tháng bùng dịch** | 1.451 | 2.074 | 2.391 | 3.241 | **2.555** |

- Sai số tháng bùng dịch **gấp ~5 lần** tháng bình thường (một phần do độ lớn giá trị cao hơn, nhưng
  bias xác nhận vấn đề thật): **bias E1 ở tháng bùng dịch = −15.1 ca/100k (dự báo THẤP hơn thực tế)**, tháng
  bình thường +1.6. **38.7% quan sát bùng dịch bị dự báo thấp hơn thực tế hơn một nửa.**
- Ensemble giảm được sai số bùng dịch so với model đơn (2.555 vs 2.978 của M2b, −14%) — nhưng vẫn là điểm
  yếu lớn nhất.

## Kết quả §4.3 — LOPO (ensemble GBM)

| | Standard | LOPO | Kém đi |
|---|---|---|---|
| Gộp | 0.9325 | 0.9408 | **+0.9%** |
| h=1 | 0.446 | 0.468 | +5.0% |
| h=2 | 0.696 | 0.699 | +0.4% |
| h=3 | 0.979 | 0.987 | +0.8% |
| h=6 | 1.609 | 1.610 | +0.0% |
| Vùng Bắc / Trung / Nam | | | +5.1% / +1.3% / −0.3% |

- **Chỉ kém đi 0.9% gộp** khi bỏ hẳn tỉnh khỏi tập train; 9/34 tỉnh còn tốt hơn standard. Tỉnh kém đi nhiều
  nhất: hưng yên (+15.5%), khánh hoà (+13.2%), tuyên quang (+12.2%) — chủ yếu tỉnh miền Bắc incidence thấp.
- Ở h=1 (nơi model dựa nhiều vào lịch sử gần) kém đi 5%; các horizon xa gần như không đổi — phù hợp với
  việc mô hình chủ yếu dùng khí hậu/mùa vụ chung (chuyển giao tốt giữa tỉnh) chứ không nhớ đặc thù từng tỉnh.
- **Ủng hộ luận điểm nhân rộng** ở mức: mô hình GBM không phụ thuộc vào việc đã thấy tỉnh đó khi train,
  miễn là tỉnh mới có lịch sử địa phương để tính lag/median. Chưa kiểm tra kịch bản không có lịch sử nào.

## Điều bất ngờ / nghi vấn ⭐

- MASE gộp (~0.9) tưởng "thắng seasonal-naive" **không đúng ở miền Bắc** — chỉ thấy khi tách mẫu số theo
  vùng. Nếu chỉ báo cáo con số gộp sẽ che điểm yếu này (đúng cảnh báo docs/02 §4.2 "1 con số tổng che rất
  nhiều thứ").
- Có thể do incidence miền Bắc rất thấp/thưa (đa số tháng ≈0, thỉnh thoảng bùng dịch đột ngột) nên
  seasonal-naive vốn đã khó thua ở đó, và model tabular có xu hướng dự báo dương nhỏ liên tục — **chưa kiểm
  chứng riêng** (cần xem phân phối dự báo miền Bắc).

## Hạn chế đã biết

- Ngưỡng bùng dịch (p90 theo tỉnh) và mùa cao điểm (tháng 6-11) là định nghĩa xấp xỉ; mùa cao điểm thực tế
  khác nhau giữa Bắc/Trung/Nam. Chỉ 194 quan sát bùng dịch, 8 origin → khoảng tin cậy rộng, chưa tính.
- LOPO chỉ cho GBM (không có M1), vẫn dùng lịch sử của tỉnh bị loại để tạo đặc trưng.
- Chưa có kết quả riêng năm bất thường 2020-2021/2023 (§4.4): dữ liệu real-only kết thúc 2010, không có.

## Quyết định / hệ quả

- **M4 KHÔNG nên được mô tả là "tốt trên toàn quốc"**: có kỹ năng thật ở Trung/Nam, KHÔNG có ở Bắc; và
  dự báo thấp có hệ thống ở tháng bùng dịch. Đây là điểm cần ghi vào model card và cân nhắc khi thiết kế
  cảnh báo (ngưỡng cảnh báo nên hiệu chỉnh vì bias âm ở bùng dịch).
- Luận điểm nhân rộng sang tỉnh mới: **được ủng hộ** ở mức GBM ensemble (+0.9%), kèm điều kiện có lịch sử
  địa phương.

## Việc tiếp theo

- [ ] Điều tra miền Bắc: phân phối dự báo vs thực tế, thử model riêng theo vùng hoặc hiệu chỉnh.
- [ ] Giảm bias bùng dịch: thử objective/loss khác, hoặc lớp hiệu chỉnh (calibration) — liên quan §5 Platt/Isotonic.
- [ ] Robustness §4.4 (nhiễu khí hậu ±5/10%, khuyết thiếu 10/20%) — cần chạy lại M4 nhiều lần (đóng gói notebook).
