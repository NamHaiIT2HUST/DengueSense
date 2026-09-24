"""Phân tích results.json của exp_006: bảng phân rã §4.2 và bảng LOPO §4.3.

MASE của 1 nhóm dòng = mean|y_true - pred| / scale, với scale = mẫu số MASE
của origin tương ứng (đã lưu sẵn từng dòng) — trung bình có trọng số theo số
dòng, khớp định nghĩa MASE gộp của các experiment trước.

Chạy: python experiments/exp_006_lopo_breakdown/analyze.py  (từ ai-service/)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import numpy as np
import pandas as pd

_PATH = Path(__file__).resolve().parent / "results.json"
pd.set_option("display.width", 140)
pd.set_option("display.max_rows", 100)


def scaled_abs_err(df: pd.DataFrame, col: str) -> pd.Series:
    return (df["y_true"] - df[col]).abs() / df["scale"]


def group_mase(df: pd.DataFrame, by: str, cols: list[str]) -> pd.DataFrame:
    out = {}
    for c in cols:
        d = df.dropna(subset=[c])
        out[c] = scaled_abs_err(d, c).groupby(d[by]).mean()
    res = pd.DataFrame(out)
    res["n"] = df.groupby(by).size()
    return res.round(3)


def main() -> None:
    data = json.loads(_PATH.read_text(encoding="utf-8"))
    std = pd.DataFrame(data["standard"])
    lopo = pd.DataFrame(data["lopo"])
    cols = ["M2b_lightgbm", "E1_gbm", "E1"]

    print(
        "=== §4.2 PHÂN RÃ (standard, MASE trung bình; 1.0 = ngang seasonal-naive) ==="
    )
    print("\n-- Tổng theo horizon --")
    print(group_mase(std, "horizon", cols))
    for by in ["region", "is_peak_season", "is_outbreak"]:
        print(f"\n-- Theo {by} --")
        print(group_mase(std, by, cols))
    print("\n-- Chế độ dịch x horizon (E1) --")
    piv = (
        scaled_abs_err(std.dropna(subset=["E1"]), "E1")
        .groupby([std["is_outbreak"], std["horizon"]])
        .mean()
        .unstack()
        .round(3)
    )
    print(piv)
    print("\n-- Bias (pred - true, đv incidence/100k) theo chế độ dịch, E1 --")
    d = std.dropna(subset=["E1"])
    print((d["E1"] - d["y_true"]).groupby(d["is_outbreak"]).mean().round(2))
    print("\n-- Tỷ lệ tháng bùng dịch mà E1 dự báo dưới thực tế > 50% --")
    ob = d[d["is_outbreak"]]
    print(f"{(ob['E1'] < 0.5 * ob['y_true']).mean():.1%} của {len(ob)} quan sát")

    print("\n-- MASE THEO VÙNG với mẫu số riêng từng vùng (kỹ năng thật) --")
    from app.forecast.backtest import (
        compute_train_naive_errors,
        load_real_panel_with_features,
    )

    fp = load_real_panel_with_features()
    reg = std.drop_duplicates("province_id").set_index("province_id")["region"]
    fp["region"] = fp["province_id"].map(reg)
    std = std.copy()
    std["train_end"] = [
        pd.Timestamp(t) - pd.DateOffset(months=int(h))
        for t, h in zip(std["target_month"], std["horizon"])
    ]
    rscale = {}
    for te, r in std.groupby(["train_end", "region"]).groups:
        hist = fp[(fp["month"] <= te) & (fp["region"] == r)]
        rscale[(te, r)] = float(np.mean(compute_train_naive_errors(hist)))
    std["rscale"] = [rscale[(a, b)] for a, b in zip(std["train_end"], std["region"])]
    for c in ["M2b_lightgbm", "E1"]:
        d = std.dropna(subset=[c])
        e = (d["y_true"] - d[c]).abs() / d["rscale"]
        print(c, e.groupby(d["region"]).mean().round(3).to_dict())

    print("\n=== §4.3 LOPO (ensemble GBM = M2a+M2b) ===")
    key = ["origin", "horizon", "province_id"]
    m = std.merge(lopo, on=key, suffixes=("", "_lopo"))
    m["err_std"] = (m["y_true"] - m["E1_gbm"]).abs() / m["scale"]
    m["err_lopo"] = (m["y_true"] - m["E1_gbm_lopo"]).abs() / m["scale"]
    tot_s, tot_l = m["err_std"].mean(), m["err_lopo"].mean()
    print(
        f"\nGộp: standard {tot_s:.4f} | LOPO {tot_l:.4f} | "
        f"kém đi {100 * (tot_l - tot_s) / tot_s:+.1f}%"
    )
    print("\n-- Theo horizon --")
    byh = m.groupby("horizon")[["err_std", "err_lopo"]].mean()
    byh["kem_di_%"] = 100 * (byh["err_lopo"] - byh["err_std"]) / byh["err_std"]
    print(byh.round(3))
    print("\n-- Theo vùng --")
    byr = m.groupby("region")[["err_std", "err_lopo"]].mean()
    byr["kem_di_%"] = 100 * (byr["err_lopo"] - byr["err_std"]) / byr["err_std"]
    print(byr.round(3))
    print("\n-- Theo tỉnh (10 tỉnh LOPO kém nhất) --")
    byp = m.groupby("province_id")[["err_std", "err_lopo"]].mean()
    byp["kem_di_%"] = 100 * (byp["err_lopo"] - byp["err_std"]) / byp["err_std"]
    print(byp.sort_values("kem_di_%", ascending=False).head(10).round(3))
    print(
        f"\nSố tỉnh LOPO tốt hơn standard: {(byp['err_lopo'] < byp['err_std']).sum()}/{len(byp)}"
    )
    print(f"LOPO MASE < 1.0 (thắng seasonal-naive): {tot_l < 1.0}")
    _ = np  # np giữ cho mở rộng sau


if __name__ == "__main__":
    main()
