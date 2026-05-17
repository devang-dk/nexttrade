# =====================================================================
# jenkins/Dockerfile — Custom Jenkins with Docker CLI + Node.js 18
# Extends the official Jenkins LTS image to add tooling needed by
# the NexTrade CI/CD pipeline:
#   • Docker CLI  — so Jenkins can build/push images via the host socket
#   • Node.js 18  — so npm install/test run directly without a container agent
# =====================================================================

FROM jenkins/jenkins:lts-jdk21

# Switch to root to install system packages
USER root

# ── Install Docker CLI ────────────────────────────────────────────────
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        gnupg \
        lsb-release && \
    # Add Docker's official GPG key & repo
    install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg \
         -o /etc/apt/keyrings/docker.asc && \
    chmod a+r /etc/apt/keyrings/docker.asc && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
         https://download.docker.com/linux/debian \
         $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" \
         > /etc/apt/sources.list.d/docker.list && \
    apt-get update -qq && \
    apt-get install -y --no-install-recommends docker-ce-cli && \
    rm -rf /var/lib/apt/lists/*

# ── Install Node.js 18 (via NodeSource) ──────────────────────────────
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

# ── Add jenkins user to docker group so it can use the socket ─────────
RUN groupadd -f docker && \
    usermod -aG docker jenkins

# Switch back to jenkins user for runtime
USER jenkins

# Verify tools are available (printed during image build)
RUN java -version && \
    docker --version && \
    node --version && \
    npm --version
