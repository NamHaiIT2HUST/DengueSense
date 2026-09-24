# exp_010 — Kiểm định độ vững của M4-R2 (docs/02 §4.4)

- **Ngày chạy:** 2026-09-25 · outer 8 origin × 4 horizon, real-only, 10 lần lặp mỗi điều kiện (seed cố định)
- **Thời gian:** ~12-15 phút (fit 1 lần mỗi fold, dự báo cho 61 bản đầu vào — `predict_m4_many`)
- **File:** `results.json`, `analysis_output.txt` (`run.py` + `analyze.py`)

> Xem [MODEL_ZOO_RESULTS.md](../MODEL_ZOO_RESULTS.md) cho bảng xếp hạng tổng hợp.

## Câu hỏi

M4-R2 chịu được nhiễu và khuyết thiếu ở dữ liệu khí hậu đầu vào đến mức nào? (docs/02 §4.4; liên quan trực tiếp
rủi ro "gián đoạn data pipeline" trong đề án.)

## Thiết lập

- Model HUẤN LUYỆN trên dữ liệu sạch; chỉ đầu vào lúc dự báo bị nhiễu/khuyết (kịch bản lỗi cảm biến/API khi vận hành).
- **Nhiễu:** nhân (1 + N(0,σ)) lên temp/precip/humidity THÔ từng (tỉnh, tháng, biến), σ = 5%, 10%, rồi dựng lại đặc trưng.
- **Khuyết:** 10%/20% giá trị khí hậu thô → NaN (rolling 3 tháng lan truyền: 10% khuyết ⇒ ~90% tỉnh có ≥1 đặc trưng NaN).
  GBM xử lý NaN nguyên bản; **M1 (tuyến tính) bị loại ở dòng nào thiếu đặc trưng** — M4 tự lùi về phần GBM.
- **Giảm thiểu:** cùng khuyết nhưng điền khuyết NHÂN QUẢ bằng trung bình cùng tháng dương lịch các năm trước
  (`features.py::impute_climate_causal`, 3 test gồm kiểm tra nhân quả).
- Sanity: điều kiện `clean` khớp M4-R2 tuyệt đối (0.404/0.625/0.851/1.394, gộp 0.8185).

## Kết quả (MASE gộp; % thay đổi so với sạch, dương = tệ hơn)

| Điều kiện | h=1 | h=2 | h=3 | h=6 | **Gộp** | Bắc | Trung | Nam | Bùng dịch | Bias bùng dịch |
|---|---|---|---|---|---|---|---|---|---|---|
| sạch | 0.404 | 0.625 | 0.851 | 1.394 | **0.8185** | 1.373 | 0.904 | 0.722 | 2.526 | −15.6 |
| nhiễu 5% | +6.9% | +2.2% | +0.7% | +0.5% | **+1.7%** | +0.8% | +1.1% | +2.4% | +0.9% | −15.5 |
| nhiễu 10% | +14.8% | +3.8% | +1.7% | +3.0% | **+4.3%** | +3.9% | +2.3% | +6.8% | +2.1% | −15.0 |
| khuyết 10% | +1.9% | +3.7% | +7.9% | +7.2% | **+6.0%** | −5.0% | +11.6% | +0.7% | +15.2% | −18.4 |
| khuyết 20% | +4.6% | +7.0% | +10.8% | +8.9% | **+8.5%** | −7.0% | +16.5% | +0.9% | +23.8% | −19.8 |
| **khuyết 10% + điền khuyết** | −0.1% | +0.2% | +0.3% | −0.1% | **0.0%** | −0.5% | +0.5% | −0.4% | +0.4% | −15.7 |
| **khuyết 20% + điền khuyết** | +0.6% | +1.1% | +1.0% | −0.2% | **+0.5%** | +0.3% | +1.4% | −0.7% | +1.5% | −15.9 |

Độ lệch chuẩn giữa các lần lặp nhỏ (MASE gộp ≤ 0.02) nên các khác biệt trên là ổn định, không phải nhiễu lấy mẫu.

## Kết luận

1. **M4-R2 vẫn chạy và vẫn thắng seasonal-naive (MASE gộp < 1) ở MỌI điều kiện thử**, kể cả khuyết 20% không xử lý
   (0.888): suy giảm êm (graceful), không sụp đổ.
