import { sanitizeBuyRent } from '../src/buyrent/config.js';
import { defaultBuyRent, STATES } from '../src/buyrent/defaults.js';
import { simulateBuyRent, tippingPoints } from '../src/buyrent/engine.js';
import type { BuyRentConfig, BuyRentResult } from '../src/buyrent/types.js';
import { InputError } from './errors.js';
import { merge } from './scenario.js';
import { appUrl } from './share.js';

const eur = (v: number) => Math.round(v);
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Field documentation for the buy-vs-rent calculator. */
export const BUY_RENT_FIELDS: { path: string; unit?: string; values?: string[]; description: string; default: unknown }[] = (() => {
  const d = defaultBuyRent();
  const f = (path: string, description: string, unit?: string, values?: string[]) => {
    const v = path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], d);
    return { path, unit, values, description, default: v };
  };
  return [
    f('price', 'Kaufpreis der Immobilie.', '€'),
    f('rent', 'Kaltmiete einer vergleichbaren Wohnung zu Beginn.', '€/Monat'),
    f('equity', 'Eigenkapital. Deckt zuerst die Kaufnebenkosten, der Rest mindert den Kredit. Beim Mieten wird es zu Beginn angelegt.', '€'),
    f('interest', 'Sollzins des Kredits.', '% p. a.'),
    f('repayment', 'Anfängliche Tilgung; Rate = Kredit × (Zins + Tilgung) / 12.', '% p. a.'),
    f('fixedYears', 'Zinsbindung.', 'Jahre'),
    f('followUpRate', 'Anschlusszins nach der Zinsbindung; null = wie Sollzins. Die Rate bleibt gleich (Laufzeit passt sich an), steigt aber mindestens auf Zins + 1 % Tilgung.', '% p. a.'),
    f('appreciation', 'Wertsteigerung der Immobilie (nominal).', '% p. a.'),
    f('state', 'Bundesland für die Grunderwerbsteuer.', undefined, STATES.map((s) => `${s.code} (${s.transferTax} %)`)),
    f('notary', 'Notar und Grundbuch.', '% vom Kaufpreis'),
    f('broker', 'Maklerprovision Käuferanteil, 0 ohne Makler.', '% vom Kaufpreis'),
    f('maintenance', 'Instandhaltung pro Jahr; steigt mit der Inflation. Typisch 0,8–1,5 %.', '% vom Kaufpreis'),
    f('rentIncrease', 'Jährliche Mietsteigerung.', '% p. a.'),
    f('sellCost', 'Kosten bei einem Verkauf am Ende (Makler, Notar), vom Wert abgezogen.', '% vom Wert'),
    f('inflation', 'Inflation für Kaufkraft und Instandhaltung.', '% p. a.'),
    f('startYear', 'Kaufjahr.', 'Jahr'),
    f('years', 'Betrachtungszeitraum.', 'Jahre'),
    f('invest.totalReturn', 'Rendite der Geldanlage (ETF) vor Kosten. Abkürzung: totalReturn direkt in changes.', '% p. a.'),
    f('invest.dividendYield', 'Davon Ausschüttung.', '% p. a.'),
    f('invest.ter', 'Laufende Fondskosten.', '% p. a.'),
    f('invest.purchaseFee', 'Kaufgebühr je Einzahlung.', '%'),
    f('invest.fundType', 'Fondsart für die Teilfreistellung.', undefined, ['equity', 'mixed', 'other']),
    f('invest.churchTax', 'Kirchensteuer.', '%', ['0', '8', '9']),
    f('invest.allowance', 'Sparerpauschbetrag.', '€/Jahr'),
  ];
})();

const INVEST_KEYS = ['totalReturn', 'dividendYield', 'ter', 'purchaseFee', 'fundType', 'churchTax', 'allowance'];
const TOP_KEYS = new Set([...BUY_RENT_FIELDS.map((f) => f.path.split('.')[0]), ...INVEST_KEYS]);
const PERSONAL = ['price', 'rent', 'equity', 'interest'];

