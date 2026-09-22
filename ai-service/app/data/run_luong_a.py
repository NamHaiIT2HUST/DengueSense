"""Chạy toàn bộ Luồng A (dân số + ONI + ERA5 + build_panel + dashboard) nối
tiếp nhau, không cần mở Jupyter — cho chạy nền qua nhiều giờ không giám sát.

Chạy (từ `ai-service/`, sau khi đã có `~/.cdsapirc` — xem PHASE-1-CHECKLIST §A3):
    python -m app.data.run_luong_a

Windows PowerShell — chạy nền THẬT SỰ (đóng terminal/đăng xuất vẫn chạy
tiếp, máy không ngủ do cắm sạc + tắt sleep khi cắm sạc trong Settings):
    Start-Process -FilePath "venv\\Scripts\\python.exe" `
        -ArgumentList "-m", "app.data.run_luong_a" `
        -RedirectStandardOutput "logs\\run_luong_a.out.log" `
        -RedirectStandardError "logs\\run_luong_a.err.log" `
        -WindowStyle Hidden

Idempotent: mỗi bước tự bỏ qua nếu file interim/processed tương ứng đã tồn
tại (giống `download_year()`/`fetch_year()` tự bỏ qua năm đã tải) — chạy lại
sau khi bị ngắt (mất điện, lỗi mạng) sẽ tự tiếp tục từ bước dở dang, không
làm lại từ đầu.

Log ghi ra `ai-service/logs/run_luong_a_<timestamp>.log` (mốc từng bước —
bắt đầu, xong, lỗi, thời gian) VÀ in ra stdout. Log CHI TIẾT hơn (tiến độ
từng năm) tới thẳng stdout (`print()` bên trong ingest_*.py) — xem đầy đủ
bằng cách chạy foreground, hoặc redirect stdout/stderr ra file như lệnh
PowerShell ở trên.
"""

from __future__ import annotations

import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_INTERIM_DIR = _DATA_DIR / "interim"
_LOG_DIR = Path(__file__).resolve().parents[2] / "logs"

POPULATION_YEARS = range(2000, 2021)  # phạm vi WorldPop thật, xem WORLDPOP_COVERAGE
ERA5_YEARS = range(1994, 2026)
FULL_YEARS = range(1994, 2026)  # panel muốn phủ hết chuỗi OpenDengue


def _setup_logging() -> logging.Logger:
    _LOG_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    log_path = _LOG_DIR / f"run_luong_a_{ts}.log"

    logger = logging.getLogger("run_luong_a")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()

    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(message)s", "%Y-%m-%d %H:%M:%S"
    )
    fh = logging.FileHandler(log_path, encoding="utf-8")
    fh.setFormatter(fmt)
    logger.addHandler(fh)
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(fmt)
    logger.addHandler(sh)

    logger.info(f"Log mốc từng bước ghi ra {log_path}")
    return logger


def run_population(logger: logging.Logger) -> None:
    from app.data.ingest_population import build_worldpop_panel, extend_to_full_range

    interim_path = _INTERIM_DIR / "population_by_province_year.parquet"
    if interim_path.exists():
        logger.info("[population] đã có interim, bỏ qua toàn bộ bước này.")
        return
    logger.info(f"[population] bắt đầu, {len(list(POPULATION_YEARS))} năm WorldPop...")
    panel = build_worldpop_panel(years=POPULATION_YEARS)
    full = extend_to_full_range(panel, FULL_YEARS)
    _INTERIM_DIR.mkdir(parents=True, exist_ok=True)
    full.to_parquet(interim_path, index=False)
    logger.info(f"[population] xong, {len(full)} dòng -> {interim_path}")


def run_oni(logger: logging.Logger) -> None:
    from app.data.ingest_oni import load_oni_monthly

    interim_path = _INTERIM_DIR / "oni_monthly.parquet"
    if interim_path.exists():
        logger.info("[oni] đã có interim, bỏ qua.")
        return
    logger.info("[oni] bắt đầu...")
    oni = load_oni_monthly()
    _INTERIM_DIR.mkdir(parents=True, exist_ok=True)
    oni[["year", "month", "oni"]].to_parquet(interim_path, index=False)
    logger.info(f"[oni] xong, {len(oni)} dòng -> {interim_path}")


def run_era5(logger: logging.Logger) -> None:
    from app.data.ingest_era5 import RAW_DIR, build_climate_panel, fetch_all_years

    interim_path = _INTERIM_DIR / "climate_by_province_month.parquet"
    if interim_path.exists():
        logger.info("[era5] đã có interim, bỏ qua.")
        return

    cdsapirc = Path.home() / ".cdsapirc"
    if not cdsapirc.exists():
        raise FileNotFoundError(
            f"Chưa có {cdsapirc} — đăng ký tài khoản CDS trước khi chạy bước "
            "này (xem PHASE-1-CHECKLIST.md §A3)."
        )

    logger.info(f"[era5] bắt đầu, {len(list(ERA5_YEARS))} năm CDS...")
    failed = fetch_all_years(ERA5_YEARS, RAW_DIR)
    if failed:
        logger.warning(
            f"[era5] {len(failed)} năm lỗi hẳn sau retry (sẽ để lỗ hổng ở "
            f"năm đó trong panel, không chặn các bước sau): {failed}"
        )
    panel = build_climate_panel(ERA5_YEARS, RAW_DIR)
    _INTERIM_DIR.mkdir(parents=True, exist_ok=True)
    panel.to_parquet(interim_path, index=False)
    logger.info(f"[era5] xong, {len(panel)} dòng -> {interim_path}")


def run_build_panel(logger: logging.Logger) -> None:
    from app.data.build_panel import build, write

    logger.info("[build_panel] ghép panel...")
    panel, version = build()
    manifest = write(panel, version)
    logger.info(f"[build_panel] xong -> v{version}, {manifest['n_rows']} dòng")
    logger.info(
        f"[build_panel] has_population={manifest['has_population']} "
        f"has_climate={manifest['has_climate']} has_oni={manifest['has_oni']}"
    )


def run_export_dashboard(logger: logging.Logger) -> None:
    from app.data.export_dashboard_data import export

    logger.info("[dashboard] export risk_summary.json...")
    result = export()
    logger.info(f"[dashboard] xong, {len(result['provinces'])} tỉnh")


STEPS = [
    ("population", run_population),
    ("oni", run_oni),
    ("era5", run_era5),
    ("build_panel", run_build_panel),
    ("export_dashboard", run_export_dashboard),
]


def main() -> None:
    logger = _setup_logging()
    start = time.time()
    for name, fn in STEPS:
        step_start = time.time()
        try:
            fn(logger)
        except Exception:
            logger.exception(
                f"[{name}] LỖI — dừng lại đây. Sửa xong chạy lại "
                "`python -m app.data.run_luong_a`, các bước đã xong sẽ tự bỏ qua."
            )
            raise
        logger.info(f"[{name}] mất {time.time() - step_start:.0f}s")
    logger.info(f"XONG TOÀN BỘ LUỒNG A, tổng {time.time() - start:.0f}s")


if __name__ == "__main__":
    main()
