import type { FundType, SimulationConfig, SimulationResult, Summary, YearRow } from '../types';

/** Teilfreistellung (§ 20 InvStG): tax-free share of fund income. */
export const PARTIAL_EXEMPTION: Record<FundType, number> = {
  equity: 0.3,
  mixed: 0.15,
  other: 0,
};

const MAX_MONTHS = 100 * 12;

/**
 * Combined rate of Abgeltungsteuer + Soli + Kirchensteuer.
 * Church tax is deductible from the withholding tax base, so it is not simply added:
 * rate = t · (1 + soli + k) / (1 + t · k). At 25 % / 5.5 % / 9 % this gives 27.995 %.
 */
export function effectiveTaxRate(cfg: Pick<SimulationConfig, 'capitalGainsTax' | 'soli' | 'churchTax'>): number {
  const t = cfg.capitalGainsTax / 100;
  const s = cfg.soli / 100;
  const k = cfg.churchTax / 100;
  return (t * (1 + s + k)) / (1 + t * k);
}

/** Parses yyyy-mm-dd without timezone surprises. */
export function parseDate(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  const now = new Date();
  return {
    y: Number.isFinite(y) && y > 1900 ? y : now.getFullYear(),
    m: Number.isFinite(m) && m >= 1 && m <= 12 ? m : 1,
    d: Number.isFinite(d) && d >= 1 ? d : 1,
  };
}

/** Age (completed years) at the end of the given calendar month. */
export function ageAtMonthEnd(birthIso: string, year: number, month: number): number {
  const b = parseDate(birthIso);
  return year - b.y - (month < b.m ? 1 : 0);
}

/** Number of months the simulation runs for. */
export function horizonMonths(cfg: SimulationConfig): number {
  if (cfg.durationMode === 'years') {
    return clamp(Math.round(cfg.durationYears * 12), 1, MAX_MONTHS);
  }
  const s = parseDate(cfg.startDate);
  const b = parseDate(cfg.birthDate);
  // Run up to and including the month of the birthday on which the target age is reached.
  const months = (b.y + cfg.targetAge - s.y) * 12 + (b.m - s.m) + 1;
  return clamp(months, 1, MAX_MONTHS);
}

