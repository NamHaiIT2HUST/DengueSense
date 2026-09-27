"""Kho lưu lượt dự báo: bộ nhớ (test/dev) và Postgres (thật). Cả hai qua CÙNG bộ kiểm hợp đồng `store_contract`.

Ngữ nghĩa cốt lõi (docs/09 §8):
  - Lượt dự báo BẤT BIẾN sau khi kết thúc (`completed`/`failed`/`cancelled`): kết quả không sửa, không xoá (trigger ở DB).
  - Gửi lại cùng `Idempotency-Key` + cùng nội dung → đúng job cũ; cùng key khác nội dung → IdempotencyConflict.
  - Cùng đầu vào (chế độ, tháng neo, phiên bản mô hình, phiên bản dữ liệu) KHÔNG chạy lại: mô hình tất định (seed cố định)
    nên kết quả giống hệt — job mới trỏ về lượt đã có.
  - Hoàn tất ghi kết quả + sự kiện `forecast.run.completed` vào outbox trong MỘT giao dịch.
  - Job không có trạng thái riêng: suy ra từ lượt (một nguồn sự thật).
"""

from __future__ import annotations

import base64
import threading
import uuid
from collections.abc import Sequence
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from typing import Any, Protocol

RUN_ACTIVE = ("queued", "running", "interrupted")
RUN_FINAL = ("completed", "failed", "cancelled")

_JOB_STATUS = {
    "queued": "queued",
    "interrupted": "queued",  # sẽ được chạy lại
    "running": "running",
    "completed": "succeeded",
    "failed": "failed",
    "cancelled": "cancelled",
}


class IdempotencyConflict(Exception):
    """Cùng Idempotency-Key nhưng nội dung yêu cầu khác."""


def _iso(ts: datetime | None) -> str | None:
    return None if ts is None else ts.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


@dataclass(frozen=True)
class RunRecord:
    run_id: str
    run_mode: str
    status: str
    origin_month: str
    model_version: str
    data_version: str
    created_at: datetime
    completed_at: datetime | None = None
    error_code: str | None = None
    progress: float = 0.0
    actor_id: str | None = None
    org_id: str | None = None

    def api(self) -> dict[str, Any]:
        """`ForecastRun` của hợp đồng."""
        return {
            "run_id": self.run_id,
            "run_mode": self.run_mode,
            "status": self.status,
            "origin_month": self.origin_month,
            "model_version": self.model_version,
            "data_version": self.data_version,
            "created_at": _iso(self.created_at),
            "completed_at": _iso(self.completed_at),
            "error_code": self.error_code,
        }


@dataclass(frozen=True)
class JobRecord:
    job_id: str
    run_id: str
    created_at: datetime


def job_view(job: JobRecord, run: RunRecord) -> dict[str, Any]:
    """`Job` của hợp đồng, suy ra từ lượt."""
    status = _JOB_STATUS[run.status]
    done = status in ("succeeded", "failed", "cancelled")
    return {
        "job_id": job.job_id,
        "kind": "forecast_run",
        "status": status,
        "progress": (
            1.0
            if status == "succeeded"
            else (0.0 if status == "queued" else min(0.99, run.progress))
        ),
        "result_ref": (
            f"/internal/v1/forecast-runs/{run.run_id}"
            if status == "succeeded"
            else None
        ),
        "error_code": run.error_code,
        "created_at": _iso(job.created_at),
        "finished_at": _iso(run.completed_at) if done else None,
    }


@dataclass
class RunPayload:
    items: list[dict[str, Any]]
    explanations: dict[str, dict[str, Any]]  # khoá `${province_id}|${horizon}`
    legend_cases_per_100k: list[dict[str, Any]]
    as_of: str


@dataclass(frozen=True)
class SubmitOutcome:
    run: RunRecord
    job: JobRecord
    reused_run: bool  # đã có lượt cùng đầu vào (không tạo lượt mới)


