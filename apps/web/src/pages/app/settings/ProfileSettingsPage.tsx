/**
 * ProfileSettingsPage — /org/:orgId/settings/profile
 * GET/PATCH /organizations/:orgId/profile
 * Permission: organization:read (view) / organization:update (save)
 */
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { Save } from 'lucide-react';
import { FormField, inputCls } from '../../../components/ui/FormField';
import { CustomSelect } from '../../../components/ui/CustomSelect';
import { PermissionGate } from '../../../components/guards/PermissionGate';
import { useGetProfileQuery, useUpdateProfileMutation, type BusinessType } from '../../../features/org/profileApi';
import { isToastError, toastErrorMessage } from '../../../lib/authErrors';
import { useToast } from '../../../components/ui/Toast';

const BUSINESS_TYPE_OPTIONS = [
  { value: 'GENERAL_CONTRACTOR',  label: 'General Contractor' },
  { value: 'SUBCONTRACTOR',       label: 'Subcontractor' },
  { value: 'SPECIALTY_CONTRACTOR',label: 'Specialty Contractor' },
  { value: 'DESIGN_BUILD',        label: 'Design-Build' },
  { value: 'DEVELOPER',           label: 'Developer' },
  { value: 'CONSULTANT',          label: 'Consultant' },
  { value: 'OTHER',               label: 'Other' },
];

interface FormData {
  legalName: string;
  businessName: string;
  businessType: BusinessType | '';
  registrationNumber: string;
  taxIdentificationNumber: string;
  primaryEmail: string;
  primaryPhone: string;
  secondaryPhone: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
}

export const ProfileSettingsPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const { success: toastOk, error: toastErr } = useToast();

  const { data, isLoading } = useGetProfileQuery(orgId!);
  const [updateProfile, { isLoading: saving, error }] = useUpdateProfileMutation();

  const { register, control, handleSubmit, reset, formState: { isDirty } } = useForm<FormData>({
    defaultValues: {
      legalName: '', businessName: '', businessType: '', registrationNumber: '',
      taxIdentificationNumber: '', primaryEmail: '', primaryPhone: '', secondaryPhone: '',
      website: '', addressLine1: '', addressLine2: '', city: '', stateProvince: '',
      postalCode: '', country: '',
    },
  });

  useEffect(() => {
    if (data?.profile) {
      const p = data.profile;
      reset({
        legalName: p.legalName ?? '',
        businessName: p.businessName ?? '',
        businessType: (p.businessType as BusinessType) ?? '',
        registrationNumber: p.registrationNumber ?? '',
        taxIdentificationNumber: p.taxIdentificationNumber ?? '',
        primaryEmail: p.primaryEmail ?? '',
        primaryPhone: p.primaryPhone ?? '',
        secondaryPhone: p.secondaryPhone ?? '',
        website: p.website ?? '',
        addressLine1: p.addressLine1 ?? '',
        addressLine2: p.addressLine2 ?? '',
        city: p.city ?? '',
        stateProvince: p.stateProvince ?? '',
        postalCode: p.postalCode ?? '',
        country: p.country ?? '',
      });
    }
  }, [data, reset]);

  useEffect(() => {
    if (error && isToastError(error)) toastErr('Save failed', toastErrorMessage(error));
  }, [error, toastErr]);

  const onSubmit = async (formData: FormData) => {
    try {
      await updateProfile({
        orgId: orgId!,
        body: {
          ...formData,
          businessType: formData.businessType as BusinessType || null,
        },
      }).unwrap();
      toastOk('Profile saved', 'Organization profile has been updated.');
    } catch { /* handled */ }
  };

  if (isLoading) return <div className="h-80 animate-pulse bg-[var(--surface-2)] border border-[var(--hairline-2)]" />;

  const text = (field: keyof FormData, label: string, placeholder?: string) => (
    <FormField label={label}>
      {(id) => (
        <input id={id} type="text" placeholder={placeholder} className={inputCls()} {...register(field)} />
      )}
    </FormField>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-2xl space-y-6">

      {/* Business info */}
      <section className="space-y-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Business information</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {text('legalName',    'Legal name',    'Khan Construction LLC')}
          {text('businessName', 'Trading name',  'Khan Civil Works')}
        </div>
        <FormField label="Business type">
          {() => (
            <Controller name="businessType" control={control} render={({ field }) => (
              <CustomSelect
                options={[{ value: '', label: 'Select type' }, ...BUSINESS_TYPE_OPTIONS]}
                value={field.value}
                onChange={field.onChange}
              />
            )} />
          )}
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {text('registrationNumber',      'Registration number', 'REG-123456')}
          {text('taxIdentificationNumber', 'Tax ID (NTN / EIN)',  '1234567-8')}
        </div>
      </section>

      {/* Contact */}
      <section className="border-t border-[var(--hairline-2)] pt-6 space-y-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Contact</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {text('primaryEmail',   'Primary email',    'admin@company.com')}
          {text('primaryPhone',   'Primary phone',    '+92 300 1234567')}
          {text('secondaryPhone', 'Secondary phone',  '+92 321 7654321')}
          {text('website',        'Website',          'https://company.com')}
        </div>
      </section>

      {/* Address */}
      <section className="border-t border-[var(--hairline-2)] pt-6 space-y-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Address</p>
        {text('addressLine1',  'Address line 1', '123 Main Street')}
        {text('addressLine2',  'Address line 2', 'Suite 4B (optional)')}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {text('city',          'City',           'Lahore')}
          {text('stateProvince', 'State / Province','Punjab')}
          {text('postalCode',    'Postal code',    '54000')}
          {text('country',       'Country (ISO)',  'PK')}
        </div>
      </section>

      <PermissionGate require="organization:update">
        <button
          type="submit"
          disabled={saving || !isDirty}
          className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
        >
          <Save className="h-4 w-4" strokeWidth={1.8} />
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </PermissionGate>
    </form>
  );
};
