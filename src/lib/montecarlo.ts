import type { SimulationConfig, SimulationResult } from '../types';
import { meetsGoal } from './goal';
import { normalGenerator, pathSeed } from './random';
import { guardrailGuide, horizonMonths, resolveWithdrawal, simulate, usesLifeExpectancy, withdrawalActive, withFixedWithdrawal } from './simulation';

/**
 * Monte Carlo: the same plan, simulated many times with random monthly returns.
 *
 * Yearly returns are lognormal. Their median growth equals the expected return entered
 * under "Markt" (e.g. 7 % for the MSCI World, which is how index returns are quoted), so
 * the typical path follows the plan line and half of all paths end above it. The volatility
 * is the standard deviation of the yearly returns. Everything else – inflation, dividends,
 * costs, taxes and all events – stays as in the plan.
 */

/** What counts as success: every withdrawal paid in full (plan), or more than paid in (profit). */
export type McMetric = 'plan' | 'profit';

export interface McItem {
  id: string; // 'withdrawal' for the withdrawal phase, otherwise the event id
  kind: 'phase' | 'oneOff' | 'temporary';
  paidRate: number; // share of paths in which it was paid in full every time
}

export interface MonteCarloResult {
  runs: number;
  years: number[];
  ages: number[];
  deflators: number[]; // cumulative inflation at the end of each year (the same in every path)
  plan: number[]; // nominal value at the end of each year without fluctuations
  paths: Float32Array; // runs × years, nominal value at the end of each year
  success: Uint8Array; // 1 if the path counts as a success
  paidAll: Uint8Array; // 1 if every withdrawal (phase and events) was paid in full
  endValues: Float64Array; // nominal depot value at the end
  depletedAge: Int16Array; // age at which the depot ran empty, -1 if never
  percentiles: Record<'p10' | 'p25' | 'p50' | 'p75' | 'p90', number[]>; // nominal, per year
  metric: McMetric;
  successRate: number;
  goalRate: number | null; // share of paths that reach the goal (section "Ziel"), if one is set
  items: McItem[];
  guardrails: McGuardrails | null; // set when guardrails are on for the withdrawal phase
  volatility: number;
  ms: number;
}

export interface McGuardrails {
  plannedMonthly: number; // planned net amount per month in the first withdrawal year
  startYear: number;
  cutShare: number; // share of paths with at least one cut
  raiseShare: number; // share of paths with at least one raise
  minLevelP10: number; // in 90 % of paths the amount never falls below this share of the planned amount
  minLevelMedian: number;
  yearsBelowMedian: number; // years below the planned amount, median over the paths with a cut
  cutsMedian: number; // number of cuts, median over the paths with a cut
  direction: 'down' | 'both';
  inflationAdjust: boolean; // amounts below are in money of the start year if true, nominal otherwise
  /** Share of paths by number of years below the plan: 0, 1–2, 3–5, 6–10, more than 10 */
  yearsBelowBuckets: number[];
  yearsBelowP90: number; // in 90 % of paths at most this many years below the plan
  longestBelowP90: number; // in 90 % of paths the longest run below the plan is at most this long
  longestBelowMedian: number; // median over the paths with a cut
  missingP90: number; // in 90 % of paths all cuts together are at most this much (buffer)
  missingMedian: number; // median over the paths with a cut
  successNoCut: number; // share of paths that succeed and always pay the planned amount
  successWithCut: number; // share of paths that succeed with years below the planned amount
  successWithout: number; // success rate of the same paths without guardrails
}

export interface SafeWithdrawal {
  probability: number;
  monthlyNet: number;
  reachable: boolean; // false: even without withdrawals the plan does not hold often enough
  minLevelP10: number | null; // with guardrails: in 90 % of paths the amount never falls below this share
  runs: number;
  ms: number;
}

/**
 * Log-volatility σ of a lognormal yearly return with median growth `1 + r`
 * whose standard deviation is `vol` (both in %).
 */
