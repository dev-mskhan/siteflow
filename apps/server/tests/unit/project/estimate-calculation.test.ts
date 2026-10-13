import { describe, expect, it } from 'vitest';
import { calculateEstimate, type EstimateDraftInput } from '../../../src/modules/project/estimate/estimate.calculation.js';
import { EstimateValidationError } from '../../../src/modules/project/estimate/estimate.errors.js';

const zeroTerms = {
  overheadPercent: '0',
  contingencyPercent: '0',
  markupMode: 'NONE' as const,
  markupPercent: '0',
  discountPercent: '0',
  taxPercent: '0',
  taxSource: null,
};

function draft(overrides: Partial<EstimateDraftInput['terms']> = {}, lines: EstimateDraftInput['sections'][number]['lines'] = []): EstimateDraftInput {
  return {
    title: 'Estimate',
    terms: { ...zeroTerms, ...overrides },
    sections: [{ title: 'Section', lines }],
  };
}

describe('calculateEstimate', () => {
  it('prices a direct-rate line', () => {
    const result = calculateEstimate(
      draft({}, [{ category: 'MATERIAL', description: 'Brick', quantity: '10', unit: 'm2', unitRate: '12.50' }]),
      'USD',
    );
    expect(result.directCostTotal).toBe('125.00');
    expect(result.totalAmount).toBe('125.00');
  });

  it('prices resource-built lines including waste', () => {
    const result = calculateEstimate(
      draft({}, [{
        category: 'LABOR',
        description: 'Wall',
        quantity: '2',
        unit: 'm2',
        resources: [{
          category: 'LABOR',
          description: 'Mason',
          unit: 'hr',
          quantityPerLineUnit: '1',
          unitRate: '50',
          wastePercent: '10',
        }],
      }]),
      'USD',
    );
    expect(result.sections[0]!.lines[0]!.directAmount).toBe('110.00');
  });

  it('applies overhead, contingency, markup, discount, and tax in order', () => {
    const result = calculateEstimate(
      draft(
        { overheadPercent: '10', contingencyPercent: '5', markupMode: 'MARKUP', markupPercent: '20', discountPercent: '0', taxPercent: '10', taxSource: 'VAT' },
        [{ category: 'OTHER', description: 'Item', quantity: '1', unit: 'ea', unitRate: '100' }],
      ),
      'USD',
    );
    expect(result.overheadAmount).toBe('10.00');
    expect(result.contingencyAmount).toBe('5.50');
    expect(result.markupAmount).toBe('23.10');
    expect(result.totalAmount).toBe('152.46');
  });

  it('uses target margin as base * m / (100 - m)', () => {
    const result = calculateEstimate(
      draft({ markupMode: 'TARGET_MARGIN', markupPercent: '20' }, [{ category: 'OTHER', description: 'Item', quantity: '1', unit: 'ea', unitRate: '80' }]),
      'USD',
    );
    expect(result.markupAmount).toBe('20.00');
    expect(result.totalAmount).toBe('100.00');
  });

  it('rejects a line with both direct rate and resources', () => {
    expect(() =>
      calculateEstimate(
        draft({}, [{
          category: 'OTHER',
          description: 'Mixed',
          quantity: '1',
          unit: 'ea',
          unitRate: '10',
          resources: [{ category: 'OTHER', description: 'r', unit: 'ea', quantityPerLineUnit: '1', unitRate: '1', wastePercent: '0' }],
        }]),
        'USD',
      ),
    ).toThrow(EstimateValidationError);
  });

  it('rejects a line with neither direct rate nor resources', () => {
    expect(() =>
      calculateEstimate(draft({}, [{ category: 'OTHER', description: 'Empty', quantity: '1', unit: 'ea' }]), 'USD'),
    ).toThrow(EstimateValidationError);
  });

  it('rejects zero or malformed quantities', () => {
    expect(() =>
      calculateEstimate(draft({}, [{ category: 'OTHER', description: 'Zero', quantity: '0', unit: 'ea', unitRate: '1' }]), 'USD'),
    ).toThrow(EstimateValidationError);
    expect(() =>
      calculateEstimate(draft({}, [{ category: 'OTHER', description: 'Bad', quantity: '1e3', unit: 'ea', unitRate: '1' }]), 'USD'),
    ).toThrow(EstimateValidationError);
  });
});
