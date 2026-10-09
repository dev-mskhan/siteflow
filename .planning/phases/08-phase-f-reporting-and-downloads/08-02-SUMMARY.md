# Plan 08-02 Summary: F.1 Versioned Domain Event Contract

**Phase:** 08-phase-f-reporting-and-downloads  
**Plan:** 02  
**Status:** Complete  
**Date:** 2026-10-08  

## Deliverables Produced
- `packages/shared/src/events/domain-event.schema.ts`: Defined the versioned Domain Event Envelope schema (`DomainEventEnvelopeSchema`), supporting all 20 domain event names mapped in F.0 audit with mandatory `organizationId`, optional `projectId`, `actor`, `correlationId`, `causationId`, and payload validation.
- `packages/shared/src/index.ts`: Re-exported domain event schemas across `@siteflow/shared`.
- `apps/server/tests/integration/outbox/domain-event-contract.test.ts`: Integration test verifying schema validation, invalid tenant rejection, unsupported type handling, and real PostgreSQL transactional persistence under multi-tenant isolation.

## Verification Passed
- `pnpm --filter @siteflow/server test -- tests/integration/outbox/domain-event-contract.test.ts`: Passed (4/4 tests).
