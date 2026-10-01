from fastapi import FastAPI
from .routes import router

app = FastAPI(
    title="DengueSense Optimize API",
    description="API cho module phân bổ nguồn lực",
    version="1.0.0-draft.1"
)

app.include_router(router, prefix="/internal/v1/optimize")

@app.get("/healthz")
def healthz():
    return {"status": "ok"}
