import { useState, type ReactNode } from 'react';
import { AlertTriangle, ChevronDown, Download } from 'lucide-react';
import { Area, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatAxis, formatEuro, formatEuroCompact, formatNumber, formatPercent } from '../lib/format';
import { LegendItem } from '../components/Charts';
import { Button, Card, CardHeader, Hint, Segmented, cx } from '../components/ui';
import type { ValueBasis } from '../types';
import type { BuyRentConfig, BuyRentResult, BuyRentYear, TippingPoint } from './types';

const BUY = 'var(--series-2)';
const RENT = 'var(--series-1)';
const INVEST = 'var(--series-3)';
const axisTick = { fill: 'var(--muted)', fontSize: 12 };

interface Props {
  config: BuyRentConfig;
  result: BuyRentResult;
  tipping: TippingPoint[] | null;
  basis: ValueBasis;
  onBasis: (b: ValueBasis) => void;
  onCsv: () => void;
}

export default function BuyRentResults({ config: c, result: r, tipping, basis, onBasis, onCsv }: Props) {
  const real = basis === 'real';
  const v = (y: BuyRentYear, n: number) => (real ? n / y.deflator : n);
  const last = r.years[r.years.length - 1];
  const buyer = v(last, last.buyerWealth);
  const renter = v(last, last.renterWealth);
  const diff = buyer - renter;
  const buyWins = diff >= 0;
  const be = r.breakEven;

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3 sm:px-6">
          <p className="text-[13px] text-ink-2">
            Vergleich über <span className="font-medium text-ink">{c.years} Jahre</span> · {c.startYear}–{last.year}
          </p>
          <Segmented
            aria-label="Werte anzeigen als"
            size="sm"
            value={basis}
            onChange={onBasis}
            options={[
              { value: 'nominal', label: 'Nominal' },
              { value: 'real', label: 'Kaufkraft heute' },
            ]}
          />
        </div>
        <div className="grid gap-6 px-5 py-6 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-[13px] font-medium text-muted">Nach {c.years} Jahren liegt vorn</p>
            <p className="mt-1 text-[34px] leading-tight font-semibold tracking-tight text-ink sm:text-[40px]">
              {Math.abs(diff) < 500 ? 'Gleichstand' : buyWins ? 'Kaufen' : 'Mieten'}
              {Math.abs(diff) >= 500 && <span className="text-ink-2"> um <span className="whitespace-nowrap">{formatEuroCompact(Math.abs(diff))}</span></span>}
            </p>
            <p className="mt-2 text-[13px] text-ink-2">
              {be == null
                ? 'Kaufen holt im ganzen Zeitraum nicht auf.'
                : be === 1
                  ? 'Kaufen liegt vom ersten Jahr an vorn.'
                  : `Kaufen liegt ab Jahr ${be} (${c.startYear + be - 1}) dauerhaft vorn.`}{' '}
              Verglichen wird, als ob am Ende alles verkauft würde{real ? ', in heutiger Kaufkraft' : ''}.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <MiniStat swatch={BUY} label="Vermögen Kaufen" value={formatEuroCompact(buyer)} hint="Wert der Immobilie nach Verkaufskosten, minus Restschuld, plus angelegtes Geld nach Steuern." />
            <MiniStat swatch={RENT} label="Vermögen Mieten" value={formatEuroCompact(renter)} hint="Depot aus Eigenkapital und monatlicher Differenz, nach Steuern bei Verkauf." />
          </dl>
        </div>
        <div className="border-t border-line px-5 py-3 text-xs text-muted sm:px-6">
          Nicht eingerechnet: Sicherheit vor einer Eigenbedarfskündigung, Freiheit beim Umbauen, Flexibilität für einen Umzug und die eigene Zeit für Verwaltung und Reparaturen.
        </div>
      </Card>

      {r.warnings.map((w) => (
        <div key={w} className="flex gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-[13px] text-ink-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-critical" />
          {w}
        </div>
      ))}

      <Card>
        <CardHeader
          title="Vermögen im Vergleich"
          subtitle={real ? 'In heutiger Kaufkraft, jeweils als ob verkauft' : 'Nominal, jeweils als ob verkauft'}
        />
        <div className="px-3 pb-4 sm:px-5">
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 px-2 text-xs text-ink-2">
            <LegendItem color={BUY} label="Kaufen" variant="line" />
            <LegendItem color={RENT} label="Mieten" variant="line" />
            {be != null && be > 1 && <LegendItem color="var(--ink-2)" label="Break-even" variant="dashed" />}
          </div>
          <WealthCompare config={c} result={r} real={real} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Wohnkosten pro Monat" subtitle="Ø je Jahr, nominal · die Differenz legt die günstigere Seite an" />
        <div className="px-3 pb-4 sm:px-5">
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 px-2 text-xs text-ink-2">
            <LegendItem color={BUY} label="Kaufen: Rate + Instandhaltung" variant="line" />
            <LegendItem color={RENT} label="Mieten: Kaltmiete" variant="line" />
            <LegendItem color={INVEST} label="Differenz, wird angelegt" />
          </div>
          <BurdenChart result={r} />
        </div>
      </Card>

      <div className="grid gap-5 2xl:grid-cols-2">
        <TippingCard config={c} result={r} tipping={tipping} />
        <Balance config={c} result={r} />
      </div>

      <YearTable result={r} real={real} onCsv={onCsv} />
    </div>
  );
}

