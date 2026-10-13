import { Decimal } from 'decimal.js';
import { BOQ_CSV_MAX_BYTES } from '@siteflow/shared';

export { BOQ_CSV_MAX_BYTES };
export const BOQ_CSV_MAX_ROWS = 2000;
const MAX_REPORTED_ERRORS = 100;

const REQUIRED_HEADERS = ['item_key', 'section_key', 'description', 'unit', 'quantity', 'unit_rate'] as const;
const OPTIONAL_HEADERS = ['specification', 'currency', 'cost_code'] as const;
const KEY_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const QUANTITY_PATTERN = /^\d{1,9}(\.\d{1,3})?$/;
const RATE_PATTERN = /^\d{1,11}(\.\d{1,2})?$/;
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

export type BoqCsvError = { row: number; column: string | null; message: string };

export type BoqCsvRow = {
  row: number;
  itemKey: string;
  sectionKey: string;
  description: string;
  specification: string | null;
  unit: string;
  quantity: string;
  unitRate: string;
  amount: string;
  costCode: string | null;
};

export type BoqCsvResult =
  | { ok: true; rows: BoqCsvRow[] }
  | { ok: false; errors: BoqCsvError[] };

export function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      record.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (inQuotes) {
    return [['__UNTERMINATED_QUOTE__']];
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records.filter((r) => !(r.length === 1 && r[0] === ''));
}

export function escapeCsvCell(value: string): string {
  const safe = FORMULA_PREFIXES.some((p) => value.startsWith(p)) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function validateBoqCsv(text: string, currencyCode: string): BoqCsvResult {
  if (Buffer.byteLength(text, 'utf8') > BOQ_CSV_MAX_BYTES) {
    return { ok: false, errors: [{ row: 0, column: null, message: 'File exceeds the 2 MiB limit.' }] };
  }
  const records = parseCsvRecords(text.replace(/^\uFEFF/, ''));
  const errors: BoqCsvError[] = [];
  const push = (e: BoqCsvError) => {
    if (errors.length < MAX_REPORTED_ERRORS) errors.push(e);
  };

  if (records.length === 0) {
    return { ok: false, errors: [{ row: 0, column: null, message: 'File is empty.' }] };
  }
  if (records[0]!.length === 1 && records[0]![0] === '__UNTERMINATED_QUOTE__') {
    return { ok: false, errors: [{ row: 0, column: null, message: 'Unterminated quoted field.' }] };
  }

  const header = records[0]!.map((h) => h.trim().toLowerCase());
  const index = new Map<string, number>();
  header.forEach((h, i) => {
    if (index.has(h)) push({ row: 0, column: h, message: 'Duplicate column header.' });
    index.set(h, i);
  });
  for (const col of REQUIRED_HEADERS) {
    if (!index.has(col)) push({ row: 0, column: col, message: 'Required column is missing.' });
  }
  const allowed = new Set<string>([...REQUIRED_HEADERS, ...OPTIONAL_HEADERS]);
  for (const h of header) {
    if (!allowed.has(h)) push({ row: 0, column: h, message: 'Unknown column.' });
  }
  if (errors.length > 0) return { ok: false, errors };

  const dataRecords = records.slice(1);
  if (dataRecords.length === 0) {
    return { ok: false, errors: [{ row: 0, column: null, message: 'File has no data rows.' }] };
  }
  if (dataRecords.length > BOQ_CSV_MAX_ROWS) {
    return {
      ok: false,
      errors: [{ row: 0, column: null, message: `File exceeds the ${BOQ_CSV_MAX_ROWS} row limit.` }],
    };
  }

  const get = (rec: string[], col: string) => {
    const i = index.get(col);
    return i === undefined ? '' : (rec[i] ?? '').trim();
  };

  const seenKeys = new Set<string>();
  const rows: BoqCsvRow[] = [];
  dataRecords.forEach((rec, idx) => {
    const row = idx + 2;
    const itemKey = get(rec, 'item_key');
    const sectionKey = get(rec, 'section_key');
    const description = get(rec, 'description');
    const specification = get(rec, 'specification');
    const unit = get(rec, 'unit');
    const quantityRaw = get(rec, 'quantity');
    const rateRaw = get(rec, 'unit_rate');
    const currency = get(rec, 'currency');
    const costCode = get(rec, 'cost_code');
    const before = errors.length;

    if (!KEY_PATTERN.test(itemKey)) push({ row, column: 'item_key', message: 'Use 1-64 letters, digits, dot, dash or underscore.' });
    if (!KEY_PATTERN.test(sectionKey)) push({ row, column: 'section_key', message: 'Use 1-64 letters, digits, dot, dash or underscore.' });
    if (itemKey && seenKeys.has(itemKey)) push({ row, column: 'item_key', message: 'Duplicate item_key in file.' });
    seenKeys.add(itemKey);
    if (description.length < 1 || description.length > 500) push({ row, column: 'description', message: 'Description must be 1-500 characters.' });
    if (specification.length > 2000) push({ row, column: 'specification', message: 'Specification must be at most 2000 characters.' });
    if (unit.length < 1 || unit.length > 16) push({ row, column: 'unit', message: 'Unit must be 1-16 characters.' });
    if (!QUANTITY_PATTERN.test(quantityRaw) || new Decimal(quantityRaw || 0).lte(0)) {
      push({ row, column: 'quantity', message: 'Quantity must be a positive number with at most 3 decimals.' });
    }
    if (!RATE_PATTERN.test(rateRaw)) push({ row, column: 'unit_rate', message: 'Unit rate must be a non-negative number with at most 2 decimals.' });
    if (currency && currency.toUpperCase() !== currencyCode) push({ row, column: 'currency', message: `Currency must match the BOQ currency ${currencyCode}.` });
    if (costCode.length > 64) push({ row, column: 'cost_code', message: 'Cost code must be at most 64 characters.' });

    if (errors.length === before) {
      const quantity = new Decimal(quantityRaw);
      const rate = new Decimal(rateRaw);
      rows.push({
        row,
        itemKey,
        sectionKey,
        description,
        specification: specification || null,
        unit,
        quantity: quantity.toFixed(3),
        unitRate: rate.toFixed(2),
        amount: quantity.mul(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
        costCode: costCode ? costCode.toUpperCase() : null,
      });
    }
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, rows };
}
