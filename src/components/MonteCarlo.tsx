import { useMemo, useState } from 'react';
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Dices, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import type { SimulationConfig, SimulationResult, ValueBasis } from '../types';
import type { MonteCarloResult } from '../lib/montecarlo';
import { canSolveSafeWithdrawal, quantile } from '../lib/montecarlo';
import { safeKey, type McState, type SafeState } from '../lib/useMonteCarlo';
import { formatAxis, formatEuro, formatEuroCompact, formatNumber, formatPercent } from '../lib/format';
import { Button, Card, CardHeader, Hint, NumberField, Segmented, Switch, cx } from './ui';
import { LegendItem } from './Charts';
import PathsChart from './PathsChart';

interface Props {
  config: SimulationConfig;
  plan: SimulationResult;
  mc: McState;
  safe: SafeState & { start: (cfg: SimulationConfig, p: number) => void };
  basis: ValueBasis;
  onBasisChange: (b: ValueBasis) => void;
  onChange: (p: Partial<SimulationConfig>) => void;
}

const axisTick = { fill: 'var(--muted)', fontSize: 12 };
const pct0 = (v: number) => `${formatNumber(Math.round(v * 1000) / 10)} %`;

export default function MonteCarloView({ config, plan, mc, safe, basis, onBasisChange, onChange }: Props) {
  if (!config.monteCarlo.enabled) return <Intro onEnable={() => onChange({ monteCarlo: { ...config.monteCarlo, enabled: true } })} />;
  const r = mc.result;
  if (!r) {
    return (
      <Card className="flex items-center gap-3 px-6 py-10 text-[14px] text-ink-2">
        <Loader2 size={18} className="animate-spin text-accent" />
        {mc.error ? `Berechnung fehlgeschlagen: ${mc.error}` : `Simuliere ${formatNumber(config.monteCarlo.runs)} Verläufe … ${Math.round(mc.progress * 100)} %`}
      </Card>
    );
  }
  return <Report config={config} plan={plan} mc={mc} r={r} safe={safe} basis={basis} onBasisChange={onBasisChange} onChange={onChange} />;
}

