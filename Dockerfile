# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build the Go execution worker
# ─────────────────────────────────────────────────────────────────────────────
FROM golang:1.25-bookworm AS go-builder

WORKDIR /build

# Copy BOTH service sources first — required because execution-worker go.mod
# has: replace github.com/kshiti/exec-admin-service => ../admin-service
# go mod download needs the admin-service source on disk to resolve this.
COPY services/execution-worker/ ./services/execution-worker/
COPY services/admin-service/ ./services/admin-service/

# Now download deps and build (admin-service source is present for replace directive)
WORKDIR /build/services/execution-worker
RUN go mod download
RUN go build -o /worker ./cmd/worker/main.go


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Runtime — Node.js 20 + Playwright + Go binary
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim

# Install system Chromium and Playwright dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Copy Go worker binary
COPY --from=go-builder /worker /usr/local/bin/worker

# Install Playwright engine Node dependencies
WORKDIR /app/playwright-engine
COPY services/playwright-engine/package*.json ./
RUN npm ci

# Copy Playwright engine source
COPY services/playwright-engine/ ./

# Tell Playwright to use the system Chromium instead of downloading one
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

# Worker runs from /app so it can reference ../playwright-engine/execute.js
WORKDIR /app

CMD ["/usr/local/bin/worker"]
