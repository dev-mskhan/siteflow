# Phase 11-07 Operational Notes

## Migrations in Phase 11

Apply in order to both `siteflow` and `siteflow_test`:

| Migration | File                                           | Plan  |
|-----------|------------------------------------------------|-------|
| 0050      | `0050_platform_rbac.sql`                       | 11-01 |
| 0051      | `0051_platform_admin_and_approvals.sql`        | 11-02 |
| 0052      | `0052_platform_idempotency_and_slug_index.sql` | 11-03 |
| 0053      | `0053_platform_billing_sync.sql`               | 11-04 |
| 0054      | `0054_platform_support_grants.sql`             | 11-05 |
| 0055      | `0055_platform_support_grants_expired.sql`     | 11-05 |
| 0056      | `0056_platform_diagnostics_permission.sql`     | 11-06 |

Plan column is from the phase execution record; verify against plan frontmatter if it matters for audit.

Note: `_journal.json` does not list migrations past 0039. Apply each new migration manually to both databases.

## Rollback

1. Stop the API workers (`worker.ts`) before schema rollback.
2. Revert the application commit range for the phase (`git revert` of the 11-0x commits).
3. Drop only the additive objects introduced by the migration being rolled back (new tables/columns). Do not drop shared tables.
4. Re-run the server integration suite against `siteflow_test` to confirm.

## Recovery

- Queue backlog: use the platform queue dashboard (`GET /api/v1/platform/diagnostics/queue`) to read waiting/active counts and the oldest waiting job age.
- Webhook quarantine: `QUARANTINED` rows in `app.saas_webhook_inbox` are replayed through the Stripe webhook route after the cause is fixed.
- A 403 on platform routes usually means the admin role or migration was not applied to the database the server is using.

## Queue query optimization (11-07)

`pgboss.job` is partitioned per queue (about 124 partitions). Planning cost scales with the partition count, so the queue diagnostics now:

- Read waiting count, active count, and oldest waiting job age in one scan (`MIN(start_after) FILTER (...)` with `now() AS observedAt`). Age is computed in JS.
- Run the webhook inbox summary in parallel with `Promise.all`.

Measured on `siteflow_test` with 20 orgs and 40 samples:

| Endpoint                   | p95 (ms) | Threshold |
|----------------------------|----------|-----------|
| organization search        | 59.1     | < 300     |
| organization billing       | 43.3     | < 300     |
| queue dashboard            | 203.9    | < 300     |
| org audit-log history      | 90.0     | < 300     |

Queue p95 varied between runs (56.8 ms and 203.9 ms). All runs are under the threshold. Planning overhead is the main variance source.

## Deferred: platform-wide audit history

There is no platform-wide audit-history endpoint. The measured path is the org-scoped route `GET /api/v1/organizations/:organizationId/audit-logs` (`audit:read`).

Reason for deferral: a platform endpoint would expose cross-tenant audit data and needs its own policy decision (scope, retention, and access). Adding it is out of scope for 11-07. It should be tracked as a follow-up.

## Known pre-existing issues (not introduced by 11-07)

- Integration test `task3_rbac_tenant_isolation` fails on the baseline branch.
- Seven lint errors exist in the repository outside the 11-07 files.
