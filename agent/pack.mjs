// Builds the Claude Desktop extension: dist-agent/wealth-simulator.mcpb (install by double-click).
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const dir = 'dist-agent/mcpb';
rmSync(dir, { recursive: true, force: true });
mkdirSync(join(dir, 'server'), { recursive: true });
execFileSync(process.execPath, ['agent/build.mjs'], { stdio: 'inherit' });
copyFileSync('dist-agent/wealth-sim.mjs', join(dir, 'server', 'wealth-sim.mjs'));

const tool = (name, description) => ({ name, description });
const manifest = {
  manifest_version: '0.3',
  name: 'wealth-simulator-germany',
  display_name: 'Vermögens-Simulator (Deutschland)',
  version: pkg.version,
  description: 'ETF-Sparplan und Entnahme mit deutschen Steuern rechnen, Szenarien vergleichen, Monte Carlo.',
  long_description:
    'Rechnet Vermögensaufbau und Entnahme mit ETFs nach deutschem Steuerrecht (Abgeltungsteuer, Teilfreistellung, Vorabpauschale, FIFO), mit Ereignissen wie Immobilienkauf oder Erbschaft und einer Monte-Carlo-Simulation auf Basis eines Regime-Modells des MSCI World. Neue Rechnungen brauchen nur Alter, Startkapital, Sparrate und Rendite. Läuft vollständig lokal. Modellrechnung, keine Anlageberatung.',
  author: { name: 'otzky', url: 'https://github.com/otzky' },
  repository: { type: 'git', url: 'https://github.com/otzky/Wealth-Simulator-Germany' },
  homepage: 'https://github.com/otzky/Wealth-Simulator-Germany',
  keywords: ['finanzen', 'etf', 'sparplan', 'entnahme', 'steuern', 'monte carlo'],
  server: {
    type: 'node',
    entry_point: 'server/wealth-sim.mjs',
    mcp_config: {
      command: 'node',
      args: ['${__dirname}/server/wealth-sim.mjs', 'mcp'],
      env: { WEALTH_SIM_APP_URL: '${user_config.app_url}', WEALTH_SIM_HOME: '${user_config.data_dir}' },
    },
  },
  tools: [
    tool('describe', 'Felder und Modellannahmen'),
    tool('simulate', 'Plan ohne Marktschwankungen rechnen'),
    tool('monte_carlo', 'Marktverläufe simulieren, Erfolgsquote, sichere Entnahme'),
    tool('solve', 'Entnahme, sichere Entnahme oder nötige Sparrate berechnen'),
    tool('compare', 'Szenarien nebeneinander rechnen'),
    tool('plans', 'Pläne speichern, laden und aus der App übernehmen'),
  ],
  user_config: {
    app_url: {
      type: 'string',
      title: 'Adresse der Simulator-App',
      description: 'Für die Links, die ein Szenario in der App öffnen. Leer lassen für http://localhost:3000/.',
      required: false,
      default: '',
    },
    data_dir: {
      type: 'directory',
      title: 'Ordner für gespeicherte Pläne',
      description: 'Leer lassen für .wealth-simulator im Benutzerordner.',
      required: false,
    },
  },
  compatibility: { platforms: ['win32', 'darwin', 'linux'], runtimes: { node: '>=20.0.0' } },
};
writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
const cli = join('node_modules', '@anthropic-ai', 'mcpb', 'dist', 'cli', 'cli.js');
execFileSync(process.execPath, [cli, 'validate', join(dir, 'manifest.json')], { stdio: 'inherit' });
execFileSync(process.execPath, [cli, 'pack', dir, 'dist-agent/wealth-simulator.mcpb'], { stdio: 'inherit' });
