import { describe, expect, it } from 'vitest';
import {
  BOQ_CSV_MAX_ROWS,
  escapeCsvCell,
  parseCsvRecords,
  validateBoqCsv,
} from '../../../src/modules/project/boq/boq.csv.js';

const HEADER = 'item_key,section_key,description,unit,quantity,unit_rate';

describe('BOQ CSV parser', () => {
  it('parses quoted fields with embedded commas, quotes and CRLF', () => {
    const records = parseCsvRecords('a,"b, ""c""",d\r\n1,2,3\r\n');
    expect(records).toEqual([
      ['a', 'b, "c"', 'd'],
      ['1', '2', '3'],
    ]);
  });

  it('reports an unterminated quoted field', () => {
    const result = validateBoqCsv(`${HEADER}\nA1,S1,"open,m2,1,1`, 'USD');
    expect(result.ok).toBe(false);
  });
});

describe('BOQ CSV validation', () => {
  it('accepts a valid file and computes amounts with half-up rounding', () => {
    const result = validateBoqCsv(`${HEADER}\nA1,S1,    Concrete slab,m3,2.5,10.01\n`, 'USD');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0]).toMatchObject({
      itemKey: 'A1',
      sectionKey: 'S1',
      quantity: '2.500',
          unitRate: '10.01',
          amount: '25.03',
      costCode: null,
    });
  });

  it('rejects missing required columns', () => {
    const result = validateBoqCsv('item_key,section_key\nA1,S1\n', 'USD');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => e.column)).toContain('description');
  });

  it('rejects unknown columns', () => {
    const result = validateBoqCsv(`${HEADER},weird\nA1,S1,x,m,1,1,z\n`, 'USD');
    expect(result.ok).toBe(false);
  });

  it('rejects duplicate item keys and non-positive quantities', () => {
    const result = validateBoqCsv(
      `${HEADER}\nA1,S1,x,m,1,1\nA1,S1,y,m,0,1\n`,
      'USD',
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const messages = result.errors.map((e) => `${e.row}:${e.column}`);
    expect(messages).toContain('3:item_key');
    expect(messages).toContain('3:quantity');
  });

  it('rejects a currency that does not match the BOQ currency', () => {
    const result = validateBoqCsv(`currency,${HEADER}\nEUR,A1,S1,x,m,1,1\n`, 'USD');
    expect(result.ok).toBe(false);
  });

  it('rejects files above the row limit', () => {
    const rows = Array.from({ length: BOQ_CSV_MAX_ROWS + 1 }, (_, i) => `K${i},S1,x,m,1,1`).join('\n');
    const result = validateBoqCsv(`${HEADER}\n${rows}\n`, 'USD');
    expect(result.ok).toBe(false);
  });

  it('rejects a bad decimal rate', () => {
    const result = validateBoqCsv(`${HEADER}\nA1,S1,x,m,1,1.23456\n`, 'USD');
    expect(result.ok).toBe(false);
  });
});

describe('escapeCsvCell', () => {
  it('neutralises spreadsheet formula prefixes', () => {
    expect(escapeCsvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(escapeCsvCell('+1')).toBe("'+1");
    expect(escapeCsvCell('@cmd')).toBe("'@cmd");
  });

  it('quotes values containing commas or quotes', () => {
    expect(escapeCsvCell('a,"b"')).toBe('"a,""b"""');
  });
});
