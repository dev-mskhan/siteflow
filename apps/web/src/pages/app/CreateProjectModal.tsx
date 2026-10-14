/**
 * CreateProjectModal — POST /organizations/:orgId/projects
 * Validates: name (required), projectType, contractValue (decimal), dates.
 * On success navigates to the new project's overview page.
 */
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FormField, inputCls } from '../../components/ui/FormField';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { useCreateProjectMutation } from '../../features/project/projectApi';
import { getServerError, isInlineError, isToastError, toastErrorMessage } from '../../lib/authErrors';
import { useToast } from '../../components/ui/Toast';

const schema = z.object({
  name: z.string().min(1, 'Project name is required').max(200),
  description: z.string().max(2000).optional(),
  projectType: z.enum(['COMMERCIAL', 'RESIDENTIAL', 'INDUSTRIAL', 'INFRASTRUCTURE', 'OTHER']).optional(),
  contractValue: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid decimal amount e.g. 5000000.00')
    .optional()
    .or(z.literal('')),
  currency: z.string().length(3, 'Must be 3-letter ISO code').toUpperCase(),
  plannedStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  plannedEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
});
type FormData = z.infer<typeof schema>;

const PROJECT_TYPE_OPTIONS = [
  { value: '', label: 'Select type (optional)' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'RESIDENTIAL', label: 'Residential' },
  { value: 'INDUSTRIAL', label: 'Industrial' },
  { value: 'INFRASTRUCTURE', label: 'Infrastructure' },
  { value: 'OTHER', label: 'Other' },
];

export const CreateProjectModal: React.FC<{ orgId: string; onClose: () => void }> = ({ orgId, onClose }) => {
  const navigate = useNavigate();
  const { error: toastErr } = useToast();
  const [createProject, { isLoading, error }] = useCreateProjectMutation();

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    if (error && isToastError(error)) toastErr('Could not create project', toastErrorMessage(error));
  }, [error, toastErr]);

  const inlineErr = isInlineError(error) ? getServerError(error) : null;

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', currency: 'PKR', contractValue: '', projectType: undefined, plannedStartDate: '', plannedEndDate: '' },
  });

  const onSubmit = async (data: FormData) => {
    try {
      const result = await createProject({
        orgId,
        body: {
          name: data.name,
          description: data.description || undefined,
          projectType: data.projectType || undefined,
          contractValue: data.contractValue || undefined,
          currency: data.currency,
          plannedStartDate: data.plannedStartDate || undefined,
          plannedEndDate: data.plannedEndDate || undefined,
        },
      }).unwrap();
      navigate(`/org/${orgId}/projects/${result.project.id}`, { replace: false });
      onClose();
    } catch { /* handled */ }
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="modal-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        onClick={onClose}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--ink)]/60 px-4"
      >
        <motion.div
          key="modal-panel"
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const } }}
          exit={{ opacity: 0, scale: 0.98 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg border border-[var(--hairline-2)] bg-[var(--paper)] max-h-[90dvh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--hairline-2)] px-5 py-3.5 sticky top-0 bg-[var(--paper)]">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">New project</p>
              <h2 className="text-sm font-medium text-[var(--ink)]">Create a project</h2>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="p-5 space-y-4">
            {inlineErr && <InlineAlert variant="error" message={inlineErr.message} />}

            <FormField label="Project name" error={errors.name?.message} required>
              {(id) => (
                <input id={id} type="text" placeholder="Gulberg Commercial Plaza" className={inputCls(!!errors.name)} {...register('name')} />
              )}
            </FormField>

            <FormField label="Description" error={errors.description?.message}>
              {(id) => (
                <textarea id={id} rows={3} placeholder="Brief scope description (optional)" className={`${inputCls()} resize-none`} {...register('description')} />
              )}
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Project type" error={errors.projectType?.message}>
                {(id) => (
                  <select id={id} className={inputCls()} {...register('projectType')}>
                    {PROJECT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
              </FormField>
              <FormField label="Currency" error={errors.currency?.message} required>
                {(id) => (
                  <input id={id} type="text" placeholder="PKR" maxLength={3} className={inputCls(!!errors.currency)} {...register('currency')} />
                )}
              </FormField>
            </div>

            <FormField label="Contract value" error={errors.contractValue?.message} hint="Decimal format e.g. 85000000.00">
              {(id) => (
                <input id={id} type="text" placeholder="85000000.00" className={inputCls(!!errors.contractValue)} {...register('contractValue')} />
              )}
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Planned start" error={errors.plannedStartDate?.message}>
                {(id) => <input id={id} type="date" className={inputCls(!!errors.plannedStartDate)} {...register('plannedStartDate')} />}
              </FormField>
              <FormField label="Planned end" error={errors.plannedEndDate?.message}>
                {(id) => <input id={id} type="date" className={inputCls(!!errors.plannedEndDate)} {...register('plannedEndDate')} />}
              </FormField>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={isLoading} className="inline-flex items-center gap-2 flex-1 justify-center min-h-10 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0">
                {isLoading ? 'Creating…' : 'Create project'}
                {!isLoading && <ArrowRight className="h-4 w-4" strokeWidth={1.8} />}
              </button>
              <button type="button" onClick={onClose} className="min-h-10 border border-[var(--hairline-2)] px-4 text-sm font-medium text-[var(--muted)] hover:border-[var(--ink)] hover:text-[var(--ink)] transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};
