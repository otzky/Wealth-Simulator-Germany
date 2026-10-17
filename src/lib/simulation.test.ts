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
    const base = { totalReturn: 4, dividendYield: 4, initialCapital: 100_000, monthlySavings: 0, durationYears: 1, allowance: 0, dividendStrategy: 'payout' as const };
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

describe('withdrawals', () => {
  const w = (over: Partial<SimulationConfig['withdrawal']>): SimulationConfig['withdrawal'] => ({
    ...defaultConfig().withdrawal,
    enabled: true,
    startYear: 2028,
    inflationAdjust: false,
    ...over,
  });

  it('pays exactly the net target when there is no gain', () => {
    const r = runSimulation(
      cfg({ totalReturn: 0, dividendYield: 0, initialCapital: 100_000, monthlySavings: 0, durationYears: 4, withdrawal: w({ monthlyNet: 1000 }) }),
    );
    const ws = r.summary.withdrawal!;
    expect(ws.net).toBeCloseTo(24 * 1000, 6);
    expect(ws.taxes).toBe(0);
    expect(r.summary.valueNominal).toBeCloseTo(100_000 - 24_000, 6);
    expect(r.rows[2].monthlyWithdrawalNet).toBeCloseTo(1000, 6);
  });

  it('grosses up the sale so the net payout matches after tax', () => {
    const r = runSimulation(
      cfg({ totalReturn: 8, dividendYield: 0, initialCapital: 100_000, monthlySavings: 0, durationYears: 4, allowance: 0, withdrawal: w({ monthlyNet: 1000 }) }),
    );
    const ws = r.summary.withdrawal!;
    expect(ws.firstMonthlyNet).toBeCloseTo(1000, 6);
    expect(ws.firstMonthlyGross).toBeGreaterThan(1000);
    expect(ws.taxes).toBeGreaterThan(0);
    expect(ws.gross - ws.taxes).toBeCloseTo(ws.net, 6);
  });

  it('detects when the depot runs out', () => {
    const r = runSimulation(
      cfg({ totalReturn: 0, dividendYield: 0, initialCapital: 10_000, monthlySavings: 0, durationYears: 10, withdrawal: w({ monthlyNet: 1000 }) }),
    );
    const ws = r.summary.withdrawal!;
    expect(ws.depletedYear).toBe(2028);
    expect(ws.net).toBeCloseTo(10_000, 6);
    expect(r.summary.valueNominal).toBe(0);
  });

  it('takes a percentage of the start value in rate mode and adjusts for inflation', () => {
    const r = runSimulation(
      cfg({
        totalReturn: 0,
        dividendYield: 0,
        inflation: 2,
        initialCapital: 120_000,
        monthlySavings: 0,
        durationYears: 4,
        allowance: 1e9,
        withdrawal: w({ mode: 'rate', rate: 4, inflationAdjust: true }),
      }),
    );
    expect(r.summary.withdrawal!.firstMonthlyGross).toBeCloseTo(400, 6);
    expect(r.rows[3].withdrawalGross / r.rows[2].withdrawalGross).toBeCloseTo(1.02, 6);
  });

  it('stops the savings plan when withdrawals start', () => {
    const c = cfg({ monthlySavings: 500, withdrawal: w({ stopContributions: true }) });
    expect(savingsForYear(c, 2027)).toBe(500);
    expect(savingsForYear(c, 2028)).toBe(0);
  });

  it('switches from reinvesting to paying out at the withdrawal start', () => {
    const r = runSimulation(
      cfg({ totalReturn: 4, dividendYield: 4, initialCapital: 100_000, monthlySavings: 0, durationYears: 4, dividendStrategy: 'withWithdrawal', withdrawal: w({ monthlyNet: 0 }) }),
    );
    expect(r.rows[0].dividendsReinvested).toBe(true);
    expect(r.rows[1].dividendsPaidOut).toBe(0);
    expect(r.rows[2].dividendsReinvested).toBe(false);
    expect(r.rows[2].dividendsPaidOut).toBeCloseTo(r.rows[2].dividendsNet, 6);
    expect(r.summary.dividendsPaidOut).toBeCloseTo(r.rows[2].dividendsNet + r.rows[3].dividendsNet, 6);
  });

  it('pays out dividends from a chosen year', () => {
    const r = runSimulation(cfg({ dividendStrategy: 'fromYear', dividendPayoutYear: 2027, durationYears: 3 }));
    expect(r.rows.map((x) => x.dividendsReinvested)).toEqual([true, false, false]);
  });

  it('counts paid-out dividends towards the monthly target', () => {
    const base = {
      totalReturn: 3,
      dividendYield: 3,
      initialCapital: 200_000,
      monthlySavings: 0,
      durationYears: 4,
      allowance: 1e9, // keep tax out of the picture
      dividendStrategy: 'withWithdrawal' as const,
    };
    const counted = runSimulation(cfg({ ...base, withdrawal: w({ monthlyNet: 1000, countDividends: true }) }));
    const extra = runSimulation(cfg({ ...base, withdrawal: w({ monthlyNet: 1000, countDividends: false }) }));
    const yc = counted.rows[2];
    // Dividends + sales add up to the target each month
    expect((yc.dividendsPaidOut + yc.withdrawalNet) / 12).toBeCloseTo(1000, 6);
    // Without counting, the full target is sold on top of the dividends
    expect(extra.rows[2].withdrawalNet / 12).toBeCloseTo(1000, 6);
    expect(counted.summary.valueNominal).toBeGreaterThan(extra.summary.valueNominal);
  });

  it('reports savings freed up by stopping the plan', () => {
    const r = runSimulation(cfg({ monthlySavings: 500, durationYears: 4, withdrawal: w({ monthlyNet: 100 }) }));
    expect(r.rows[1].freedSavings).toBe(0);
    expect(r.rows[2].freedSavings).toBe(6000);
    expect(r.summary.withdrawal!.firstYearMonthlyFreed).toBe(500);
  });

  it('measures the goal at the start of withdrawals', () => {
    const c = cfg({ totalReturn: 0, dividendYield: 0, initialCapital: 0, monthlySavings: 1000, durationYears: 10, withdrawal: w({ startYear: 2031, monthlyNet: 5000 }) });
    c.goal = { ...c.goal, enabled: true, wealth: 60_000, monthlyDividend: null };
    // 5 years × 12 × 1000 € = 60.000 € before withdrawals start
    expect(solveGoal(c, 'savings')).toBe(1000);
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

  it('migrates the old reinvest switch', () => {
    expect(sanitize({ reinvestDividends: false }).dividendStrategy).toBe('payout');
    expect(sanitize({ reinvestDividends: true }).dividendStrategy).toBe('reinvest');
  });
});
