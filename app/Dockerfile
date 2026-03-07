FROM node:22-alpine

# Install Typst for PDF generation
RUN apk add --no-cache curl tar && \
    ARCH=$(uname -m) && \
    if [ "$ARCH" = "aarch64" ]; then TYPST_ARCH="aarch64-unknown-linux-musl"; \
    else TYPST_ARCH="x86_64-unknown-linux-musl"; fi && \
    curl -fsSL "https://github.com/typst/typst/releases/latest/download/typst-${TYPST_ARCH}.tar.xz" | \
    tar xJ --strip-components=1 -C /usr/local/bin/ && \
    apk del curl tar

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --production
COPY src/ src/

ENV NODE_ENV=production
ENV PORT=4001
EXPOSE 4001

CMD ["node", "src/server.js"]
