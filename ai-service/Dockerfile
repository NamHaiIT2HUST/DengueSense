# Image service `forecast` (API dự báo, Layer 1). Chạy user không phải root, rootfs chỉ đọc được (xem compose).
#   docker build -f ai-service/Dockerfile --build-arg VERSION=$(git rev-parse HEAD) ai-service
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /srv

# Tách bước cài phụ thuộc để tận dụng cache khi chỉ đổi mã nguồn.
COPY requirements-serving.txt .
# libgomp1: thời gian chạy OpenMP của LightGBM/XGBoost (image slim không có sẵn).
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && pip install -r requirements-serving.txt

# Thư viện nghiên cứu (mô hình, đặc trưng — CHỈ mã Python, không notebook/data/experiments) + lớp phục vụ.
COPY app/forecast ./app/forecast
COPY app/serving ./app/serving

ARG VERSION=dev
ENV BUILD_VERSION=${VERSION}

RUN useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin app
USER app

EXPOSE 8001
CMD ["uvicorn", "app.serving.forecast_api.main:create_app_from_env", "--factory", "--host", "0.0.0.0", "--port", "8001", "--no-access-log"]
