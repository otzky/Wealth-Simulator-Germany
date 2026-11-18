import { defaultConfig } from '../defaults';
import type { SimulationConfig } from '../types';
import { newId, sanitize } from './config';

export { newId, sanitize } from './config';

const STORAGE_KEY = 'vs-config-v2';
const HASH_KEY = 's';

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

/** A saved scenario: a full set of inputs with a name, kept only in this browser. */
export interface Scenario {
  id: string;
  name: string;
  updatedAt: number;
  config: SimulationConfig;
}

export interface ScenarioStore {
  activeId: string;
  items: Scenario[];
}

const SCENARIOS_KEY = 'vs-scenarios-v1';

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // storage unavailable or broken
  }
}

export function makeScenario(name: string, config: SimulationConfig): Scenario {
  return { id: newId(), name, updatedAt: Date.now(), config };
}

/** A name that is not taken yet: "Szenario", "Szenario 2", … */
export function uniqueName(items: Scenario[], base: string): string {
  const taken = new Set(items.map((i) => i.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/**
 * Scenarios at start-up. The first time, the single saved configuration of earlier versions
 * becomes "Mein Plan". A scenario from a shared link is added as a new scenario, so opening a
 * link never overwrites one of your own.
 */
export function loadScenarios(): ScenarioStore {
  let store: ScenarioStore | null = null;
  const saved = read(SCENARIOS_KEY) as { activeId?: unknown; items?: unknown } | null;
  if (saved && Array.isArray(saved.items)) {
    const items: Scenario[] = saved.items
      .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
      .map((i) => ({
        id: typeof i.id === 'string' ? i.id : newId(),
        name: typeof i.name === 'string' && i.name.trim() ? i.name.trim().slice(0, 60) : 'Szenario',
        updatedAt: typeof i.updatedAt === 'number' ? i.updatedAt : Date.now(),
        config: sanitize(i.config),
      }));
    if (items.length) store = { activeId: items.some((i) => i.id === saved.activeId) ? (saved.activeId as string) : items[0].id, items };
  }
  if (!store) {
    const legacy = read(STORAGE_KEY);
    const first = makeScenario('Mein Plan', legacy ? sanitize(legacy) : defaultConfig());
    store = { activeId: first.id, items: [first] };
  }
  try {
    const shared = new URLSearchParams(window.location.hash.slice(1)).get(HASH_KEY);
    if (shared) {
      const s = makeScenario(uniqueName(store.items, 'Geteiltes Szenario'), sanitize(JSON.parse(fromBase64Url(shared))));
      store = { activeId: s.id, items: [...store.items, s] };
    }
  } catch {
    /* ignore broken links */
  }
  return store;
}

export function saveScenarios(store: ScenarioStore) {
  try {
    localStorage.setItem(SCENARIOS_KEY, JSON.stringify(store));
    localStorage.removeItem(STORAGE_KEY); // replaced by the scenarios
  } catch {
    /* storage unavailable */
  }
}

/** Remove every saved scenario from this browser (the colour theme stays). */
export function deleteAllScenarios() {
  try {
    localStorage.removeItem(SCENARIOS_KEY);
    localStorage.removeItem(STORAGE_KEY);
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
