# contracts/ — hợp đồng giữa các thành phần

**Nguồn sự thật** cho mọi giao tiếp (docs/09 §6.10). Code phải khớp hợp đồng, không ngược lại.

```
contracts/
├── openapi/public-v1.yaml     # API công khai (gateway ↔ dashboard) — nguồn sinh type cho Go và TypeScript
├── events/                    # JSON Schema sự kiện NATS (phong bì + từng `type`, có version)
├── errors.md                  # danh mục mã lỗi ổn định
└── redocly.yaml               # cấu hình lint OpenAPI
```

Hợp đồng nội bộ (`*-internal.yaml`) được thêm khi từng service được dựng (Đợt 1 trở đi).

## Quy trình đổi hợp đồng (PHẢI)

1. **PR hợp đồng riêng** — chỉ sửa `contracts/`, không kèm code. Người ở phía đối diện (frontend / service gọi) approve trước.
2. Lint OpenAPI (chạy trong thư mục `contracts/`):
   ```bash
   npx @redocly/cli@latest lint openapi/public-v1.yaml
   ```
3. **Không phá vỡ tương thích.** Xoá/đổi tên trường, đổi kiểu, thêm trường bắt buộc vào request ⇒ cần: (a) thêm trường mới song song, đánh dấu cũ `deprecated: true`, giữ ≥ 1 đợt phát hành; hoặc (b) tăng `/v2`. CI dùng `oasdiff breaking` so với `main`.
4. Thêm **trường tuỳ chọn** vào response không phải thay đổi phá vỡ (client bỏ qua trường lạ).
5. Sự kiện: đổi schema phá vỡ ⇒ tạo `…v2.json`, phát song song v1 và v2 cho tới khi hết consumer v1.
6. Thêm mã lỗi mới ⇒ thêm vào `errors.md` cùng PR.

## Kiểm tra tự động

- `ci-contracts.yml`: lint OpenAPI (redocly), `oasdiff breaking` so với `main`.
- `ai-service/tests/test_contracts/`: mọi schema sự kiện hợp lệ theo JSON Schema 2020-12; phong bì và `data` mẫu qua đúng schema; mọi `code` được nêu trong OpenAPI có mặt trong `errors.md`.
