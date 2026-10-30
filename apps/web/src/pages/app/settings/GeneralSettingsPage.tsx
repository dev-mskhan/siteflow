/**
 * GeneralSettingsPage — /org/:orgId/settings
 * GET/PATCH /organizations/:orgId/settings
 * Permission: settings:read (view) / settings:update (save)
 */
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save } from 'lucide-react';
import { FormField, inputCls } from '../../../components/ui/FormField';
import { CustomSelect } from '../../../components/ui/CustomSelect';
import { InlineAlert } from '../../../components/ui/InlineAlert';
import { PermissionGate } from '../../../components/guards/PermissionGate';
import { useGetSettingsQuery, useUpdateSettingsMutation } from '../../../features/org/settingsApi';
import { getServerError, isInlineError, isToastError, toastErrorMessage } from '../../../lib/authErrors';
import { useToast } from '../../../components/ui/Toast';

const schema = z.object({
  timezone:             z.string().min(1),
  currency:             z.string().length(3, 'Must be a 3-letter ISO code (e.g. USD)').toUpperCase(),
  locale:               z.string().min(1),
  dateFormat:           z.enum(['DD_MM_YYYY', 'MM_DD_YYYY', 'YYYY_MM_DD']),
  timeFormat:           z.enum(['H12', 'H24']),
  unitSystem:           z.enum(['METRIC', 'IMPERIAL']),
  weekStartsOn:         z.coerce.number().int().min(0).max(6),
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12),
});
type FormData = z.infer<typeof schema>;

const DATE_FORMAT_OPTIONS = [
  { value: 'DD_MM_YYYY',  label: 'DD/MM/YYYY',  meta: 'Day first (Pakistan, UK)' },
  { value: 'MM_DD_YYYY',  label: 'MM/DD/YYYY',  meta: 'Month first (US)' },
  { value: 'YYYY_MM_DD',  label: 'YYYY-MM-DD',  meta: 'ISO 8601' },
];
const TIME_FORMAT_OPTIONS  = [
  { value: 'H24', label: '24-hour', meta: '13:00' },
  { value: 'H12', label: '12-hour', meta: '1:00 PM' },
];
const UNIT_SYSTEM_OPTIONS  = [
  { value: 'METRIC',   label: 'Metric',   meta: 'kg, m, km' },
  { value: 'IMPERIAL', label: 'Imperial', meta: 'lb, ft, mi' },
];
const WEEK_DAY_OPTIONS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '6', label: 'Saturday' },
];
const MONTH_OPTIONS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
].map((m, i) => ({ value: String(i + 1), label: m }));

const CURRENCY_SUGGESTIONS = [
  { value: 'PKR', label: 'Pakistani rupee' },
  { value: 'USD', label: 'US dollar' },
];

const LOCALE_SUGGESTIONS = [
  { value: 'en-PK', label: 'English (Pakistan)' },
  { value: 'ur-PK', label: 'Urdu (Pakistan)' },
  { value: 'en-US', label: 'English (United States)' },
  { value: 'es-US', label: 'Spanish (United States)' },
];

