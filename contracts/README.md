# contracts/ — hợp đồng giữa các thành phần

**Nguồn sự thật** cho mọi giao tiếp (docs/09 §6.10). Code phải khớp hợp đồng, không ngược lại.

```
contracts/
├── openapi/
│   ├── public-v1.yaml            # API công khai (gateway ↔ dashboard) — nguồn sinh type cho Go và TypeScript
│   ├── identity-internal.yaml    # nội bộ: đăng nhập, token người dùng/dịch vụ, JWKS
│   ├── surveillance-internal.yaml# nội bộ: danh mục tỉnh, ranh giới, quan sát, PHIÊN BẢN DỮ LIỆU (panel Parquet)
│   └── forecast-internal.yaml    # nội bộ: lượt dự báo, kết quả, giải thích SHAP, model card
├── routing.yaml                  # bản đồ gateway: mỗi operation công khai → các lời gọi nội bộ + vai trò tối thiểu
├── events/                       # JSON Schema sự kiện NATS (phong bì + từng `type`, có version)
├── errors.md                     # danh mục mã lỗi ổn định
└── redocly.yaml                  # cấu hình lint mọi file OpenAPI
```

**Làm song song hai luồng:** backend hiện thực `*-internal.yaml` (server) + gateway theo `routing.yaml`; frontend dựng màn hình
theo `public-v1.yaml` với mock MSW. Hai luồng chỉ gặp nhau ở `public-v1.yaml` — đổi nó bằng PR hợp đồng riêng.

**Schema dùng chung là BẢN SAO có chủ đích** giữa các file OpenAPI (không $ref chéo file, để mã sinh Go/Python/TS đơn giản).
`test_internal_contracts.py` bảo đảm các bản sao trùng TÊN thì GIỐNG HỆT — sửa một chỗ phải sửa mọi chỗ, hoặc đổi tên nếu cố ý khác.

## Quy trình đổi hợp đồng (PHẢI)

1. **PR hợp đồng riêng** — chỉ sửa `contracts/`, không kèm code. Người ở phía đối diện (frontend / service gọi) approve trước.
2. Lint MỌI hợp đồng OpenAPI (chạy trong thư mục `contracts/`; cấu hình các file ở `redocly.yaml`):
   ```bash
   npx @redocly/cli@latest lint
   ```
3. **Không phá vỡ tương thích.** Xoá/đổi tên trường, đổi kiểu, thêm trường bắt buộc vào request ⇒ cần: (a) thêm trường mới song song, đánh dấu cũ `deprecated: true`, giữ ≥ 1 đợt phát hành; hoặc (b) tăng `/v2`. CI dùng `oasdiff breaking` so với `main`.
4. Thêm **trường tuỳ chọn** vào response không phải thay đổi phá vỡ (client bỏ qua trường lạ).
5. Sự kiện: đổi schema phá vỡ ⇒ tạo `…v2.json`, phát song song v1 và v2 cho tới khi hết consumer v1.
6. Thêm mã lỗi mới ⇒ thêm vào `errors.md` cùng PR.

## Kiểm tra tự động

- `ci-contracts.yml`: lint mọi OpenAPI (redocly), `oasdiff breaking` từng file so với `main`.
- `ai-service/tests/test_contracts/`: schema sự kiện hợp lệ (JSON Schema 2020-12) và mẫu khớp schema; mọi `code` nêu trong OpenAPI có trong `errors.md`; hợp đồng nội bộ đòi token dịch vụ / Idempotency-Key / header danh tính; schema dùng chung giống hệt giữa các file; `routing.yaml` phủ đúng các operation công khai và trỏ tới operation nội bộ có thật; hợp đồng không lặng lẽ bỏ các trường trung thực (`base_rate`, provenance).
