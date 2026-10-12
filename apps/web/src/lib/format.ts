/**
 * Formatting helpers for Money, Dates, and Units
 * Plain, predictable formatting for construction managers in Pakistan and US.
 */

export type CurrencyCode = 'PKR' | 'USD';

/**
 * Format currency with proper locale convention:
 * PKR: "PKR 148,500,000" or short "PKR 14.85 Cr" / "PKR 98.2M"
 * USD: "$2,850,000.00" or short "$2.85M"
 */
export function formatMoney(
  amount: number,
  currency: CurrencyCode = 'PKR',
  options?: { compact?: boolean; hideDecimals?: boolean }
): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return currency === 'PKR' ? 'PKR 0' : '$0';
  }

  if (options?.compact) {
    if (currency === 'PKR') {
      if (Math.abs(amount) >= 10000000) {
        return `PKR ${(amount / 10000000).toFixed(2)} Cr`;
      }
      if (Math.abs(amount) >= 100000) {
        return `PKR ${(amount / 100000).toFixed(2)} Lakh`;
      }
      return `PKR ${amount.toLocaleString('en-PK')}`;
    } else {
      if (Math.abs(amount) >= 1000000) {
        return `$${(amount / 1000000).toFixed(2)}M`;
      }
      if (Math.abs(amount) >= 1000) {
        return `$${(amount / 1000).toFixed(1)}k`;
      }
      return `$${amount.toLocaleString('en-US')}`;
    }
  }

  const fractionDigits = options?.hideDecimals || amount % 1 === 0 ? 0 : 2;

  if (currency === 'PKR') {
    return `PKR ${amount.toLocaleString('en-PK', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })}`;
  }

  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/**
 * Format Date to clear readable construction format:
 * "12 Oct 2026" or "12 Oct 2026, 04:30 PM"
 */
export function formatDate(
  dateInput: string | Date | number,
  includeTime: boolean = false
): string {
  if (!dateInput) return '—';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '—';

  const day = date.getDate();
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  if (!includeTime) {
    return `${day} ${month} ${year}`;
  }

  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;

  return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
}

/**
 * Format physical quantity with unit label:
 * e.g., 45.5, "Ton" -> "45.5 Ton"
 */
export function formatUnit(quantity: number, unit: string): string {
  const formattedQty = quantity.toLocaleString('en-US', {
    maximumFractionDigits: 2,
  });
  return `${formattedQty} ${unit}`;
}
