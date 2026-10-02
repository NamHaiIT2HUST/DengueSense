"""Chạy job dự báo NỀN (ADR-0006: mô hình không bao giờ chạy trong request đồng bộ).

Một luồng nền lấy lượt `queued`/`interrupted` từ kho, chạy động cơ, ghi kết quả + sự kiện trong một giao dịch. Tiến trình chết
giữa chừng → lúc khởi động các lượt `running` được đánh dấu `interrupted` rồi CHẠY LẠI (mô hình tất định nên kết quả giống hệt).
"""

from __future__ import annotations

import logging
import threading
from collections.abc import Callable
from datetime import UTC, datetime

from app.serving.forecast_api import engine, events
from app.serving.forecast_api.panel import PanelProvider
from app.serving.forecast_api.store import RunPayload, RunRecord, RunStore

Compute = Callable[
    [engine.PanelContext, str, Callable[[float], None]], engine.RunResult
]

log = logging.getLogger("forecast")


def default_compute(
    ctx: engine.PanelContext, origin_month: str, on_progress: Callable[[float], None]
) -> engine.RunResult:
    return engine.compute_backtest_run(ctx, origin_month, on_progress)


class JobRunner:
    def __init__(
        self,
        store: RunStore,
        panels: PanelProvider,
        compute: Compute = default_compute,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
        poll_seconds: float = 5.0,
    ) -> None:
        self._store = store
        self._panels = panels
        self._compute = compute
        self._clock = clock
        self._poll = poll_seconds
        self._wake = threading.Event()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        n = self._store.recover_interrupted()
        if n:
            log.warning("chạy lại %d lượt bị gián đoạn", n)
        self._thread = threading.Thread(
            target=self._loop, name="forecast-runner", daemon=True
        )
        self._thread.start()

    def stop(self, timeout: float = 5.0) -> None:
        self._stop.set()
        self._wake.set()
        if self._thread:
            self._thread.join(timeout)

    def notify(self) -> None:
        self._wake.set()

    def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                worked = self.run_one()
            except Exception:  # vòng lặp nền không được chết vì một lỗi kho
                log.exception("lỗi khi lấy lượt dự báo")
                worked = False
            if not worked:
                self._wake.wait(self._poll)
                self._wake.clear()

    def run_one(self) -> bool:
        """Nhận và chạy MỘT lượt; trả False nếu không có gì để chạy. (Tách riêng để test đồng bộ.)"""
        run = self._store.claim_next(self._clock())
        if run is None:
            return False
        self._execute(run)
        return True

    def _execute(self, run: RunRecord) -> None:
        try:
            ctx = self._panels.context(run.data_version)
            result = self._compute(
                ctx, run.origin_month, lambda p: self._store.set_progress(run.run_id, p)
            )
            payload = RunPayload(
                items=result.items,
                explanations=result.explanations,
                legend_cases_per_100k=[dict(c) for c in result.legend_cases_per_100k],
                as_of=f"{run.origin_month}-01T00:00:00Z",
            )
            now = self._clock()
            event = events.run_completed(
                run.run_id,
                run.run_mode,
                run.origin_month,
                run.model_version,
                run.data_version,
                province_count=len({i["province_id"] for i in result.items}),
                horizons=sorted({i["horizon"] for i in result.items}),
                at=now,
            )
            self._store.complete(run.run_id, payload, event, now)
            log.info("lượt %s hoàn tất", run.run_id)
        except (
            Exception
        ) as exc:  # mọi lỗi của một lượt phải kết thúc thành `failed` có mã, không treo
            code = (
                exc.code
                if isinstance(exc, engine.EngineError)
                and exc.code.startswith("forecast.")
                else "forecast.run_failed"
            )
            # Chi tiết chỉ ở log (có thể chứa đường dẫn/dữ liệu); mã lỗi ổn định mới ra ngoài.
            log.exception("lượt %s thất bại (%s)", run.run_id, code)
            now = self._clock()
            self._store.fail(
                run.run_id,
                code,
                events.run_failed(
                    run.run_id, run.run_mode, run.origin_month, code, at=now
                ),
                now,
            )