class RunStore(Protocol):
    def submit(
        self,
        *,
        mode: str,
        origin_month: str,
        model_version: str,
        data_version: str,
        actor_id: str | None,
        org_id: str | None,
        idempotency_key: str,
        request_hash: str,
        now: datetime,
    ) -> SubmitOutcome: ...

    def get_run(self, run_id: str) -> RunRecord | None: ...
    def get_job(self, job_id: str) -> tuple[JobRecord, RunRecord] | None: ...
    def list_runs(
        self, mode: str | None, status: str | None, limit: int, cursor: str | None
    ) -> tuple[list[RunRecord], str | None]: ...
    def claim_next(self, now: datetime) -> RunRecord | None: ...
    def set_progress(self, run_id: str, progress: float) -> None: ...
    def complete(
        self, run_id: str, payload: RunPayload, event: dict[str, Any], now: datetime
    ) -> None: ...
    def fail(
        self, run_id: str, error_code: str, event: dict[str, Any], now: datetime
    ) -> None: ...
    def recover_interrupted(self) -> int: ...
    def forecasts(
        self, run_id: str, horizon: int | None = None, province_id: str | None = None
    ) -> list[dict[str, Any]]: ...
    def explanation(
        self, run_id: str, province_id: str, horizon: int
    ) -> dict[str, Any] | None: ...
    def run_extras(self, run_id: str) -> dict[str, Any] | None: ...
    def outbox_count(self) -> int: ...
    def ping(self) -> None: ...


def encode_cursor(created_at: datetime, run_id: str) -> str:
    return base64.urlsafe_b64encode(
        f"{created_at.isoformat()}|{run_id}".encode()
    ).decode()


def decode_cursor(cursor: str) -> tuple[datetime, str] | None:
    try:
        ts, run_id = base64.urlsafe_b64decode(cursor.encode()).decode().split("|", 1)
        uuid.UUID(run_id)
        return datetime.fromisoformat(ts), run_id
    except (ValueError, UnicodeDecodeError):
        return None


# ---------------------------------------------------------------------------------------------------------------------
# Bộ nhớ
# ---------------------------------------------------------------------------------------------------------------------


@dataclass
class _Stored:
    run: RunRecord
    payload: RunPayload | None = None