export function logVolatility(totalReturnPct: number, volPct: number): number {
  const g = Math.max(0.01, 1 + totalReturnPct / 100);
  const s = volPct / 100;
  if (s <= 0) return 0;
  const std = (x: number) => g * Math.exp((x * x) / 2) * Math.sqrt(Math.exp(x * x) - 1);
  let lo = 0;
  let hi = 3;
  if (std(hi) <= s) return hi;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (std(mid) < s) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Monthly return factors for one path; their product has a median of 1. */
export function pathShocks(cfg: SimulationConfig, path: number, months: number, out = new Float64Array(months)): Float64Array {
  const sigma = logVolatility(cfg.totalReturn, cfg.monteCarlo.volatility) / Math.sqrt(12);
  const normal = normalGenerator(pathSeed(cfg.monteCarlo.seed, path));
  for (let i = 0; i < months; i++) out[i] = Math.exp(sigma * normal());
  return out;
}

interface Judge {
  metric: McMetric;
  items: { id: string; kind: McItem['kind'] }[];
  /** Success as defined by the metric. */
  ok: (res: SimulationResult) => boolean;
}

/** Decides what counts as success for this plan. `cfg` is the plan as entered, `plan` the one that is simulated. */
function judgeFor(cfg: SimulationConfig, plan: SimulationConfig, base: SimulationResult): Judge {
  const firstYear = base.rows[0].year;
  const lastYear = base.rows[base.rows.length - 1].year;
  const items: Judge['items'] = [];
  if (withdrawalActive(plan)) items.push({ id: 'withdrawal', kind: 'phase' });
  for (const o of plan.oneOffWithdrawals) {
    if (o.amount > 0 && o.year >= firstYear && o.year <= lastYear) items.push({ id: o.id, kind: 'oneOff' });
  }
  for (const p of plan.withdrawalPhases) {
    if (p.monthlyNet > 0 && p.endYear >= p.startYear && p.startYear <= lastYear && p.endYear >= firstYear) items.push({ id: p.id, kind: 'temporary' });
  }
  const target = usesLifeExpectancy(cfg) ? cfg.withdrawal : null;
  if (items.length || target) {
    return {
      metric: 'plan',
      items,
      ok: (res) => {
        const s = res.summary;
        if (s.withdrawal?.shortfall || s.missedEvents.length) return false;
        if (target && (target.endWealthBasis === 'real' ? s.valueReal : s.valueNominal) < Math.max(0, target.endWealth)) return false;
        return true;
      },
    };
  }
  return {
    metric: 'profit',
    items,
    ok: (res) => res.summary.valueAfterSale + res.summary.dividendsPaidOut > res.summary.invested,
  };
}

/** Value below which a share `q` of the sorted values lies (linear interpolation). */
export function quantile(sorted: Float64Array, q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const i = Math.floor(pos);
  const f = pos - i;
  return i + 1 < sorted.length ? sorted[i] * (1 - f) + sorted[i + 1] * f : sorted[i];
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function runMonteCarlo(cfg: SimulationConfig, onProgress?: (share: number) => void): MonteCarloResult {
  const t0 = now();
  // A calculated withdrawal ("Berechnen") is worked out once for the plan and then kept fixed,
  // so the paths show how well that amount holds when markets fluctuate.
  const plan = resolveWithdrawal(cfg);
  const base = simulate(plan);
  const guide = guardrailGuide(cfg); // only used when guardrails are on
  const judge = judgeFor(cfg, plan, base);
  const runs = Math.max(1, Math.round(cfg.monteCarlo.runs));
  const years = base.rows.length;
  const months = horizonMonths(plan);
  const wantGoal = cfg.goal.enabled && ((cfg.goal.wealth ?? 0) > 0 || (cfg.goal.monthlyDividend ?? 0) > 0);

  const paths = new Float32Array(runs * years);
  const success = new Uint8Array(runs);
  const paidAll = new Uint8Array(runs);
  const endValues = new Float64Array(runs);
  const depletedAge = new Int16Array(runs).fill(-1);
  const paid = new Array(judge.items.length).fill(0);
  let successes = 0;
  let goals = 0;
  const shocks = new Float64Array(months);
  const minLevels: number[] = [];
  const yearsBelow: number[] = [];
  const cutCounts: number[] = [];
  const yearsAll: number[] = [];
  const longestAll: number[] = [];
  const longestCut: number[] = [];
  const missingAll: number[] = [];
  const missingCut: number[] = [];
  let cutPaths = 0;
  let raisePaths = 0;
  let successNoCut = 0;
  let successWithCut = 0;
  let successWithout = 0;
  // The same plan without guardrails, to show what they change on exactly the same paths
  const gr = plan.withdrawal.guardrails;
  const guarded = gr.enabled && plan.withdrawal.mode !== 'rate' && withdrawalActive(plan);
  const unguarded: SimulationConfig = { ...plan, withdrawal: { ...plan.withdrawal, guardrails: { ...gr, enabled: false } } };

  for (let r = 0; r < runs; r++) {
    const res = simulate(plan, pathShocks(cfg, r, months, shocks), guide);
    const g = res.summary.withdrawal?.guardrails;
    if (g) {
      minLevels.push(g.minLevel);
      yearsAll.push(g.yearsBelow);
      longestAll.push(g.longestBelow);
      missingAll.push(g.missing);
      if (g.yearsBelow) {
        longestCut.push(g.longestBelow);
        missingCut.push(g.missing);
      }
      if (g.cuts) {
        cutPaths++;
        yearsBelow.push(g.yearsBelow);
        cutCounts.push(g.cuts);
      }
      if (g.raises) raisePaths++;
    }
    if (guarded && judge.ok(simulate(unguarded, shocks))) successWithout++;
    let hadValue = false;
    for (let j = 0; j < years; j++) {
      const row = res.rows[j];
      paths[r * years + j] = row.valueEnd;
      if (row.valueEnd > 0.5) hadValue = true;
      else if (hadValue && depletedAge[r] < 0) depletedAge[r] = row.age;
    }
    endValues[r] = res.summary.valueNominal;
    if (!res.summary.withdrawal?.shortfall && !res.summary.missedEvents.length) paidAll[r] = 1;
    if (judge.ok(res)) {
      success[r] = 1;
      successes++;
      if (g?.yearsBelow) successWithCut++;
      else successNoCut++;
    }
    if (wantGoal && meetsGoal(res, plan)) goals++;
    judge.items.forEach((it, k) => {
      const ok = it.kind === 'phase' ? !res.summary.withdrawal?.shortfall : !res.summary.missedEvents.includes(it.id);
      if (ok) paid[k]++;
    });
    if (onProgress && r % 100 === 99) onProgress((r + 1) / runs);
  }

  const percentiles: MonteCarloResult['percentiles'] = { p10: [], p25: [], p50: [], p75: [], p90: [] };
  const column = new Float64Array(runs);
  for (let j = 0; j < years; j++) {
    for (let r = 0; r < runs; r++) column[r] = paths[r * years + j];
    column.sort();
    percentiles.p10.push(quantile(column, 0.1));
    percentiles.p25.push(quantile(column, 0.25));
    percentiles.p50.push(quantile(column, 0.5));
    percentiles.p75.push(quantile(column, 0.75));
    percentiles.p90.push(quantile(column, 0.9));
  }

  return {
    runs,
    years: base.rows.map((x) => x.year),
    ages: base.rows.map((x) => x.age),
    deflators: base.rows.map((x) => x.deflator),
    plan: base.rows.map((x) => x.valueEnd),
    paths,
    success,
    paidAll,
    endValues,
    depletedAge,
    percentiles,
    metric: judge.metric,
    successRate: successes / runs,
    goalRate: wantGoal ? goals / runs : null,
    items: judge.items.map((it, k) => ({ ...it, paidRate: paid[k] / runs })),
    guardrails: minLevels.length
      ? (() => {
          const lv = Float64Array.from(minLevels).sort();
          const yb = Float64Array.from(yearsBelow).sort();
          const sorted = (a: number[]) => Float64Array.from(a).sort();
          const q = (a: number[], p: number) => (a.length ? quantile(sorted(a), p) : 0);
          const bucket = (lo: number, hi: number) => yearsAll.filter((y) => y >= lo && y <= hi).length / runs;
          return {
            plannedMonthly: plan.withdrawal.monthlyNet,
            startYear: plan.withdrawal.startYear,
            cutShare: cutPaths / runs,
            raiseShare: raisePaths / runs,
            minLevelP10: quantile(lv, 0.1),
            minLevelMedian: quantile(lv, 0.5),
            yearsBelowMedian: yb.length ? quantile(yb, 0.5) : 0,
            cutsMedian: cutCounts.length ? quantile(Float64Array.from(cutCounts).sort(), 0.5) : 0,
            successNoCut: successNoCut / runs,
            successWithCut: successWithCut / runs,
            successWithout: successWithout / runs,
            direction: gr.direction,
            inflationAdjust: plan.withdrawal.inflationAdjust,
            yearsBelowBuckets: [bucket(0, 0), bucket(1, 2), bucket(3, 5), bucket(6, 10), bucket(11, Infinity)],
            yearsBelowP90: Math.round(q(yearsAll, 0.9)),
            longestBelowP90: Math.round(q(longestAll, 0.9)),
            longestBelowMedian: Math.round(q(longestCut, 0.5)),
            missingP90: q(missingAll, 0.9),
            missingMedian: q(missingCut, 0.5),
          };
        })()
      : null,
    volatility: cfg.monteCarlo.volatility,
    ms: now() - t0,
  };
}

/** The safe withdrawal can be calculated for the withdrawal phase with a net amount ('fixed' or 'target'). */
export function canSolveSafeWithdrawal(cfg: SimulationConfig): boolean {
  return cfg.withdrawal.enabled && cfg.withdrawal.mode !== 'rate' && withdrawalActive(cfg);
}

/**
 * The largest net amount per month for the withdrawal phase at which the plan holds in at
 * least `probability` of all paths: every withdrawal is paid in full (events included) and –
 * with "Berechnen" – the wanted wealth is left at the end. Uses at most 1.000 paths.
 */
export function solveSafeWithdrawal(cfg: SimulationConfig, probability: number, onProgress?: (share: number) => void): SafeWithdrawal | null {
  if (!canSolveSafeWithdrawal(cfg)) return null;
  const t0 = now();
  const runs = Math.min(1000, Math.max(1, Math.round(cfg.monteCarlo.runs)));
  const months = horizonMonths(withFixedWithdrawal(cfg, 0));
  const shocks = Array.from({ length: runs }, (_, r) => pathShocks(cfg, r, months));
  const needed = Math.ceil(probability * runs);
  let evals = 0;

  const holds = (x: number) => {
    const plan = withFixedWithdrawal(cfg, x);
    const base = simulate(plan);
    const guide = guardrailGuide(cfg, x);
    const judge = judgeFor(cfg, plan, base);
    let ok = 0;
    let bad = 0;
    for (let r = 0; r < runs; r++) {
      if (judge.ok(simulate(plan, shocks[r], guide))) ok++;
      else bad++;
      if (ok >= needed) break;
      if (bad > runs - needed) break;
    }
    evals++;
    onProgress?.(Math.min(0.95, evals / 18));
    return ok >= needed;
  };

  // With guardrails the amount moves; say how low it gets in bad paths at the amount found.
  const lowest = (x: number) => {
    const plan = withFixedWithdrawal(cfg, x);
    if (!plan.withdrawal.guardrails.enabled) return null;
    const guide = guardrailGuide(cfg, x);
    const lv = new Float64Array(runs);
    for (let r = 0; r < runs; r++) lv[r] = simulate(plan, shocks[r], guide).summary.withdrawal?.guardrails?.minLevel ?? 1;
    return quantile(lv.sort(), 0.1);
  };
  const done = (monthlyNet: number, reachable: boolean): SafeWithdrawal => ({
    probability,
    monthlyNet,
    reachable,
    minLevelP10: reachable && monthlyNet > 0 ? lowest(monthlyNet) : null,
    runs,
    ms: now() - t0,
  });
  if (!holds(0)) return done(0, false);
  let lo = 0;
  let hi = 1000;
  while (hi < 1e8 && holds(hi)) {
    lo = hi;
    hi *= 2;
  }
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (holds(mid)) lo = mid;
    else hi = mid;
  }
  return done(lo, true);
}
