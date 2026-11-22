import { defaultConfig } from '../defaults.js';
import { simulate } from '../lib/simulation.js';
import type { SimulationConfig, SimulationResult } from '../types.js';
import { transferTaxRate } from './defaults.js';
import type { BuyRentConfig, BuyRentResult, BuyRentYear, TippingKey, TippingPoint } from './types.js';

/**
 * Buying a home to live in versus renting a comparable one and investing.
 *
 * Both ways spend the same money each month on housing plus investing: whoever pays less in a
 * month invests the difference in the fund (the tenant at first, the owner once the loan is paid
 * off or the rent has risen above the owner's costs). The tenant invests the equity at the start.
 * Running costs that both pay (heating, property tax, waste) are left out.
 *
 * Wealth is compared as if everything were sold at the end of each year: the property minus
 * selling costs and remaining debt (the sale of a home you live in is tax-free), the depots after
 * German taxes, with the same engine as the wealth module.
 */
export function simulateBuyRent(cfg: BuyRentConfig): BuyRentResult {
  const months = Math.max(1, Math.round(cfg.years)) * 12;
  const taxRate = transferTaxRate(cfg.state);
  const purchase = {
    transferTaxRate: taxRate,
    transferTax: (cfg.price * taxRate) / 100,
    notary: (cfg.price * cfg.notary) / 100,
    broker: (cfg.price * cfg.broker) / 100,
    total: 0,
  };
  purchase.total = purchase.transferTax + purchase.notary + purchase.broker;
  const need = cfg.price + purchase.total;
  const loan = Math.max(0, need - cfg.equity);
  const buyerStartDepot = Math.max(0, cfg.equity - need);

  const followUp = cfg.followUpRate ?? cfg.interest;
  let rate = cfg.interest;
  let payment = (loan * (cfg.interest + cfg.repayment)) / 100 / 12;
  const monthlyPayment = payment;
  let debt = loan;
  let paidOffYear: number | null = loan > 0 ? null : 0;

  const buyerDeposits = new Float64Array(months);
  const renterDeposits = new Float64Array(months);
  const n = months / 12;
  const agg = Array.from({ length: n }, () => ({ interest: 0, principal: 0, maintenance: 0, rent: 0, buyerInvested: 0, renterInvested: 0, debt: 0 }));

  for (let i = 0; i < months; i++) {
    const k = Math.floor(i / 12);
    if (i === cfg.fixedYears * 12 && debt > 0.005) {
      rate = followUp;
      // The payment stays; if it no longer covers interest plus 1 % repayment, it rises to that.
      payment = Math.max(payment, (debt * (rate + 1)) / 100 / 12);
    }
    let paid = 0;
    if (debt > 0.005) {
      const interest = (debt * rate) / 100 / 12;
      const principal = Math.min(debt, Math.max(0, payment - interest));
      debt -= principal;
      paid = interest + principal;
      agg[k].interest += interest;
      agg[k].principal += principal;
      if (debt <= 0.005) {
        debt = 0;
        if (paidOffYear == null) paidOffYear = k + 1;
      }
    }
    const maintenance = ((cfg.price * cfg.maintenance) / 100 / 12) * Math.pow(1 + cfg.inflation / 100, k);
    const rent = cfg.rent * Math.pow(1 + cfg.rentIncrease / 100, k);
    const diff = paid + maintenance - rent;
    renterDeposits[i] = Math.max(0, diff);
    buyerDeposits[i] = Math.max(0, -diff);
    agg[k].maintenance += maintenance;
    agg[k].rent += rent;
    agg[k].renterInvested += renterDeposits[i];
    agg[k].buyerInvested += buyerDeposits[i];
    agg[k].debt = debt;
  }

  const renter = simulate(depotConfig(cfg, cfg.equity), undefined, undefined, undefined, renterDeposits);
  const buyer = simulate(depotConfig(cfg, buyerStartDepot), undefined, undefined, undefined, buyerDeposits);

  const years: BuyRentYear[] = agg.map((a, k) => {
    const propertyValue = cfg.price * Math.pow(1 + cfg.appreciation / 100, k + 1);
    const b = buyer.rows[k];
    const r = renter.rows[k];
    return {
      index: k + 1,
      year: cfg.startYear + k,
      propertyValue,
      debt: a.debt,
      buyerDepot: b.valueAfterSale,
      renterDepot: r.valueAfterSale,
      buyerWealth: propertyValue * (1 - cfg.sellCost / 100) - a.debt + b.valueAfterSale,
      renterWealth: r.valueAfterSale,
      interest: a.interest,
      principal: a.principal,
      maintenance: a.maintenance,
      rent: a.rent,
      buyerInvested: a.buyerInvested,
      renterInvested: a.renterInvested,
      deflator: r.deflator,
    };
  });

  // From which year on does buying stay ahead?
  let breakEven: number | null = null;
  for (let k = years.length - 1; k >= 0; k--) {
    if (years[k].buyerWealth >= years[k].renterWealth) breakEven = k + 1;
    else break;
  }

  const sum = (f: (y: BuyRentYear) => number) => years.reduce((s, y) => s + f(y), 0);
  const last = years[years.length - 1];
  const taxes = (res: SimulationResult) => res.summary.taxesPaid + res.summary.saleTax;

  const warnings: string[] = [];
  if (cfg.equity < purchase.total) {
    warnings.push(`Das Eigenkapital deckt die Kaufnebenkosten von ${eur(purchase.total)} nicht; der Rest wird mitfinanziert. Viele Banken verlangen, dass die Nebenkosten aus eigenem Geld kommen, und verlangen sonst höhere Zinsen.`);
  }
  if (loan > 0 && cfg.repayment <= 0) warnings.push('Ohne Tilgung wird der Kredit nie kleiner.');
  if (last.debt > 0.5) warnings.push(`Am Ende sind noch ${eur(last.debt)} Kredit offen; sie sind beim Kaufen vom Vermögen abgezogen.`);

  return {
    years,
    purchase,
    loan,
    monthlyPayment,
    buyerStartDepot,
    breakEven,
    paidOffYear,
    priceToRent: cfg.rent > 0 ? cfg.price / (cfg.rent * 12) : Infinity,
    totals: {
      interest: sum((y) => y.interest),
      principal: sum((y) => y.principal),
      maintenance: sum((y) => y.maintenance),
      rent: sum((y) => y.rent),
      buyerInvested: sum((y) => y.buyerInvested) + buyerStartDepot,
      renterInvested: sum((y) => y.renterInvested) + cfg.equity,
      buyerTaxes: taxes(buyer),
      renterTaxes: taxes(renter),
      sellCosts: (last.propertyValue * cfg.sellCost) / 100,
    },
    warnings,
  };
}

