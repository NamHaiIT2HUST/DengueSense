"""Kho lượt dự báo: bộ nhớ luôn chạy; Postgres chạy khi có TEST_DATABASE_URL trỏ vào DB tên kết thúc `_test`.

TEST_DATABASE_URL="postgres://svc_forecast:<mật khẩu>@127.0.0.1:<cổng>/denguesense_test?sslmode=disable" pytest tests/test_serving/test_store.py
"""

import os
import re

import pytest

from app.serving.forecast_api.store import MemoryRunStore
from tests.test_serving.store_contract import run_store_contract

DSN = os.environ.get("TEST_DATABASE_URL", "")


def test_memory_store_satisfies_the_contract():
    run_store_contract(MemoryRunStore)


@pytest.fixture(scope="module")
def pg_pool():
    if not DSN:
        pytest.skip("chưa đặt TEST_DATABASE_URL")
    import psycopg
    from psycopg_pool import ConnectionPool

    from app.serving.forecast_api import migrate

    with psycopg.connect(DSN) as conn:
        db, schema = conn.execute(
            "SELECT current_database(), current_schema()"
        ).fetchone()
    if not re.search(r"_test$", db):
        pytest.skip(
            f"database {db!r} không kết thúc bằng _test — bộ kiểm này xoá dữ liệu"
        )
    assert (
        schema == "forecast"
    ), "search_path của svc_forecast phải trỏ vào schema forecast"
    migrate.migrate_down(DSN)
    migrate.migrate_up(DSN)
    pool = ConnectionPool(DSN, min_size=1, max_size=8, open=True)
    yield pool
    pool.close()


def test_postgres_store_satisfies_the_contract(pg_pool):
    from app.serving.forecast_api.store import PostgresRunStore

    def make():
        with pg_pool.connection() as conn:
            # TRUNCATE không kích hoạt trigger bất biến theo dòng — chỉ dùng ở DB _test.
            conn.execute("TRUNCATE outbox, explanations, forecasts, jobs, runs CASCADE")
        return PostgresRunStore(pg_pool)

    run_store_contract(make)


def test_postgres_migrations_are_repeatable():
    if not DSN:
        pytest.skip("chưa đặt TEST_DATABASE_URL")
    from app.serving.forecast_api import migrate

    migrate.migrate_down(DSN)
    assert migrate.migrate_up(DSN) == ["0001_init.sql"]
    assert migrate.migrate_up(DSN) == [], "chạy lại là no-op"


def test_database_enforces_immutability(pg_pool):
    import psycopg

    with pg_pool.connection() as conn:
        conn.execute("TRUNCATE outbox, explanations, forecasts, jobs, runs CASCADE")
        conn.execute(
            "INSERT INTO runs (run_id, run_mode, status, origin_month, model_version, data_version, created_at, completed_at) "
            "VALUES (gen_random_uuid(), 'backtest', 'completed', '2010-03', 'm@1.0.0', 'v0.2.0', now(), now())"
        )
    bad = [
        "UPDATE runs SET progress = 0.5",
        "DELETE FROM runs",
        "INSERT INTO runs (run_id, run_mode, status, origin_month, model_version, data_version, created_at) VALUES (gen_random_uuid(), 'bịa', 'queued', '2010-03', 'm', 'v0.2.0', now())",
        "INSERT INTO runs (run_id, run_mode, status, origin_month, model_version, data_version, created_at) VALUES (gen_random_uuid(), 'backtest', 'completed', '2010-04', 'm', 'v0.2.0', now())",
        "INSERT INTO runs (run_id, run_mode, status, origin_month, model_version, data_version, created_at) VALUES (gen_random_uuid(), 'backtest', 'queued', '2010-3', 'm', 'v0.2.0', now())",
    ]
    for stmt in bad:
        with pg_pool.connection() as conn, pytest.raises(psycopg.Error):
            conn.execute(stmt)
