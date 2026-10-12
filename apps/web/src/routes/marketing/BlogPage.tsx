import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';

export default function BlogPage() {
  const articles = [
    {
      title: 'Eliminating the 3-Way Match Bottleneck in Construction Accounts Payable',
      date: 'October 8, 2026',
      readTime: '6 min read',
      tag: 'Commercials',
      summary: 'Why manual matching of purchase orders against field delivery notes and vendor invoices bleeds general contractor margins, and how automated tolerance matching stops leakage.',
    },
    {
      title: 'CSI MasterFormat vs. PEC Standard Formats: Harmonizing Multi-Country Estimating',
      date: 'September 24, 2026',
      readTime: '8 min read',
      tag: 'Engineering',
      summary: 'A deep architectural dive into unifying North American 50-division MasterFormat line items with South Asian schedule of rates and Interim Payment Certificate norms.',
    },
    {
      title: 'Critical Path recalculation in Real-Time: Why Scheduled Float Matters Every Day',
      date: 'September 12, 2026',
      readTime: '5 min read',
      tag: 'Operations',
      summary: 'How daily field delay logs can propagate through early/late finish dependencies before delays become catastrophic project disputes.',
    },
  ];

  return (
    <div className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-12">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-surface-2 text-xs font-mono text-accent-1">
          Technical Resources & Guides
        </div>
        <h1 className="text-4xl font-black text-text tracking-tight">
          The Construction Operations <span className="gradient-text">Engineering Journal</span>
        </h1>
        <p className="text-sm text-text-muted max-w-lg mx-auto">
          Insights on cost engineering, critical path scheduling, material supply chains, and contract standards.
        </p>
      </div>

      <div className="space-y-6">
        {articles.map((item) => (
          <Card key={item.title} className="p-8 hover:border-accent-1/50 transition-colors">
            <CardHeader className="p-0 pb-3">
              <div className="flex items-center gap-3 text-xs font-mono text-text-muted mb-2">
                <span className="px-2 py-0.5 rounded bg-surface-2 border border-border text-accent-1 font-semibold">
                  {item.tag}
                </span>
                <span>{item.date}</span>
                <span>•</span>
                <span>{item.readTime}</span>
              </div>
              <CardTitle className="text-xl font-bold">{item.title}</CardTitle>
              <CardDescription className="text-sm mt-2 leading-relaxed">{item.summary}</CardDescription>
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <span className="text-xs text-accent-1 font-semibold cursor-pointer hover:underline inline-flex items-center gap-1">
                Read full paper →
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
