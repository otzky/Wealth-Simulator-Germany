export enum DurationType {
  FIXED_YEARS = 'FIXED_YEARS',
  TARGET_AGE = 'TARGET_AGE',
}

export interface CashflowStep {
  id: string;
  yearStart: number;
  monthlyAmount: number;
}

export interface OneTimeInvestment {
  id: string;
  year: number;
  amount: number;
}

export interface SimulationConfig {
  // Personal
  birthDate: string;
  simulationStartDate: string; // New field for start date
  durationType: DurationType;
  durationYears: number;
  targetAge: number;

  // Capital
  initialCapital: number;
  
  // Returns & Inflation
  annualTotalReturn: number; // %
  annualDividendYield: number; // %
  inflationRate: number; // %

  // Costs
  entryFee: number; // %
  yearlyTer: number; // %

  // Cashflow
  baseMonthlySavings: number;
  savingsSteps: CashflowStep[];
  oneTimeInvestments: OneTimeInvestment[];

  // Strategy
  reinvestDividends: boolean;

  // Taxes (German)
  capitalGainsTax: number; // Usually 25
  solidaritySurcharge: number; // Usually 5.5
  churchTax: number; // 0, 8, or 9
  taxAllowance: number; // e.g. 1000

  // Back-Calculation
  backCalculation: {
    enabled: boolean;
    targetWealth?: number;
    wealthType: 'NOMINAL' | 'REAL'; // Added wealthType
    targetMonthlyDividend?: number;
    dividendType: 'NOMINAL' | 'REAL';
    variableToAdjust: 'RETURN' | 'SAVINGS_RATE' | 'INITIAL_CAPITAL'; // Added INITIAL_CAPITAL
  };
}

export interface YearlyResult {
  year: number;
  age: number;
  investedCapital: number; // Own money put in
  
  // Nominal Values (Number on screen)
  nominalValueStart: number;
  nominalValueEnd: number;
  nominalDividendsGross: number;
  nominalDividendsNet: number;
  nominalTaxesPaid: number;
  
  // Real Values (Purchasing Power)
  realValueEnd: number;
  realDividendsNet: number;
  
  accumulatedDividends: number;
  accumulatedCosts: number;
}

export interface SimulationResult {
  yearlyData: YearlyResult[];
  finalSummary: {
    totalInvested: number;
    finalValueNominal: number;
    finalValueReal: number; // After inflation
    finalValueNetLiquidated: number; // After taxes if sold everything
    totalDividendsReceived: number;
    totalDividendsReceivedReal: number; // Added: Real total dividends
    totalTaxesPaid: number;
  };
  backCalculationResult?: {
    requiredValue: number;
    variable: 'RETURN' | 'SAVINGS_RATE' | 'INITIAL_CAPITAL';
    success: boolean;
  };
}