@dataclass
class MemoryRunStore:
    _lock: threading.RLock = field(default_factory=threading.RLock)
    _runs: dict[str, _Stored] = field(default_factory=dict)
    _jobs: dict[str, JobRecord] = field(default_factory=dict)
    _keys: dict[tuple[str, str], tuple[str, str]] = field(
        default_factory=dict
    )  # (actor,key) → (job_id, hash)
    outbox: list[dict[str, Any]] = field(default_factory=list)

    def submit(
        self,
        *,
        mode: str,
        origin_month: str,
        model_version: str,
        data_version: str,
        actor_id: str | None,
        org_id: str | None,
        idempotency_key: str,
        request_hash: str,
        now: datetime,
    ) -> SubmitOutcome:
        with self._lock:
            ident = (actor_id or "", idempotency_key)
            if ident in self._keys:
                job_id, old_hash = self._keys[ident]
                if old_hash != request_hash:
                    raise IdempotencyConflict
                job = self._jobs[job_id]
                return SubmitOutcome(self._runs[job.run_id].run, job, reused_run=True)

            existing = next(
                (
                    s.run
                    for s in self._runs.values()
                    if (
                        s.run.run_mode,
                        s.run.origin_month,
                        s.run.model_version,
                        s.run.data_version,
                    )
                    == (mode, origin_month, model_version, data_version)
                    and s.run.status in (*RUN_ACTIVE, "completed")
                ),
                None,
            )
            reused = existing is not None
            run = existing or RunRecord(
                run_id=str(uuid.uuid4()),
                run_mode=mode,
                status="queued",
                origin_month=origin_month,
                model_version=model_version,
                data_version=data_version,
                created_at=now,
                actor_id=actor_id,
                org_id=org_id,
            )
            if not reused:
                self._runs[run.run_id] = _Stored(run)
            job = JobRecord(str(uuid.uuid4()), run.run_id, now)
            self._jobs[job.job_id] = job
            self._keys[ident] = (job.job_id, request_hash)
            return SubmitOutcome(run, job, reused_run=reused)

    def get_run(self, run_id: str) -> RunRecord | None:
        with self._lock:
            s = self._runs.get(run_id)
            return s.run if s else None

    def get_job(self, job_id: str) -> tuple[JobRecord, RunRecord] | None:
        with self._lock:
            job = self._jobs.get(job_id)
            return (job, self._runs[job.run_id].run) if job else None

    def list_runs(
        self, mode: str | None, status: str | None, limit: int, cursor: str | None
    ) -> tuple[list[RunRecord], str | None]:
        with self._lock:
            rows = sorted(
                (s.run for s in self._runs.values()),
                key=lambda r: (r.created_at, r.run_id),
                reverse=True,
            )
        rows = [
            r
            for r in rows
            if (mode is None or r.run_mode == mode)
            and (status is None or r.status == status)
        ]
        if cursor:
            key = decode_cursor(cursor)
            if key:
                rows = [r for r in rows if (r.created_at, r.run_id) < key]
        page = rows[:limit]
        nxt = (
            encode_cursor(page[-1].created_at, page[-1].run_id)
            if len(rows) > limit and page
            else None
        )
        return page, nxt

    def claim_next(self, now: datetime) -> RunRecord | None:
        with self._lock:
            queue = sorted(
                (
                    s
                    for s in self._runs.values()
                    if s.run.status in ("queued", "interrupted")
                ),
                key=lambda s: (s.run.created_at, s.run.run_id),
            )
            if not queue:
                return None
            s = queue[0]
            s.run = replace(s.run, status="running", progress=0.0)
            return s.run

    def set_progress(self, run_id: str, progress: float) -> None:
        with self._lock:
            s = self._runs[run_id]
            if s.run.status == "running":
                s.run = replace(s.run, progress=max(0.0, min(1.0, progress)))

    def _finish(
        self,
        run_id: str,
        status: str,
        error_code: str | None,
        now: datetime,
        event: dict[str, Any],
    ) -> _Stored:
        s = self._runs[run_id]
        if s.run.status in RUN_FINAL:
            raise ValueError("lượt đã kết thúc — bất biến")
        s.run = replace(
            s.run, status=status, error_code=error_code, completed_at=now, progress=1.0
        )
        self.outbox.append(event)
        return s

    def complete(
        self, run_id: str, payload: RunPayload, event: dict[str, Any], now: datetime
    ) -> None:
        with self._lock:
            self._finish(run_id, "completed", None, now, event).payload = payload

    def fail(
        self, run_id: str, error_code: str, event: dict[str, Any], now: datetime
    ) -> None:
        with self._lock:
            self._finish(run_id, "failed", error_code, now, event)

    def recover_interrupted(self) -> int:
        with self._lock:
            n = 0
            for s in self._runs.values():
                if s.run.status == "running":
                    s.run = replace(s.run, status="interrupted", progress=0.0)
                    n += 1
            return n

    def forecasts(
        self, run_id: str, horizon: int | None = None, province_id: str | None = None
    ) -> list[dict[str, Any]]:
        with self._lock:
            s = self._runs.get(run_id)
            if not s or not s.payload:
                return []
            return sorted(
                (
                    dict(i)
                    for i in s.payload.items
                    if (horizon is None or i["horizon"] == horizon)
                    and (province_id is None or i["province_id"] == province_id)
                ),
                key=lambda i: (i["horizon"], i["province_id"]),
            )

    def explanation(
        self, run_id: str, province_id: str, horizon: int
    ) -> dict[str, Any] | None:
        with self._lock:
            s = self._runs.get(run_id)
            return (
                None
                if not s or not s.payload
                else s.payload.explanations.get(f"{province_id}|{horizon}")
            )

    def run_extras(self, run_id: str) -> dict[str, Any] | None:
        with self._lock:
            s = self._runs.get(run_id)
            if not s or not s.payload:
                return None
            return {
                "legend_cases_per_100k": s.payload.legend_cases_per_100k,
                "as_of": s.payload.as_of,
            }

    def outbox_count(self) -> int:
        return len(self.outbox)

    def ping(self) -> None:
        return None


# ---------------------------------------------------------------------------------------------------------------------
# Postgres
# ---------------------------------------------------------------------------------------------------------------------

_RUN_COLS = "run_id, run_mode, status, origin_month, model_version, data_version, created_at, completed_at, error_code, progress, actor_id, org_id"


def _run_from_row(row: Sequence[Any]) -> RunRecord:
    return RunRecord(
        run_id=str(row[0]),
        run_mode=row[1],
        status=row[2],
        origin_month=row[3],
        model_version=row[4],
        data_version=row[5],
        created_at=row[6],
        completed_at=row[7],
        error_code=row[8],
        progress=float(row[9]),
        actor_id=row[10],
        org_id=row[11],
    )


