import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Download, Flag } from 'lucide-react';
import type { GoalResult, SimulationConfig, SimulationResult, ValueBasis } from '../types';
import { formatEuro, formatEuroCompact, formatNumber, formatPercent } from '../lib/format';
import { downloadCsv } from '../lib/export';
import { Button, Card, CardHeader, Hint, Segmented, cx } from './ui';
import { DividendChart, LegendItem, WealthChart, type DividendPoint, type WealthPoint } from './Charts';

interface Props {
  config: SimulationConfig;
  result: SimulationResult;
  low: SimulationResult | null;
  high: SimulationResult | null;
  goal: GoalResult | null;
  basis: ValueBasis;
  onBasisChange: (b: ValueBasis) => void;
  stale: boolean;
}

export default function Results({ config, result, low, high, goal, basis, onBasisChange, stale }: Props) {
  const { summary: s, rows } = result;
  const real = basis === 'real';

  const wealthData = useMemo<WealthPoint[]>(
    () =>
      rows.map((r, i) => {
        const d = real ? r.deflator : 1;
        const lo = low?.rows[i]?.valueEnd;
        const hi = high?.rows[i]?.valueEnd;
        return {
          year: r.year,
          age: r.age,
          value: r.valueEnd / d,
          invested: real ? r.realInvestedTotal : r.investedTotal,
          band: lo != null && hi != null ? [lo / d, hi / d] : undefined,
        };
      }),
    [rows, low, high, real],
  );

  const dividendData = useMemo<DividendPoint[]>(
    () =>
      rows.map((r) => ({
        year: r.year,
        age: r.age,
        monthly: real ? r.realMonthlyDividendNet : r.monthlyDividendNet,
        annual: real ? r.realDividendsNet : r.dividendsNet,
        gross: r.dividendsGross / (real ? r.deflator : 1),
        partial: r.months < 12,
      })),
    [rows, real],
  );

  const value = real ? s.valueReal : s.valueNominal;
  const invested = real ? s.investedReal : s.invested;
  const afterSale = real ? s.valueAfterSaleReal : s.valueAfterSale;
  const monthlyDiv = real ? s.finalMonthlyDividendNetReal : s.finalMonthlyDividendNet;
  const multiple = invested > 0 ? value / invested : 0;
  const hasDividends = config.dividendYield > 0;

  const wealthTarget = goal && config.goal.wealth && config.goal.wealthBasis === basis ? config.goal.wealth : null;
  const divTarget = goal && config.goal.monthlyDividend && config.goal.dividendBasis === basis ? config.goal.monthlyDividend : null;

  return (
    <div className={cx('space-y-5 transition-opacity', stale && 'opacity-70')}>
      {/* Hero */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3 sm:px-6">
          <p className="text-[13px] text-ink-2">
            Ergebnis nach <span className="tnum font-medium text-ink">{formatYears(s.months)}</span> · Ende {s.endYear} mit{' '}
            <span className="tnum font-medium text-ink">{s.endAge} Jahren</span>
          </p>
          <Segmented
            aria-label="Betrachtung"
            size="sm"
            value={basis}
            onChange={onBasisChange}
            options={[
              { value: 'nominal', label: 'Nominal' },
              { value: 'real', label: 'Kaufkraft heute' },
            ]}
          />
        </div>
        <div className="grid gap-6 px-5 py-6 sm:px-6 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <div>
            <p className="text-[13px] font-medium text-muted">{real ? 'Depotwert in heutiger Kaufkraft' : 'Depotwert am Ende'}</p>
            <p className="mt-1 text-[40px] leading-none font-semibold tracking-tight text-ink sm:text-[52px]">{formatEuro(value)}</p>
            <p className="mt-3 text-[14px] text-ink-2">
              Nach Verkauf und Steuern: <span className="tnum font-medium text-ink">{formatEuro(afterSale)}</span>
              {real && (
                <span className="text-muted"> · nominal {formatEuroCompact(s.valueNominal)}</span>
              )}
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-3">
            <MiniStat label="Eingezahlt" value={formatEuroCompact(invested)} swatch="var(--series-2)" />
            <MiniStat label="Wertzuwachs" value={formatEuroCompact(value - invested)} swatch="var(--series-1)" />
            <MiniStat label="Faktor" value={`${formatNumber(Math.round(multiple * 10) / 10)}×`} />
          </dl>
        </div>
      </Card>

      {goal && <GoalCard goal={goal} config={config} />}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi
          label="Netto-Dividende / Monat"
          hint="Durchschnitt der letzten 12 Monate, nach Steuern."
          value={formatEuro(monthlyDiv)}
          sub={hasDividends ? 'am Ende der Laufzeit' : 'keine Ausschüttung'}
        />
        <Kpi
          label="Dividenden gesamt"
          value={formatEuroCompact(real ? s.dividendsNetReal : s.dividendsNet)}
          sub={config.reinvestDividends ? 'netto, reinvestiert' : 'netto, ausgezahlt'}
        />
        <Kpi
          label="Steuern laufend"
          hint="Auf Ausschüttungen und Vorabpauschale gezahlte Steuern während der Laufzeit (nominal)."
          value={formatEuroCompact(s.taxesPaid)}
          sub={`+ ${formatEuroCompact(s.saleTax)} bei Verkauf`}
        />
        <Kpi
          label="Kosten gesamt"
          hint="Kaufgebühren und laufende Fondskosten (TER) über die gesamte Laufzeit (nominal)."
          value={formatEuroCompact(s.costsPaid)}
          sub={invested > 0 ? `${formatPercent((s.costsPaid / s.invested) * 100)} der Einzahlungen` : '—'}
        />
      </div>

      {/* Wealth chart */}
      <Card>
        <CardHeader
          title="Vermögensentwicklung"
          subtitle={real ? 'In heutiger Kaufkraft' : 'Nominal, vor Steuern bei Verkauf'}
        />
        <div className="flex flex-wrap gap-x-5 gap-y-2 px-5 pt-3 sm:px-6">
          <LegendItem color="var(--series-1)" label="Depotwert" />
          <LegendItem color="var(--series-2)" label="Einzahlungen" variant="line" />
          {config.returnSpread > 0 && <LegendItem color="var(--series-1)" label={`Bandbreite ±${formatNumber(config.returnSpread)} %-Pkt.`} variant="band" />}
        </div>
        <div className="px-2 pt-2 pb-4 sm:px-4">
          <WealthChart data={wealthData} target={wealthTarget} spread={config.returnSpread} />
        </div>
      </Card>

      <div className="grid gap-5 2xl:grid-cols-[1.4fr_1fr]">
        {/* Dividend chart */}
        <Card>
          <CardHeader
            title="Netto-Dividende pro Monat"
            subtitle={hasDividends ? `Ø je Jahr${real ? ', in heutiger Kaufkraft' : ''}` : 'Bei 0 % Ausschüttung fallen keine Dividenden an.'}
          />
          <div className="px-2 pt-2 pb-4 sm:px-4">
            <DividendChart data={dividendData} target={divTarget} />
          </div>
        </Card>

        <BalanceSheet config={config} result={result} />
      </div>

      <YearTable config={config} result={result} real={real} />

      <p className="px-1 text-xs leading-relaxed text-muted">
        Modellrechnung mit konstanten Annahmen, keine Anlageberatung. Steuern vereinfacht: Abgeltungsteuer mit Teilfreistellung,
        Sparerpauschbetrag und optionaler Vorabpauschale. Die Steuer auf die Vorabpauschale wird aus dem Depot entnommen.
        Verluste, Günstigerprüfung und Änderungen der Steuergesetze sind nicht berücksichtigt. Vergangene Renditen sind kein
        verlässlicher Indikator für die Zukunft.
      </p>
    </div>
  );
}

function formatYears(months: number) {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (!m) return `${y} ${y === 1 ? 'Jahr' : 'Jahren'}`;
  return `${y} J. ${m} Mon.`;
}

function MiniStat({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-xs text-muted">
        {swatch && <span className="size-2 rounded-sm" style={{ background: swatch }} />}
        {label}
      </dt>
      <dd className="mt-1 text-[15px] font-semibold text-ink">{value}</dd>
    </div>
  );
}

function Kpi({ label, value, sub, hint }: { label: string; value: string; sub?: string; hint?: string }) {
  return (
    <Card className="px-4 py-4">
      <p className="flex items-center gap-1.5 text-[13px] text-muted">
        {label}
        {hint && <Hint>{hint}</Hint>}
      </p>
      <p className="mt-1.5 text-[22px] leading-tight font-semibold tracking-tight text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </Card>
  );
}

function GoalCard({ goal, config }: { goal: GoalResult; config: SimulationConfig }) {
  const met = (goal.wealthProgress ?? 1) >= 1 && (goal.dividendProgress ?? 1) >= 1;
  const unit = goal.variable === 'return' ? 'return' : 'eur';
  const fmt = (v: number) => (unit === 'return' ? formatPercent(v) : formatEuro(v));
  const what = goal.variable === 'savings' ? 'Sparrate pro Monat' : goal.variable === 'initial' ? 'Startkapital' : 'Rendite p. a.';

  return (
    <Card className="overflow-hidden">
      <div className="grid gap-5 px-5 py-5 sm:px-6 xl:grid-cols-[minmax(240px,auto)_1fr] xl:items-center">
        <div className="flex items-center gap-3">
          <span
            className={cx(
              'flex size-10 items-center justify-center rounded-xl',
              met ? 'bg-good-soft text-good' : 'bg-accent-soft text-accent',
            )}
          >
            {met ? <CheckCircle2 size={20} /> : <Flag size={20} />}
          </span>
          <div>
            <p className="text-[15px] font-semibold text-ink">{met ? 'Ziel erreicht' : 'Ziel noch nicht erreicht'}</p>
            <p className="text-[13px] text-muted">
              {goal.reachedYear != null ? `Mit dem aktuellen Plan ab ${goal.reachedYear} (Alter ${goal.reachedAge})` : 'Mit dem aktuellen Plan nicht innerhalb der Laufzeit'}
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
          {goal.wealthProgress != null && (
            <Progress label={`Vermögen (${config.goal.wealthBasis === 'real' ? 'Kaufkraft' : 'nominal'})`} value={goal.wealthProgress} target={formatEuroCompact(config.goal.wealth ?? 0)} />
          )}
          {goal.dividendProgress != null && (
            <Progress label={`Dividende/Monat (${config.goal.dividendBasis === 'real' ? 'Kaufkraft' : 'nominal'})`} value={goal.dividendProgress} target={formatEuro(config.goal.monthlyDividend ?? 0)} />
          )}
          <div className="rounded-xl bg-surface-2 px-4 py-3 sm:min-w-52">
            <p className="text-xs text-muted">Benötigte {what}</p>
            {goal.required != null ? (
              <>
                <p className="tnum mt-0.5 text-[20px] font-semibold text-ink">{fmt(goal.required)}</p>
                <p className="text-xs text-muted">
                  aktuell {fmt(goal.currentValue)}
                  {goal.required > goal.currentValue ? ` · +${fmt(goal.required - goal.currentValue)}` : ''}
                </p>
              </>
            ) : (
              <p className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-critical">
                <AlertTriangle size={14} /> Nicht realistisch erreichbar
              </p>
            )}
            {goal.variable === 'savings' && goal.hasSteps && goal.required != null && (
              <p className="mt-1 text-[11px] leading-snug text-muted">Konstante Rate, ohne geplante Änderungen</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Progress({ label, value, target }: { label: string; value: number; target: string }) {
  const pct = Math.min(1, Math.max(0, value));
  const done = value >= 1;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="truncate text-ink-2">{label}</span>
        <span className="tnum font-medium whitespace-nowrap text-ink">{Math.round(value * 100)} %</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={cx('h-full rounded-full transition-all', done ? 'bg-good' : 'bg-accent')} style={{ width: `${pct * 100}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted">Ziel: {target}</p>
    </div>
  );
}

function BalanceSheet({ config, result }: { config: SimulationConfig; result: SimulationResult }) {
  const s = result.summary;
  const lines: { label: string; value: number; kind?: 'sum' | 'minus' | 'info'; hint?: string }[] = [
    { label: 'Einzahlungen', value: s.invested },
    { label: 'Wertzuwachs', value: s.growth, hint: 'Kursgewinne und reinvestierte Dividenden, nach Kosten und laufenden Steuern.' },
    { label: 'Depotwert', value: s.valueNominal, kind: 'sum' },
    { label: 'Steuer bei Verkauf', value: -s.saleTax, kind: 'minus', hint: 'Abgeltungsteuer auf den noch unversteuerten Gewinn, nach Teilfreistellung und Freibetrag.' },
    { label: 'Netto nach Verkauf', value: s.valueAfterSale, kind: 'sum' },
  ];
  const info = [
    { label: 'Kosten (Gebühren + TER)', value: s.costsPaid },
    { label: 'Steuern laufend', value: s.taxesPaid },
    ...(!config.reinvestDividends ? [{ label: 'Ausgezahlte Dividenden (netto)', value: s.dividendsNet }] : []),
    { label: 'Kaufkraftverlust durch Inflation', value: s.valueAfterSale - s.valueAfterSaleReal },
  ];
  return (
    <Card>
      <CardHeader title="Bilanz" subtitle={`Nominal, Ende ${s.endYear}`} />
      <div className="px-5 pt-3 pb-5 sm:px-6">
        <dl className="text-[14px]">
          {lines.map((l) => (
            <div
              key={l.label}
              className={cx(
                'flex items-center justify-between gap-3 py-2',
                l.kind === 'sum' && 'border-t border-line font-semibold text-ink',
                l.kind !== 'sum' && 'text-ink-2',
              )}
            >
              <dt className="flex items-center gap-1.5">
                {l.label}
                {l.hint && <Hint>{l.hint}</Hint>}
              </dt>
              <dd className={cx('tnum', l.kind === 'minus' && 'text-critical')}>
                {l.kind === 'minus' ? '− ' + formatEuro(-l.value) : (l.kind === 'sum' ? '' : l.value >= 0 && l.label !== 'Einzahlungen' ? '+ ' : '') + formatEuro(l.value)}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 space-y-1.5 rounded-xl bg-surface-2 px-4 py-3 text-[13px]">
          <p className="text-xs font-medium text-muted">Zum Vergleich</p>
          {info.map((l) => (
            <div key={l.label} className="flex justify-between gap-3 text-ink-2">
              <span>{l.label}</span>
              <span className="tnum">{formatEuro(l.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function YearTable({ config, result, real }: { config: SimulationConfig; result: SimulationResult; real: boolean }) {
  const [open, setOpen] = useState(false);
  const rows = result.rows;
  const visible = open ? rows : rows.slice(0, 8);
  return (
    <Card>
      <CardHeader
        title="Jahresübersicht"
        subtitle={`${rows.length} Kalenderjahre · Dividenden ${real ? 'in Kaufkraft' : 'nominal'}`}
        actions={
          <Button size="sm" onClick={() => downloadCsv(config, result)}>
            <Download size={14} /> CSV
          </Button>
        }
      />
      <div className="mt-4 overflow-x-auto">
        <table className="tnum w-full min-w-[820px] text-right text-[13px]">
          <thead>
            <tr className="border-y border-line bg-surface-2 text-xs text-muted">
              <th className="px-4 py-2.5 text-left font-medium sm:pl-6">Jahr</th>
              <th className="px-3 py-2.5 text-left font-medium">Alter</th>
              <th className="px-3 py-2.5 font-medium">Einzahlung</th>
              <th className="px-3 py-2.5 font-medium">Eingezahlt</th>
              <th className="px-3 py-2.5 font-medium">Depotwert</th>
              <th className="px-3 py-2.5 font-medium">Kaufkraft</th>
              <th className="px-3 py-2.5 font-medium">Dividende</th>
              <th className="px-3 py-2.5 font-medium">Ø Monat</th>
              <th className="px-3 py-2.5 font-medium">Steuern</th>
              <th className="px-4 py-2.5 font-medium sm:pr-6">Kosten</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.year} className="border-b border-line text-ink-2 last:border-b-0 hover:bg-surface-2/60">
                <td className="px-4 py-2.5 text-left font-medium text-ink sm:pl-6">
                  {r.year}
                  {r.months < 12 && <span className="ml-1 text-xs font-normal text-muted">({r.months} M.)</span>}
                </td>
                <td className="px-3 py-2.5 text-left">{r.age}</td>
                <td className="px-3 py-2.5">{formatEuro(r.contributions)}</td>
                <td className="px-3 py-2.5">{formatEuro(r.investedTotal)}</td>
                <td className="px-3 py-2.5 font-medium text-ink">{formatEuro(r.valueEnd)}</td>
                <td className="px-3 py-2.5">{formatEuro(r.realValueEnd)}</td>
                <td className="px-3 py-2.5">{formatEuro(real ? r.realDividendsNet : r.dividendsNet)}</td>
                <td className="px-3 py-2.5">{formatEuro(real ? r.realMonthlyDividendNet : r.monthlyDividendNet)}</td>
                <td className="px-3 py-2.5">{formatEuro(r.taxes)}</td>
                <td className="px-4 py-2.5 sm:pr-6">{formatEuro(r.costs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 8 && (
        <div className="border-t border-line px-5 py-2 sm:px-6">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {open ? 'Weniger anzeigen' : `Alle ${rows.length} Jahre anzeigen`}
            <ChevronDown size={14} className={cx('transition-transform', open && 'rotate-180')} />
          </button>
        </div>
      )}
    </Card>
  );
}
