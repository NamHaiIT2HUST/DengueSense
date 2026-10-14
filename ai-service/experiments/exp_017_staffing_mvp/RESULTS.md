# Staffing M1 — smoke 2026-10-14

Chỉ smoke fixture và unit/oracle tests; chưa benchmark M2, chưa chọn solver/SLA.

## Replay

Từ `ai-service/`, Python của venv `ai-service/bin/python`:

```bash
ai-service/bin/python -m experiments.exp_017_staffing_mvp.run --config experiments/exp_017_staffing_mvp/config.yaml --out data/processed/staffing-mvp
```

- Base HEAD khi đo: `c1db0ce353b25652961e67a9ae7bcc465182752b`; smoke chạy trên
  working tree của branch `feature/staffing-mvp-m1` trước khi commit bàn giao.
  Hash source tại lúc vẽ được lưu ở `diagram/staffing-m1-workflow.sources.json`.
- Python 3.13.16, OR-Tools 9.15.6755, Pydantic 2.14.1.
- Config: seed 42, count 1, replicas 1, mọi tỷ lệ 100%, time limit 5 giây/run,
  single worker, absolute/relative gap limits 0. Config/input hash và scenario đầy đủ
  nằm trong `data/processed/staffing-mvp/report.json` (gitignored).
- Data/schema: `fixture-perturbation-v1`/`1`; `simulated`, `policy_verified=false`.
  Nguồn/assumption: [staffing.md](../../docs/data-sources/staffing.md).

## Kết quả smoke thực đo

| Metric | Kết quả |
|---|---:|
| Status | OPTIMAL |
| Weighted unmet-hours | 8 |
| Unweighted unmet-hours | 8 |
| Incremental cost (giá unit test) | 40 VND |
| Hard violations | 0 |
| Run runtime | 0.002881 giây |
| First validated feasible (callback) | 0.002391 giây |
| Deadline exceeded | false |

Hai phase có proof `zero_gap_solver`, objective tương ứng 8 và 40. Bound gốc 8/40
được chuyển bảo thủ thành lower bound nguyên 7/39 theo plan; reported gap còn 1
không phủ nhận proof zero-gap. Report giữ proof_basis để phân biệt hai bằng chứng.

Timing là một smoke trên máy dev, không phải SLA hoặc kết luận tốc độ. P50/P95 của
một quan sát trùng với quan sát đó; chưa đại diện phân phối thời gian. Kết quả
timing sẽ thay đổi khi replay. Feasible rate 1/1 chỉ mô tả fixture này.

## Kiểm tra và giới hạn

- 124 tests M1 pass: input/evaluator/generator, solver status/proof/deadline,
  exact lock, oracle nhỏ và CLI/report. `ruff check .`, `black --check .` (130 Python files; notebook bị skip do thiếu Jupyter dependencies) và import-linter pass.
- `mypy` đã chạy: 39 lỗi trong serving do venv M1 thiếu fastapi/starlette/httpx,
  psycopg/cryptography và decorator mất typing theo các import thiếu. Chưa xác nhận
  type check serving xanh; không sửa serving hoặc cài toàn bộ ML stack.
- Chưa chạy SCIP/SA/Tabu, benchmark grid, forecast, HTTP integration hoặc pilot.
  Không có numerical anchors workforce đã QA. Aggregate feasible chưa chứng minh
  roster cá nhân khả thi; unmet-hours chưa chứng minh hiệu lực giảm ca bệnh.

Review độc lập phát hiện report thiếu objective incumbent khi timeout/lỗi; đã sửa
và chạy regression RED→GREEN, toàn bộ 124 tests pass lại sau sửa.
