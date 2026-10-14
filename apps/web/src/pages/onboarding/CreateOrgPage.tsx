/**
 * CreateOrgPage — /onboarding/create-org
 * POST /organizations { name, slug? }
 *
 * Server validation (from organization.service.ts + createOrgSchema):
 *   name: min 2, max 100 chars
 *   slug: optional, lowercase alphanumeric + hyphens, max 50 chars
 *         auto-derived from name when not provided
 *
 * Errors:
 *   409 CONFLICT (slug taken) → inline under slug field
 *   403 FORBIDDEN (email not verified / org cap reached) → inline banner
 *   429 / 500 → toast
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Building2 } from 'lucide-react';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { FormField, inputCls } from '../../components/ui/FormField';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { useCreateOrgMutation } from '../../features/org/orgApi';
import { useAppDispatch } from '../../app/store';
import { orgContextCleared } from '../../features/org/orgSlice';
import { useAuth } from '../../features/auth/useAuth';
import { getServerError, isInlineError, isToastError, toastErrorMessage } from '../../lib/authErrors';
import { useToast } from '../../components/ui/Toast';

// Client-side schema matching createOrgSchema on the server
const createOrgSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be under 100 characters'),
  slug: z.string()
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens')
    .max(50, 'Slug must be under 50 characters')
    .optional()
    .or(z.literal('')),
});

type CreateOrgFormData = z.infer<typeof createOrgSchema>;

function deriveSlug(name: string): string {
  return name
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

export const CreateOrgPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { error: toastErr } = useToast();

  const [createOrg, { isLoading, error }] = useCreateOrgMutation();

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<CreateOrgFormData>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: { name: '', slug: '' },
  });

  // Auto-derive slug from name while user is typing
  const name = watch('name');
  useEffect(() => {
    setValue('slug', deriveSlug(name), { shouldValidate: false });
  }, [name, setValue]);

  useEffect(() => {
    if (error && isToastError(error)) {
      toastErr('Could not create workspace', toastErrorMessage(error));
    }
  }, [error, toastErr]);

  const inlineError = isInlineError(error) ? getServerError(error) : null;

  const onSubmit = async (data: CreateOrgFormData) => {
    try {
      const result = await createOrg({
        name: data.name,
        slug: data.slug || undefined,
      }).unwrap();
      // Clear any stale org context before entering the new org
      dispatch(orgContextCleared());
      navigate(`/org/${result.organization.id}/dashboard`, { replace: true });
    } catch {
      // Handled via error state
    }
  };

  return (
    <AuthLayout
      headline={<>Your workspace.<br /><em className="font-serif font-light not-italic italic">Your</em> projects.</>}
    >
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--hairline-2)] bg-[var(--surface-2)]">
            <Building2 className="h-5 w-5 text-[var(--ink)]" strokeWidth={1.5} />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
              Set up workspace
            </p>
            <h1 className="text-xl font-medium tracking-[-0.03em]">
              Create your organization
            </h1>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              Welcome{user?.firstName ? `, ${user.firstName}` : ''}. Invite your team after setup.
            </p>
          </div>
        </div>

        {inlineError && (
          <InlineAlert
            variant="error"
            message={
              inlineError.code === 'CONFLICT'
                ? 'A workspace with this URL already exists. Try a different slug.'
                : inlineError.message
            }
          />
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <FormField label="Organization name" error={errors.name?.message} required>
            {(id) => (
              <input
                id={id}
                type="text"
                autoComplete="organization"
                placeholder="Mehmood Civil Construction"
                className={inputCls(!!errors.name)}
                {...register('name')}
              />
            )}
          </FormField>

          <FormField
            label="Workspace URL"
            error={errors.slug?.message}
            hint="Auto-generated from name. Lowercase letters, numbers and hyphens only."
          >
            {(id) => (
              <div className="flex">
                <span className="inline-flex items-center border border-r-0 border-[var(--hairline-2)] bg-[var(--surface-2)] px-3 font-mono text-[10px] text-[var(--muted)] select-none whitespace-nowrap">
                  siteflow.app/
                </span>
                <input
                  id={id}
                  type="text"
                  autoComplete="off"
                  placeholder="mehmood-civil"
                  className={`${inputCls(!!errors.slug)} flex-1`}
                  {...register('slug')}
                />
              </div>
            )}
          </FormField>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full inline-flex items-center justify-center gap-2 min-h-11 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ink)] disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
          >
            {isLoading ? 'Creating workspace…' : 'Create workspace'}
            {!isLoading && <ArrowRight className="h-4 w-4" strokeWidth={1.8} />}
          </button>
        </form>
      </div>
    </AuthLayout>
  );
};
