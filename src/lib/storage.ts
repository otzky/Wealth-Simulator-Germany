import { defaultConfig } from '../defaults';
import type { SimulationConfig } from '../types';

const STORAGE_KEY = 'vs-config-v2';
const HASH_KEY = 's';

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
    if (key === 'goal' || key === 'withdrawal') {
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
          .filter((x: Record<string, unknown>) =>
            key === 'savingsSteps'
              ? typeof x.year === 'number' && typeof x.monthlyAmount === 'number'
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
  if (!['fixed', 'rate'].includes(cfg.withdrawal.mode)) cfg.withdrawal.mode = 'fixed';
  // Older saves used a yes/no switch for reinvesting
  if (src.dividendStrategy === undefined && src.reinvestDividends === false) cfg.dividendStrategy = 'payout';
  if (!['reinvest', 'payout', 'withWithdrawal', 'fromYear'].includes(cfg.dividendStrategy)) cfg.dividendStrategy = 'reinvest';
  return cfg;
}

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function toBase64Url(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function loadInitialConfig(): SimulationConfig {
  try {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const shared = params.get(HASH_KEY);
    if (shared) return sanitize(JSON.parse(fromBase64Url(shared)));
  } catch {
    /* ignore broken links */
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch {
    /* storage unavailable */
  }
  return defaultConfig();
}

export function saveConfig(cfg: SimulationConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* storage unavailable */
  }
}

export function shareUrl(cfg: SimulationConfig): string {
  const url = new URL(window.location.href);
  url.hash = `${HASH_KEY}=${toBase64Url(JSON.stringify(cfg))}`;
  return url.toString();
}

/** Remove a shared scenario from the address bar once it has been loaded. */
export function clearShareHash() {
  if (window.location.hash.includes(`${HASH_KEY}=`)) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}
