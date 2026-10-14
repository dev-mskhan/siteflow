/**
 * ProjectSettingsPage — /org/:orgId/projects/:projectId/settings
 * Shows EffectiveProjectSettings (merged project + org fallbacks).
 * Also shows editable project metadata (name, description) via PATCH /projects/:id.
 */
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { Save } from 'lucide-react';
import { useGetProjectSettingsQuery, useUpdateProjectSettingsMutation } from '../../../features/project/projectSettingsApi';
import { useUpdateProjectMutation } from '../../../features/project/projectApi';
import { useActiveProject } from '../../../features/project/useActiveProject';
import { FormField, inputCls } from '../../../components/ui/FormField';
import { CustomSelect } from '../../../components/ui/CustomSelect';
import { InlineAlert } from '../../../components/ui/InlineAlert';
import { useToast } from '../../../components/ui/Toast';
import { getServerError, isInlineError, isToastError, toastErrorMessage } from '../../../lib/authErrors';
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
  { value: 'METRIC',   label: 'Metric',   meta: 'kg, m, km' },
  { value: 'IMPERIAL', label: 'Imperial', meta: 'lb, ft, mi' },
];

export const ProjectSettingsPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { activeProject, activeProjectVersion } = useActiveProject();
  const { success: toastOk, error: toastErr } = useToast();

  const { data: settingsData, isLoading } = useGetProjectSettingsQuery({ orgId: orgId!, projectId: projectId! });
  const [updateSettings, { isLoading: savingSettings, error: settingsError }] = useUpdateProjectSettingsMutation();
  const [updateProject, { isLoading: savingProject, error: projectError }] = useUpdateProjectMutation();

  // ── Project metadata form ────────────────────────────────────────────────
  const {
    register: regMeta,
    handleSubmit: submitMeta,
    reset: resetMeta,
    formState: { isDirty: metaDirty },
  } = useForm({ defaultValues: { name: '', description: '' } });

  useEffect(() => {
    if (activeProject) resetMeta({ name: activeProject.name, description: activeProject.description ?? '' });
  }, [activeProject, resetMeta]);

  const onSaveMeta = async (data: { name: string; description: string }) => {
    if (!activeProject) return;
    try {
      await updateProject({ orgId: orgId!, projectId: projectId!, body: { name: data.name, description: data.description || null, expectedVersion: activeProjectVersion } }).unwrap();
      toastOk('Project updated', '');
    } catch (err) {
      if (isToastError(err as never)) toastErr('Save failed', toastErrorMessage(err as never));
    }
  };

  const projectInlineErr = isInlineError(projectError) ? getServerError(projectError) : null;

  // ── Settings form ────────────────────────────────────────────────────────
  const {
    register: regSet,
    control,
    handleSubmit: submitSettings,
    reset: resetSettings,
    formState: { isDirty: settingsDirty },
  } = useForm<Omit<EffectiveProjectSettings, 'currency'>>({
    defaultValues: { timezone: '', locale: '', dateFormat: 'DD_MM_YYYY', timeFormat: 'H24', unitSystem: 'METRIC', weekStartsOn: 1 },
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
      if (isToastError(err as never)) toastErr('Save failed', toastErrorMessage(err as never));
    }
  };

  if (isLoading || !activeProject) return (
    <div className="p-6 sm:p-8 space-y-2">
      {[1, 2].map((i) => <div key={i} className="h-24 animate-pulse bg-[var(--surface-2)] border border-[var(--hairline-2)]" />)}
    </div>
  );

  return (
    <div className="p-6 sm:p-8 max-w-lg space-y-10">

      {/* Project details */}
      <section className="space-y-4">
        <div className="border-b border-[var(--hairline-2)] pb-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Project details</p>
        </div>
        {projectInlineErr && <InlineAlert variant="error" message={projectInlineErr.message} />}
        <form onSubmit={submitMeta(onSaveMeta)} noValidate className="space-y-4">
          <FormField label="Project name" required>
            {(id) => <input id={id} type="text" className={inputCls()} {...regMeta('name', { required: true })} />}
          </FormField>
          <FormField label="Description">
            {(id) => <textarea id={id} rows={3} className={`${inputCls()} resize-none`} {...regMeta('description')} />}
          </FormField>
          <button type="submit" disabled={savingProject || !metaDirty}
            className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0">
            <Save className="h-4 w-4" strokeWidth={1.8} />
            {savingProject ? 'Saving…' : 'Save details'}
          </button>
        </form>
      </section>

      {/* Locale & format settings */}
      <section className="space-y-4">
        <div className="border-b border-[var(--hairline-2)] pb-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Locale &amp; formats</p>
          <p className="text-xs text-[var(--muted)] mt-0.5">Project-level overrides. Blank values fall back to organization settings.</p>
        </div>

        <div className="border border-[var(--hairline-2)] bg-[var(--surface-2)] px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">Currency</p>
            <p className="text-sm font-medium mt-0.5">{settingsData?.settings.currency ?? activeProject.currency}</p>
          </div>
          <p className="font-mono text-[9px] text-[var(--muted)]">From project row — edit in project details</p>
        </div>

        <form onSubmit={submitSettings(onSaveSettings)} noValidate className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Timezone">
              {(id) => <input id={id} type="text" placeholder="Asia/Karachi" className={inputCls()} {...regSet('timezone')} />}
            </FormField>
            <FormField label="Locale">
              {(id) => <input id={id} type="text" placeholder="en-PK" className={inputCls()} {...regSet('locale')} />}
            </FormField>
          </div>
          <FormField label="Date format">
            {() => <Controller name="dateFormat" control={control} render={({ field }) => (
              <CustomSelect options={DATE_OPTIONS} value={field.value} onChange={field.onChange} />
            )} />}
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Time format">
              {() => <Controller name="timeFormat" control={control} render={({ field }) => (
                <CustomSelect options={TIME_OPTIONS} value={field.value} onChange={field.onChange} />
              )} />}
            </FormField>
            <FormField label="Unit system">
              {() => <Controller name="unitSystem" control={control} render={({ field }) => (
                <CustomSelect options={UNIT_OPTIONS} value={field.value} onChange={field.onChange} />
              )} />}
            </FormField>
          </div>
          <button type="submit" disabled={savingSettings || !settingsDirty}
            className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0">
            <Save className="h-4 w-4" strokeWidth={1.8} />
            {savingSettings ? 'Saving…' : 'Save settings'}
          </button>
        </form>
      </section>
    </div>
  );
};
