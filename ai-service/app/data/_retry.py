"""Retry với exponential backoff cho lệnh mạng dài (WorldPop, CDS) — dùng khi
chạy Luồng A không giám sát trong nhiều giờ, xem `run_luong_a.py`.

Không phải thư viện ngoài (tenacity...) vì chỉ cần đúng 1 pattern đơn giản,
thêm dependency cho việc này là không đáng.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import TypeVar

T = TypeVar("T")


def retry_with_backoff(
    fn: Callable[..., T],
    *args,
    attempts: int = 4,
    base_delay: float = 5.0,
    on_retry: Callable[[int, Exception, float], None] | None = None,
    **kwargs,
) -> T:
    """Gọi `fn(*args, **kwargs)`, thử lại tối đa `attempts` lần nếu raise, chờ
    `base_delay * 2**attempt` giây giữa các lần (5s, 10s, 20s, ...).

    Bắt `Exception` rộng có chủ đích: lỗi mạng dài hạn (WorldPop tải 200MB,
    CDS request) có thể là timeout, connection reset, HTTP 5xx, DNS tạm thời
    — không đoán trước hết được loại nào, và mục tiêu là "cứ thử lại" chứ
    không phải phân loại lỗi.
    """
    last_exc: Exception | None = None
    for attempt in range(attempts):
        try:
            return fn(*args, **kwargs)
        except Exception as exc:  # noqa: BLE001 - xem docstring
            last_exc = exc
            if attempt < attempts - 1:
                delay = base_delay * (2**attempt)
                if on_retry:
                    on_retry(attempt + 1, exc, delay)
                time.sleep(delay)
    assert last_exc is not None
    raise last_exc
