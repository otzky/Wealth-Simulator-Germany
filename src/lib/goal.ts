import type { GoalResult, GoalVariable, SimulationConfig, SimulationResult } from '../types';
import { runSimulation } from './simulation';

type Goal = SimulationConfig['goal'];

function hasTargets(goal: Goal) {
  return (goal.wealth ?? 0) > 0 || (goal.monthlyDividend ?? 0) > 0;
}

function wealthOf(res: SimulationResult, goal: Goal) {
  return goal.wealthBasis === 'real' ? res.summary.valueReal : res.summary.valueNominal;
}

function dividendOf(res: SimulationResult, goal: Goal) {
  return goal.dividendBasis === 'real'
    ? res.summary.finalMonthlyDividendNetReal
    : res.summary.finalMonthlyDividendNet;
}

export function meetsGoal(res: SimulationResult, goal: Goal): boolean {
  if (!hasTargets(goal)) return false;
  if ((goal.wealth ?? 0) > 0 && wealthOf(res, goal) < goal.wealth!) return false;
  if ((goal.monthlyDividend ?? 0) > 0 && dividendOf(res, goal) < goal.monthlyDividend!) return false;
  return true;
}

const RANGE: Record<GoalVariable, [number, number]> = {
  savings: [0, 1_000_000],
  initial: [0, 1_000_000_000],
  return: [-20, 50],
};

function withVariable(cfg: SimulationConfig, variable: GoalVariable, x: number): SimulationConfig {
  switch (variable) {
    case 'savings':
      // A single constant rate: steps are replaced, the yearly increase stays.
      return { ...cfg, monthlySavings: x, savingsSteps: [] };
    case 'initial':
      return { ...cfg, initialCapital: x };
    case 'return':
      return { ...cfg, totalReturn: x };
  }
}

function currentOf(cfg: SimulationConfig, variable: GoalVariable) {
  return variable === 'savings' ? cfg.monthlySavings : variable === 'initial' ? cfg.initialCapital : cfg.totalReturn;
}

function roundUp(variable: GoalVariable, x: number) {
  if (variable === 'savings') return Math.ceil(x);
  if (variable === 'initial') return Math.ceil(x / 100) * 100;
  return Math.ceil(x * 100) / 100;
}

/** Smallest value of `variable` that meets all targets, assuming the outcome grows with it. */
export function solveGoal(cfg: SimulationConfig, variable: GoalVariable): number | null {
  const goal = cfg.goal;
  if (!hasTargets(goal)) return null;
  let [lo, hi] = RANGE[variable];
  const meets = (x: number) => meetsGoal(runSimulation(withVariable(cfg, variable, x)), goal);
  if (!meets(hi)) return null;
  if (meets(lo)) return lo;
  for (let i = 0; i < 45; i++) {
    const mid = (lo + hi) / 2;
    if (meets(mid)) hi = mid;
    else lo = mid;
  }
  // Bisection lands a hair above the exact answer; prefer the rounded value just below if it still works.
  const tight = roundUp(variable, hi - Math.max(1e-6, Math.abs(hi) * 1e-9));
  return meets(tight) ? tight : roundUp(variable, hi);
}

export function evaluateGoal(cfg: SimulationConfig, res: SimulationResult): GoalResult | null {
  const goal = cfg.goal;
  if (!goal.enabled || !hasTargets(goal)) return null;

  const wantWealth = (goal.wealth ?? 0) > 0;
  const wantDiv = (goal.monthlyDividend ?? 0) > 0;

  const reached = res.rows.find((r) => {
    const w = goal.wealthBasis === 'real' ? r.realValueEnd : r.valueEnd;
    const d = goal.dividendBasis === 'real' ? r.realMonthlyDividendNet : r.monthlyDividendNet;
    return (!wantWealth || w >= goal.wealth!) && (!wantDiv || d >= goal.monthlyDividend!);
  });

  return {
    variable: goal.solveFor,
    required: solveGoal(cfg, goal.solveFor),
    currentValue: currentOf(cfg, goal.solveFor),
    reachedYear: reached?.year ?? null,
    reachedAge: reached?.age ?? null,
    wealthProgress: wantWealth ? wealthOf(res, goal) / goal.wealth! : null,
    dividendProgress: wantDiv ? dividendOf(res, goal) / goal.monthlyDividend! : null,
    hasSteps: cfg.savingsSteps.length > 0,
  };
}
