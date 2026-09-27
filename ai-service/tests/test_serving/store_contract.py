"""Bộ kiểm HỢP ĐỒNG của `RunStore`: chạy cho MỌI hiện thực (bộ nhớ, Postgres) để hai bên không lệch hành vi."""

from __future__ import annotations

import threading
import uuid
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import psycopg
import pytest

from app.serving.forecast_api import events
from app.serving.forecast_api.store import (
    IdempotencyConflict,
    RunPayload,
    RunStore,
    job_view,
)

# Lượt lạ/đã kết thúc bị từ chối bằng lỗi khác nhau tuỳ hiện thực: ValueError/KeyError (bộ nhớ), lỗi DB (Postgres).
REJECTED = (ValueError, KeyError, psycopg.Error)

T0 = datetime(2026, 9, 25, 9, 0, tzinfo=UTC)


def submit(
    store: RunStore,
    *,
    origin: str = "2010-03",
    key: str | None = None,
    body: str = "a",
    actor: str | None = "u1",
    at: datetime = T0,
):
    return store.submit(
        mode="backtest",
        origin_month=origin,
        model_version="m4-r2@1.0.0",
        data_version="v0.2.0",
        actor_id=actor,
        org_id="cdc",
        idempotency_key=key or str(uuid.uuid4()),
        request_hash=body,
        now=at,
    )


def payload() -> RunPayload:
    items = [
        {"province_id": p, "horizon": h, "cases_pred": 1.0, "exceed_prob": 0.5}
        for h in (1, 3)
        for p in ("ha_noi", "khanh_hoa")
    ]
    return RunPayload(
        items=items,
        explanations={
            "ha_noi|1": {"base_value": 0.1, "factors": []},
            "khanh_hoa|3": {"base_value": 0.2, "factors": []},
        },
        legend_cases_per_100k=[{"min": 0.0, "max": 1.0, "label": "x"}],
        as_of="2010-03-01T00:00:00Z",
    )


def done_event(run_id: str) -> dict[str, Any]:
    return events.run_completed(
        run_id, "backtest", "2010-03", "m4-r2@1.0.0", "v0.2.0", 2, [1, 3], at=T0
    )


def run_store_contract(make: Callable[[], RunStore]) -> None:
    """Gọi từ test; `make()` trả kho SẠCH."""
    _submit_and_read(make())
    _idempotency(make())
    _same_input_reuses_run(make())
    _lifecycle_and_immutability(make())
    _failure(make())
    _recovery(make())
    _listing(make())
    _concurrent_claim(make())


def _submit_and_read(s: RunStore) -> None:
    out = submit(s, key="k1")
    assert out.run.status == "queued" and not out.reused_run
    assert out.run.api()["completed_at"] is None
    assert s.get_run(out.run.run_id) == out.run
    assert s.get_run(str(uuid.uuid4())) is None
    assert s.get_run("khong-phai-uuid") is None
    got = s.get_job(out.job.job_id)
    assert got is not None and got[0].run_id == out.run.run_id
    view = job_view(*got)
    assert (
        view["status"] == "queued"
        and view["progress"] == 0.0
        and view["result_ref"] is None
    )
    assert s.get_job("khong-phai-uuid") is None


def _idempotency(s: RunStore) -> None:
    a = submit(s, key="same", body="h1")
    b = submit(s, key="same", body="h1")
    assert (a.job.job_id, a.run.run_id) == (b.job.job_id, b.run.run_id)
    with pytest.raises(IdempotencyConflict):
        submit(s, key="same", body="KHAC")
    # cùng key nhưng người dùng khác → là hai yêu cầu khác nhau
    c = submit(s, key="same", body="h1", actor="u2")
    assert c.job.job_id != a.job.job_id


def _same_input_reuses_run(s: RunStore) -> None:
    a = submit(s, key="k-a")
    b = submit(s, key="k-b")
    assert (
        b.run.run_id == a.run.run_id and b.reused_run and b.job.job_id != a.job.job_id
    )
    assert (
        submit(s, origin="2010-04", key="k-c").run.run_id != a.run.run_id
    )  # đầu vào khác → lượt mới


