# ── Stage 1: Build Go worker binary ──
FROM golang:1.25-alpine AS go-builder
WORKDIR /build

# Copy both modules (worker depends on admin-service via replace directive)
COPY services/admin-service/go.mod services/admin-service/go.sum ./services/admin-service/
COPY services/execution-worker/go.mod services/execution-worker/go.sum ./services/execution-worker/

WORKDIR /build/services/execution-worker
RUN go mod download

# Copy full source for both
COPY services/admin-service/ /build/services/admin-service/
COPY services/execution-worker/ /build/services/execution-worker/

RUN CGO_ENABLED=0 GOOS=linux go build -o /build/worker ./cmd/worker

# ── Stage 2: Runtime with Node.js + Playwright ──
FROM mcr.microsoft.com/playwright:v1.50.0-noble

WORKDIR /app

# Copy Go worker binary
COPY --from=go-builder /build/worker ./worker

# Copy playwright-engine source and install deps
COPY services/playwright-engine/ ./playwright-engine/
WORKDIR /app/playwright-engine
RUN npm ci --production
WORKDIR /app

ENV PLAYWRIGHT_ENGINE_PATH=/app/playwright-engine/execute.js

CMD ["./worker"]