class PostgresRunStore:
    """Hiện thực Postgres (psycopg 3, SQL viết tay). Schema `forecast` do role `svc_forecast` sở hữu; search_path của role
    trỏ vào schema đó nên không cần tiền tố."""

    def __init__(self, pool: Any) -> None:
        self._pool = pool

    def submit(
        self,
        *,
        mode: str,
        origin_month: str,
        model_version: str,
        data_version: str,
        actor_id: str | None,
        org_id: str | None,
        idempotency_key: str,
        request_hash: str,
        now: datetime,
    ) -> SubmitOutcome:
        with self._pool.connection() as conn, conn.transaction():
            conn.execute(
                "SELECT pg_advisory_xact_lock(hashtextextended('forecast.submit', 0))"
            )  # gửi yêu cầu hiếm → tuần tự hoá
            row = conn.execute(
                "SELECT job_id, run_id, request_hash, created_at FROM jobs WHERE actor_id = %s AND idempotency_key = %s",
                (actor_id or "", idempotency_key),
            ).fetchone()
            if row:
                if row[2] != request_hash:
                    raise IdempotencyConflict
                run = self._get_run(conn, str(row[1]))
                assert run is not None
                return SubmitOutcome(
                    run, JobRecord(str(row[0]), str(row[1]), row[3]), reused_run=True
                )

            found = conn.execute(
                f"SELECT {_RUN_COLS} FROM runs WHERE run_mode = %s AND origin_month = %s AND model_version = %s "
                "AND data_version = %s AND status IN ('queued','running','interrupted','completed') "
                "ORDER BY created_at LIMIT 1",
                (mode, origin_month, model_version, data_version),
            ).fetchone()
            if found:
                run = _run_from_row(found)
                reused = True
            else:
                run = RunRecord(
                    run_id=str(uuid.uuid4()),
                    run_mode=mode,
                    status="queued",
                    origin_month=origin_month,
                    model_version=model_version,
                    data_version=data_version,
                    created_at=now,
                    actor_id=actor_id,
                    org_id=org_id,
                )
                conn.execute(
                    "INSERT INTO runs (run_id, run_mode, status, origin_month, model_version, data_version, created_at, actor_id, org_id) "
                    "VALUES (%s,%s,'queued',%s,%s,%s,%s,%s,%s)",
                    (
                        run.run_id,
                        mode,
                        origin_month,
                        model_version,
                        data_version,
                        now,
                        actor_id,
                        org_id,
                    ),
                )
                reused = False
            job = JobRecord(str(uuid.uuid4()), run.run_id, now)
            conn.execute(
                "INSERT INTO jobs (job_id, run_id, actor_id, idempotency_key, request_hash, created_at) VALUES (%s,%s,%s,%s,%s,%s)",
                (
                    job.job_id,
                    run.run_id,
                    actor_id or "",
                    idempotency_key,
                    request_hash,
                    now,
                ),
            )
            return SubmitOutcome(run, job, reused_run=reused)

    @staticmethod
    def _get_run(conn: Any, run_id: str) -> RunRecord | None:
        row = conn.execute(
            f"SELECT {_RUN_COLS} FROM runs WHERE run_id = %s", (run_id,)
        ).fetchone()
        return _run_from_row(row) if row else None

    def get_run(self, run_id: str) -> RunRecord | None:
        try:
            uuid.UUID(run_id)
        except ValueError:
            return None
        with self._pool.connection() as conn:
            return self._get_run(conn, run_id)

    def get_job(self, job_id: str) -> tuple[JobRecord, RunRecord] | None:
        try:
            uuid.UUID(job_id)
        except ValueError:
            return None
        with self._pool.connection() as conn:
            row = conn.execute(
                "SELECT job_id, run_id, created_at FROM jobs WHERE job_id = %s",
                (job_id,),
            ).fetchone()
            if not row:
                return None
            run = self._get_run(conn, str(row[1]))
            assert run is not None
            return JobRecord(str(row[0]), str(row[1]), row[2]), run

    def list_runs(
        self, mode: str | None, status: str | None, limit: int, cursor: str | None
    ) -> tuple[list[RunRecord], str | None]:
        where: list[str] = ["TRUE"]
        args: list[Any] = []
        if mode:
            where.append("run_mode = %s")
            args.append(mode)
        if status:
            where.append("status = %s")
            args.append(status)
        key = decode_cursor(cursor) if cursor else None
        if key:
            where.append("(created_at, run_id) < (%s, %s)")
            args.extend([key[0], key[1]])
        with self._pool.connection() as conn:
            rows = conn.execute(
                f"SELECT {_RUN_COLS} FROM runs WHERE {' AND '.join(where)} ORDER BY created_at DESC, run_id DESC LIMIT %s",
                (*args, limit + 1),
            ).fetchall()
        runs = [_run_from_row(r) for r in rows]
        page = runs[:limit]
        nxt = (
            encode_cursor(page[-1].created_at, page[-1].run_id)
            if len(runs) > limit and page
            else None
        )
        return page, nxt

    def claim_next(self, now: datetime) -> RunRecord | None:
        with self._pool.connection() as conn, conn.transaction():
            row = conn.execute(
                "UPDATE runs SET status = 'running', progress = 0 WHERE run_id = ("
                " SELECT run_id FROM runs WHERE status IN ('queued','interrupted') ORDER BY created_at, run_id"
                " LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING " + _RUN_COLS
            ).fetchone()
            return _run_from_row(row) if row else None

    def set_progress(self, run_id: str, progress: float) -> None:
        with self._pool.connection() as conn:
            conn.execute(
                "UPDATE runs SET progress = %s WHERE run_id = %s AND status = 'running'",
                (max(0.0, min(1.0, progress)), run_id),
            )

    def _emit(self, conn: Any, event: dict[str, Any]) -> None:
        from psycopg.types.json import Jsonb

        conn.execute(
            "INSERT INTO outbox (id, event_type, payload) VALUES (%s,%s,%s)",
            (event["id"], event["type"], Jsonb(event)),
        )

    def complete(
        self, run_id: str, payload: RunPayload, event: dict[str, Any], now: datetime
    ) -> None:
        from psycopg.types.json import Jsonb

        with self._pool.connection() as conn, conn.transaction():
            with conn.cursor() as cur:
                cur.executemany(
                    "INSERT INTO forecasts (run_id, horizon, province_id, item) VALUES (%s,%s,%s,%s)",
                    [
                        (run_id, i["horizon"], i["province_id"], Jsonb(i))
                        for i in payload.items
                    ],
                )
                cur.executemany(
                    "INSERT INTO explanations (run_id, province_id, horizon, payload) VALUES (%s,%s,%s,%s)",
                    [
                        (run_id, k.split("|")[0], int(k.split("|")[1]), Jsonb(v))
                        for k, v in payload.explanations.items()
                    ],
                )
            tag = conn.execute(
                "UPDATE runs SET status = 'completed', completed_at = %s, progress = 1, extras = %s "
                "WHERE run_id = %s AND status = 'running'",
                (
                    now,
                    Jsonb(
                        {
                            "legend_cases_per_100k": payload.legend_cases_per_100k,
                            "as_of": payload.as_of,
                        }
                    ),
                    run_id,
                ),
            )
            if tag.rowcount != 1:
                raise ValueError("lượt không ở trạng thái running")
            self._emit(conn, event)

    def fail(
        self, run_id: str, error_code: str, event: dict[str, Any], now: datetime
    ) -> None:
        with self._pool.connection() as conn, conn.transaction():
            tag = conn.execute(
                "UPDATE runs SET status = 'failed', completed_at = %s, error_code = %s, progress = 1 "
                "WHERE run_id = %s AND status = 'running'",
                (now, error_code, run_id),
            )
            if tag.rowcount != 1:
                raise ValueError("lượt không ở trạng thái running")
            self._emit(conn, event)

    def recover_interrupted(self) -> int:
        with self._pool.connection() as conn:
            return int(
                conn.execute(
                    "UPDATE runs SET status = 'interrupted', progress = 0 WHERE status = 'running'"
                ).rowcount
            )

    def forecasts(
        self, run_id: str, horizon: int | None = None, province_id: str | None = None
    ) -> list[dict[str, Any]]:
        where: list[str] = ["run_id = %s"]
        args: list[Any] = [run_id]
        if horizon is not None:
            where.append("horizon = %s")
            args.append(horizon)
        if province_id is not None:
            where.append("province_id = %s")
            args.append(province_id)
        with self._pool.connection() as conn:
            rows = conn.execute(
                f"SELECT item FROM forecasts WHERE {' AND '.join(where)} ORDER BY horizon, province_id",
                args,
            ).fetchall()
        return [r[0] for r in rows]

    def explanation(
        self, run_id: str, province_id: str, horizon: int
    ) -> dict[str, Any] | None:
        with self._pool.connection() as conn:
            row = conn.execute(
                "SELECT payload FROM explanations WHERE run_id = %s AND province_id = %s AND horizon = %s",
                (run_id, province_id, horizon),
            ).fetchone()
        return row[0] if row else None

    def run_extras(self, run_id: str) -> dict[str, Any] | None:
        with self._pool.connection() as conn:
            row = conn.execute(
                "SELECT extras FROM runs WHERE run_id = %s AND status = 'completed'",
                (run_id,),
            ).fetchone()
        return row[0] if row else None

    def outbox_count(self) -> int:
        with self._pool.connection() as conn:
            return int(conn.execute("SELECT count(*) FROM outbox").fetchone()[0])

    def ping(self) -> None:
        with self._pool.connection() as conn:
            conn.execute("SELECT 1")
