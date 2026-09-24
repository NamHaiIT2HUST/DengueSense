"""Kiểm tra `app.forecast.m4.predict_m4` tái tạo đúng M4-R2 suy từ kết quả
exp_008 (cùng origin/horizon) — sai lệch phải ~0.

Chạy: python experiments/exp_008_outbreak_north/verify_m4_equivalence.py (từ ai-service/)
"""

from __future__ import annotations

import json
import sys
import warnings
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import pandas as pd

from app.forecast.backtest import build_horizon_pairs, load_real_panel_with_features
from app.forecast.m4 import predict_m4
from app.forecast.splits import make_splits

warnings.filterwarnings("ignore")
HERE = Path(__file__).resolve().parent
CHOICE = {"Bắc": "C1_tweedie", "Nam": "C3_blend_B3", "Trung": "C0_control"}

fp = load_real_panel_with_features()
meta = pd.read_csv(_ROOT / "data" / "external" / "province_metadata.csv")
reg = dict(zip(meta.new_province_code, meta.region))
splits = make_splits(
    fp,
    n_origins=8,
    horizons=(1, 2, 3, 6),
    embargo_months=1,
    reporting_delay_months=1,
)
R = pd.DataFrame(json.loads((HERE / "results.json").read_text("utf-8")))
R = R[R.window == "outer"]
m1 = pd.DataFrame(
    json.loads(
        (_ROOT / "experiments" / "exp_006_lopo_breakdown" / "results.json").read_text(
            "utf-8"
        )
    )["standard"]
)
for i, h in [(2, 3), (5, 1), (7, 6)]:
    s = splits[i]
    hp = build_horizon_pairs(fp, h)
    tr = hp[(hp.month <= s.train_end) & (hp._target_month <= s.train_end)].dropna(
        subset=["y_target"]
    )
    te = hp[hp.month == s.train_end].dropna(subset=["y_target"])
    new = predict_m4(tr, te, fp[fp.month <= s.train_end], s.target_month(h), reg)
    g = R[(R.origin == i) & (R.horizon == h)]
    ref = {
        r.province_id: r.pred for r in g.itertuples() if r.variant == CHOICE[r.region]
    }
    mm = m1[(m1.origin == i) & (m1.horizon == h)].set_index("province_id").M1_glm_negbin
    exp = {p: ref[p] if pd.isna(mm.get(p)) else (mm[p] + 2 * ref[p]) / 3 for p in ref}
    print(i, h, "max abs diff:", max(abs(new[p] - exp[p]) for p in exp))
