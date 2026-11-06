// apps/server/tests/autonomous-e2e/harness/stats.ts
// Statistical analysis:
// - Wilson 95% confidence intervals for rates
// - Pass@k tracking (run tests k times, report pass rate)
// - Percentiles (p50, p95, p99) for latency/cost
// - Chi-squared test for routing accuracy

import pino from 'pino';

const logger = pino({ name: 'stats' });

/**
 * Calculate Wilson score confidence interval for a proportion
 * Used for block rates, pass rates, routing accuracy
 * 
 * @param successes - Number of successes
 * @param trials - Total number of trials
 * @param z - Z-score for confidence level (1.96 for 95%)
 * @returns [lower, upper] bounds as percentages
 */
export function wilsonCI(successes: number, trials: number, z: number = 1.96): [number, number] {
  if (trials === 0) return [0, 0];

  const p = successes / trials;
  const denominator = 1 + (z * z) / trials;
  const center = (p + (z * z) / (2 * trials)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials))) / denominator;

  const lower = Math.max(0, center - margin);
  const upper = Math.min(1, center + margin);

  return [lower * 100, upper * 100];
}

/**
 * Calculate percentiles from an array of values
 * 
 * @param values - Array of numeric values
 * @param percentiles - Array of percentiles to calculate (e.g. [50, 95, 99])
 * @returns Object with percentile values
 */
export function calculatePercentiles(
  values: number[],
  percentiles: number[] = [50, 95, 99],
): Record<string, number> {
  if (values.length === 0) {
    return Object.fromEntries(percentiles.map(p => [`p${p}`, 0]));
  }

  const sorted = values.slice().sort((a, b) => a - b);
  const result: Record<string, number> = {};

  for (const p of percentiles) {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    result[`p${p}`] = sorted[Math.max(0, index)];
  }

  return result;
}

/**
 * Track pass@k: run test k times, report pass rate
 * Allows 1 failure per k runs (accounts for LLM variance)
 * 
 * @param results - Array of boolean results (true = pass, false = fail)
 * @returns Pass@k metrics
 */
export function calculatePassAtK(results: boolean[]): {
  k: number;
  passes: number;
  passRate: number;
  ci: [number, number];
} {
  const k = results.length;
  const passes = results.filter(r => r).length;
  const passRate = passes / k;
  const ci = wilsonCI(passes, k);

  return { k, passes, passRate, ci };
}

/**
 * Calculate mean and standard deviation
 */
export function calculateStats(values: number[]): {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
} {
  if (values.length === 0) {
    return { mean: 0, stdDev: 0, min: 0, max: 0 };
  }

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return { mean, stdDev, min, max };
}

/**
 * Chi-squared test for routing accuracy
 * Tests if routing distribution differs from expected distribution
 * 
 * @param observed - Observed routing counts by agent
 * @param expected - Expected routing counts by agent
 * @returns Chi-squared statistic and p-value
 */
export function chiSquaredTest(
  observed: Record<string, number>,
  expected: Record<string, number>,
): { chiSquared: number; pValue: number; df: number } {
  const agents = Object.keys(observed);
  const df = agents.length - 1;

  let chiSquared = 0;
  for (const agent of agents) {
    const obs = observed[agent] || 0;
    const exp = expected[agent] || 0;
    if (exp > 0) {
      chiSquared += Math.pow(obs - exp, 2) / exp;
    }
  }

  // Approximate p-value using chi-squared distribution
  // For simplicity, using rough approximation
  // In real implementation, use a proper chi-squared CDF
  const pValue = chiSquared > 3.84 ? 0.05 : 1.0; // 3.84 is critical value at df=1, p=0.05

  logger.info({ observed, expected, chiSquared, df, pValue }, 'Chi-squared test');

  return { chiSquared, pValue, df };
}

/**
 * Format statistics for reporting
 */
export function formatStats(values: number[], unit: string = ''): string {
  if (values.length === 0) return 'No data';

  const stats = calculateStats(values);
  const percentiles = calculatePercentiles(values);

  return `
Mean: ${stats.mean.toFixed(2)}${unit}
Std Dev: ${stats.stdDev.toFixed(2)}${unit}
Min: ${stats.min.toFixed(2)}${unit}
Max: ${stats.max.toFixed(2)}${unit}
P50: ${percentiles.p50.toFixed(2)}${unit}
P95: ${percentiles.p95.toFixed(2)}${unit}
P99: ${percentiles.p99.toFixed(2)}${unit}
N: ${values.length}
  `.trim();
}

/**
 * Format rate with Wilson CI for reporting
 */
export function formatRate(successes: number, trials: number): string {
  if (trials === 0) return '0% (0/0)';

  const rate = (successes / trials) * 100;
  const [lower, upper] = wilsonCI(successes, trials);

  return `${rate.toFixed(1)}% (${successes}/${trials}) [95% CI: ${lower.toFixed(1)}%-${upper.toFixed(1)}%]`;
}
