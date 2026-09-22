# syntax=docker/dockerfile:1
# Build from the workspace root: docker build -f genesis-console/Dockerfile .
FROM --platform=$BUILDPLATFORM node:24.18.0-bookworm-slim AS web
WORKDIR /src
RUN npm install --global pnpm@11.18.0
COPY genesis-console/web/package.json genesis-console/web/pnpm-lock.yaml genesis-console/web/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY genesis-console/web/ ./
RUN pnpm build

FROM --platform=$BUILDPLATFORM golang:1.27.1-bookworm AS build
WORKDIR /src
COPY genesis-console/go.mod genesis-console/go.sum ./
RUN go mod download
COPY genesis-console/ ./
ARG TARGETOS
ARG TARGETARCH
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags='-s -w' -o /out/genesis-console ./cmd/console

FROM --platform=$BUILDPLATFORM debian:bookworm-slim AS tools
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
ARG TARGETARCH
ARG HELM_VERSION=4.2.1
ARG KUBECTL_VERSION=1.36.1
ARG TRIVY_VERSION=0.69.3
WORKDIR /tmp/tools
RUN set -eu; \
    mkdir -p /out; \
    curl -fsSLO "https://get.helm.sh/helm-v${HELM_VERSION}-linux-${TARGETARCH}.tar.gz"; \
    curl -fsSLO "https://get.helm.sh/helm-v${HELM_VERSION}-linux-${TARGETARCH}.tar.gz.sha256sum"; \
    sha256sum -c "helm-v${HELM_VERSION}-linux-${TARGETARCH}.tar.gz.sha256sum"; \
    tar -xzf "helm-v${HELM_VERSION}-linux-${TARGETARCH}.tar.gz"; \
    cp "linux-${TARGETARCH}/helm" /out/helm; \
    curl -fsSLo /out/kubectl "https://dl.k8s.io/release/v${KUBECTL_VERSION}/bin/linux/${TARGETARCH}/kubectl"; \
    curl -fsSLo kubectl.sha256 "https://dl.k8s.io/release/v${KUBECTL_VERSION}/bin/linux/${TARGETARCH}/kubectl.sha256"; \
    echo "$(cat kubectl.sha256)  /out/kubectl" | sha256sum -c -; \
    case "$TARGETARCH" in amd64) arch=64bit ;; arm64) arch=ARM64 ;; *) exit 1 ;; esac; \
    file="trivy_${TRIVY_VERSION}_Linux-${arch}.tar.gz"; \
    curl -fsSLO "https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/${file}"; \
    curl -fsSLo checksums.txt "https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_checksums.txt"; \
    grep "  ${file}$" checksums.txt | sha256sum -c -; \
    tar -xzf "$file" trivy; cp trivy /out/trivy; chmod 755 /out/*

FROM debian:bookworm-slim
LABEL org.opencontainers.image.title="Genesis Console" org.opencontainers.image.licenses="Apache-2.0"
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/* \
    && groupadd -g 65532 genesis && useradd -u 65532 -g genesis -m genesis \
    && mkdir -p /var/cache/genesis && chown 65532:65532 /var/cache/genesis
COPY --from=build /out/genesis-console /usr/local/bin/genesis-console
COPY --from=tools /out/ /usr/local/bin/
COPY --from=web /src/dist/ /app/web/
COPY genesis-console/LICENSE /app/LICENSE
COPY genesis-engine/catalogs/ /app/data/catalogs/
COPY genesis-engine/baselines/ /app/data/baselines/
RUN chmod -R a+rX /app/data
WORKDIR /app
ENV ADDR=0.0.0.0:8080 PORT=8080 GENESIS_WEB_DIR=/app/web GENESIS_DATA_DIR=/app/data \
    GENESIS_TRIVY_CACHE=/var/cache/genesis/trivy HELM_CACHE_HOME=/var/cache/genesis/helm/cache \
    HELM_CONFIG_HOME=/var/cache/genesis/helm/config HELM_DATA_HOME=/var/cache/genesis/helm/data
USER 65532:65532
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD ["genesis-console", "healthcheck"]
ENTRYPOINT ["genesis-console"]
