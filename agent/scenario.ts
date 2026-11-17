import { defaultConfig } from '../src/defaults.js';
import { sanitize } from '../src/lib/config.js';
import type { SimulationConfig } from '../src/types.js';
import { InputError } from './errors.js';
import { KEY_FIELDS, PERSONAL_FIELDS, LIST_ITEM_KEYS } from './fields.js';
import { readShareLink } from './share.js';

/** Where saved plans live. Implemented on top of a JSON file by store.ts. */
export interface PlanStore {
  list(): { name: string; isDefault: boolean; savedAt: string }[];
  get(name: string): SimulationConfig | null;
  defaultName(): string | null;
  save(name: string, cfg: SimulationConfig, makeDefault?: boolean): void;
  remove(name: string): boolean;
  setDefault(name: string): boolean;
}

/**
 * Results, so later calls can build on them ("result:<id>").
 * Normally kept in memory for the session ("r3"). Without memory (stateless, e.g. on a server
 * that forgets everything between requests) the id itself carries the configuration ("x…").
 */
export class ResultCache {
  private items = new Map<string, { config: SimulationConfig; label: string }>();
  private n = 0;
  constructor(private readonly stateless = false) {}
  add(config: SimulationConfig, label: string): string {
    if (this.stateless) return encodeResult(config);
    const id = `r${++this.n}`;
    this.items.set(id, { config, label });
    if (this.items.size > 500) this.items.delete(this.items.keys().next().value!);
    return id;
  }
  get(id: string) {
    if (id.startsWith('x')) {
      const config = decodeResult(id);
      return config ? { config, label: 'aus der Ergebnis-Kennung' } : null;
    }
    return this.items.get(id) ?? null;
  }
}

/** Only what differs from the standard values (plus the start date), so ids stay short. */
function encodeResult(cfg: SimulationConfig): string {
  const d = defaultConfig() as unknown as Record<string, unknown>;
  const c = cfg as unknown as Record<string, unknown>;
  const part: Record<string, unknown> = { startDate: cfg.startDate };
  for (const k of Object.keys(c)) if (JSON.stringify(c[k]) !== JSON.stringify(d[k])) part[k] = c[k];
  return 'x' + Buffer.from(JSON.stringify(part), 'utf8').toString('base64url');
}

function decodeResult(id: string): SimulationConfig | null {
  try {
    const part = JSON.parse(Buffer.from(id.slice(1), 'base64url').toString('utf8'));
    return sanitize({ ...defaultConfig(), ...part });
  } catch {
    return null;
  }
}

export { InputError } from './errors.js';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * The starting point of a calculation:
 * - "auto" (default): the default saved plan if there is one, otherwise the standard values
 * - "saved": the default saved plan
 * - "defaults": the simulator's standard values (a calculation from scratch)
 * - "plan:<name>": a saved plan by name
 * - "result:<id>": the configuration behind an earlier result
 * - "link:<share link>": a plan from the app's "Teilen" button
 */
