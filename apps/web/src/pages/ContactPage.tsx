import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { CheckCircle2, ShieldCheck, AlertTriangle, ArrowUpRight, Zap } from 'lucide-react';
import { Seo } from '../components/seo/Seo';
import { SEO_DATA } from '../content/seo';
import { mockDelay } from '../services/mock/mockDelay';
import { CustomSelect, type SelectOption } from '../components/ui/CustomSelect';

/* ─── Validation ──────────────────────────────────────────────────────────── */

const contactFormSchema = z.object({
  name: z.string().min(2, 'Please enter your full name.'),
  workEmail: z.string().email('Please enter a valid work email address.'),
  phone: z.string().optional(),
  companyName: z.string().min(2, 'Please enter your company or contracting firm name.'),
  companySize: z.string().min(1, 'Please select your approximate company size.'),
  country: z.string().min(1, 'Please select your operating country.'),
  whatTheyWant: z.string().min(1, 'Please select how we can help you.'),
  message: z.string().min(10, 'Please write at least one sentence about your current projects.'),
  honeyPot: z.string().max(0, 'Spam detected.'),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

/* ─── Select option sets ──────────────────────────────────────────────────── */

const companySizeOptions: SelectOption[] = [
  { value: '1-10', label: '1–10 employees', meta: 'Residential / Small GC' },
  { value: '11-50', label: '11–50 employees', meta: 'Mid-sized contractor' },
  { value: '51-200', label: '51–200 employees', meta: 'Commercial & Civil' },
  { value: '200+', label: '200+ employees', meta: 'Infrastructure / Developer' },
];

const countryOptions: SelectOption[] = [
  { value: 'Pakistan', label: 'Pakistan', meta: 'PKR · Marla/Kanal · WHT' },
  { value: 'United States', label: 'United States', meta: 'USD · AIA · CSI Divisions' },
  { value: 'Other', label: 'Other region', meta: 'International' },
];

const intentOptions: SelectOption[] = [
  { value: 'trial', label: 'Start a 14-day free trial', meta: 'No card required' },
  { value: 'demo', label: 'Schedule a product demo', meta: '20-min live walkthrough' },
  { value: 'pricing', label: 'Pricing or enterprise plans', meta: 'Compare tiers' },
  { value: 'subcontractor', label: 'Subcontractor onboarding', meta: 'Trade portal access' },
  { value: 'other', label: 'General question or partnership', meta: '' },
];

/* ─── Field wrapper ───────────────────────────────────────────────────────── */

const Field = ({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
      {label}
    </label>
    {children}
    {error && <span className="font-mono text-[10px] text-[#991b1b]">{error}</span>}
  </div>
);

const inputBase =
  'w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)] transition-colors';
const inputError = 'border-[#fecaca] focus:outline-[#991b1b]';

/* ─── Page ────────────────────────────────────────────────────────────────── */

export const ContactPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isTrial = searchParams.get('intent') === 'trial';
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    defaultValues: {
      name: '',
      workEmail: '',
      phone: '',
      companyName: '',
      companySize: '11-50',
      country: 'Pakistan',
      whatTheyWant: isTrial ? 'trial' : 'demo',
      message: '',
      honeyPot: '',
    },
  });

  const whatTheyWant = watch('whatTheyWant');

  const onSubmit = async (data: ContactFormData) => {
    setSubmitError(null);
    const result = contactFormSchema.safeParse(data);
    if (!result.success) {
      setSubmitError(result.error.errors[0]?.message ?? 'Please check the highlighted fields.');
      return;
    }
    try {
      await mockDelay(600, 900);
      navigate(data.whatTheyWant === 'trial' ? '/thanks?intent=trial' : '/thanks');
    } catch {
      setSubmitError(
        'We could not send your message right now. Check your connection and try again.',
      );
    }
  };

  /* Derive submit label from watched field so it updates live */
  const submitLabel = isSubmitting
    ? 'Sending…'
    : whatTheyWant === 'trial'
      ? 'Claim free trial'
      : whatTheyWant === 'demo'
        ? 'Request a demo'
        : 'Send message';

  return (
    <div className="rails relative overflow-hidden bg-[var(--surface)] text-[var(--ink)]">
      <Seo
        title={isTrial ? 'Start Free Trial | SiteFlow' : SEO_DATA.contact.title}
        description={SEO_DATA.contact.description}
        canonical={SEO_DATA.contact.canonical}
        schemaType="WebPage"
      />

      {/* Trial intent banner */}
      {isTrial && (
        <div className="border-b border-[var(--hairline)] bg-[var(--ink)] py-3 text-white">
          <div className="mx-auto flex w-full max-w-[1320px] items-center gap-3 px-5 sm:px-8 lg:px-12">
            <Zap className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
            <p className="font-mono text-[10px] uppercase tracking-[0.16em]">
              14-day free trial · No credit card required · Professional tier limits
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <section className="border-b border-[var(--hairline)] bg-drafting-grid py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-12">
          <div className="mb-5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            <span className="h-px w-10 bg-[var(--ink)]" />
            {isTrial ? 'Start your free trial' : 'Get in touch'}
          </div>
          <h1 className="max-w-3xl text-[clamp(2.4rem,5vw,5rem)] font-medium leading-[0.96] tracking-[-0.065em]">
            {isTrial ? (
              <>
                14 days free.
                <br />
                <em className="font-serif font-light not-italic italic">No card</em> required.
              </>
            ) : (
              <>
                Tell us about
                <br />
                <em className="font-serif font-light not-italic italic">your</em> jobs.
              </>
            )}
          </h1>
          <p className="mt-6 max-w-[50ch] text-base leading-7 text-[var(--muted)]">
            {isTrial
              ? 'Get full Professional-tier access to all 9 modules. Our team will reach out to confirm your trial setup and answer any questions.'
              : 'Fill in the form and we will reach out within one business day. Whether you want a walkthrough, have pricing questions, or are onboarding a subcontractor team.'}
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 gap-14 lg:grid-cols-[0.72fr_1.28fr]">
            {/* ── Left — what to expect ──────────────────────────────── */}
            <div className="space-y-10">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  {isTrial ? 'What you get' : 'What happens next'}
                </p>
                <h2 className="mt-4 text-2xl font-medium tracking-[-0.04em] sm:text-3xl">
                  {isTrial ? 'Full access, from day one' : 'Fast, focused, no pressure'}
                </h2>
              </div>

              <div className="space-y-6 border-l border-[var(--hairline-2)] pl-6">
                {(isTrial
                  ? [
                      {
                        title: 'All 9 modules unlocked',
                        body: 'Estimating & BOQ, procurement, field logs, cost control, billing — everything at Professional tier limits.',
                      },
                      {
                        title: 'Up to 12 active projects',
                        body: 'Start with your real jobs. Invite site supervisors, set up cost codes, and run a live project from day one.',
                      },
                      {
                        title: 'Guided onboarding call',
                        body: 'A construction operations specialist will contact you within one business day to configure your first project together.',
                      },
                    ]
                  : [
                      {
                        title: 'We review your submission',
                        body: 'A specialist reads your project details before responding — no generic replies.',
                      },
                      {
                        title: 'One business day response',
                        body: 'We will reach out by email or phone with a concrete next step based on what you told us.',
                      },
                      {
                        title: 'Tailored to your currency',
                        body: 'Whether you run in PKR or USD, we configure the demo or trial around your actual job types.',
                      },
                    ]
                ).map(({ title, body }) => (
                  <div key={title} className="flex items-start gap-3">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#166534]"
                      strokeWidth={1.6}
                    />
                    <div>
                      <p className="text-sm font-medium leading-tight">{title}</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{body}</p>
                    </div>
                  </div>
                ))}
              </div>

              {isTrial ? (
                <div className="border border-[var(--hairline-2)] bg-[var(--surface-2)] p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                    Trial terms
                  </p>
                  <ul className="mt-4 space-y-2 text-sm leading-6 text-[var(--muted)]">
                    {[
                      '14 days from activation, no auto-charge at expiry',
                      'Full data export available before or after trial ends',
                      'One trial per organization',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="mt-2 h-1 w-1 shrink-0 bg-[var(--ink)]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={1.6} />
                    <span className="text-sm font-medium">Strict Commercial Privacy</span>
                  </div>
                  <p className="text-sm leading-6 text-[var(--muted)]">
                    Your company contact information is never shared or sold. We use your details
                    only to prepare for your specific conversation.
                  </p>
                </div>
              )}
            </div>

            {/* ── Right — form ───────────────────────────────────────── */}
            <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-6 sm:p-10">
              {submitError && (
                <div className="mb-6 flex items-center gap-2 border border-[#fecaca] bg-[#fef2f2] p-3.5 text-sm text-[#991b1b]">
                  <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.6} />
                  <span>{submitError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {/* Honeypot */}
                <input
                  type="text"
                  {...register('honeyPot')}
                  className="hidden"
                  tabIndex={-1}
                  autoComplete="off"
                />

                {/* Name + Email */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field label="Your full name" error={errors.name?.message}>
                    <input
                      className={`${inputBase} ${errors.name ? inputError : ''}`}
                      placeholder="Tariq Mehmood"
                      {...register('name')}
                    />
                  </Field>
                  <Field label="Work email" error={errors.workEmail?.message}>
                    <input
                      type="email"
                      className={`${inputBase} ${errors.workEmail ? inputError : ''}`}
                      placeholder="tariq@contractors.com"
                      {...register('workEmail')}
                    />
                  </Field>
                </div>

                {/* Phone + Company */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field label="Phone (optional)" error={errors.phone?.message}>
                    <input
                      className={`${inputBase} ${errors.phone ? inputError : ''}`}
                      placeholder="+92 300 1234567"
                      {...register('phone')}
                    />
                  </Field>
                  <Field label="Company or firm name" error={errors.companyName?.message}>
                    <input
                      className={`${inputBase} ${errors.companyName ? inputError : ''}`}
                      placeholder="Mehmood Civil Construction"
                      {...register('companyName')}
                    />
                  </Field>
                </div>

                {/* Company size + Country — custom selects */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field label="Company size" error={errors.companySize?.message}>
                    <Controller
                      name="companySize"
                      control={control}
                      render={({ field }) => (
                        <CustomSelect
                          options={companySizeOptions}
                          value={field.value}
                          onChange={field.onChange}
                          error={!!errors.companySize}
                          aria-label="Company size"
                        />
                      )}
                    />
                  </Field>
                  <Field label="Primary country" error={errors.country?.message}>
                    <Controller
                      name="country"
                      control={control}
                      render={({ field }) => (
                        <CustomSelect
                          options={countryOptions}
                          value={field.value}
                          onChange={field.onChange}
                          error={!!errors.country}
                          aria-label="Primary country"
                        />
                      )}
                    />
                  </Field>
                </div>

                {/* How can we help — custom select */}
                <Field label="How can we help?" error={errors.whatTheyWant?.message}>
                  <Controller
                    name="whatTheyWant"
                    control={control}
                    render={({ field }) => (
                      <CustomSelect
                        options={intentOptions}
                        value={field.value}
                        onChange={field.onChange}
                        error={!!errors.whatTheyWant}
                        aria-label="How can we help"
                      />
                    )}
                  />
                </Field>

                {/* Message */}
                <Field label="Tell us about your current projects" error={errors.message?.message}>
                  <textarea
                    rows={4}
                    className={`${inputBase} resize-none ${errors.message ? inputError : ''}`}
                    placeholder="e.g. We have 2 commercial plazas and 3 villas under construction. Looking to replace Excel for BOQs and daily field logs."
                    {...register('message')}
                  />
                </Field>

                {/* Submit */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitLabel}
                    {!isSubmitting && <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />}
                  </button>
                </div>

                {whatTheyWant === 'trial' && !isSubmitting && (
                  <p className="text-center font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
                    No credit card · No auto-charge · Cancel anytime
                  </p>
                )}
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
