import { defaultConfig } from '../defaults';
import type { SimulationConfig } from '../types';
import { sanitize } from './config';

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
