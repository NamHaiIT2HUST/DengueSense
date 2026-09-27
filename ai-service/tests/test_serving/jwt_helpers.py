"""Ký token dịch vụ giả (Ed25519) cho test — cùng định dạng `identity` (backend/pkg/authx)."""

import base64
import json
import time

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


class Signer:
    def __init__(self, kid: str = "k1") -> None:
        self.key = Ed25519PrivateKey.generate()
        self.kid = kid

    @property
    def public_b64(self) -> str:
        return base64.b64encode(
            self.key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
        ).decode()

    def sign(self, claims: dict, header: dict | None = None) -> str:
        head = header or {"alg": "EdDSA", "typ": "JWT", "kid": self.kid}
        signing = (
            f"{b64url(json.dumps(head).encode())}.{b64url(json.dumps(claims).encode())}"
        )
        return f"{signing}.{b64url(self.key.sign(signing.encode()))}"

    def service_token(
        self,
        audience: str = "forecast",
        *,
        sub: str = "gateway",
        issuer: str = "denguesense-identity",
        ttl: int = 300,
        typ: str | None = "service",
        now: float | None = None,
    ) -> str:
        t = int(now if now is not None else time.time())
        claims = {
            "iss": issuer,
            "sub": sub,
            "aud": [audience],
            "iat": t,
            "exp": t + ttl,
            "jti": "x",
        }
        if typ:
            claims["typ"] = typ
        return self.sign(claims)
