import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, FileImage, FileSpreadsheet, FileText, Link2, Monitor, Moon, RotateCcw, Share2, SlidersHorizontal, Sun } from 'lucide-react';
import type { SimulationConfig, ValueBasis } from './types';
import { defaultConfig } from './defaults';
import { runSimulation } from './lib/simulation';
import { evaluateGoal } from './lib/goal';
import { clearShareHash, loadInitialConfig, saveConfig, shareUrl } from './lib/storage';
import { downloadCsv, exportElement } from './lib/export';
import { formatEuro, formatPercent } from './lib/format';
import SettingsPanel from './components/SettingsPanel';
import Results from './components/Results';
import { Button, Card, IconButton, cx } from './components/ui';

type Theme = 'system' | 'light' | 'dark';

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const t = localStorage.getItem('vs-theme');
      return t === 'light' || t === 'dark' ? t : 'system';
    } catch {
      return 'system';
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      if (theme === 'system') localStorage.removeItem('vs-theme');
      else localStorage.setItem('vs-theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  return [theme, setTheme] as const;
}

export default function App() {
  const [config, setConfig] = useState<SimulationConfig>(loadInitialConfig);
  const [basis, setBasis] = useState<ValueBasis>('nominal');
  const [theme, setTheme] = useTheme();
  const [toast, setToast] = useState<string | null>(null);
  const [mobileSettings, setMobileSettings] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => clearShareHash(), []);
  useEffect(() => saveConfig(config), [config]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const patch = useCallback((p: Partial<SimulationConfig>) => setConfig((c) => ({ ...c, ...p })), []);

  // Heavy work runs on a deferred copy so typing and sliders stay smooth.
  const deferred = useDeferredValue(config);
  const stale = deferred !== config;
  const result = useMemo(() => runSimulation(deferred), [deferred]);
  const band = useMemo(() => {
    if (deferred.returnSpread <= 0) return { low: null, high: null };
    return {
      low: runSimulation({ ...deferred, totalReturn: deferred.totalReturn - deferred.returnSpread }),
      high: runSimulation({ ...deferred, totalReturn: deferred.totalReturn + deferred.returnSpread }),
    };
  }, [deferred]);
  const goal = useMemo(() => evaluateGoal(deferred, result), [deferred, result]);

  const share = async () => {
    const url = shareUrl(config);
    try {
      await navigator.clipboard.writeText(url);
      setToast('Link kopiert – er enthält alle Einstellungen.');
    } catch {
      window.prompt('Link zum Teilen:', url);
    }
  };

  const doExport = async (type: 'png' | 'pdf' | 'csv') => {
    if (type === 'csv') return downloadCsv(config, result);
    if (!reportRef.current) return;
    setToast(type === 'pdf' ? 'PDF wird erstellt …' : 'Bild wird erstellt …');
    try {
      await exportElement(reportRef.current, type);
      setToast('Export fertig.');
    } catch (e) {
      console.error(e);
      setToast('Export fehlgeschlagen.');
    }
  };

  const reset = () => {
    setConfig(defaultConfig());
    setToast('Auf Standardwerte zurückgesetzt.');
  };

  const assumptions = [
    `${formatEuro(config.initialCapital)} Start`,
    `${formatEuro(config.monthlySavings)}/Monat${config.savingsGrowth ? ` +${formatPercent(config.savingsGrowth)} p. a.` : ''}`,
    `${formatPercent(config.totalReturn)} Rendite`,
    `${formatPercent(config.inflation)} Inflation`,
    `${formatPercent(config.ter)} TER`,
    ...(config.dividendYield > 0 && config.dividendStrategy !== 'reinvest'
      ? [
          config.dividendStrategy === 'payout'
            ? 'Dividenden ausgezahlt'
            : config.dividendStrategy === 'fromYear'
              ? `Dividenden ab ${config.dividendPayoutYear} ausgezahlt`
              : config.withdrawal.enabled
                ? `Dividenden ab ${config.withdrawal.startYear} ausgezahlt`
                : 'Dividenden reinvestiert',
        ]
      : []),
    ...(config.withdrawal.enabled
      ? [
          `Entnahme ab ${config.withdrawal.startYear}: ${
            config.withdrawal.mode === 'fixed' ? `${formatEuro(config.withdrawal.monthlyNet)}/Monat` : `${formatPercent(config.withdrawal.rate)} p. a.`
          }`,
        ]
      : []),
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Logo />
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-semibold tracking-tight text-ink">Vermögens-Simulator</h1>
              <p className="hidden truncate text-xs text-muted sm:block">Sparplan, Dividenden & deutsche Steuern</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="hidden md:block">
              <Button variant="ghost" onClick={reset}>
                <RotateCcw size={15} /> Zurücksetzen
              </Button>
            </div>
            <div className="hidden sm:block">
              <Button variant="secondary" onClick={share}>
                <Share2 size={15} /> Teilen
              </Button>
            </div>
            <IconButton label="Link teilen" onClick={share} className="sm:hidden">
              <Link2 size={17} />
            </IconButton>
            <ExportMenu onExport={doExport} />
            <ThemeToggle theme={theme} onChange={setTheme} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(340px,380px)_minmax(0,1fr)] lg:items-start">
          <aside className="lg:sticky lg:top-24">
            <Card className="overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left lg:hidden"
                aria-expanded={mobileSettings}
                onClick={() => setMobileSettings((o) => !o)}
              >
                <span className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                  <SlidersHorizontal size={16} /> Einstellungen
                </span>
                <ChevronDown size={16} className={cx('text-muted transition-transform', mobileSettings && 'rotate-180')} />
              </button>
              <div className="hidden items-center justify-between border-b border-line px-5 py-4 lg:flex">
                <span className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                  <SlidersHorizontal size={16} /> Einstellungen
                </span>
                <span className="text-xs text-muted">Automatisch gespeichert</span>
              </div>
              <div className={cx('scroll-thin border-t border-line lg:block lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto lg:border-t-0', !mobileSettings && 'hidden')}>
                <SettingsPanel config={config} onChange={patch} />
              </div>
            </Card>
          </aside>

          <section ref={reportRef} className="min-w-0 space-y-4" aria-live="polite">
            <div className="flex flex-wrap gap-1.5">
              {assumptions.map((a) => (
                <span key={a} className="tnum rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-2">
                  {a}
                </span>
              ))}
            </div>
            <Results
              config={deferred}
              result={result}
              low={band.low}
              high={band.high}
              goal={goal}
              basis={basis}
              onBasisChange={setBasis}
              stale={stale}
            />
          </section>
        </div>
      </main>

      <div
        role="status"
        className={cx(
          'pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 transition-all duration-200',
          toast ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        )}
      >
        {toast && (
          <div className="flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[13px] font-medium text-bg shadow-lg">
            <Check size={15} /> {toast}
          </div>
        )}
      </div>
    </div>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-9 shrink-0" aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M7 22l6-6 4 4 8-9" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="25" cy="11" r="2" fill="#fff" />
    </svg>
  );
}

