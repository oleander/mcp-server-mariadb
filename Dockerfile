FROM node:23-alpine AS builder

WORKDIR /app

COPY package.json /app/
COPY pnpm-lock.yaml /app/

RUN --mount=type=cache,target=/root/.npm npm install --ignore-scripts

COPY . /app

RUN npm install && npm run build

FROM node:23-alpine

WORKDIR /app

COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/package-lock.json /app/package-lock.json

ENV MARIADB_HOST=127.0.0.1
ENV MARIADB_PORT=3306
ENV MARIADB_USER=root
ENV MARIADB_PASS=test_password
ENV MARIADB_DB=test_db
ENV LOG_LEVEL=info

RUN npm ci --omit=dev

ENTRYPOINT npm exec @oleander/mcp-server-mariadb