export function resolveBase(base: string | undefined, store: PlanStore, cache: ResultCache): { label: string; config: SimulationConfig; fromScratch: boolean } {
  const b = (base ?? 'auto').trim() || 'auto';
  if (b === 'defaults') return { label: 'Standardwerte (neue Rechnung)', config: defaultConfig(), fromScratch: true };
  if (b === 'auto') {
    const name = store.defaultName();
    const cfg = name ? store.get(name) : null;
    if (!name || !cfg) return { label: 'Standardwerte (neue Rechnung, kein Plan gespeichert)', config: defaultConfig(), fromScratch: true };
    return { label: `gespeicherter Plan „${name}“`, config: cfg, fromScratch: false };
  }
  if (b === 'saved') {
    const name = store.defaultName();
    const cfg = name ? store.get(name) : null;
    if (!name || !cfg) {
      throw new InputError(
        'Es ist noch kein Plan gespeichert. Importiere einen Teilen-Link aus der App (plans mit action "import_link") ' +
          'oder rechne mit base "defaults" und gib alle relevanten Werte unter changes an.',
      );
    }
    return { label: `gespeicherter Plan „${name}“`, config: cfg, fromScratch: false };
  }
  if (b.startsWith('plan:')) {
    const name = b.slice(5);
    const cfg = store.get(name);
    if (!cfg) throw new InputError(`Kein gespeicherter Plan „${name}“. Vorhanden: ${store.list().map((p) => p.name).join(', ') || 'keine'}.`);
    return { label: `Plan „${name}“`, config: cfg, fromScratch: false };
  }
  if (b.startsWith('link:')) {
    return { label: 'Plan aus dem Teilen-Link', config: sanitize(readShareLink(b.slice(5))), fromScratch: false };
  }
  if (b.startsWith('result:')) {
    const hit = cache.get(b.slice(7));
    if (!hit) throw new InputError(`Ergebnis „${b.slice(7)}“ ist nicht (mehr) bekannt. Ergebnisse gelten nur innerhalb einer Sitzung; die Rechnung bitte mit base und changes neu aufsetzen.`);
    return { label: `Ergebnis ${b.slice(7)} (${hit.label})`, config: hit.config, fromScratch: false };
  }
  throw new InputError(`Unbekannte base „${b}“. Erlaubt: "auto", "saved", "defaults", "plan:<name>", "result:<id>", "link:<Teilen-Link>".`);
}

/** Rejects keys that the configuration does not have, with the allowed keys as a hint. */
function checkKeys(changes: Obj, shape: Obj, prefix = ''): string[] {
  const errors: string[] = [];
  for (const [k, v] of Object.entries(changes)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (!(k in shape)) {
      errors.push(`Unbekanntes Feld „${path}“. Erlaubt${prefix ? ` in ${prefix}` : ''}: ${Object.keys(shape).join(', ')}.`);
      continue;
    }
    const s = shape[k];
    if (Array.isArray(s)) {
      if (!Array.isArray(v)) {
        errors.push(`„${path}“ muss eine Liste sein.`);
        continue;
      }
      const allowed = LIST_ITEM_KEYS[path] ?? [];
      v.forEach((item, i) => {
        if (!isObj(item)) return errors.push(`„${path}[${i}]“ muss ein Objekt sein.`);
        for (const ik of Object.keys(item)) {
          if (!allowed.includes(ik)) errors.push(`Unbekanntes Feld „${path}[${i}].${ik}“. Erlaubt: ${allowed.join(', ')}.`);
        }
      });
    } else if (isObj(s)) {
      if (!isObj(v)) errors.push(`„${path}“ muss ein Objekt sein.`);
      else errors.push(...checkKeys(v, s, path));
    }
  }
  return errors;
}

/** Objects merge key by key; lists and single values replace what was there. */
export function merge(base: unknown, changes: unknown): unknown {
  if (!isObj(base) || !isObj(changes)) return changes;
  const out: Obj = { ...base };
  for (const [k, v] of Object.entries(changes)) out[k] = isObj(v) && isObj(base[k]) ? merge(base[k], v) : v;
  return out;
}

