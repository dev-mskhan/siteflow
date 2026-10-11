# SiteFlow API: Remaining Modules (Frontend Integration)

Scope: auth, audit, and project modules not covered in `project-module.md`: compliance, documents, submittals, RFIs, safety, quality, payment applications, invoice payments, and retainage.

Standard applied: [API Integration Engineering Standard](./README.md). Summary depth: every route is listed with method, path, and permission, verified against route source. Field-level schemas are referenced by `*SchemaDoc` / Zod names, not inlined.

## 1. Scope

- Route files: `apps/server/src/modules/auth/auth.routes.ts`, `audit/audit.routes.ts`, `project/{compliance,documents,submittal,rfi,safety,quality,payment-application,invoice-payment,retainage}/*.routes.ts`.
- Registration: `apps/server/src/app/index.ts` lines 180-202.

## 2. Integration flow

- Auth routes are mounted at `/api/v1/auth`. Public routes need no token. Protected routes need `authenticate`.
- Org-scoped routes mount under `/api/v1/organizations`, then `organizationContext`.
- Project-scoped routes add `projectContext` and `requireProjectPermission('<capability>')`.
- Full URL pattern for project modules: `/api/v1/organizations/:organizationId/projects/:projectId/<resource>`.

## 3. Contract

### Auth (`/api/v1/auth`)

| Method | Path | Auth | Schema |
|---|---|---|---|
| POST | `/register` | none | `registerSchema` |
| POST | `/login` | none | `loginSchema` |
| GET | `/google` | none | `googleAuthSchema` |
| GET | `/google/callback` | none | `googleCallbackSchema` |
| POST | `/refresh` | none | `refreshSchema` |
| POST | `/verify-email` | none | `verifyEmailSchema` |
| POST | `/resend-verification` | none | `resendVerificationSchema` |
| POST | `/forgot-password` | none | `forgotPasswordSchema` |
| POST | `/reset-password` | none | `resetPasswordSchema` |
| POST | `/logout` | authenticate | `logoutSchema` |
| POST | `/change-password` | authenticate | `changePasswordSchema` |
| GET | `/me` | authenticate | `getMeSchema` |
| GET | `/sessions` | authenticate | `getSessionsSchema` |
| DELETE | `/sessions/:sessionId` | authenticate | `deleteSessionSchema` |
| POST | `/logout-all` | authenticate | `logoutAllSchema` |

### Audit

| Method | Path | Permission |
|---|---|---|
| GET | `/api/v1/organizations/:organizationId/audit-logs` | `audit:read` |

### Compliance (`/projects/:projectId`)

Three entities share one route factory: permits (`/permits`), compliance inspections (`/compliance-inspections`), and compliance records (`/compliance-records`).

| Method | Path | Permission |
|---|---|---|
| POST | `/permits`, `/compliance-inspections`, `/compliance-records` | `project.permit.manage` / `project.compliance_inspection.manage` / `project.compliance_record.manage` |
| GET | same collections | `<cap>.read` (`project.permit.read`, `project.compliance_inspection.read`, `project.compliance_record.read`) |
| GET | `/<collection>/:id` | `<cap>.read` |
| PATCH | `/<collection>/:id` | `<cap>.manage` |
| DELETE | `/<collection>/:id` | `<cap>.manage` |
| POST | `/<collection>/:id/documents` | `<cap>.manage` |
| POST | `/permits/:permitId/transition` | `project.permit.manage` |
| POST | `/compliance-inspections/:inspectionId/complete` | `project.compliance_inspection.manage` |
| POST | `/compliance-records/:recordId/verify` | `project.compliance_record.manage` |
| GET | `/expiring` | `project.compliance_record.read` |

### Documents (`/projects/:projectId/documents`)

| Method | Path | Permission |
|---|---|---|
| POST | `/documents` | `project.document.upload` |
| POST | `/documents/:documentId/complete` | `project.document.upload` |
| GET | `/documents` | `project.document.download` |
| GET | `/documents/:documentId` | `project.document.download` |
| GET | `/documents/:documentId/download` | `project.document.download` |
| PATCH | `/documents/:documentId` | `project.document.manage` |
| DELETE | `/documents/:documentId` | `project.document.manage` |
| POST | `/documents/:documentId/versions` | `project.document.version` |
| POST | `/documents/:documentId/versions/:versionId/complete` | `project.document.version` |
| GET | `/documents/:documentId/versions` | `project.document.download` |