function MiniStat({ label, value, swatch, hint }: { label: string; value: string; swatch?: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5 lg:min-w-[9.5rem]">
      <dt className="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted">
        {swatch && <span className="size-2 rounded-sm" style={{ background: swatch }} />}
        {label}
        {hint && <Hint>{hint}</Hint>}
      </dt>
      <dd className="mt-1 text-[15px] font-semibold text-ink">{value}</dd>
    </div>
  );
}

function TooltipShell({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-52 rounded-xl border border-line bg-surface px-3.5 py-3 text-[13px] shadow-card">
      <div className="mb-2 font-semibold text-ink">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ color, label, value, strong }: { color?: string; label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-5">
      <span className="flex items-center gap-2 text-ink-2">
        {color ? <span className="size-2.5 rounded-sm" style={{ background: color }} /> : <span className="size-2.5" />}
        {label}
      </span>
      <span className={cx('tnum', strong ? 'font-semibold text-ink' : 'text-ink-2')}>{value}</span>
    </div>
  );
}

function WealthCompare({ config: c, result: r, real }: { config: BuyRentConfig; result: BuyRentResult; real: boolean }) {
  const data = r.years.map((y) => ({
    year: y.year,
    index: y.index,
    buy: real ? y.buyerWealth / y.deflator : y.buyerWealth,
    rent: real ? y.renterWealth / y.deflator : y.renterWealth,
    y,
  }));
  const beYear = r.breakEven != null && r.breakEven > 1 ? c.startYear + r.breakEven - 1 : null;
  const fixedEnd = c.fixedYears < c.years && (r.years[c.fixedYears - 1]?.debt ?? 0) > 1 ? c.startYear + c.fixedYears : null;
  const paidOff = r.paidOffYear && r.paidOffYear > 0 && r.paidOffYear <= c.years ? c.startYear + r.paidOffYear - 1 : null;
  const marks = [
    ...(beYear ? [{ x: beYear, label: 'Break-even', strong: true }] : []),
    ...(fixedEnd ? [{ x: fixedEnd, label: 'Zinsbindung endet', strong: false }] : []),
    ...(paidOff ? [{ x: paidOff, label: 'Abbezahlt', strong: false }] : []),
  ];
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="year" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} minTickGap={24} className="tnum" />
          <YAxis tickFormatter={formatAxis} tick={axisTick} tickLine={false} axisLine={false} width={64} className="tnum" />
          <Tooltip
            cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof data)[number];
              const f = (n: number) => formatEuro(real ? n / p.y.deflator : n);
              return (
                <TooltipShell title={`${p.year} · Jahr ${p.index}`}>
                  <Row color={BUY} label="Kaufen" value={formatEuro(p.buy)} strong />
                  <Row label="Immobilie nach Verkaufskosten" value={f(p.y.propertyValue * (1 - c.sellCost / 100))} />
                  {p.y.debt > 0.5 && <Row label="Restschuld" value={`− ${f(p.y.debt)}`} />}
                  {p.y.buyerDepot > 0.5 && <Row label="Angelegt (nach Steuern)" value={f(p.y.buyerDepot)} />}
                  <div className="my-1 border-t border-line" />
                  <Row color={RENT} label="Mieten" value={formatEuro(p.rent)} strong />
                  <Row label={p.buy >= p.rent ? 'Vorsprung Kaufen' : 'Vorsprung Mieten'} value={formatEuro(Math.abs(p.buy - p.rent))} />
                </TooltipShell>
              );
            }}
          />
          {marks.map((m, i) => (
            <ReferenceLine
              key={m.label}
              x={m.x}
              stroke={m.strong ? 'var(--ink-2)' : 'var(--line-strong)'}
              strokeDasharray={m.strong ? '4 4' : '2 3'}
              label={{ value: m.label, position: m.x - c.startYear > c.years * 0.6 ? 'insideTopRight' : 'insideTopLeft', fill: 'var(--ink-2)', fontSize: 11, dy: i * 15 }}
            />
          ))}
          <Line type="monotone" dataKey="rent" stroke={RENT} strokeWidth={2} dot={false} isAnimationActive={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)', fill: RENT }} />
          <Line type="monotone" dataKey="buy" stroke={BUY} strokeWidth={2} dot={false} isAnimationActive={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)', fill: BUY }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function BurdenChart({ result: r }: { result: BuyRentResult }) {
  type Pt = { year: number; buy: number; rent: number; gap: [number, number]; y: BuyRentYear | null };
  const pt = (year: number, buy: number, rent: number, y: BuyRentYear | null): Pt => ({ year, buy, rent, gap: [Math.min(buy, rent), Math.max(buy, rent)], y });
  const data: Pt[] = [];
  r.years.forEach((y, i) => {
    const p = pt(y.year, (y.interest + y.principal + y.maintenance) / 12, y.rent / 12, y);
    const prev = data[data.length - 1];
    // Where the lines cross between two years, add the exact crossing so the shaded gap closes there.
    if (i > 0 && prev && Math.sign(prev.buy - prev.rent) * Math.sign(p.buy - p.rent) < 0) {
      const d0 = prev.buy - prev.rent;
      const t = d0 / (d0 - (p.buy - p.rent));
      const v = prev.rent + t * (p.rent - prev.rent);
      data.push(pt(prev.year + t, v, v, null));
    }
    data.push(p);
  });
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="year" type="number" domain={['dataMin', 'dataMax']} allowDecimals={false} tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} minTickGap={24} className="tnum" />
          <YAxis tickFormatter={formatAxis} tick={axisTick} tickLine={false} axisLine={false} width={64} className="tnum" />
          <Tooltip
            cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as Pt;
              if (!p.y) return null;
              const diff = p.buy - p.rent;
              return (
                <TooltipShell title={`${p.year} · Ø pro Monat`}>
                  <Row color={BUY} label="Kaufen" value={formatEuro(p.buy)} strong />
                  <Row label="Zinsen" value={formatEuro(p.y.interest / 12)} />
                  <Row label="Tilgung" value={formatEuro(p.y.principal / 12)} />
                  <Row label="Instandhaltung" value={formatEuro(p.y.maintenance / 12)} />
                  <div className="my-1 border-t border-line" />
                  <Row color={RENT} label="Mieten" value={formatEuro(p.rent)} strong />
                  <div className="my-1 border-t border-line" />
                  <Row color={INVEST} label={diff >= 0 ? 'Mieten legt an' : 'Kaufen legt an'} value={formatEuro(Math.abs(diff))} />
                </TooltipShell>
              );
            }}
          />
          <Area type="linear" dataKey="gap" stroke="none" fill={INVEST} fillOpacity={0.18} isAnimationActive={false} activeDot={false} />
          <Line type="linear" dataKey="rent" stroke={RENT} strokeWidth={2} dot={false} isAnimationActive={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)', fill: RENT }} />
          <Line type="linear" dataKey="buy" stroke={BUY} strokeWidth={2} dot={false} isAnimationActive={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)', fill: BUY }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function fmtValue(t: TippingPoint, n: number) {
  return t.unit === '€' ? formatEuro(n) : formatPercent(Math.round(n * 100) / 100);
}

