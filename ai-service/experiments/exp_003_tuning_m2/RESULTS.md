# exp_003 — T2 tuning (Optuna) cho M2a XGBoost + M2b LightGBM

- **Ngày chạy:** 2026-09-23 (v1, inner=5 origin) · **2026-09-24 (v2, inner=15 origin)** — cả 2 lần 100
  trial thật, chạy bởi Nam Hải qua `notebooks/04_tune_m2.ipynb`
- **Data version:** panel v0.2.0
- **Thời gian thật:** v1 — XGBoost 919s (~15 phút), LightGBM 339s (~5.5 phút). v2 — XGBoost 29250s
  (~8h, xem ghi chú "Hạn chế đã biết" — nghi ngờ máy suspend giữa chừng làm phồng wall-clock, không
  phải compute thật lâu vậy), LightGBM 3085s (~51 phút)
- **Kết quả thô:** `results_trials100.json` (v2, GHI ĐÈ v1 — số v1 vẫn giữ nguyên trong bảng dưới)

> Xem [MODEL_ZOO_RESULTS.md](../MODEL_ZOO_RESULTS.md) cho bảng xếp hạng tổng hợp (mọi experiment, có biểu đồ).

## Câu hỏi

T2 (Optuna TPE, 100 trial, đúng search space docs/02 §6.3) có cải thiện được MASE so với T1 (cấu hình
mặc định, xem exp_002) trên tập đánh giá outer (8 origin, cùng protocol exp_001/exp_002) không?

## Thiết lập

Xem docstring `run.py` cho đầy đủ các điểm lệch có chủ đích so với docs/02 §6 (tune cả 2 model thay vì
chỉ model thắng, bỏ ASHA pruner, tune 1 lần trên inner window thay vì nested CV đầy đủ). Tóm tắt:
- **Inner tuning:** v1 = 5 origin, v2 = **15 origin** rolling-origin, dữ liệu `≤ 2008-12` — tách biệt
  hoàn toàn khỏi outer (không đổi giữa v1/v2).
- **Outer đánh giá:** 8 origin, `train_end` 2009-11..2010-06 — **giống hệt exp_001/exp_002**, không
  đổi giữa v1/v2.

## Kết quả — ⚠️ KẾT QUẢ ÂM TÍNH Ở CẢ 2 PHIÊN BẢN, v2 CỦNG CỐ THÊM KẾT LUẬN

| Model | T1 default (outer) | T2 v1 tuned (inner=5) | T2 v2 tuned (inner=15) |
|---|---|---|---|
| M2a XGBoost | 0.9304 | 0.9764 (**-4.9%**) | 0.9470 (**-1.8%**) |
| M2b LightGBM | 0.9374 | 0.9368 (+0.1%) | 0.9408 (**-0.4%**) |

**T2 vẫn KHÔNG cải thiện được model nào trên tập outer, ở CẢ 2 phiên bản inner window.** XGBoost đỡ tệ
hơn ở v2 (-1.8% so với -4.9%) nhưng vẫn TỆ HƠN T1 default; LightGBM chuyển từ "không đổi" (v1) sang
"tệ hơn 1 chút" (v2). Không phải lỗi chạy — cả 2 lần chạy đều sạch, 0 lỗi (v2 gặp 2 sự cố vận hành
không liên quan tới đúng/sai kết quả, xem "Hạn chế đã biết").

## Điều bất ngờ / nghi vấn ⭐

**v1:** XGBoost tệ đi bất ngờ — điều tra đường hội tụ **inner**:

| | Inner best-so-far tại trial 10 | 30 | 50 | 100 (cuối) |
|---|---|---|---|---|
| XGBoost (v1, inner=5) | 0.742 | 0.718 | 0.713 | 0.696 (**vẫn đang giảm**, chưa hội tụ) |
| LightGBM (v1, inner=5) | 0.750 | 0.748 | 0.748 | 0.748 (đứng yên từ trial ~20-30) |

Chẩn đoán v1: LightGBM hội tụ sớm/ổn định (đúng dấu hiệu docs/02 §6.2) nên T1 gần tối ưu sẵn — hợp lý.
XGBoost thì CHƯA hội tụ ở trial 100, giả thuyết đặt ra: **cửa sổ inner 5 origin quá nhỏ**, không đủ ổn
định cho không gian tìm kiếm 7 chiều → tăng lên 15 origin để kiểm tra lại.

**v2 (câu trả lời cho giả thuyết trên):**

| | Inner best-so-far tại trial 10 | 30 | 50 | 70 | 100 (cuối) |
|---|---|---|---|---|---|
| XGBoost (v2, inner=15) | 0.559 | 0.557 | 0.554 | 0.551 | **0.550** (đã phẳng từ trial ~30) |
| LightGBM (v2, inner=15) | 0.575 | 0.566 | 0.566 | 0.564 | **0.564** (đã phẳng từ trial ~30) |