### Submittals (`/projects/:projectId/submittals`)

| Method | Path | Permission |
|---|---|---|
| POST | `/submittals` | `project.submittal.create` |
| GET | `/submittals` | `project.submittal.read` |
| GET | `/submittals/:submittalId` | `project.submittal.read` |
| PATCH | `/submittals/:submittalId` | `project.submittal.create` |
| POST | `/submittals/:submittalId/submit` | `project.submittal.create` |
| POST | `/submittals/:submittalId/review` | `project.submittal.review` |
| POST | `/submittals/:submittalId/resubmit` | `project.submittal.create` |
| POST | `/submittals/:submittalId/close` | `project.submittal.manage` |
| GET | `/submittals/:submittalId/revisions` | `project.submittal.read` |
| GET | `/submittals/:submittalId/revisions/:revisionId` | `project.submittal.read` |
| POST | `/submittals/:submittalId/documents` | `project.submittal.create` |

### RFIs (`/projects/:projectId/rfis`)

| Method | Path | Permission |
|---|---|---|
| POST | `/rfis` | `project.rfi.create` |
| GET | `/rfis` | `project.rfi.read` |
| GET | `/rfis/:rfiId` | `project.rfi.read` |
| PATCH | `/rfis/:rfiId` | `project.rfi.create` |
| POST | `/rfis/:rfiId/submit` | `project.rfi.create` |
| POST | `/rfis/:rfiId/respond` | `project.rfi.respond` |
| POST | `/rfis/:rfiId/close` | `project.rfi.manage` |
| POST | `/rfis/:rfiId/cancel` | `project.rfi.manage` |
| POST | `/rfis/:rfiId/documents` | `project.rfi.create` |

### Safety (`/projects/:projectId`)

| Method | Path | Permission |
|---|---|---|
| POST | `/safety-events` | `project.safety.report` |
| GET | `/safety-events` | `project.safety.read` |
| GET | `/safety-events/:eventId` | `project.safety.read` |
| PATCH | `/safety-events/:eventId` | `project.safety.manage` |
| POST | `/safety-events/:eventId/investigate` | `project.safety.investigate` |
| POST | `/safety-events/:eventId/close` | `project.safety.manage` |
| POST | `/safety-events/:eventId/corrective-actions` | `project.safety.manage` |
| POST | `/safety-events/:eventId/documents` | `project.safety.manage` |
| POST | `/safety-meetings` | `project.safety.manage` |
| GET | `/safety-meetings` | `project.safety.read` |
| GET | `/safety-meetings/:meetingId` | `project.safety.read` |

### Quality (`/projects/:projectId`)

Generated for `quality-inspections`, `quality-deficiencies`, and `corrective-actions`, plus action routes.

| Method | Path | Permission |
|---|---|---|
| POST / GET | `/quality-inspections`, `/quality-deficiencies`, `/corrective-actions` | `project.quality.inspect` / `project.quality.manage_deficiency` (create); `project.quality.read` (list) |
| GET | `/<collection>/:id` | `project.quality.read` |
| PATCH | `/quality-inspections/:inspectionId` | `project.quality.inspect` |
| PATCH | `/quality-deficiencies/:deficiencyId` | `project.quality.manage_deficiency` |
| PATCH | `/corrective-actions/:actionId` | `project.quality.manage_deficiency` |
| POST | `/quality-inspections/:inspectionId/start` | `project.quality.inspect` |
| POST | `/quality-inspections/:inspectionId/complete` | `project.quality.inspect` |
| POST | `/quality-inspections/:inspectionId/documents` | `project.quality.inspect` |
| POST | `/quality-deficiencies/:deficiencyId/resolve` | `project.quality.manage_deficiency` |
| POST | `/quality-deficiencies/:deficiencyId/close` | `project.quality.manage_deficiency` |
| POST | `/quality-deficiencies/:deficiencyId/documents` | `project.quality.manage_deficiency` |
| POST | `/corrective-actions/:actionId/complete` | `project.quality.manage_deficiency` |
| POST | `/corrective-actions/:actionId/verify` | `project.quality.verify_corrective` |

