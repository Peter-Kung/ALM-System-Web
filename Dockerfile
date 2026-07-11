FROM node:22-bookworm-slim AS deps

WORKDIR /app
ARG PRISMA_SCHEMA_PATH=prisma/schema.prisma
ENV PRISMA_SCHEMA_PATH=${PRISMA_SCHEMA_PATH}

COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG PRISMA_SCHEMA_PATH=prisma/schema.prisma
ENV PRISMA_SCHEMA_PATH=${PRISMA_SCHEMA_PATH}

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app
ARG PRISMA_SCHEMA_PATH=prisma/schema.prisma
ENV ALM_STORAGE_ROOT=/var/lib/alm-system \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    PORT=3000 \
    PRISMA_SCHEMA_PATH=${PRISMA_SCHEMA_PATH}

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
VOLUME ["/var/lib/alm-system"]

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
