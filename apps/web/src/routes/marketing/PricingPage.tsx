import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export default function PricingPage() {
  const [currency, setCurrency] = useState<'USD' | 'PKR'>('USD');
  const [isAnnual, setIsAnnual] = useState(true);

  const plans = [
    {
      name: 'Starter',
      badge: 'Small Contractors',
      priceUSD: isAnnual ? 79 : 99,
      pricePKR: isAnnual ? 22000 : 27500,
      description: 'Ideal for independent builders and trade contractors managing up to 3 active projects.',
      features: [
        'Up to 3 active projects',
        'Full BOQ & Estimating tool',
        'Daily Field Logs mobile app',
        'Purchase orders & delivery notes',
        'Standard Email support',
      ],
      popular: false,
    },
    {
      name: 'Professional',
      badge: 'General Contractors',
      priceUSD: isAnnual ? 199 : 249,
      pricePKR: isAnnual ? 55000 : 69000,
      description: 'Designed for established general contractors needing critical path scheduling and 3-way match.',
      features: [
        'Unlimited active projects',
        'CPM Critical Path scheduling engine',
        '3-way match procurement reconciliation',
        'Progress billing & retainage ledger',
        'Subcontractor portal access',
        'Priority technical support',
      ],
      popular: true,
    },
    {
      name: 'Enterprise',
      badge: 'Developers & EPC Firms',
      priceUSD: isAnnual ? 499 : 599,
      pricePKR: isAnnual ? 139000 : 165000,
      description: 'For large commercial developers and EPC firms managing multi-entity portfolios and custom ERP integrations.',
      features: [
        'Multi-entity & multi-organization ledger',
        'Custom approval matrices & strict SOD policy',
        'Direct ERP & Accounting API access',
        'Dedicated account engineer',
        'Custom contract formats & SLA guarantees',
      ],
      popular: false,
    },
  ];

  return (
    <div className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-surface-2 text-xs font-mono text-accent-1">
          Simple, Transparent Pricing
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-text tracking-tight">
          Invest in Reliability, <span className="gradient-text">Eliminate Rework</span>.
        </h1>
        <p className="text-base text-text-muted leading-relaxed">
          All plans include a full 14-day free trial. No setup fees, no surprise storage limits.
        </p>

        {/* Currency & Billing Toggles */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
          {/* Currency Switcher */}
          <div className="inline-flex p-1 rounded-xl bg-surface border border-border">
            <button
              onClick={() => setCurrency('USD')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all ${
                currency === 'USD' ? 'bg-accent-1 text-white' : 'text-text-muted hover:text-text'
              }`}
            >
              USD ($)
            </button>
            <button
              onClick={() => setCurrency('PKR')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all ${
                currency === 'PKR' ? 'bg-accent-1 text-white' : 'text-text-muted hover:text-text'
              }`}
            >
              PKR (Rs.)
            </button>
          </div>

          {/* Billing Interval Switcher */}
          <div className="inline-flex p-1 rounded-xl bg-surface border border-border">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                !isAnnual ? 'bg-surface-2 text-text font-bold' : 'text-text-muted hover:text-text'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isAnnual ? 'bg-surface-2 text-text font-bold' : 'text-text-muted hover:text-text'
              }`}
            >
              Annual <span className="text-accent-1 font-bold">(Save 20%)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
        {plans.map((p) => (
          <Card
            key={p.name}
            className={`flex flex-col justify-between relative ${
              p.popular ? 'border-accent-1 shadow-glow ring-1 ring-accent-1/50' : ''
            }`}
          >
            {p.popular && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-brand text-white text-[11px] font-bold tracking-wide uppercase shadow">
                Most Popular
              </div>
            )}

            <div>
              <CardHeader className="p-0 pb-4">
                <span className="text-xs font-mono text-accent-1 font-semibold">{p.badge}</span>
                <CardTitle className="text-2xl font-bold mt-1">{p.name}</CardTitle>
                <CardDescription className="text-xs mt-1.5 min-h-[32px]">{p.description}</CardDescription>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold font-mono text-text">
                    {currency === 'USD' ? `$${p.priceUSD}` : `PKR ${p.pricePKR.toLocaleString()}`}
                  </span>
                  <span className="text-xs text-text-muted font-mono">/ month</span>
                </div>
                {isAnnual && (
                  <span className="text-[10px] text-text-dim font-mono mt-0.5">Billed annually</span>
                )}
              </CardHeader>

              <CardContent className="p-0 pt-6 border-t border-border">
                <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3">Included Capabilities</p>
                <ul className="space-y-2.5 text-xs text-text-muted">
                  {p.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2.5">
                      <span className="text-success font-bold">✓</span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </div>

            <CardFooter className="p-0 pt-8 mt-6">
              <Link to="/trial" className="w-full">
                <Button variant={p.popular ? 'primary' : 'secondary'} className="w-full">
                  Start 14-Day Free Trial
                </Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
