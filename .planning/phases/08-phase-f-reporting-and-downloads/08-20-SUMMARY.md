# 08-20 SUMMARY — F.17B Export Lifecycle, Workers, and Storage

## Status: ✅ COMPLETE

## What Was Built
- **`report-export.schema.ts`**: PostgreSQL table `app.report_exports` storing tenant scope, requester, report type, format, filter snapshot, status, internal MinIO object key, expiry (24h default).
- **`export.repository.ts`**: Tenant-scoped Drizzle queries for creating, finding, listing, status transitions, and finding expired records.
- **`export.service.ts`**: Sync/async threshold execution (~100ms), owner validation, fresh 5-minute presigned download URLs, and idempotent expired object cleanup.
- **`export.routes.ts`**: Authenticated Fastify routes:
  - `POST /api/v1/organizations/:organizationId/exports`
  - `GET /api/v1/organizations/:organizationId/exports`
  - `GET /api/v1/organizations/:organizationId/exports/:exportId`
  - `GET /api/v1/organizations/:organizationId/exports/:exportId/download`
- **`export.jobs.ts` & `export.worker.ts`**: PgBoss background worker for heavy export generation and scheduled daily cleanup. Registered in `apps/server/src/worker.ts`.

## Verification
- `apps/server/tests/integration/reporting/export-lifecycle.test.ts`: **6/6 tests passing**
  - POST /exports creates record and responds 202
  - GET /exports lists only authenticated user's exports
  - GET /exports/:id returns status and hides raw object key
  - GET /exports/:id/download produces valid 5-minute presigned download URL
  - Cross-tenant negative boundaries verified (403/404)
  - Idempotent cleanup of expired objects verified
