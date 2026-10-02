"""Nguồn panel cho động cơ: tải phiên bản dữ liệu BẤT BIẾN từ `surveillance` (docs/09 §4.3) và kiểm sha256 trước khi dùng.

`forecast` KHÔNG đọc DB của `surveillance` (ADR-0002) — chỉ đi qua API nội bộ bằng token dịch vụ do `identity` cấp.
Panel bất biến theo `version` nên context (đặc trưng + cặp huấn luyện) được nhớ theo phiên bản.
"""

from __future__ import annotations

import hashlib
import io
import threading
import time
from collections import OrderedDict
from collections.abc import Callable
from typing import Any, Protocol

import httpx
import pandas as pd

from app.serving.common.problem import ApiError, dependency_unavailable
from app.serving.forecast_api import engine

MAX_CACHED_CONTEXTS = 2
_TOKEN_SKEW_SECONDS = 30
_PANEL_MAX_BYTES = 64 << 20


class PanelProvider(Protocol):
    def resolve(self, data_version: str | None) -> str:
        """Tên phiên bản cụ thể (mặc định: mới nhất). Lỗi: 404 forecast.data_version_not_found, 503."""
        ...

    def context(self, data_version: str) -> engine.PanelContext: ...


def data_version_not_found() -> ApiError:
    return ApiError(
        404, "forecast.data_version_not_found", "Không tìm thấy phiên bản dữ liệu"
    )


class _ContextCache:
    def __init__(self) -> None:
        self._items: OrderedDict[str, engine.PanelContext] = OrderedDict()
        self._lock = threading.Lock()

    def get_or_build(
        self, key: str, build: Callable[[], engine.PanelContext]
    ) -> engine.PanelContext:
        with self._lock:  # dựng một lần: hai job cùng phiên bản không tải/tính đặc trưng hai lần
            if key in self._items:
                self._items.move_to_end(key)
                return self._items[key]
            ctx = build()
            self._items[key] = ctx
            while len(self._items) > MAX_CACHED_CONTEXTS:
                self._items.popitem(last=False)
            return ctx


class StaticPanelProvider:
    """Một panel cố định trong bộ nhớ (test, chạy thử cục bộ)."""

    def __init__(
        self, version: str, panel: pd.DataFrame, regions: dict[str, str]
    ) -> None:
        self._version = version
        self._panel = panel
        self._regions = regions
        self._cache = _ContextCache()

    def resolve(self, data_version: str | None) -> str:
        if data_version not in (None, self._version):
            raise data_version_not_found()
        return self._version

    def context(self, data_version: str) -> engine.PanelContext:
        if data_version != self._version:
            raise data_version_not_found()
        return self._cache.get_or_build(
            data_version, lambda: engine.PanelContext(self._panel, self._regions)
        )


class ServiceTokenSource:
    """Xin token dịch vụ từ `identity` (client_secret của `forecast`), nhớ tới gần hết hạn."""

    def __init__(
        self,
        identity_url: str,
        service: str,
        client_secret: str,
        client: httpx.Client,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self._url = identity_url.rstrip("/") + "/internal/v1/service-tokens"
        self._service = service
        self._secret = client_secret
        self._client = client
        self._clock = clock
        self._cache: dict[str, tuple[str, float]] = {}
        self._lock = threading.Lock()

    def token(self, audience: str) -> str:
        with self._lock:
            hit = self._cache.get(audience)
            if hit and hit[1] - _TOKEN_SKEW_SECONDS > self._clock():
                return hit[0]
            resp = self._client.post(
                self._url,
                json={
                    "service": self._service,
                    "audience": audience,
                    "client_secret": self._secret,
                },
            )
            resp.raise_for_status()
            body = resp.json()
            expires = self._clock() + float(body.get("expires_in", 300))
            self._cache[audience] = (body["access_token"], expires)
            return str(body["access_token"])


class SurveillancePanelProvider:
    def __init__(
        self, base_url: str, tokens: ServiceTokenSource, client: httpx.Client
    ) -> None:
        self._base = base_url.rstrip("/")
        self._tokens = tokens
        self._client = client
        self._cache = _ContextCache()

    def _get(self, path: str, **kw: Any) -> httpx.Response:
        try:
            headers = {"Authorization": f"Bearer {self._tokens.token('surveillance')}"}
            return self._client.get(self._base + path, headers=headers, **kw)
        except (httpx.HTTPError, KeyError, ValueError):
            raise dependency_unavailable() from None

    def resolve(self, data_version: str | None) -> str:
        if data_version is None:
            resp = self._get("/internal/v1/data-versions")
            if resp.status_code != 200:
                raise dependency_unavailable()
            items = resp.json().get("items", [])
            if not items:
                raise data_version_not_found()
            return str(items[0]["version"])  # mới nhất trước
        resp = self._get(f"/internal/v1/data-versions/{data_version}")
        if resp.status_code == 404:
            raise data_version_not_found()
        if resp.status_code != 200:
            raise dependency_unavailable()
        return data_version

    def context(self, data_version: str) -> engine.PanelContext:
        return self._cache.get_or_build(data_version, lambda: self._build(data_version))

    def _build(self, data_version: str) -> engine.PanelContext:
        detail = self._get(f"/internal/v1/data-versions/{data_version}")
        if detail.status_code == 404:
            raise data_version_not_found()
        if detail.status_code != 200:
            raise dependency_unavailable()
        expected = detail.json()["sha256"]

        resp = self._get(f"/internal/v1/data-versions/{data_version}/panel")
        if resp.status_code != 200:
            raise dependency_unavailable()
        content = resp.content
        if len(content) > _PANEL_MAX_BYTES:
            raise dependency_unavailable()
        # Phiên bản dữ liệu bất biến: nội dung PHẢI khớp sha256 đã công bố, nếu không thì không dùng.
        if (
            hashlib.sha256(content).hexdigest() != expected
            or resp.headers.get("x-content-sha256") != expected
        ):
            raise ApiError(
                503,
                "common.dependency_unavailable",
                "Panel tải về không khớp sha256 đã công bố",
            )
        panel = pd.read_parquet(io.BytesIO(content))

        prov = self._get("/internal/v1/provinces")
        if prov.status_code != 200:
            raise dependency_unavailable()
        regions = {p["province_id"]: p["region"] for p in prov.json()["items"]}
        return engine.PanelContext(panel, regions)
