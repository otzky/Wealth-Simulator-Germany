export type DurationMode = 'years' | 'age';
export type ValueBasis = 'nominal' | 'real';
export type FundType = 'equity' | 'mixed' | 'other';
export type ChurchTax = 0 | 8 | 9;
export type GoalVariable = 'savings' | 'initial' | 'return';

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
  reinvestDividends: boolean;
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
  taxes: number; // taxes on distributions + Vorabpauschale
  advanceLumpSum: number; // Vorabpauschale (before tax)
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
  growth: number; // valueNominal - invested
  dividendsNet: number;
  dividendsNetReal: number;
  taxesPaid: number;
  costsPaid: number;
  saleTax: number; // tax due on a full sale at the end
  valueAfterSale: number;
  valueAfterSaleReal: number;
  finalMonthlyDividendNet: number;
  finalMonthlyDividendNetReal: number;
  deflator: number;
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
}
