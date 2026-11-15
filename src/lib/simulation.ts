import type { FundType, SimulationConfig, SimulationResult, Summary, WithdrawalSummary, WithdrawalTarget, YearRow } from '../types';

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

/** True if the withdrawal amount is calculated from life expectancy and the wealth to keep. */
export function usesLifeExpectancy(cfg: SimulationConfig): boolean {
  return cfg.withdrawal.enabled && cfg.withdrawal.mode === 'target';
}

/** Age at which the simulation ends, or null if it runs for a fixed number of years. */
export function horizonAge(cfg: SimulationConfig): number | null {
  // With a life expectancy, the plan always runs exactly until that age.
  if (usesLifeExpectancy(cfg)) return cfg.withdrawal.lifeExpectancy;
  return cfg.durationMode === 'years' ? null : cfg.targetAge;
}

/** Number of months the simulation runs for. */
export function horizonMonths(cfg: SimulationConfig): number {
  const untilAge = horizonAge(cfg);
  if (untilAge == null) {
    return clamp(Math.round(cfg.durationYears * 12), 1, MAX_MONTHS);
  }
  const s = parseDate(cfg.startDate);
  const b = parseDate(cfg.birthDate);
  // Run up to and including the month of the birthday on which the target age is reached.
  const months = (b.y + untilAge - s.y) * 12 + (b.m - s.m) + 1;
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

/** The 'target' plan as a fixed withdrawal of `monthlyNet`, still ending at the life expectancy. */
function asFixedPlan(cfg: SimulationConfig, monthlyNet: number): SimulationConfig {
  return {
    ...cfg,
    durationMode: 'age',
    targetAge: cfg.withdrawal.lifeExpectancy,
    withdrawal: { ...cfg.withdrawal, mode: 'fixed', monthlyNet },
  };
}

/**
 * 'target' mode: the largest net amount per month that can be paid in full every month
 * and still leaves the wanted wealth at the end (found by bisection).
 */
export function solveWithdrawal(cfg: SimulationConfig): WithdrawalTarget | null {
  if (!usesLifeExpectancy(cfg) || !withdrawalActive(cfg)) return null;
  const endWealth = Math.max(0, cfg.withdrawal.endWealth);
  const basis = cfg.withdrawal.endWealthBasis;
  const ok = (x: number) => {
    const s = simulate(asFixedPlan(cfg, x)).summary;
    return !s.withdrawal?.shortfall && !s.eventShortfall && (basis === 'real' ? s.valueReal : s.valueNominal) >= endWealth;
  };
  if (!ok(0)) return { monthlyNet: 0, endWealth, basis, reachable: false };
  let lo = 0;
  let hi = 1000;
  while (hi < 1e9 && ok(hi)) {
    lo = hi;
    hi *= 2;
  }
  if (hi >= 1e9) return { monthlyNet: lo, endWealth, basis, reachable: true };
  while (hi - lo > 0.2) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) lo = mid;
    else hi = mid;
  }
  // Whole euros, rounded down so the wanted wealth is never undercut.
  return { monthlyNet: Math.floor(lo), endWealth, basis, reachable: true };
}

/** The plan with a fixed net withdrawal of `monthlyNet` (in 'target' mode still ending at the life expectancy). */
export function withFixedWithdrawal(cfg: SimulationConfig, monthlyNet: number): SimulationConfig {
  return usesLifeExpectancy(cfg) ? asFixedPlan(cfg, monthlyNet) : { ...cfg, withdrawal: { ...cfg.withdrawal, mode: 'fixed', monthlyNet } };
}

/** In 'target' mode: the same plan with the calculated amount as a fixed withdrawal. */
export function resolveWithdrawal(cfg: SimulationConfig, target = solveWithdrawal(cfg)): SimulationConfig {
  return usesLifeExpectancy(cfg) ? asFixedPlan(cfg, target?.monthlyNet ?? 0) : cfg;
}

export function runSimulation(cfg: SimulationConfig): SimulationResult {
  if (!usesLifeExpectancy(cfg)) return simulate(cfg);
  const target = solveWithdrawal(cfg);
  const res = simulate(resolveWithdrawal(cfg, target));
  if (res.summary.withdrawal) res.summary.withdrawal.target = target;
  return res;
}

/** Shares bought in one month. Sales take the oldest lots first (FIFO), as German brokers do. */
interface Lot {
  units: number;
  cost: number; // acquisition cost incl. fees, plus Vorabpauschalen already taxed
}

