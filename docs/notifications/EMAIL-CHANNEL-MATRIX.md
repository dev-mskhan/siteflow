# Email Preference and Channel Matrix

Security and authentication emails are transactional and cannot be disabled by
notification preferences. Other email notifications must be checked by the
notification preference service before delivery.

| Email type | Producer / consumer | Preference key | Honors opt-out | Rationale |
|---|---|---|---:|---|
| Email verification | `modules/auth/auth.worker.ts` | None | No | Required to verify account ownership |
| Password reset | `modules/auth/auth.worker.ts` | None | No | User-initiated account recovery |
| Password changed | `modules/auth/auth.worker.ts` | None | No | Security alert |
| New login | `modules/auth/auth.worker.ts` | None | No | Security alert |
| Account suspended/reactivated | `modules/platform/platform-account-notice.worker.ts` | None | No | Account-security notice; email-only by product decision |
| Organization invitation | `modules/invitation/invitation.worker.ts` | None | No | Required invitation workflow; recipient may not yet be a member |
| Billing grace reminder | `modules/billing/lifecycle.service.ts` | `billing.grace_reminder` / `EMAIL` | Yes | Billing notification preferences; suppressed delivery is persisted |
| Notification-module email | `modules/notification/email/email.worker.ts` | Event-specific preference | Yes | Worker checks recipient preference before sending and records opted-out notifications as `CANCELLED` |
| Organization suspended/reactivated notice | `modules/notification/event-notification.worker.ts` via email worker | Event-specific preference | Yes | Delivered to organization owner and active admins |

| In-app/realtime event | Persisted channel | Realtime channel | Recipient scope |
|---|---|---|---|
| `platform.organization.suspended`, `platform.organization.reactivated` | `IN_APP` | `REALTIME` | Organization owner and active admins |
| `billing.subscription.status_changed`, `billing.entitlement.changed`, `billing.grace.started`, `billing.grace.ended` | `IN_APP` | `REALTIME` | Organization owner and active admins |
| `rfi.responded`, `submittal.reviewed` | `IN_APP` | `REALTIME` | Active members of the event's project |

The email worker persists delivery outcomes and rethrows send failures so PgBoss
can retry. Account and authentication notices intentionally bypass opt-out;
the billing grace reminder path uses the durable reminder-delivery records and
preference gate rather than sending directly from the lifecycle transition.
