---
last_mapped_commit: d879191a607aa42d2df8631751e48ffd70621df0
last_mapped_at: 2026-10-07
---
# External Integrations

**Analysis Date:** 2026-10-07

## APIs & External Services

**Identity and email:**
- Google OAuth - optional sign-in/link flow implemented in `apps/server/src/modules/auth/google-oauth.service.ts`.
  - SDK/Client: `google-auth-library`.
  - Auth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`.
- SMTP - outbound authentication/invitation email through `apps/server/src/lib/email/email.service.ts`.
  - SDK/Client: `nodemailer`.
  - Auth/config: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.

**Object storage:**
- MinIO, S3-compatible - document objects and signed upload/download URLs through `apps/server/src/lib/storage/storage.service.ts`.
  - Auth/config: `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET_DOCUMENTS`, `MINIO_USE_SSL`.

## Data Storage

**Databases:**
- PostgreSQL - authoritative application storage and PgBoss persistence.
  - Connection: `DATABASE_URL`.
  - Client: Drizzle ORM; schema under `packages/database/src/schema/`; migrations under `packages/database/drizzle/`.
- ClickHouse - present in local observability infrastructure configuration; no application-domain integration identified.

**File Storage:**
- MinIO storage adapter: `apps/server/src/lib/storage/`.
- Document records, access checks, and processing: `apps/server/src/modules/project/documents/`.

**Caching:**
- Redis via `ioredis`, configured by `REDIS_URL`.
- Used in project/auth/RBAC and schedule-metrics paths. PostgreSQL remains authoritative.

## Authentication & Identity

**Auth Provider:**
- Application-managed JWT/session authentication with optional Google OAuth.
  - Implementation: `apps/server/src/modules/auth/`, `apps/server/src/modules/rbac/`, and organization/project middleware.

## Monitoring & Observability

**Error Tracking:**
- No dedicated SaaS error-tracking integration detected.
- OpenTelemetry traces, metrics, and logs are exported over OTLP; local collector and ClickHouse configuration live under `infra/docker/otel-collector/` and `infra/docker/clickhouse/`.

**Logs:**
- Pino logger and OpenTelemetry bootstrap in `packages/observability/src/server/`.
- Environment: `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`.

## CI/CD & Deployment

**Hosting:**
- No specific cloud hosting provider detected in repository configuration.
- Docker-based local dependencies are described in `docker-compose.yml`.

**CI Pipeline:**
- No GitHub Actions workflow or other CI pipeline file detected under `.github/`.

## Environment Configuration

**Required env vars:**
- Validated defaults/requirements are defined in `packages/env/src/server.ts`.
- Principal integrations use `DATABASE_URL`, `REDIS_URL`, MinIO variables, OTLP variables, SMTP variables, and Google OAuth variables.

**Secrets location:**
- Runtime environment variables; `.env` is local and must not be inspected or committed.
- `.env.example` is the safe configuration reference.

## Webhooks & Callbacks

**Incoming:**
- Google OAuth callback route is registered by the auth module.
- No external webhook receiver was identified.

**Outgoing:**
- Email is sent through SMTP; application events are queued through PostgreSQL outbox/PgBoss.
- No third-party webhook delivery integration was identified.

---

*Integration audit: 2026-10-07*