/**
 * Runs the monthly simulation. `shocks` (Monte Carlo) holds one factor per month that is
 * applied to the price development on top of the expected return; without it every month
 * grows at exactly the expected rate.
 */
export function simulate(cfg: SimulationConfig, shocks?: ArrayLike<number>): SimulationResult {
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
  const phases = cfg.withdrawalPhases.filter((p) => p.monthlyNet > 0 && p.endYear >= p.startYear);

  // The depot: shares in monthly lots at a common price. value = units × price.
  let price = 1;
  let units = 0;
  let value = 0;
  let costBasis = 0; // sum of all lot costs
  let lots: Lot[] = [];
  let head = 0; // index of the oldest lot that still holds shares
  let lotMonth = -1; // month index in which the newest lot was opened

  let invested = 0;
  let investedReal = 0;
  let deflator = 1;

  let totalDivNet = 0;
  let totalDivNetReal = 0;
  let totalTaxes = 0;
  let totalCosts = 0;
  let totalWithdrawnNet = 0;

  // All sales that were paid out: the withdrawal phase, temporary withdrawals and one-off withdrawals
  let soldGross = 0;
  let soldNet = 0;
  let soldNetReal = 0;
  let soldTaxes = 0;
  let oneOffNet = 0;
  let oneOffNetReal = 0;
  let eventShortfall: { year: number; missing: number } | null = null;

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
  let shortfall = false;

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
    oneOffGross: 0,
    oneOffNet: 0,
    oneOffNetReal: 0,
    taxes: 0,
    costs: 0,
    months: 0,
  });
  let y = newYear(0);

  // Values that are constant within a calendar year
  let savings = 0; // monthly deposit
  let freed = 0; // savings no longer invested because the plan stopped for the withdrawal phase
  let reinvest = true;
  let inPhase = false;
  let phaseGrowth = 1;
  let tempTarget = 0; // temporary withdrawals per month
  let tempIds: string[] = [];

  /** Buys shares for `net` euros; `cost` is what counts as acquisition cost. */
  const buy = (net: number, cost: number, monthIndex: number) => {
    const u = net / price;
    if (lotMonth === monthIndex && lots.length > head) {
      const lot = lots[lots.length - 1];
      lot.units += u;
      lot.cost += cost;
    } else {
      lots.push({ units: u, cost });
      lotMonth = monthIndex;
    }
    units += u;
    costBasis += cost;
    value = units * price;
  };

  const emptyDepot = () => {
    lots = [];
    head = 0;
    lotMonth = -1;
    units = 0;
    costBasis = 0;
    value = 0;
  };

  /**
   * Sells the oldest shares first and taxes the gain of exactly those shares
   * (after Teilfreistellung and the remaining allowance). `amount` is either the
   * wanted payout after tax (`asNet`) or the sale proceeds before tax.
   * If the depot is too small, everything is sold.
   */
  const sell = (amount: number, asNet: boolean) => {
    const A = allowanceLeft;
    const k = (1 - exemption) * taxRate; // tax per euro of gain once the allowance is used up
    const netOf = (p: number, g: number) => p - Math.max(0, g * (1 - exemption) - A) * taxRate;
    let proceeds = 0;
    let gain = 0;
    let idx = head;
    while (idx < lots.length) {
      const lot = lots[idx];
      const a = lot.units * price; // proceeds if the whole lot is sold
      const g = a - lot.cost;
      let f = 1; // share of this lot that is sold
      let last = false;
      if (asNet) {
        if (netOf(proceeds + a, gain + g) >= amount) {
          // Payout is the lower of two straight lines in f (untaxed / taxed), so solve both and take the larger f.
          const f1 = a > 0 ? (amount - proceeds) / a : 0;
          const den = a - k * g;
          const f2 = den > 0 ? (amount - proceeds + taxRate * (gain * (1 - exemption) - A)) / den : 0;
          f = clamp(Math.max(f1, f2), 0, 1);
          last = true;
        }
      } else if (proceeds + a >= amount) {
        f = a > 0 ? clamp((amount - proceeds) / a, 0, 1) : 0;
        last = true;
      }
      proceeds += f * a;
      gain += f * g;
      units -= f * lot.units;
      costBasis -= f * lot.cost;
      if (f >= 1) {
        idx++;
      } else {
        lot.units *= 1 - f;
        lot.cost *= 1 - f;
      }
      if (last) break;
    }
    head = idx;
    value = units * price;
    if (head >= lots.length || value <= EMPTY) emptyDepot();

    // Losses of single lots are netted within the sale; an overall loss is not carried forward.
    const taxable = Math.max(0, gain * (1 - exemption));
    const used = Math.min(allowanceLeft, taxable);
    allowanceLeft -= used;
    const tax = (taxable - used) * taxRate;
    return { gross: proceeds, net: proceeds - tax, tax };
  };

  const missed = new Set<string>(); // event withdrawals that could not be paid in full at least once
  const noteEventShortfall = (year: number, missing: number, ids: string[]) => {
    if (missing <= 0.005) return;
    if (!eventShortfall) eventShortfall = { year, missing };
    for (const id of ids) missed.add(id);
  };

  for (let i = 0; i < months; i++) {
    const monthIdx = start.m - 1 + i;
    const year = start.y + Math.floor(monthIdx / 12);
    const month = (monthIdx % 12) + 1;
    const isLast = i === months - 1;
    const yearStart = i === 0 || month === 1;

    if (yearStart) {
      allowanceLeft = cfg.allowance;
      y = newYear(value);
      // Everything that only depends on the calendar year is worked out once per year.
      savings = savingsForYear(cfg, year);
      freed = savingsForYear(cfg, year, true) - savings;
      reinvest = reinvestsIn(cfg, year);
      inPhase = w.enabled && year >= w.startYear;
      phaseGrowth = w.inflationAdjust ? Math.pow(1 + cfg.inflation / 100, year - w.startYear) : 1;
      tempTarget = 0;
      tempIds = [];
      for (const p of phases) {
        if (year < p.startYear || year > p.endYear) continue;
        tempIds.push(p.id);
        tempTarget += p.monthlyNet * (p.inflationAdjust ? Math.pow(1 + cfg.inflation / 100, year - p.startYear) : 1);
      }
    }
    y.months++;

    // 1. Deposits (start of month)
    let deposit = savings;
    if (i === 0) deposit += cfg.initialCapital;
    if (yearStart) {
      for (const ls of cfg.lumpSums) if (ls.year === year) deposit += ls.amount;
    }
    if (deposit > 0) {
      const feeAmount = deposit * fee;
      const net = deposit - feeAmount;
      buy(net, deposit, i); // purchase fees are part of the acquisition cost
      invested += deposit;
      investedReal += deposit / deflator;
      y.contributions += deposit;
      y.netPurchases += net;
      y.weightedPurchases += net * ((13 - month) / 12);
      y.costs += feeAmount;
    }

    y.freed += freed;

    // 2. Price development
    price *= shocks ? (1 + priceRate) * shocks[i] : 1 + priceRate;
    value = units * price;

    // 3. Distributions, taxed immediately (after Teilfreistellung and allowance)
    const divGross = value * divRate;
    let taxable = divGross * (1 - exemption);
    const used = Math.min(allowanceLeft, taxable);
    allowanceLeft -= used;
    taxable -= used;
    const divTax = taxable * taxRate;
    const divNet = divGross - divTax;
    y.reinvest = reinvest;
    y.divGross += divGross;
    y.divNet += divNet;
    y.taxes += divTax;
    const divPaid = reinvest ? 0 : divNet;
    if (reinvest) {
      if (divNet > 0) buy(divNet, divNet, i);
      y.netPurchases += divNet;
    } else {
      y.divPaid += divNet;
    }

    // 4. Sales. Shares are sold oldest first and the gain of those shares is taxed.
    const record = (s: { gross: number; net: number; tax: number }) => {
      y.sales += s.gross;
      y.taxes += s.tax;
      soldGross += s.gross;
      soldNet += s.net;
      soldTaxes += s.tax;
    };

    // 4a. One-off withdrawals (events), in January of their year
    let oneOffMonthNet = 0;
    if (yearStart) {
      let want = 0;
      for (const o of cfg.oneOffWithdrawals) if (o.year === year && o.amount > 0) want += o.amount;
      if (want > 0) {
        if (value > EMPTY) {
          const s = sell(want, true);
          record(s);
          oneOffMonthNet = s.net;
          y.oneOffGross += s.gross;
          y.oneOffNet += s.net;
          oneOffNet += s.net;
        }
        noteEventShortfall(year, want - oneOffMonthNet, cfg.oneOffWithdrawals.filter((o) => o.year === year && o.amount > 0).map((o) => o.id));
      }
    }

    // 4b. Temporary monthly withdrawals (events)
    let wMonthGross = 0; // all regular withdrawals of this month
    let wMonthNet = 0;
    if (tempTarget > 0) {
      if (value > EMPTY) {
        const s = sell(tempTarget, true);
        record(s);
        wMonthGross += s.gross;
        wMonthNet += s.net;
      }
      noteEventShortfall(year, tempTarget - wMonthNet, tempIds);
    }

    // 4c. Withdrawal phase
    let mainGross = 0;
    let mainNet = 0;
    if (inPhase && !wStarted) {
      wStarted = true;
      wStartValue = value;
      wStartDeflator = deflator;
      wStartAge = ageAtMonthEnd(cfg.birthDate, year, month);
      wBaseGross = (value * w.rate) / 100 / 12;
    }
    if (inPhase && value > EMPTY) {
      const growth = phaseGrowth;
      let s: { gross: number; net: number; tax: number } | null = null;
      if (w.mode === 'rate') {
        const gross = wBaseGross * growth;
        if (gross > value) shortfall = true;
        if (gross > 0) s = sell(Math.min(gross, value), false);
      } else {
        let target = Math.max(0, w.monthlyNet * growth);
        // Paid-out dividends already cover part of the target; only sell the rest.
        if (w.countDividends) target = Math.max(0, target - divPaid);
        if (target > 0) {
          // Sells as much as it takes for the payout after tax to equal the target.
          s = sell(target, true);
          if (s.net < target - 0.005) shortfall = true;
        }
      }
      if (s && s.gross > 0) {
        record(s);
        mainGross = s.gross;
        mainNet = s.net;
        wMonthGross += s.gross;
        wMonthNet += s.net;
        wTaxes += s.tax;
        wGross += s.gross;
        wNet += s.net;
        wMonths++;
        wLastNet = s.net;
        if (wMonths === 1) {
          wFirstNet = s.net;
          wFirstGross = s.gross;
        }
      }
    } else if (inPhase && w.mode !== 'rate' && w.monthlyNet > 0) {
      shortfall = true; // nothing left to sell
    }
    if (inPhase && value <= EMPTY && !depleted) {
      depleted = { year, age: ageAtMonthEnd(cfg.birthDate, year, month) };
    }
    y.wGross += wMonthGross;
    y.wNet += wMonthNet;

    // 5. Running costs (TER)
    const beforeTer = value;
    price *= terKeep;
    value = units * price;
    y.costs += beforeTer - value;

    deflator *= 1 + inflRate;
    y.divNetReal += divNet / deflator;
    y.divPaidReal += divPaid / deflator;
    y.wNetReal += wMonthNet / deflator;
    y.oneOffNetReal += oneOffMonthNet / deflator;
    y.freedReal += freed / deflator;
    wNetReal += mainNet / deflator;
    soldNetReal += (wMonthNet + oneOffMonthNet) / deflator;
    oneOffNetReal += oneOffMonthNet / deflator;
    if (inPhase) {
      phaseMonths++;
      if (phaseMonths <= 12) {
        fy.gross += mainGross;
        fy.net += mainNet;
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
        // Taxed amounts raise the cost of every share so they are not taxed twice on sale.
        // The tax itself is paid out of the depot (a small share of every lot, untaxed).
        const perUnit = advance / units;
        const keep = 1 - advTax / value;
        for (let j = head; j < lots.length; j++) {
          const lot = lots[j];
          lot.cost = (lot.cost + perUnit * lot.units) * keep;
          lot.units *= keep;
        }
        costBasis = (costBasis + advance) * keep;
        units *= keep;
        value = units * price;
        y.taxes += advTax;
      }
    }

    if (month === 12 || isLast) {
      totalDivNet += y.divNet;
      totalDivNetReal += y.divNetReal;
      totalTaxes += y.taxes;
      totalCosts += y.costs;
      totalWithdrawnNet += y.wNet + y.oneOffNet;
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
        oneOffGross: y.oneOffGross,
        oneOffNet: y.oneOffNet,
        realOneOffNet: y.oneOffNetReal,
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
        depletedYear: (depleted as { year: number; age: number } | null)?.year ?? null,
        depletedAge: (depleted as { year: number; age: number } | null)?.age ?? null,
        shortfall,
        target: null,
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
    growth: value + soldGross + totalDivPaid - invested,
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
    withdrawnGross: soldGross,
    withdrawnNet: soldNet,
    withdrawnNetReal: soldNetReal,
    withdrawalTaxes: soldTaxes,
    oneOffNet,
    oneOffNetReal,
    eventShortfall,
    missedEvents: [...missed],
    withdrawal,
  };

  return { rows, summary };
}