/** Flattens a configuration to "path → value"; lists are compared as a whole, ignoring ids. */
export function flatten(obj: unknown, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  if (isObj(obj)) {
    for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else if (Array.isArray(obj)) {
    out[prefix] = obj.map((x) => (isObj(x) ? Object.fromEntries(Object.entries(x).filter(([k]) => k !== 'id')) : x));
  } else {
    out[prefix] = obj;
  }
  return out;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** What differs between two configurations, as path → { from, to }. */
export function diff(from: SimulationConfig, to: SimulationConfig): Record<string, { from: unknown; to: unknown }> {
  const a = flatten(from);
  const b = flatten(to);
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (!same(a[k], b[k])) out[k] = { from: a[k], to: b[k] };
  return out;
}

/** Plausibility checks on the result; sanitize() only fixes types, not sense. */
function sanityNotes(c: SimulationConfig): string[] {
  const notes: string[] = [];
  const y = (iso: string) => Number(iso.slice(0, 4));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.birthDate) || !/^\d{4}-\d{2}-\d{2}$/.test(c.startDate)) notes.push('Datumsangaben müssen im Format JJJJ-MM-TT sein.');
  if (c.birthDate >= c.startDate) notes.push('Das Geburtsdatum liegt nicht vor dem Startdatum.');
  const today = new Date().toISOString().slice(0, 10);
  if (c.startDate < today && (Date.parse(today) - Date.parse(c.startDate)) / 864e5 > 45) {
    notes.push(`Das Startdatum (${c.startDate}) liegt in der Vergangenheit; Kapital und Alter beziehen sich auf diesen Zeitpunkt. Für heute: changes { "startDate": "${today}" } und aktuelles Depot als initialCapital.`);
  }
  if (c.totalReturn > 15 || c.totalReturn < -5) notes.push(`Ungewöhnliche Rendite: ${c.totalReturn} % p. a.`);
  if (c.dividendYield > c.totalReturn) notes.push('Die Ausschüttungsrendite ist höher als die Gesamtrendite.');
  if (c.initialCapital < 0 || c.monthlySavings < 0) notes.push('Startkapital und Sparrate sollten nicht negativ sein.');
  if (c.withdrawal.enabled && c.withdrawal.startYear < y(c.startDate)) notes.push('Die Entnahme beginnt vor dem Start der Simulation.');
  return notes;
}

export interface Prepared {
  config: SimulationConfig;
  base: string;
  /** Values that were filled in, corrected or look odd – to be shown to the person. */
  notes: string[];
  /** Effective differences to the starting point. */
  changed: Record<string, { from: unknown; to: unknown }>;
}

