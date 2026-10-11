# Platform Modules: Frontend API Integration Guide

Scope: organization, membership, invitations, settings, profile, document sequences, suppliers, materials, reporting, exports, and health. Routes come from `apps/server/src/modules/*/*.routes.ts`. Permission strings are verified against route code. Schemas are referenced by their `*SchemaDoc` name.

## 1. Scope

Tenant-level administration and shared catalogs. Organizations are the tenant boundary. Every scoped route is under `/api/v1/organizations/:organizationId/...`, except invitation accept, which is at `/api/v1/invitations/:token/accept`.

## 2. Integration Flow

1. `authenticate` validates the session.
2. Scoped routes run `organizationContext`, which resolves the caller's membership in `:organizationId`.
3. `requirePermission(...)` checks the caller's role permission.
4. The handler runs and returns the response.

Typical onboarding: `POST /organizations` (create), `GET /organizations/:organizationId/profile`, `PATCH .../settings`, `POST .../invitations` (invite members), then supplier and material setup.

## 3. Contract

### Organization and profile

| Method | Path | Permission |
|---|---|---|
| POST | `/api/v1/organizations` | authenticated (user scope) |
| GET | `/api/v1/organizations` | authenticated (user scope) |
| GET | `/:organizationId` | membership |
| PATCH | `/:organizationId` | `organization:update` |
| GET | `/:organizationId/profile` | `organization:read` |
| PATCH | `/:organizationId/profile` | `organization:update` |

### Membership and invitations

| Method | Path | Permission |
|---|---|---|
| GET | `/:organizationId/members` | `member:read` |
| GET | `/:organizationId/members/:memberId` | `member:read` |
| PATCH | `/:organizationId/members/:memberId` | `member:update` |
| DELETE | `/:organizationId/members/:memberId` | `member:remove` |
| POST | `/organizations/:organizationId/invitations` | `member:invite` |
| GET | `/organizations/:organizationId/invitations` | `member:read` |
| DELETE | `/organizations/:organizationId/invitations/:id` | `invitation:cancel` |
| POST | `/invitations/:token/accept` | authenticated |

### Settings and document sequences

| Method | Path | Permission |
|---|---|---|
| GET | `/:organizationId/settings` | `settings:read` |
| PATCH | `/:organizationId/settings` | `settings:update` |
| GET | `/:organizationId/document-sequences` | `settings:read` |
| GET | `/:organizationId/document-sequences/:type` | `settings:read` |
| PATCH | `/:organizationId/document-sequences/:type` | `settings:update` |

### Catalogs

| Method | Path | Permission |
|---|---|---|
| GET / POST | `/:organizationId/suppliers` | `supplier:read` / `supplier:create` |
| GET / PATCH | `/:organizationId/suppliers/:supplierId` | `supplier:read` / `supplier:update` |
| POST | `/:organizationId/suppliers/:supplierId/contacts` | `supplier:update` |
| PATCH | `/:organizationId/suppliers/:supplierId/contacts/:contactId` | `supplier:update` |
| GET / POST | `/:organizationId/materials` | `material:read` / `material:create` |
| GET / PATCH | `/:organizationId/materials/:materialId` | `material:read` / `material:update` |

### Reporting and exports

| Method | Path | Permission |
|---|---|---|
| GET | `/:organizationId/reports/portfolio` | `project:read` |
| GET | `/:organizationId/projects/:projectId/reports/{health,schedule,cost,procurement,subcontractor,executive-summary}` | `project:read` |
| POST | `/:organizationId/exports` | request export (body validated with Zod in the handler) |
| GET | `/:organizationId/exports` | list exports |
| GET | `/:organizationId/exports/:exportId` | export status |
| GET | `/:organizationId/exports/:exportId/download` | download |

### Health

| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/health` | none |
| GET | `/api/v1/health/ready` | none |

## 4. Business Rules

- Membership removal and role changes are server-enforced. Do not let the frontend decide the caller's own privileges.
- Invitations are single-use tokens. Accepting an invitation needs an authenticated user.
- Document sequences are per type. Updating a sequence changes the next number, so surface a warning before saving.
- Export requests are asynchronous. Poll status, then download only when status is complete.

## 5. Frontend Guidance

- Use the health endpoints for uptime checks, not for feature gating.
- After member or invite changes, refetch the members and invitations lists.
- Show 403 as "you do not have permission" and hide the action.
- For exports, show a pending state and poll `GET /exports/:exportId` until a terminal state.
- Do not cache a download URL beyond its expiry.

## 6. Files Changed

- `apps/server/src/modules/organization/organization.routes.ts`
- `apps/server/src/modules/organization/settings/settings.routes.ts`
- `apps/server/src/modules/organization/profile/profile.routes.ts`
- `apps/server/src/modules/organization/sequences/sequences.routes.ts`
- `apps/server/src/modules/membership/membership.routes.ts`
- `apps/server/src/modules/invitation/invitation.routes.ts`
- `apps/server/src/modules/supplier/supplier.routes.ts`
- `apps/server/src/modules/material/material.routes.ts`
- `apps/server/src/modules/reporting/report.routes.ts`
- `apps/server/src/modules/reporting/exports/export.routes.ts`
- `apps/server/src/modules/health/health.routes.ts`

## 7. Verification

- Route paths and permission strings: verified by reading the route files above.
- Not verified in this pass: request and response field types, error codes, and export expiry behavior. These need checking against the `*SchemaDoc` files and handlers.

## 8. Known Gaps

- The health route file lists `/` and `/ready`. Confirm the registered prefix in `apps/server/src/app/index.ts` before publishing the exact URL.
- The invitation accept route uses `authenticate` only. Confirm whether it also needs an email match check.
- Export download URL lifetime and format options are not documented.

## 9. Compatibility Impact

Documentation only. No API changes.
