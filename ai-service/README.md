# ai-service

Service **Python (FastAPI)** chứa toàn bộ 3 lớp AI của DengueSense. `backend` gọi vào đây qua REST, không có logic ML/optimize nào nằm ở `backend`.

## Trách nhiệm

- **Layer 1 — Forecast**: GLM Negative Binomial phân cấp + Gradient Boosting (XGBoost/LightGBM) + mô hình bán cơ giới hhh4 + ensemble (đã cắt gọn từ 10 xuống 4 model, xem [docs/06 §4](../docs/06-khao-sat-tai-lieu.md#4-chốt-lựa-chọn-model--cắt-bớt-để-tiết-kiệm-thời-gian)). Output: risk score theo tỉnh/tháng, kèm khoảng tin cậy.
- **Layer 2 — Optimize**: nhận kết quả Layer 1 + ngân sách, tối ưu **số ca giảm được** (không phải xếp hạng rủi ro thuần) bằng MILP (OR-Tools) — xem [docs/04](../docs/04-phuong-phap-toi-uu.md).
- **Layer 3 — GenAI RAG**: nhận phương án tối ưu, sinh dự thảo văn bản điều phối (luồng B2G, theo mẫu Bộ Y tế, có RAG trên kho quy định) hoặc cảnh báo vận hành ngắn (luồng B2B).

## Trạng thái hiện tại

- ✅ **`app/data/`** — pipeline dữ liệu đã code + test, xem bên dưới.
- ✅ **`app/forecast/`** — thư viện Layer 1 (M4-R2, cảnh báo P75, SHAP…) + 16 thí nghiệm ở `experiments/`; đọc [docs/07 (model card)](../docs/07-model-card.md) và [docs/08 (bàn giao)](../docs/08-ban-giao-layer1.md).
- ✅ **`app/serving/`** — lớp phục vụ (Đợt 0): hạ tầng dùng chung (`common/`) + khung API `forecast_api` (health, lỗi problem+json, log JSON). Xem [docs/09 §10.4](../docs/09-kien-truc-backend.md#104-tách-thư-viện-nghiên-cứu-và-serving-trong-ai-service). Endpoint dự báo thêm ở Đợt 1 sau khi có hợp đồng nội bộ.
- `app/optimize/` — staffing M1 offline với dữ liệu mô phỏng, CP-SAT và evaluator/oracle; xem mục Staffing M1. API `/allocate` legacy chưa dùng solver này.
- ⏳ `app/genai_rag/` (Layer 3) — chưa scaffold, xem [ROADMAP.md](../ROADMAP.md) Phase 4.

### Chạy khung API `forecast`

```bash
uvicorn app.serving.forecast_api.main:create_app_from_env --factory --port 8001
```

Kiểm tra chất lượng lớp phục vụ (ngoài ruff/black/pytest chung):

```bash
mypy            # --strict, chỉ áp cho app/serving (xem mypy.ini)
lint-imports    # luật kiến trúc: thư viện nghiên cứu không import serving (xem .importlinter)
```

Image: `docker build -f ai-service/Dockerfile --build-arg VERSION=$(git rev-parse HEAD) ai-service` (ngữ cảnh build dùng allowlist trong `.dockerignore` — dữ liệu thô, venv, notebook KHÔNG vào image).

## Staffing M1 — offline, dữ liệu mô phỏng

Python mới ở `app/optimize`, tests ở `tests/test_optimize` và CLI ở
`experiments/exp_017_staffing_mvp`. Giữ namespace `app`/`experiments`; không
di chuyển code Layer 1. Venv Python 3.13 có tên `ai-service`, ở `ai-service/ai-service`
tính từ repo root. Chọn interpreter `ai-service/ai-service/bin/python` trong IDE.

Từ thư mục `ai-service/`:

```bash
source ai-service/bin/activate
python -m pytest tests/test_optimize -q
ruff check app/optimize tests/test_optimize experiments/exp_017_staffing_mvp
black --check app/optimize tests/test_optimize experiments/exp_017_staffing_mvp
lint-imports
python -m experiments.exp_017_staffing_mvp.run --config experiments/exp_017_staffing_mvp/config.yaml --out data/processed/staffing-mvp
```

CP-SAT tối ưu weighted unmet-hours trước, incremental VND sau, giữ supply sau
commitment/reserve, qualification/tuyến, budget, floor/cap và lock bằng chính xác.
Evaluator độc lập kiểm mọi phương án; oracle nhỏ kiểm objective trong tests.
Report có scenario/hash/seed/version, status/proof/bound/gap từng phase và timing.
`ERROR`/`MODEL_INVALID` trả exit nonzero, dù còn incumbent phục vụ chẩn đoán;
`INFEASIBLE`/`UNKNOWN` được lưu đúng nhãn, không tạo plan thay thế.

Chỉ có M1 CP-SAT; chưa chạy benchmark M2, SCIP/SA/Tabu hoặc nối HTTP/Layer 3.
Nguồn và giả định: [staffing.md](docs/data-sources/staffing.md).
Aggregate feasible chưa chứng minh roster cá nhân khả thi. Coverage chưa đo
hiệu lực phòng dịch; không suy ra số ca tránh được hoặc dùng để điều phối thật.

## Pipeline dữ liệu (`app/data/`) — đã chạy được thật

```
app/data/
├── crosswalk.py             # ánh xạ 63 tỉnh cũ -> 34 tỉnh mới (NQ 202/2025/QH15)
├── ingest_opendengue.py     # tải + lọc dữ liệu dịch tễ Việt Nam từ OpenDengue
├── estimate_province.py     # small-area estimation cho giai đoạn thiếu dữ liệu tỉnh (2011+)
└── build_panel.py           # ghép tất cả -> data/processed/vX.Y.Z/panel_monthly.parquet
```

Chạy toàn bộ pipeline bằng 1 lệnh:

```bash
python -m app.data.build_panel
```

Kết quả v0.1.0 hiện tại: **9.326 dòng** (tỉnh × tháng), phủ 34/34 tỉnh, 1994–2025, **72,7% dữ liệu thật** (`data_source="real"`, phần còn lại `data_source="estimated"` — xem [docs/01 §2.1c](../docs/01-chien-luoc-du-lieu.md#21c-ước-lượng-cấp-tỉnh-cho-giai-đoạn-2011-2025-đã-chốt-phương-án-2--small-area-estimation) để biết vì sao và giới hạn của nó).

Chạy test riêng phần dữ liệu:

```bash
pytest tests/test_data/ -v
```

Đọc kỹ trước khi đụng vào code hoặc dữ liệu ở đây: [docs/01-chien-luoc-du-lieu.md](../docs/01-chien-luoc-du-lieu.md) — mọi quy tắc (bảo toàn tổng, gắn nhãn `data_source`, không rò rỉ dữ liệu) đều bắt buộc, có test kiểm tra chứ không chỉ ghi trong tài liệu.

## Scaffold còn thiếu (khi bắt đầu code Layer 1/2/3)

```
app/
├── main.py              # FastAPI app
├── forecast/             # Layer 1
├── optimize/              # Layer 2
├── genai_rag/               # Layer 3
└── schemas/                  # Pydantic models — đây là API contract với backend
```

`models/` (model weight, gitignored) chưa tạo — tạo khi có model đầu tiên cần lưu, xem CONTRIBUTING mục 4.

## Quy tắc riêng cho service này

- Không hardcode hyperparameter/đường dẫn — đọc từ config/env.
- Model weight và dataset thô **không** commit vào git (đã có trong `.gitignore`) — chỉ commit `data/external/` (crosswalk, alias — nhẹ, quan trọng).
- Notebook chỉ để thử nghiệm, logic cuối cùng đưa vào module `.py` test được.
- Format `black`, lint `ruff` — bắt buộc pass CI. Đã chạy sạch cho `app/data/`.
- Cài môi trường: `python -m venv venv && source venv/Scripts/activate && pip install -r requirements.txt` (Windows Git Bash — xem `../CONTRIBUTING.md` nếu dùng PowerShell).

Xem thêm [../CONTRIBUTING.md](../CONTRIBUTING.md).