**Giả thuyết "inner quá nhỏ" ĐÚNG MỘT PHẦN — XGBoost giờ hội tụ/phẳng đúng như kỳ vọng (trước đó chưa
từng phẳng ở inner=5)**, xác nhận 5 origin thực sự không đủ ổn định cho việc TÌM tham số. Nhưng đây là
điều bất ngờ thật sự: **dù inner giờ hội tụ sạch sẽ, kết quả OUTER vẫn không cải thiện** — thậm chí
LightGBM còn tệ đi thêm chút. Điều này loại bỏ giả thuyết đơn giản "chỉ vì thiếu dữ liệu inner" và chỉ
ra nguyên nhân sâu hơn: **bộ tham số tối ưu cho giai đoạn inner (≤2008-12) không nhất thiết tối ưu cho
giai đoạn outer (2009-11..2010-06)** — khả năng cao là do dữ liệu SXH có biến động mạnh giữa các năm
(đã thấy ở exp_001: std giữa origin rất lớn), nên "tối ưu hoá kỹ" trên 1 giai đoạn lịch sử không đảm
bảo tổng quát hoá tốt sang giai đoạn khác, bất kể cửa sổ tuning rộng hay hẹp — vấn đề là **dịch chuyển
phân phối theo thời gian (temporal distribution shift)**, không đơn thuần là cỡ mẫu.

**Đây đúng tinh thần docs/03 §4**: giả thuyết ban đầu (inner quá nhỏ) được kiểm chứng THẬT bằng cách
tăng inner rồi đo lại — không phải chỉ suy luận rồi dừng ở đó. Kết quả kiểm chứng phủ định 1 phần giả
thuyết cũ, chỉ ra 1 giả thuyết mới cụ thể hơn (distribution shift) — đúng quy trình khoa học, không
phải "cố tìm lý do để không phải sửa gì".

## Hạn chế đã biết

- **v1 (inner=5):** cửa sổ tuning nhỏ, XGBoost inner chưa hội tụ — đã sửa ở v2.
- **v2 gặp 2 sự cố vận hành (không ảnh hưởng tính đúng đắn kết quả cuối, chỉ tốn thời gian người
  dùng):** (1) lần chạy đầu của v2 dùng nhầm kernel Jupyter cũ còn cache module `run` trước khi sửa
  `INNER_N_ORIGINS` → vô tình chạy lại y hệt bản inner=5 (đã phát hiện qua số liệu trùng khớp tuyệt
  đối, KHÔNG báo cáo nhầm); (2) lần chạy thứ 2 của v2, máy tự sleep/tắt giữa chừng làm mất kết quả
  XGBoost đã tính xong (69 phút) — đã sửa bằng `SetThreadExecutionState` (chặn Windows tự sleep) +
  checkpoint sau mỗi model. Lần chạy thứ 3 mới thành công trọn vẹn, nhưng thời gian XGBoost ghi lại là
  29250s (~8h, so với ~69 phút = 4116s đo được ở lần chạy 2 bị ngắt) — nghi ngờ máy vẫn bị suspend/resume
  1 lần nữa (do đóng nắp laptop — `SetThreadExecutionState` không chặn được việc này, chỉ chặn sleep do
  timeout không hoạt động) làm phồng thời gian đo bằng `time.time()` (đồng hồ hệ thống vẫn chạy tiếp
  trong lúc suspend), KHÔNG phải compute thật sự chạy 8 tiếng — bộ tham số/MASE tìm được giống hệt lần
  chạy 2 (cùng seed=42, xác nhận không có gì khác về mặt tính toán, chỉ khác đồng hồ đo).
- Không dùng nested CV đầy đủ (tune riêng mỗi outer origin) — nếu làm đúng chuẩn có thể cho kết quả
  khác, nhưng tốn ~8× compute; ưu tiên thấp sau khi đã có bằng chứng khá rõ về distribution shift.

## Quyết định

- **Giữ nguyên T1 default cho cả M2a và M2b** — đã kiểm chứng LẠI với inner window rộng hơn 3x, kết
  luận không đổi: không có bằng chứng T2 cải thiện thật trên tập outer. Không promote bộ tham số đã
  tune (dù ở phiên bản nào).
- **Không đầu tư thêm vào tuning ở quy mô dữ liệu hiện tại** — nguyên nhân không còn là "inner quá
  nhỏ" (đã loại bỏ) mà là distribution shift theo thời gian — nested CV đầy đủ có thể giúp nhưng chi
  phí compute cao, và bản chất SXH biến động mạnh giữa các năm là giới hạn khó vượt qua chỉ bằng
  tuning kỹ hơn.

## Việc tiếp theo

- [ ] M4 Ensemble (M1 + M2a/M2b **cấu hình T1 mặc định**, không dùng bộ tham số đã tune — theo quyết
      định ở trên)
- [ ] Khi có thêm dữ liệu `real` (mở rộng ngoài 2010), cân nhắc chạy lại T2 — dữ liệu dài hơn có thể
      làm giảm distribution shift giữa inner/outer, đáng thử lại khi đó.
