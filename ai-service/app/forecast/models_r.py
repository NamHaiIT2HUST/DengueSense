"""M3 — bán cơ giới endemic-epidemic (`hhh4`, package R `surveillance`,
docs/02 §3). Tách riêng khỏi `models.py` vì cần R cài sẵn (`r_env.setup_r()`)
— `models.py`/CI không phụ thuộc module này.

Kiến trúc `hhh4` (khác hẳn M1/M2 — không nhận `feature_cols` tuỳ ý):
- `ar` (autoregressive): ca bệnh CHÍNH tỉnh đó tháng trước
- `ne` (neighbour-driven epidemic): ca bệnh TỈNH KỀ tháng trước, trọng số =
  ma trận kề nhị phân (`app/data/adjacency.py`) — đây là thành phần lan
  truyền không gian, lý do chính hhh4 có mặt trong model zoo (docs/02 §3)
- `end` (endemic): baseline mùa vụ (hài hoà bậc 1) + offset dân số

Dự báo h bước: MÔ PHỎNG (Monte Carlo, `simulate.hhh4`) tiến về tương lai từ
`train_end`, trung bình qua nhiều lần mô phỏng — đây là cách chuẩn của
package cho dự báo đa bước từ model tự hồi quy, KHÔNG mâu thuẫn với
"không dùng đệ quy" ở docs/02 §1 (điều đó áp dụng cho M1/M2 dạng bảng đặc
trưng, không áp dụng cho model chuỗi thời gian cơ giới như hhh4).

⚠️ Bẫy rpy2 đã gặp thật: object `fit` (S4 phức tạp) round-trip qua biến
Python rồi gán ngược lại `globalenv` gây lỗi conversion khó hiểu
(`NotImplementedError: Conversion 'py2rpy' not defined for ... numpy.ndarray`)
— vì trong lúc trích xuất, converter tự động biến 1 phần nội dung thành
numpy array không có converter ngược. Cách né: GIỮ `fit`/`stsObj` LUÔN Ở
TRONG R's global environment (gán bằng `<-` trong chuỗi code R, không kéo
ra biến Python rồi gán lại) — chỉ đưa qua lại Python các mảng/số nguyên
thô (numpy array, int, str).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.data.adjacency import build_adjacency_matrix
from app.forecast.r_env import setup_r


def _pivot_wide(
    df: pd.DataFrame, value_col: str, province_order: list[str]
) -> pd.DataFrame:
    wide = df.pivot(index="month", columns="province_id", values=value_col)
    wide = wide.reindex(columns=province_order).sort_index()
    return wide


def fit_hhh4(
    panel: pd.DataFrame,
    train_end: pd.Timestamp,
    max_horizon: int,
    province_order: list[str] | None = None,
) -> tuple[list[str], int, pd.DatetimeIndex, pd.DataFrame]:
    """Fit hhh4 trên dữ liệu tới `train_end`; `fit`/`stsObj` được giữ trong
    R's global environment (biến tên `fit`, `stsObj`) — KHÔNG trả về qua
    Python (xem cảnh báo module). Trả về (province_order, train_end_idx
    1-indexed, all_months, pop_wide) — đủ để `simulate_forecast()` dùng
    tiếp mà không cần round-trip object R phức tạp.
    """
    setup_r()
    from rpy2 import robjects
    from rpy2.robjects import numpy2ri

    robjects.r("suppressMessages(library(surveillance))")

    if province_order is None:
        province_order = sorted(panel["province_id"].unique())

    full_end = train_end + pd.DateOffset(months=max_horizon)
    all_months = pd.date_range(panel["month"].min(), full_end, freq="MS")

    cases_wide = _pivot_wide(panel, "cases", province_order).reindex(all_months)
    pop_wide = _pivot_wide(panel, "population", province_order).reindex(all_months)
    pop_wide = pop_wide.ffill().bfill()

    observed_for_sts = cases_wide.fillna(0.0).to_numpy()
    train_end_idx = all_months.get_loc(train_end) + 1  # 1-indexed cho R

    adjacency = build_adjacency_matrix()
    adjacency = adjacency.reindex(index=province_order, columns=province_order).fillna(
        0.0
    )

    with (robjects.default_converter + numpy2ri.converter).context():
        r_observed = robjects.r["matrix"](
            robjects.FloatVector(observed_for_sts.flatten(order="F")),
            nrow=observed_for_sts.shape[0],
            ncol=observed_for_sts.shape[1],
        )
        r_population = robjects.r["matrix"](
            robjects.FloatVector(pop_wide.to_numpy().flatten(order="F")),
            nrow=pop_wide.shape[0],
            ncol=pop_wide.shape[1],
        )
        r_neighbourhood = robjects.r["matrix"](
            robjects.FloatVector(adjacency.to_numpy().flatten(order="F")),
            nrow=adjacency.shape[0],
            ncol=adjacency.shape[1],
        )
        robjects.globalenv["r_observed"] = r_observed
        robjects.globalenv["r_population"] = r_population
        robjects.globalenv["r_neighbourhood"] = r_neighbourhood

    start_year = int(all_months[0].year)
    start_month = int(all_months[0].month)
    robjects.globalenv["train_end_idx"] = train_end_idx

    robjects.r(f"""
        stsObj <- sts(
            observed = r_observed,
            start = c({start_year}, {start_month}),
            frequency = 12,
            population = r_population / rowSums(r_population),
            neighbourhood = (r_neighbourhood == 1)
        )
        control <- list(
            ar = list(f = ~1),
            ne = list(f = ~1, weights = neighbourhood(stsObj) == 1),
            end = list(f = ~1 + sin(2*pi*t/12) + cos(2*pi*t/12),
                       offset = population(stsObj)),
            family = "NegBin1",
            subset = 2:train_end_idx
        )
        fit <- hhh4(stsObj, control = control)
        """)
    return province_order, train_end_idx, all_months, pop_wide


def simulate_forecast(
    train_end_idx: int, horizon: int, nsim: int = 200, seed: int = 42
) -> np.ndarray:
    """Mô phỏng Monte Carlo `nsim` lần từ `train_end_idx` tới
    `train_end_idx + horizon`, dùng `fit`/`stsObj` hiện có trong R's global
    environment (do `fit_hhh4()` để lại) — trả về TRUNG BÌNH số ca dự báo
    (mảng theo tỉnh, đúng thứ tự lúc fit) tại đúng bước `horizon`."""
    setup_r()
    from rpy2 import robjects
    from rpy2.robjects import numpy2ri

    robjects.globalenv["target_idx"] = train_end_idx + horizon
    robjects.globalenv["from_idx"] = train_end_idx

    robjects.r(f"""
        set.seed({seed})
        sim <- simulate(fit, nsim={nsim}, y.start = observed(fit$stsObj)[from_idx, ],
                         subset = (from_idx+1):target_idx)
        # class "hhh4sims" co method `[` RIENG khong tu drop chieu don vi
        # nhu array thuong (da gap that: sim[6,,] tren object nay giu
        # dim=c(1,34,200) thay vi drop con [34,200], lam rowMeans() gop
        # nham ca 34 tinh thanh 1 so). unclass() truoc de duoc hanh vi
        # array chuan.
        sim_arr <- unclass(sim)
        last_step <- sim_arr[dim(sim_arr)[1], , ]
        pred_mean <- if (is.null(dim(last_step))) last_step else rowMeans(last_step)
        """)
    with (robjects.default_converter + numpy2ri.converter).context():
        pred_mean = np.asarray(robjects.globalenv["pred_mean"])
    return pred_mean


def fit_predict_m3_hhh4(
    train_df: pd.DataFrame,
    target_month: pd.Timestamp,
    horizon: int,
    full_panel_for_sts: pd.DataFrame,
    nsim: int = 200,
    seed: int = 42,
) -> dict[str, float]:
    """Giao diện tiện dụng: fit + simulate trong 1 lần gọi, trả về dict
    {province_id: predicted incidence_per_100k}.

    ⚠️ `full_panel_for_sts` cần trải dài tới ÍT NHẤT `target_month` (chỉ để
    xác định ĐỘ DÀI ma trận observed cho sts — giá trị observed thật ở các
    tháng SAU train_end không được hhh4 dùng để fit, xem `fit_hhh4()`)."""
    train_end = train_df["month"].max()
    province_order, train_end_idx, all_months, pop_wide = fit_hhh4(
        full_panel_for_sts, train_end, max_horizon=horizon
    )
    pred_cases = simulate_forecast(train_end_idx, horizon, nsim=nsim, seed=seed)

    target_idx = all_months.get_loc(target_month)
    pop_at_target = pop_wide.iloc[target_idx]

    result = {}
    for i, province_id in enumerate(province_order):
        pop = pop_at_target[province_id]
        result[province_id] = (
            float(pred_cases[i] / pop * 100_000) if pop > 0 else float("nan")
        )
    return result
