# Quy tắc làm việc & Coding Rules — DengueSense

Mục tiêu duy nhất của tài liệu này: **`main` luôn chạy được**, và 2 người (hoặc hơn) có thể merge code của nhau mà không phải đoán xem cái gì an toàn để đổi.

## 1. Nguyên tắc chung

1. **Không bao giờ push thẳng vào `main`.** Mọi thay đổi đi qua branch + Pull Request, kể cả sửa 1 dòng.
2. **`main` = luôn deploy được.** Nếu một PR làm `main` build fail, ưu tiên số 1 là revert, không phải sửa tiếp trên `main`.
3. **PR nhỏ, gói gọn 1 việc.** Dễ review = dễ merge = ít conflict. Một PR không nên đụng vào cả `backend` lẫn `ai-service` trừ khi bắt buộc (đổi API contract).
4. **Review chéo giữa 2 tech.** Người còn lại luôn đọc qua trước khi merge — kể cả code AI/ML, kể cả code backend. Không tự merge PR của chính mình.
5. **Sync `main` thường xuyên** vào branch đang làm (`git pull --rebase origin main`) để tránh conflict dồn cục vào cuối.

## 2. Branch & Commit

### Đặt tên branch

```
feature/<mô-tả-ngắn>      # tính năng mới
fix/<mô-tả-ngắn>          # sửa bug
chore/<mô-tả-ngắn>        # việc lặt vặt: config, deps, CI
docs/<mô-tả-ngắn>         # tài liệu
```

Ví dụ: `feature/layer1-xgboost-baseline`, `fix/backend-jwt-refresh`, `chore/ci-ai-service`.

### Commit message — Conventional Commits

```
<type>(<scope>): <mô tả ngắn, tiếng Việt hoặc Anh đều được>
```

`type`: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`
`scope`: `backend`, `ai-service`, `dashboard`, `infra`, hoặc bỏ trống nếu ảnh hưởng nhiều nơi

Ví dụ:
```
feat(ai-service): thêm baseline XGBoost cho Layer 1
fix(backend): sửa lỗi JWT refresh token hết hạn sớm
chore(infra): thêm docker-compose cho postgres + pgvector
```

### Quy trình chuẩn cho 1 thay đổi

```bash
git checkout main
git pull
git checkout -b feature/ten-viec
```

... code, rồi:

```bash
git add <file cụ thể, không dùng -A nếu không chắc>
```

```bash
git commit -m "feat(scope): mo ta ngan"
```

```bash
git push -u origin feature/ten-viec
```

Sau đó mở PR trên GitHub, gắn reviewer là người còn lại, link issue liên quan (`closes #x`).

## 3. Pull Request checklist (xem thêm `.github/pull_request_template.md`)

Một PR chỉ được merge khi:

- [ ] CI pass (lint + build tối thiểu; test nếu có)
- [ ] Không commit file `.env`, secret, key, credentials
- [ ] Không commit dữ liệu bệnh nhân/dữ liệu nhạy cảm thật (chỉ dùng dữ liệu công khai/giả lập ở giai đoạn MVP)
- [ ] Đã có ít nhất 1 review approve từ người còn lại trong team tech
- [ ] Nếu đổi API contract giữa `backend` ↔ `ai-service` hoặc `backend` ↔ `dashboard`: đã báo trước cho người phụ trách phía kia, không đổi âm thầm
- [ ] Nếu đổi model/thuật toán ở `ai-service` (Layer 1/2): mô tả trong PR số liệu trước/sau (precision, thời gian chạy) nếu có

Merge bằng **Squash and merge**, xoá branch sau khi merge.

## 4. Coding standards theo từng phần

### `backend` (Go)

- Bắt buộc chạy `gofmt` trước khi commit (tốt nhất qua pre-commit hook, xem mục 5).
- Lint bằng `golangci-lint run` — CI sẽ chặn nếu fail.
- Không log secret / token ra console hoặc log file.
- Đổi schema DB phải qua migration (`golang-migrate` hoặc tương đương), không sửa tay DB pilot/prod.
- Handler API nào nhận input từ người dùng đều phải validate trước khi dùng.

### `ai-service` (Python)

- Format bằng `black`, lint bằng `ruff` — CI sẽ chặn nếu fail.
- Mọi model/thuật toán (Layer 1, Layer 2) phải load config (hyperparameters, đường dẫn data) từ file config hoặc env, không hardcode trong code.
- Không commit model weight lớn hoặc dataset thô vào git — để trong `.gitignore`, dùng chỗ lưu trữ riêng (Drive/S3) và ghi rõ cách tải trong `ai-service/README.md`.
- Notebook (`.ipynb`) dùng để thử nghiệm, **không** dùng làm code chạy production — logic cuối cùng phải chuyển vào file `.py` có thể import/test được.
- Test tối thiểu cho phần optimize (Layer 2): input cố định → so sánh output MILP có hợp lệ theo constraint (không vượt ngân sách, không âm).

### `dashboard` (React + TypeScript)

- Lint bằng ESLint + format bằng Prettier — CI sẽ chặn nếu fail.
- `strict: true` trong `tsconfig.json`, không dùng `any` trừ khi có comment giải thích lý do.
- Gọi API qua 1 lớp service/client tập trung (không fetch rải rác trong component) để đổi API dễ hơn.

## 5. Pre-commit hook (khuyến nghị, không bắt buộc nhưng nên dùng)

Cài [pre-commit](https://pre-commit.com/) để tự động format/lint trước khi commit, tránh việc CI fail vì lỗi lặt vặt (thiếu dấu cách, sai format) — mỗi service tự thêm hook tương ứng khi scaffold (gofmt/golangci-lint cho `backend`, black/ruff cho `ai-service`, eslint/prettier cho `dashboard`).

## 6. Secrets & môi trường

- Mỗi service có `.env.example` liệt kê biến cần thiết (không có giá trị thật) — commit file này.
- File `.env` thật **luôn** nằm trong `.gitignore`, không commit, không share qua chat public.
- Secret dùng cho CI/deploy để trong GitHub Actions Secrets, không hardcode trong workflow file.

## 7. Khi phát hiện đã lỡ commit nhầm secret

Báo ngay cho người còn lại trong team tech, đổi/thu hồi secret đó ngay lập tức (đừng chỉ xoá khỏi commit mới — secret cũ vẫn nằm trong git history cho tới khi được rotate).
