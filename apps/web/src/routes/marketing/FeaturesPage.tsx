import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export default function FeaturesPage() {
  const sections = [
    {
      title: 'Preconstruction & BOQ Matrix',
      description: 'Break down construction drawings into precise bill of quantities with hierarchical line items, multi-unit support, and subcontractor quote comparisons.',
      points: [
        'Hierarchical CSI MasterFormat breakdown',
        'Automatic unit conversion (Sq Ft, Marla, Kanal, Cu Yd)',
        'Direct RFQ generation to trade contractors',
        'Budget baseline locking and audit trails',
      ],
    },
    {
      title: 'Critical Path Method (CPM) Scheduling',
      description: 'Full scheduling engine that automatically calculates the critical path, total float, and early/late dates for thousands of construction activities.',
      points: [
        'Four dependency types (FS, SS, FF, SF) with positive/negative lead-lag',
        'Real-time baseline variance metrics',
        'Non-working days and national holiday calendar support',
        'Automatic milestone recalculation',
      ],
    },
    {
      title: 'Procurement & 3-Way Match',
      description: 'Control cash outflows with strict procurement governance from purchase order creation to on-site delivery verification.',
      points: [
        'Purchase orders tied to budget cost codes',
        'Material gate-pass and site delivery tickets',
        'Automated 3-way reconciliation (PO + Delivery + Vendor Invoice)',
        'Inventory warehouse and stock transfers',
      ],
    },
    {
      title: 'Field Telemetry & Daily Logs',
      description: 'Capture daily site conditions before crews depart. Create an irrefutable record of weather, manpower, safety incidents, and work completed.',
      points: [
        'Automated local weather logging',
        'Trade subcontractor headcount and equipment logs',
        'Safety inspection checklists & incident reporting',
        'Daily photo documentation with timestamp validation',
      ],
    },
    {
      title: 'Progress Billing & Retainage',
      description: 'Generate verified AIA G702 / G703 pay applications or Interim Payment Certificates (IPC) based on field progress.',
      points: [
        'Automatic retainage withholding and release tracking',
        'Approved change order incorporation into billing schedule',
        'Multi-currency ledger (USD and PKR)',
        'Client certification and approval workflow',
      ],
    },
  ];

  return (
    <div className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-surface-2 text-xs font-mono text-accent-1">
          Full Feature Specifications
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-text tracking-tight">
          Every Construction Workflow, <span className="gradient-text">Unified</span>.
        </h1>
        <p className="text-base text-text-muted leading-relaxed">
          SiteFlow replaces disjointed spreadsheets, paper forms, and fragmented software with a single reliable operational core.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {sections.map((sec, i) => (
          <Card key={sec.title} className="p-8">
            <CardHeader className="p-0 pb-4">
              <span className="text-xs font-mono text-text-dim">MODULE 0{i + 1}</span>
              <CardTitle className="text-xl font-bold mt-1">{sec.title}</CardTitle>
              <CardDescription className="text-sm mt-2 leading-relaxed">{sec.description}</CardDescription>
            </CardHeader>
            <CardContent className="p-0 pt-4 border-t border-border/80">
              <ul className="space-y-2 text-xs text-text-muted font-mono">
                {sec.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-2">
                    <span className="text-accent-1">✓</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="p-10 rounded-2xl border border-border bg-surface text-center card-glass space-y-4">
        <h3 className="text-2xl font-bold text-text">Experience the difference on your live jobsites</h3>
        <p className="text-sm text-text-muted max-w-xl mx-auto">
          Start your 14-day free trial now or speak with an engineering specialist to review your current toolchain.
        </p>
        <div className="pt-2 flex justify-center gap-4">
          <Link to="/trial">
            <Button size="lg" variant="primary">
              Start 14-Day Free Trial
            </Button>
          </Link>
          <Link to="/contact">
            <Button size="lg" variant="secondary">
              Contact Engineering
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
