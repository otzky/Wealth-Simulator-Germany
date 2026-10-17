import type { ReactNode } from 'react';
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatAxis, formatEuro } from '../lib/format';

export interface WealthPoint {
  year: number;
  age: number;
  value: number;
  invested: number;
  band?: [number, number];
}

export interface DividendPoint {
  year: number;
  age: number;
  monthly: number;
  annual: number;
  gross: number;
  partial: boolean;
}

const axisTick = { fill: 'var(--muted)', fontSize: 12 };

function TooltipShell({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-48 rounded-xl border border-line bg-surface px-3.5 py-3 text-[13px] shadow-card">
      <div className="mb-2 font-semibold text-ink">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function TooltipRow({ color, label, value, strong }: { color?: string; label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-5">
      <span className="flex items-center gap-2 text-ink-2">
        {color ? <span className="size-2.5 rounded-sm" style={{ background: color }} /> : <span className="size-2.5" />}
        {label}
      </span>
      <span className={`tnum ${strong ? 'font-semibold text-ink' : 'text-ink-2'}`}>{value}</span>
    </div>
  );
}

export function LegendItem({ color, label, variant = 'solid' }: { color: string; label: string; variant?: 'solid' | 'line' | 'band' | 'dashed' }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-ink-2">
      {variant === 'solid' && <span className="size-2.5 rounded-sm" style={{ background: color }} />}
      {variant === 'line' && <span className="h-0.5 w-4 rounded-full" style={{ background: color }} />}
      {variant === 'band' && <span className="h-2.5 w-4 rounded-sm opacity-25" style={{ background: color }} />}
      {variant === 'dashed' && <span className="w-4 border-t-2 border-dashed" style={{ borderColor: color }} />}
      {label}
    </span>
  );
}

interface WealthChartProps {
  data: WealthPoint[];
  target?: number | null;
  spread: number;
}

export function WealthChart({ data, target, spread }: WealthChartProps) {
  const showBand = spread > 0 && data.some((d) => d.band);
  return (
    <div className="h-[340px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey="year"
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: 'var(--line-strong)' }}
            minTickGap={24}
            className="tnum"
          />
          <YAxis tickFormatter={formatAxis} tick={axisTick} tickLine={false} axisLine={false} width={64} className="tnum" />
          <Tooltip
            cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as WealthPoint;
              return (
                <TooltipShell title={`${p.year} · ${p.age} Jahre`}>
                  <TooltipRow color="var(--series-1)" label="Depotwert" value={formatEuro(p.value)} strong />
                  <TooltipRow color="var(--series-2)" label="Einzahlungen" value={formatEuro(p.invested)} />
                  <TooltipRow label="Wertzuwachs" value={formatEuro(p.value - p.invested)} />
                  {p.band && showBand && (
                    <div className="mt-2 border-t border-line pt-2">
                      <TooltipRow label={`Rendite −${spread} %-Pkt.`} value={formatEuro(p.band[0])} />
                      <TooltipRow label={`Rendite +${spread} %-Pkt.`} value={formatEuro(p.band[1])} />
                    </div>
                  )}
                </TooltipShell>
              );
            }}
          />
          {showBand && (
            <Area
              type="monotone"
              dataKey="band"
              stroke="none"
              fill="var(--series-1)"
              fillOpacity={0.1}
              isAnimationActive={false}
              activeDot={false}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--series-1)"
            strokeWidth={2}
            fill="url(#valueFill)"
            isAnimationActive={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)', fill: 'var(--series-1)' }}
          />
          <Line
            type="monotone"
            dataKey="invested"
            stroke="var(--series-2)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)', fill: 'var(--series-2)' }}
          />
          {target ? (
            <ReferenceLine
              y={target}
              stroke="var(--ink-2)"
              strokeDasharray="4 4"
              ifOverflow="extendDomain"
              label={{ value: 'Ziel', position: 'insideTopLeft', fill: 'var(--ink-2)', fontSize: 12 }}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DividendChart({ data, target }: { data: DividendPoint[]; target?: number | null }) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="year" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} minTickGap={24} className="tnum" />
          <YAxis tickFormatter={formatAxis} tick={axisTick} tickLine={false} axisLine={false} width={64} className="tnum" />
          <Tooltip
            cursor={{ fill: 'var(--surface-2)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as DividendPoint;
              return (
                <TooltipShell title={`${p.year} · ${p.age} Jahre${p.partial ? ' (Teiljahr)' : ''}`}>
                  <TooltipRow color="var(--series-3)" label="Ø pro Monat (netto)" value={formatEuro(p.monthly)} strong />
                  <TooltipRow label="Im Jahr (netto)" value={formatEuro(p.annual)} />
                  <TooltipRow label="Im Jahr (brutto)" value={formatEuro(p.gross)} />
                </TooltipShell>
              );
            }}
          />
          <Bar dataKey="monthly" fill="var(--series-3)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          {target ? (
            <ReferenceLine
              y={target}
              stroke="var(--ink-2)"
              strokeDasharray="4 4"
              ifOverflow="extendDomain"
              label={{ value: 'Ziel', position: 'insideTopLeft', fill: 'var(--ink-2)', fontSize: 12 }}
            />
          ) : null}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
