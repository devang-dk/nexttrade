#!/bin/bash
# =====================================================================
# NexTrade — EC2 Bootstrap Script (user-data)
# Runs once on first boot as root. Installs Docker, creates deploy user,
# clones the repo, and sets up /opt/nextrade ready for Jenkins to deploy.
# =====================================================================
set -euo pipefail

LOG="/var/log/nextrade-bootstrap.log"
exec > >(tee -a "$LOG") 2>&1

echo "════════════════════════════════════════"
echo "  NexTrade EC2 Bootstrap — $(date)"
echo "════════════════════════════════════════"

# ── 1. System update ─────────────────────────────────────────────────
echo "[1/6] Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

# ── 2. Install Docker ────────────────────────────────────────────────
echo "[2/6] Installing Docker CE + Compose plugin..."
apt-get install -y -qq ca-certificates curl gnupg

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
     -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu \
$(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
| tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -qq
apt-get install -y -qq \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin

systemctl enable docker
systemctl start docker

echo "✅ Docker $(docker --version) installed"
echo "✅ Docker Compose $(docker compose version) installed"

# ── 3. Add ubuntu user to docker group ───────────────────────────────
echo "[3/6] Configuring docker group for ubuntu user..."
usermod -aG docker ubuntu

# ── 4. Set up /opt/nextrade directory ────────────────────────────────
echo "[4/6] Creating /opt/nextrade app directory..."
mkdir -p /opt/nextrade
chown ubuntu:ubuntu /opt/nextrade

# Create placeholder .env (Jenkins will SCP the real one on each deploy)
touch /opt/nextrade/.env
chown ubuntu:ubuntu /opt/nextrade/.env

# ── 5. Clone repo for docker-compose.yml and monitoring configs ──────
echo "[5/6] Cloning NexTrade repository..."
apt-get install -y -qq git
sudo -u ubuntu git clone https://github.com/devang-dk/nexttrade.git /opt/nextrade \
  || echo "⚠️  Repo already cloned — skipping"

# ── 6. Pull latest Docker images ─────────────────────────────────────
echo "[6/6] Pre-pulling Docker images..."
sudo -u ubuntu docker pull ronnie75491/nextrade-server:latest  || true
sudo -u ubuntu docker pull ronnie75491/nextrade-client:latest  || true
sudo -u ubuntu docker pull nginx:1.27-alpine                   || true
sudo -u ubuntu docker pull prom/prometheus:v2.52.0             || true
sudo -u ubuntu docker pull grafana/grafana:10.4.2              || true

echo "════════════════════════════════════════"
echo "  Bootstrap COMPLETE — $(date)"
echo "  NexTrade is ready for Jenkins deploy"
echo "  Log: $LOG"
echo "════════════════════════════════════════"
