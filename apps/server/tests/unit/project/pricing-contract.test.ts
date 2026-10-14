import { describe, expect, it } from 'vitest';
import {
  materialRateResolveQuerySchema,
  materialRateVersionCreateSchema,
  materialRateVersionRetireSchema,
} from '@siteflow/shared';

const base = {
  materialId: 'mat-1',
  scope: 'ORGANIZATION' as const,
  unitCode: 'M3',
  unitPrice: '12.5000',
  currencyCode: 'USD',
  effectiveFrom: '2026-01-01',
};

describe('materialRateVersionCreateSchema', () => {
  it('accepts an organization rate with a 4-digit decimal price', () => {
    expect(materialRateVersionCreateSchema.safeParse(base).success).toBe(true);
  });

  it('rejects more than four fraction digits', () => {
    expect(materialRateVersionCreateSchema.safeParse({ ...base, unitPrice: '1.23456' }).success).toBe(false);
  });

  it('rejects negative or non-numeric prices', () => {
    expect(materialRateVersionCreateSchema.safeParse({ ...base, unitPrice: '-1' }).success).toBe(false);
    expect(materialRateVersionCreateSchema.safeParse({ ...base, unitPrice: 'abc' }).success).toBe(false);
  });

  it('requires projectId for PROJECT scope and forbids it for ORGANIZATION scope', () => {
    expect(materialRateVersionCreateSchema.safeParse({ ...base, scope: 'PROJECT' }).success).toBe(false);
    expect(
      materialRateVersionCreateSchema.safeParse({ ...base, scope: 'PROJECT', projectId: 'proj-1' }).success,
    ).toBe(true);
    expect(materialRateVersionCreateSchema.safeParse({ ...base, projectId: 'proj-1' }).success).toBe(false);
  });

  it('requires effectiveTo to be after effectiveFrom', () => {
    expect(materialRateVersionCreateSchema.safeParse({ ...base, effectiveTo: '2026-01-01' }).success).toBe(false);
    expect(materialRateVersionCreateSchema.safeParse({ ...base, effectiveTo: '2026-02-01' }).success).toBe(true);
  });

  it('rejects unknown fields', () => {
    expect(materialRateVersionCreateSchema.safeParse({ ...base, status: 'APPROVED' }).success).toBe(false);
  });
});

describe('materialRateVersionRetireSchema', () => {
  it('requires a single ISO effectiveTo date', () => {
    expect(materialRateVersionRetireSchema.safeParse({ effectiveTo: '2026-06-30' }).success).toBe(true);
    expect(materialRateVersionRetireSchema.safeParse({ effectiveTo: '30/06/2026' }).success).toBe(false);
    expect(materialRateVersionRetireSchema.safeParse({}).success).toBe(false);
  });
});

describe('materialRateResolveQuerySchema', () => {
  it('requires materialId and asOf', () => {
    expect(materialRateResolveQuerySchema.safeParse({ materialId: 'mat-1', asOf: '2026-03-01' }).success).toBe(true);
    expect(materialRateResolveQuerySchema.safeParse({ materialId: 'mat-1' }).success).toBe(false);
  });
});
