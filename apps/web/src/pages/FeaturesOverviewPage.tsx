import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calculator, Calendar, Truck, ClipboardList, Users, FileCheck2, TrendingDown, Receipt, FolderArchive } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Seo } from '../components/seo/Seo';
import { SEO_DATA } from '../content/seo';
import { FEATURES_DATA } from '../content/features';

export const FeaturesOverviewPage: React.FC = () => {
  const iconMap: Record<string, React.ElementType> = {
    'estimating-and-boq': Calculator,
    scheduling: Calendar,
    procurement: Truck,
    'field-logs': ClipboardList,
    subcontractors: Users,
    'change-orders': FileCheck2,
    'cost-control': TrendingDown,
    'billing-and-payments': Receipt,
    documents: FolderArchive,
  };

  const featureList = Object.values(FEATURES_DATA);

  return (
    <div className="bg-bg text-text">
      <Seo
        title={SEO_DATA.featuresOverview.title}
        description={SEO_DATA.featuresOverview.description}
        canonical={SEO_DATA.featuresOverview.canonical}
        schemaType="SoftwareApplication"
      />

      {/* Header */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 border-b border-border bg-drafting-grid text-left sm:text-center">
        <div className="max-w-4xl mx-auto">
          <span className="text-xs font-heading font-bold uppercase tracking-wider text-accent block mb-2">
            Complete Operations Suite
          </span>
          <h1 className="text-3xl sm:text-5xl font-heading font-extrabold tracking-tight text-text mb-4">
            Nine modules built strictly for construction
          </h1>
          <p className="text-base sm:text-lg text-text-muted max-w-2xl sm:mx-auto mb-8">
            From the first quantity takeoff to the final retainage release check, every feature works together without double entry.
          </p>
          <div className="flex flex-wrap items-center sm:justify-center gap-3">
            <Link to="/contact">
              <Button variant="primary" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Book a demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 bg-surface">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featureList.map((f) => {
            const Icon = iconMap[f.slug] || Calculator;
            return (
              <Link key={f.slug} to={`/features/${f.slug}`} className="group">
                <Card className="h-full hover:border-accent hover:shadow-card transition-all">
                  <CardContent className="p-6 flex flex-col justify-between h-full space-y-4">
                    <div>
                      <div className="w-9 h-9 rounded-md bg-accent-subtle text-accent flex items-center justify-center border border-accent-border mb-3 group-hover:bg-accent group-hover:text-accent-contrast transition-colors">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-text-subtle block mb-1">
                        {f.badge}
                      </span>
                      <h2 className="font-heading text-lg font-bold text-text group-hover:text-accent transition-colors mb-2">
                        {f.title}
                      </h2>
                      <p className="text-xs text-text-muted leading-relaxed">
                        {f.supportingSentence}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-border flex items-center justify-between text-xs font-heading font-semibold text-accent">
                      <span>Explore {f.title}</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 text-center bg-drafting-grid border-t border-border">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-text mb-3">
            See all 9 modules live on your active job
          </h2>
          <p className="text-xs sm:text-sm text-text-muted mb-8 max-w-lg mx-auto">
            Our specialists will walk you through a live project configuration in PKR or USD.
          </p>
          <Link to="/contact">
            <Button variant="primary" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Book a demo
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};
