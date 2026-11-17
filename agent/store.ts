import { setting } from './env';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { sanitize } from '../src/lib/config';
import type { SimulationConfig } from '../src/types';
import type { PlanStore } from './scenario';

interface FileData {
  default: string | null;
  plans: Record<string, { savedAt: string; config: SimulationConfig }>;
}

/** Folder for saved plans: WEALTH_SIM_HOME, or ".wealth-simulator" in the home folder. */
export function dataDir(): string {
  return setting(process.env.WEALTH_SIM_HOME) || join(homedir(), '.wealth-simulator');
}

/** Saved plans in one JSON file (plans.json), written atomically. */
export class FilePlanStore implements PlanStore {
  private readonly file: string;
  constructor(dir = dataDir()) {
    mkdirSync(dir, { recursive: true });
    this.file = join(dir, 'plans.json');
  }
  private read(): FileData {
    try {
      const d = JSON.parse(readFileSync(this.file, 'utf8')) as FileData;
      return { default: d.default ?? null, plans: d.plans ?? {} };
    } catch {
      return { default: null, plans: {} };
    }
  }
  private write(d: FileData) {
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(d, null, 2), 'utf8');
    renameSync(tmp, this.file);
  }
  list() {
    const d = this.read();
    return Object.entries(d.plans).map(([name, p]) => ({ name, isDefault: name === d.default, savedAt: p.savedAt }));
  }
  get(name: string) {
    const p = this.read().plans[name];
    return p ? sanitize(p.config) : null;
  }
  defaultName() {
    const d = this.read();
    return d.default && d.plans[d.default] ? d.default : null;
  }
  save(name: string, cfg: SimulationConfig, makeDefault = false) {
    const d = this.read();
    d.plans[name] = { savedAt: new Date().toISOString(), config: cfg };
    if (makeDefault || !d.default || !d.plans[d.default]) d.default = name;
    this.write(d);
  }
  remove(name: string) {
    const d = this.read();
    if (!d.plans[name]) return false;
    delete d.plans[name];
    if (d.default === name) d.default = Object.keys(d.plans)[0] ?? null;
    this.write(d);
    return true;
  }
  setDefault(name: string) {
    const d = this.read();
    if (!d.plans[name]) return false;
    d.default = name;
    this.write(d);
    return true;
  }
}

/** Plans kept in memory only, for tests. */
export class MemoryPlanStore implements PlanStore {
  private plans = new Map<string, { savedAt: string; config: SimulationConfig }>();
  private def: string | null = null;
  list() {
    return [...this.plans.entries()].map(([name, p]) => ({ name, isDefault: name === this.def, savedAt: p.savedAt }));
  }
  get(name: string) {
    const p = this.plans.get(name);
    return p ? sanitize(JSON.parse(JSON.stringify(p.config))) : null;
  }
  defaultName() {
    return this.def && this.plans.has(this.def) ? this.def : null;
  }
  save(name: string, cfg: SimulationConfig, makeDefault = false) {
    this.plans.set(name, { savedAt: new Date().toISOString(), config: cfg });
    if (makeDefault || !this.def || !this.plans.has(this.def)) this.def = name;
  }
  remove(name: string) {
    const ok = this.plans.delete(name);
    if (ok && this.def === name) this.def = this.plans.keys().next().value ?? null;
    return ok;
  }
  setDefault(name: string) {
    if (!this.plans.has(name)) return false;
    this.def = name;
    return true;
  }
}
