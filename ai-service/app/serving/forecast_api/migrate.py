"""Chạy migration SQL của schema `forecast` (mỗi file `NNNN_ten.sql` một lần, theo thứ tự, trong MỘT giao dịch).

    python -m app.serving.forecast_api.migrate            # áp migration chưa chạy
    python -m app.serving.forecast_api.migrate --down     # xoá toàn bộ (CHỈ DB thử nghiệm/dev)

Bảng theo dõi `schema_migrations` nằm cùng schema. Khoá tư vấn chặn hai tiến trình migrate song song.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"
_LOCK_KEY = "forecast.migrate"

DROP_ALL = """
DROP TABLE IF EXISTS outbox, explanations, forecasts, jobs, runs, schema_migrations CASCADE;
DROP FUNCTION IF EXISTS forbid_change();
DROP FUNCTION IF EXISTS forbid_final_run_change();
"""


def migration_files() -> list[Path]:
    return sorted(MIGRATIONS_DIR.glob("[0-9][0-9][0-9][0-9]_*.sql"))


def migrate_up(dsn: str) -> list[str]:
    """Áp các migration chưa chạy; trả tên các file vừa áp. Idempotent."""
    applied: list[str] = []
    with psycopg.connect(dsn) as conn:
        conn.execute("SELECT pg_advisory_lock(hashtextextended(%s, 0))", (_LOCK_KEY,))
        try:
            conn.execute(
                "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
            )
            conn.commit()
            done = {
                r[0]
                for r in conn.execute("SELECT name FROM schema_migrations").fetchall()
            }
            for path in migration_files():
                if path.name in done:
                    continue
                with conn.transaction():
                    conn.execute(path.read_text("utf-8"))
                    conn.execute(
                        "INSERT INTO schema_migrations (name) VALUES (%s)", (path.name,)
                    )
                applied.append(path.name)
        finally:
            conn.execute(
                "SELECT pg_advisory_unlock(hashtextextended(%s, 0))", (_LOCK_KEY,)
            )
    return applied


def migrate_down(dsn: str) -> None:
    with psycopg.connect(dsn) as conn:
        conn.execute(DROP_ALL)


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    dsn = os.environ.get("FORECAST_DB_URL", "").strip()
    if not dsn:
        print("thiếu biến FORECAST_DB_URL", file=sys.stderr)
        return 2
    try:
        if "--down" in args:
            migrate_down(dsn)
            print("đã xoá toàn bộ bảng của schema forecast")
        else:
            applied = migrate_up(dsn)
            print(
                f"migration đã áp dụng (schema forecast): {', '.join(applied) if applied else 'không có gì mới'}"
            )
    except psycopg.Error as exc:
        # Không in DSN/chi tiết kết nối (có mật khẩu): chỉ loại lỗi.
        print(f"migration thất bại: {type(exc).__name__}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
