/**
 * ProjectSettingsPage — /org/:orgId/projects/:projectId/settings
 * Shows EffectiveProjectSettings (merged project + org fallbacks).
 * Also shows editable project metadata (name, description) via PATCH /projects/:id.
 */
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { Save, Play, Pause, RotateCcw, CheckCircle, XCircle, Archive } from 'lucide-react';
import {
  useGetProjectSettingsQuery,
  useUpdateProjectSettingsMutation,
} from '../../../features/project/projectSettingsApi';
import {
  useUpdateProjectMutation,
  useTransitionProjectMutation,
} from '../../../features/project/projectApi';
import { useActiveProject } from '../../../features/project/useActiveProject';
import { FormField, inputCls } from '../../../components/ui/FormField';
import { CustomSelect } from '../../../components/ui/CustomSelect';
import { InlineAlert } from '../../../components/ui/InlineAlert';
import { useToast } from '../../../components/ui/Toast';
import {
  getFieldValidationErrors,
  getServerError,
  isInlineError,
  isToastError,
  toastErrorMessage,
} from '../../../lib/authErrors';
import type { EffectiveProjectSettings } from '../../../features/project/projectTypes';

const DATE_OPTIONS = [
  { value: 'DD_MM_YYYY', label: 'DD/MM/YYYY', meta: 'Pakistan, UK' },
  { value: 'MM_DD_YYYY', label: 'MM/DD/YYYY', meta: 'US' },
  { value: 'YYYY_MM_DD', label: 'YYYY-MM-DD', meta: 'ISO 8601' },
];
const TIME_OPTIONS = [
  { value: 'H24', label: '24-hour', meta: '13:00' },
  { value: 'H12', label: '12-hour', meta: '1:00 PM' },
];
const UNIT_OPTIONS = [
  { value: 'METRIC', label: 'Metric', meta: 'kg, m, km' },
  { value: 'IMPERIAL', label: 'Imperial', meta: 'lb, ft, mi' },
];

