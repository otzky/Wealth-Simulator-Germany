import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../defaults';
import type { SimulationConfig } from '../types';
import { effectiveTaxRate, horizonMonths, runSimulation, savingsForYear, solveWithdrawal } from './simulation';
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

describe('events', () => {
  const flat = { totalReturn: 0, dividendYield: 0, monthlySavings: 0 };

  it('pays a one-off withdrawal in January and reduces the depot', () => {
    const r = runSimulation(cfg({ ...flat, initialCapital: 100_000, durationYears: 3, oneOffWithdrawals: [{ id: 'a', year: 2027, amount: 30_000 }] }));
    expect(r.rows.map((x) => x.oneOffNet)).toEqual([0, 30_000, 0]);
    expect(r.rows[1].withdrawalNet).toBe(0); // not part of the monthly income
    expect(r.summary.valueNominal).toBeCloseTo(70_000, 6);
    expect(r.summary.oneOffNet).toBe(30_000);
    expect(r.summary.withdrawnNet).toBe(30_000);
    expect(r.summary.eventShortfall).toBeNull();
    expect(r.summary.withdrawal).toBeNull();
  });

  it('sells more than the net amount when the gain is taxed', () => {
    const r = runSimulation(cfg({ totalReturn: 8, dividendYield: 0, monthlySavings: 0, initialCapital: 100_000, durationYears: 3, allowance: 0, oneOffWithdrawals: [{ id: 'a', year: 2028, amount: 20_000 }] }));
    expect(r.rows[2].oneOffNet).toBeCloseTo(20_000, 6);
    expect(r.rows[2].oneOffGross).toBeGreaterThan(20_000);
    expect(r.rows[2].taxes).toBeCloseTo(r.rows[2].oneOffGross - 20_000, 6);
  });

  it('reports when the depot is too small for a one-off withdrawal', () => {
    const r = runSimulation(cfg({ ...flat, initialCapital: 10_000, durationYears: 3, oneOffWithdrawals: [{ id: 'a', year: 2027, amount: 25_000 }] }));
    expect(r.summary.oneOffNet).toBeCloseTo(10_000, 6);
    expect(r.summary.eventShortfall).toEqual({ year: 2027, missing: 15_000 });
    expect(r.summary.valueNominal).toBe(0);
  });

  it('pays a temporary withdrawal only between its first and last year', () => {
    const r = runSimulation(
      cfg({ ...flat, inflation: 2, initialCapital: 100_000, durationYears: 5, withdrawalPhases: [{ id: 'p', startYear: 2027, endYear: 2028, monthlyNet: 500, inflationAdjust: true }] }),
    );
    expect(r.rows.map((x) => Math.round(x.withdrawalNet))).toEqual([0, 6000, 6120, 0, 0]);
    expect(r.summary.withdrawnNet).toBeCloseTo(12_120, 6);
    expect(r.summary.withdrawal).toBeNull(); // no withdrawal phase configured
  });

  it('adds temporary withdrawals to the withdrawal phase and keeps the phase figures separate', () => {
    const c = cfg({ ...flat, initialCapital: 100_000, durationYears: 4, withdrawalPhases: [{ id: 'p', startYear: 2026, endYear: 2028, monthlyNet: 200, inflationAdjust: false }] });
    c.withdrawal = { ...c.withdrawal, enabled: true, startYear: 2028, monthlyNet: 1000, inflationAdjust: false };
    const r = runSimulation(c);
    expect(r.rows.map((x) => x.withdrawalNet)).toEqual([2400, 2400, 14_400, 12_000]);
    expect(r.summary.withdrawal!.net).toBeCloseTo(24_000, 6);
    expect(r.summary.withdrawnNet).toBeCloseTo(31_200, 6);
  });
});

describe('FIFO', () => {
  // Flat tax of 25 % on the full gain keeps the numbers readable.
  const plain = { capitalGainsTax: 25, soli: 0, fundType: 'other' as const, allowance: 0, dividendYield: 0, monthlySavings: 0 };

  it('taxes the gain of the oldest shares, not the average gain', () => {
    // 10.000 € bought at price 1; one year later (price 2) another 20.000 € is added and 5.000 € net taken out.
    const r = runSimulation(
      cfg({ ...plain, totalReturn: 100, initialCapital: 10_000, durationYears: 2, lumpSums: [{ id: 'l', year: 2027, amount: 20_000 }], oneOffWithdrawals: [{ id: 'o', year: 2027, amount: 5000 }] }),
    );
    const price = 2 ** (13 / 12); // at the sale, after January's price move
    const gainShareOldest = 1 - 1 / price; // the first shares cost 1 each
    expect(r.rows[1].oneOffGross).toBeCloseTo(5000 / (1 - 0.25 * gainShareOldest), 4);
    // With the average cost of all shares the tax would have been clearly lower
    const gainShareAverage = 1 - 30_000 / (10_000 * price + 20_000 * 2 ** (1 / 12));
    expect(r.rows[1].taxes).toBeGreaterThan(1.5 * (5000 / (1 - 0.25 * gainShareAverage) - 5000));
  });

  it('pays the same tax in total when everything is sold', () => {
    // Selling in two steps or at once must tax the same total gain.
    const base = { ...plain, totalReturn: 6, initialCapital: 50_000, monthlySavings: 500, durationYears: 10 };
    const hold = runSimulation(cfg(base));
    const total = hold.summary.taxesPaid + hold.summary.saleTax;
    expect(total).toBeCloseTo((hold.summary.valueNominal - hold.summary.invested) * 0.25, 4);
    const gross = runSimulation(cfg({ ...base, oneOffWithdrawals: [{ id: 'o', year: 2031, amount: 20_000 }] }));
    const gainTaxed = (gross.summary.taxesPaid + gross.summary.saleTax) / 0.25;
    expect(gainTaxed).toBeCloseTo(gross.summary.valueNominal + gross.summary.withdrawnGross - gross.summary.invested, 4);
  });

  it('nets a losing lot against the gains within one sale', () => {
    // Fees make the newest shares worth less than they cost; selling everything taxes only the net gain.
    const r = runSimulation(
      cfg({ ...plain, totalReturn: 10, purchaseFee: 5, initialCapital: 10_000, durationYears: 2, lumpSums: [{ id: 'l', year: 2027, amount: 10_000 }], oneOffWithdrawals: [{ id: 'o', year: 2027, amount: 1e9 }] }),
    );
    expect(r.rows[1].taxes).toBeCloseTo((r.rows[1].oneOffGross - 20_000) * 0.25, 6);
    expect(r.summary.valueNominal).toBe(0);
  });
});

