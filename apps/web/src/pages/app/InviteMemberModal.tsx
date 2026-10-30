/**
 * InviteMemberModal — POST /organizations/:orgId/invitations
 *
 * Fields: email + roleId (dropdown of org roles derived from members list)
 * Errors:
 *   409 CONFLICT (already a member / pending invite) → inline
 *   429 / 500 → toast
 */
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FormField, inputCls } from '../../components/ui/FormField';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { useCreateInvitationMutation } from '../../features/org/invitationApi';
import { useListOrganizationRolesQuery } from '../../features/org/memberApi';
import { getServerError, isInlineError, isToastError, toastErrorMessage } from '../../lib/authErrors';
import { useToast } from '../../components/ui/Toast';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  roleId: z.string().min(1, 'Select a role'),
});
type FormData = z.infer<typeof schema>;

interface InviteMemberModalProps {
  orgId: string;
  orgName?: string;
  inviterName?: string;
  onClose: () => void;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  orgId,
  orgName,
  inviterName,
  onClose,
}) => {
  const { error: toastErr, success: toastOk } = useToast();
  const {
    data: rolesData,
    isLoading: rolesLoading,
    isError: rolesError,
  } = useListOrganizationRolesQuery(orgId);
  const [createInvitation, { isLoading, error }] = useCreateInvitationMutation();

  const roleOptions = (rolesData?.roles ?? []).map((role) => ({
    value: role.id,
    label: role.name,
  }));

  const { register, control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', roleId: '' },
  });

  useEffect(() => {
    if (error && isToastError(error)) {
      toastErr('Invitation failed', toastErrorMessage(error));
    }
  }, [error, toastErr]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const inlineError = isInlineError(error) ? getServerError(error) : null;

  const onSubmit = async (data: FormData) => {
    try {
      await createInvitation({
        orgId,
        body: {
          email: data.email,
          roleId: data.roleId,
          orgName,
          inviterName,
        },
      }).unwrap();
      toastOk('Invitation sent', `An invite has been emailed to ${data.email}.`);
      onClose();
    } catch {
      // Handled via error state
    }
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="invite-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        onClick={onClose}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--ink)]/60 px-4"
      >
        <motion.div
          key="invite-modal-panel"
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const } }}
          exit={{ opacity: 0, scale: 0.98 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md border border-[var(--hairline-2)] bg-[var(--paper)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--hairline-2)] px-5 py-3.5">
            <h2 className="text-sm font-medium text-[var(--ink)]">Invite a team member</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1 text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="p-5 space-y-4">
            {inlineError && (
              <InlineAlert
                variant="error"
                message={
                  inlineError.code === 'CONFLICT'
                    ? 'This person is already a member or has a pending invitation.'
                    : inlineError.message
                }
              />
            )}

            <FormField label="Email address" error={errors.email?.message} required>
              {(id) => (
                <input
                  id={id}
                  type="email"
                  autoComplete="off"
                  placeholder="colleague@company.com"
                  className={inputCls(!!errors.email)}
                  {...register('email')}
                />
              )}
            </FormField>

            <FormField label="Role" error={errors.roleId?.message} required>
              {(id) => (
                <Controller
                  name="roleId"
                  control={control}
                  render={({ field }) => (
                    <CustomSelect
                      id={id}
                      options={roleOptions}
                      value={field.value}
                      onChange={field.onChange}
                      error={!!errors.roleId}
                      disabled={rolesLoading || rolesError || roleOptions.length === 0}
                      placeholder={rolesLoading ? 'Loading roles…' : 'Select a role'}
                      aria-label="Role"
                    />
                  )}
                />
              )}
            </FormField>
            {rolesError && (
              <InlineAlert variant="error" message="Could not load organization roles. Close and reopen this form to try again." />
            )}
            {!rolesLoading && !rolesError && roleOptions.length === 0 && (
              <InlineAlert variant="error" message="No organization roles are configured, so an invitation cannot be sent." />
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isLoading || rolesLoading || rolesError || roleOptions.length === 0}
                className="inline-flex items-center gap-2 min-h-10 flex-1 justify-center bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
              >
                {isLoading ? 'Sending…' : 'Send invitation'}
                {!isLoading && <ArrowRight className="h-4 w-4" strokeWidth={1.8} />}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-10 border border-[var(--hairline-2)] px-4 text-sm font-medium text-[var(--muted)] hover:border-[var(--ink)] hover:text-[var(--ink)] transition-colors"
              >
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
