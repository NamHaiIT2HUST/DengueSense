
## Phạm vi và trạng thái tiếp nhận

- Codex tham gia cùng người phụ trách AI/ML để làm **Layer 2 (Optimize)** và **Layer 3 (GenAI RAG)** trong `ai-service/`.
- Mặc định tiếp nhận/review nếu chưa có yêu cầu triển khai cụ thể: đọc, đối chiếu, xác định phụ thuộc và báo việc còn thiếu. Không tự chạy ingest, train, benchmark, LLM/SMTP, migration, deploy hoặc sửa code nghiệp vụ chỉ vì thấy backlog.
- Yêu cầu setup chỉ cho phép sửa hướng dẫn/cấu hình agent và `.gitignore`. Khi người dùng giao task triển khai cụ thể, làm trong phạm vi task đó; không tự mở rộng sang Layer 1, backend hoặc dashboard.
- Trước công việc Layer 2/3, đọc [ai-service/AGENTS.md](ai-service/AGENTS.md), kể cả khi phiên bắt đầu ở root.

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->

Không tự tạo/làm lại index. Nếu công cụ không có, lỗi hoặc không tìm được file (ví dụ Markdown), ghi rõ rồi dùng `rg`/đọc file trực tiếp. Không coi kết quả thiếu trong index là bằng chứng code không tồn tại.

## Nguồn tham chiếu và ranh giới

- Đọc [CONTRIBUTING.md](CONTRIBUTING.md) cho Git/PR; [ai-service/README.md](ai-service/README.md) cho trách nhiệm; docs/04–05 cho phương pháp Layer 2/3; docs/07–08 cho bàn giao Layer 1; docs/09 và ADR cho ranh giới service.
- `contracts/openapi/`, `contracts/events/`, `contracts/routing.yaml` và `contracts/errors.md` là nguồn sự thật cho giao tiếp. Không sửa hợp đồng âm thầm; theo quy trình PR hợp đồng riêng, review phía gọi và giữ tương thích trong `contracts/README.md`.
- README/ROADMAP và checkbox tiến độ có thể cũ. Đối chiếu code, hợp đồng và bằng chứng kiểm thử trước khi kết luận đã hoàn thành; không tự sửa tài liệu ngoài phạm vi task.
- Python sở hữu ML/optimize/RAG. Go sở hữu identity, workflow/phê duyệt và notification. Dashboard chỉ gọi gateway, không tự tính kết quả AI. Không truy cập schema DB của service khác.

## Cách làm việc khi được giao triển khai

- Chọn thay đổi nhỏ nhất đủ giải quyết task; tái dùng helper, pattern và dependency đã có. Kiểm callers, tests, fixtures, hợp đồng, config và mã sinh liên quan trước khi sửa.
- Giữ Layer 1 và dữ liệu/kết quả đã công bố làm control. Mọi thay đổi ảnh hưởng dự báo phải có task riêng, bằng chứng và version phù hợp.
- Không hardcode secret; không commit `.env`, raw/processed data, model weights, cache hoặc index CodeGraph. Không cài dependency hay dựng hạ tầng chỉ để chuẩn bị cho việc chưa được giao.
- Làm trên branch theo CONTRIBUTING; không push thẳng `main`, không tự merge PR. Commit/push/tag do người dùng thực hiện trừ khi họ giao rõ thao tác đó; không thêm đồng tác giả công cụ.
- Trước khi thêm tính năng hoặc sửa lỗi, luôn tạo nhánh Git mới; không commit trực tiếp vào `main`. Đặt tên theo CONTRIBUTING.md: `feature/<mô-tả-ngắn>` cho tính năng, `fix/<mô-tả-ngắn>` cho sửa lỗi, `chore/<mô-tả-ngắn>` cho cấu hình và `docs/<mô-tả-ngắn>` cho tài liệu.
- Với task triển khai, chạy kiểm tra phù hợp và báo kết quả thực tế. Với setup/review, chỉ kiểm diff, đường dẫn và ignore; không chạy project. Không tuyên bố test/build xanh từ log cũ.
- Trả lời tiếng Việt; nêu việc đã đổi, kiểm tra đã chạy, điều chưa kiểm và rủi ro còn lại.
