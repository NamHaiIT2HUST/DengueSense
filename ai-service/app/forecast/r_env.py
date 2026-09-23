"""Thiết lập môi trường R cho `rpy2` — bắt buộc gọi `setup_r()` trước khi
import bất kỳ thứ gì từ `rpy2.robjects` (M3 hhh4 dùng module này).

⚠️ 3 bẫy Windows đã gặp thật khi cài (23/09/2026), cả 3 đều BẮT BUỘC phải
xử lý đúng thứ tự, thiếu 1 cái là lỗi khó hiểu:

1. **`R_HOME` phải đặt TRƯỚC `import rpy2.robjects`** — đặt sau thì rpy2 đã
   tự dò (sai) từ lúc import.
2. **Thư mục `bin/x64` (chứa `R.dll`) phải có trong `PATH`** — thiếu thì
   Windows không resolve được dependency của `stats.dll`, báo lỗi rất khó
   hiểu: `LoadLibrary failure: The specified module could not be found`
   (nghe như thiếu file .dll trong khi thật ra .dll ĐÓ có mà DLL NÓ CẦN mới
   thiếu trong PATH).
3. **`.libPaths()` phải APPEND, không REPLACE** — gọi `.libPaths("X")` với
   1 chuỗi sẽ XOÁ MẤT thư viện gốc của R (nơi có package `stats`), phải
   dùng `.libPaths(c(.libPaths(), "X"))`. Cài package (`surveillance`) vào
   thư mục riêng trong project (`.rlibs/`, gitignored) thay vì
   `AppData/Local` — trên máy có sandbox/app packaging, ghi vào
   `AppData/Local` có thể bị Windows redirect sang thư mục ảo hoá riêng
   của ứng dụng, KHÔNG thấy được từ terminal thường của người dùng.
"""

from __future__ import annotations

import os
from pathlib import Path

_R_HOME = Path(r"C:\Program Files\R\R-4.6.1")
_R_LIB_DIR = Path(__file__).resolve().parents[2] / ".rlibs"

_setup_done = False


def setup_r() -> None:
    """Idempotent — gọi nhiều lần an toàn, chỉ set env 1 lần đầu."""
    global _setup_done
    if _setup_done:
        return

    if not _R_HOME.exists():
        raise RuntimeError(
            f"Không tìm thấy R tại {_R_HOME}. Cài R (cran.r-project.org) + "
            "Rtools45 trước khi dùng M3 hhh4."
        )

    os.environ["R_HOME"] = str(_R_HOME)
    r_bin = str(_R_HOME / "bin" / "x64")
    if r_bin not in os.environ.get("PATH", ""):
        os.environ["PATH"] = r_bin + os.pathsep + os.environ.get("PATH", "")

    from rpy2 import robjects

    _R_LIB_DIR.mkdir(exist_ok=True)
    robjects.r(f'.libPaths(c(.libPaths(), "{_R_LIB_DIR.as_posix()}"))')
    robjects.r("library(stats)")

    _setup_done = True


def r_library_installed(package: str) -> bool:
    setup_r()
    from rpy2 import robjects

    result = robjects.r(f'"{package}" %in% rownames(installed.packages())')
    return bool(result[0])
