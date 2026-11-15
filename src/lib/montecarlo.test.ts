import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../defaults';
import type { SimulationConfig, SimulationResult } from '../types';
import { logVolatility, pathShocks, runMonteCarlo, solveSafeWithdrawal } from './montecarlo';
import { normalGenerator } from './random';
import { guardrailGuide, horizonMonths, resolveWithdrawal, runSimulation, simulate, solveWithdrawal } from './simulation';

function cfg(over: Partial<SimulationConfig> = {}, mc: Partial<SimulationConfig['monteCarlo']> = {}): SimulationConfig {
  const base = defaultConfig();
  return {
    ...base,
    startDate: '2026-01-01',
    birthDate: '1990-06-15',
    monthlySavings: 0,
    initialCapital: 100_000,
    durationYears: 20,
    ...over,
    monteCarlo: { ...base.monteCarlo, enabled: true, runs: 1000, seed: 7, ...mc },
  };
}

describe('random numbers', () => {
  it('are standard normal and reproducible', () => {
    const a = normalGenerator(42);
    const xs = Array.from({ length: 50_000 }, a);
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length);
    expect(Math.abs(mean)).toBeLessThan(0.02);
    expect(sd).toBeCloseTo(1, 1);
    const b = normalGenerator(42);
    expect(b()).toBe(xs[0]);
  });

  it('calibrates the volatility to the standard deviation of yearly returns', () => {
    const r = 0.07;
    const s = logVolatility(7, 15);
    const std = (1 + r) * Math.exp((s * s) / 2) * Math.sqrt(Math.exp(s * s) - 1);
    expect(std).toBeCloseTo(0.15, 6);
    expect(logVolatility(7, 0)).toBe(0);
  });
});

describe('monte carlo', () => {
  it('without fluctuations every path equals the plan', () => {
    const c = cfg({}, { volatility: 0, runs: 50 });
    const months = horizonMonths(c);
    const ones = pathShocks(c, 0, months);
    expect([...ones].every((x) => x === 1)).toBe(true);
    const plan = runSimulation(c);
    expect(simulate(c, ones).summary).toEqual(plan.summary);
    const mc = runMonteCarlo(c);
    expect(mc.percentiles.p10.at(-1)).toBeCloseTo(plan.summary.valueNominal, 0);
    expect(mc.percentiles.p90.at(-1)).toBeCloseTo(plan.summary.valueNominal, 0);
  });

  it('keeps the median path on the plan line', () => {
    // No dividends, costs or taxes: the median should land on the plan.
    const c = cfg({ dividendYield: 0, ter: 0, purchaseFee: 0, applyAdvanceLumpSum: false, allowance: 1e12, durationYears: 30 }, { runs: 4000 });
    const mc = runMonteCarlo(c);
    const plan = mc.plan.at(-1)!;
    expect(Math.abs(mc.percentiles.p50.at(-1)! / plan - 1)).toBeLessThan(0.04);
    expect(mc.percentiles.p10.at(-1)!).toBeLessThan(plan * 0.6);
    expect(mc.percentiles.p90.at(-1)!).toBeGreaterThan(plan * 1.6);
    expect(mc.metric).toBe('profit');
  });

  it('is reproducible and changes with the seed', () => {
    const a = runMonteCarlo(cfg({}, { runs: 200 }));
    const b = runMonteCarlo(cfg({}, { runs: 200 }));
    const c = runMonteCarlo(cfg({}, { runs: 200, seed: 8 }));
    expect([...a.endValues]).toEqual([...b.endValues]);
    expect(a.endValues[0]).not.toBe(c.endValues[0]);
  });

  it('a calculated withdrawal holds in roughly half of the paths', () => {
    const c = cfg({ durationYears: 5 }, { runs: 1000 });
    c.withdrawal = { ...c.withdrawal, enabled: true, mode: 'target', startYear: 2036, lifeExpectancy: 85, endWealth: 0, inflationAdjust: true };
    const mc = runMonteCarlo(c);
    expect(mc.metric).toBe('plan');
    expect(mc.items.map((i) => i.id)).toEqual(['withdrawal']);
    expect(mc.successRate).toBeGreaterThan(0.3);
    expect(mc.successRate).toBeLessThan(0.7);
    // Paths that fail run empty before the end
    const failed = [...mc.success].map((s, i) => (s ? -2 : mc.depletedAge[i])).filter((x) => x !== -2);
    expect(failed.every((age) => age > 0 && age <= 85)).toBe(true);
    // With nothing to leave, a path succeeds exactly when every withdrawal was paid
    expect([...mc.success]).toEqual([...mc.paidAll]);
  });

  it('reports how often each event is paid in full', () => {
    const c = cfg({ oneOffWithdrawals: [{ id: 'small', year: 2030, amount: 10_000 }, { id: 'big', year: 2031, amount: 130_000 }] }, { runs: 500 });
    const mc = runMonteCarlo(c);
    const rate = (id: string) => mc.items.find((i) => i.id === id)!.paidRate;
    expect(rate('small')).toBe(1);
    expect(rate('big')).toBeGreaterThan(0.2);
    expect(rate('big')).toBeLessThan(0.9);
    expect(mc.successRate).toBeCloseTo(rate('big'), 6);
  });

  it('measures the goal in every path', () => {
    const c = cfg({ durationYears: 20 }, { runs: 500 });
    c.goal = { ...c.goal, enabled: true, wealth: runSimulation(c).summary.valueNominal, monthlyDividend: null };
    const mc = runMonteCarlo(c);
    expect(mc.goalRate!).toBeGreaterThan(0.35);
    expect(mc.goalRate!).toBeLessThan(0.65);
  });
});