/** The depot settings of the wealth module, started in January so its years match the comparison. */
function depotConfig(cfg: BuyRentConfig, initialCapital: number): SimulationConfig {
  const base = defaultConfig();
  return {
    ...base,
    ...cfg.invest,
    startDate: `${cfg.startYear}-01-01`,
    durationMode: 'years',
    durationYears: Math.max(1, Math.round(cfg.years)),
    initialCapital,
    monthlySavings: 0,
    savingsGrowth: 0,
    savingsSteps: [],
    lumpSums: [],
    oneOffWithdrawals: [],
    withdrawalPhases: [],
    inflation: cfg.inflation,
    dividendStrategy: 'reinvest',
    withdrawal: { ...base.withdrawal, enabled: false },
    goal: { ...base.goal, enabled: false },
    monteCarlo: { ...base.monteCarlo, enabled: false },
  };
}

/** Advantage of buying at the end of the period, in euros (negative: renting is ahead). */
export function endAdvantage(cfg: BuyRentConfig): number {
  const r = simulateBuyRent(cfg);
  const last = r.years[r.years.length - 1];
  return last.buyerWealth - last.renterWealth;
}

interface Lever {
  key: TippingKey;
  label: string;
  unit: '%' | '€';
  get: (c: BuyRentConfig) => number;
  set: (c: BuyRentConfig, v: number) => BuyRentConfig;
  range: (c: BuyRentConfig) => [number, number];
  applies?: (c: BuyRentConfig) => boolean;
}

