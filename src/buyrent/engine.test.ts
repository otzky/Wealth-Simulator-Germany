import { describe, expect, it } from 'vitest';
import { defaultBuyRent, transferTaxRate } from './defaults';
import { endAdvantage, simulateBuyRent, tippingPoints } from './engine';
import type { BuyRentConfig } from './types';

const base = (): BuyRentConfig => ({ ...defaultBuyRent(), startYear: 2027 });

describe('buy vs rent', () => {
  it('works out purchase costs, loan and the first payment', () => {
    const r = simulateBuyRent(base());
    // Bayern 3.5 % + notary 2 % + broker 3.57 % of 400.000
    expect(r.purchase.total).toBeCloseTo(400_000 * 0.0907, 2);
    expect(r.loan).toBeCloseTo(400_000 + 36_280 - 100_000, 2);
    // Annuity: 4 % interest + 2 % repayment per year, monthly
    expect(r.monthlyPayment).toBeCloseTo((336_280 * 0.06) / 12, 2);
    expect(r.priceToRent).toBeCloseTo(400_000 / 14_400, 6);
  });

  it('uses the transfer tax of the chosen state', () => {
    expect(transferTaxRate('NW')).toBe(6.5);
    expect(transferTaxRate('HB')).toBe(5.5);
    const nrw = simulateBuyRent({ ...base(), state: 'NW' });
    expect(nrw.purchase.transferTax).toBeCloseTo(26_000, 2);
  });

  it('repays the loan like an annuity: interest falls, principal rises', () => {
    const r = simulateBuyRent(base());
    expect(r.years[0].interest).toBeGreaterThan(r.years[5].interest);
    expect(r.years[5].principal).toBeGreaterThan(r.years[0].principal);
    // Year 1: interest + principal = 12 payments
    expect(r.years[0].interest + r.years[0].principal).toBeCloseTo(12 * r.monthlyPayment, 2);
    // Debt falls by exactly what was repaid
    expect(r.loan - r.years[0].debt).toBeCloseTo(r.years[0].principal, 2);
  });

  it('spends the same money on both sides every year', () => {
    const r = simulateBuyRent(base());
    for (const y of r.years) {
      const buyer = y.interest + y.principal + y.maintenance + y.buyerInvested;
      const renter = y.rent + y.renterInvested;
      expect(buyer).toBeCloseTo(renter, 4);
    }
  });

  it('lets the owner invest once the loan is paid off', () => {
    const r = simulateBuyRent({ ...base(), repayment: 4, years: 35 });
    expect(r.paidOffYear).not.toBeNull();
    const after = r.years.find((y) => y.index === r.paidOffYear! + 1)!;
    expect(after.buyerInvested).toBeGreaterThan(0);
    expect(after.debt).toBe(0);
  });

  it('a higher follow-up rate makes buying worse', () => {
    const c = base();
    expect(endAdvantage({ ...c, followUpRate: 7 })).toBeLessThan(endAdvantage({ ...c, followUpRate: 3 }));
  });

  it('cheap rent favours renting, expensive rent favours buying', () => {
    const c = base();
    expect(endAdvantage({ ...c, rent: 600 })).toBeLessThan(0);
    expect(endAdvantage({ ...c, rent: 2_500 })).toBeGreaterThan(0);
  });

  it('break-even is the year from which buying stays ahead', () => {
    const r = simulateBuyRent({ ...base(), rent: 2_000 });
    expect(r.breakEven).not.toBeNull();
    for (const y of r.years) {
      if (y.index >= r.breakEven!) expect(y.buyerWealth).toBeGreaterThanOrEqual(y.renterWealth);
    }
    if (r.breakEven! > 1) {
      const before = r.years[r.breakEven! - 2];
      expect(before.buyerWealth).toBeLessThan(before.renterWealth);
    }
  });

  it('equity beyond price and costs goes into the buyer’s depot', () => {
    const r = simulateBuyRent({ ...base(), equity: 500_000 });
    expect(r.loan).toBe(0);
    expect(r.buyerStartDepot).toBeCloseTo(500_000 - 436_280, 2);
  });

  it('warns when the equity does not cover the purchase costs', () => {
    expect(simulateBuyRent({ ...base(), equity: 20_000 }).warnings.join(' ')).toMatch(/Nebenkosten/);
  });

  it('tipping points: at the threshold both ways end equal', () => {
    const c = base();
    const tps = tippingPoints(c);
    const app = tps.find((t) => t.key === 'appreciation')!;
    expect(app.threshold).not.toBeNull();
    expect(Math.abs(endAdvantage({ ...c, appreciation: app.threshold! }))).toBeLessThan(50);
    expect(app.buyingAboveThreshold).toBe(true);
    const rent = tps.find((t) => t.key === 'rent')!;
    expect(rent.buyingAboveThreshold).toBe(true);
    const ret = tps.find((t) => t.key === 'totalReturn')!;
    expect(ret.buyingAboveThreshold).toBe(false);
  });
});
