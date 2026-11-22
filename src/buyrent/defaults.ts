import { defaultConfig } from '../defaults.js';
import type { BuyRentConfig, StateCode } from './types.js';

/**
 * Real estate transfer tax (Grunderwerbsteuer) by state, in % of the price. Stand November 2026,
 * checked against the states' own pages where sources disagreed (Bremen 5.5 % since 1 July 2025,
 * Sachsen 5.5 % since 1 January 2023).
 */
export const STATES: { code: StateCode; name: string; transferTax: number }[] = [
  { code: 'BW', name: 'Baden-Württemberg', transferTax: 5.0 },
  { code: 'BY', name: 'Bayern', transferTax: 3.5 },
  { code: 'BE', name: 'Berlin', transferTax: 6.0 },
  { code: 'BB', name: 'Brandenburg', transferTax: 6.5 },
  { code: 'HB', name: 'Bremen', transferTax: 5.5 },
  { code: 'HH', name: 'Hamburg', transferTax: 5.5 },
  { code: 'HE', name: 'Hessen', transferTax: 6.0 },
  { code: 'MV', name: 'Mecklenburg-Vorpommern', transferTax: 6.0 },
  { code: 'NI', name: 'Niedersachsen', transferTax: 5.0 },
  { code: 'NW', name: 'Nordrhein-Westfalen', transferTax: 6.5 },
  { code: 'RP', name: 'Rheinland-Pfalz', transferTax: 5.0 },
  { code: 'SL', name: 'Saarland', transferTax: 6.5 },
  { code: 'SN', name: 'Sachsen', transferTax: 5.5 },
  { code: 'ST', name: 'Sachsen-Anhalt', transferTax: 5.0 },
  { code: 'SH', name: 'Schleswig-Holstein', transferTax: 6.5 },
  { code: 'TH', name: 'Thüringen', transferTax: 5.0 },
];

export function transferTaxRate(code: StateCode): number {
  return STATES.find((s) => s.code === code)?.transferTax ?? 5.0;
}

/** The comparison starts in January; late in the year that is next year's January. */
function defaultStartYear() {
  const d = new Date();
  return d.getFullYear() + (d.getMonth() >= 9 ? 1 : 0);
}

export function defaultBuyRent(): BuyRentConfig {
  const w = defaultConfig();
  return {
    startYear: defaultStartYear(),
    years: 30,
    price: 400_000,
    appreciation: 2,
    state: 'BY',
    notary: 2,
    broker: 3.57,
    equity: 100_000,
    interest: 4,
    repayment: 2,
    fixedYears: 10,
    followUpRate: null,
    maintenance: 1,
    rent: 1_200,
    rentIncrease: 1.5,
    sellCost: 3.57,
    inflation: w.inflation,
    invest: {
      totalReturn: w.totalReturn,
      dividendYield: w.dividendYield,
      ter: w.ter,
      purchaseFee: w.purchaseFee,
      fundType: w.fundType,
      churchTax: w.churchTax,
      allowance: w.allowance,
    },
  };
}
