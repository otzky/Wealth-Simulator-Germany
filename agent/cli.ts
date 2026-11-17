import { readFileSync } from 'node:fs';
import { InputError } from './scenario';
import { main as serve } from './server';
import { dataDir, FilePlanStore } from './store';
import { AgentTools } from './tools';

const HELP = `Vermögens-Simulator – Kommandozeile und MCP-Server

  wealth-sim mcp                         MCP-Server über stdio starten
  wealth-sim describe                    Felder und Modell
  wealth-sim simulate    [JSON]          { base?, changes?, detail? }
  wealth-sim monte_carlo [JSON]          { base?, changes?, runs?, volatility?, seed?, safe_probability? }
  wealth-sim solve       JSON            { target, base?, changes?, probability?, variable? }
  wealth-sim compare     JSON            { scenarios: [{ name, base?, changes? }], monte_carlo? }
  wealth-sim plans       JSON            { action, name?, link?, base?, changes?, make_default? }
  wealth-sim import "<Teilen-Link>" [Name]

JSON als Argument, mit @datei.json oder "-" für stdin.
Pläne liegen in ${dataDir()} (WEALTH_SIM_HOME ändert das).`;

function parse(arg: string | undefined): Record<string, unknown> {
  if (!arg) return {};
  const text = arg === '-' ? readFileSync(0, 'utf8') : arg.startsWith('@') ? readFileSync(arg.slice(1), 'utf8') : arg;
  try {
    return JSON.parse(text);
  } catch {
    throw new InputError('Ungültiges JSON.');
  }
}

async function run(argv: string[]) {
  const [cmd, arg, extra] = argv;
  if (cmd === 'mcp') return serve();
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log(HELP);
    return;
  }
  const t = new AgentTools(new FilePlanStore());
  const a = parse(cmd === 'import' ? undefined : arg) as never;
  const out =
    cmd === 'describe' ? t.describe()
    : cmd === 'simulate' ? t.simulate(a)
    : cmd === 'monte_carlo' ? t.monteCarlo(a)
    : cmd === 'solve' ? t.solve(a)
    : cmd === 'compare' ? t.compare(a)
    : cmd === 'plans' ? t.plans(a)
    : cmd === 'import' ? t.plans({ action: 'import_link', link: arg, name: extra })
    : null;
  if (out == null) throw new InputError(`Unbekannter Befehl „${cmd}“. wealth-sim help zeigt alle.`);
  console.log(JSON.stringify(out, null, 2));
}

run(process.argv.slice(2)).catch((e) => {
  console.error(e instanceof InputError ? e.message : e);
  process.exit(1);
});
