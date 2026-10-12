import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';

export default function ContactPage() {
  const { success: toastSuccess } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    projectCount: '1-3',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    toastSuccess('Message Received', 'Our engineering solutions team will get in touch within 2 business hours.');
  };

  return (
    <div className="py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-12">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-surface-2 text-xs font-mono text-accent-1">
          Direct Engineering Support
        </div>
        <h1 className="text-4xl font-black text-text tracking-tight">
          Talk to a Construction <span className="gradient-text">Solutions Specialist</span>
        </h1>
        <p className="text-sm text-text-muted max-w-lg mx-auto">
          Need a guided walkthrough for your project portfolio or custom enterprise rollout? We are here to help.
        </p>
      </div>

      <Card className="max-w-xl mx-auto">
        <CardHeader>
          <CardTitle>Schedule Consultation</CardTitle>
          <CardDescription>Fill out your details to connect directly with our engineering team</CardDescription>
        </CardHeader>

        <CardContent>
          {submitted ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xl">
                ✓
              </div>
              <h3 className="text-lg font-bold text-text">Thank You for Reaching Out</h3>
              <p className="text-sm text-text-muted">
                We have received your request and assigned a technical specialist. You will hear from us shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Your Name"
                required
                placeholder="Tariq Mansoor"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />

              <Input
                label="Work Email"
                type="email"
                required
                placeholder="tariq@generalcontractors.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />

              <Input
                label="Company / Firm Name"
                required
                placeholder="Mansoor Construction Group"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              />

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Active Projects Under Management
                </label>
                <select
                  value={formData.projectCount}
                  onChange={(e) => setFormData({ ...formData, projectCount: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-surface text-text border border-border outline-none focus:border-accent-1"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <option value="1-3">1 to 3 Projects ($1M - $10M total value)</option>
                  <option value="4-10">4 to 10 Projects ($10M - $50M total value)</option>
                  <option value="10+">10+ Projects ($50M+ Enterprise Portfolio)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  How can we help? (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Tell us about your requirements, existing ERPs, or specific pain points..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-surface text-text border border-border outline-none focus:border-accent-1 placeholder:text-text-dim"
                  style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
                />
              </div>

              <Button type="submit" variant="primary" className="w-full mt-2">
                Submit Consultation Request
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