describe('withdrawal to a target wealth', () => {
  // Born 1990-06-15, withdrawals from 2057 (age 67), plan ends with the 90th birthday in June 2080.
  const plan = (over: Partial<SimulationConfig['withdrawal']> = {}, base: Partial<SimulationConfig> = {}) => {
    const c = cfg({ initialCapital: 100_000, monthlySavings: 500, dividendYield: 0, durationYears: 5, ...base });
    c.withdrawal = { ...c.withdrawal, enabled: true, mode: 'target', startYear: 2057, inflationAdjust: false, lifeExpectancy: 90, endWealth: 0, ...over };
    return c;
  };

  it('runs until the life expectancy, whatever the duration setting says', () => {
    const r = runSimulation(plan());
    expect(r.summary.endAge).toBe(90);
    expect(r.summary.endYear).toBe(2080);
  });

  it('without return or tax the depot is simply divided by the months', () => {
    const c = plan({}, { totalReturn: 0, capitalGainsTax: 0, monthlySavings: 0, initialCapital: 282_000 });
    const months = 23 * 12 + 6; // Jan 2057 .. Jun 2080
    expect(solveWithdrawal(c)!.monthlyNet).toBe(Math.floor(282_000 / months));
  });

  it('uses the depot up when nothing should be left', () => {
    const r = runSimulation(plan());
    const ws = r.summary.withdrawal!;
    expect(ws.target!.reachable).toBe(true);
    expect(ws.target!.monthlyNet).toBeGreaterThan(0);
    expect(ws.shortfall).toBe(false);
    expect(ws.months).toBe(23 * 12 + 6);
    // Only the rounding to whole euros (plus its growth) is left over
    expect(r.summary.valueNominal).toBeLessThan(ws.months * 3);
    // One euro more per month would not last
    const more = plan();
    more.withdrawal = { ...more.withdrawal, mode: 'fixed', monthlyNet: ws.target!.monthlyNet + 1 };
    more.durationMode = 'age';
    more.targetAge = 90;
    expect(runSimulation(more).summary.withdrawal!.shortfall).toBe(true);
  });

  it('leaves the wanted wealth, nominal or in purchasing power', () => {
    const nominal = runSimulation(plan({ endWealth: 300_000 }, { inflation: 2 }));
    expect(nominal.summary.valueNominal).toBeGreaterThanOrEqual(300_000);
    expect(nominal.summary.valueNominal).toBeLessThan(300_000 * 1.01);

    const real = runSimulation(plan({ endWealth: 300_000, endWealthBasis: 'real' }, { inflation: 2 }));
    expect(real.summary.valueReal).toBeGreaterThanOrEqual(300_000);
    expect(real.summary.valueReal).toBeLessThan(300_000 * 1.01);
    expect(real.summary.withdrawal!.target!.monthlyNet).toBeLessThan(nominal.summary.withdrawal!.target!.monthlyNet);
  });

  it('allows less when more should be left, and with inflation adjustment', () => {
    const all = solveWithdrawal(plan())!.monthlyNet;
    const keep = solveWithdrawal(plan({ endWealth: 500_000 }))!.monthlyNet;
    const adjusted = solveWithdrawal(plan({ inflationAdjust: true }, { inflation: 2 }))!.monthlyNet;
    expect(keep).toBeLessThan(all);
    expect(adjusted).toBeLessThan(solveWithdrawal(plan({}, { inflation: 2 }))!.monthlyNet);
  });

  it('reports when the wanted wealth is out of reach', () => {
    const r = runSimulation(plan({ endWealth: 1e12 }));
    expect(r.summary.withdrawal!.target).toMatchObject({ reachable: false, monthlyNet: 0 });
    expect(r.summary.withdrawal!.net).toBe(0);
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
    expect(c.withdrawal.lifeExpectancy).toBe(90);
    expect(c.oneOffWithdrawals).toEqual([]);
    const ev = sanitize({ oneOffWithdrawals: [{ year: 2030, amount: 5 }, { year: 'x' }], withdrawalPhases: [{ startYear: 2030, endYear: 2031, monthlyNet: 100 }, { startYear: 2030 }] });
    expect(ev.oneOffWithdrawals).toHaveLength(1);
    expect(ev.withdrawalPhases).toMatchObject([{ startYear: 2030, endYear: 2031, monthlyNet: 100, inflationAdjust: true }]);
    expect(sanitize({ withdrawal: { mode: 'target', endWealthBasis: 'x' } }).withdrawal).toMatchObject({ mode: 'target', endWealthBasis: 'nominal' });
  });

  it('migrates the old reinvest switch', () => {
    expect(sanitize({ reinvestDividends: false }).dividendStrategy).toBe('payout');
    expect(sanitize({ reinvestDividends: true }).dividendStrategy).toBe('reinvest');
  });
});
