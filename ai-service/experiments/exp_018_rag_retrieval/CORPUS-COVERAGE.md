# Độ phủ nguồn được chọn — corpus kỹ thuật v0.1

Đối chiếu manifest với `reviewed-units.partial.json` (43 units). `checked` là Codex đã đối chiếu văn bản với ảnh PDF; không phải phê duyệt chuyên môn. `professional_review` của cả ba nguồn vẫn là `pending`. Danh sách unit ID trong manifest là allowlist chính xác theo từng tài liệu; một unit chưa được liệt kê hoặc chưa `checked` bị loader từ chối. Các units ngoài phạm vi vẫn giữ trong artifacts, không đưa vào index. Bảng này không cấp phép chạy benchmark.

| Nguồn / section_id | Unit tương ứng (tiền tố là document_id) | Đối chiếu / độ phủ |
|---|---|---|
| vn-qd02-2016 / dieu-2/khoan-2 | `/dieu-2/khoan-2/a`, `/b`, `/c` | Đã kiểm văn bản ba điểm a–c |
| vn-qd02-2016 / dieu-4 | `/dieu-4/khoan-1`, `/khoan-2`, `/khoan-3`, `/khoan-4` | Đã đối chiếu bốn khoản với PDF trang 2; hiệu lực và rà chuyên môn chưa xác minh |
| vn-qd02-2016 / dieu-5/khoan-1 | `/dieu-5/khoan-1` | Đã kiểm văn bản khoản 1 |
| vn-qd02-2016 / dieu-7 | `/dieu-7/khoan-1`, `/khoan-2` | Đã kiểm văn bản hai khoản |
| vn-qd02-2016 / phu-luc/dong-14 | `/phu-luc/dong-14` | Đã kiểm dòng Dengue cùng cột và đơn vị; dòng 16 về sởi ngoài phạm vi |
| who-rcce-dengue-2024 / table-6/systems/readiness | explicit unit_ids in manifest | 6 activities checked (PDF 30, printed 22) |
| who-rcce-dengue-2024 / table-6/systems/response | explicit unit_ids in manifest | 4 activities checked (PDF 30, printed 22) |
| who-rcce-dengue-2024 / table-6/community/readiness | explicit unit_ids in manifest | 9 activities checked (PDF 31, printed 23) |
| who-rcce-dengue-2024 / table-6/community/response | explicit unit_ids in manifest | 5 activities checked (PDF 31, printed 23) |
| hcdc-sxh-snapshot-2025 / muc-5 | `/muc-5` | Đã đối chiếu câu hỏi và đáp án, PDF 13, trang in 11 |
| hcdc-sxh-snapshot-2025 / muc-6 | `/muc-6` | Đã đối chiếu câu hỏi và đáp án, PDF 14, trang in 12 |
| hcdc-sxh-snapshot-2025 / muc-7 | `/muc-7` | Đã kiểm văn bản cả hai trang PDF 15–16 và bảy nguyên tắc |
| hcdc-sxh-snapshot-2025 / muc-8 | `/muc-8` | Đã đối chiếu câu hỏi và đáp án, PDF 17, trang in 15 |
| hcdc-sxh-snapshot-2025 / muc-9 | `/muc-9` | Đã đối chiếu câu hỏi và đáp án, PDF 18, trang in 16; mục 10 không thuộc phạm vi |
| hcdc-sxh-snapshot-2025 / muc-11 | `/muc-11` | Đã đối chiếu câu hỏi và đáp án, PDF 19, trang in 17 |
| hcdc-sxh-snapshot-2025 / muc-12 | `/muc-12` | Đã kiểm văn bản hai nhiệm vụ (PDF 20, trang in 18) |
| hcdc-sxh-snapshot-2025 / muc-13 | `/muc-13` | Đã kiểm văn bản và điều kiện tuân theo đội phun (PDF 20, trang in 18) |

Corpus kỹ thuật v0.1 đã khóa 43 units sau khi kiểm 17 section có unit, tất cả IDs trong manifest và file units khớp, và snapshot ngoài máy được kiểm hash. Danh sách IDs, hash và trạng thái ở `corpus-lock-v0.1.json`; `professional_review` vẫn là `pending`. Các câu hỏi hiện tại vẫn là draft, chưa có nhãn được khóa.
