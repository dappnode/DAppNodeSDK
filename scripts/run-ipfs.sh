#!/usr/bin/env bash
set -euo pipefail

NAME="ipfs-node"
IMAGE="ipfs/kubo:latest"
DATA_DIR="${HOME}/ipfs-data"
API_PORT=5001       # HTTP API
GATEWAY_PORT=8080   # Gateway
SWARM_PORT=4001     # Libp2p swarm (TCP)

echo "▶︎ Starting IPFS daemon in Docker…"

# Create data directory if it doesn't exist
mkdir -p "${DATA_DIR}"

# Stop & remove any existing container with the same name
if docker ps -a --format '{{.Names}}' | grep -q "^${NAME}$"; then
  echo "⏹  Removing existing container '${NAME}'…"
  docker rm -f "${NAME}" >/dev/null
fi

# Launch the container detached
docker run -d --name "${NAME}" \
  -v "${DATA_DIR}:/data/ipfs" \
  -p "${SWARM_PORT}:4001" \
  -p "${API_PORT}:5001" \
  -p "${GATEWAY_PORT}:8080" \
  "${IMAGE}" daemon >/dev/null

echo "⏳  Waiting for API to respond on :${API_PORT}…"
for i in {1..20}; do
  if curl -fsS "http://127.0.0.1:${API_PORT}/api/v0/version" >/dev/null 2>&1; then
    echo "✅  IPFS is up!"
    echo "API:     http://127.0.0.1:${API_PORT}"
    echo "Gateway: http://127.0.0.1:${GATEWAY_PORT}"
    exit 0
  fi
  sleep 1
done

echo "❌  IPFS API did not respond in time." >&2
docker logs --tail=100 "${NAME}" >&2
exit 1

