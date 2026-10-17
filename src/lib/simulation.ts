import type { FundType, SimulationConfig, SimulationResult, Summary, WithdrawalSummary, YearRow } from '../types';

/** Teilfreistellung (§ 20 InvStG): tax-free share of fund income. */
export const PARTIAL_EXEMPTION: Record<FundType, number> = {
  equity: 0.3,
  mixed: 0.15,
  other: 0,
};

const MAX_MONTHS = 100 * 12;
const EMPTY = 0.5; // a depot below 50 cents counts as used up

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

/** True if a withdrawal phase is configured and starts within the simulated period. */
export function withdrawalActive(cfg: SimulationConfig): boolean {
  if (!cfg.withdrawal.enabled) return false;
  const years = simulationYears(cfg);
  return cfg.withdrawal.startYear <= years[years.length - 1].year;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function monthlyRate(annualPct: number) {
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

/** Whether distributions in the given calendar year go back into the depot. */
export function reinvestsIn(cfg: SimulationConfig, year: number): boolean {
  switch (cfg.dividendStrategy) {
    case 'reinvest':
      return true;
    case 'payout':
      return false;
    case 'withWithdrawal':
      return !(cfg.withdrawal.enabled && year >= cfg.withdrawal.startYear);
    case 'fromYear':
      return year < cfg.dividendPayoutYear;
  }
}

/**
 * Monthly savings for a calendar year: latest applicable step (or base), grown by the yearly increase.
 * With `planned`, the stop at the start of the withdrawal phase is ignored.
 */
export function savingsForYear(cfg: SimulationConfig, year: number, planned = false): number {
  const w = cfg.withdrawal;
  if (!planned && w.enabled && w.stopContributions && year >= w.startYear) return 0;
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
  const w = cfg.withdrawal;

  let value = 0;
  let costBasis = 0; // for taxing sales: deposits + reinvested net dividends + Vorabpauschalen
  let invested = 0;
  let investedReal = 0;
  let deflator = 1;

  let totalDivNet = 0;
  let totalDivNetReal = 0;
  let totalTaxes = 0;
  let totalCosts = 0;
  let totalWithdrawnNet = 0;

  // Withdrawal phase
  let wBaseGross = 0; // 'rate' mode: gross monthly amount fixed at the start
  let wStarted = false;
  let wStartValue = 0;
  let wStartDeflator = 1;
  let wStartAge = 0;
  let wFirstNet = 0;
  let wFirstGross = 0;
  let phaseMonths = 0;
  const fy = { gross: 0, net: 0, div: 0, freed: 0, months: 0 }; // first 12 months of the withdrawal phase
  let wLastNet = 0;
  let totalDivPaid = 0;
  let totalDivPaidReal = 0;
  let wMonths = 0;
  let wGross = 0;
  let wNet = 0;
  let wNetReal = 0;
  let wTaxes = 0;
  let depleted: { year: number; age: number } | null = null;

  const rows: YearRow[] = [];
  const recentDivNet: number[] = [];
  const recentDivNetReal: number[] = [];

  let allowanceLeft = cfg.allowance;
  const newYear = (valueStart: number) => ({
    valueStart,
    contributions: 0,
    netPurchases: 0, // money added to the fund (deposits after fees + reinvested dividends)
    weightedPurchases: 0, // purchases weighted by remaining months, for the Vorabpauschale
    sales: 0,
    divGross: 0,
    divNet: 0,
    divNetReal: 0,
    divPaid: 0,
    divPaidReal: 0,
    reinvest: true,
    freed: 0,
    freedReal: 0,
    wGross: 0,
    wNet: 0,
    wNetReal: 0,
    taxes: 0,
    costs: 0,
    months: 0,
  });
  let y = newYear(0);

  /** Tax on selling `gross` worth of shares, using the remaining allowance. */
  const saleTax = (gross: number) => {
    const gainShare = value > 0 ? Math.max(0, 1 - costBasis / value) : 0;
    const taxable = gross * gainShare * (1 - exemption);
    const used = Math.min(allowanceLeft, taxable);
    return { tax: (taxable - used) * taxRate, used };
  };

  for (let i = 0; i < months; i++) {
    const monthIdx = start.m - 1 + i;
    const year = start.y + Math.floor(monthIdx / 12);
    const month = (monthIdx % 12) + 1;
    const isLast = i === months - 1;

    if (i === 0 || month === 1) {
      allowanceLeft = cfg.allowance;
      y = newYear(value);
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

    // Savings that are no longer invested because the plan stopped for the withdrawal phase
    const freed = savingsForYear(cfg, year, true) - savingsForYear(cfg, year);
    y.freed += freed;

    // 2. Price development
    value *= 1 + priceRate;

    // 3. Distributions, taxed immediately (after Teilfreistellung and allowance)
    const divGross = value * divRate;
    let taxable = divGross * (1 - exemption);
    const used = Math.min(allowanceLeft, taxable);
    allowanceLeft -= used;
    taxable -= used;
    const divTax = taxable * taxRate;
    const divNet = divGross - divTax;
    const reinvest = reinvestsIn(cfg, year);
    y.reinvest = reinvest;
    y.divGross += divGross;
    y.divNet += divNet;
    y.taxes += divTax;
    const divPaid = reinvest ? 0 : divNet;
    if (reinvest) {
      value += divNet;
      costBasis += divNet;
      y.netPurchases += divNet;
    } else {
      y.divPaid += divNet;
    }

    // 4. Withdrawal: sell shares and pay tax on the gain portion
    const inPhase = w.enabled && year >= w.startYear;
    let wMonthGross = 0;
    let wMonthNet = 0;
    if (inPhase && !wStarted) {
      wStarted = true;
      wStartValue = value;
      wStartDeflator = deflator;
      wStartAge = ageAtMonthEnd(cfg.birthDate, year, month);
      wBaseGross = (value * w.rate) / 100 / 12;
    }
    if (inPhase && value > EMPTY) {
      const growth = w.inflationAdjust ? Math.pow(1 + cfg.inflation / 100, year - w.startYear) : 1;
      let gross: number;
      if (w.mode === 'fixed') {
        let target = Math.max(0, w.monthlyNet * growth);
        // Paid-out dividends already cover part of the target; only sell the rest.
        if (w.countDividends) target = Math.max(0, target - divPaid);
        // Gross-up so that the payout after tax equals the target.
        const gainShare = Math.max(0, 1 - costBasis / value);
        const k = gainShare * (1 - exemption);
        gross = target * k <= allowanceLeft ? target : (target - allowanceLeft * taxRate) / (1 - k * taxRate);
      } else {
        gross = wBaseGross * growth;
      }
      gross = Math.min(gross, value);
      if (gross > 0) {
        const { tax, used: usedW } = saleTax(gross);
        allowanceLeft -= usedW;
        const net = gross - tax;
        costBasis -= costBasis * (gross / value);
        value -= gross;
        wMonthGross = gross;
        wMonthNet = net;
        y.sales += gross;
        y.wGross += gross;
        y.wNet += net;
        y.taxes += tax;
        wTaxes += tax;
        wGross += gross;
        wNet += net;
        wMonths++;
        wLastNet = net;
        if (wMonths === 1) {
          wFirstNet = net;
          wFirstGross = gross;
        }
        if (value <= EMPTY && !depleted) {
          depleted = { year, age: ageAtMonthEnd(cfg.birthDate, year, month) };
          costBasis = 0;
          value = 0;
        }
      }
    }

    // 5. Running costs (TER)
    const after = value * terKeep;
    y.costs += value - after;
    value = after;

    deflator *= 1 + inflRate;
    y.divNetReal += divNet / deflator;
    y.divPaidReal += divPaid / deflator;
    y.wNetReal += wMonthNet / deflator;
    y.freedReal += freed / deflator;
    wNetReal += wMonthNet / deflator;
    if (inPhase) {
      phaseMonths++;
      if (phaseMonths <= 12) {
        fy.gross += wMonthGross;
        fy.net += wMonthNet;
        fy.div += divPaid;
        fy.freed += freed;
        fy.months++;
      }
    }
    recentDivNet.push(divNet);
    recentDivNetReal.push(divNet / deflator);
    if (recentDivNet.length > 12) {
      recentDivNet.shift();
      recentDivNetReal.shift();
    }

    // 6. Year end: Vorabpauschale (only for completed calendar years)
    let advance = 0;
    if (month === 12 && cfg.applyAdvanceLumpSum && cfg.baseRate > 0 && value > EMPTY) {
      const base = Math.max(0, y.valueStart + y.weightedPurchases - y.sales);
      const baseYield = base * (cfg.baseRate / 100) * 0.7;
      const priceGain = value - y.valueStart - y.netPurchases + y.sales;
      const cappedYield = Math.max(0, Math.min(baseYield, priceGain + y.divGross));
      advance = Math.max(0, cappedYield - y.divGross);
      if (advance > 0) {
        let advTaxable = advance * (1 - exemption);
        const usedA = Math.min(allowanceLeft, advTaxable);
        allowanceLeft -= usedA;
        advTaxable -= usedA;
        const advTax = Math.min(value, advTaxable * taxRate);
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
      totalWithdrawnNet += y.wNet;
      totalDivPaid += y.divPaid;
      totalDivPaidReal += y.divPaidReal;
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
        dividendsReinvested: y.reinvest,
        dividendsPaidOut: y.divPaid,
        realDividendsPaidOut: y.divPaidReal,
        freedSavings: y.freed,
        realFreedSavings: y.freedReal,
        taxes: y.taxes,
        advanceLumpSum: advance,
        withdrawalGross: y.wGross,
        withdrawalNet: y.wNet,
        realWithdrawalNet: y.wNetReal,
        monthlyWithdrawalNet: y.wNet / y.months,
        realMonthlyWithdrawalNet: y.wNetReal / y.months,
        withdrawnTotalNet: totalWithdrawnNet,
        costs: y.costs,
        deflator,
      });
    }
  }

  // Fictitious sale at the end
  const gain = value - costBasis;
  const saleTaxable = Math.max(0, gain * (1 - exemption) - allowanceLeft);
  const finalSaleTax = saleTaxable * taxRate;
  const last = rows[rows.length - 1];
  const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

  const withdrawal: WithdrawalSummary | null = wStarted
    ? {
        startYear: w.startYear,
        startAge: wStartAge,
        startValue: wStartValue,
        startValueReal: wStartValue / wStartDeflator,
        firstMonthlyNet: wFirstNet,
        firstMonthlyNetReal: wFirstNet / wStartDeflator,
        firstMonthlyGross: wFirstGross,
        firstYearMonthlyGross: fy.months ? fy.gross / fy.months : 0,
        firstYearMonthlyNet: fy.months ? fy.net / fy.months : 0,
        firstYearMonthlyDividends: fy.months ? fy.div / fy.months : 0,
        firstYearMonthlyFreed: fy.months ? fy.freed / fy.months : 0,
        lastMonthlyNet: wLastNet,
        effectiveRate: wStartValue > 0 && fy.months ? (((fy.gross / fy.months) * 12) / wStartValue) * 100 : 0,
        months: wMonths,
        gross: wGross,
        net: wNet,
        netReal: wNetReal,
        taxes: wTaxes,
        depletedYear: depleted?.year ?? null,
        depletedAge: depleted?.age ?? null,
      }
    : null;

  const summary: Summary = {
    years: months / 12,
    months,
    endAge: last.age,
    endYear: last.year,
    invested,
    investedReal,
    valueNominal: value,
    valueReal: value / deflator,
    // Everything the depot produced: what is left + what was sold + dividends that were paid out
    growth: value + wGross + totalDivPaid - invested,
    dividendsNet: totalDivNet,
    dividendsNetReal: totalDivNetReal,
    dividendsPaidOut: totalDivPaid,
    dividendsPaidOutReal: totalDivPaidReal,
    taxesPaid: totalTaxes,
    costsPaid: totalCosts,
    saleTax: finalSaleTax,
    valueAfterSale: value - finalSaleTax,
    valueAfterSaleReal: (value - finalSaleTax) / deflator,
    finalMonthlyDividendNet: avg(recentDivNet),
    finalMonthlyDividendNetReal: avg(recentDivNetReal),
    deflator,
    withdrawal,
  };

  return { rows, summary };
}