function ExportMenu({ onExport }: { onExport: (t: 'png' | 'pdf' | 'csv') => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const items = [
    { type: 'pdf' as const, icon: <FileText size={16} />, label: 'PDF-Bericht' },
    { type: 'png' as const, icon: <FileImage size={16} />, label: 'Bild (PNG)' },
    { type: 'csv' as const, icon: <FileSpreadsheet size={16} />, label: 'Tabelle (CSV)' },
  ];

  return (
    <div ref={ref} className="relative">
      <Button variant="primary" onClick={() => setOpen((o) => !o)} aria-haspopup aria-expanded={open}>
        Export <ChevronDown size={14} className={cx('transition-transform', open && 'rotate-180')} />
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-card">
          {items.map((i) => (
            <button
              key={i.type}
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onExport(i.type);
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <span className="text-muted">{i.icon}</span>
              {i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ThemeToggle({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  const next: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
  const label: Record<Theme, string> = { system: 'Design: System', light: 'Design: Hell', dark: 'Design: Dunkel' };
  return (
    <IconButton label={`${label[theme]} (wechseln)`} onClick={() => onChange(next[theme])}>
      {theme === 'system' ? <Monitor size={17} /> : theme === 'light' ? <Sun size={17} /> : <Moon size={17} />}
    </IconButton>
  );
}
