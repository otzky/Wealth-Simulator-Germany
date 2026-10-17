export type DurationMode = 'years' | 'age';
export type ValueBasis = 'nominal' | 'real';
export type FundType = 'equity' | 'mixed' | 'other';
export type ChurchTax = 0 | 8 | 9;
export type GoalVariable = 'savings' | 'initial' | 'return';
export type WithdrawalMode = 'fixed' | 'rate';
/** What happens with distributions: reinvest, pay out, or switch from reinvesting to paying out. */
export type DividendStrategy = 'reinvest' | 'payout' | 'withWithdrawal' | 'fromYear';

export interface WithdrawalConfig {
  enabled: boolean;
  startYear: number; // withdrawals start in January of this calendar year
  mode: WithdrawalMode;
  monthlyNet: number; // 'fixed': desired net payout per month at the start
  rate: number; // 'rate': % p.a. of the depot value at the start (before tax)
  inflationAdjust: boolean; // raise the amount every year by the inflation rate
  stopContributions: boolean; // stop the monthly savings once withdrawals start
  countDividends: boolean; // 'fixed': paid-out dividends count towards the monthly target
}

/** From the given calendar year onward, the monthly savings rate changes to `monthlyAmount`. */
export interface SavingsStep {
  id: string;
  year: number;
  monthlyAmount: number;
}

/** A one-off deposit in January of the given calendar year. */
export interface LumpSum {
  id: string;
  year: number;
  amount: number;
  label?: string;
}

export interface SimulationConfig {
  // Profile & horizon
  birthDate: string; // yyyy-mm-dd
  startDate: string; // yyyy-mm-dd
  durationMode: DurationMode;
  durationYears: number;
  targetAge: number;

  // Contributions
  initialCapital: number;
  monthlySavings: number;
  savingsGrowth: number; // % increase per year (Dynamik)
  savingsSteps: SavingsStep[];
  lumpSums: LumpSum[];

  // Market
  totalReturn: number; // % p.a., incl. distributions
  dividendYield: number; // % p.a., part of totalReturn
  inflation: number; // % p.a.
  dividendStrategy: DividendStrategy;
  dividendPayoutYear: number; // for 'fromYear': paid out from January of this year
  returnSpread: number; // ± percentage points for the scenario band

  // Costs
  purchaseFee: number; // % of each purchase
  ter: number; // % p.a.

  // German taxes
  capitalGainsTax: number; // Abgeltungsteuer, 25
  soli: number; // % of KapESt, 5.5
  churchTax: ChurchTax;
  allowance: number; // Sparerpauschbetrag
  fundType: FundType; // determines Teilfreistellung
  applyAdvanceLumpSum: boolean; // Vorabpauschale
  baseRate: number; // Basiszins, %

  // Withdrawal phase (Entnahme)
  withdrawal: WithdrawalConfig;

  // Goal
  goal: {
    enabled: boolean;
    wealth: number | null;
    wealthBasis: ValueBasis;
    monthlyDividend: number | null;
    dividendBasis: ValueBasis;
    solveFor: GoalVariable;
  };
}

export interface YearRow {
  year: number; // calendar year
  age: number; // age at the end of that year
  months: number; // simulated months in that year (first/last year can be partial)
  contributions: number; // deposits during the year (gross, incl. fees)
  investedTotal: number; // cumulative deposits
  realInvestedTotal: number; // cumulative deposits in today's money
  valueStart: number;
  valueEnd: number;
  realValueEnd: number;
  dividendsGross: number;
  dividendsNet: number;
  realDividendsNet: number;
  monthlyDividendNet: number; // average per simulated month
  realMonthlyDividendNet: number;
  dividendsReinvested: boolean; // true if this year's distributions went back into the depot
  dividendsPaidOut: number; // net, paid to you
  realDividendsPaidOut: number;
  freedSavings: number; // savings no longer invested because the plan stopped
  realFreedSavings: number;
  taxes: number; // taxes on distributions, Vorabpauschale and withdrawals
  advanceLumpSum: number; // Vorabpauschale (before tax)
  withdrawalGross: number; // shares sold for withdrawals
  withdrawalNet: number; // paid out after tax
  realWithdrawalNet: number;
  monthlyWithdrawalNet: number; // average per simulated month
  realMonthlyWithdrawalNet: number;
  withdrawnTotalNet: number; // cumulative net withdrawals
  costs: number; // fees + TER
  deflator: number; // cumulative inflation factor at year end
}

export interface Summary {
  years: number;
  months: number;
  endAge: number;
  endYear: number;
  invested: number;
  investedReal: number;
  valueNominal: number;
  valueReal: number;
  growth: number; // valueNominal + withdrawnGross + dividendsPaidOut - invested
  dividendsNet: number;
  dividendsNetReal: number;
  dividendsPaidOut: number; // net dividends that were paid out instead of reinvested
  dividendsPaidOutReal: number;
  taxesPaid: number;
  costsPaid: number;
  saleTax: number; // tax due on a full sale at the end
  valueAfterSale: number;
  valueAfterSaleReal: number;
  finalMonthlyDividendNet: number;
  finalMonthlyDividendNetReal: number;
  deflator: number;
  withdrawal: WithdrawalSummary | null;
}

export interface WithdrawalSummary {
  startYear: number;
  startAge: number;
  startValue: number; // depot value right before the first withdrawal
  startValueReal: number;
  firstMonthlyNet: number;
  firstMonthlyNetReal: number;
  firstMonthlyGross: number;
  firstYearMonthlyGross: number; // average gross sale per month in the first withdrawal year
  firstYearMonthlyNet: number; // average net withdrawal per month in the first withdrawal year
  firstYearMonthlyDividends: number; // average paid-out dividends per month in the first withdrawal year
  firstYearMonthlyFreed: number; // average freed savings per month in the first withdrawal year
  lastMonthlyNet: number; // in the last month with a withdrawal
  effectiveRate: number; // first-year gross withdrawals (annualised) / start value, in %
  months: number; // months with withdrawals
  gross: number;
  net: number;
  netReal: number;
  taxes: number;
  depletedYear: number | null;
  depletedAge: number | null;
}

export interface SimulationResult {
  rows: YearRow[];
  summary: Summary;
}

export interface GoalResult {
  variable: GoalVariable;
  required: number | null; // null = not reachable within search range
  currentValue: number;
  /** First calendar year in which the targets are met with the current plan. */
  reachedYear: number | null;
  reachedAge: number | null;
  wealthProgress: number | null; // 0..1+
  dividendProgress: number | null;
  hasSteps: boolean;
  atWithdrawal: boolean; // goal measured at the start of withdrawals instead of the end
}
