# --- Build Stage ---
FROM golang:1.25-bullseye AS builder

WORKDIR /app

# Copy the entire monorepo context because of cross-service dependencies (replace directives)
COPY . .

# Build the execution-worker
WORKDIR /app/services/execution-worker
RUN go build -o worker cmd/worker/main.go

# --- Final Stage ---
FROM mcr.microsoft.com/playwright:v1.50.0-focal

# Set up work directory
WORKDIR /app

# Install Node.js dependencies for the Playwright engine
COPY services/playwright-engine/package*.json ./services/playwright-engine/
WORKDIR /app/services/playwright-engine
RUN npm install

# Copy the Go binary from the builder stage
COPY --from=builder /app/services/execution-worker/worker /app/services/execution-worker/worker

# Copy the necessary source files (engine and configs)
COPY services/playwright-engine/execute.js /app/services/playwright-engine/
COPY core/ /app/core/
COPY configs/ /app/configs/

# Set the working directory to where the worker expects to be
WORKDIR /app/services/execution-worker

# Run the worker
CMD ["./worker"]