### Payment applications (`/projects/:projectId/payment-applications`)

| Method | Path | Permission |
|---|---|---|
| POST | `` | `project.payment_application.create` |
| GET | `` | `project.payment_application.read` |
| GET | `/:paymentApplicationId` | `project.payment_application.read` |
| PATCH | `/:paymentApplicationId` | `project.payment_application.update` |
| POST | `/:paymentApplicationId/submit` | `project.payment_application.submit` |
| POST | `/:paymentApplicationId/under-review` | `project.payment_application.review` |
| POST | `/:paymentApplicationId/approve` | `project.payment_application.approve` |
| POST | `/:paymentApplicationId/reject` | `project.payment_application.approve` |
| POST | `/:paymentApplicationId/void` | `project.payment_application.void` |

### Invoice payments

Invoices at `/projects/:projectId/invoices`, payments at `/projects/:projectId/payments`.

| Method | Path | Permission |
|---|---|---|
| POST | `/invoices` | `project.invoice.create` |
| GET | `/invoices` | `project.invoice.read` |
| GET | `/invoices/:invoiceId` | `project.invoice.read` |
| PATCH | `/invoices/:invoiceId` | `project.invoice.update` |
| POST | `/invoices/:invoiceId/<action>` | per-action permission (see Known gaps) |
| POST | `/invoices/:invoiceId/payments` | `project.payment.create` |
| GET | `/payments` | `project.payment.read` |
| GET | `/payments/:paymentId` | `project.payment.read` |
| POST | `/payments/:paymentId/<action>` | per-action permission (see Known gaps) |

### Retainage (`/projects/:projectId/retainage`)

| Method | Path | Permission |
|---|---|---|
| GET | `/retainage` | `project.retainage.read` |
| POST | `/payment-applications/:paymentApplicationId/retainage/hold` | `project.retainage.hold` |
| GET | `/retainage/:retainageId/releases` (list releases) | `project.retainage.read` |
| POST | `/retainage/:retainageId/release` | `project.retainage.release` |

## 4. Business rules

- Workflow actions are separate routes with separate permissions, so the frontend should call the named action route rather than PATCH a status field. The exact state machine per module (allowed transitions, preconditions) is NOT verified in this pass. Read each module's service file before documenting transitions.
- Project creation and modification remain blocked under billing restriction (see `project-module.md`).

## 5. Frontend guidance

- Permissions gate UI actions. Hide actions the user lacks the capability for. Confirm where the capability list is returned before wiring this up (not verified here).
- After any action route, refetch the resource with its `:id` GET before showing the next state.
- Document upload is a two-step flow by route shape: create/version route, then `complete`. Confirm the upload mechanics in the service before relying on it.
- Auth: refresh-token behaviour on 401 is not verified here. See `apps/server/src/modules/auth` before implementing a retry.

## 6. Files changed

- `docs/api/remaining-modules.md` (this file).
- `docs/api/README.md` (index updated).

## 7. Verification

- Method, path, and permission for every route listed above were read from source in `apps/server/src/modules/...` on this commit.
- Not run: no contract tests, no typecheck, and no requests against a live server for these modules in this pass.

## 8. Known gaps

- Invoice and payment `<action>` segments are dynamic (`${action}`). Exact values and per-action permissions are not enumerated here. Read `invoice-payment.routes.ts` around lines 110-125 and 175-190 before documenting them.
- Payment application: the `reject` route's permission is `project.payment_application.approve`, same as approve. Confirm this is intended.
- Documents, submittals, and RFI field schemas are not inlined. Refer to each module's `*SchemaDoc` / Zod file.
- Compliance entity routing uses a ternary for path parameter names (`permitId`, `inspectionId`, `recordId`). Confirm names from the source before SDK generation.
- Auth response shapes, token lifetimes, and error codes are not documented here.

## 9. Compatibility impact

- None. These are documentation additions only. No route, schema, or permission changed.
