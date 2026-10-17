import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../defaults';
import type { SimulationConfig } from '../types';
import { effectiveTaxRate, horizonMonths, runSimulation, savingsForYear } from './simulation';
import { solveGoal } from './goal';
import { parseNumber } from './format';
import { sanitize } from './storage';

function cfg(over: Partial<SimulationConfig> = {}): SimulationConfig {
  return {
    ...defaultConfig(),
    startDate: '2026-01-01',
    birthDate: '1990-06-15',
    purchaseFee: 0,
    ter: 0,
    inflation: 0,
    applyAdvanceLumpSum: false,
    ...over,
  };
}

describe('tax rate', () => {
  it('matches the official combined rates', () => {
    expect(effectiveTaxRate({ capitalGainsTax: 25, soli: 5.5, churchTax: 0 })).toBeCloseTo(0.26375, 5);
    expect(effectiveTaxRate({ capitalGainsTax: 25, soli: 5.5, churchTax: 8 })).toBeCloseTo(0.27819, 4);
    expect(effectiveTaxRate({ capitalGainsTax: 25, soli: 5.5, churchTax: 9 })).toBeCloseTo(0.27995, 4);
  });
});

describe('simulation', () => {
  it('without return, costs or tax the value equals the deposits', () => {
    const r = runSimulation(cfg({ totalReturn: 0, dividendYield: 0, initialCapital: 1000, monthlySavings: 100, durationYears: 2 }));
    expect(r.summary.invested).toBe(1000 + 24 * 100);
    expect(r.summary.valueNominal).toBeCloseTo(3400, 6);
    expect(r.rows).toHaveLength(2);
  });

  it('compounds a lump sum at the total return', () => {
    const r = runSimulation(cfg({ totalReturn: 6, dividendYield: 0, initialCapital: 10_000, monthlySavings: 0, durationYears: 10 }));
    expect(r.summary.valueNominal).toBeCloseTo(10_000 * 1.06 ** 10, 0);
  });

  it('does not tax reinvested dividends twice on sale', () => {
    // Pure dividend return, everything below the allowance: no gain left to tax on sale.
    const r = runSimulation(
      cfg({ totalReturn: 2, dividendYield: 2, initialCapital: 10_000, monthlySavings: 0, durationYears: 5, allowance: 100_000 }),
    );
    expect(r.summary.saleTax).toBeCloseTo(0, 6);
    expect(r.summary.taxesPaid).toBe(0);
  });

  it('applies the partial exemption for equity funds', () => {
    const base = { totalReturn: 4, dividendYield: 4, initialCapital: 100_000, monthlySavings: 0, durationYears: 1, allowance: 0, reinvestDividends: false };
    const equity = runSimulation(cfg({ ...base, fundType: 'equity' }));
    const other = runSimulation(cfg({ ...base, fundType: 'other' }));
    expect(equity.summary.taxesPaid / other.summary.taxesPaid).toBeCloseTo(0.7, 6);
  });

  it('counts every lump sum in the same year', () => {
    const r = runSimulation(
      cfg({
        totalReturn: 0,
        dividendYield: 0,
        initialCapital: 0,
        monthlySavings: 0,
        durationYears: 3,
        lumpSums: [
          { id: 'a', year: 2027, amount: 1000 },
          { id: 'b', year: 2027, amount: 500 },
        ],
      }),
    );
    expect(r.summary.invested).toBe(1500);
  });

  it('charges a Vorabpauschale on accumulating funds', () => {
    const base = { totalReturn: 7, dividendYield: 0, initialCapital: 100_000, monthlySavings: 0, durationYears: 2, allowance: 0 };
    const without = runSimulation(cfg(base));
    const withAdv = runSimulation(cfg({ ...base, applyAdvanceLumpSum: true, baseRate: 3.2 }));
    // Year 1: 100k × 3.2 % × 0.7 = 2240 € → 70 % taxable → × 26.375 %
    expect(withAdv.rows[0].advanceLumpSum).toBeCloseTo(2240, 0);
    expect(withAdv.rows[0].taxes).toBeCloseTo(2240 * 0.7 * 0.26375, 0);
    expect(without.summary.taxesPaid).toBe(0);
    // Total taxes over a full sale are roughly the same, just paid earlier.
    const totalWith = withAdv.summary.taxesPaid + withAdv.summary.saleTax;
    const totalWithout = without.summary.saleTax;
    expect(Math.abs(totalWith - totalWithout) / totalWithout).toBeLessThan(0.05);
  });

  it('runs until the target age', () => {
    const c = cfg({ durationMode: 'age', targetAge: 67 });
    // Born 06/1990 → 67 in 06/2057; start 01/2026 → 01/2026 … 06/2057.
    expect(horizonMonths(c)).toBe(31 * 12 + 6);
    expect(runSimulation(c).summary.endAge).toBe(67);
  });

  it('uses the latest savings step and yearly growth', () => {
    const c = cfg({ monthlySavings: 100, savingsGrowth: 10, savingsSteps: [{ id: 'x', year: 2030, monthlyAmount: 1000 }] });
    expect(savingsForYear(c, 2027)).toBeCloseTo(110);
    expect(savingsForYear(c, 2030)).toBe(1000);
    expect(savingsForYear(c, 2031)).toBeCloseTo(1100);
  });
});

describe('goal solver', () => {
  it('finds the savings rate that reaches the target', () => {
    const c = cfg({ totalReturn: 0, dividendYield: 0, initialCapital: 0, durationYears: 10 });
    c.goal = { ...c.goal, enabled: true, wealth: 120_000, monthlyDividend: null };
    expect(solveGoal(c, 'savings')).toBe(1000);
  });

  it('returns null when the goal is out of reach', () => {
    const c = cfg({ durationYears: 1 });
    c.goal = { ...c.goal, enabled: true, wealth: 1e15, monthlyDividend: null };
    expect(solveGoal(c, 'savings')).toBeNull();
  });
});

describe('helpers', () => {
  it('parses German numbers', () => {
    expect(parseNumber('1.234,5')).toBe(1234.5);
    expect(parseNumber('10.000')).toBe(10000);
    expect(parseNumber('7,5 %')).toBe(7.5);
    expect(parseNumber('0.2')).toBe(0.2);
    expect(parseNumber('abc')).toBeNull();
  });

  it('sanitizes stored configs', () => {
    const c = sanitize({ monthlySavings: 'x', totalReturn: 5, churchTax: 7, goal: { wealth: null } });
    expect(c.monthlySavings).toBe(500);
    expect(c.totalReturn).toBe(5);
    expect(c.churchTax).toBe(0);
    expect(c.goal.wealth).toBeNull();
  });
});