/** Starting point + changes → checked configuration, with notes on everything that was assumed. */
export function prepare(baseArg: string | undefined, changes: unknown, store: PlanStore, cache: ResultCache): Prepared {
  const { label, config: base, fromScratch } = resolveBase(baseArg, store, cache);
  const raw = changes == null ? {} : changes;
  if (!isObj(raw)) throw new InputError('changes muss ein Objekt sein, z. B. { "monthlySavings": 800 }.');
  const ch: Obj = { ...raw };
  const pre: string[] = [];
  // Shortcut: age instead of a birth date
  if ('age' in ch) {
    const age = Number(ch.age);
    delete ch.age;
    if (!Number.isFinite(age) || age < 0 || age > 110) throw new InputError('age muss ein Alter in Jahren sein (0–110).');
    if ('birthDate' in ch) throw new InputError('Bitte entweder age oder birthDate angeben, nicht beides.');
    const start = typeof ch.startDate === 'string' ? ch.startDate : base.startDate;
    const [yy, mm, dd] = start.split('-').map(Number);
    // Birthday the day before the start: the person is exactly `age` at the start
    const b = new Date(Date.UTC(yy - Math.round(age), mm - 1, dd - 1));
    ch.birthDate = b.toISOString().slice(0, 10);
    pre.push(`Alter ${Math.round(age)} als Geburtsdatum ${ch.birthDate} übernommen.`);
  }
  const shape = defaultConfig() as unknown as Obj;
  (shape.withdrawal as Obj).startAge = 0; // shortcut, converted below
  const errors = checkKeys(ch, shape);
  if (errors.length) throw new InputError(errors.join(' '));

  const merged = merge(base, ch) as Obj;
  const wd = (merged.withdrawal ?? {}) as Obj;
  const wch: Obj = isObj(ch.withdrawal) ? { ...ch.withdrawal } : {};
  if (isObj(ch.withdrawal) && 'startAge' in ch.withdrawal) {
    const { startAge: _drop, ...rest } = ch.withdrawal;
    ch.withdrawal = rest; // shortcut is converted below, not compared as a field
  }
  /** First January at which the person has reached `a`. */
  const firstJanAtAge = (a: number) => {
    const bd = String(merged.birthDate);
    return Number(bd.slice(0, 4)) + a + (bd.slice(5) === '01-01' ? 0 : 1);
  };
  const birthYear = Number(String(merged.birthDate).slice(0, 4));
  const startY = Number(String(merged.startDate).slice(0, 4));

  // Shortcut: withdrawal.startAge instead of a calendar year
  if ('startAge' in wch) {
    const a = Number(wch.startAge);
    if (!Number.isFinite(a) || a < 0 || a > 110) throw new InputError('withdrawal.startAge muss ein Alter in Jahren sein.');
    if ('startYear' in wch) throw new InputError('Bitte entweder withdrawal.startAge oder withdrawal.startYear angeben, nicht beides.');
    delete wd.startAge;
    wd.startYear = Math.max(firstJanAtAge(Math.round(a)), startY);
    pre.push(`Entnahme ab Alter ${Math.round(a)} = ab Januar ${wd.startYear}${Number(wd.startYear) === startY ? ' (sofort)' : ''}.`);
  }

  // New calculation: values derived from the age follow the person, not the placeholder birth year
  if (fromScratch) {
    const age = startY - birthYear;
    const adjusted: string[] = [];
    if (!('startYear' in wch) && !('startAge' in wch)) {
      wd.startYear = Math.max(firstJanAtAge(67), startY);
      adjusted.push(`withdrawal.startYear = ${wd.startYear} (${Number(wd.startYear) === startY ? 'sofort' : 'ab 67'})`);
    }
    if (!('dividendPayoutYear' in ch)) merged.dividendPayoutYear = wd.startYear;
    if (!('lifeExpectancy' in wch) && age + 10 > Number(wd.lifeExpectancy)) {
      wd.lifeExpectancy = Math.min(110, age + 10);
      adjusted.push(`withdrawal.lifeExpectancy = ${wd.lifeExpectancy}`);
    }
    if (!('durationMode' in ch) && !('durationYears' in ch) && !('targetAge' in ch)) {
      const lastAge = wd.enabled ? Number(wd.lifeExpectancy) : age < 62 ? 67 : Math.min(110, age + 20);
      merged.durationMode = 'age';
      merged.targetAge = lastAge;
      adjusted.push(`Laufzeit bis Alter ${lastAge}${wd.enabled ? ' (Lebenserwartung)' : age < 62 ? ' (Rentenbeginn)' : ''}`);
    }
    if (adjusted.length) pre.push(`An das Alter angepasst: ${adjusted.join(', ')}. Abweichend wählbar über withdrawal.startAge, withdrawal.lifeExpectancy, durationMode/targetAge/durationYears.`);
  }
  merged.withdrawal = wd;
  const config = sanitize(merged);
  const notes: string[] = [...pre];

  // Changes the check had to correct or drop
  const want = flatten(ch);
  const got = flatten(config);
  for (const [path, v] of Object.entries(want)) {
    if (same(v, got[path])) continue;
    if (Array.isArray(v) && Array.isArray(got[path])) {
      notes.push(`${path}: ${v.length - (got[path] as unknown[]).length} ungültige Einträge verworfen (Pflichtfelder fehlen oder haben den falschen Typ).`);
    } else {
      notes.push(`${path}: ${JSON.stringify(v)} ist ungültig, verwendet wird ${JSON.stringify(got[path])}.`);
    }
  }
  // Starting from scratch: say which important values were assumed
  if (fromScratch) {
    const show = (k: string) => `${k} = ${JSON.stringify((config as unknown as Obj)[k])}`;
    const personal = PERSONAL_FIELDS.filter((k) => !(k in ch));
    if (personal.length) notes.push(`Persönliche Eckdaten fehlen, Platzhalter verwendet – bitte bei der Person erfragen: ${personal.map(show).join(', ')}.`);
    const rest = KEY_FIELDS.filter((k) => !PERSONAL_FIELDS.includes(k) && !(k in ch));
    if (rest.length) notes.push(`Übliche Standardwerte angenommen: ${rest.map(show).join(', ')}.`);
  }
  notes.push(...sanityNotes(config));
  return { config, base: label, notes, changed: diff(base, config) };
}
