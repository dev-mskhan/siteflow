import React from 'react';
import { Link } from 'react-router-dom';
import { HardHat } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Seo } from '../components/seo/Seo';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="bg-bg text-text min-h-[70vh] flex items-center justify-center py-16 px-4">
      <Seo
        title="Page Not Found (404) | SiteFlow"
        description="The construction operations page you are looking for does not exist or has been moved."
        canonical="https://siteflow.app/404"
        noindex={true}
      />

      <Card className="max-w-md w-full text-center border-border shadow-card">
        <CardContent className="p-8 space-y-4">
          <div className="w-12 h-12 rounded-md bg-accent-subtle text-accent flex items-center justify-center mx-auto border border-accent-border">
            <HardHat className="w-6 h-6" />
          </div>

          <span className="font-mono text-xs font-bold text-accent uppercase tracking-wider">
            Error 404
          </span>

          <h1 className="font-heading text-xl font-bold text-text">
            Page not found
          </h1>

          <p className="text-xs text-text-muted leading-relaxed">
            The page you are looking for has been relocated or does not exist. Please check the URL or return to our homepage.
          </p>

          <div className="pt-4">
            <Link to="/">
              <Button variant="primary">
                Back to home page
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
