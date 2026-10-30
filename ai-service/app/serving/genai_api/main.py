"""GenAI service: service-to-service authentication is mandatory."""

import os

from fastapi import Depends, FastAPI, Request

from app.serving.common.problem import ApiError, install_error_handlers
from app.serving.common.service_auth import AuthError, ServiceVerifier, parse_public_key
from app.serving.genai_api.routes import router


def require_workflow(request: Request) -> None:
    key = os.getenv("GENAI_JWT_PUBLIC_KEY", "")
    if not key:
        raise ApiError(
            503, "common.dependency_unavailable", "Chưa cấu hình xác thực GenAI"
        )
    scheme, _, token = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise ApiError(401, "common.unauthenticated", "Chưa xác thực")
    try:
        verifier = ServiceVerifier(
            {os.getenv("GENAI_JWT_KEY_ID", "k1"): parse_public_key(key)},
            os.getenv("GENAI_JWT_ISSUER", "denguesense-identity"),
            "genai",
        )
        identity = verifier.verify(token.strip())
        if identity.service != "workflow":
            raise AuthError("service")
    except (AuthError, ValueError):
        raise ApiError(401, "common.unauthenticated", "Chưa xác thực") from None


app = FastAPI(title="DengueSense GenAI API", version="1.0.0-draft.2")
install_error_handlers(app)
app.include_router(
    router, prefix="/internal/v1/genai", dependencies=[Depends(require_workflow)]
)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