/** Link that opens the comparison in the app, like its "Teilen" button. */
export function buyRentLink(cfg: BuyRentConfig, base = appUrl()): string {
  const url = new URL('/kaufen-mieten', base.replace(/#.*$/, ''));
  return `${url.origin}${url.pathname}#k=${Buffer.from(JSON.stringify(cfg), 'utf8').toString('base64url')}`;
}

export function readBuyRentLink(link: string): unknown {
  const m = /[#&?]k=([A-Za-z0-9_-]+)/.exec(link.trim());
  if (!m) throw new InputError('Der Link enthält keinen Kaufen-oder-Mieten-Vergleich. Erwartet wird ein Link aus „Teilen“ im Rechner (…/kaufen-mieten#k=…).');
  try {
    return JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'));
  } catch {
    throw new InputError('Der Vergleich im Link ist beschädigt oder unvollständig. Bitte den ganzen Link kopieren.');
  }
}

/** Moves the invest shortcuts (totalReturn …) into invest and rejects unknown fields. */
function normalize(changes: unknown): Record<string, unknown> {
  if (changes == null) return {};
  if (typeof changes !== 'object' || Array.isArray(changes)) throw new InputError('changes muss ein Objekt sein, z. B. { "price": 450000, "rent": 1400 }.');
  const out: Record<string, unknown> = {};
  const invest: Record<string, unknown> = {};
  const unknown: string[] = [];
  for (const [k, v] of Object.entries(changes as Record<string, unknown>)) {
    if (INVEST_KEYS.includes(k)) invest[k] = v;
    else if (k === 'invest' && v && typeof v === 'object') Object.assign(invest, v);
    else if (TOP_KEYS.has(k)) out[k] = v;
    else unknown.push(k);
  }
  if (unknown.length) throw new InputError(`Unbekannte Felder: ${unknown.join(', ')}. Erlaubt: ${[...TOP_KEYS].join(', ')}.`);
  if (Object.keys(invest).length) out.invest = invest;
  return out;
}

function prepare(link: string | undefined, changes: unknown) {
  const start = link ? sanitizeBuyRent(readBuyRentLink(link)) : defaultBuyRent();
  const ch = normalize(changes);
  const cfg = sanitizeBuyRent(merge(start, ch));
  const notes: string[] = [];
  const given = new Set(Object.keys(ch));
  if (!link) {
    const missing = PERSONAL.filter((k) => !given.has(k));
    if (missing.length) notes.push(`Angenommen (Standardwert, bitte bei der Person erfragen): ${missing.map((k) => `${k} = ${JSON.stringify((cfg as unknown as Record<string, unknown>)[k])}`).join(', ')}.`);
  }
  // Report values the sanitizer had to correct.
  const flat = (o: Record<string, unknown>, p = ''): [string, unknown][] =>
    Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? flat(v as Record<string, unknown>, `${p}${k}.`) : [[`${p}${k}`, v]]));
  const got = new Map(flat(cfg as unknown as Record<string, unknown>));
  for (const [k, v] of flat(ch)) if (got.has(k) && got.get(k) !== v) notes.push(`${k}: ${JSON.stringify(v)} ist nicht möglich, gerechnet mit ${JSON.stringify(got.get(k))}.`);
  return { config: cfg, notes };
}

function report(c: BuyRentConfig, r: BuyRentResult, withTipping: boolean, allYears: boolean) {
  const last = r.years[r.years.length - 1];
  const diff = last.buyerWealth - last.renterWealth;
  const diffReal = diff / last.deflator;
  const out: Record<string, unknown> = {
    answer:
      (Math.abs(diff) < 500 ? 'Gleichstand' : `${diff > 0 ? 'Kaufen' : 'Mieten'} liegt nach ${c.years} Jahren um ${eur(Math.abs(diff)).toLocaleString('de-DE')} € vorn (heutige Kaufkraft ${eur(Math.abs(diffReal)).toLocaleString('de-DE')} €)`) +
      (r.breakEven == null ? '; Kaufen holt im Zeitraum nicht auf.' : `; Kaufen liegt ab Jahr ${r.breakEven} (${c.startYear + r.breakEven - 1}) dauerhaft vorn.`),
    end_year: last.year,
    wealth_buy: eur(last.buyerWealth),
    wealth_rent: eur(last.renterWealth),
    wealth_buy_real: eur(last.buyerWealth / last.deflator),
    wealth_rent_real: eur(last.renterWealth / last.deflator),
    break_even_year: r.breakEven,
    purchase_costs: { transfer_tax_rate: r.purchase.transferTaxRate, transfer_tax: eur(r.purchase.transferTax), notary: eur(r.purchase.notary), broker: eur(r.purchase.broker), total: eur(r.purchase.total) },
    loan: eur(r.loan),
    monthly_payment: r2(r.monthlyPayment),
    paid_off_year: r.paidOffYear,
    price_to_rent: Math.round(r.priceToRent * 10) / 10,
    end_buy: { property_value: eur(last.propertyValue), sell_costs: eur(last.propertyValue * c.sellCost / 100), debt: eur(last.debt), depot_after_tax: eur(last.buyerDepot) },
    totals: Object.fromEntries(Object.entries(r.totals).map(([k, v]) => [k, eur(v)])),
    warnings: r.warnings,
    model:
      'Beide Wege geben jeden Monat gleich viel aus: wer weniger fürs Wohnen zahlt (Rate + Instandhaltung gegen Miete), legt die Differenz in einen ETF an; beim Mieten wird das Eigenkapital zu Beginn angelegt. Verglichen wird, als ob am Ende alles verkauft würde (Verkaufskosten, Abgeltungsteuer). Nicht eingerechnet: Sicherheit vor Eigenbedarf, Flexibilität, eigener Aufwand.',
  };
  if (withTipping) {
    out.tipping_points = tippingPoints(c).map((t) => ({
      field: t.key,
      label: t.label,
      current: r2(t.current),
      unit: t.unit,
      threshold: t.threshold == null ? null : r2(t.threshold),
      buying_wins: t.threshold == null ? (t.buyingWinsNow ? 'immer im geprüften Bereich' : 'nie im geprüften Bereich') : t.buyingAboveThreshold ? 'oberhalb' : 'unterhalb',
    }));
  }
  if (allYears) {
    out.years = r.years.map((y) => ({
      year: y.year,
      interest: eur(y.interest),
      principal: eur(y.principal),
      maintenance: eur(y.maintenance),
      debt: eur(y.debt),
      property_value: eur(y.propertyValue),
      rent: eur(y.rent),
      invested_buy: eur(y.buyerInvested),
      invested_rent: eur(y.renterInvested),
      wealth_buy: eur(y.buyerWealth),
      wealth_rent: eur(y.renterWealth),
    }));
  }
  return out;
}

export interface BuyVsRentArgs {
  link?: string;
  changes?: unknown;
  scenarios?: { name: string; changes?: unknown }[];
  detail?: 'summary' | 'years';
  tipping_points?: boolean;
}

export function buyVsRent(args: BuyVsRentArgs, linkBase?: string) {
  if (args.scenarios?.length) {
    const shared = normalize(args.changes);
    return {
      scenarios: args.scenarios.slice(0, 8).map((s) => {
        const p = prepare(args.link, merge(shared, normalize(s.changes)));
        const out = report(p.config, simulateBuyRent(p.config), args.tipping_points === true, false);
        return { name: s.name, notes: p.notes, ...out, app_link: buyRentLink(p.config, linkBase) };
      }),
    };
  }
  const p = prepare(args.link, args.changes);
  return {
    notes: p.notes,
    config: p.config,
    ...report(p.config, simulateBuyRent(p.config), args.tipping_points !== false, args.detail === 'years'),
    app_link: buyRentLink(p.config, linkBase),
  };
}
