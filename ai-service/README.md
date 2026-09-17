# ai-service

Service **Python (FastAPI)** chứa toàn bộ 3 lớp AI của DengueSense. `backend` gọi vào đây qua REST, không có logic ML/optimize nào nằm ở `backend`.

## Trách nhiệm

- **Layer 1 — Forecast**: XGBoost / RandomForest / LinearRegression ensemble, feature engineering (cyclical time encoding, multi-lag sliding window, epidemic momentum), TimeSeriesSplit cross-validation. Output: risk score `Ri` (0-100) theo khu vực/tháng.
- **Layer 2 — Optimize**: nhận `Ri` + ngân sách, giải bài toán phân bổ nguồn lực bằng MILP (OR-Tools) + Simulated Annealing/Tabu Search.
- **Layer 3 — GenAI RAG**: nhận phương án tối ưu, sinh dự thảo văn bản điều phối (luồng B2G, theo mẫu Bộ Y tế, có RAG trên kho quy định) hoặc cảnh báo vận hành ngắn (luồng B2B).

## Scaffold (khi bắt đầu code)

```
ai-service/
├── app/
│   ├── main.py              # FastAPI app
│   ├── forecast/             # Layer 1
│   ├── optimize/              # Layer 2
│   ├── genai_rag/               # Layer 3
│   └── schemas/                  # Pydantic models — đây là API contract với backend
├── models/                        # model weight — gitignored, xem CONTRIBUTING mục 4
├── data/                            # dataset — gitignored
├── tests/
└── requirements.txt
```

## Quy tắc riêng cho service này

- Không hardcode hyperparameter/đường dẫn — đọc từ config/env.
- Model weight và dataset thô **không** commit vào git (đã có trong `.gitignore`) — ghi rõ ở đây cách tải khi có chỗ lưu chính thức.
- Notebook chỉ để thử nghiệm, logic cuối cùng đưa vào module `.py` test được.
- Format `black`, lint `ruff` — bắt buộc pass CI.

Xem thêm [../CONTRIBUTING.md](../CONTRIBUTING.md).
