import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CheckCircle2, ShieldCheck, Mail, Phone, MapPin, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Seo } from '../components/seo/Seo';
import { SEO_DATA } from '../content/seo';
import { mockDelay } from '../services/mock/mockDelay';

// Zod Validation Schema
const contactFormSchema = z.object({
  name: z.string().min(2, 'Please enter your full name.'),
  workEmail: z.string().email('Please enter a valid work email address.'),
  phone: z.string().optional(),
  companyName: z.string().min(2, 'Please enter your company or contracting firm name.'),
  companySize: z.string().min(1, 'Please select your approximate company size.'),
  country: z.string().min(1, 'Please select your operating country.'),
  whatTheyWant: z.string().min(1, 'Please select how we can help you.'),
  message: z.string().min(10, 'Please write at least one sentence about your current projects.'),
  honeyPot: z.string().max(0, 'Spam detected.'), // Hidden anti-spam trap
});

type ContactFormData = z.infer<typeof contactFormSchema>;

export const ContactPage: React.FC = () => {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    defaultValues: {
      name: '',
      workEmail: '',
      phone: '',
      companyName: '',
      companySize: '11-50',
      country: 'Pakistan',
      whatTheyWant: 'demo',
      message: '',
      honeyPot: '',
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    setSubmitError(null);

    // Validate with zod
    const result = contactFormSchema.safeParse(data);
    if (!result.success) {
      setSubmitError(result.error.errors[0]?.message || 'Please check the highlighted fields.');
      return;
    }

    try {
      // Mock submit with realistic network latency (Section 14: Mock submit now)
      await mockDelay(600, 900);

      // On success, redirect to /thanks
      navigate('/thanks');
    } catch (err) {
      setSubmitError('We could not send your message right now. Check your internet connection and try again.');
    }
  };

  return (
    <div className="bg-bg text-text">
      <Seo
        title={SEO_DATA.contact.title}
        description={SEO_DATA.contact.description}
        canonical={SEO_DATA.contact.canonical}
        schemaType="WebPage"
      />

      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 border-b border-border bg-drafting-grid">
        <div className="max-w-4xl mx-auto text-left sm:text-center">
          <span className="text-xs font-heading font-bold uppercase tracking-wider text-accent block mb-2">
            Schedule A Session
          </span>
          <h1 className="text-3xl sm:text-5xl font-heading font-extrabold tracking-tight text-text mb-4">
            Book a 20-minute tailored project demonstration
          </h1>
          <p className="text-base sm:text-lg text-text-muted max-w-2xl sm:mx-auto">
            See how SiteFlow works for your specific active construction jobs. Ask questions about pricing, subcontractor workflows, and data migration.
          </p>
        </div>
      </section>

      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 bg-surface">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Column: What to expect */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <h2 className="font-heading text-xl font-bold text-text mb-3">
                What happens during your session
              </h2>
              <p className="text-xs text-text-muted leading-relaxed">
                You will speak with an operations specialist who understands actual job site challenges. No aggressive sales pressure.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-status-ontrack-bg text-status-ontrack flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-heading font-bold text-text">
                    Review your current workflow
                  </div>
                  <div className="text-[11px] text-text-muted">
                    We will look at how your team handles Bill of Quantities, site logs, and subcontractor billing today.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-status-ontrack-bg text-status-ontrack flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-heading font-bold text-text">
                    Live demo in your currency
                  </div>
                  <div className="text-[11px] text-text-muted">
                    We configure sample projects in PKR (Marla/Kanal) or USD (SqFt/CSI) based on your location.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-status-ontrack-bg text-status-ontrack flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-heading font-bold text-text">
                    Practical onboarding roadmap
                  </div>
                  <div className="text-[11px] text-text-muted">
                    How to invite site supervisors and get your first project baseline locked in under one afternoon.
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-md border border-border bg-bg space-y-2 text-xs text-text-muted">
              <div className="flex items-center gap-2 font-heading font-semibold text-text">
                <ShieldCheck className="w-4 h-4 text-accent" />
                <span>Strict Commercial Privacy</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Your company contact information is never shared or sold. We use your details only to prepare your demonstration session.
              </p>
            </div>
          </div>

          {/* Right Column: Contact & Demo Form */}
          <div className="lg:col-span-7">
            <Card>
              <CardContent className="p-6 sm:p-8">
                {submitError && (
                  <div className="p-3.5 mb-6 rounded-md border border-status-delayed-border bg-status-delayed-bg text-xs text-status-delayed flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {/* Hidden Anti-Spam Trap */}
                  <input
                    type="text"
                    {...register('honeyPot')}
                    className="hidden"
                    tabIndex={-1}
                    autoComplete="off"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Your Full Name"
                      placeholder="e.g. Tariq Mehmood"
                      {...register('name')}
                      error={errors.name?.message}
                    />
                    <Input
                      label="Work Email"
                      placeholder="tariq@contractors.com"
                      type="email"
                      {...register('workEmail')}
                      error={errors.workEmail?.message}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Phone Number (Optional)"
                      placeholder="+92 300 1234567 or +1 (555) 012-3456"
                      {...register('phone')}
                      error={errors.phone?.message}
                    />
                    <Input
                      label="Company or Firm Name"
                      placeholder="e.g. Mehmood Civil Construction"
                      {...register('companyName')}
                      error={errors.companyName?.message}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Select
                      label="Company Size"
                      options={[
                        { value: '1-10', label: '1 - 10 employees (Residential / Small)' },
                        { value: '11-50', label: '11 - 50 employees (Mid-sized General Contractor)' },
                        { value: '51-200', label: '51 - 200 employees (Commercial & Civil)' },
                        { value: '200+', label: '200+ employees (Infrastructure / Developer)' },
                      ]}
                      {...register('companySize')}
                      error={errors.companySize?.message}
                    />

                    <Select
                      label="Primary Country"
                      options={[
                        { value: 'Pakistan', label: 'Pakistan (PKR & Local Units)' },
                        { value: 'United States', label: 'United States (USD & AIA Standards)' },
                        { value: 'Other', label: 'Other Region (International)' },
                      ]}
                      {...register('country')}
                      error={errors.country?.message}
                    />
                  </div>

                  <Select
                    label="What Would You Like To Discuss?"
                    options={[
                      { value: 'demo', label: 'Schedule a 20-minute tailored product demo' },
                      { value: 'pricing', label: 'Questions regarding pricing or custom enterprise plans' },
                      { value: 'subcontractor', label: 'Inquiring about subcontractor onboarding' },
                      { value: 'other', label: 'General question or partnership' },
                    ]}
                    {...register('whatTheyWant')}
                    error={errors.whatTheyWant?.message}
                  />

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-heading font-semibold text-text">
                      Tell us about your current projects
                    </label>
                    <textarea
                      rows={3}
                      placeholder="e.g. We have 2 commercial plazas and 3 villas under construction. Looking to replace Excel for our BOQs and daily field logs."
                      {...register('message')}
                      className={`w-full p-3 text-sm rounded-md border bg-surface text-text placeholder:text-text-subtle transition-all ${
                        errors.message
                          ? 'border-status-delayed focus:ring-status-delayed'
                          : 'border-border hover:border-border-strong focus:ring-accent'
                      }`}
                    />
                    {errors.message && (
                      <span className="text-xs font-medium text-status-delayed">
                        {errors.message.message}
                      </span>
                    )}
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full"
                      isLoading={isSubmitting}
                    >
                      {isSubmitting ? 'Sending your request...' : 'Book a demo'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
};