describe('guardrails', () => {
  // A calculated withdrawal from 2031 that uses the depot up by age 85 (2075): the planned
  // amount is exactly what the depot can carry, so market moves quickly matter.
  const plan = (g: Partial<SimulationConfig['withdrawal']['guardrails']> = {}, over: Partial<SimulationConfig> = {}) => {
    const c = cfg({ dividendYield: 0, initialCapital: 800_000, ...over });
    c.withdrawal = {
      ...c.withdrawal,
      enabled: true,
      mode: 'target',
      startYear: 2031,
      lifeExpectancy: 85,
      endWealth: 0,
      inflationAdjust: true,
      guardrails: { ...c.withdrawal.guardrails, enabled: true, ...g },
    };
    return c;
  };
  /** All months at the expected return, except one month in which the market moves by `factor`. */
  const oneShock = (c: SimulationConfig, monthIndex: number, factor: number) => {
    const a = new Float64Array(horizonMonths(resolveWithdrawal(c))).fill(1);
    a[monthIndex] = factor;
    return a;
  };
  const run = (c: SimulationConfig, shocks?: Float64Array) => {
    const p = resolveWithdrawal(c);
    return simulate(p, shocks ?? new Float64Array(horizonMonths(p)).fill(1), guardrailGuide(c));
  };
  const amount = (res: SimulationResult, y: number) => res.rows.find((r) => r.year === y)!.withdrawalNet / 12;
  const jan2031 = 5 * 12; // start 01/2026
  const jun2031 = jan2031 + 5;

  it('change nothing without fluctuations, and the plan view ignores them', () => {
    const c = plan();
    const off = plan({ enabled: false });
    const steady = run(c);
    expect(steady.summary.withdrawal!.guardrails).toEqual({ cuts: 0, raises: 0, minLevel: 1, yearsBelow: 0, longestBelow: 0, missing: 0 });
    expect(steady.summary.valueNominal).toBeCloseTo(runSimulation(off).summary.valueNominal, 6);
    expect(runSimulation(c).summary).toEqual(runSimulation(off).summary);
  });

  it('do not cut a small withdrawal after a crash – the depot can still carry it', () => {
    const c = plan();
    c.withdrawal = { ...c.withdrawal, mode: 'fixed', monthlyNet: 2000 };
    c.durationMode = 'age';
    c.targetAge = 85;
    const res = run(c, oneShock(c, jun2031, 0.6));
    expect(res.summary.withdrawal!.guardrails!.cuts).toBe(0);
  });

  it('cut after a crash and raise after a boom (both directions)', () => {
    const c = plan({ direction: 'both' });
    const A = solveWithdrawal(c)!.monthlyNet;
    const crash = run(c, oneShock(c, jun2031, 0.6));
    expect(crash.summary.withdrawal!.guardrails!.cuts).toBeGreaterThanOrEqual(1);
    // 2032: no inflation increase after the losing year, then −10 %
    expect(amount(crash, 2032)).toBeCloseTo(A * 0.9, 0);
    const boom = run(c, oneShock(c, jun2031, 1.5));
    expect(boom.summary.withdrawal!.guardrails!.raises).toBeGreaterThanOrEqual(1);
    expect(amount(boom, 2032)).toBeCloseTo(A * 1.02 * 1.1, 0);
  });

  it('only down: pay the plan in good years and return to it once the depot can carry it', () => {
    const c = plan({ direction: 'down' });
    const A = solveWithdrawal(c)!.monthlyNet;
    const boom = run(c, oneShock(c, jun2031, 1.5));
    expect(boom.summary.withdrawal!.guardrails!.cuts).toBe(0);
    expect(amount(boom, 2032)).toBeCloseTo(A * 1.02, 0); // the plan, no raise

    // A crash in 2031, then a full recovery in 2032
    const shocks = oneShock(c, jun2031, 0.6);
    shocks[jan2031 + 12 + 5] = 1 / 0.6;
    const back = run(c, shocks);
    expect(amount(back, 2032)).toBeCloseTo(A * 0.9, 0);
    expect(amount(back, 2033)).toBeCloseTo(A * 1.02 ** 2, 0); // back on plan
    // Shares sold at low prices are gone; in a plan that ends at zero this small gap grows and leads to cuts again late on
    const g = back.summary.withdrawal!.guardrails!;
    const below = back.rows.filter((r) => r.year > 2031 && r.year <= 2060 && r.withdrawalNet / r.months < A * 1.02 ** (r.year - 2031) - 0.5);
    expect(below.map((r) => r.year)).toEqual([2032]);
    // The missing money includes 2032: 0,9 A instead of 1,02 A, in money of 2031
    expect(g.missing).toBeGreaterThan((12 * A * (1.02 - 0.9)) / 1.02 - 1);
  });

  it('count consecutive years below the plan and the missing money', () => {
    const c = plan({ direction: 'down' });
    const A = solveWithdrawal(c)!.monthlyNet;
    const res = run(c, oneShock(c, jun2031, 0.5));
    const g = res.summary.withdrawal!.guardrails!;
    expect(g.longestBelow).toBeGreaterThan(1);
    expect(g.longestBelow).toBeLessThanOrEqual(g.yearsBelow);
    const gap = res.rows
      .filter((r) => r.year > 2031)
      .reduce((sum, r) => sum + (r.months * A * 1.02 ** (r.year - 2031) - r.withdrawalNet) / 1.02 ** (r.year - 2031), 0);
    // Only cuts count, not months in which the depot cannot pay at all
    expect(g.missing).toBeLessThanOrEqual(gap + 1);
    expect(g.missing / gap).toBeGreaterThan(0.99);
  });

  it('skip the inflation increase after a losing year', () => {
    // A dip at the end of 2031: no cut in 2032 (threshold 50 %), but the year ends with a loss.
    const c = plan({ threshold: 50, direction: 'both' });
    const A = solveWithdrawal(c)!.monthlyNet;
    expect(amount(run(c, oneShock(c, jan2031 + 11, 0.85)), 2032)).toBeCloseTo(A, 0); // instead of 1,02 A
    expect(amount(run(c), 2032)).toBeCloseTo(A * 1.02, 0);
    // Only down: the depot can still carry the plan, so it is paid in full
    const d = plan({ threshold: 50, direction: 'down' });
    expect(amount(run(d, oneShock(d, jan2031 + 11, 0.85)), 2032)).toBeCloseTo(A * 1.02, 0);
  });

  it('never go below the minimum amount', () => {
    const c = plan({ floor: 0 });
    const A = solveWithdrawal(c)!.monthlyNet;
    c.withdrawal.guardrails.floor = A * 0.95;
    const res = run(c, oneShock(c, jun2031, 0.4));
    expect(res.summary.withdrawal!.guardrails!.minLevel).toBeCloseTo(0.95, 6);
  });

  it('make the plan hold more often in Monte Carlo', () => {
    const c = plan();
    const off: SimulationConfig = { ...c, withdrawal: { ...c.withdrawal, guardrails: { ...c.withdrawal.guardrails, enabled: false } } };
    const a = runMonteCarlo({ ...off, monteCarlo: { ...off.monteCarlo, runs: 600 } });
    const b = runMonteCarlo({ ...c, monteCarlo: { ...c.monteCarlo, runs: 600 } });
    expect(a.guardrails).toBeNull();
    expect(b.successRate).toBeGreaterThan(a.successRate + 0.1);
    expect(b.guardrails!.cutShare).toBeGreaterThan(0.2);
    expect(b.guardrails!.plannedMonthly).toBe(solveWithdrawal(c)!.monthlyNet);
    // The comparison on the same paths matches a separate run without guardrails
    expect(b.guardrails!.successWithout).toBeCloseTo(a.successRate, 6);
    expect(b.guardrails!.successNoCut + b.guardrails!.successWithCut).toBeCloseTo(b.successRate, 6);
    expect(b.guardrails!.yearsBelowBuckets.reduce((x, y) => x + y, 0)).toBeCloseTo(1, 6);
  });

  it('cut rarely when the amount is far below what the depot can carry', () => {
    const c = plan();
    c.withdrawal = { ...c.withdrawal, mode: 'fixed', monthlyNet: solveWithdrawal(c)!.monthlyNet * 0.6 };
    c.durationMode = 'age';
    c.targetAge = 85;
    const mc = runMonteCarlo({ ...c, monteCarlo: { ...c.monteCarlo, runs: 600 } });
    expect(mc.guardrails!.cutShare).toBeLessThan(0.2);
  });
});

