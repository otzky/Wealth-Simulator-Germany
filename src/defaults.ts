import type { SimulationConfig } from './types';

function today() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function defaultConfig(): SimulationConfig {
  return {
    birthDate: '1990-01-01',
    startDate: today(),
    durationMode: 'years',
    durationYears: 30,
    targetAge: 67,

    initialCapital: 10_000,
    monthlySavings: 500,
    savingsGrowth: 0,
    savingsSteps: [],
    lumpSums: [],

    totalReturn: 7,
    dividendYield: 2,
    inflation: 2,
    reinvestDividends: true,
    returnSpread: 2,

    purchaseFee: 0.2,
    ter: 0.2,

    capitalGainsTax: 25,
    soli: 5.5,
    churchTax: 0,
    allowance: 1000,
    fundType: 'equity',
    applyAdvanceLumpSum: true,
    baseRate: 3.2, // Basiszins 2026 (BMF)

    goal: {
      enabled: false,
      wealth: 1_000_000,
      wealthBasis: 'nominal',
      monthlyDividend: 2000,
      dividendBasis: 'nominal',
      solveFor: 'savings',
    },
  };
}