const LEVERS: Lever[] = [
  {
    key: 'appreciation',
    label: 'Wertsteigerung der Immobilie',
    unit: '%',
    get: (c) => c.appreciation,
    set: (c, v) => ({ ...c, appreciation: v }),
    range: () => [-4, 10],
  },
  {
    key: 'totalReturn',
    label: 'Rendite der Geldanlage',
    unit: '%',
    get: (c) => c.invest.totalReturn,
    set: (c, v) => ({ ...c, invest: { ...c.invest, totalReturn: v, dividendYield: Math.min(c.invest.dividendYield, Math.max(0, v)) } }),
    range: () => [0, 14],
  },
  {
    key: 'followUpRate',
    label: 'Anschlusszins',
    unit: '%',
    get: (c) => c.followUpRate ?? c.interest,
    set: (c, v) => ({ ...c, followUpRate: v }),
    range: () => [0, 14],
    applies: (c) => c.fixedYears < c.years && simulateBuyRent(c).years[Math.min(c.years, c.fixedYears) - 1]?.debt > 1,
  },
  {
    key: 'interest',
    label: 'Sollzins',
    unit: '%',
    get: (c) => c.interest,
    set: (c, v) => ({ ...c, interest: v }),
    range: () => [0, 14],
    applies: (c) => c.equity < c.price,
  },
  {
    key: 'rent',
    label: 'Kaltmiete pro Monat',
    unit: '€',
    get: (c) => c.rent,
    set: (c, v) => ({ ...c, rent: v }),
    range: (c) => [c.rent * 0.25, c.rent * 4],
  },
  {
    key: 'rentIncrease',
    label: 'Mietsteigerung',
    unit: '%',
    get: (c) => c.rentIncrease,
    set: (c, v) => ({ ...c, rentIncrease: v }),
    range: () => [-2, 8],
  },
  {
    key: 'price',
    label: 'Kaufpreis',
    unit: '€',
    get: (c) => c.price,
    set: (c, v) => ({ ...c, price: v }),
    range: (c) => [c.price * 0.3, c.price * 3],
  },
  {
    key: 'maintenance',
    label: 'Instandhaltung',
    unit: '%',
    get: (c) => c.maintenance,
    set: (c, v) => ({ ...c, maintenance: v }),
    range: () => [0, 5],
  },
];

/**
 * For the levers that decide the answer: the value at which buying and renting end equal.
 * Searches the lever's range on a grid for a change of sign, then narrows it down.
 */
export function tippingPoints(cfg: BuyRentConfig): TippingPoint[] {
  const base = endAdvantage(cfg);
  return LEVERS.filter((l) => !l.applies || l.applies(cfg)).map((l) => {
    const current = l.get(cfg);
    const [lo, hi] = l.range(cfg);
    const f = (v: number) => endAdvantage(l.set(cfg, v));
    const steps = 20;
    const xs = Array.from({ length: steps + 1 }, (_, i) => lo + ((hi - lo) * i) / steps);
    const fs = xs.map(f);
    // Of all changes of sign, take the one nearest to the current value
    let best: [number, number] | null = null;
    for (let i = 0; i < steps; i++) {
      if (Math.sign(fs[i]) !== Math.sign(fs[i + 1])) {
        const mid = (xs[i] + xs[i + 1]) / 2;
        if (!best || Math.abs(mid - current) < Math.abs((best[0] + best[1]) / 2 - current)) best = [i, i + 1];
      }
    }
    const rising = fs[steps] > fs[0];
    if (!best) return { key: l.key, label: l.label, unit: l.unit, current, threshold: null, buyingAboveThreshold: rising, buyingWinsNow: base >= 0 };
    let a = xs[best[0]];
    let b = xs[best[1]];
    let fa = fs[best[0]];
    for (let it = 0; it < 30; it++) {
      const m = (a + b) / 2;
      const fm = f(m);
      if (Math.sign(fm) === Math.sign(fa)) {
        a = m;
        fa = fm;
      } else {
        b = m;
      }
    }
    return { key: l.key, label: l.label, unit: l.unit, current, threshold: (a + b) / 2, buyingAboveThreshold: fs[best[1]] > fs[best[0]], buyingWinsNow: base >= 0 };
  });
}

function eur(v: number) {
  return `${Math.round(v).toLocaleString('de-DE')} €`;
}
