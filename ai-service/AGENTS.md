# Codex — Layer 2 và Layer 3

Hướng dẫn này bổ sung `../AGENTS.md`. Vai trò là cộng tác viên AI/ML; không thay thế người rà soát chuyên môn hoặc người duyệt văn bản.

## Đọc để tiếp nhận

- [README.md](README.md): trách nhiệm của ba lớp AI.
- [docs/04](../docs/04-phuong-phap-toi-uu.md): formulation, solver, bất định và cổng O1–O7.
- [docs/05](../docs/05-phuong-phap-genai-rag.md): slots, kho tri thức, guardrail và cổng R1–R7.
- [docs/07](../docs/07-model-card.md) và [docs/08](../docs/08-ban-giao-layer1.md): đầu ra, giới hạn và kỷ luật đánh giá Layer 1.
- [docs/09](../docs/09-kien-truc-backend.md), `../docs/adr/`, `../contracts/README.md`: phục vụ API và phối hợp với backend.
- Đọc `../docs/03-quy-trinh-thuc-nghiem.md` khi có task thí nghiệm; docs/10–11 khi có task bàn giao UI. Chỉ đọc chi tiết phần liên quan.

## Hiện trạng cần hiểu đúng

- `app/data/` và `app/forecast/` đã có; tái dùng, không scaffold lại. Model hiện hành là M4-R2; hhh4 là thí nghiệm đã loại khỏi ensemble hiện hành. `cases_pred_interval` hiện là `null`, khác mô tả khoảng tin cậy trong README.
- `app/serving/optimize_api/` đã có API, nhưng `allocate_resources` vẫn là greedy và giả định giảm 20% ca; chưa phải P2/MILP đã kiểm chứng.
- `app/serving/genai_api/` đã có API, nhưng `generate_draft` dùng mẫu tĩnh và guardrail hardcode; tên `model_used` không chứng minh đã gọi LLM/RAG.
- `app/optimize/` và `app/genai_rag/` là vị trí logic nghiệp vụ dự kiến trong README, chưa có. Chỉ tạo khi task triển khai cần; adapter HTTP tiếp tục ở `app/serving/`.
- Hợp đồng hiện tại: `../contracts/openapi/optimize-internal.yaml` và `genai-internal.yaml`. Callers ở `../backend/services/workflow/`; xác minh bằng CodeGraph trước khi đọc/sửa.
- Có sai lệch cần xử lý trong task tích hợp riêng: workflow → Optimize/GenAI về URL/payload/response, token dịch vụ, fallback và sự kiện. Không tự sửa backend/infra trong lượt tiếp nhận; báo phụ thuộc và tiêu chí kiểm chứng.

## Trách nhiệm Layer 2 — Optimize

- Nhận kết quả Layer 1 và ngân sách; mục tiêu là **số ca giảm được**, không chỉ xếp hạng rủi ro.
- Bám P2 khuyến nghị trong docs/04: `ΔCases_i(x_i) = Cases_i × e_i × f(x_i)` với lợi ích giảm dần. Chốt đơn vị tài nguyên/chi phí, hiệu lực can thiệp, mức sàn và giới hạn theo task trước khi implement. Không tự coi giả định giảm 20% là hiệu lực đã đo.
- Giữ provenance `run_id`, `model_version`, `data_version`, tháng neo, horizon và tỉnh trong bàn giao. Không nhầm tỉ suất `/100k`, xác suất vượt P75 và số ca tuyệt đối.
- Dùng OR-Tools đã có khi giải MILP/CP-SAT; giữ P1/xếp hạng rủi ro và greedy làm đối chứng theo phương pháp đã chốt. SA/Tabu là đối chứng hoặc phần mở rộng được giao, không tự thêm để tăng độ phức tạp.
- Validate giá trị hữu hạn, ngân sách/ca không âm, chi phí theo đơn vị đã chốt, tỉnh hợp lệ/không trùng và mọi ràng buộc. Không trả phương án vượt ngân sách như thành công.
- Cần bằng chứng: feasibility, trường hợp biên, brute-force bài nhỏ, đối chiếu solver, đơn điệu ngân sách, tái lập, P2 vs P1 và độ nhạy `e_i`/`k`; tốc độ/optimality theo O1–O7.
- Đánh giá stochastic/robust cần phân phối hoặc kịch bản có nguồn và nhãn giả định. Không coi `exceed_prob` là phân phối số ca, không bịa khoảng khi Layer 1 chưa cung cấp.

