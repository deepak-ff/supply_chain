FROM golang:1.25-bookworm AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ARG VERSION=1.0.0
ARG CW_LICENSE_PUBLIC_KEY
RUN CGO_ENABLED=0 GOOS=linux go build \
    -trimpath \
    -ldflags="-s -w -X main.version=${VERSION} -X github.com/deepak-ff/supply_chain/internal/license.publicKeyHex=${CW_LICENSE_PUBLIC_KEY}" \
    -o /chainwarden-api \
    ./internal/api/
RUN CGO_ENABLED=0 GOOS=linux go build \
    -trimpath \
    -ldflags="-s -w -X main.version=${VERSION} -X github.com/deepak-ff/supply_chain/internal/license.publicKeyHex=${CW_LICENSE_PUBLIC_KEY}" \
    -o /cwctl \
    ./cmd/cwctl/

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /chainwarden-api /chainwarden-api
COPY --from=builder /cwctl /usr/local/bin/cwctl
EXPOSE 8080
ENTRYPOINT ["/chainwarden-api"]
