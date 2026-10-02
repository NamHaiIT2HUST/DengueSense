"""Xác thực token DỊCH VỤ (service ↔ service) cho service `forecast` — FAIL-CLOSED (docs/09 §11).

Token do `identity` ký EdDSA (Ed25519), dạng JWT: header {alg: EdDSA, kid}, claims {iss, sub, aud, iat, exp, typ: service}.
Chỉ chấp nhận token có `typ=service`, đúng `iss`, `aud` chứa `forecast` và còn hạn — token NGƯỜI DÙNG (aud=gateway,
không có typ=service) và token cấp cho service khác đều bị từ chối.

Header `X-Actor-*` (danh tính người dùng gốc do gateway gắn) CHỈ được tin sau khi token dịch vụ hợp lệ; thiếu token → 401
trước mọi xử lý khác.
"""

from __future__ import annotations

import base64
import binascii
import json
import time
from collections.abc import Callable, Mapping
from dataclasses import dataclass

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from fastapi import Request

from app.serving.common.problem import ApiError, validation_error

VALID_ROLES = frozenset(
    {"viewer", "analyst", "officer", "approver", "data_manager", "admin"}
)
CLOCK_LEEWAY_SECONDS = 5


class AuthError(Exception):
    """Token không hợp lệ (không nêu lý do chi tiết ra ngoài — tránh giúp kẻ thăm dò)."""


@dataclass(frozen=True)
class ServiceIdentity:
    service: str


@dataclass(frozen=True)
class Actor:
    id: str
    roles: frozenset[str]
    org_id: str | None

    def has(self, *roles: str) -> bool:
        return bool(self.roles.intersection(roles))


def _b64url(data: str) -> bytes:
    try:
        return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))
    except (binascii.Error, ValueError) as exc:
        raise AuthError("base64") from exc


def parse_public_key(b64: str) -> Ed25519PublicKey:
    """Khoá công khai Ed25519 dạng base64 chuẩn của 32 byte thô (cùng định dạng backend/pkg/authx)."""
    try:
        raw = base64.b64decode(b64, validate=True)
        if len(raw) != 32:
            raise ValueError
        return Ed25519PublicKey.from_public_bytes(raw)
    except (binascii.Error, ValueError) as exc:
        raise ValueError(
            "khoá công khai Ed25519 không hợp lệ (cần base64 của 32 byte)"
        ) from exc


class ServiceVerifier:
    def __init__(
        self,
        keys: Mapping[str, Ed25519PublicKey],
        issuer: str,
        audience: str,
        clock: Callable[[], float] = time.time,
    ) -> None:
        if not keys:
            raise ValueError("cần ít nhất một khoá công khai")
        self._keys = dict(keys)
        self._issuer = issuer
        self._audience = audience
        self._clock = clock

    def verify(self, token: str) -> ServiceIdentity:
        parts = token.split(".")
        if len(parts) != 3 or not all(parts):
            raise AuthError("định dạng")
        try:
            header = json.loads(_b64url(parts[0]))
            claims = json.loads(_b64url(parts[1]))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise AuthError("json") from exc
        if not isinstance(header, dict) or not isinstance(claims, dict):
            raise AuthError("cấu trúc")
        if (
            header.get("alg") != "EdDSA"
        ):  # chặn alg=none / HS256 (tấn công nhầm thuật toán)
            raise AuthError("thuật toán")
        kid = header.get("kid")
        key = self._keys.get(kid) if isinstance(kid, str) else None
        if key is None and kid is None and len(self._keys) == 1:
            key = next(iter(self._keys.values()))
        if key is None:
            raise AuthError("kid")
        try:
            key.verify(_b64url(parts[2]), f"{parts[0]}.{parts[1]}".encode("ascii"))
        except (InvalidSignature, UnicodeEncodeError) as exc:
            raise AuthError("chữ ký") from exc

        now = self._clock()
        exp, iat = claims.get("exp"), claims.get("iat")
        if not isinstance(exp, int | float) or exp + CLOCK_LEEWAY_SECONDS < now:
            raise AuthError("hết hạn")
        if isinstance(iat, int | float) and iat - CLOCK_LEEWAY_SECONDS > now:
            raise AuthError("iat")
        if claims.get("iss") != self._issuer or claims.get("typ") != "service":
            raise AuthError("iss/typ")
        aud = claims.get("aud")
        auds = [aud] if isinstance(aud, str) else aud if isinstance(aud, list) else []
        if self._audience not in auds:
            raise AuthError("aud")
        sub = claims.get("sub")
        if not isinstance(sub, str) or not sub:
            raise AuthError("sub")
        return ServiceIdentity(service=sub)


def unauthenticated() -> ApiError:
    return ApiError(401, "common.unauthenticated", "Chưa xác thực")


def forbidden(detail: str = "") -> ApiError:
    return ApiError(403, "common.forbidden", "Không đủ quyền", detail)


def parse_actor(request: Request) -> Actor | None:
    """Đọc `X-Actor-*` (đã sau xác thực dịch vụ). Không có `X-Actor-ID` → None (lời gọi service↔service thuần)."""
    actor_id = request.headers.get("x-actor-id", "").strip()
    if not actor_id:
        return None
    roles = {
        r.strip()
        for r in request.headers.get("x-actor-roles", "").split(",")
        if r.strip()
    }
    if not roles or not roles <= VALID_ROLES:
        raise validation_error(
            "header X-Actor-Roles thiếu hoặc chứa vai trò không hợp lệ"
        )
    return Actor(
        id=actor_id,
        roles=frozenset(roles),
        org_id=request.headers.get("x-org-id") or None,
    )


def make_dependencies(
    verifier: ServiceVerifier,
) -> tuple[Callable[..., ServiceIdentity], Callable[..., Actor | None]]:
    """Dựng dependency FastAPI: `require_service` (bắt buộc mọi route trừ /healthz, /readyz) và `actor`."""

    def require_service(request: Request) -> ServiceIdentity:
        auth = request.headers.get("authorization", "")
        scheme, _, token = auth.partition(" ")
        if scheme.lower() != "bearer" or not token.strip():
            raise unauthenticated()
        try:
            identity = verifier.verify(token.strip())
        except AuthError:
            raise unauthenticated() from None
        request.state.service = identity
        return identity

    def actor(request: Request) -> Actor | None:
        # `require_service` gắn ở cấp router nên chạy TRƯỚC dependency này (thiếu token → 401, không đọc header).
        return parse_actor(request)

    return require_service, actor
