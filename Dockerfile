# Multi-stage build for better optimization
FROM node:20-slim as base

# Install Python and other system dependencies
RUN apt-get update && \
    apt-get install -y python3 python3-pip curl && \
    rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Create non-root user
RUN useradd -m codeuser

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

# Set up startup script
COPY startup.sh /usr/local/bin/startup.sh
RUN sed -i 's/\r$//' /usr/local/bin/startup.sh && chmod +x /usr/local/bin/startup.sh

# Create user-specific temp directory for logs
RUN mkdir -p /tmp/codeuser && chown codeuser:codeuser /tmp/codeuser && chmod 755 /tmp/codeuser

# Change ownership to codeuser after all setup is complete
RUN chown -R codeuser:codeuser /app

# Switch to non-root user
USER codeuser

# Expose the ports
EXPOSE 8080 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080 || exit 1

# Use a wrapper script that ensures proper shell handling
CMD ["/usr/local/bin/startup.sh"]