describe('safe withdrawal', () => {
  it('is lower than the calculated amount and holds as often as asked', () => {
    const c = cfg({ durationYears: 5 }, { runs: 300 });
    c.withdrawal = { ...c.withdrawal, enabled: true, mode: 'target', startYear: 2036, lifeExpectancy: 85, endWealth: 0, inflationAdjust: true };
    const safe = solveSafeWithdrawal(c, 0.9)!;
    expect(safe.reachable).toBe(true);
    expect(safe.monthlyNet).toBeGreaterThan(0);
    expect(safe.monthlyNet).toBeLessThan(solveWithdrawal(c)!.monthlyNet);

    const fixed: SimulationConfig = { ...c, durationMode: 'age', targetAge: 85, withdrawal: { ...c.withdrawal, mode: 'fixed', monthlyNet: safe.monthlyNet } };
    expect(runMonteCarlo(fixed).successRate).toBeGreaterThanOrEqual(0.9);
    const more = { ...fixed, withdrawal: { ...fixed.withdrawal, monthlyNet: safe.monthlyNet + 2 } };
    expect(runMonteCarlo(more).successRate).toBeLessThan(0.9);
  });

  it('is not offered for a withdrawal rate', () => {
    const c = cfg();
    c.withdrawal = { ...c.withdrawal, enabled: true, mode: 'rate', startYear: 2030 };
    expect(solveSafeWithdrawal(c, 0.9)).toBeNull();
  });
});
