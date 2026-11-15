import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../defaults';
import type { SimulationConfig } from '../types';
import { logVolatility, pathShocks, runMonteCarlo, solveSafeWithdrawal } from './montecarlo';
import { normalGenerator } from './random';
import { horizonMonths, runSimulation, simulate, solveWithdrawal } from './simulation';

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
