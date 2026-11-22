import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { MODEL_NOTES } from './model.js';
import { InputError } from './scenario.js';
import { AgentTools } from './tools.js';

const base = z
  .string()
  .optional()
  .describe('Ausgangspunkt: "auto" (Standard: gespeicherter Plan, sonst Standardwerte), "defaults" (immer neue Rechnung ab Standardwerten), "saved", "plan:<name>", "result:<id>" (früheres Ergebnis weiterdrehen), "link:<Teilen-Link aus der App>".');
const changes = z
  .record(z.string(), z.unknown())
  .optional()
  .describe('Abweichungen vom Ausgangspunkt, verschachtelt wie die Konfiguration (Felder siehe describe), z. B. { "age": 30, "initialCapital": 20000, "monthlySavings": 800, "totalReturn": 7 }. age ist eine Abkürzung für birthDate. Objekte werden zusammengeführt, Listen ersetzt.');

export interface ServerOptions {
  /** Hosted without storage: no saved plans, results carry their configuration in the id. */
  remote?: boolean;
}

export function createServer(tools: AgentTools, opts: ServerOptions = {}) {
  const server = new McpServer(
    { name: 'wealth-simulator', version: '1.0.0' },
    {
      instructions:
        'Vermögens-Simulator für Deutschland (ETF-Sparplan, deutsche Steuern, Entnahmephase, Monte Carlo). Rechnungen lassen sich von Null starten: persönliche Eckdaten (age, initialCapital, monthlySavings, totalReturn) unter changes angeben, alles andere hat sinnvolle Standardwerte. Fehlen Eckdaten, nennt die Antwort sie unter "notes" – dann bei der Person nachfragen statt zu raten. Mit compare Szenarien nebeneinander rechnen (gemeinsame Eckdaten einmal, je Szenario nur den Unterschied); ein Ergebnis mit base "result:<id>" weiterdrehen. ' +
        (opts.remote
          ? 'Ein Plan aus der App lässt sich mit base "link:<Teilen-Link>" übernehmen. Dieser Server speichert nichts. '
          : 'Ein Plan aus der App lässt sich per Teilen-Link übernehmen (plans import_link) oder direkt mit base "link:<Teilen-Link>". ') +
        'describe erklärt alle Felder. Werte aus "notes" der Person mitteilen. Für die Frage Kaufen oder Mieten gibt es buy_vs_rent. Ergebnisse sind Modellrechnungen, keine Anlageberatung.',
    },
  );

  const wrap =
    <A,>(fn: (a: A) => unknown) =>
    async (a: A) => {
      try {
        return { content: [{ type: 'text' as const, text: JSON.stringify(fn(a), null, 1) }] };
      } catch (e) {
        const msg = e instanceof InputError ? e.message : `Interner Fehler: ${(e as Error).message}`;
        return { isError: true, content: [{ type: 'text' as const, text: msg }] };
      }
    };
  const ro = { readOnlyHint: true, openWorldHint: false };

  server.registerTool(
    'describe',
    { title: 'Felder und Modell', description: 'Alle Konfigurationsfelder mit Typ, Einheit, Standardwert und Bedeutung sowie die Modellannahmen. Vor der ersten Rechnung aufrufen.', inputSchema: {}, annotations: ro },
    wrap(() => tools.describe()),
  );

  server.registerTool(
    'simulate',
    {
      title: 'Plan rechnen',
      description: 'Rechnet den Plan ohne Marktschwankungen: Endwerte (nominal, Kaufkraft, nach Verkauf), Dividenden, Entnahmen, Ziel, Warnungen und Meilenstein-Jahre. detail "years" liefert alle Jahre.',
      inputSchema: { base, changes, detail: z.enum(['summary', 'years']).optional() },
      annotations: ro,
    },
    wrap((a) => tools.simulate(a)),
  );

  server.registerTool(
    'monte_carlo',
    {
      title: 'Monte-Carlo-Simulation',
      description: 'Simuliert 1000 oder 5000 Marktverläufe (Regime-Modell): Erfolgsquote, Perzentile des Depotwerts, bezahlte Entnahmen, Leitplanken-Statistik. Optional safe_probability (0.5–0.99) für die sichere Entnahme. Gleicher Startwert = reproduzierbar.',
      inputSchema: {
        base,
        changes,
        runs: z.union([z.literal(1000), z.literal(5000)]).optional(),
        volatility: z.number().min(5).max(30).optional().describe('Volatilität in % p. a. (Factsheet-Definition), Standard laut Plan, typisch 15.'),
        seed: z.number().int().optional(),
        safe_probability: z.number().min(0.5).max(0.99).optional(),
      },
      annotations: ro,
    },
    wrap((a) => tools.monteCarlo(a as Parameters<AgentTools['monteCarlo']>[0])),
  );

  server.registerTool(
    'solve',
    {
      title: 'Wert berechnen',
      description:
        'Berechnet einen gesuchten Wert. target "withdrawal_for_end_wealth": monatliche Netto-Entnahme bis withdrawal.lifeExpectancy mit Restvermögen withdrawal.endWealth (ohne Schwankungen). "safe_withdrawal": Entnahme, die in probability (Standard 0.9) der Verläufe hält. "goal": nötige Sparrate (variable "savings"), Startkapital ("initial") oder Rendite ("return") für goal.wealth bzw. goal.monthlyDividend.',
      inputSchema: {
        base,
        changes,
        target: z.enum(['withdrawal_for_end_wealth', 'safe_withdrawal', 'goal']),
        probability: z.number().min(0.5).max(0.99).optional(),
        variable: z.enum(['savings', 'initial', 'return']).optional(),
      },
      annotations: ro,
    },
    wrap((a) => tools.solve(a)),
  );

  server.registerTool(
    'compare',
    {
      title: 'Szenarien vergleichen',
      description: 'Rechnet bis zu 8 Szenarien nebeneinander. base und changes oben gelten für alle (z. B. die Eckdaten einer neuen Rechnung), jedes Szenario ergänzt nur seinen Unterschied (name, changes, optional eigene base). Mit monte_carlo true zusätzlich Erfolgsquote und Perzentile, alle mit denselben Zufallsverläufen.',
      inputSchema: {
        base,
        changes,
        scenarios: z.array(z.object({ name: z.string(), base: base, changes: changes })).min(1).max(8),
        monte_carlo: z.boolean().optional(),
      },
      annotations: ro,
    },
    wrap((a) => tools.compare(a)),
  );

  server.registerTool(
    'buy_vs_rent',
    {
      title: 'Kaufen oder Mieten',
      description:
        'Vergleicht den Kauf einer selbst genutzten Immobilie mit Mieten plus Geldanlage (beide Wege geben monatlich gleich viel aus, die Differenz geht in einen ETF; deutsche Kaufnebenkosten und Steuern). Liefert Gewinner, Vermögen beider Wege am Ende (nominal und Kaufkraft), Break-even-Jahr, Rate, Kaufnebenkosten und Kipppunkte (ab welchem Wert eines Hebels sich die Antwort dreht). Felder in describe unter buy_vs_rent_fields; wichtig sind price, rent, equity, interest. Mit scenarios bis zu 8 Varianten nebeneinander.',
      inputSchema: {
        link: z.string().optional().describe('Optional: Teilen-Link aus dem Rechner (…/kaufen-mieten#k=…) als Ausgangspunkt, sonst Standardwerte.'),
        changes: z.record(z.string(), z.unknown()).optional().describe('Abweichungen, z. B. { "price": 450000, "rent": 1400, "equity": 90000, "interest": 3.8, "state": "NW", "totalReturn": 6 }. Bei scenarios gemeinsam für alle.'),
        scenarios: z.array(z.object({ name: z.string(), changes: z.record(z.string(), z.unknown()).optional() })).max(8).optional(),
        detail: z.enum(['summary', 'years']).optional(),
        tipping_points: z.boolean().optional().describe('Kipppunkte berechnen; Standard: ja bei einer Rechnung, nein bei scenarios.'),
      },
      annotations: ro,
    },
    wrap((a) => tools.buyVsRent(a)),
  );

  if (!opts.remote) {
    server.registerTool(
      'plans',
      {
        title: 'Pläne verwalten',
        description:
          'Gespeicherte Pläne: list, get (name, sonst Standardplan), save (name; Konfiguration aus base + changes, z. B. base "result:r3"), delete, set_default, import_link (link = Teilen-Link aus der App, wird Standardplan wenn make_default nicht false).',
        inputSchema: {
          action: z.enum(['list', 'get', 'save', 'delete', 'set_default', 'import_link']),
          name: z.string().optional(),
          link: z.string().optional(),
          base,
          changes,
          make_default: z.boolean().optional(),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      },
      wrap((a) => tools.plans(a)),
    );
  }

  server.registerResource(
    'model',
    'wealth-sim://model',
    { title: 'Modell und Annahmen', description: 'Wie der Simulator rechnet', mimeType: 'text/markdown' },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: MODEL_NOTES }] }),
  );

  return server;
}