function Intro({ onEnable }: { onEnable: () => void }) {
  return (
    <Card className="px-6 py-8 sm:px-8">
      <div className="flex max-w-2xl flex-col gap-4">
        <span className="flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Dices size={22} />
        </span>
        <div>
          <h2 className="text-[18px] font-semibold text-ink">Was, wenn die Märkte schwanken?</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
            Der Plan rechnet jedes Jahr mit derselben Rendite. In Wirklichkeit gibt es gute und schlechte Jahre – und gerade kurz
            vor oder nach Entnahmebeginn macht die Reihenfolge einen großen Unterschied. Die Monte-Carlo-Simulation spielt deinen
            Plan mit allen Ereignissen tausendfach mit zufälligen Renditen durch und zeigt, wie oft er aufgeht.
          </p>
          <p className="mt-2 text-[13px] text-muted">Der Plan selbst bleibt unverändert. Volatilität und Anzahl der Verläufe stellst du unter „Markt“ ein.</p>
        </div>
        <div>
          <Button variant="primary" onClick={onEnable}>
            <Sparkles size={15} /> Monte Carlo aktivieren
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Report({ config, plan, mc, r, safe, basis, onBasisChange, onChange }: Omit<Props, 'mc'> & { mc: McState; r: MonteCarloResult }) {
  const real = basis === 'real';
  const Y = r.years.length;
  const endDiv = real ? r.deflators[Y - 1] : 1;
  const end = (arr: number[]) => arr[Y - 1] / endDiv;
  const [log, setLog] = useState(false);
  const byOutcome = r.metric === 'plan';
  const w = config.withdrawal;
  const target = plan.summary.withdrawal?.target;
  const successCount = Math.round(r.successRate * r.runs);
  const tone = r.successRate >= 0.9 ? 'good' : r.successRate >= 0.7 ? 'ok' : 'bad';

  const reroll = () => onChange({ monteCarlo: { ...config.monteCarlo, seed: (Math.random() * 2 ** 31) >>> 0 } });

  const depleted = useMemo(() => {
    const ages = [...r.depletedAge].filter((a) => a >= 0).sort((a, b) => a - b);
    return { share: ages.length / r.runs, median: ages.length ? ages[Math.floor(ages.length / 2)] : null };
  }, [r]);

  return (
    <div className={cx('space-y-5 transition-opacity', mc.running && 'opacity-70')}>
      {/* Headline */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3 sm:px-6">
          <p className="flex items-center gap-2 text-[13px] text-ink-2">
            <span className="tnum font-medium text-ink">{formatNumber(r.runs)} Verläufe</span> · Volatilität {formatPercent(r.volatility)} p. a.
            {mc.running && <Loader2 size={14} className="animate-spin text-accent" aria-label="Wird neu berechnet" />}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={reroll}>
              <Dices size={14} /> Neu würfeln
            </Button>
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
        </div>
        <div className="grid gap-6 px-5 py-6 sm:px-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
          <div>
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
              {r.metric === 'plan' ? 'Plan geht auf' : 'Mehr als eingezahlt'}
              <Hint>
                {r.metric === 'plan'
                  ? 'Ein Verlauf zählt als Erfolg, wenn jede geplante Entnahme – Entnahmephase und Ereignisse – voll ausgezahlt wird' +
                    (target ? ' und am Ende mindestens das gewünschte Restvermögen übrig ist. Auch ein knapp verfehltes Restvermögen zählt als nicht aufgegangen – die Aufschlüsselung darunter zeigt, wie knapp.' : '.')
                  : 'Ein Verlauf zählt als Erfolg, wenn das Depot nach Verkauf und Steuern (plus ausgezahlte Dividenden) mehr wert ist als alle Einzahlungen.'}
              </Hint>
            </p>
            <p
              className={cx(
                'tnum mt-1 text-[52px] leading-none font-semibold tracking-tight',
                tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-critical' : 'text-ink',
              )}
            >
              {pct0(r.successRate)}
            </p>
            <p className="mt-3 text-[14px] leading-snug text-ink-2">
              In <span className="tnum font-medium text-ink">{formatNumber(successCount)}</span> von {formatNumber(r.runs)} Verläufen{' '}
              {r.metric === 'plan'
                ? target
                  ? `werden alle Entnahmen voll bezahlt und mit ${w.lifeExpectancy} bleiben mindestens ${formatEuroCompact(target.endWealth)}${target.basis === 'real' ? ' Kaufkraft' : ''} übrig.`
                  : 'werden alle geplanten Entnahmen voll bezahlt.'
                : 'ist am Ende mehr da als eingezahlt.'}
            </p>
            {r.guardrails && <GuardrailBreakdown g={r.guardrails} />}
            {target && target.endWealth > 0 && <TargetBreakdown r={r} target={target} age={w.lifeExpectancy} />}
            {target && (
              <p className="mt-2 text-xs text-muted">
                Mit „Berechnen“ ist die Entnahme so gewählt, dass sie ohne Schwankungen genau aufgeht – mit Schwankungen also nur in etwa der Hälfte der Fälle.
                Unten findest du eine sichere Entnahme.
              </p>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <Mini label="Median am Ende" hint="Die Hälfte der Verläufe endet darüber, die Hälfte darunter." value={formatEuroCompact(end(r.percentiles.p50))} />
            <Mini label="Plan ohne Schwankungen" value={formatEuroCompact(end(r.plan))} />
            <Mini label="Schlechte 10 %" hint="Jeder zehnte Verlauf endet unter diesem Wert." value={formatEuroCompact(end(r.percentiles.p10))} tone="bad" />
            <Mini label="Gute 10 %" hint="Jeder zehnte Verlauf endet über diesem Wert." value={formatEuroCompact(end(r.percentiles.p90))} tone="good" />
            {r.goalRate != null && <Mini label="Ziel erreicht" hint="Anteil der Verläufe, die das Ziel aus dem Abschnitt „Ziel“ erreichen." value={pct0(r.goalRate)} />}
          </dl>
        </div>
      </Card>

      {/* All paths */}
      <Card>
        <CardHeader
          title={`Alle ${formatNumber(r.runs)} Verläufe`}
          subtitle={`Jede Linie ist ein möglicher Verlauf · ${real ? 'in heutiger Kaufkraft' : 'nominal'}`}
          actions={
            <Segmented
              aria-label="Skala"
              size="sm"
              value={log ? 'log' : 'lin'}
              onChange={(v) => setLog(v === 'log')}
              options={[
                { value: 'lin', label: 'Linear' },
                { value: 'log', label: 'Logarithmisch' },
              ]}
            />
          }
        />
        <div className="flex flex-wrap gap-x-5 gap-y-2 px-5 pt-3 sm:px-6">
          {byOutcome ? (
            <>
              <LegendItem color="var(--series-1)" label="Plan geht auf" />
              <LegendItem color="var(--critical)" label="Plan scheitert" />
            </>
          ) : (
            <LegendItem color="var(--series-1)" label="Verlauf" />
          )}
          <LegendItem color="var(--ink)" label="Median" variant="line" />
          <LegendItem color="var(--ink-2)" label="Plan ohne Schwankungen" variant="dashed" />
        </div>
        <div className="px-2 pt-2 pb-2 sm:px-4">
          <PathsChart result={r} real={real} log={log} byOutcome={byOutcome} />
        </div>
        <p className="px-5 pb-5 text-xs text-muted sm:px-6">
          Fahre über den Chart, um einzelne Verläufe hervorzuheben.{!log && ' Logarithmisch siehst du auch die sehr guten und die leeren Verläufe vollständig.'}
        </p>
      </Card>

      {canSolveSafeWithdrawal(config) && <GuardrailCard g={r.guardrails} config={config} onChange={onChange} />}

      <div className="grid gap-5 2xl:grid-cols-2">
        <FanCard r={r} real={real} />
        <HistogramCard r={r} real={real} target={target?.reachable && target.endWealth > 0 ? target : null} />
      </div>

      {r.items.length > 0 && <ItemsCard config={config} plan={plan} r={r} depleted={depleted} />}


      {canSolveSafeWithdrawal(config) && <SafeCard config={config} plan={plan} safe={safe} onChange={onChange} />}

      <p className="px-1 text-xs leading-relaxed text-muted">
        Die Renditen werden zufällig gezogen (lognormal, Monat für Monat unabhängig). Der typische Verlauf wächst mit der unter „Markt“
        eingetragenen Rendite, die Volatilität bestimmt die Streuung. Inflation, Ausschüttungsquote, Kosten, Steuern und Ereignisse bleiben
        wie im Plan. Echte Märkte haben häufiger heftige Crashs und Phasen, in denen schlechte Jahre aufeinander folgen – die Ergebnisse
        hängen stark von Rendite und Volatilität ab und sind eher grobe Orientierung als genaue Wahrscheinlichkeit.
      </p>
    </div>
  );
}

/** How far the paths end from the wanted wealth – a strict "success" alone hides near misses. */
function TargetBreakdown({ r, target, age }: { r: MonteCarloResult; target: { endWealth: number; basis: ValueBasis }; age: number }) {
  const d = target.basis === 'real' ? r.deflators[r.years.length - 1] : 1;
  const stats = useMemo(() => {
    const t = target.endWealth;
    const c = { hit: 0, near: 0, below: 0, failed: 0 };
    const ends = new Float64Array(r.runs);
    for (let i = 0; i < r.runs; i++) {
      const v = r.endValues[i] / d;
      ends[i] = v;
      if (!r.paidAll[i]) c.failed++;
      else if (v >= t) c.hit++;
      else if (v >= 0.75 * t) c.near++;
      else c.below++;
    }
    ends.sort();
    const share = (n: number) => n / r.runs;
    return {
      parts: [
        { key: 'hit', label: 'Restvermögen erreicht', share: share(c.hit), color: 'bg-good' },
        { key: 'near', label: 'Knapp verfehlt (ab 75 %)', share: share(c.near), color: 'bg-accent' },
        { key: 'below', label: 'Deutlich darunter', share: share(c.below), color: 'bg-line-strong' },
        { key: 'failed', label: 'Entnahme ausgefallen', share: share(c.failed), color: 'bg-critical' },
      ],
      atLeast90: quantile(ends, 0.1),
      median: quantile(ends, 0.5),
    };
  }, [r, d, target.endWealth]);
  const unit = target.basis === 'real' ? ' Kaufkraft' : '';
  return (
    <div className="mt-4 rounded-xl bg-surface-2 px-4 py-3">
      <p className="text-xs font-medium text-ink-2">
        Restvermögen mit {age} · Ziel {formatEuroCompact(target.endWealth)}
        {unit}
      </p>
      <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
        {stats.parts.map((p) => (p.share > 0 ? <div key={p.key} className={p.color} style={{ width: `${p.share * 100}%` }} /> : null))}
      </div>
      <ul className="mt-2 grid gap-x-4 gap-y-1 text-xs text-ink-2 sm:grid-cols-2">
        {stats.parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <span className={cx('size-2 shrink-0 rounded-full', p.color)} />
            <span className="truncate">{p.label}</span>
            <span className="tnum ml-auto font-medium whitespace-nowrap text-ink">{pct0(p.share)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t border-line pt-2 text-xs text-ink-2">
        In 90 % der Verläufe bleiben mindestens <span className="tnum font-medium text-ink">{formatEuroCompact(stats.atLeast90)}</span>
        {unit} übrig, im Median <span className="tnum font-medium text-ink">{formatEuroCompact(stats.median)}</span>.
      </p>
    </div>
  );
}

function Mini({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3.5 py-2.5">
      <dt className="flex items-center gap-1.5 text-xs text-muted">
        {tone && <span className={cx('size-2 rounded-full', tone === 'good' ? 'bg-good' : 'bg-critical')} />}
        {label}
        {hint && <Hint>{hint}</Hint>}
      </dt>
      <dd className="tnum mt-0.5 text-[16px] font-semibold text-ink">{value}</dd>
    </div>
  );
}

function FanCard({ r, real }: { r: MonteCarloResult; real: boolean }) {
  const data = useMemo(
    () =>
      r.years.map((year, j) => {
        const d = real ? r.deflators[j] : 1;
        return {
          year,
          age: r.ages[j],
          b90: [r.percentiles.p10[j] / d, r.percentiles.p90[j] / d] as [number, number],
          b50: [r.percentiles.p25[j] / d, r.percentiles.p75[j] / d] as [number, number],
          median: r.percentiles.p50[j] / d,
          plan: r.plan[j] / d,
        };
      }),
    [r, real],
  );
  return (
    <Card>
      <CardHeader title="Bandbreite" subtitle={`Die Hälfte der Verläufe liegt im dunklen Band, acht von zehn im hellen · ${real ? 'in Kaufkraft' : 'nominal'}`} />
      <div className="flex flex-wrap gap-x-5 gap-y-2 px-5 pt-3 sm:px-6">
        <BandSwatch opacity={OUTER + INNER} label="Mittlere 50 % der Verläufe" />
        <BandSwatch opacity={OUTER} dashed label="Mittlere 80 % der Verläufe" />
        <LegendItem color="var(--ink)" label="Median" variant="line" />
        <LegendItem color="var(--ink-2)" label="Plan" variant="dashed" />
      </div>
      <div className="h-[300px] px-2 pt-2 pb-4 sm:px-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="year" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} minTickGap={24} className="tnum" />
            <YAxis tickFormatter={formatAxis} tick={axisTick} tickLine={false} axisLine={false} width={64} className="tnum" />
            <Tooltip
              cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof data)[number];
                return (
                  <div className="min-w-52 rounded-xl border border-line bg-surface px-3.5 py-3 text-[13px] shadow-card">
                    <div className="mb-2 font-semibold text-ink">
                      {p.year} · {p.age} Jahre
                    </div>
                    <div className="space-y-1.5">
                      <TipRow label="Gute 10 %" value={formatEuro(p.b90[1])} />
                      <TipRow label="Gute 25 %" value={formatEuro(p.b50[1])} />
                      <TipRow label="Median" value={formatEuro(p.median)} strong />
                      <TipRow label="Schlechte 25 %" value={formatEuro(p.b50[0])} />
                      <TipRow label="Schlechte 10 %" value={formatEuro(p.b90[0])} />
                      <div className="border-t border-line pt-1.5">
                        <TipRow label="Plan" value={formatEuro(p.plan)} />
                      </div>
                    </div>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="b90"
              stroke="var(--series-1)"
              strokeOpacity={0.6}
              strokeWidth={1}
              strokeDasharray="3 3"
              fill="var(--series-1)"
              fillOpacity={OUTER}
              isAnimationActive={false}
              activeDot={false}
            />
            <Area type="monotone" dataKey="b50" stroke="none" fill="var(--series-1)" fillOpacity={INNER} isAnimationActive={false} activeDot={false} />
            <Line type="monotone" dataKey="median" stroke="var(--ink)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="plan" stroke="var(--ink-2)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// Fill opacities of the bands; the inner band lies on top of the outer one, so it shows both.
const OUTER = 0.1;
const INNER = 0.32;

/** Legend swatch that looks exactly like the band in the chart. */
function BandSwatch({ opacity, dashed, label }: { opacity: number; dashed?: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-ink-2">
      <span className="relative h-3 w-5 overflow-hidden rounded-[3px]">
        <span className="absolute inset-0" style={{ background: 'var(--series-1)', opacity }} />
        {dashed && <span className="absolute inset-0 rounded-[3px] border border-dashed" style={{ borderColor: 'var(--series-1)', opacity: 0.7 }} />}
      </span>
      {label}
    </span>
  );
}

function niceStep(raw: number) {
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

function HistogramCard({ r, real, target }: { r: MonteCarloResult; real: boolean; target: { endWealth: number; basis: ValueBasis } | null }) {
  const d = real ? r.deflators[r.years.length - 1] : 1;
  const { bins, planBin, targetBin } = useMemo(() => {
    const all = Float64Array.from(r.endValues, (v) => v / d);
    // Empty depots get their own bar; the rest is spread over even steps up to the upper 10 %.
    const pos = all.filter((v) => v >= 1).sort();
    const empty = all.length - pos.length;
    const hi = Math.max(1, pos.length ? pos[Math.floor((pos.length - 1) * 0.9)] : 1);
    const step = niceStep(hi / 16);
    const n = Math.max(1, Math.ceil(hi / step));
    const counts = new Array(n + 1).fill(0);
    for (const v of pos) counts[Math.min(n, Math.floor(v / step))]++;
    const bins = [
      ...(empty ? [{ key: 'empty', from: 0, to: 0, over: false, empty: true, count: empty, share: empty / all.length }] : []),
      ...counts.map((count, i) => ({ key: String(i), from: i * step, to: (i + 1) * step, over: i === n, empty: false, count, share: count / all.length })),
    ];
    const binOf = (v: number) => (v < 1 && empty ? 'empty' : String(Math.min(n, Math.floor(v / step))));
    const planEnd = r.plan[r.plan.length - 1] / d;
    // The wanted rest is compared in its own basis; convert it to the basis shown.
    const t = target ? (target.basis === 'real' ? target.endWealth * r.deflators[r.years.length - 1] : target.endWealth) / d : null;
    return { bins: bins.filter((b) => b.count > 0 || !b.over), planBin: binOf(planEnd), targetBin: t != null ? binOf(t) : null };
  }, [r, d, target]);

  return (
    <Card>
      <CardHeader title="Verteilung des Endvermögens" subtitle={`Anteil der Verläufe je Depotwert am Ende · ${real ? 'in Kaufkraft' : 'nominal'}`} />
      <div className="h-[300px] px-2 pt-5 pb-4 sm:px-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bins} margin={{ top: 12, right: 8, bottom: 0, left: 0 }} barCategoryGap={1}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="key"
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: 'var(--line-strong)' }}
              tickFormatter={(k: string) => {
                const b = bins.find((x) => x.key === k);
                return !b ? '' : b.empty ? 'leer' : b.over ? `≥ ${formatAxis(b.from)}` : formatAxis(b.from);
              }}
              minTickGap={16}
              className="tnum"
            />
            <YAxis tickFormatter={(v: number) => `${Math.round(v * 100)} %`} tick={axisTick} tickLine={false} axisLine={false} width={48} className="tnum" />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const b = payload[0].payload as (typeof bins)[number];
                return (
                  <div className="rounded-xl border border-line bg-surface px-3.5 py-3 text-[13px] shadow-card">
                    <div className="mb-1 font-semibold text-ink">{b.empty ? 'Depot leer' : b.over ? `ab ${formatEuroCompact(b.from)}` : `${formatEuroCompact(b.from)} – ${formatEuroCompact(b.to)}`}</div>
                    <div className="tnum text-ink-2">
                      {pct0(b.share)} der Verläufe ({formatNumber(b.count)})
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="share" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {bins.map((b) => (
                <Cell key={b.key} fill={b.empty ? 'var(--critical)' : 'var(--series-1)'} />
              ))}
            </Bar>
            <ReferenceLine x={planBin} stroke="var(--ink-2)" strokeDasharray="4 4" label={{ value: 'Plan', position: 'top', fill: 'var(--ink-2)', fontSize: 12 }} />
            {targetBin != null && targetBin !== planBin && (
              <ReferenceLine x={targetBin} stroke="var(--critical)" strokeDasharray="4 4" label={{ value: 'Restvermögen', position: 'top', fill: 'var(--critical)', fontSize: 12 }} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function TipRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-5">
      <span className="text-ink-2">{label}</span>
      <span className={`tnum ${strong ? 'font-semibold text-ink' : 'text-ink-2'}`}>{value}</span>
    </div>
  );
}

function ItemsCard({
  config,
  plan,
  r,
  depleted,
}: {
  config: SimulationConfig;
  plan: SimulationResult;
  r: MonteCarloResult;
  depleted: { share: number; median: number | null };
}) {
  const w = config.withdrawal;
  const label = (it: MonteCarloResult['items'][number]) => {
    if (it.kind === 'phase') {
      const amount =
        w.mode === 'rate'
          ? `${formatPercent(w.rate)} p. a.`
          : `${formatEuro(w.mode === 'target' ? (plan.summary.withdrawal?.target?.monthlyNet ?? 0) : w.monthlyNet)} netto/Monat${w.mode === 'target' ? ' (berechnet)' : ''}`;
      return { title: `Entnahmephase ab ${w.startYear}`, sub: amount + (r.guardrails ? ', mit Leitplanken' : '') };
    }
    if (it.kind === 'oneOff') {
      const o = config.oneOffWithdrawals.find((x) => x.id === it.id);
      return { title: `Einmalige Entnahme ${o?.year ?? ''}`, sub: `${formatEuro(o?.amount ?? 0)} netto` };
    }
    const p = config.withdrawalPhases.find((x) => x.id === it.id);
    return { title: `Befristete Entnahme ${p?.startYear ?? ''}–${p?.endYear ?? ''}`, sub: `${formatEuro(p?.monthlyNet ?? 0)} netto/Monat` };
  };
  return (
    <Card>
      <CardHeader title="Was hält wie oft?" subtitle="Anteil der Verläufe, in denen die Entnahme jedes Mal voll ausgezahlt wird" />
      <div className="space-y-4 px-5 pt-4 pb-5 sm:px-6">
        {r.items.map((it) => {
          const l = label(it);
          const tone = it.paidRate >= 0.9 ? 'bg-good' : it.paidRate >= 0.7 ? 'bg-accent' : 'bg-critical';
          return (
            <div key={it.id}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="truncate text-ink">
                  {l.title} <span className="text-muted">· {l.sub}</span>
                </span>
                <span className="tnum font-medium whitespace-nowrap text-ink">{pct0(it.paidRate)}</span>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3"
                role="progressbar"
                aria-valuenow={Math.round(it.paidRate * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={l.title}
              >
                <div className={cx('h-full rounded-full', tone)} style={{ width: `${it.paidRate * 100}%` }} />
              </div>
            </div>
          );
        })}
        <p className="rounded-xl bg-surface-2 px-4 py-3 text-[13px] text-ink-2">
          {depleted.share > 0 ? (
            <>
              Das Depot ist in <span className="tnum font-medium text-ink">{pct0(depleted.share)}</span> der Verläufe vor dem Ende leer
              {depleted.median != null && (
                <>
                  , im Median mit <span className="tnum font-medium text-ink">{depleted.median} Jahren</span>
                </>
              )}
              .
            </>
          ) : (
            'In keinem Verlauf ist das Depot vor dem Ende leer.'
          )}
        </p>
      </div>
    </Card>
  );
}

/** Splits the success rate by whether the guardrails had to cut, and compares with no guardrails. */
function GuardrailBreakdown({ g }: { g: NonNullable<MonteCarloResult['guardrails']> }) {
  const failed = Math.max(0, 1 - g.successNoCut - g.successWithCut);
  const parts = [
    { key: 'clean', label: 'Aufgegangen, immer nach Plan', share: g.successNoCut, color: 'bg-good' },
    { key: 'cut', label: 'Aufgegangen, zeitweise unter Plan', share: g.successWithCut, color: 'bg-accent' },
    { key: 'fail', label: 'Gescheitert', share: failed, color: 'bg-critical' },
  ];
  const diff = g.successNoCut + g.successWithCut - g.successWithout;
  return (
    <div className="mt-4 rounded-xl bg-surface-2 px-4 py-3">
      <p className="text-xs font-medium text-ink-2">Mit Leitplanken – wie oft wird weniger ausgezahlt als geplant?</p>
      <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
        {parts.map((p) => (p.share > 0 ? <div key={p.key} className={p.color} style={{ width: `${p.share * 100}%` }} /> : null))}
      </div>
      <ul className="mt-2 grid gap-y-1 text-xs text-ink-2">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <span className={cx('size-2 shrink-0 rounded-full', p.color)} />
            <span>{p.label}</span>
            <span className="tnum ml-auto font-medium whitespace-nowrap text-ink">{pct0(p.share)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t border-line pt-2 text-xs text-ink-2">
        Ohne Leitplanken ginge der Plan in <span className="tnum font-medium text-ink">{pct0(g.successWithout)}</span> der Verläufe auf
        {Math.abs(diff) >= 0.001 && (
          <>
            {' '}
            – die Leitplanken {diff > 0 ? 'retten' : 'kosten'} <span className="tnum font-medium text-ink">{formatNumber(Math.round(Math.abs(diff) * 1000) / 10)}</span>{' '}
            Prozentpunkte
          </>
        )}
        .
      </p>
    </div>
  );
}

const BUCKETS = [
  { label: 'Nie', color: 'var(--good)' },
  { label: '1–2 Jahre', color: 'var(--accent)' },
  { label: '3–5 Jahre', color: 'var(--series-4)' },
  { label: '6–10 Jahre', color: 'var(--series-2)' },
  { label: 'über 10 Jahre', color: 'var(--critical)' },
];

/** Switch and settings for guardrails, with how often and how long they cut in the simulated paths. */
function GuardrailCard({
  g,
  config,
  onChange,
}: {
  g: MonteCarloResult['guardrails'];
  config: SimulationConfig;
  onChange: (p: Partial<SimulationConfig>) => void;
}) {
  const w = config.withdrawal;
  const gc = w.guardrails;
  const setG = (patch: Partial<SimulationConfig['withdrawal']['guardrails']>) => onChange({ withdrawal: { ...w, guardrails: { ...gc, ...patch } } });
  const pctOf = (v: number) => `${formatNumber(Math.round(v * 100))} %`;
  const years = (n: number) => `${formatNumber(n)} ${n === 1 ? 'Jahr' : 'Jahre'}`;
  const money = w.inflationAdjust ? `in Euro von ${w.startYear}` : 'nominal';
  return (
    <Card>
      <div className="px-5 pt-5 sm:px-6">
        <Switch
          label={<span className="text-[15px] font-semibold text-ink">Leitplanken: Entnahme an die Märkte anpassen</span>}
          description={
            'Jeden Januar wird geprüft, ob das Depot den geplanten Betrag bis zum Ende noch tragen kann – aus Depotwert, Restlaufzeit, erwarteter Rendite nach Kosten, Steuern und Restvermögen. Liegt der Betrag um mehr als den Auslöser über dem tragfähigen, wird er für das Jahr gekürzt. ' +
            (gc.direction === 'down'
              ? `In guten Jahren wird nach Plan ausgezahlt, das Plus bleibt im Depot. Eine Kürzung bleibt, bis das Depot den vollen Betrag wieder tragen kann (höchstens ${Math.round(gc.threshold / 2)} % darüber), dann gilt wieder der volle Betrag.`
              : 'Liegt er um mehr als den Auslöser darunter, wird erhöht. Eine Kürzung bleibt bestehen, bis eine Erhöhung ausgelöst wird.') +
            ' Nach einem Verlustjahr entfällt der Inflationsausgleich. Der Plan-Tab bleibt unverändert, weil es dort keine schlechten Jahre gibt.'
          }
          checked={gc.enabled}
          onChange={(v) => setG({ enabled: v })}
        />
      </div>
      {gc.enabled && (
        <>
          <div className="px-5 pt-4 sm:px-6">
            <Segmented
              aria-label="Richtung der Leitplanken"
              size="sm"
              value={gc.direction}
              onChange={(v) => setG({ direction: v })}
              className="w-full sm:w-fit"
              options={[
                { value: 'down', label: 'Nur kürzen, sonst nach Plan' },
                { value: 'both', label: 'Kürzen und erhöhen (Guyton-Klinger)' },
              ]}
            />
          </div>
          <div className="grid gap-3 px-5 pt-4 sm:grid-cols-3 sm:px-6">
            <NumberField
              label="Auslöser"
              hint="Liegt der geplante Betrag um mehr als diesen Wert über dem, was das Depot bis zum Ende tragen kann, wird gekürzt. Guyton und Klinger verwenden 20 %."
              value={gc.threshold}
              onChange={(v) => setG({ threshold: Math.min(100, Math.max(1, v ?? 20)) })}
              suffix="%"
              min={1}
              max={100}
            />
            <NumberField
              label="Kürzung"
              hint={gc.direction === 'both' ? 'Um so viel wird gekürzt bzw. erhöht. Guyton und Klinger verwenden 10 %.' : 'Um so viel wird jeweils gekürzt. Guyton und Klinger verwenden 10 %.'}
              value={gc.adjust}
              onChange={(v) => setG({ adjust: Math.min(50, Math.max(1, v ?? 10)) })}
              suffix="%"
              min={1}
              max={50}
            />
            <NumberField
              label="Mindestbetrag / Monat"
              hint={`Netto, in Euro von ${w.startYear}${w.inflationAdjust ? ', wächst mit der Inflation' : ''}. Darunter wird nie gekürzt – reicht das Depot dafür nicht, gilt der Verlauf als gescheitert. 0 € = keine Untergrenze.`}
              value={gc.floor}
              onChange={(v) => setG({ floor: v ?? 0 })}
              suffix="€"
              min={0}
            />
          </div>
          {g ? (
            <div className="px-5 pt-5 pb-5 sm:px-6">
              <p className="text-[13px] font-medium text-ink">Wie viele Jahre liegt die Entnahme unter dem Plan?</p>
              <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                {g.yearsBelowBuckets.map((share, i) =>
                  share > 0 ? <div key={i} style={{ width: `${share * 100}%`, background: BUCKETS[i].color }} /> : null,
                )}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
                {g.yearsBelowBuckets.map((share, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: BUCKETS[i].color }} />
                    {BUCKETS[i].label}
                    <span className="tnum font-medium text-ink">{pct0(share)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Mini label="Jahre unter Plan" hint="In 90 % der Verläufe liegt die Entnahme insgesamt höchstens so viele Jahre unter dem Plan." value={`≤ ${years(g.yearsBelowP90)}`} />
                <Mini label="Am Stück" hint="In 90 % der Verläufe dauert die längste Phase unter dem Plan höchstens so lange." value={`≤ ${years(g.longestBelowP90)}`} />
                <Mini
                  label="Tiefststand"
                  hint="In 90 % der Verläufe sinkt die Entnahme nie unter diesen Anteil des geplanten Betrags."
                  value={pctOf(g.minLevelP10)}
                  tone="bad"
                />
                <Mini
                  label="Puffer"
                  hint={`Alle Kürzungen eines Verlaufs zusammengerechnet (${money}). In 90 % der Verläufe reicht dieser Betrag, um jede Kürzung auszugleichen.`}
                  value={formatEuroCompact(g.missingP90)}
                />
              </dl>
              <p className="mt-3 text-[13px] leading-snug text-ink-2">
                Geplant sind {formatEuro(g.plannedMonthly)} netto im Monat ab {g.startYear}
                {w.inflationAdjust ? ', danach mit der Inflation steigend' : ''}. Geprüft wird jeden Januar, eine Kürzung gilt also mindestens ein Jahr.
                In 90 % der Verläufe liegst du insgesamt höchstens <span className="tnum font-medium text-ink">{years(g.yearsBelowP90)}</span> unter
                dem Plan, davon höchstens <span className="tnum font-medium text-ink">{years(g.longestBelowP90)}</span> am Stück, und die Entnahme sinkt
                nie unter <span className="tnum font-medium text-ink">{pctOf(g.minLevelP10)}</span> des Plans (im ersten Jahr wären das{' '}
                {formatEuro(g.plannedMonthly * g.minLevelP10)}).{' '}
                {g.missingP90 > 0.5 ? (
                  <>
                    Alle Kürzungen zusammen machen dann höchstens <span className="tnum font-medium text-ink">{formatEuro(g.missingP90)}</span> aus ({money}) – ein
                    Puffer in dieser Höhe, z. B. auf dem Tagesgeld, gleicht sie aus.
                  </>
                ) : (
                  'Ein Puffer ist dafür nicht nötig.'
                )}
                {gc.floor > 0 && ` Der Mindestbetrag von ${formatEuro(gc.floor)} wird nie unterschritten.`}
              </p>
            </div>
          ) : (
            <p className="flex items-center gap-2 px-5 pt-3 pb-5 text-[13px] text-muted sm:px-6">
              <Loader2 size={14} className="animate-spin text-accent" /> Wird berechnet …
            </p>
          )}
        </>
      )}
      {!gc.enabled && <div className="pb-5" />}
    </Card>
  );
}

function SafeCard({
  config,
  plan,
  safe,
  onChange,
}: {
  config: SimulationConfig;
  plan: SimulationResult;
  safe: Props['safe'];
  onChange: (p: Partial<SimulationConfig>) => void;
}) {
  const [prob, setProb] = useState<'0.8' | '0.9' | '0.95'>('0.9');
  const p = Number(prob);
  const w = config.withdrawal;
  const isTarget = w.mode === 'target';
  const current = isTarget ? (plan.summary.withdrawal?.target?.monthlyNet ?? 0) : w.monthlyNet;
  const fresh = safe.key === safeKey(config, p);
  const res = fresh ? safe.result : null;
  const runs = Math.min(1000, config.monteCarlo.runs);

  const adopt = (amount: number) =>
    onChange({
      withdrawal: { ...w, mode: 'fixed', monthlyNet: amount },
      // "Berechnen" ends the plan at the life expectancy; keep that horizon with the fixed amount.
      ...(isTarget ? { durationMode: 'age' as const, targetAge: w.lifeExpectancy } : {}),
    });

  return (
    <Card>
      <CardHeader
        title="Sichere Entnahme"
        subtitle={`Wie viel kannst du ab ${w.startYear} pro Monat entnehmen, damit der Plan auch mit Schwankungen hält?`}
      />
      <div className="flex flex-wrap items-end gap-3 px-5 pt-4 sm:px-6">
        <div>
          <p className="mb-1.5 text-xs text-muted">Soll in mindestens … der Verläufe aufgehen</p>
          <Segmented
            aria-label="Gewünschte Sicherheit"
            size="sm"
            value={prob}
            onChange={setProb}
            options={[
              { value: '0.8', label: '80 %' },
              { value: '0.9', label: '90 %' },
              { value: '0.95', label: '95 %' },
            ]}
          />
        </div>
        <Button variant="primary" size="sm" onClick={() => safe.start(config, p)} disabled={safe.running}>
          {safe.running ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          {safe.running ? `Rechne … ${Math.round(safe.progress * 100)} %` : 'Berechnen'}
        </Button>
      </div>
      <div className="px-5 pt-4 pb-5 sm:px-6">
        {res ? (
          res.reachable ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-accent-soft px-4 py-3.5">
              <div>
                <p className="tnum text-[24px] leading-tight font-semibold text-ink">{formatEuro(res.monthlyNet)} netto/Monat</p>
                <p className="mt-1 text-xs leading-snug text-ink-2">
                  Damit {isTarget ? `bleiben mit ${w.lifeExpectancy} mindestens ${formatEuroCompact(w.endWealth)} übrig und ` : ''}werden alle
                  Entnahmen in mindestens {formatNumber(p * 100)} % der Verläufe voll bezahlt
                  {w.inflationAdjust ? ', danach jährlich an die Inflation angepasst' : ''}. Aktuell geplant: {formatEuro(current)}
                  {isTarget ? ' (berechnet ohne Schwankungen)' : ''}.
                  {res.minLevelP10 != null && (
                    <>
                      {' '}
                      Mit Leitplanken ist das der Startbetrag: In den schlechtesten 10 % der Verläufe sinkt er zeitweise auf{' '}
                      <span className="font-medium text-ink">{formatEuro(res.monthlyNet * res.minLevelP10)}</span> ({formatNumber(Math.round(res.minLevelP10 * 100))} %).
                    </>
                  )}
                </p>
              </div>
              <Button size="sm" onClick={() => adopt(res.monthlyNet)} disabled={!isTarget && res.monthlyNet === w.monthlyNet}>
                Als festen Betrag übernehmen
              </Button>
            </div>
          ) : (
            <p className="rounded-xl bg-critical-soft px-4 py-3 text-[13px] text-critical">
              Selbst ohne Entnahme in der Entnahmephase hält der Plan nicht in {formatNumber(p * 100)} % der Verläufe – die Ereignisse
              {isTarget ? ' oder das gewünschte Restvermögen' : ''} sind zu groß.
            </p>
          )
        ) : (
          <p className="text-xs text-muted">
            {safe.error
              ? `Berechnung fehlgeschlagen: ${safe.error}`
              : safe.result && !fresh
                ? 'Die Einstellungen haben sich geändert – bitte neu berechnen.'
                : `Dauert einige Sekunden und nutzt ${formatNumber(runs)} Verläufe. Ereignisse${isTarget ? ' und das Restvermögen' : ''} werden dabei berücksichtigt.`}
          </p>
        )}
      </div>
    </Card>
  );
}
