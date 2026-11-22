import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Link2, Share2, SlidersHorizontal } from 'lucide-react';
import { ExportMenu, Logo, ModuleSwitcher, ThemeToggle, Toast, useTheme, type ModuleId } from '../components/Chrome';
import ScenarioMenu from '../components/ScenarioMenu';
import { Button, Card, IconButton, cx } from '../components/ui';
import { exportElement } from '../lib/export';
import { formatEuro, formatPercent } from '../lib/format';
import type { ValueBasis } from '../types';
import BuyRentResults from './BuyRentResults';
import BuyRentSettings from './BuyRentSettings';
import { defaultBuyRent, transferTaxRate } from './defaults';
import { simulateBuyRent, tippingPoints } from './engine';
import {
  buyRentShareUrl,
  clearBuyRentHash,
  deleteAllBuyRentScenarios,
  loadBuyRentScenarios,
  makeBuyRentScenario,
  saveBuyRentScenarios,
  uniqueBuyRentName,
  type BuyRentStore,
} from './storage';
import type { BuyRentConfig, BuyRentResult } from './types';

export default function BuyRentApp({ onSwitchModule }: { onSwitchModule: (id: ModuleId) => void }) {
  // Scenarios live only in this browser, apart from those of the wealth simulator.
  const [initial] = useState(loadBuyRentScenarios);
  const [store, setStore] = useState<BuyRentStore>(initial);
  const [config, setConfig] = useState<BuyRentConfig>(() => initial.items.find((i) => i.id === initial.activeId)!.config);
  const [basis, setBasis] = useState<ValueBasis>('nominal');
  const [theme, setTheme] = useTheme();
  const [toast, setToast] = useState<string | null>(null);
  const [mobileSettings, setMobileSettings] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => clearBuyRentHash(), []);
  useEffect(() => {
    setStore((st) => {
      const cur = st.items.find((i) => i.id === st.activeId);
      if (!cur || cur.config === config) return st;
      return { ...st, items: st.items.map((i) => (i.id === st.activeId ? { ...i, config, updatedAt: Date.now() } : i)) };
    });
  }, [config]);
  useEffect(() => saveBuyRentScenarios(store), [store]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const active = store.items.find((i) => i.id === store.activeId) ?? store.items[0];
  const patch = (p: Partial<BuyRentConfig>) => setConfig((c) => ({ ...c, ...p }));

  const deferred = useDeferredValue(config);
  const result = useMemo(() => simulateBuyRent(deferred), [deferred]);
  // The tipping points need a few hundred runs; they follow a little later.
  const slow = useDeferredValue(deferred);
  const tipping = useMemo(() => tippingPoints(slow), [slow]);

  const switchScenario = (id: string) => {
    const s = store.items.find((i) => i.id === id);
    if (!s || id === store.activeId) return;
    setStore((st) => ({ ...st, activeId: id }));
    setConfig(s.config);
  };
  const createScenario = (kind: 'blank' | 'copy') => {
    const s = makeBuyRentScenario(uniqueBuyRentName(store.items, kind === 'copy' ? `${active.name} (Kopie)` : 'Neues Szenario'), kind === 'copy' ? config : defaultBuyRent());
    setStore((st) => ({ activeId: s.id, items: [...st.items, s] }));
    setConfig(s.config);
    setToast(kind === 'copy' ? `Kopie „${s.name}“ angelegt.` : `„${s.name}“ angelegt – mit Standardwerten.`);
  };
  const renameScenario = (id: string, name: string) =>
    setStore((st) => ({ ...st, items: st.items.map((i) => (i.id === id ? { ...i, name: uniqueBuyRentName(st.items.filter((x) => x.id !== id), name) } : i)) }));
  const deleteScenario = (id: string) => {
    const rest = store.items.filter((i) => i.id !== id);
    const removed = store.items.find((i) => i.id === id);
    if (!rest.length) {
      const fresh = makeBuyRentScenario('Meine Wohnung', defaultBuyRent());
      setStore({ activeId: fresh.id, items: [fresh] });
      setConfig(fresh.config);
    } else if (id === store.activeId) {
      const next = [...rest].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      setStore({ activeId: next.id, items: rest });
      setConfig(next.config);
    } else {
      setStore((st) => ({ ...st, items: st.items.filter((i) => i.id !== id) }));
    }
    setToast(`„${removed?.name}“ gelöscht.`);
  };
  const deleteAll = () => {
    deleteAllBuyRentScenarios();
    const fresh = makeBuyRentScenario('Meine Wohnung', defaultBuyRent());
    setStore({ activeId: fresh.id, items: [fresh] });
    setConfig(fresh.config);
    setToast('Alle Szenarien dieses Rechners wurden aus dem Browser gelöscht.');
  };
  const reset = () => {
    setConfig(defaultBuyRent());
    setToast(`„${active.name}“ auf Standardwerte zurückgesetzt.`);
  };

  const share = async () => {
    const url = buyRentShareUrl(config);
    try {
      await navigator.clipboard.writeText(url);
      setToast('Link kopiert – er enthält alle Einstellungen.');
    } catch {
      window.prompt('Link zum Kopieren:', url);
    }
  };
  const csv = () => downloadCsv(config, result);
  const doExport = async (type: 'png' | 'pdf' | 'csv') => {
    if (type === 'csv') return csv();
    if (!reportRef.current) return;
    setToast(type === 'pdf' ? 'PDF wird erstellt …' : 'Bild wird erstellt …');
    try {
      await exportElement(reportRef.current, type);
      setToast('Export fertig.');
    } catch {
      setToast('Export fehlgeschlagen.');
    }
  };

  const assumptions = [
    `${formatEuro(config.price)} Kaufpreis`,
    `${formatEuro(config.equity)} Eigenkapital`,
    `${formatPercent(config.interest)} Zins, ${formatPercent(config.repayment)} Tilgung, ${config.fixedYears} J. fest`,
    ...(config.followUpRate != null ? [`Anschlusszins ${formatPercent(config.followUpRate)}`] : []),
    `Grunderwerbsteuer ${formatPercent(transferTaxRate(config.state))}`,
    `${formatPercent(config.maintenance)} Instandhaltung`,
    `${formatPercent(config.appreciation)} Wertsteigerung`,
    `${formatEuro(config.rent)} Kaltmiete +${formatPercent(config.rentIncrease)} p. a.`,
    `${formatPercent(config.invest.totalReturn)} Rendite der Anlage`,
    `${formatPercent(config.inflation)} Inflation`,
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Logo />
            <div className="hidden min-w-0 md:block">
              <ModuleSwitcher current="buyrent" onSwitch={onSwitchModule} />
            </div>
            <span className="hidden h-7 w-px bg-line md:block" aria-hidden />
            <ScenarioMenu
              items={store.items}
              activeId={active.id}
              onSwitch={switchScenario}
              onCreate={createScenario}
              onRename={renameScenario}
              onDelete={deleteScenario}
              onDeleteAll={deleteAll}
              onReset={reset}
            />
          </div>
          <div className="flex items-center gap-1.5">
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
        <div className="border-t border-line px-4 py-1.5 md:hidden">
          <ModuleSwitcher current="buyrent" onSwitch={onSwitchModule} />
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
                <span className="truncate pl-3 text-xs text-muted">Automatisch gespeichert</span>
              </div>
              <div className={cx('scroll-thin border-t border-line lg:block lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto lg:border-t-0', !mobileSettings && 'hidden')}>
                <BuyRentSettings config={config} onChange={patch} />
              </div>
            </Card>
          </aside>

          <section ref={reportRef} className="min-w-0 space-y-4" aria-live="polite">
            <div className="export-only flex-wrap gap-1.5">
              {assumptions.map((a) => (
                <span key={a} className="tnum rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-2">
                  {a}
                </span>
              ))}
            </div>
            <BuyRentResults
              config={deferred}
              result={result}
              tipping={slow === deferred ? tipping : null}
              basis={basis}
              onBasis={setBasis}
              onCsv={csv}
            />
            <p className="pt-2 text-center text-xs text-muted">Modellrechnung mit konstanten Annahmen, keine Anlage-, Finanzierungs- oder Steuerberatung.</p>
          </section>
        </div>
      </main>
      <Toast message={toast} />
    </div>
  );
}

function downloadCsv(cfg: BuyRentConfig, r: BuyRentResult) {
  const header = ['Jahr', 'Zinsen', 'Tilgung', 'Instandhaltung', 'Restschuld', 'Immobilienwert', 'Miete', 'Angelegt Kaufen', 'Angelegt Mieten', 'Depot Kaufen nach Steuern', 'Depot Mieten nach Steuern', 'Vermögen Kaufen', 'Vermögen Mieten', 'Vermögen Kaufen Kaufkraft', 'Vermögen Mieten Kaufkraft'];
  const n = (v: number) => v.toFixed(2).replace('.', ',');
  const lines = r.years.map((y) =>
    [y.year, y.interest, y.principal, y.maintenance, y.debt, y.propertyValue, y.rent, y.buyerInvested, y.renterInvested, y.buyerDepot, y.renterDepot, y.buyerWealth, y.renterWealth, y.buyerWealth / y.deflator, y.renterWealth / y.deflator]
      .map((v, i) => (i === 0 ? String(v) : n(v as number)))
      .join(';'),
  );
  const blob = new Blob(['﻿' + [header.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `kaufen-oder-mieten-${cfg.startYear}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
