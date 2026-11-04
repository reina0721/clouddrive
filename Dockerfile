# syntax=docker/dockerfile:1.19

FROM --platform=$BUILDPLATFORM golang:1.26.10-bookworm@sha256:23ce71337b726608afb1bc00986e630a05034a87a87ea1fc2cd1ae5cf33387eb AS build

ARG TARGETOS=linux
ARG TARGETARCH=amd64
ARG VERSION=dev
ARG COMMIT=unknown
ARG BUILD_TIME=unknown
ARG DIRTY=true

WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -trimpath -buildvcs=false \
    -ldflags="-s -w -X main.buildVersion=${VERSION} -X main.buildCommit=${COMMIT} -X main.buildTime=${BUILD_TIME} -X main.buildDirty=${DIRTY}" \
    -o /out/clouddrive ./cmd/app
RUN mkdir -p /out/data

FROM gcr.io/distroless/static-debian13:nonroot@sha256:b5b9fd04c8dcf72a173183c0b7dee47e053e002246b308a59f3441db7b8b9cc4 AS runtime

ARG VERSION=dev
ARG COMMIT=unknown
ARG BUILD_TIME=unknown
ARG SOURCE=https://github.com/reina0721/clouddrive

LABEL org.opencontainers.image.title="clouddrive" \
      org.opencontainers.image.description="Production-oriented Go HTTP API scaffold" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${COMMIT}" \
      org.opencontainers.image.created="${BUILD_TIME}" \
      org.opencontainers.image.source="${SOURCE}" \
      org.opencontainers.image.licenses="Apache-2.0"

WORKDIR /app
COPY --chown=nonroot:nonroot --from=build /out/clouddrive /app/clouddrive
COPY --chown=nonroot:nonroot config.example.yaml /app/config.yaml
COPY --chown=nonroot:nonroot --from=build /out/data /app/.data

USER nonroot:nonroot
EXPOSE 8080 9090
ENTRYPOINT ["/app/clouddrive"]
