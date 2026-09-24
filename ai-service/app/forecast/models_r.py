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

## Covariate khí hậu trong `end$f` (thêm sau exp_004, xem RESULTS.md exp_004
"Việc tiếp theo")

exp_004 chạy bản KHÔNG có khí hậu, thua mọi model khác — chẩn đoán là do
thiếu đúng tín hiệu mạnh nhất. Bản này thêm covariate khí hậu, nhưng **CỐ Ý
dùng CHUẨN MÙA VỤ theo tỉnh (climatology: trung bình lịch sử theo tháng
dương lịch, tính CHỈ từ dữ liệu <= train_end)**, KHÔNG dùng giá trị khí hậu
thực đo tại từng thời điểm — lý do:

`simulate.hhh4()` mô phỏng TIẾN VỀ TƯƠNG LAI (đến `train_end+horizon`), và
tại MỖI bước tương lai đó, `end$f` cần 1 giá trị covariate cụ thể — không
giống M1/M2 (dạng bảng, feature neo cố định tại `train_end`), hhh4 cần
covariate CÓ MẶT Ở CẢ bước tương lai đang mô phỏng. Nếu dùng khí hậu thực đo
(vd `temp_mean` lag 2 tháng) thì giá trị tại bước tương lai đó sẽ đọc từ
ERA5 THẬT của giai đoạn SAU `train_end` — đúng lớp lỗi rò rỉ đã bắt được ở
exp_002 (feature neo sai tại `target_month` thay vì `train_end`), chỉ khác
là ở đây lộ ra qua covariate của model cơ giới thay vì qua bảng đặc trưng.
Climatology theo tháng dương lịch thì KHÔNG có vấn đề này — giá trị "nhiệt
độ trung bình lịch sử tháng 7 tại Cà Mau" biết trước được ở bất kỳ bước
tương lai nào mà không cần đo thật, đúng tinh thần B3 Climatology
(exp_001) — chỉ khác B3 là climatology tính RIÊNG theo tỉnh, dùng làm
covariate cho `end` thay vì dùng trực tiếp làm dự báo.
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


def _build_climatology_covariate(
    panel: pd.DataFrame,
    col: str,
    train_end: pd.Timestamp,
    province_order: list[str],
    all_months: pd.DatetimeIndex,
) -> pd.DataFrame:
    """Ma trận time×tỉnh cho biến khí hậu `col`, giá trị = TRUNG BÌNH LỊCH
    SỬ theo (tỉnh, tháng dương lịch), tính CHỈ từ dữ liệu `<= train_end` —
    xem module docstring phần "Covariate khí hậu trong end$f" cho lý do
    dùng climatology thay vì giá trị thực đo (tránh rò rỉ khi mô phỏng
    tương lai). Z-score chuẩn hoá (theo mean/std của chính climatology vừa
    tính) để ổn định số học, cùng cách tiếp cận với M1 GLM NegBin.
    """
    train_data = panel[panel["month"] <= train_end]
    clim = (
        train_data.groupby([train_data["month"].dt.month, "province_id"])[col]
        .mean()
        .unstack("province_id")
        .reindex(index=range(1, 13), columns=province_order)
    )
    clim = clim.apply(lambda s: s.fillna(s.mean()), axis=0)

    wide = pd.DataFrame(
        clim.loc[all_months.month].to_numpy(),
        index=all_months,
        columns=province_order,
    )
    mean, std = wide.to_numpy().mean(), wide.to_numpy().std()
    return (wide - mean) / std


def fit_hhh4(
    panel: pd.DataFrame,
    train_end: pd.Timestamp,
    max_horizon: int,
    province_order: list[str] | None = None,
    climate_cols: tuple[str, ...] | None = None,
) -> tuple[list[str], int, pd.DatetimeIndex, pd.DataFrame]:
    """Fit hhh4 trên dữ liệu tới `train_end`; `fit`/`stsObj` được giữ trong
    R's global environment (biến tên `fit`, `stsObj`) — KHÔNG trả về qua
    Python (xem cảnh báo module). Trả về (province_order, train_end_idx
    1-indexed, all_months, pop_wide) — đủ để `simulate_forecast()` dùng
    tiếp mà không cần round-trip object R phức tạp.

    `climate_cols` — tên cột khí hậu thô trong `panel` (vd `("temp_mean",
    "precip_total")`) để thêm vào `end$f` dưới dạng climatology theo tỉnh
    (xem `_build_climatology_covariate`). `None`/rỗng = giữ nguyên bản gốc
    (chỉ mùa vụ sin/cos, không khí hậu) như exp_004 lần chạy đầu.
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

    climate_matrices = {
        col: _build_climatology_covariate(
            panel, col, train_end, province_order, all_months
        )
        for col in (climate_cols or ())
    }

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

        for col, mat in climate_matrices.items():
            r_mat = robjects.r["matrix"](
                robjects.FloatVector(mat.to_numpy().flatten(order="F")),
                nrow=mat.shape[0],
                ncol=mat.shape[1],
            )
            robjects.globalenv[f"r_cov_{col}"] = r_mat

    start_year = int(all_months[0].year)
    start_month = int(all_months[0].month)
    robjects.globalenv["train_end_idx"] = train_end_idx

    extra_terms = "".join(f" + {col}" for col in climate_matrices)
    data_arg = ""
    if climate_matrices:
        data_list = ", ".join(f"{col} = r_cov_{col}" for col in climate_matrices)
        data_arg = f",\n            data = list({data_list})"

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
            end = list(f = ~1 + sin(2*pi*t/12) + cos(2*pi*t/12){extra_terms},
                       offset = population(stsObj)),
            family = "NegBin1",
            subset = 2:train_end_idx{data_arg}
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
    climate_cols: tuple[str, ...] | None = None,
) -> dict[str, float]:
    """Giao diện tiện dụng: fit + simulate trong 1 lần gọi, trả về dict
    {province_id: predicted incidence_per_100k}.

    ⚠️ `full_panel_for_sts` cần trải dài tới ÍT NHẤT `target_month` (chỉ để
    xác định ĐỘ DÀI ma trận observed cho sts — giá trị observed thật ở các
    tháng SAU train_end không được hhh4 dùng để fit, xem `fit_hhh4()`)."""
    train_end = train_df["month"].max()
    province_order, train_end_idx, all_months, pop_wide = fit_hhh4(
        full_panel_for_sts, train_end, max_horizon=horizon, climate_cols=climate_cols
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
