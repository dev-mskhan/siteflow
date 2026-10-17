# Event and Queue Consumer Catalog

This catalog records the producer-to-PgBoss path visible in the server source. It distinguishes
transactional outbox events from direct/scheduled jobs because `OutboxService` sends an outbox
row to a PgBoss queue named exactly as `eventType`; a registered consumer must subscribe to that
same name. The legacy `EventDispatcher` is disabled and is not a consumer.
Paths in the tables are relative to `apps/server/src`.

## Registered queue consumers

| Queue/event type | Producer or trigger | Tenant scoped | Consumer | Current effect |
|---|---|---:|---|---|
| `auth:send-email-verification` | `modules/auth/auth.repository.ts` | No | `modules/auth/auth.worker.ts` | Sends verification email |
| `auth:send-password-reset` | `modules/auth/auth.repository.ts` | No | `modules/auth/auth.worker.ts` | Sends password-reset email |
| `auth:send-password-changed-notification` | `modules/auth/auth.repository.ts` | No | `modules/auth/auth.worker.ts` | Sends password-changed notification |
| `auth:send-new-login-notification` | `modules/auth/auth.service.ts` | No | `modules/auth/auth.worker.ts` | Sends new-login notification |
| `auth:cleanup-expired-sessions` | Daily schedule in `worker-registration.ts` | No | `modules/auth/auth.worker.ts` | Deletes expired sessions |
| `auth:cleanup-expired-verification-tokens` | Daily schedule in `worker-registration.ts` | No | `modules/auth/auth.worker.ts` | Deletes expired verification tokens |
| `auth:cleanup-expired-password-reset-tokens` | Daily schedule in `worker-registration.ts` | No | `modules/auth/auth.worker.ts` | Deletes expired password-reset tokens |
| `org:send-invitation-email` | `modules/invitation/invitation.service.ts` | Yes | `modules/invitation/invitation.worker.ts` | Sends pending invitation email |
| `org:expire-invitations` | Hourly schedule in `worker-registration.ts` | No | `modules/invitation/invitation.worker.ts` | Expires overdue invitations and audits |
| `project:created` | `modules/project/core/project.service.ts` | Yes | `modules/project/core/project.worker.ts` | Records/traces project creation |
| `project:updated` | `modules/project/core/project.service.ts` | Yes | `modules/project/core/project.worker.ts` | Records/traces project update |
| `project:status_changed` | `modules/project/core/project.lifecycle.service.ts` | Yes | `modules/project/core/project.worker.ts` | Records/traces status transition |
| `project:member_added` | `modules/project/members/project-member.service.ts` | Yes | `modules/project/core/project.worker.ts` | Records/traces member addition |
| `project:member_role_changed` | `modules/project/members/project-member.service.ts` | Yes | `modules/project/core/project.worker.ts` | Records/traces member-role change |
| `project:member_removed` | `modules/project/members/project-member.service.ts` | Yes | `modules/project/core/project.worker.ts` | Records/traces member removal |
| `schedule:recalculate` | `modules/project/engine/schedule.service.ts` | Yes | `modules/project/engine/schedule.worker.ts` | Recalculates schedules and records failures |
| `schedule:recalculated_event` | `modules/project/engine/schedule.worker.ts` | Yes | `modules/project/engine/schedule.worker.ts` | Materializes metrics and refreshes cache |
| `compliance:scan-expiry` | Daily schedule in `modules/project/compliance/expiry-scanner.worker.ts` | No | `modules/project/compliance/expiry-scanner.worker.ts` | Scans and emits expiry events |
| `reporting:export:generate` | `modules/reporting/exports/export.service.ts` | Yes | `modules/reporting/exports/export.worker.ts` | Generates and stores CSV exports |
| `reporting:export:cleanup` | Daily schedule in `modules/reporting/exports/export.worker.ts` | No | `modules/reporting/exports/export.worker.ts` | Removes expired exports |
| `billing:stripe-webhook-recovery` | Webhook inbox recovery service, startup recovery, and one-minute schedule | No | `modules/billing/webhook.worker.ts` | Reconciles, retries, or quarantines Stripe events |
| `billing:grace-reminder-dispatch` | One-minute schedule in `modules/billing/lifecycle.worker.ts` | Yes | `modules/billing/lifecycle.worker.ts` | Dispatches due tenant-scoped grace reminders |
| `ai:agent-run` | `modules/ai/runs/agent-run.service.ts` and approval resume | Yes | `modules/ai/workers/agent-run.worker.ts` | Executes/resumes agent runs and persists outcome |
| `platform.organization.suspended` | `modules/platform/platform-lifecycle.service.ts` | Yes | `modules/notification/event-notification.worker.ts` | Owner/admin email, persisted in-app notice, preference-gated SSE |
| `platform.organization.reactivated` | `modules/platform/platform-lifecycle.service.ts` | Yes | `modules/notification/event-notification.worker.ts` | Owner/admin email, persisted in-app notice, preference-gated SSE |
| `billing.subscription.status_changed` | `modules/billing/provider-reconciler.ts` | Yes | `modules/notification/event-notification.worker.ts` | Owner/admin in-app notice and preference-gated SSE |
| `billing.entitlement.changed` | `modules/billing/provider-reconciler.ts` | Yes | `modules/notification/event-notification.worker.ts` | Owner/admin in-app notice and preference-gated SSE |
| `billing.grace.started`, `billing.grace.ended` | `modules/billing/provider-reconciler.ts` | Yes | `modules/notification/event-notification.worker.ts` | Owner/admin in-app notice and preference-gated SSE |
| `rfi.responded` | `modules/project/rfi/rfi.service.ts` | Yes | `modules/notification/event-notification.worker.ts` | Project-member in-app notice and preference-gated SSE |
| `submittal.reviewed` | `modules/project/submittal/submittal.service.ts` | Yes | `modules/notification/event-notification.worker.ts` | Project-member in-app notice and preference-gated SSE |

