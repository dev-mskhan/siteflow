import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';

export default function AboutPage() {
  return (
    <div className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-16">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-surface-2 text-xs font-mono text-accent-1">
          Our Company & Principles
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-text tracking-tight">
          Building Software with <span className="gradient-text">Jobsite Rigor</span>.
        </h1>
        <p className="text-base text-text-muted max-w-2xl mx-auto leading-relaxed">
          SiteFlow was founded by structural engineers and systems architects who grew tired of watching construction margins disappear due to fragmented software.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <div className="w-10 h-10 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-accent-1 font-bold mb-3">
              01
            </div>
            <CardTitle>Jobsite Reality First</CardTitle>
            <CardDescription className="leading-relaxed mt-2">
              If an engineer in boots with muddy gloves cannot enter data in 30 seconds on a low-bandwidth site, the software has failed.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="w-10 h-10 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-accent-1 font-bold mb-3">
              02
            </div>
            <CardTitle>Dual Ledger Precision</CardTitle>
            <CardDescription className="leading-relaxed mt-2">
              We engineer native localization for both US (CSI MasterFormat, AIA G702) and Pakistani construction (PEC, Interim Payment Certs).
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="w-10 h-10 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-accent-1 font-bold mb-3">
              03
            </div>
            <CardTitle>Strict Governance</CardTitle>
            <CardDescription className="leading-relaxed mt-2">
              Segregation of duties (SOD), cryptographic event outboxes, and immutable audit logs guarantee compliance under any audit.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="p-8 rounded-2xl border border-border bg-surface card-glass space-y-4">
        <h3 className="text-xl font-bold text-text">Regional Headquarters</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm text-text-muted">
          <div className="space-y-1">
            <h4 className="font-bold text-text">North America</h4>
            <p>SiteFlow Technologies Inc.</p>
            <p>1200 Post Oak Blvd, Suite 800</p>
            <p>Houston, TX 77056, United States</p>
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-text">South Asia Operations</h4>
            <p>SiteFlow Engineering (Private) Limited</p>
            <p>Evacuee Trust Complex, Sector F-5/1</p>
            <p>Islamabad, Pakistan</p>
          </div>
        </div>
      </div>
    </div>
  );
}
