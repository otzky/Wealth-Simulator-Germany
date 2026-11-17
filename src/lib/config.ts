/** Checking configurations from untrusted sources (saved data, links, AI tools). No browser APIs. */
import { defaultConfig } from '../defaults';
import type { SimulationConfig } from '../types';

/** Merge untrusted data onto the defaults, keeping only keys with the right type. */
export function sanitize(input: unknown): SimulationConfig {
  const base = defaultConfig();
  if (!input || typeof input !== 'object') return base;
  const src = input as Record<string, unknown>;
  const out: Record<string, unknown> = { ...base };

  for (const key of Object.keys(base) as (keyof SimulationConfig)[]) {
    const def = base[key];
    const val = src[key];
    if (val === undefined) continue;
    if (key === 'goal' || key === 'withdrawal' || key === 'monteCarlo') {
      const g = (val && typeof val === 'object' ? val : {}) as Record<string, unknown>;
      const nestedBase = base[key] as unknown as Record<string, unknown>;
      const nested: Record<string, unknown> = { ...nestedBase };
      for (const gk of Object.keys(nestedBase)) {
        const gv = g[gk];
        const gd = nestedBase[gk];
        if (gv === undefined) continue;
        if (gd === null || typeof gd === 'number') {
          if (gv === null || (typeof gv === 'number' && Number.isFinite(gv))) nested[gk] = gv;
        } else if (typeof gv === typeof gd) nested[gk] = gv;
      }
      out[key] = nested;
    } else if (Array.isArray(def)) {
      if (Array.isArray(val)) {
        out[key] = val
          .filter((x) => x && typeof x === 'object')
          .map((x: Record<string, unknown>) => ({
            ...x,
            id: typeof x.id === 'string' ? x.id : newId(),
          }))
          .map((x: Record<string, unknown>) =>
            key === 'withdrawalPhases' ? { ...x, inflationAdjust: x.inflationAdjust !== false } : x,
          )
          .filter((x: Record<string, unknown>) =>
            key === 'savingsSteps'
              ? typeof x.year === 'number' && typeof x.monthlyAmount === 'number'
              : key === 'withdrawalPhases'
                ? typeof x.startYear === 'number' && typeof x.endYear === 'number' && typeof x.monthlyNet === 'number'
                : typeof x.year === 'number' && typeof x.amount === 'number',
          );
      }
    } else if (typeof def === 'number') {
      if (typeof val === 'number' && Number.isFinite(val)) out[key] = val;
    } else if (typeof val === typeof def) {
      out[key] = val;
    }
  }
  const cfg = out as unknown as SimulationConfig;
  if (![0, 8, 9].includes(cfg.churchTax)) cfg.churchTax = 0;
  if (!['equity', 'mixed', 'other'].includes(cfg.fundType)) cfg.fundType = 'equity';
  if (!['years', 'age'].includes(cfg.durationMode)) cfg.durationMode = 'years';
  if (!['fixed', 'rate', 'target'].includes(cfg.withdrawal.mode)) cfg.withdrawal.mode = 'fixed';
  {
    // Nested one level deeper than the other settings
    const d = base.withdrawal.guardrails;
    const g = (cfg.withdrawal.guardrails && typeof cfg.withdrawal.guardrails === 'object' ? cfg.withdrawal.guardrails : {}) as Record<string, unknown>;
    const num = (v: unknown, def: number, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def);
    cfg.withdrawal.guardrails = {
      enabled: typeof g.enabled === 'boolean' ? g.enabled : d.enabled,
      direction: g.direction === 'both' || g.direction === 'down' ? g.direction : d.direction,
      threshold: num(g.threshold, d.threshold, 1, 100),
      adjust: num(g.adjust, d.adjust, 1, 50),
      floor: num(g.floor, d.floor, 0, 1e9),
    };
  }
  if (!['nominal', 'real'].includes(cfg.withdrawal.endWealthBasis)) cfg.withdrawal.endWealthBasis = 'nominal';
  if (![1000, 5000].includes(cfg.monteCarlo.runs)) cfg.monteCarlo.runs = 1000;
  cfg.monteCarlo.volatility = Math.min(100, Math.max(0, cfg.monteCarlo.volatility));
  cfg.monteCarlo.seed = Math.abs(Math.round(cfg.monteCarlo.seed)) >>> 0;
  // Older saves used a yes/no switch for reinvesting
  if (src.dividendStrategy === undefined && src.reinvestDividends === false) cfg.dividendStrategy = 'payout';
  if (!['reinvest', 'payout', 'withWithdrawal', 'fromYear'].includes(cfg.dividendStrategy)) cfg.dividendStrategy = 'reinvest';
  return cfg;
}

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}
