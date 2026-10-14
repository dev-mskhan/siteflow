import { describe, expect, it } from 'vitest';
import { evaluateTakeoffFormula, FORMULA_LIMITS } from '../../../src/modules/project/takeoff/takeoff.formula.js';
import { TakeoffFormulaError } from '../../../src/modules/project/takeoff/takeoff.errors.js';

const L = { variableName: 'L', value: '10.5' };
const W = { variableName: 'W', value: '4' };

describe('evaluateTakeoffFormula', () => {
  it('evaluates arithmetic with precedence and parentheses', () => {
    expect(evaluateTakeoffFormula('2 + 3 * 4', []).toFixed()).toBe('14');
    expect(evaluateTakeoffFormula('(2 + 3) * 4', []).toFixed()).toBe('20');
    expect(evaluateTakeoffFormula('-(2 + 3) * -2', []).toFixed()).toBe('10');
  });

  it('uses decimal arithmetic without float drift', () => {
    expect(evaluateTakeoffFormula('0.1 + 0.2', []).toFixed()).toBe('0.3');
  });

  it('resolves named variables', () => {
    expect(evaluateTakeoffFormula('L * W', [L, W]).toFixed()).toBe('42');
    expect(evaluateTakeoffFormula('L * W - 2', [L, W]).toFixed()).toBe('40');
  });

  it('supports min and max with two or more arguments', () => {
    expect(evaluateTakeoffFormula('min(L, W, 3)', [L, W]).toFixed()).toBe('3');
    expect(evaluateTakeoffFormula('max(L, W)', [L, W]).toFixed()).toBe('10.5');
  });

  it('rejects unknown variables and functions', () => {
    expect(() => evaluateTakeoffFormula('X * 2', [L])).toThrow(TakeoffFormulaError);
    expect(() => evaluateTakeoffFormula('sqrt(4)', [])).toThrow(/Unsupported function/);
  });

  it('rejects code-like input instead of executing it', () => {
    expect(() => evaluateTakeoffFormula('process.exit(1)', [])).toThrow(TakeoffFormulaError);
    expect(() => evaluateTakeoffFormula('1; 2', [])).toThrow(TakeoffFormulaError);
    expect(() => evaluateTakeoffFormula('"a"', [])).toThrow(TakeoffFormulaError);
  });

  it('rejects division by zero and malformed syntax', () => {
    expect(() => evaluateTakeoffFormula('1 / 0', [])).toThrow(/Division by zero/);
    expect(() => evaluateTakeoffFormula('(1 + 2', [])).toThrow(TakeoffFormulaError);
    expect(() => evaluateTakeoffFormula('1 +', [])).toThrow(TakeoffFormulaError);
  });

  it('enforces length, variable, depth and node limits', () => {
    expect(() => evaluateTakeoffFormula('1+'.repeat(300) + '1', [])).toThrow(/too long/);
    const many = Array.from({ length: FORMULA_LIMITS.maxVariables + 1 }, (_, i) => ({
      variableName: `V${i}`,
      value: '1',
    }));
    expect(() => evaluateTakeoffFormula('1', many)).toThrow(/Too many/);
    expect(() => evaluateTakeoffFormula('(' .repeat(30) + '1' + ')'.repeat(30), [])).toThrow(/nested too deeply/);
    expect(() => evaluateTakeoffFormula('1' + ' + 1'.repeat(100), [])).toThrow(/too complex/);
  });

  it('rejects duplicate variable names', () => {
    expect(() => evaluateTakeoffFormula('L', [L, L])).toThrow(/Duplicate/);
  });
});
