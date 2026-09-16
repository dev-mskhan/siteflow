# SiteFlow

Modular monolith — **pnpm** + **Turbo** + **TypeScript** + **Fastify v5**

## Structure

```
siteflow/
├── apps/
│   ├── server/          # Fastify API + pg-boss worker
│   └── web/             # Next.js 15 frontend
├── packages/
│   ├── shared/          # Shared types, utils, constants (both server & web)
│   ├── observability/   # OTEL SDK init (server) + browser init (client)
│   ├── env/             # Type-safe env validation (t3-env + zod)
│   ├── typescript-config/  # Shared tsconfig presets
│   └── eslint-config/   # Shared ESLint flat-config presets
├── infra/
│   └── docker/
│       ├── postgres/    # postgresql.conf + init.sql
│       ├── redis/       # redis.conf
│       ├── clickhouse/  # listen.xml
│       └── otel-collector/  # config.yaml
├── .github/
│   └── workflows/       # CI (lint + typecheck + build)
└── docker-compose.yml   # All services, four profiles
```

## Getting Started

### 1. Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- Node.js ≥ 20
- pnpm ≥ 9 (`corepack enable`)

### 2. Copy env

```bash
cp .env.example .env
```

### 3. Start infrastructure

```bash
# Postgres + Redis + MinIO only
docker compose up -d

# + full observability (SigNoz, OTEL Collector, ClickHouse)
docker compose --profile observability up -d
```

### 4. Install & run

```bash
pnpm install
pnpm dev           # starts all packages in watch mode via turbo
```

The server is at **http://localhost:3000** and Swagger docs at **http://localhost:3000/docs**.

## Docker Profiles

| Profile | Services added |
|---|---|
| _(none)_ | Postgres · Redis · MinIO |
| `app` | server + worker containers (built from `apps/server/Dockerfile`) |
| `observability` | SigNoz · OTEL Collector · ClickHouse · Zookeeper |
| `pooling` | PgBouncer connection pooler |

```bash
# Everything at once
docker compose --profile app --profile observability up -d
```

## Observability

| Service | URL |
|---|---|
| SigNoz UI | http://localhost:3301 |
| OTLP HTTP | http://localhost:4318 |
| OTLP gRPC | localhost:4317 |

Traces and metrics are auto-instrumented via `@siteflow/observability/server` — imported first in `apps/server/src/index.ts`.

## Ports

| Service | Port |
|---|---|
| Server API | 3000 |
| Web (dev) | 3001 |
| Postgres | 5433 |
| Redis | 6379 |
| MinIO API | 9000 |
| MinIO Console | 9001 |
| PgBouncer | 6432 |
| SigNoz UI | 3301 |
| OTLP HTTP | 4318 |
| OTLP gRPC | 4317 |
