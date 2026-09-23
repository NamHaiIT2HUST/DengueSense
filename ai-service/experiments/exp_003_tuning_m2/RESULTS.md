# exp_003 — T2 tuning (Optuna) cho M2a XGBoost + M2b LightGBM

- **Ngày chạy:** 2026-09-23 (100 trial thật, chạy bởi Nam Hải qua `notebooks/04_tune_m2.ipynb`)
- **Data version:** panel v0.2.0
- **Thời gian thật:** XGBoost 919s (~15 phút), LightGBM 339s (~5.5 phút) cho 100 trial mỗi model
- **Kết quả thô:** `results_trials100.json`

## Câu hỏi

T2 (Optuna TPE, 100 trial, đúng search space docs/02 §6.3) có cải thiện được MASE so với T1 (cấu hình
mặc định, xem exp_002) trên tập đánh giá outer (8 origin, cùng protocol exp_001/exp_002) không?

## Thiết lập

Xem docstring `run.py` cho đầy đủ 3 điểm lệch có chủ đích so với docs/02 §6 (tune cả 2 model thay vì
chỉ model thắng, bỏ ASHA pruner, tune 1 lần trên inner window thay vì nested CV đầy đủ). Tóm tắt:
- **Inner tuning:** 5 origin rolling-origin, dữ liệu `≤ 2008-12` — tách biệt hoàn toàn khỏi outer.
- **Outer đánh giá:** 8 origin, `train_end` 2009-11..2010-06 — **giống hệt exp_001/exp_002**.

## Kết quả — ⚠️ KẾT QUẢ ÂM TÍNH (negative result), báo cáo trung thực

| Model | T1 default (outer) | T2 tuned (outer) | Thay đổi |
|---|---|---|---|
| M2a XGBoost | 0.9304 | **0.9764** | **-4.9% (TỆ HƠN)** |
| M2b LightGBM | 0.9374 | 0.9368 | +0.1% (không đáng kể) |

**T2 KHÔNG cải thiện được model nào trên tập outer** — XGBoost sau tuning còn tệ hơn cấu hình mặc
định, LightGBM gần như không đổi. Đây không phải lỗi chạy — notebook chạy sạch, 0 lỗi, đã verify kỹ
(chạy thử 2 lần với 2 trial trước khi giao bản 100 trial thật).

## Điều bất ngờ / nghi vấn ⭐

Kết quả XGBoost tệ đi là bất ngờ thật (không phải điều "mong đợi") — đã điều tra bằng cách nhìn đường
hội tụ của **inner** tuning (không phải outer):

| | Inner best-so-far tại trial 10 | 30 | 50 | 100 (cuối) |
|---|---|---|---|---|
| XGBoost | 0.742 | 0.718 | 0.713 | **0.696** (vẫn đang giảm) |
| LightGBM | 0.750 | **0.748** | 0.748 | 0.748 (đứng yên từ trial ~20-30) |

**Chẩn đoán:** LightGBM hội tụ sớm và ổn định (đường phẳng từ trial ~20-30, đúng dấu hiệu docs/02 §6.2
mô tả "nếu phẳng thì dừng, tăng ngân sách là lãng phí") — kết quả outer phản ánh đúng: KHÔNG cải thiện
vì T1 default vốn đã gần tối ưu ở quy mô dữ liệu này, không phải do tuning thất bại.

XGBoost thì NGƯỢC LẠI — vẫn đang cải thiện đều tới tận trial 100, chưa có dấu hiệu phẳng. Kết hợp với
việc outer kết quả không những không cải thiện mà còn TỆ ĐI, cách giải thích hợp lý nhất: **cửa sổ
inner tuning chỉ có 5 origin (≈20 điểm dữ liệu origin×horizon) là QUÁ NHỎ** để ước lượng MASE ổn định
cho không gian tìm kiếm 7 chiều của XGBoost — 100 trial TPE đủ để tìm ra 1 bộ tham số "trúng" đặc thù
nhiễu của riêng 5 origin đó (một dạng overfitting vào tập validation nhỏ), không phải cải thiện tổng
quát thật. Bộ tham số tốt nhất tìm được (`max_depth=3, learning_rate=0.028` — khá bảo thủ/chính quy
hoá mạnh, không phải cấu hình "phức tạp bất thường") củng cố cách đọc này: vấn đề không phải model học
ra cấu hình quá phức tạp, mà là **tín hiệu từ inner window quá nhiễu/quá ít** để dẫn đường tin cậy cho
1 model có nhiều tham số cần tinh chỉnh như XGBoost.

**Đây đúng tinh thần docs/03 §4**: "điều bất ngờ thường là bug hoặc phát hiện thật" — ở đây là phát
hiện thật (giới hạn thiết kế thí nghiệm), không phải bug trong code.

## Hạn chế đã biết

- Inner window chỉ 5 origin — nhỏ hơn nhiều so với khuyến nghị "tối thiểu 5" chỉ vừa đủ mức sàn, không
  có margin cho model nhiều tham số.
- Không dùng nested CV đầy đủ (tune riêng mỗi outer origin) — nếu làm đúng chuẩn, XGBoost có thể vẫn
  cải thiện được nhưng cần ~8× compute (ước tính ~2 giờ thay vì 15 phút).

## Quyết định

- **Giữ nguyên T1 default cho cả M2a và M2b** — không có bằng chứng T2 (ở thiết lập hiện tại) cải
  thiện thật. Không promote bộ tham số đã tune.
- **Không đầu tư thêm vào tuning XGBoost ở quy mô dữ liệu hiện tại** — cửa sổ inner quá hẹp để tin
  cậy; muốn tuning thật sự có ý nghĩa cần đợi dữ liệu dài hơn (khi có nguồn `real` mới ngoài 2010) hoặc
  đầu tư nested CV đầy đủ (chi phí compute cao hơn nhiều, cân nhắc lại độ ưu tiên).
- LightGBM: T1 default đã là lựa chọn tốt, tuning thêm không có lợi ích rõ ràng ở quy mô này.

## Việc tiếp theo

- [ ] M3 hhh4 (R/rpy2 — Rtools45 đã cài xong, sẵn sàng triển khai)
- [ ] M4 Ensemble (M1 + M2a/M2b **cấu hình T1 mặc định**, không dùng bộ tham số đã tune — theo quyết
      định ở trên)
- [ ] Khi có thêm dữ liệu `real` (mở rộng ngoài 2010), cân nhắc chạy lại T2 với inner window lớn hơn