/** Calendar years covered by the simulation, with the age at the end of each year. */
export function simulationYears(cfg: SimulationConfig): { year: number; age: number }[] {
  const s = parseDate(cfg.startDate);
  const n = horizonMonths(cfg);
  const lastIndex = s.m - 1 + n - 1;
  const endYear = s.y + Math.floor(lastIndex / 12);
  const out: { year: number; age: number }[] = [];
  for (let y = s.y; y <= endYear; y++) {
    const lastMonth = y === endYear ? (lastIndex % 12) + 1 : 12;
    out.push({ year: y, age: ageAtMonthEnd(cfg.birthDate, y, lastMonth) });
  }
  return out;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function monthlyRate(annualPct: number) {
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

/** Monthly savings for a calendar year: latest applicable step (or base), grown by the yearly increase. */
export function savingsForYear(cfg: SimulationConfig, year: number): number {
  const startYear = parseDate(cfg.startDate).y;
  let amount = cfg.monthlySavings;
  let since = startYear;
  for (const step of cfg.savingsSteps) {
    if (step.year <= year && step.year >= since) {
      amount = step.monthlyAmount;
      since = step.year;
    }
  }
  return Math.max(0, amount * Math.pow(1 + cfg.savingsGrowth / 100, year - since));
}

export function runSimulation(cfg: SimulationConfig): SimulationResult {
  const start = parseDate(cfg.startDate);
  const months = horizonMonths(cfg);

  const taxRate = effectiveTaxRate(cfg);
  const exemption = PARTIAL_EXEMPTION[cfg.fundType];
  const fee = cfg.purchaseFee / 100;
  const priceRate = monthlyRate(cfg.totalReturn - cfg.dividendYield);
  const divRate = monthlyRate(cfg.dividendYield);
  const terKeep = Math.pow(1 - cfg.ter / 100, 1 / 12);
  const inflRate = monthlyRate(cfg.inflation);

  let value = 0;
  let costBasis = 0; // for the final sale: deposits + reinvested net dividends + Vorabpauschalen
  let invested = 0;
  let investedReal = 0;
  let deflator = 1;

  let totalDivNet = 0;
  let totalDivNetReal = 0;
  let totalTaxes = 0;
  let totalCosts = 0;

  const rows: YearRow[] = [];
  const recentDivNet: number[] = [];
  const recentDivNetReal: number[] = [];

  // Per-year accumulators
  let allowanceLeft = cfg.allowance;
  let y = {
    valueStart: 0,
    contributions: 0,
    netPurchases: 0, // money added to the fund (deposits after fees + reinvested dividends)
    weightedPurchases: 0, // purchases weighted by remaining months, for the Vorabpauschale
    divGross: 0,
    divNet: 0,
    divNetReal: 0,
    taxes: 0,
    costs: 0,
    months: 0,
  };

  for (let i = 0; i < months; i++) {
    const monthIdx = start.m - 1 + i;
    const year = start.y + Math.floor(monthIdx / 12);
    const month = (monthIdx % 12) + 1;
    const isLast = i === months - 1;

    if (i === 0 || month === 1) {
      allowanceLeft = cfg.allowance;
      y = {
        valueStart: value,
        contributions: 0,
        netPurchases: 0,
        weightedPurchases: 0,
        divGross: 0,
        divNet: 0,
        divNetReal: 0,
        taxes: 0,
        costs: 0,
        months: 0,
      };
    }
    y.months++;

    // 1. Deposits (start of month)
    let deposit = savingsForYear(cfg, year);
    if (i === 0) deposit += cfg.initialCapital;
    if (i === 0 || month === 1) {
      for (const ls of cfg.lumpSums) if (ls.year === year) deposit += ls.amount;
    }
    if (deposit > 0) {
      const feeAmount = deposit * fee;
      const net = deposit - feeAmount;
      value += net;
      invested += deposit;
      investedReal += deposit / deflator;
      costBasis += deposit; // purchase fees are part of the acquisition cost
      y.contributions += deposit;
      y.netPurchases += net;
      y.weightedPurchases += net * ((13 - month) / 12);
      y.costs += feeAmount;
    }

    // 2. Price development
    value *= 1 + priceRate;

    // 3. Distributions, taxed immediately (after Teilfreistellung and allowance)
    const gross = value * divRate;
    let taxable = gross * (1 - exemption);
    const used = Math.min(allowanceLeft, taxable);
    allowanceLeft -= used;
    taxable -= used;
    const divTax = taxable * taxRate;
    const divNet = gross - divTax;
    y.divGross += gross;
    y.divNet += divNet;
    y.taxes += divTax;
    if (cfg.reinvestDividends) {
      value += divNet;
      costBasis += divNet;
      y.netPurchases += divNet;
    }

    // 4. Running costs (TER)
    const after = value * terKeep;
    y.costs += value - after;
    value = after;

    deflator *= 1 + inflRate;
    y.divNetReal += divNet / deflator;
    recentDivNet.push(divNet);
    recentDivNetReal.push(divNet / deflator);
    if (recentDivNet.length > 12) {
      recentDivNet.shift();
      recentDivNetReal.shift();
    }

    // 5. Year end: Vorabpauschale (only for completed calendar years)
    let advance = 0;
    if (month === 12 && cfg.applyAdvanceLumpSum && cfg.baseRate > 0) {
      const baseYield = (y.valueStart + y.weightedPurchases) * (cfg.baseRate / 100) * 0.7;
      const priceGain = value - y.valueStart - y.netPurchases;
      const cappedYield = Math.max(0, Math.min(baseYield, priceGain + y.divGross));
      advance = Math.max(0, cappedYield - y.divGross);
      if (advance > 0) {
        let advTaxable = advance * (1 - exemption);
        const usedA = Math.min(allowanceLeft, advTaxable);
        allowanceLeft -= usedA;
        advTaxable -= usedA;
        const advTax = advTaxable * taxRate;
        // Taxed amounts raise the cost basis so they are not taxed twice on sale.
        costBasis += advance;
        if (advTax > 0) {
          // The tax is paid out of the depot (proportional sale).
          costBasis -= costBasis * (advTax / value);
          value -= advTax;
          y.taxes += advTax;
        }
      }
    }

    if (month === 12 || isLast) {
      totalDivNet += y.divNet;
      totalDivNetReal += y.divNetReal;
      totalTaxes += y.taxes;
      totalCosts += y.costs;
      rows.push({
        year,
        age: ageAtMonthEnd(cfg.birthDate, year, month),
        months: y.months,
        contributions: y.contributions,
        investedTotal: invested,
        realInvestedTotal: investedReal,
        valueStart: y.valueStart,
        valueEnd: value,
        realValueEnd: value / deflator,
        dividendsGross: y.divGross,
        dividendsNet: y.divNet,
        realDividendsNet: y.divNetReal,
        monthlyDividendNet: y.divNet / y.months,
        realMonthlyDividendNet: y.divNetReal / y.months,
        taxes: y.taxes,
        advanceLumpSum: advance,
        costs: y.costs,
        deflator,
      });
    }
  }

  // Fictitious sale at the end
  const gain = value - costBasis;
  const saleTaxable = Math.max(0, gain * (1 - exemption) - allowanceLeft);
  const saleTax = saleTaxable * taxRate;
  const last = rows[rows.length - 1];
  const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

  const summary: Summary = {
    years: months / 12,
    months,
    endAge: last.age,
    endYear: last.year,
    invested,
    investedReal,
    valueNominal: value,
    valueReal: value / deflator,
    growth: value - invested,
    dividendsNet: totalDivNet,
    dividendsNetReal: totalDivNetReal,
    taxesPaid: totalTaxes,
    costsPaid: totalCosts,
    saleTax,
    valueAfterSale: value - saleTax,
    valueAfterSaleReal: (value - saleTax) / deflator,
    finalMonthlyDividendNet: avg(recentDivNet),
    finalMonthlyDividendNetReal: avg(recentDivNetReal),
    deflator,
  };

  return { rows, summary };
}
