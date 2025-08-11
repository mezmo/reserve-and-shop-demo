# Multi-stage build for better optimization
FROM node:20-slim AS base

# Install Python and other system dependencies including wget for LogDNA agent and jq for JSON parsing
RUN apt-get update && \
    apt-get install -y python3 python3-pip curl wget ca-certificates procps sudo jq && \
    rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Install LogDNA Agent v2 via package manager
RUN echo "deb https://assets.logdna.com stable main" > /etc/apt/sources.list.d/logdna.list && \
    wget -qO - https://assets.logdna.com/logdna.gpg | apt-key add - && \
    apt-get update && \
    apt-get install -y logdna-agent && \
    rm -rf /var/lib/apt/lists/*

# Create LogDNA directories and configuration
RUN mkdir -p /etc/logdna /var/lib/logdna && \
    chmod 755 /etc/logdna /var/lib/logdna

# Install OpenTelemetry Collector Contrib
RUN wget -qO /tmp/otelcol.tar.gz "https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v0.91.0/otelcol-contrib_0.91.0_linux_amd64.tar.gz" && \
    tar -xzf /tmp/otelcol.tar.gz -C /usr/local/bin/ otelcol-contrib && \
    chmod +x /usr/local/bin/otelcol-contrib && \
    rm /tmp/otelcol.tar.gz

# Create OpenTelemetry Collector directories and configuration
RUN mkdir -p /etc/otelcol && \
    chmod 755 /etc/otelcol

# Create non-root user and configure sudo
RUN useradd -m codeuser && \
    echo "codeuser ALL=(ALL) NOPASSWD: /usr/bin/logdna-agent" >> /etc/sudoers && \
    echo "codeuser ALL=(ALL) NOPASSWD: /bin/kill" >> /etc/sudoers

WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies with specific npm configuration to avoid browserslist issues
RUN npm config set update-notifier false && \
    npm config set fund false && \
    npm install --silent --no-audit --no-fund && \
    npm cache clean --force

# Copy the rest of the application code
COPY . .

# Optional: Copy agents configuration file if provided during build
ARG AGENTS_CONFIG_FILE
RUN if [ -n "${AGENTS_CONFIG_FILE}" ] && [ -f "${AGENTS_CONFIG_FILE}" ]; then \
      echo "✅ Agents configuration file included in build"; \
      cp "${AGENTS_CONFIG_FILE}" /app/agents-config.json; \
    else \
      echo "ℹ️  No agents configuration file provided - agents can be configured via web UI"; \
    fi

# Set up startup script
COPY startup.sh /usr/local/bin/startup.sh
RUN sed -i 's/\r$//' /usr/local/bin/startup.sh && chmod +x /usr/local/bin/startup.sh

# Create user-specific temp directory for logs
RUN mkdir -p /tmp/codeuser && chown codeuser:codeuser /tmp/codeuser && chmod 755 /tmp/codeuser

# Set up LogDNA permissions for codeuser
RUN chown -R codeuser:codeuser /var/lib/logdna /etc/logdna

# Set up OpenTelemetry Collector permissions for codeuser
RUN chown -R codeuser:codeuser /etc/otelcol

# Change ownership to codeuser after all setup is complete
RUN chown -R codeuser:codeuser /app

# Switch to non-root user
USER codeuser

# Expose the ports
EXPOSE 8080 3001 4317 4318

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080 || exit 1

# Use a wrapper script that ensures proper shell handling
CMD ["/usr/local/bin/startup.sh"]