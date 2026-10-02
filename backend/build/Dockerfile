# syntax=docker/dockerfile:1.7
# Dockerfile dùng chung cho mọi service Go (docs/09 §16.4). Chọn service bằng --build-arg SERVICE.
#   docker build -f backend/build/Dockerfile --build-arg SERVICE=gateway --build-arg VERSION=$(git rev-parse HEAD) backend
#
# Image cuối: distroless static, chạy user không phải root, không shell, không package manager.
ARG GO_VERSION=1.26.6

FROM golang:${GO_VERSION}-alpine AS build
WORKDIR /src

# Tách bước tải module để tận dụng cache khi chỉ đổi mã nguồn.
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY . .
ARG SERVICE
ARG VERSION=dev
RUN test -n "${SERVICE}" || { echo "thiếu --build-arg SERVICE=<gateway|identity|...>" >&2; exit 1; }
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -X main.version=${VERSION}" -o /out/service ./cmd/${SERVICE}

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/service /service
USER nonroot:nonroot
ENTRYPOINT ["/service"]