export const ProjectSettingsPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { activeProject, activeProjectVersion } = useActiveProject();
  const { success: toastOk, error: toastErr } = useToast();

  const { data: settingsData, isLoading } = useGetProjectSettingsQuery({
    orgId: orgId!,
    projectId: projectId!,
  });
  const [updateSettings, { isLoading: savingSettings, error: settingsError }] =
    useUpdateProjectSettingsMutation();
  const [updateProject, { isLoading: savingProject, error: projectError }] =
    useUpdateProjectMutation();
  const [transitionProject, { isLoading: transitioning }] = useTransitionProjectMutation();

  // ── Project metadata form ────────────────────────────────────────────────
  const {
    register: regMeta,
    handleSubmit: submitMeta,
    reset: resetMeta,
    setError: setMetaError,
    formState: { isDirty: metaDirty, errors: metaErrors },
  } = useForm({ defaultValues: { name: '', description: '' } });

  useEffect(() => {
    if (activeProject)
      resetMeta({ name: activeProject.name, description: activeProject.description ?? '' });
  }, [activeProject, resetMeta]);

  const onSaveMeta = async (data: { name: string; description: string }) => {
    if (!activeProject) return;
    try {
      await updateProject({
        orgId: orgId!,
        projectId: projectId!,
        body: {
          name: data.name,
          description: data.description || null,
          expectedVersion: activeProjectVersion,
        },
      }).unwrap();
      toastOk('Project updated', '');
    } catch (err) {
      const fieldErrors = getFieldValidationErrors(err as never);
      if (fieldErrors.name) {
        setMetaError('name', { type: 'server', message: fieldErrors.name });
      } else if (isToastError(err as never)) {
        toastErr('Save failed', toastErrorMessage(err as never));
      }
    }
  };

  const projectInlineErr =
    isInlineError(projectError) && Object.keys(getFieldValidationErrors(projectError)).length === 0
      ? getServerError(projectError)
      : null;

  // ── Settings form ────────────────────────────────────────────────────────
  const {
    register: regSet,
    control,
    handleSubmit: submitSettings,
    reset: resetSettings,
    setError: setSettingsError,
    formState: { isDirty: settingsDirty, errors: settingErrors },
  } = useForm<Omit<EffectiveProjectSettings, 'currency'>>({
    defaultValues: {
      timezone: '',
      locale: '',
      dateFormat: 'DD_MM_YYYY',
      timeFormat: 'H24',
      unitSystem: 'METRIC',
      weekStartsOn: 1,
    },
  });

  useEffect(() => {
    if (settingsData?.settings) {
      const { currency: _c, ...rest } = settingsData.settings;
      resetSettings(rest);
    }
  }, [settingsData, resetSettings]);

  const onSaveSettings = async (data: Omit<EffectiveProjectSettings, 'currency'>) => {
    try {
      await updateSettings({ orgId: orgId!, projectId: projectId!, body: data }).unwrap();
      toastOk('Settings saved', '');
    } catch (err) {
      const fieldErrors = getFieldValidationErrors(err as never);
      const settingsFields = [
        'timezone',
        'locale',
        'dateFormat',
        'timeFormat',
        'unitSystem',
        'weekStartsOn',
      ] as const;
      const invalidField = settingsFields.find((field) => fieldErrors[field]);
      if (invalidField) {
        setSettingsError(invalidField, { type: 'server', message: fieldErrors[invalidField] });
      } else if (isToastError(err as never)) {
        toastErr('Save failed', toastErrorMessage(err as never));
      }
    }
  };
  const settingsInlineErr =
    isInlineError(settingsError) &&
    Object.keys(getFieldValidationErrors(settingsError)).length === 0
      ? getServerError(settingsError)
      : null;

  if (isLoading || !activeProject)
    return (
      <div className="p-6 sm:p-8 space-y-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse bg-[var(--surface-2)] border border-[var(--hairline-2)]"
          />
        ))}
      </div>
    );

  return (
    <div className="p-6 sm:p-8 max-w-lg space-y-10">
      {/* Project details */}
      <section className="space-y-4">
        <div className="border-b border-[var(--hairline-2)] pb-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Project details
          </p>
        </div>
        {projectInlineErr && <InlineAlert variant="error" message={projectInlineErr.message} />}
        <form onSubmit={submitMeta(onSaveMeta)} noValidate className="space-y-4">
          <FormField label="Project name" error={metaErrors.name?.message} required>
            {(id, errorId) => (
              <input
                id={id}
                type="text"
                aria-invalid={!!metaErrors.name}
                aria-describedby={metaErrors.name ? errorId : undefined}
                className={inputCls(!!metaErrors.name)}
                {...regMeta('name', { required: 'Project name is required.' })}
              />
            )}
          </FormField>
          <FormField label="Description">
            {(id) => (
              <textarea
                id={id}
                rows={3}
                className={`${inputCls()} resize-none`}
                {...regMeta('description')}
              />
            )}
          </FormField>
          <button
            type="submit"
            disabled={savingProject || !metaDirty}
            className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
          >
            <Save className="h-4 w-4" strokeWidth={1.8} />
            {savingProject ? 'Saving…' : 'Save details'}
          </button>
        </form>
      </section>

      {/* Locale & format settings */}
      <section className="space-y-4">
        <div className="border-b border-[var(--hairline-2)] pb-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Locale &amp; formats
          </p>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Project-level overrides. Blank values fall back to organization settings.
          </p>
        </div>
        {settingsInlineErr && (
          <InlineAlert variant="error" message={settingsInlineErr.message} />
        )}

        <div className="border border-[var(--hairline-2)] bg-[var(--surface-2)] px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
              Currency
            </p>
            <p className="text-sm font-medium mt-0.5">
              {settingsData?.settings.currency ?? activeProject.currency}
            </p>
          </div>
          <p className="font-mono text-[9px] text-[var(--muted)]">
            From project row — edit in project details
          </p>
        </div>

        <form onSubmit={submitSettings(onSaveSettings)} noValidate className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Timezone" error={settingErrors.timezone?.message}>
              {(id, errorId) => (
                <input
                  id={id}
                  type="text"
                  placeholder="Asia/Karachi"
                  aria-invalid={!!settingErrors.timezone}
                  aria-describedby={settingErrors.timezone ? errorId : undefined}
                  className={inputCls(!!settingErrors.timezone)}
                  {...regSet('timezone')}
                />
              )}
            </FormField>
            <FormField label="Locale" error={settingErrors.locale?.message}>
              {(id, errorId) => (
                <input
                  id={id}
                  type="text"
                  placeholder="en-PK"
                  aria-invalid={!!settingErrors.locale}
                  aria-describedby={settingErrors.locale ? errorId : undefined}
                  className={inputCls(!!settingErrors.locale)}
                  {...regSet('locale')}
                />
              )}
            </FormField>
          </div>
          <FormField label="Date format" error={settingErrors.dateFormat?.message}>
            {(id, errorId) => (
              <Controller
                name="dateFormat"
                control={control}
                render={({ field }) => (
                  <CustomSelect
                    options={DATE_OPTIONS}
                    id={id}
                    value={field.value}
                    onChange={field.onChange}
                    error={!!settingErrors.dateFormat}
                    aria-invalid={!!settingErrors.dateFormat}
                    aria-describedby={settingErrors.dateFormat ? errorId : undefined}
                  />
                )}
              />
            )}
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Time format" error={settingErrors.timeFormat?.message}>
              {(id, errorId) => (
                <Controller
                  name="timeFormat"
                  control={control}
                  render={({ field }) => (
                    <CustomSelect
                      options={TIME_OPTIONS}
                      id={id}
                      value={field.value}
                      onChange={field.onChange}
                      error={!!settingErrors.timeFormat}
                      aria-invalid={!!settingErrors.timeFormat}
                      aria-describedby={settingErrors.timeFormat ? errorId : undefined}
                    />
                  )}
                />
              )}
            </FormField>
            <FormField label="Unit system" error={settingErrors.unitSystem?.message}>
              {(id, errorId) => (
                <Controller
                  name="unitSystem"
                  control={control}
                  render={({ field }) => (
                    <CustomSelect
                      options={UNIT_OPTIONS}
                      id={id}
                      value={field.value}
                      onChange={field.onChange}
                      error={!!settingErrors.unitSystem}
                      aria-invalid={!!settingErrors.unitSystem}
                      aria-describedby={settingErrors.unitSystem ? errorId : undefined}
                    />
                  )}
                />
              )}
            </FormField>
          </div>
          <button
            type="submit"
            disabled={savingSettings || !settingsDirty}
            className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
          >
            <Save className="h-4 w-4" strokeWidth={1.8} />
            {savingSettings ? 'Saving…' : 'Save settings'}
          </button>
        </form>
      </section>

      {/* Project lifecycle */}
      <section className="space-y-4">
        <div className="border-b border-[var(--hairline-2)] pb-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Lifecycle
          </p>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Current status: <span className="font-mono uppercase">{activeProject.status}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeProject.status === 'DRAFT' && (
            <button
              type="button"
              disabled={transitioning}
              onClick={() =>
                transitionProject({ orgId: orgId!, projectId: projectId!, transition: 'activate' })
                  .unwrap()
                  .then(() => toastOk('Project activated', ''))
                  .catch((e) => toastErr('Failed', toastErrorMessage(e as never)))
              }
              className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-3 py-1.5 hover:bg-[#dcfce7] disabled:opacity-50"
            >
              <Play className="h-3 w-3" strokeWidth={2} /> Activate
            </button>
          )}
          {activeProject.status === 'ACTIVE' && (
            <>
              <button
                type="button"
                disabled={transitioning}
                onClick={() =>
                  transitionProject({ orgId: orgId!, projectId: projectId!, transition: 'hold' })
                    .unwrap()
                    .then(() => toastOk('Project on hold', ''))
                    .catch((e) => toastErr('Failed', toastErrorMessage(e as never)))
                }
                className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase border border-[#fde68a] bg-[#fffbeb] text-[#92400e] px-3 py-1.5 hover:bg-[#fef3c7] disabled:opacity-50"
              >
                <Pause className="h-3 w-3" strokeWidth={2} /> Hold
              </button>
              <button
                type="button"
                disabled={transitioning}
                onClick={() => {
                  if (confirm('Mark this project as completed?'))
                    transitionProject({
                      orgId: orgId!,
                      projectId: projectId!,
                      transition: 'complete',
                    })
                      .unwrap()
                      .then(() => toastOk('Project completed', ''))
                      .catch((e) => toastErr('Failed', toastErrorMessage(e as never)));
                }}
                className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-3 py-1.5 hover:bg-[#dcfce7] disabled:opacity-50"
              >
                <CheckCircle className="h-3 w-3" strokeWidth={2} /> Complete
              </button>
            </>
          )}
          {activeProject.status === 'ON_HOLD' && (
            <button
              type="button"
              disabled={transitioning}
              onClick={() =>
                transitionProject({ orgId: orgId!, projectId: projectId!, transition: 'resume' })
                  .unwrap()
                  .then(() => toastOk('Project resumed', ''))
                  .catch((e) => toastErr('Failed', toastErrorMessage(e as never)))
              }
              className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase border border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af] px-3 py-1.5 hover:bg-[#dbeafe] disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" strokeWidth={2} /> Resume
            </button>
          )}
          {['ACTIVE', 'ON_HOLD', 'DRAFT'].includes(activeProject.status) && (
            <button
              type="button"
              disabled={transitioning}
              onClick={() => {
                if (confirm('Cancel this project? This cannot be undone.'))
                  transitionProject({ orgId: orgId!, projectId: projectId!, transition: 'cancel' })
                    .unwrap()
                    .then(() => toastOk('Project cancelled', ''))
                    .catch((e) => toastErr('Failed', toastErrorMessage(e as never)));
              }}
              className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase border border-[#fecaca] text-[#991b1b] px-3 py-1.5 hover:bg-[#fef2f2] disabled:opacity-50"
            >
              <XCircle className="h-3 w-3" strokeWidth={2} /> Cancel
            </button>
          )}
          {['COMPLETED', 'CANCELLED'].includes(activeProject.status) && (
            <button
              type="button"
              disabled={transitioning}
              onClick={() =>
                transitionProject({ orgId: orgId!, projectId: projectId!, transition: 'archive' })
                  .unwrap()
                  .then(() => toastOk('Project archived', ''))
                  .catch((e) => toastErr('Failed', toastErrorMessage(e as never)))
              }
              className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase border border-[var(--hairline-2)] text-[var(--muted)] px-3 py-1.5 hover:bg-[var(--surface-2)] disabled:opacity-50"
            >
              <Archive className="h-3 w-3" strokeWidth={2} /> Archive
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
