/** Checking buy-vs-rent inputs from untrusted sources (saved data, links, AI tools). No browser APIs. */
import { defaultBuyRent, STATES } from './defaults.js';
import type { BuyRentConfig, StateCode } from './types.js';

const num = (v: unknown, fallback: number, lo: number, hi: number) => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(hi, Math.max(lo, n));
};

/** Merge untrusted data onto the defaults and keep every value in a sensible range. */
export function sanitizeBuyRent(raw: unknown): BuyRentConfig {
  const d = defaultBuyRent();
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const inv = (r.invest && typeof r.invest === 'object' ? r.invest : {}) as Record<string, unknown>;
  const state = STATES.some((s) => s.code === r.state) ? (r.state as StateCode) : d.state;
  const totalReturn = num(inv.totalReturn, d.invest.totalReturn, -10, 30);
  return {
    startYear: Math.round(num(r.startYear, d.startYear, 1950, 2200)),
    years: Math.round(num(r.years, d.years, 1, 60)),
    price: num(r.price, d.price, 0, 100_000_000),
    appreciation: num(r.appreciation, d.appreciation, -20, 30),
    state,
    notary: num(r.notary, d.notary, 0, 10),
    broker: num(r.broker, d.broker, 0, 10),
    equity: num(r.equity, d.equity, 0, 100_000_000),
    interest: num(r.interest, d.interest, 0, 30),
    repayment: num(r.repayment, d.repayment, 0, 30),
    fixedYears: Math.round(num(r.fixedYears, d.fixedYears, 1, 40)),
    followUpRate: r.followUpRate == null ? null : num(r.followUpRate, d.interest, 0, 30),
    maintenance: num(r.maintenance, d.maintenance, 0, 10),
    rent: num(r.rent, d.rent, 0, 1_000_000),
    rentIncrease: num(r.rentIncrease, d.rentIncrease, -10, 20),
    sellCost: num(r.sellCost, d.sellCost, 0, 20),
    inflation: num(r.inflation, d.inflation, -5, 20),
    invest: {
      totalReturn,
      dividendYield: num(inv.dividendYield, d.invest.dividendYield, 0, Math.max(0, totalReturn)),
      ter: num(inv.ter, d.invest.ter, 0, 5),
      purchaseFee: num(inv.purchaseFee, d.invest.purchaseFee, 0, 10),
      fundType: inv.fundType === 'mixed' || inv.fundType === 'other' || inv.fundType === 'equity' ? inv.fundType : d.invest.fundType,
      churchTax: inv.churchTax === 8 || inv.churchTax === 9 || inv.churchTax === 0 ? inv.churchTax : d.invest.churchTax,
      allowance: num(inv.allowance, d.invest.allowance, 0, 100_000),
    },
  };
}
