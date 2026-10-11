# SiteFlow API: Frontend Integration Docs

Index of frontend integration guides. Each guide follows the API Integration Engineering Standard (scope, flow, contract, business rules, frontend guidance, files, verification, gaps, compatibility).

## Documents

| Guide | Modules covered | Status |
|---|---|---|
| [billing-integration.md](./billing-integration.md) | billing: checkout, portal, trial, lifecycle, invoices, webhooks | Complete (11 endpoints) |
| [project-module.md](./project-module.md) | project core, tasks, schedule, baselines, field logs, issues, subcontractors, procurement chain, inventory, performance, change orders, commercial and financial summary, retainage | Summary depth. Route and permission inventory verified; field schemas referenced, not inlined |
| [platform-modules.md](./platform-modules.md) | organization, profile, settings, sequences, membership, invitations, suppliers, materials, reporting, exports, health | Summary depth. Route and permission inventory verified |

## Module coverage gap

These route modules exist under `apps/server/src/modules/` but have no integration guide yet:

- auth (register, login, Google OAuth, refresh, email verification, password reset, sessions, logout)
- audit (audit log listing)
- project/compliance, project/documents, project/submittal, project/rfi, project/safety, project/quality
- project/payment-application, project/invoice-payment
- project/retainage (in project-module.md, shallow)

Next step: add guides for these modules at the same depth, verifying the HTTP method and permission for each route against the source.

## Conventions

- Base path: `/api/v1`. Organization scope: `/api/v1/organizations/:organizationId/...`.
- Auth: `authenticate` then `organizationContext` then `requirePermission` / `requireProjectPermission`.
- Validation: Zod schemas in `packages/shared/src/modules/<module>/` for billing and selected modules, and Fastify JSON-schema `*SchemaDoc` blocks in each route module.
