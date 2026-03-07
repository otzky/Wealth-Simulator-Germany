import { SimulationConfig, DurationType } from './types';

export const DEFAULT_CONFIG: SimulationConfig = {
  birthDate: '1990-01-01',
  simulationStartDate: new Date().toISOString().split('T')[0], // Default to today
  durationType: DurationType.FIXED_YEARS,
  durationYears: 30,
  targetAge: 67,
  initialCapital: 10000,
  annualTotalReturn: 7.0,
  annualDividendYield: 2.0,
  inflationRate: 2.0,
  entryFee: 0.2, // Typical neo-broker or low fee
  yearlyTer: 0.2, // Typical ETF
  baseMonthlySavings: 500,
  savingsSteps: [],
  oneTimeInvestments: [],
  reinvestDividends: true,
  capitalGainsTax: 25.0,
  solidaritySurcharge: 5.5,
  churchTax: 0,
  taxAllowance: 1000,
  backCalculation: {
    enabled: false,
    targetWealth: 1000000,
    wealthType: 'NOMINAL',
    targetMonthlyDividend: 2000,
    dividendType: 'NOMINAL',
    variableToAdjust: 'SAVINGS_RATE',
  },
};