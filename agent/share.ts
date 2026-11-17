import { setting } from './env.js';
import type { SimulationConfig } from '../src/types.js';
import { InputError } from './errors.js';

/** Address of the app; links open the scenario there. */
export function appUrl(): string {
  return setting(process.env.WEALTH_SIM_APP_URL) || 'http://localhost:3000/';
}

/** Link that opens the scenario in the app – the same format as the app's "Teilen" button. */
export function shareLink(cfg: SimulationConfig, base = appUrl()): string {
  const data = Buffer.from(JSON.stringify(cfg), 'utf8').toString('base64url');
  return `${base.replace(/#.*$/, '')}#s=${data}`;
}

/** Reads the configuration from a link created with the app's "Teilen" button. */
export function readShareLink(link: string): unknown {
  const m = /[#&?]s=([A-Za-z0-9_-]+)/.exec(link.trim()) ?? /^([A-Za-z0-9_-]{20,})$/.exec(link.trim());
  if (!m) throw new InputError('Der Link enthält keinen Plan. Erwartet wird ein Link aus „Teilen“ in der App (…#s=…).');
  try {
    return JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'));
  } catch {
    throw new InputError('Der Plan im Link ist beschädigt oder unvollständig. Bitte den ganzen Link kopieren.');
  }
}
