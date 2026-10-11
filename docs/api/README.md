# SiteFlow API: Frontend Integration Docs

Index of frontend integration guides. Each guide follows the API Integration Engineering Standard (scope, flow, contract, business rules, frontend guidance, files, verification, gaps, compatibility).

## Documents

| Guide | Modules covered | Status |
|---|---|---|
| [billing-integration.md](./billing-integration.md) | billing: checkout, portal, trial, lifecycle, invoices, webhooks | Complete (11 endpoints) |
| [project-module.md](./project-module.md) | project core, tasks, schedule, baselines, field logs, issues, subcontractors, procurement chain, inventory, performance, change orders, commercial and financial summary, retainage | Summary depth. Route and permission inventory verified; field schemas referenced, not inlined |
| [platform-modules.md](./platform-modules.md) | organization, profile, settings, sequences, membership, invitations, suppliers, materials, reporting, exports, health | Summary depth. Route and permission inventory verified |

| [remaining-modules.md](./remaining-modules.md) | auth, audit, compliance, documents, submittals, RFIs, safety, quality, payment applications, invoice payments, retainage | Summary depth. Route, method, and permission inventory verified. Workflow state machines and some action segments not verified (listed in its Known gaps) |

## Module coverage gap

Coverage is now complete at route-inventory depth. Field schemas and per-module state machines are still open: see the Known gaps section of each guide.

## Conventions

- Base path: `/api/v1`. Organization scope: `/api/v1/organizations/:organizationId/...`.
- Auth: `authenticate` then `organizationContext` then `requirePermission` / `requireProjectPermission`.
- Validation: Zod schemas in `packages/shared/src/modules/<module>/` for billing and selected modules, and Fastify JSON-schema `*SchemaDoc` blocks in each route module.
