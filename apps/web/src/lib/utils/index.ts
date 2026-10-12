/**
 * Shared utility functions for SiteFlow web application
 */

import { ApiError } from '../api/index';

/**
 * Combines conditional class names
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Formats a monetary value for Pakistan (PKR) or US (USD) standards.
 */
export function formatCurrency(amount: number | string | null | undefined, currency: 'USD' | 'PKR' | string = 'USD'): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '—';
  }
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (currency.toUpperCase() === 'PKR') {
    // Pakistan formatting (Lakhs & Crores or comma separated)
    return `PKR ${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(numericAmount)}`;
  }

  // Default USD
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericAmount);
}

/**
 * Formats construction units for US & Pakistan project operations
 */
export function formatUnit(quantity: number, unit: string): string {
  return `${quantity.toLocaleString()} ${unit}`;
}

/**
 * Formats standard ISO dates to clean human-readable date
 */
export function formatDate(dateString?: string | Date | null): string {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Extracts a user-friendly error message from any error object
 */
export function extractErrorMessage(err: unknown): string {
  if (!err) return 'An unexpected error occurred';
  if (typeof err === 'string') return err;
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return 'An unexpected error occurred';
}
