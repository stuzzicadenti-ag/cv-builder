FROM node:22-alpine

RUN apk add --no-cache curl tar && \
    ARCH=$(uname -m) && \
    if [ "$ARCH" = "aarch64" ]; then TYPST_ARCH="aarch64-unknown-linux-musl"; \
    else TYPST_ARCH="x86_64-unknown-linux-musl"; fi && \
    curl -fsSL "https://github.com/typst/typst/releases/latest/download/typst-${TYPST_ARCH}.tar.xz" | \
    tar xJ --strip-components=1 -C /usr/local/bin/ && \
    apk del curl tar

RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -D appuser
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --production && npm cache clean --force
COPY src/ src/
RUN mkdir -p /app/data/pdfs && chown -R appuser:appgroup /app
USER appuser

ENV NODE_ENV=production PORT=4001
EXPOSE 4001
CMD ["node", "src/server.js"]
