import { Decimal } from 'decimal.js';
import { formatMoney, parseNonNegativeMoney } from '../../../lib/commercial/money.js';
import { EstimateValidationError } from './estimate.errors.js';

export type EstimateCostCategory =
  | 'MATERIAL'
  | 'LABOR'
  | 'EQUIPMENT'
  | 'SUBCONTRACTOR'
  | 'OTHER';

export type EstimateResourceInput = {
  category: EstimateCostCategory;
  description: string;
  unit: string;
  quantityPerLineUnit: string;
  unitRate: string;
  wastePercent: string;
  rateSource?: string | null;
};

export type EstimateLineInput = {
  category: EstimateCostCategory;
  description: string;
  specification?: string | null;
  costCodeId?: string | null;
  quantity: string;
  unit: string;
  unitRate?: string | null;
  resources?: EstimateResourceInput[];
};

export type EstimateTerms = {
  overheadPercent: string;
  contingencyPercent: string;
  markupMode: 'NONE' | 'MARKUP' | 'TARGET_MARGIN';
  markupPercent: string;
  discountPercent: string;
  taxPercent: string;
  taxSource?: string | null;
};

export type EstimateSectionInput = {
  title: string;
  description?: string | null;
  lines: EstimateLineInput[];
};

export type EstimateDraftInput = {
  title: string;
  description?: string | null;
  terms: EstimateTerms;
  sections: EstimateSectionInput[];
};

export type CalculatedEstimateResource = EstimateResourceInput & {
  extendedAmount: string;
};

export type CalculatedEstimateLine = Omit<EstimateLineInput, 'resources'> & {
  directAmount: string;
  resources: CalculatedEstimateResource[];
};

export type CalculatedEstimateSection = Omit<EstimateSectionInput, 'lines'> & {
  lines: CalculatedEstimateLine[];
};

export type EstimateCalculation = {
  currencyCode: string;
  sections: CalculatedEstimateSection[];
  directCostTotal: string;
  overheadAmount: string;
  contingencyAmount: string;
  markupAmount: string;
  discountAmount: string;
  taxableAmount: string;
  taxAmount: string;
  totalAmount: string;
};

const HUNDRED = new Decimal(100);
const QTY_PATTERN = /^\d{1,12}(?:\.\d{1,6})?$/;

function parseQuantity(value: string): Decimal {
  if (!QTY_PATTERN.test(value)) {
    throw new EstimateValidationError('Invalid estimate quantity.');
  }
  const quantity = new Decimal(value);
  if (!quantity.isFinite() || quantity.lte(0)) {
    throw new EstimateValidationError('Estimate quantity must be greater than zero.');
  }
  return quantity;
}

function percent(value: string): Decimal {
  return parseNonNegativeMoney(value);
}

function roundMoney(value: Decimal): Decimal {
  return new Decimal(formatMoney(value));
}

function applyPercent(value: Decimal, percentage: string): Decimal {
  return roundMoney(value.mul(percent(percentage)).div(HUNDRED));
}

function calculateLine(line: EstimateLineInput): CalculatedEstimateLine {
  const quantity = parseQuantity(line.quantity);
  const resources = (line.resources ?? []).map((resource) => {
    const extendedAmount = roundMoney(
      quantity
        .mul(parseQuantity(resource.quantityPerLineUnit))
        .mul(parseNonNegativeMoney(resource.unitRate))
        .mul(new Decimal(1).plus(percent(resource.wastePercent).div(HUNDRED))),
    );
    return { ...resource, extendedAmount: formatMoney(extendedAmount) };
  });

  if (line.unitRate != null && resources.length > 0) {
    throw new EstimateValidationError('Use a direct unit rate or resource components, not both.');
  }
  if (line.unitRate == null && resources.length === 0) {
    throw new EstimateValidationError(
      'Each estimate line requires a direct unit rate or resource components.',
    );
  }

  const directAmount =
    line.unitRate == null
      ? roundMoney(
          resources.reduce(
            (total, resource) => total.plus(parseNonNegativeMoney(resource.extendedAmount)),
            new Decimal(0),
          ),
        )
      : roundMoney(quantity.mul(parseNonNegativeMoney(line.unitRate)));

  return {
    ...line,
    directAmount: formatMoney(directAmount),
    resources,
  };
}

export function calculateEstimate(
  input: EstimateDraftInput,
  currencyCode: string,
): EstimateCalculation {
  const sections = input.sections.map((section) => ({
    ...section,
    lines: section.lines.map(calculateLine),
  }));
  const directCost = roundMoney(
    sections.reduce(
      (sectionTotal, section) =>
        sectionTotal.plus(
          section.lines.reduce(
            (lineTotal, line) => lineTotal.plus(parseNonNegativeMoney(line.directAmount)),
            new Decimal(0),
          ),
        ),
      new Decimal(0),
    ),
  );
  const overhead = applyPercent(directCost, input.terms.overheadPercent);
  const contingency = applyPercent(directCost.plus(overhead), input.terms.contingencyPercent);
  const markupBase = directCost.plus(overhead).plus(contingency);
  const markupPercent = percent(input.terms.markupPercent);
  const markup =
    input.terms.markupMode === 'MARKUP'
      ? applyPercent(markupBase, input.terms.markupPercent)
      : input.terms.markupMode === 'TARGET_MARGIN'
        ? roundMoney(markupBase.mul(markupPercent).div(HUNDRED.minus(markupPercent)))
        : new Decimal(0);
  const subtotal = markupBase.plus(markup);
  const discount = applyPercent(subtotal, input.terms.discountPercent);
  const taxable = roundMoney(subtotal.minus(discount));
  const tax = applyPercent(taxable, input.terms.taxPercent);

  return {
    currencyCode,
    sections,
    directCostTotal: formatMoney(directCost),
    overheadAmount: formatMoney(overhead),
    contingencyAmount: formatMoney(contingency),
    markupAmount: formatMoney(markup),
    discountAmount: formatMoney(discount),
    taxableAmount: formatMoney(taxable),
    taxAmount: formatMoney(tax),
    totalAmount: formatMoney(taxable.plus(tax)),
  };
}
