from fastapi import FastAPI

from .routes import router

app = FastAPI(
    title="DengueSense GenAI API",
    description="API cho module sinh dự thảo văn bản và kiểm soát Guardrails G1-G6",
    version="1.0.0-draft.1",
)

app.include_router(router, prefix="/internal/v1/genai")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