## Outbox event types without a registered consumer

For these types, the outbox currently targets a queue with the same name, but no matching
`boss.work`/`registerWorker` subscription was found. “Audit-only planned” records the intended
disposition from the hardening plan; until the dispatcher skips these queue sends, they are still
published as jobs.

| Event type(s) | Producer | Tenant scoped | Queue | Consumer | Disposition |
|---|---|---:|---|---|---|
| `platform.account.suspended`, `platform.account.reactivated` | `modules/platform/platform-lifecycle.service.ts` | No | `modules/platform/platform-account-notice.worker.ts` (email only, bypasses opt-out) | Email to user | Done by selected email-only design |
| `platform.organization.suspension_requested` | `modules/platform/platform-lifecycle.service.ts` | Yes | Same as event type | NONE | Audit-only; validated and marked PROCESSED without queue publish |
| `platform.support_grant.requested`, `.approved`, `.revoked`, `.used`, `.use_denied` | `modules/platform/platform-support-grant.service.ts` | Yes | Same as event type | NONE | Audit-only; validated and marked PROCESSED without queue publish |
| `platform.billing.webhook_recovery_requested` | `modules/platform/platform-billing.service.ts` | No | Same as event type | NONE | Audit-only; validated and marked PROCESSED without queue publish; recovery runs in the request |
| `schedule:baseline_activated`, `field_log:locked` | `modules/project/engine/schedule.jobs.ts` | Yes | Same as event type | NONE | No consumer registered |
| `email:send`, `resource:export` | Queue constants in `lib/queue/queue.ts` | No | Same as event type | NONE | No producer/consumer path verified; confirm before use |
| `commercial.*` events (invoice, payment, payment application, change order, schedule of values) | Corresponding `modules/project/{invoice-payment,payment-application,change-order,schedule-of-values}` services | Yes | Same as event type | NONE | No consumer registered |
| `procurement.*` events (committed cost, delivery, inventory, material request, approval, purchase order, quote, subcontractor, receipt) | Corresponding `modules/project/{committed-cost,delivery,inventory,material-request,procurement-approval,purchase-order,quote,subcontractor}` services | Yes | Same as event type | NONE | No consumer registered |
| `rfi.*`, `submittal.*` events | `modules/project/rfi/rfi.service.ts`, `modules/project/submittal/submittal.service.ts` | Yes | Same as event type | NONE | No consumer registered |
| `quality.*`, `safety.*` events | `modules/project/quality/quality.service.ts`, `modules/project/safety/safety.service.ts` | Yes | Same as event type | NONE | No consumer registered |
| `compliance_record.*`, `permit.*`, `compliance_inspection.*`, `document.expiring`, `permit.expiring`, `compliance_record.expiring` | `modules/project/compliance/{compliance,expiry-scanner}.service.ts` | Yes | Same as event type | NONE | No consumer registered |

The dotted project event families above include concrete types such as
`rfi.responded`, `submittal.reviewed`, `commercial.change_order.effected`,
`procurement.receipt.posted`, and `safety.incident_reported`. Some transition events use
status-derived suffixes; the producer service is the source of truth for their concrete values.
These event families must be assigned an explicit notification, audit-only, or other disposition
before adding consumers.

## Document processing queues

| Queue/event type | Producer | Tenant scoped | Consumer | Current effect |
|---|---|---:|---|---|
| `document.uploaded` | `modules/project/documents/document.service.ts` | Yes | `modules/project/documents/document.worker.ts`, started by `apps/server/src/document-worker.ts` | Processes the uploaded version |
| `document.version_created` | `modules/project/documents/document.service.ts` | Yes | `modules/project/documents/document.worker.ts`, started by `apps/server/src/document-worker.ts` | Processes the new version |

Document workers are registered by the dedicated `document-worker` process, not by
`worker-registration.ts`'s general `registerWorkers()` function.

## Schema-supported domain envelope names

`packages/shared/src/events/domain-event.schema.ts` accepts the following names in the versioned
domain envelope. No direct `writeOutboxEvent` producer for these envelope names was found in the
current server source, and the legacy event dispatcher throws rather than dispatching them.

`TaskCompleted`, `TaskDelayed`, `TaskDateChanged`, `MaterialOrdered`, `MaterialDelayed`,
`MaterialDelivered`, `IssueCreated`, `IssueResolved`, `RfiCreated`, `RfiOverdue`,
`SubmittalSubmitted`, `SubmittalRejected`, `InspectionScheduled`, `InspectionFailed`,
`ChangeOrderCreated`, `ChangeOrderApproved`, `PaymentApplicationSubmitted`, `PaymentOverdue`,
`DocumentExpiring`, `SafetyIncidentCreated`.

## Sources and maintenance

- Queue declarations: `apps/server/src/lib/queue/queue.ts` and each module’s `*.jobs.ts`.
- Outbox validation and dispatch: `apps/server/src/lib/outbox/outbox.service.ts`.
- Consumer wiring: `apps/server/src/worker-registration.ts`; consumers are registered with
  `registerWorker` or `boss.work`.
- Outbox producer names: direct `writeOutboxEvent` call sites under
  `apps/server/src/modules/`.

When a queue or event changes, update this table and add or update a test for its tenant scope,
consumer side effect, and retry/idempotency behavior. P1-14 tracks expansion of dynamic event
families into a row for every concrete emitted event type.
