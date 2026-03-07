FROM node:22-alpine

RUN apk add --no-cache --repository=https://dl-cdn.alpinelinux.org/alpine/edge/community typst

RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -D appuser
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production && npm cache clean --force
COPY src/ src/
RUN mkdir -p /app/data/pdfs && chown -R appuser:appgroup /app
USER appuser

ENV NODE_ENV=production PORT=4001
EXPOSE 4001
CMD ["node", "src/server.js"]
