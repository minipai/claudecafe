#!/bin/bash
set -e

# Configuration
DROPLET_IP="134.199.156.190"
DROPLET_USER="root"
IMAGE_NAME="claudecafe"
DOMAIN="claudecafe.dev"

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== claudecafe Deployment Script ===${NC}"

# Build Docker image locally (for amd64 Linux).
# Context is the monorepo root so the build sees the root pnpm-lock.yaml.
echo -e "${GREEN}[1/3] Building Docker image locally...${NC}"
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
docker build --platform linux/amd64 -f "$REPO_ROOT/apps/web/Dockerfile" -t "$IMAGE_NAME" "$REPO_ROOT"

# Transfer image to droplet
echo -e "${GREEN}[2/3] Transferring image to droplet...${NC}"
ssh "$DROPLET_USER@$DROPLET_IP" 'docker image prune -af'
docker save "$IMAGE_NAME" | ssh "$DROPLET_USER@$DROPLET_IP" 'docker load'

# Set up and run container on droplet
echo -e "${GREEN}[3/3] Setting up container on droplet...${NC}"
ssh "$DROPLET_USER@$DROPLET_IP" bash << EOF
set -e

docker stop "$IMAGE_NAME" 2>/dev/null || true
docker rm "$IMAGE_NAME" 2>/dev/null || true

docker run -d \
    --name "$IMAGE_NAME" \
    --restart unless-stopped \
    --network caddy-net \
    "$IMAGE_NAME"

echo "claudecafe container started"
echo ""
docker logs --tail 10 "$IMAGE_NAME"
EOF

echo ""
echo -e "${GREEN}=== Deployment complete! ===${NC}"
echo -e "App available at: ${GREEN}https://$DOMAIN${NC}"
