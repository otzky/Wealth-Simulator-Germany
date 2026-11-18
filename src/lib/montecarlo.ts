import type { SimulationConfig, SimulationResult } from '../types.js';
import { meetsGoal } from './goal.js';
import { gaussian, mulberry32, pathSeed } from './random.js';
import { inflationPath } from './inflation.js';
import { regimeModel } from './regimes.js';
import { guardrailGuide, horizonMonths, parseDate, resolveWithdrawal, simulate, usesLifeExpectancy, withdrawalActive, withFixedWithdrawal } from './simulation.js';

/**
 * Monte Carlo: the same plan, simulated many times with random monthly returns.
 *
 * Returns switch between a calm and a crisis regime (regimes.ts, estimated on the MSCI World).
 * Their long-run growth equals the expected return entered under "Markt" (e.g. 7 % for the
 * MSCI World, which is how index returns are quoted), so the typical path follows the plan
 * line and half of all paths end above it. The volatility is the annualised monthly volatility
 * as fact sheets quote it. Inflation varies from year to year around the entered rate
 * (inflation.ts), so inflation-adjusted withdrawals and all values in purchasing power differ
 * between paths. Dividends, costs, taxes and all events stay as in the plan.
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
  deflators: number[]; // cumulative inflation at the end of each year in the plan (entered inflation)
  plan: number[]; // nominal value at the end of each year without fluctuations
  paths: Float32Array; // runs × years, nominal value at the end of each year
  pathDeflators: Float32Array; // runs × years, cumulative inflation of each path at the end of each year
  success: Uint8Array; // 1 if the path counts as a success
  paidAll: Uint8Array; // 1 if every withdrawal (phase and events) was paid in full
  endValues: Float64Array; // nominal depot value at the end
  endDeflators: Float64Array; // cumulative inflation of each path at the end
  depletedAge: Int16Array; // age at which the depot ran empty, -1 if never
  percentiles: Record<'p10' | 'p25' | 'p50' | 'p75' | 'p90', number[]>; // nominal, per year
  percentilesReal: Record<'p10' | 'p25' | 'p50' | 'p75' | 'p90', number[]>; // in today's money (each path with its own inflation), per year
  metric: McMetric;
  successRate: number;
  /** Success rate on the same paths with an expected return 1 percentage point lower */
  successRateLowerReturn: number;
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
 * Monthly return factors for one path, applied on top of the plan's expected return. Returns
 * follow the regime model (calm and crisis phases, see regimes.ts); over the long run their
 * log average is zero, so the typical path follows the plan line.
 */
export function pathShocks(cfg: SimulationConfig, path: number, months: number, out = new Float64Array(months), model = regimeModel(cfg.monteCarlo.volatility)): Float64Array {
  const next = mulberry32(pathSeed(cfg.monteCarlo.seed, path));
  const normal = gaussian(next);
  let s = next() < model.share[0] ? 0 : 1;
  for (let i = 0; i < months; i++) {
    out[i] = Math.exp(model.dev[s] + model.sigma[s] * normal());
    if (next() < model.leave[s]) s = 1 - s;
  }
  return out;
}

/**
 * Yearly inflation rates for one path (index 0 = start year), linked to the path's returns:
 * each calendar year's log return, standardised, enters the inflation model (inflation.ts).
 * Uses its own random numbers, so the returns of a path stay the same.
 */
export function pathInflation(cfg: SimulationConfig, path: number, shocks: ArrayLike<number>, months: number): Float64Array {
  const startMonth = parseDate(cfg.startDate).m - 1;
  const years = Math.ceil((startMonth + months) / 12);
  const z = new Float64Array(years);
  const counts = new Float64Array(years);
  for (let i = 0; i < months; i++) {
    const k = Math.floor((startMonth + i) / 12);
    z[k] += Math.log(shocks[i]);
    counts[k]++;
  }
  const vol = Math.max(0, cfg.monteCarlo.volatility) / 100;
  for (let k = 0; k < years; k++) z[k] = vol > 0 && counts[k] ? z[k] / (vol * Math.sqrt(counts[k] / 12)) : 0;
  return inflationPath(cfg.inflation, z, gaussian(mulberry32(pathSeed(cfg.monteCarlo.seed ^ 0x1f1a7e, path))));
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
  const endDeflators = new Float64Array(runs);
  const pathDeflators = new Float32Array(runs * years);
  const depletedAge = new Int16Array(runs).fill(-1);
  const paid = new Array(judge.items.length).fill(0);
  let successes = 0;
  let goals = 0;
  const shocks = new Float64Array(months);
  const model = regimeModel(cfg.monteCarlo.volatility);
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
  // The same plan with 1 percentage point less return, on exactly the same paths (sensitivity)
  const lower: SimulationConfig = { ...plan, totalReturn: plan.totalReturn - 1 };
  const lowerGuide = guardrailGuide({ ...cfg, totalReturn: cfg.totalReturn - 1 });
  let successesLower = 0;

  for (let r = 0; r < runs; r++) {
    pathShocks(cfg, r, months, shocks, model);
    const infl = pathInflation(cfg, r, shocks, months);
    const res = simulate(plan, shocks, guide, infl);
    if (judge.ok(simulate(lower, shocks, lowerGuide, infl))) successesLower++;
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
    if (guarded && judge.ok(simulate(unguarded, shocks, undefined, infl))) successWithout++;
    let hadValue = false;
    for (let j = 0; j < years; j++) {
      const row = res.rows[j];
      paths[r * years + j] = row.valueEnd;
      pathDeflators[r * years + j] = row.deflator;
      if (row.valueEnd > 0.5) hadValue = true;
      else if (hadValue && depletedAge[r] < 0) depletedAge[r] = row.age;
    }
    endValues[r] = res.summary.valueNominal;
    endDeflators[r] = res.summary.deflator;
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
  const percentilesReal: MonteCarloResult['percentiles'] = { p10: [], p25: [], p50: [], p75: [], p90: [] };
  const column = new Float64Array(runs);
  const fill = (target: MonteCarloResult['percentiles']) => {
    column.sort();
    target.p10.push(quantile(column, 0.1));
    target.p25.push(quantile(column, 0.25));
    target.p50.push(quantile(column, 0.5));
    target.p75.push(quantile(column, 0.75));
    target.p90.push(quantile(column, 0.9));
  };
  for (let j = 0; j < years; j++) {
    for (let r = 0; r < runs; r++) column[r] = paths[r * years + j];
    fill(percentiles);
    for (let r = 0; r < runs; r++) column[r] = paths[r * years + j] / pathDeflators[r * years + j];
    fill(percentilesReal);
  }

  return {
    runs,
    years: base.rows.map((x) => x.year),
    ages: base.rows.map((x) => x.age),
    deflators: base.rows.map((x) => x.deflator),
    plan: base.rows.map((x) => x.valueEnd),
    paths,
    pathDeflators,
    success,
    paidAll,
    endValues,
    endDeflators,
    depletedAge,
    percentiles,
    percentilesReal,
    metric: judge.metric,
    successRate: successes / runs,
    successRateLowerReturn: successesLower / runs,
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
  const infl = shocks.map((sh, r) => pathInflation(cfg, r, sh, months));
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
      if (judge.ok(simulate(plan, shocks[r], guide, infl[r]))) ok++;
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
    for (let r = 0; r < runs; r++) lv[r] = simulate(plan, shocks[r], guide, infl[r]).summary.withdrawal?.guardrails?.minLevel ?? 1;
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