def _lifecycle_and_immutability(s: RunStore) -> None:
    out = submit(s, key="life")
    run_id = out.run.run_id
    claimed = s.claim_next(T0)
    assert (
        claimed is not None and claimed.run_id == run_id and claimed.status == "running"
    )
    assert s.claim_next(T0) is None, "không ai khác nhận được lượt đang chạy"

    s.set_progress(run_id, 0.5)
    assert s.get_run(run_id).progress == 0.5  # type: ignore[union-attr]
    view = job_view(*s.get_job(out.job.job_id))  # type: ignore[misc]
    assert view["status"] == "running" and view["progress"] == 0.5

    with pytest.raises(REJECTED):
        s.get_run(run_id) and s.complete(
            str(uuid.uuid4()), payload(), done_event(run_id), T0
        )  # lượt lạ không hoàn tất được

    s.complete(run_id, payload(), done_event(run_id), T0 + timedelta(seconds=30))
    run = s.get_run(run_id)
    assert run is not None and run.status == "completed" and run.error_code is None
    assert run.completed_at is not None and run.progress == 1.0
    assert s.outbox_count() == 1

    view = job_view(*s.get_job(out.job.job_id))  # type: ignore[misc]
    assert (
        view["status"] == "succeeded"
        and view["result_ref"] == f"/internal/v1/forecast-runs/{run_id}"
    )
    assert view["progress"] == 1.0 and view["finished_at"] is not None

    # đọc kết quả
    assert [(i["horizon"], i["province_id"]) for i in s.forecasts(run_id)] == [
        (1, "ha_noi"),
        (1, "khanh_hoa"),
        (3, "ha_noi"),
        (3, "khanh_hoa"),
    ]
    assert (
        len(s.forecasts(run_id, horizon=3)) == 2
        and len(s.forecasts(run_id, province_id="ha_noi")) == 2
    )
    assert s.forecasts(run_id, horizon=6) == []
    assert s.explanation(run_id, "ha_noi", 1)["base_value"] == 0.1  # type: ignore[index]
    assert s.explanation(run_id, "ha_noi", 3) is None
    assert s.run_extras(run_id) == {
        "legend_cases_per_100k": [{"min": 0.0, "max": 1.0, "label": "x"}],
        "as_of": "2010-03-01T00:00:00Z",
    }

    # BẤT BIẾN: kết thúc rồi không hoàn tất/thất bại/đổi tiến độ lần nữa
    with pytest.raises(REJECTED):
        s.complete(run_id, payload(), done_event(run_id), T0)
    with pytest.raises(REJECTED):
        s.fail(
            run_id,
            "forecast.run_failed",
            events.run_failed(run_id, "backtest", "2010-03", "forecast.run_failed"),
            T0,
        )
    s.set_progress(run_id, 0.1)
    assert s.get_run(run_id).progress == 1.0  # type: ignore[union-attr]
    assert s.outbox_count() == 1, "lỗi không được để lại sự kiện thừa"
    assert s.claim_next(T0) is None


def _failure(s: RunStore) -> None:
    out = submit(s, key="bad")
    run_id = out.run.run_id
    assert s.claim_next(T0) is not None
    s.fail(
        run_id,
        "forecast.run_failed",
        events.run_failed(run_id, "backtest", "2010-03", "forecast.run_failed", at=T0),
        T0,
    )
    run = s.get_run(run_id)
    assert (
        run is not None
        and run.status == "failed"
        and run.error_code == "forecast.run_failed"
    )
    view = job_view(*s.get_job(out.job.job_id))  # type: ignore[misc]
    assert (
        view["status"] == "failed"
        and view["result_ref"] is None
        and view["error_code"] == "forecast.run_failed"
    )
    assert s.forecasts(run_id) == [] and s.run_extras(run_id) is None
    # lượt thất bại không chặn chạy lại cùng đầu vào
    again = submit(s, key="retry")
    assert again.run.run_id != run_id and not again.reused_run


def _recovery(s: RunStore) -> None:
    out = submit(s, key="crash")
    assert s.claim_next(T0) is not None  # đang chạy thì tiến trình chết
    assert s.recover_interrupted() == 1
    run = s.get_run(out.run.run_id)
    assert run is not None and run.status == "interrupted"
    view = job_view(*s.get_job(out.job.job_id))  # type: ignore[misc]
    assert (
        view["status"] == "queued"
    ), "sẽ được chạy lại — với người gọi vẫn là đang chờ"
    again = s.claim_next(T0)
    assert (
        again is not None
        and again.run_id == out.run.run_id
        and again.status == "running"
    )
    assert s.recover_interrupted() == 1


def _listing(s: RunStore) -> None:
    ids = []
    for i in range(5):
        ids.append(
            submit(
                s, origin=f"2010-0{i + 1}", key=f"l{i}", at=T0 + timedelta(minutes=i)
            ).run.run_id
        )
    page1, cur = s.list_runs(None, None, 2, None)
    assert [r.run_id for r in page1] == [
        ids[4],
        ids[3],
    ] and cur is not None, "mới nhất trước"
    page2, cur2 = s.list_runs(None, None, 2, cur)
    assert [r.run_id for r in page2] == [ids[2], ids[1]] and cur2 is not None
    page3, cur3 = s.list_runs(None, None, 2, cur2)
    assert [r.run_id for r in page3] == [ids[0]] and cur3 is None
    assert s.list_runs("live_experimental", None, 10, None)[0] == []
    assert len(s.list_runs("backtest", "queued", 10, None)[0]) == 5
    assert s.list_runs(None, "completed", 10, None)[0] == []
    assert (
        len(s.list_runs(None, None, 10, "cursor-rac")[0]) == 5
    ), "con trỏ hỏng bị bỏ qua, không lỗi"


def _concurrent_claim(s: RunStore) -> None:
    for i in range(6):
        submit(s, origin=f"2009-0{i + 1}", key=f"c{i}", at=T0 + timedelta(minutes=i))
    got: list[str] = []
    lock = threading.Lock()

    def worker() -> None:
        while (r := s.claim_next(T0)) is not None:
            with lock:
                got.append(r.run_id)

    threads = [threading.Thread(target=worker) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len(got) == 6 and len(set(got)) == 6, "mỗi lượt được nhận đúng MỘT lần"