## Trách nhiệm Layer 3 — GenAI RAG

- Nhận phương án Layer 2 và slots có nguồn từ Layer 1/2; trả dự thảo B2B/B2G, citation và kết quả guardrail thực. Làm B2B trước theo docs/05 trừ khi task chỉ định khác.
- LLM chỉ diễn giải; mọi số liệu/địa danh/nguồn lực phải đến từ slots đã kiểm. Không lấy số do client hoặc LLM khai làm bằng chứng đã khớp với run/plan.
- Kho tri thức dùng metadata hiệu lực và nguồn; chunk theo Điều/Khoản. Tái dùng Postgres/pgvector theo kiến trúc đã chốt; kiểm truy hồi trước khi đánh giá sinh văn bản.
- Kiểm số liệu, địa danh, citation/hiệu lực, thể thức và nội dung ngoài phạm vi; không hardcode `passed=True`. Mã G1–G6 trong docs/05 và hợp đồng hiện tại có diễn giải khác nhau: giải quyết trong PR hợp đồng trước khi triển khai, không âm thầm đổi nghĩa.
- Thiếu dữ kiện phải đánh dấu `[CẦN BỔ SUNG]`; guardrail lỗi phải chặn hoặc trả lỗi rõ. Không gắn tên model/provider khi thực tế chỉ chạy template; dữ liệu demo phải có nhãn.
- Bàn giao workflow đầy đủ nội dung/hash, bằng chứng guardrail, citation và dữ liệu phục vụ lịch sử sửa. Workflow chịu trách nhiệm danh tính, 4 mắt, version và bản đã duyệt; notification chịu trách nhiệm gửi. Không thêm đường gửi trực tiếp từ GenAI hoặc duyệt tự động.
- Cần bộ vàng 30–50 kịch bản và rà soát chuyên môn: trung thực/số liệu 100%, Recall@5 ≥0.90, thể thức ≥95%, truy vết và không đường vòng theo R1–R7. Chỉ kết luận đạt khi có kết quả đo.

## Kiểm tra khi có task triển khai

- Chạy từ `ai-service/`: `ruff check .`, `black --check .`, `mypy`, `lint-imports`, và `pytest` chọn đúng test bị ảnh hưởng. Phạm vi thay đổi rộng mới chạy suite rộng; không cài môi trường trong task chỉ setup.
- Test hợp đồng ở `tests/test_contracts/`; serving ở `tests/test_serving/`. Logic solver/RAG mới cần test hành vi, đặc biệt đầu vào sai, thiếu dữ kiện, lỗi upstream và guardrail fail; mock phải khớp hợp đồng thật.
- Python CI/image dùng 3.13; README có lệnh activate cho Windows. Trên macOS/Linux dùng đường dẫn venv tương ứng khi thực sự cần dựng môi trường. Không tự thay requirements để khớp Python hệ thống.
- Thí nghiệm dùng `config.yaml`, seed và data version cố định, `RESULTS.md`; giữ cả kết quả âm tính. Không sửa tay `dashboard/public/demo/` hoặc kết quả thí nghiệm đã lưu.
- Khi chạm Layer 1 trong task được giao: target train/test chỉ `real`, chống rò rỉ theo thời gian/độ trễ báo cáo, báo theo mùa; không công bố mùa đã tham gia chọn thiết kế như holdout độc lập. Dữ liệu thật cấp tỉnh hiện chỉ tới 2010 theo model card.
- Khi nghiệm thu, báo file đổi, input/output bàn giao, test và số đo thực; nêu giả định, phụ thuộc backend/UI còn thiếu và việc chưa kiểm.