2. **Nhiễu 5%: +1.7% (chấp nhận được); nhiễu 10%: +4.3%, nhưng h=1 nhạy nhất (+14.8%)** — dự báo 1 tháng dựa nhiều vào
   khí hậu lag 1-2 tháng nên chịu ảnh hưởng nhiễu trực tiếp nhất; horizon xa ít nhạy.
3. **Khuyết KHÔNG xử lý gây hại rõ: +6.0%/+8.5% gộp, tệ nhất ở miền Trung (+12-17%) và tháng bùng dịch (+15-24%,
   bias −15.6→−19.8)** — phần vì M1 gần như luôn bị loại (đặc trưng NaN), phần vì cây quyết định rẽ theo hướng mặc định.
4. **Biện pháp giảm thiểu có hiệu quả áp đảo: điền khuyết nhân quả bằng khí hậu trung bình cùng tháng đưa suy giảm
   về ≈0 (+0.0%/+0.5% gộp; bùng dịch +0.4%/+1.5%)** ở cả 10% và 20% khuyết. Đề xuất: **đưa vào pipeline vận hành như
   bước bắt buộc trước khi dựng đặc trưng** (chi phí gần 0, đã có test nhân quả).
5. Hệ quả nghiên cứu: điền khuyết bằng climatology gần như không làm hại → M4 dùng khí hậu chủ yếu như tín hiệu MÙA VỤ
   theo tỉnh hơn là dị thường từng tháng — khớp chẩn đoán exp_004 (climatology chỉ bắt được mùa vụ) và giải thích vì sao
   nhiễu (làm lệch giá trị có hệ thống khỏi mùa vụ) hại hơn khuyết-đã-điền.

## Điều bất ngờ / nghi vấn ⭐

- **Miền Bắc "tốt hơn" khi khuyết (−5%/−7%) là ẢO GIÁC, không phải độ vững:** NaN làm cây rẽ hướng mặc định → dự báo
  thấp hơn; vì M4 dự báo Bắc quá cao (bias dương, exp_006) nên bị kéo lại gần thực tế. Khi có điền khuyết thì mất hiệu
  ứng này (−0.5%/+0.3%). Xác nhận thêm chẩn đoán "M4 hiệu chỉnh kém ở miền Bắc".
- Tháng bùng dịch nhạy nhất với khuyết (+24%): giai đoạn quan trọng nhất cho mục đích sản phẩm cũng dễ hỏng nhất khi
  dữ liệu đứt — càng cần bước điền khuyết.

## Hạn chế đã biết

- Khuyết là NGẪU NHIÊN ĐỘC LẬP theo từng (tỉnh, tháng, biến); **chưa thử gián đoạn LIÊN TỤC** (mất toàn bộ khí hậu 2-3
  tháng gần nhất — kịch bản đứt pipeline thật, và điền khuyết bằng climatology nhân quả khó hơn ở đó).
- Chỉ nhiễu/khuyết ở đầu vào lúc DỰ BÁO; chưa thử nhiễu/khuyết ở dữ liệu HUẤN LUYỆN.
- Nhiễu nhân Gauss độc lập; nhiễu có tương quan (lệch hệ thống của 1 cảm biến/1 nguồn) chưa thử.
- **Năm bất thường 2020-2021, 2023** (docs/02 §4.4) không kiểm được: dữ liệu real kết thúc 2010.
- Không có ngưỡng chấp nhận số học trong docs cho độ vững; báo cáo mức suy giảm để tự đánh giá.

## Quyết định

- **Đưa `impute_climate_causal` vào pipeline suy luận** như bước bắt buộc khi dữ liệu khí hậu có khuyết.
- Model card ghi: chịu nhiễu ≤5% (+1.7%), nhiễu 10% cần chú ý h=1 (+15%), khuyết ≤20% an toàn NẾU có điền khuyết.

## Việc tiếp theo

- [ ] Thử gián đoạn liên tục 2-3 tháng gần nhất + phương án điền khuyết khác (nội suy không gian từ tỉnh kề).
- [ ] Calibration cho phân loại vượt ngưỡng (PR-AUC/Recall@Precision), SHAP, model card.
