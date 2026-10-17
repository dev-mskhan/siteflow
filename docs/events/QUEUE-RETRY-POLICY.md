# PgBoss Retry and Dead-Letter Policy

All names in `Object.values(QUEUES)` are created with explicit queue options in
`apps/server/src/lib/queue/queue.ts`. The dynamic outbox notification event
queues are included in `QUEUES` through `NOTIFICATION_EVENT_QUEUES`.

| Queue group | Retry limit | Retry delay | Backoff | Expiration | Dead-letter queue |
|---|---:|---:|---:|---:|---|
| Auth, invitation, project, schedule, documents, compliance, platform, AI, export, billing, and notification queues (`QUEUES`) | 5 | 30 seconds | Exponential | 900 seconds | `<queue-name>.dlq` |
| Dead-letter queues | 0 | None | No | 900 seconds | None |

Outbox dispatch also uses the outbox event ID as PgBoss singleton identity when
the payload has no explicit idempotency key. The notification worker stores the
outbox ID with each delivery and the notifications table enforces uniqueness by
organization, recipient, event, and channel. Each queue consumer must preserve
its side-effect idempotency when retries are enabled.
