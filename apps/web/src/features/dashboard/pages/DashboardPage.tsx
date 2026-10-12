import { PageHeader } from '../../../components/shared/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/Card';
import { formatCurrency } from '../../../lib/utils/index';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';

export default function DashboardPage() {
  const kpis = [
    { title: 'Total Portfolio Value', value: formatCurrency(12450000, 'USD'), change: '+8.4% vs last quarter', status: 'normal' },
    { title: 'Active Jobsites', value: '4 Projects', change: '2 Commercial, 1 Infra, 1 Resi', status: 'normal' },
    { title: 'Critical Path Alerts', value: '1 Milestone At Risk', change: 'Foundation curing delayed 2d', status: 'warning' },
    { title: 'Committed PO Spend', value: formatCurrency(8120000, 'USD'), change: '94.2% within allocated BOQ', status: 'success' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Operations Dashboard"
        description="Cross-portfolio summary of project milestones, commitments, and field activity."
        actions={
          <Link to="/projects">
            <Button variant="primary">
              View All Projects →
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.title}>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase font-mono">{k.title}</CardDescription>
              <CardTitle className="text-2xl font-bold font-mono text-text mt-1">{k.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <span className={`text-xs font-mono ${k.status === 'warning' ? 'text-warning' : k.status === 'success' ? 'text-success' : 'text-text-muted'}`}>
                {k.change}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Project Activity</CardTitle>
            <CardDescription>Live field logs, procurement approvals, and change orders</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3.5 rounded-xl bg-surface-2 border border-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="text-base">📝</span>
                <div>
                  <p className="font-bold text-text">Daily Field Log Submitted</p>
                  <p className="text-text-muted">Apex Heights • Concrete pouring 120 cu yds completed</p>
                </div>
              </div>
              <span className="text-text-dim font-mono">10m ago</span>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-2 border border-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="text-base">📦</span>
                <div>
                  <p className="font-bold text-text">Purchase Order Approved</p>
                  <p className="text-text-muted">Islamabad Expressway • 250 Tons Steel Rebar ($185k)</p>
                </div>
              </div>
              <span className="text-text-dim font-mono">1h ago</span>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-2 border border-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="text-base">⚡</span>
                <div>
                  <p className="font-bold text-text">Milestone Completed</p>
                  <p className="text-text-muted">Westside Logistics • Substructure Inspection passed</p>
                </div>
              </div>
              <span className="text-text-dim font-mono">3h ago</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Regional Operations</CardTitle>
            <CardDescription>Standards & unit configurations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-surface-2 border border-border">
              <p className="font-bold text-text">North American Projects</p>
              <p className="text-text-muted mt-1">CSI MasterFormat, AIA G702 billing, USD ($)</p>
            </div>
            <div className="p-3 rounded-lg bg-surface-2 border border-border">
              <p className="font-bold text-text">South Asia Projects</p>
              <p className="text-text-muted mt-1">PEC Standards, IPC billing, PKR (Rs.), Marla/Kanal units</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
