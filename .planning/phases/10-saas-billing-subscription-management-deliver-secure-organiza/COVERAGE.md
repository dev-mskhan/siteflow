# API Coverage — Stripe

> Full coverage by default. Opt-outs are explicit, reasoned decisions. Phase 10 is backend-only; Stripe Dashboard is external operator configuration, not a SiteFlow frontend.

| capability | decision | reason |
|---|---|---|
| Stripe Customer creation and organization mapping | INTEGRATE | Create or retrieve customers only from authenticated organization context; persist a server-owned association and use it to map provider events to the tenant. |
| Hosted subscription Checkout | INTEGRATE | Resolve a locally approved catalog version and Stripe Price reference on the server. Redirects remain presentation-only and never grant paid access. |
| No-card organization trial | INTEGRATE | SiteFlow grants the approved 14-day trial once per organization without collecting a card or automatically converting it to a paid subscription. |
| Subscription creation and reconciliation | INTEGRATE | Explicit paid Checkout creates the recurring subscription from local catalog mapping; durable events and current-object reconciliation update local state under the one-current-subscription rule. |
| Subscription change and cancellation | INTEGRATE | SiteFlow-owned actions enforce approved lifecycle policy; Portal subscription mutation remains disabled. |
| Customer Portal | INTEGRATE | Enable payment-method management and invoice viewing only. |
| Provider-generated SaaS invoices | INTEGRATE | Synchronize Stripe invoice state into separate tenant-scoped SaaS billing records, never construction-finance entities. |
| Payment attempts and renewal outcomes | INTEGRATE | Synchronize provider attempt facts and apply the approved grace/recovery policy. |
| Stripe Tax | INTEGRATE | When enabled and fully configured, invoke Tax through the isolated adapter and persist verified tax facts on local invoice records. When explicitly disabled and not required, record tax as not calculated rather than zero; when required but disabled, misconfigured, or unsupported for the jurisdiction, fail explicitly before creating an incorrectly priced object. |
| Provider refund history | INTEGRATE | Persist verified provider refund facts in separate organization-scoped SaaS billing history with unique provider identity and auditable event history; a refund record alone never changes access. |
| Refund initiation by privileged SiteFlow staff | OPT-OUT | No mutation ships unless execution verifies an existing supra-organization billing-staff authority in source. Organization billing roles cannot substitute. Update this row to INTEGRATE only if that exact existing authority is evidenced and enforced; otherwise keep the mutation absent. |
| Signed webhooks | INTEGRATE | Verify original request bytes, persist a durable unique event inbox before acknowledgement, and recover pending rows through a registered scheduled scan and current-object reconciliation. |
| Test Mode provider acceptance | INTEGRATE | Perform real Test Mode API operations and signed Dashboard webhook deliveries through ngrok; do not label mocks or unit tests as provider acceptance. |
| Live-mode credentials and live transactions | OPT-OUT | Initial acceptance is Test Mode only; live credentials and production charging are outside this phase. |
| Stripe Elements or embedded payment collection | OPT-OUT | Hosted Checkout is the selected payment collection surface. |
| Portal subscription plan changes, cancellation, pause, or reactivation | OPT-OUT | These mutations bypass SiteFlow policy; approved changes use SiteFlow-owned routes and verified reconciliation. |
| One-time payments, Payment Links, and non-subscription invoicing | OPT-OUT | Phase scope is fixed recurring organization subscriptions, not unrelated commerce. |
| Connect, Issuing, Terminal, Identity, Financial Connections, Treasury, and Radar administration | OPT-OUT | These capabilities are unrelated to the approved subscription-management surface and its trust boundaries. |
| Per-seat, metered, usage-record, AI-credit, or overage billing | OPT-OUT | The selected initial model is fixed recurring organization pricing with included limits; these models are deferred. |
| Multiple currencies or multiple current subscriptions per organization | OPT-OUT | Initial context is USD and one current subscription per organization. |
| Book-a-demo sales workflow | OPT-OUT | Lead capture and scheduling are separate from trial provisioning and deferred. |
| Construction-finance invoices, payment applications, or refunds | OPT-OUT | Project commercial records retain their existing domain, permissions, and lifecycle; SaaS billing must remain separate. |

## Guarded Acceptance

- The policy decision checkpoint must approve exact catalog, limit, and lifecycle values before dependent implementation.
- Stripe SDK installation is blocked until the package-legitimacy checkpoint is explicitly approved.
- Migration generation/application is blocked until repository history and applied database state are reconciled.
- Tax is an INTEGRATE capability with the enabled, disabled, required-but-unavailable, and unsupported-jurisdiction branches described above; disabled tax is never represented as a verified zero amount.
- Refund history is integrated, while refund mutation remains OPT-OUT unless the existing privileged authority is source-verified and enforced during execution.
- Every final capability must appear once with exactly `INTEGRATE` or `OPT-OUT`; every `OPT-OUT` must retain a reason.
- Never request, expose, log, diagram, or commit secret values.
