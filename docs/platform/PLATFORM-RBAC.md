# Platform Route Guard and Schema Map

Platform routes use platform-role permissions only. Tenant RBAC is not used for
platform endpoints, and platform roles do not grant access to tenant routes.
Authentication is applied before the listed permission hook.

| Route | Guard family | Required platform permission | OpenAPI schema |
|---|---|---|---|
| `GET /organizations` | Platform | `read:organizations` | `listPlatformOrganizationsSchemaDoc` |
| `GET /accounts` | Platform | `read:organizations` | `listPlatformAccountsSchemaDoc` |
| `GET /organizations/:orgId/billing` | Platform | `read:billing` | `organizationBillingSchemaDoc` |
| `GET /billing/webhook-inbox` | Platform | `read:billing` | `webhookInboxSchemaDoc` |
| `POST /billing/webhook-recovery` | Platform | `write:billing_sync` | `webhookRecoverySchemaDoc` |
| `GET /diagnostics/health` | Platform | `read:diagnostics` | `diagnosticsHealthSchemaDoc` |
| `GET /diagnostics/queue` | Platform | `read:diagnostics` | `diagnosticsQueueSchemaDoc` |
| `GET /organizations/:orgId/diagnostics` | Platform | `read:diagnostics` | `diagnosticsOrganizationSchemaDoc` |
| `POST /diagnostics/outbox/:eventId/replay` | Platform | `write:outbox_replay` | `outboxReplaySchemaDoc` |
| `POST /accounts/:userId/suspend` | Platform | `write:organization_lifecycle` | `accountLifecycleSchemaDoc('suspend')` |
| `POST /accounts/:userId/reactivate` | Platform | `write:organization_lifecycle` | `accountLifecycleSchemaDoc('reactivate')` |
| `POST /organizations/:orgId/suspension-requests` | Platform | `write:organization_lifecycle` | `requestOrgSuspensionSchemaDoc` |
| `POST /approvals/:approvalId/approve` | Platform | `write:organization_lifecycle` | `approveOrgSuspensionSchemaDoc` |
| `POST /organizations/:orgId/reactivate` | Platform | `write:organization_lifecycle` | `reactivateOrgSchemaDoc` |
| `POST /support-grants` | Platform | `manage:support_grants` | `requestSupportGrantSchemaDoc` |
| `POST /support-grants/:grantId/approve` | Platform | `manage:support_grants` | `approveSupportGrantSchemaDoc` |
| `POST /support-grants/:grantId/revoke` | Platform | `manage:support_grants` | `revokeSupportGrantSchemaDoc` |
| `GET /support-grants/:grantId/organization` | Platform | `use:support_grant` | `useSupportGrantSchemaDoc` |

Every declared route in `platform.routes.ts` has exactly one platform permission
hook and a route-level schema. The schema declarations live in
`modules/platform/docs/platform.schemas.ts`; update this table alongside route
or permission changes.