function TippingCard({ config: c, result: r, tipping }: { config: BuyRentConfig; result: BuyRentResult; tipping: TippingPoint[] | null }) {
  const rentTp = tipping?.find((t) => t.key === 'rent');
  const factorAt = rentTp?.threshold ? c.price / (rentTp.threshold * 12) : null;
  return (
    <Card>
      <CardHeader
        title="Kipppunkte"
        subtitle="Ab welchem Wert sich die Antwort dreht – jeweils nur dieser Wert geändert"
      />
      <div className="px-5 pb-5 sm:px-6">
        {!tipping ? (
          <p className="py-6 text-center text-[13px] text-muted">Wird berechnet …</p>
        ) : (
          <ul className="divide-y divide-line">
            {tipping.map((t) => {
              const buyNow = t.buyingWinsNow;
              let text: string;
              if (t.threshold == null) {
                text = buyNow ? 'Kaufen bleibt in jedem realistischen Fall vorn.' : 'Mieten bleibt in jedem realistischen Fall vorn.';
              } else {
                const th = fmtValue(t, t.threshold);
                text = t.buyingAboveThreshold ? `Kaufen liegt vorn ab ${th}` : `Kaufen liegt vorn bis ${th}`;
              }
              const margin = t.threshold != null ? Math.abs(t.threshold - t.current) / (t.unit === '€' ? Math.max(1, t.current) : 1) : null;
              const close = margin != null && (t.unit === '€' ? margin < 0.15 : margin < 1);
              return (
                <li key={t.key} className="flex items-baseline justify-between gap-4 py-2.5 text-[13px]">
                  <span className="min-w-0">
                    <span className="block text-ink">{t.label}</span>
                    <span className="block text-xs text-muted">jetzt {fmtValue(t, t.current)}</span>
                  </span>
                  <span className={cx('tnum shrink-0 text-right', close ? 'font-semibold text-ink' : 'text-ink-2')}>{text}</span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 rounded-xl bg-surface-2 px-4 py-3 text-[13px] text-ink-2">
          Der Kaufpreis entspricht <span className="tnum font-semibold text-ink">{formatNumber(Math.round(r.priceToRent * 10) / 10)}</span> Jahreskaltmieten.
          {factorAt != null && (
            <>
              {' '}
              In deinem Fall lohnt sich Kaufen bis zu einem Faktor von etwa <span className="tnum font-semibold text-ink">{formatNumber(Math.round(factorAt * 10) / 10)}</span>.
            </>
          )}
        </div>
        <p className="mt-2 text-xs text-muted">Fett: Werte, die nah am Kipppunkt liegen – hier entscheidet die Annahme über die Antwort.</p>
      </div>
    </Card>
  );
}

function Balance({ config: c, result: r }: { config: BuyRentConfig; result: BuyRentResult }) {
  const last = r.years[r.years.length - 1];
  const t = r.totals;
  const sale = last.propertyValue * (c.sellCost / 100);
  return (
    <Card>
      <CardHeader title="Bilanz" subtitle={`Nominal, über ${c.years} Jahre bis Ende ${last.year}`} />
      <div className="grid gap-5 px-5 pb-5 sm:grid-cols-2 sm:px-6">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink">
            <span className="size-2.5 rounded-sm" style={{ background: BUY }} /> Kaufen
          </p>
          <Lines
            items={[
              ['Kaufpreis', c.price],
              ['Kaufnebenkosten', r.purchase.total],
              ['Zinsen', t.interest],
              ['Instandhaltung', t.maintenance],
              ...(t.buyerInvested > 0.5 ? ([['Angelegt', t.buyerInvested]] as [string, number][]) : []),
            ]}
          />
          <Lines
            className="mt-3 border-t border-line pt-3"
            items={[
              ['Immobilie am Ende', last.propertyValue],
              ['Verkaufskosten', -sale],
              ...(last.debt > 0.5 ? ([['Restschuld', -last.debt]] as [string, number][]) : []),
              ...(last.buyerDepot > 0.5 ? ([['Depot nach Steuern', last.buyerDepot]] as [string, number][]) : []),
            ]}
            total={['Vermögen', last.buyerWealth]}
          />
        </div>
        <div>
          <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink">
            <span className="size-2.5 rounded-sm" style={{ background: RENT }} /> Mieten
          </p>
          <Lines
            items={[
              ['Miete', t.rent],
              ['Angelegt', t.renterInvested],
              ['davon Eigenkapital', c.equity],
              ['Steuern auf die Anlage', t.renterTaxes],
            ]}
          />
          <Lines className="mt-3 border-t border-line pt-3" items={[]} total={['Depot nach Steuern', last.renterWealth]} />
        </div>
      </div>
      <p className="px-5 pb-5 text-xs text-muted sm:px-6">
        Kredit {formatEuro(r.loan)}, anfängliche Rate {formatEuro(r.monthlyPayment)} im Monat
        {r.paidOffYear ? `, abbezahlt im Jahr ${r.paidOffYear} (${c.startYear + r.paidOffYear - 1})` : ''}. Grunderwerbsteuer {formatPercent(r.purchase.transferTaxRate)} ={' '}
        {formatEuro(r.purchase.transferTax)}.
      </p>
    </Card>
  );
}

function Lines({ items, total, className }: { items: [string, number][]; total?: [string, number]; className?: string }) {
  return (
    <dl className={cx('space-y-1.5 text-[13px]', className)}>
      {items.map(([l, n]) => (
        <div key={l} className="flex justify-between gap-3 text-ink-2">
          <dt>{l}</dt>
          <dd className="tnum">{n < 0 ? `− ${formatEuro(-n)}` : formatEuro(n)}</dd>
        </div>
      ))}
      {total && (
        <div className="flex justify-between gap-3 font-semibold text-ink">
          <dt>{total[0]}</dt>
          <dd className="tnum">{formatEuro(total[1])}</dd>
        </div>
      )}
    </dl>
  );
}

function YearTable({ result: r, real, onCsv }: { result: BuyRentResult; real: boolean; onCsv: () => void }) {
  const [open, setOpen] = useState(false);
  const f = (y: BuyRentYear, n: number) => formatEuro(real ? n / y.deflator : n);
  return (
    <Card>
      <CardHeader
        title="Jahresübersicht"
        subtitle={`${r.years.length} Jahre · ${real ? 'Vermögen in heutiger Kaufkraft, Zahlungen nominal' : 'nominal'}`}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={onCsv}>
              <Download size={14} /> CSV
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              {open ? 'Ausblenden' : 'Anzeigen'} <ChevronDown size={14} className={cx('transition-transform', open && 'rotate-180')} />
            </Button>
          </div>
        }
      />
      {open && (
        <div className="scroll-thin overflow-x-auto">
          <table className="tnum w-full min-w-[860px] text-[13px]">
            <thead>
              <tr className="border-y border-line bg-surface-2 text-left text-xs text-muted">
                {['Jahr', 'Zinsen', 'Tilgung', 'Instandh.', 'Restschuld', 'Immobilie', 'Miete', 'Angelegt K.', 'Angelegt M.', 'Vermögen K.', 'Vermögen M.'].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium whitespace-nowrap first:pl-5 last:pr-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.years.map((y) => (
                <tr key={y.index} className="border-b border-line last:border-b-0">
                  <td className="px-3 py-2 pl-5 font-medium text-ink">{y.year}</td>
                  <td className="px-3 py-2 text-ink-2">{formatEuro(y.interest)}</td>
                  <td className="px-3 py-2 text-ink-2">{formatEuro(y.principal)}</td>
                  <td className="px-3 py-2 text-ink-2">{formatEuro(y.maintenance)}</td>
                  <td className="px-3 py-2 text-ink-2">{formatEuro(y.debt)}</td>
                  <td className="px-3 py-2 text-ink-2">{f(y, y.propertyValue)}</td>
                  <td className="px-3 py-2 text-ink-2">{formatEuro(y.rent)}</td>
                  <td className="px-3 py-2 text-ink-2">{formatEuro(y.buyerInvested)}</td>
                  <td className="px-3 py-2 text-ink-2">{formatEuro(y.renterInvested)}</td>
                  <td className={cx('px-3 py-2', y.buyerWealth >= y.renterWealth ? 'font-semibold text-ink' : 'text-ink-2')}>{f(y, y.buyerWealth)}</td>
                  <td className={cx('px-3 py-2 pr-5', y.renterWealth > y.buyerWealth ? 'font-semibold text-ink' : 'text-ink-2')}>{f(y, y.renterWealth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
