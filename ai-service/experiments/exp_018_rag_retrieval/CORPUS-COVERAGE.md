# Độ phủ nguồn được chọn — chưa khóa corpus

Đối chiếu manifest với `reviewed-units.partial.json` (22 units). `checked` là Codex đã đối chiếu văn bản với ảnh PDF; không phải phê duyệt chuyên môn. `professional_review` của cả ba nguồn vẫn là `pending`. Danh sách unit ID trong manifest là allowlist chính xác theo từng tài liệu; một unit chưa được liệt kê hoặc chưa `checked` bị loader từ chối. Các units ngoài phạm vi vẫn giữ trong artifacts, không đưa vào index. Bảng này không cấp phép chạy benchmark.

| Nguồn / section_id | Unit tương ứng (tiền tố là document_id) | Đối chiếu / độ phủ |
|---|---|---|
| vn-qd02-2016 / dieu-2/khoan-2 | `/dieu-2/khoan-2/a`, `/b`, `/c` | Đã kiểm văn bản ba điểm a–c |
| vn-qd02-2016 / dieu-4 | `/dieu-4/khoan-1`, `/khoan-2`, `/khoan-3`, `/khoan-4` | Đã đối chiếu bốn khoản với PDF trang 2; hiệu lực và rà chuyên môn chưa xác minh |
| vn-qd02-2016 / dieu-5/khoan-1 | `/dieu-5/khoan-1` | Đã kiểm văn bản khoản 1 |
| vn-qd02-2016 / dieu-7 | `/dieu-7/khoan-1`, `/khoan-2` | Đã kiểm văn bản hai khoản |
| vn-qd02-2016 / phu-luc/dong-14 | `/phu-luc/dong-14` | Đã kiểm dòng Dengue cùng cột và đơn vị; dòng 16 về sởi ngoài phạm vi |
| who-rcce-dengue-2024 / table-6/systems/readiness | `/table-6/systems/readiness/team`, `/budget` | Hai hoạt động đã kiểm; còn các hoạt động khác chưa được bao phủ |
| who-rcce-dengue-2024 / table-6/systems/response | `/table-6/systems/response/staff` | Một hoạt động đã kiểm; còn các hoạt động khác chưa được bao phủ |
| who-rcce-dengue-2024 / table-6/community/readiness | — | Thiếu, chưa kiểm |
| who-rcce-dengue-2024 / table-6/community/response | — | Thiếu, chưa kiểm |
| hcdc-sxh-snapshot-2025 / muc-5 | `/muc-5` | Đã đối chiếu câu hỏi và đáp án, PDF 13, trang in 11 |
| hcdc-sxh-snapshot-2025 / muc-6 | `/muc-6` | Đã đối chiếu câu hỏi và đáp án, PDF 14, trang in 12 |
| hcdc-sxh-snapshot-2025 / muc-7 | `/muc-7` | Đã kiểm văn bản cả hai trang PDF 15–16 và bảy nguyên tắc |
| hcdc-sxh-snapshot-2025 / muc-8 | `/muc-8` | Đã đối chiếu câu hỏi và đáp án, PDF 17, trang in 15 |
| hcdc-sxh-snapshot-2025 / muc-9 | `/muc-9` | Đã đối chiếu câu hỏi và đáp án, PDF 18, trang in 16; mục 10 không thuộc phạm vi |
| hcdc-sxh-snapshot-2025 / muc-11 | `/muc-11` | Đã đối chiếu câu hỏi và đáp án, PDF 19, trang in 17 |
| hcdc-sxh-snapshot-2025 / muc-12 | `/muc-12` | Đã kiểm văn bản hai nhiệm vụ (PDF 20, trang in 18) |
| hcdc-sxh-snapshot-2025 / muc-13 | `/muc-13` | Đã kiểm văn bản và điều kiện tuân theo đội phun (PDF 20, trang in 18) |

Cần kiểm các mục còn thiếu, bổ sung từng unit ID vào đúng section và cập nhật bảng cùng snapshot; chỉ khóa corpus sau khi xác nhận độ phủ và provenance. Các câu hỏi hiện tại vẫn là draft.
