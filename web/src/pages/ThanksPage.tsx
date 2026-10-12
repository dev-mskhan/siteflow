import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Seo } from '../components/seo/Seo';
import { SEO_DATA } from '../content/seo';

export const ThanksPage: React.FC = () => {
  return (
    <div className="bg-bg text-text min-h-[70vh] flex items-center justify-center py-16 px-4">
      <Seo
        title={SEO_DATA.thanks.title}
        description={SEO_DATA.thanks.description}
        canonical={SEO_DATA.thanks.canonical}
        schemaType="WebPage"
      />

      <Card className="max-w-lg w-full text-center border-border shadow-modal">
        <CardContent className="p-8 sm:p-10 space-y-5">
          <div className="w-14 h-14 rounded-full bg-status-ontrack-bg text-status-ontrack flex items-center justify-center mx-auto border border-status-ontrack-border">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-text">
            Thank you for reaching out
          </h1>

          <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
            We have received your demo request and project information. A construction operations specialist will review your details and contact you within one business day with scheduled meeting times.
          </p>

          <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/">
              <Button variant="primary">
                Return to home page
              </Button>
            </Link>
            <Link to="/features">
              <Button variant="secondary">
                Explore feature modules
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
