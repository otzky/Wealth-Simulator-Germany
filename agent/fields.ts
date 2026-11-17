import { defaultConfig } from '../src/defaults.js';

/** Description of one configuration field, for `describe` and for checking changes. */
export interface FieldDoc {
  path: string; // dotted path, e.g. "withdrawal.monthlyNet"; list items as "lumpSums[]"
  type: string;
  unit?: string;
  values?: string[];
  description: string;
  default?: unknown;
}

const F: Omit<FieldDoc, 'default'>[] = [
  // Profile & horizon
  { path: 'birthDate', type: 'string (JJJJ-MM-TT)', description: 'Geburtsdatum. Bestimmt das Alter in allen Ergebnissen.' },
  { path: 'age', type: 'number', unit: 'Jahre', description: 'Abkürzung statt birthDate: Alter zum Start. Wird in ein Geburtsdatum umgerechnet (gleicher Tag wie startDate). Nur in changes, nicht zusammen mit birthDate.' },
  { path: 'startDate', type: 'string (JJJJ-MM-TT)', description: 'Beginn der Simulation (Monat des Datums). Standard: heute.' },
  { path: 'durationMode', type: 'enum', values: ['years', 'age'], description: 'Laufzeit als Anzahl Jahre oder bis zu einem Alter. Wird bei withdrawal.mode = "target" ignoriert (dann läuft der Plan bis withdrawal.lifeExpectancy).' },
  { path: 'durationYears', type: 'number', unit: 'Jahre', description: 'Laufzeit bei durationMode = "years".' },
  { path: 'targetAge', type: 'number', unit: 'Jahre', description: 'Zielalter bei durationMode = "age" (inklusive des Geburtstagsmonats).' },

  // Contributions
  { path: 'initialCapital', type: 'number', unit: '€', description: 'Startkapital, im ersten Monat investiert.' },
  { path: 'monthlySavings', type: 'number', unit: '€/Monat', description: 'Sparrate zu Beginn.' },
  { path: 'savingsGrowth', type: 'number', unit: '% p. a.', description: 'Jährliche Erhöhung der Sparrate (Dynamik), jeweils im Januar.' },
  { path: 'savingsSteps', type: 'Liste', description: 'Ereignis „Sparrate ändern“: ab Januar von year gilt monthlyAmount; die Dynamik startet von dort neu. Eine Liste ersetzt die bisherige vollständig.' },
  { path: 'savingsSteps[].year', type: 'number', description: 'Kalenderjahr.' },
  { path: 'savingsSteps[].monthlyAmount', type: 'number', unit: '€/Monat', description: 'Neue Sparrate.' },
  { path: 'lumpSums', type: 'Liste', description: 'Ereignis „Einmalzahlung“ (z. B. Erbschaft), im Januar des Jahres. Eine Liste ersetzt die bisherige vollständig.' },
  { path: 'lumpSums[].year', type: 'number', description: 'Kalenderjahr.' },
  { path: 'lumpSums[].amount', type: 'number', unit: '€', description: 'Betrag.' },
  { path: 'lumpSums[].label', type: 'string', description: 'Optionale Bezeichnung.' },

  // Events that take money out
  { path: 'oneOffWithdrawals', type: 'Liste', description: 'Ereignis „Einmalige Entnahme“ (z. B. Eigenkapital für eine Immobilie), im Januar des Jahres. Netto-Betrag: so viel kommt nach Steuern an. Eine Liste ersetzt die bisherige vollständig.' },
  { path: 'oneOffWithdrawals[].year', type: 'number', description: 'Kalenderjahr.' },
  { path: 'oneOffWithdrawals[].amount', type: 'number', unit: '€ netto', description: 'Betrag nach Steuern.' },
  { path: 'oneOffWithdrawals[].label', type: 'string', description: 'Optionale Bezeichnung.' },
  { path: 'withdrawalPhases', type: 'Liste', description: 'Ereignis „Befristete Entnahme“ (z. B. Teilzeit, Sabbatical): von Januar startYear bis Dezember endYear. Die Sparrate läuft weiter. Addiert sich zu Überschneidungen und zur Entnahmephase. Eine Liste ersetzt die bisherige vollständig.' },
  { path: 'withdrawalPhases[].startYear', type: 'number', description: 'Erstes Jahr.' },
  { path: 'withdrawalPhases[].endYear', type: 'number', description: 'Letztes Jahr.' },
  { path: 'withdrawalPhases[].monthlyNet', type: 'number', unit: '€ netto/Monat', description: 'Betrag nach Steuern, in Euro des Startjahres.' },
  { path: 'withdrawalPhases[].inflationAdjust', type: 'boolean', description: 'Jährlich mit der Inflation erhöhen (Standard true).' },

  // Market
  { path: 'totalReturn', type: 'number', unit: '% p. a.', description: 'Erwartete Gesamtrendite inklusive Ausschüttungen, vor Kosten und Steuern – wie Index-Renditen angegeben werden (MSCI World historisch etwa 7–8 %).' },
  { path: 'dividendYield', type: 'number', unit: '% p. a.', description: 'Ausschüttungsrendite, Teil von totalReturn. Bei thesaurierenden ETFs 0.' },
  { path: 'inflation', type: 'number', unit: '% p. a.', description: 'Inflationsrate für Kaufkraft-Werte und Inflationsanpassungen.' },
  { path: 'dividendStrategy', type: 'enum', values: ['reinvest', 'payout', 'withWithdrawal', 'fromYear'], description: 'Ausschüttungen wieder anlegen, auszahlen, ab Entnahmebeginn auszahlen oder ab dividendPayoutYear auszahlen.' },
  { path: 'dividendPayoutYear', type: 'number', description: 'Bei dividendStrategy = "fromYear": Auszahlung ab Januar dieses Jahres.' },
  { path: 'returnSpread', type: 'number', unit: '± Prozentpunkte', description: 'Bandbreite für pessimistisches/optimistisches Szenario im Plan (nicht Monte Carlo).' },

  // Costs
  { path: 'purchaseFee', type: 'number', unit: '% je Kauf', description: 'Kaufkosten, zählen zu den Anschaffungskosten.' },
  { path: 'ter', type: 'number', unit: '% p. a.', description: 'Laufende Fondskosten.' },

  // Taxes
  { path: 'capitalGainsTax', type: 'number', unit: '%', description: 'Abgeltungsteuer (25).' },
  { path: 'soli', type: 'number', unit: '% der Steuer', description: 'Solidaritätszuschlag (5,5).' },
  { path: 'churchTax', type: 'enum', values: ['0', '8', '9'], description: 'Kirchensteuersatz in % (0 = keine).' },
  { path: 'allowance', type: 'number', unit: '€ p. a.', description: 'Sparerpauschbetrag (1.000 €, Paare 2.000 €).' },
  { path: 'fundType', type: 'enum', values: ['equity', 'mixed', 'other'], description: 'Fondsart für die Teilfreistellung: Aktienfonds 30 %, Mischfonds 15 %, sonstige 0 %.' },
  { path: 'applyAdvanceLumpSum', type: 'boolean', description: 'Vorabpauschale berechnen.' },
  { path: 'baseRate', type: 'number', unit: '%', description: 'Basiszins für die Vorabpauschale.' },

  // Withdrawal phase
  { path: 'withdrawal.enabled', type: 'boolean', description: 'Dauerhafte Entnahme (z. B. Ruhestand) einschalten.' },
  { path: 'withdrawal.startYear', type: 'number', description: 'Entnahme ab Januar dieses Jahres, bis zum Ende der Simulation.' },
  { path: 'withdrawal.startAge', type: 'number', unit: 'Jahre', description: 'Abkürzung statt withdrawal.startYear: Entnahme ab Januar des Jahres, in dem dieses Alter erreicht wird. Nur in changes.' },
  { path: 'withdrawal.mode', type: 'enum', values: ['fixed', 'rate', 'target'], description: '"fixed": fester Netto-Betrag; "rate": Prozent des Depotwerts zu Beginn; "target": Betrag wird berechnet, sodass mit lifeExpectancy endWealth übrig bleibt.' },
  { path: 'withdrawal.monthlyNet', type: 'number', unit: '€ netto/Monat', description: 'Bei "fixed": gewünschter Netto-Betrag im ersten Jahr.' },
  { path: 'withdrawal.rate', type: 'number', unit: '% p. a.', description: 'Bei "rate": Entnahmerate, bezogen auf den Depotwert zu Beginn (vor Steuern).' },
  { path: 'withdrawal.inflationAdjust', type: 'boolean', description: 'Betrag jährlich mit der Inflation erhöhen.' },
  { path: 'withdrawal.stopContributions', type: 'boolean', description: 'Sparrate ab Entnahmebeginn stoppen.' },
  { path: 'withdrawal.countDividends', type: 'boolean', description: 'Ausgezahlte Dividenden auf den Monatsbetrag anrechnen (nur verkaufen, was fehlt).' },
  { path: 'withdrawal.lifeExpectancy', type: 'number', unit: 'Jahre', description: 'Bei "target": Alter, bis zu dem der Plan läuft.' },
  { path: 'withdrawal.endWealth', type: 'number', unit: '€', description: 'Bei "target": Depotwert, der mit lifeExpectancy übrig bleiben soll (z. B. zum Vererben); 0 = aufbrauchen.' },
  { path: 'withdrawal.endWealthBasis', type: 'enum', values: ['nominal', 'real'], description: 'endWealth nominal oder in heutiger Kaufkraft.' },
  { path: 'withdrawal.guardrails.enabled', type: 'boolean', description: 'Leitplanken (wirken nur in Monte Carlo): Entnahme kürzen, wenn das Depot den Betrag bis zum Ende nicht mehr tragen kann.' },
  { path: 'withdrawal.guardrails.direction', type: 'enum', values: ['down', 'both'], description: '"down": nur kürzen, sonst nach Plan; "both": kürzen und erhöhen (Guyton-Klinger).' },
  { path: 'withdrawal.guardrails.threshold', type: 'number', unit: '%', description: 'Auslöser: so weit darf der geplante über dem tragfähigen Betrag liegen.' },
  { path: 'withdrawal.guardrails.adjust', type: 'number', unit: '%', description: 'Kürzung bzw. Erhöhung je Anpassung.' },
  { path: 'withdrawal.guardrails.floor', type: 'number', unit: '€ netto/Monat', description: 'Mindestbetrag, nie unterschritten (Euro des Startjahres); 0 = keiner.' },

  // Monte Carlo
  { path: 'monteCarlo.enabled', type: 'boolean', description: 'Nur für die App relevant; das Werkzeug monte_carlo rechnet immer.' },
  { path: 'monteCarlo.volatility', type: 'number', unit: '% p. a.', description: 'Volatilität wie in Factsheets (aus Monatsrenditen hochgerechnet). MSCI World etwa 15 %.' },
  { path: 'monteCarlo.runs', type: 'enum', values: ['1000', '5000'], description: 'Anzahl der Verläufe.' },
  { path: 'monteCarlo.seed', type: 'number', description: 'Startwert der Zufallszahlen; gleicher Wert, gleiche Ergebnisse.' },

  // Goal
  { path: 'goal.enabled', type: 'boolean', description: 'Ziel auswerten.' },
  { path: 'goal.wealth', type: 'number | null', unit: '€', description: 'Zielvermögen (am Ende bzw. vor Entnahmebeginn).' },
  { path: 'goal.wealthBasis', type: 'enum', values: ['nominal', 'real'], description: 'Zielvermögen nominal oder in heutiger Kaufkraft.' },
  { path: 'goal.monthlyDividend', type: 'number | null', unit: '€ netto/Monat', description: 'Ziel für die monatliche Netto-Dividende.' },
  { path: 'goal.dividendBasis', type: 'enum', values: ['nominal', 'real'], description: 'Dividendenziel nominal oder in heutiger Kaufkraft.' },
  { path: 'goal.solveFor', type: 'enum', values: ['savings', 'initial', 'return'], description: 'Was der Zielrechner berechnet: Sparrate, Startkapital oder Rendite.' },
];

function get(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
}

/** All field descriptions, with the current default values. */
export function fieldDocs(): FieldDoc[] {
  const d = defaultConfig();
  return F.map((f) => (f.path.includes('[]') ? { ...f } : { ...f, default: get(d, f.path) }));
}

/** Allowed keys of list items, per list. */
export const LIST_ITEM_KEYS: Record<string, string[]> = {
  savingsSteps: ['id', 'year', 'monthlyAmount'],
  lumpSums: ['id', 'year', 'amount', 'label'],
  oneOffWithdrawals: ['id', 'year', 'amount', 'label'],
  withdrawalPhases: ['id', 'startYear', 'endYear', 'monthlyNet', 'inflationAdjust'],
};

/** Fields that should not silently fall back to a default when a calculation starts from scratch. */
/** Values that differ from person to person – asked for when starting from scratch. */
export const PERSONAL_FIELDS = ['birthDate', 'initialCapital', 'monthlySavings', 'totalReturn'];

export const KEY_FIELDS = ['birthDate', 'initialCapital', 'monthlySavings', 'totalReturn', 'dividendYield', 'inflation', 'ter', 'fundType', 'churchTax', 'allowance'];
