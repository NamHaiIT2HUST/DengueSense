"""Model zoo Tier 1 (docs/02 §3) — M1 GLM NegBin (hiệu ứng cố định theo
tỉnh), M2 XGBoost + LightGBM. M3 (hhh4, cần R/rpy2) và M4 (ensemble) ở
module riêng khi sẵn sàng.

Mọi model dùng CHUNG 1 tập đặc trưng (`app/forecast/features.py`) và cùng
target `incidence_per_100k` — so sánh công bằng theo đúng nguyên tắc
docs/02 §3.

Mỗi hàm `fit_predict_*` nhận `(train_df, predict_df, feature_cols)` đã có
sẵn cột feature (gọi `build_feature_matrix()` trước), tự drop NaN ở TRAIN
(tháng đầu chuỗi chưa đủ lịch sử cho lag dài) — KHÔNG drop ở `predict_df`,
trả NaN cho dòng nào predict_df thiếu feature để lộ ra chỗ dữ liệu thiếu
thay vì âm thầm bỏ qua.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf


def _drop_incomplete_rows(df: pd.DataFrame, feature_cols: list[str]) -> pd.DataFrame:
    return df.dropna(subset=list(feature_cols)).copy()


# ------------------------------------------------------------- M1: GLM ----


def fit_predict_m1_glm_negbin(
    train_df: pd.DataFrame,
    predict_df: pd.DataFrame,
    feature_cols: list[str],
    target_col: str = "cases",
) -> np.ndarray:
    """GLM Negative Binomial, `offset=log(population)`, hiệu ứng CỐ ĐỊNH
    theo tỉnh (`C(province_id)`, dummy-coded) + toàn bộ `feature_cols`.
    Fit trên `target_col` (mặc định `cases`, đúng bản chất Poisson/NegBin
    là biến đếm) nhưng LUÔN TRẢ VỀ `incidence_per_100k` (đổi đơn vị bằng
    population) để so sánh công bằng với các model khác.

    ⚠️ Đây là hiệu ứng tỉnh CỐ ĐỊNH (fixed effect), không phải "phân cấp"
    (hierarchical/random effect, partial pooling) đúng nghĩa thống kê như
    docs/02 mô tả — bản đầy đủ cần `glmmTMB`(R) hoặc PyMC (Bayes), tốn công
    hơn nhiều. Fixed-effect NegBin là baseline hợp lý cho vòng T1 mặc định:
    đã đủ giải quyết đúng điểm yếu tìm thấy ở exp_001 (B4 pooled không có
    hệ số riêng theo tỉnh) — nâng cấp lên random-effect ghi trong "việc tiếp
    theo" của RESULTS.md, không chặn vòng đánh giá đầu tiên.

    ⚠️ Ổn định số học (đã gặp lỗi overflow/phân kỳ thật khi thử không có 2
    điểm dưới đây, xem RESULTS.md exp_002 "Điều bất ngờ"):
    1. Chuẩn hoá (z-score) các cột feature LIÊN TỤC trước khi fit — offset
       lớn (log dân số ~15-16) + feature thang đo rất khác nhau (nhiệt độ
       ~25 vs mưa/động lượng có thể vài trăm) làm MLE mất ổn định.
    2. Warm-start bằng hệ số từ GLM **Poisson** (ổn định hơn NegBin nhiều)
       cùng offset/feature, dùng làm `start_params` cho NegBin MLE.
    """
    clean_train = _drop_incomplete_rows(train_df, feature_cols)
    if clean_train["province_id"].nunique() < 2:
        raise ValueError("Cần >= 2 tỉnh trong train để ước lượng hiệu ứng cố định.")

    means = clean_train[feature_cols].mean()
    stds = clean_train[feature_cols].std().replace(0, 1.0)

    def _standardize(df: pd.DataFrame) -> pd.DataFrame:
        out = df.copy()
        out[feature_cols] = (out[feature_cols] - means) / stds
        return out

    train_std = _standardize(clean_train)
    train_std["province_id"] = pd.Categorical(train_std["province_id"])
    offset_train = np.log(train_std["population"].to_numpy())

    formula = f"{target_col} ~ C(province_id) + " + " + ".join(feature_cols)

    poisson_fit = smf.glm(
        formula, data=train_std, family=sm.families.Poisson(), offset=offset_train
    ).fit()

    nb_model = smf.negativebinomial(formula, data=train_std, offset=offset_train)
    start_params = np.append(
        poisson_fit.params.to_numpy(), 1.0
    )  # +1.0 cho alpha khoi dau
    nb_fit = nb_model.fit(start_params=start_params, disp=False, maxiter=200)

    # C(province_id) trong predict_df phai dung categories da thay o train,
    # tinh moi khong lam patsy tu bo them muc nham lech design matrix.
    predict_std = _standardize(predict_df)
    predict_std["province_id"] = pd.Categorical(
        predict_std["province_id"], categories=train_std["province_id"].cat.categories
    )
    offset_pred = np.log(predict_std["population"].to_numpy())
    pred_cases = nb_fit.predict(predict_std, offset=offset_pred)
    # model fit tren target_col="cases" (offset population) -> phai doi ve
    # incidence_per_100k truoc khi tra, khop don vi voi cac model khac (da
    # gap bug that: quen doi don vi, khien MASE sai lech ~10-50 lan).
    pred_incidence = pred_cases / predict_std["population"].to_numpy() * 100_000
    return np.asarray(pred_incidence)


# ------------------------------------------------------- M2: gradient boosting


DEFAULT_XGBOOST_PARAMS = {
    "n_estimators": 300,
    "max_depth": 4,
    "learning_rate": 0.05,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
}

DEFAULT_LIGHTGBM_PARAMS = {
    "n_estimators": 300,
    "max_depth": 4,
    "learning_rate": 0.05,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
}


def fit_predict_m2_xgboost(
    train_df: pd.DataFrame,
    predict_df: pd.DataFrame,
    feature_cols: list[str],
    target_col: str = "incidence_per_100k",
    seed: int = 42,
    params: dict | None = None,
) -> np.ndarray:
    """`params` ghi đè lên `DEFAULT_XGBOOST_PARAMS` (T1) — dùng cho T2
    Optuna tuning (docs/02 §6), không đổi hành vi T1 nếu để `None`."""
    import xgboost as xgb

    clean_train = _drop_incomplete_rows(train_df, feature_cols)
    final_params = {**DEFAULT_XGBOOST_PARAMS, **(params or {})}
    model = xgb.XGBRegressor(
        objective="count:poisson", random_state=seed, **final_params
    )
    model.fit(clean_train[feature_cols], clean_train[target_col])
    return model.predict(predict_df[feature_cols])


def fit_predict_m2_lightgbm(
    train_df: pd.DataFrame,
    predict_df: pd.DataFrame,
    feature_cols: list[str],
    target_col: str = "incidence_per_100k",
    seed: int = 42,
    params: dict | None = None,
) -> np.ndarray:
    """`params` ghi đè lên `DEFAULT_LIGHTGBM_PARAMS` (T1) — dùng cho T2
    Optuna tuning (docs/02 §6), không đổi hành vi T1 nếu để `None`."""
    import lightgbm as lgb

    clean_train = _drop_incomplete_rows(train_df, feature_cols)
    final_params = {**DEFAULT_LIGHTGBM_PARAMS, **(params or {})}
    model = lgb.LGBMRegressor(
        objective="poisson", random_state=seed, verbosity=-1, **final_params
    )
    model.fit(clean_train[feature_cols], clean_train[target_col])
    return model.predict(predict_df[feature_cols])
