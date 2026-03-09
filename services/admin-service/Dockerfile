# ── Stage 1: Build Go binary ──
FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o admin-service ./cmd/server

# ── Stage 2: Minimal runtime ──
FROM alpine:3.19
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /app/admin-service .
EXPOSE 8081
CMD ["./admin-service"]