const TIMEZONE_SUGGESTIONS = [
  { value: 'Asia/Karachi', label: 'Pakistan Standard Time (UTC+05:00)' },
  { value: 'America/New_York', label: 'US Eastern Time' },
  { value: 'America/Chicago', label: 'US Central Time' },
  { value: 'America/Denver', label: 'US Mountain Time' },
  { value: 'America/Phoenix', label: 'US Mountain Time (Arizona)' },
  { value: 'America/Los_Angeles', label: 'US Pacific Time' },
  { value: 'America/Anchorage', label: 'Alaska Time' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time' },
  { value: 'Etc/UTC', label: 'Coordinated Universal Time' },
];

export const GeneralSettingsPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const { success: toastOk, error: toastErr } = useToast();

  const { data, isLoading } = useGetSettingsQuery(orgId!);
  const [updateSettings, { isLoading: saving, error }] = useUpdateSettingsMutation();

  const { register, control, handleSubmit, reset, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (data?.settings) reset(data.settings as FormData);
  }, [data, reset]);

  useEffect(() => {
    if (error && isToastError(error)) toastErr('Save failed', toastErrorMessage(error));
  }, [error, toastErr]);

  const inlineErr = isInlineError(error) ? getServerError(error) : null;

  const onSubmit = async (formData: FormData) => {
    try {
      await updateSettings({ orgId: orgId!, body: formData }).unwrap();
      toastOk('Settings saved', 'Your organization settings have been updated.');
    } catch { /* handled */ }
  };

  if (isLoading) return <div className="h-40 animate-pulse bg-[var(--surface-2)] border border-[var(--hairline-2)]" />;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-lg space-y-5">
      {inlineErr && <InlineAlert variant="error" message={inlineErr.message} />}

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Currency"
          error={errors.currency?.message}
          hint="Pakistan: PKR · United States: USD. Enter another 3-letter code if needed."
          required
        >
          {(id, _errorId, hintId) => (
            <>
              <input
                id={id}
                list={`${id}-options`}
                aria-describedby={hintId}
                autoCapitalize="characters"
                maxLength={3}
                className={inputCls(!!errors.currency)}
                placeholder="Select or enter a code"
                {...register('currency')}
              />
              <datalist id={`${id}-options`}>
                {CURRENCY_SUGGESTIONS.map(({ value, label }) => (
                  <option key={value} value={value} label={label} />
                ))}
              </datalist>
            </>
          )}
        </FormField>
        <FormField
          label="Locale"
          error={errors.locale?.message}
          hint="Choose a language and region, or enter another locale."
          required
        >
          {(id, _errorId, hintId) => (
            <>
              <input
                id={id}
                list={`${id}-options`}
                aria-describedby={hintId}
                className={inputCls(!!errors.locale)}
                placeholder="Select or enter a locale"
                {...register('locale')}
              />
              <datalist id={`${id}-options`}>
                {LOCALE_SUGGESTIONS.map(({ value, label }) => (
                  <option key={value} value={value} label={label} />
                ))}
              </datalist>
            </>
          )}
        </FormField>
      </div>

      <FormField
        label="Timezone"
        error={errors.timezone?.message}
        hint="Pakistan: Asia/Karachi. US choices include Eastern, Central, Mountain, and Pacific. Other IANA timezones are accepted."
        required
      >
        {(id, _errorId, hintId) => (
          <>
            <input
              id={id}
              list={`${id}-options`}
              aria-describedby={hintId}
              className={inputCls(!!errors.timezone)}
              placeholder="Select or enter a timezone"
              {...register('timezone')}
            />
            <datalist id={`${id}-options`}>
              {TIMEZONE_SUGGESTIONS.map(({ value, label }) => (
                <option key={value} value={value} label={label} />
              ))}
            </datalist>
          </>
        )}
      </FormField>

      <FormField label="Date format" error={errors.dateFormat?.message} required>
        {() => (
          <Controller name="dateFormat" control={control} render={({ field }) => (
            <CustomSelect options={DATE_FORMAT_OPTIONS} value={field.value} onChange={field.onChange} error={!!errors.dateFormat} />
          )} />
        )}
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Time format" error={errors.timeFormat?.message} required>
          {() => (
            <Controller name="timeFormat" control={control} render={({ field }) => (
              <CustomSelect options={TIME_FORMAT_OPTIONS} value={field.value} onChange={field.onChange} error={!!errors.timeFormat} />
            )} />
          )}
        </FormField>
        <FormField label="Unit system" error={errors.unitSystem?.message} required>
          {() => (
            <Controller name="unitSystem" control={control} render={({ field }) => (
              <CustomSelect options={UNIT_SYSTEM_OPTIONS} value={field.value} onChange={field.onChange} error={!!errors.unitSystem} />
            )} />
          )}
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Week starts on" error={errors.weekStartsOn?.message} required>
          {() => (
            <Controller name="weekStartsOn" control={control} render={({ field }) => (
              <CustomSelect options={WEEK_DAY_OPTIONS} value={String(field.value)} onChange={(v) => field.onChange(Number(v))} error={!!errors.weekStartsOn} />
            )} />
          )}
        </FormField>
        <FormField label="Fiscal year starts" error={errors.fiscalYearStartMonth?.message} required>
          {() => (
            <Controller name="fiscalYearStartMonth" control={control} render={({ field }) => (
              <CustomSelect options={MONTH_OPTIONS} value={String(field.value)} onChange={(v) => field.onChange(Number(v))} error={!!errors.fiscalYearStartMonth} />
            )} />
          )}
        </FormField>
      </div>

      <PermissionGate require="settings:update">
        <button
          type="submit"
          disabled={saving || !isDirty}
          className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
        >
          <Save className="h-4 w-4" strokeWidth={1.8} />
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </PermissionGate>
    </form>
  );
};
