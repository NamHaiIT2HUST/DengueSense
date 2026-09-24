"""Smoke test exp_013: A0 phải khớp exp_012 tuyệt đối; các cột A1 phải là số thực."""

import json
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")
_HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(_HERE))
sys.path.insert(0, str(_HERE.parents[1]))

import numpy as np
import pandas as pd
import run as r

from app.data.adjacency import build_adjacency_matrix

panel = r.e12.with_thresholds(
    r.add_spatial_features(
        r.e12.load_real_panel_with_features(), build_adjacency_matrix()
    )
)
splits = r.make_splits(
    panel, n_origins=8, horizons=r.HORIZONS, embargo_months=1, reporting_delay_months=1
)
s, h = splits[3], 3
hp = r.build_pairs(panel, h)
tr = hp[(hp.month <= s.train_end) & (hp._target_month <= s.train_end)].dropna(
    subset=["label"]
)
te = hp[hp.month == s.train_end].dropna(subset=["label"])
p0 = r._fit_predict(tr, te, r.COLS_A0)
e12_path = _HERE.parent / "exp_012_direct_classifier" / "predictions.json"
E = pd.DataFrame(json.loads(e12_path.read_text("utf-8")))
E = (
    E[(E.window == "outer") & (E.origin == 3) & (E.horizon == h)]
    .set_index("province_id")
    .p_clf
)
print(
    "A0 vs exp_012 max abs diff:",
    float(np.max(np.abs(p0 - E.loc[te.province_id].to_numpy()))),
)
print("A1 cols float:", all(pd.api.types.is_float_dtype(te[c]) for c in r.COLS_A1))
print("A1 NaN frac in test:", float(te[r.COLS_A1].isna().mean().max()))
