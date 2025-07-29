FROM python:3.13-slim

RUN useradd -m codeuser

RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
COPY startup.sh /usr/local/bin/startup.sh
RUN sed -i 's/\r$//' /usr/local/bin/startup.sh && chmod +x /usr/local/bin/startup.sh

RUN chown -R codeuser:codeuser /app

USER codeuser

EXPOSE 8080

CMD ["bash", "/usr/local/bin/startup.sh"]