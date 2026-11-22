/** Buy-vs-rent scenarios, kept only in this browser, and share links. */
import { newId } from '../lib/config';
import { sanitizeBuyRent } from './config';
import { defaultBuyRent } from './defaults';
import type { BuyRentConfig } from './types';

export const BUYRENT_PATH = '/kaufen-mieten';
const KEY = 'vs-buyrent-scenarios-v1';
const HASH_KEY = 'k';

export interface BuyRentScenario {
  id: string;
  name: string;
  updatedAt: number;
  config: BuyRentConfig;
}

export interface BuyRentStore {
  activeId: string;
  items: BuyRentScenario[];
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

export function makeBuyRentScenario(name: string, config: BuyRentConfig): BuyRentScenario {
  return { id: newId(), name, updatedAt: Date.now(), config };
}

export function uniqueBuyRentName(items: { name: string }[], base: string): string {
  const taken = new Set(items.map((i) => i.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/** Scenarios at start-up; a shared link is added as a new scenario. */
export function loadBuyRentScenarios(): BuyRentStore {
  let store: BuyRentStore | null = null;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { activeId?: unknown; items?: unknown } | null;
    if (saved && Array.isArray(saved.items)) {
      const items = saved.items
        .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
        .map((i) => ({
          id: typeof i.id === 'string' ? i.id : newId(),
          name: typeof i.name === 'string' && i.name.trim() ? i.name.trim().slice(0, 60) : 'Szenario',
          updatedAt: typeof i.updatedAt === 'number' ? i.updatedAt : Date.now(),
          config: sanitizeBuyRent(i.config),
        }));
      if (items.length) store = { activeId: items.some((i) => i.id === saved.activeId) ? (saved.activeId as string) : items[0].id, items };
    }
  } catch {
    /* storage unavailable or broken */
  }
  if (!store) {
    const first = makeBuyRentScenario('Meine Wohnung', defaultBuyRent());
    store = { activeId: first.id, items: [first] };
  }
  try {
    const shared = new URLSearchParams(window.location.hash.slice(1)).get(HASH_KEY);
    if (shared) {
      const s = makeBuyRentScenario(uniqueBuyRentName(store.items, 'Geteiltes Szenario'), sanitizeBuyRent(JSON.parse(fromBase64Url(shared))));
      store = { activeId: s.id, items: [...store.items, s] };
    }
  } catch {
    /* ignore broken links */
  }
  return store;
}

export function saveBuyRentScenarios(store: BuyRentStore) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* storage unavailable */
  }
}

export function deleteAllBuyRentScenarios() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

export function buyRentShareUrl(cfg: BuyRentConfig): string {
  return `${window.location.origin}${BUYRENT_PATH}#${HASH_KEY}=${toBase64Url(JSON.stringify(cfg))}`;
}

export function clearBuyRentHash() {
  if (new URLSearchParams(window.location.hash.slice(1)).has(HASH_KEY)) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}
