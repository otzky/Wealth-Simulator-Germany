import { useEffect, useMemo, useRef, useState } from 'react';
import type { MonteCarloResult } from '../lib/montecarlo';
import { formatAxis, formatEuro } from '../lib/format';

/**
 * Every simulated path as a thin, transparent line, drawn on a canvas because thousands of
 * SVG lines would make the page sluggish. Where many paths overlap the colour gets denser.
 */
interface Props {
  result: MonteCarloResult;
  real: boolean;
  log: boolean;
  byOutcome: boolean; // colour failing paths red
}

const HEIGHT = 380;
const M = { l: 64, r: 14, t: 14, b: 30 };
const LOG_FLOOR = 1000;

function niceStep(raw: number) {
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

function useThemeVersion() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const bump = () => setV((x) => x + 1);
    const mo = new MutationObserver(bump);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', bump);
    return () => {
      mo.disconnect();
      mq.removeEventListener('change', bump);
    };
  }, []);
  return v;
}

function colors() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string, d: string) => cs.getPropertyValue(n).trim() || d;
  return {
    good: v('--series-1', '#2a78d6'),
    bad: v('--critical', '#b42f2f'),
    ink: v('--ink', '#0b0b0b'),
    ink2: v('--ink-2', '#52514e'),
    muted: v('--muted', '#7a7873'),
    line: v('--line', '#e1e0d9'),
    surface: v('--surface', '#ffffff'),
  };
}

export default function PathsChart({ result, real, log, byOutcome }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLCanvasElement>(null);
  const over = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<{ j: number; run: number; x: number; y: number } | null>(null);
  const theme = useThemeVersion();

  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver((e) => setWidth(Math.floor(e[0].contentRect.width)));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const { runs, years } = result;
  const Y = years.length;
  // In purchasing power each path is converted with its own inflation; the plan with the entered one.
  const div = useMemo(() => result.deflators.map((d) => (real ? d : 1)), [result, real]);
  const pct = real ? result.percentilesReal : result.percentiles;
  const val = (r: number, j: number) => result.paths[r * Y + j] / (real ? result.pathDeflators[r * Y + j] : 1);

  // Scales
  const scale = useMemo(() => {
    const maxima = new Float64Array(runs);
    for (let r = 0; r < runs; r++) {
      let m = 0;
      for (let j = 0; j < Y; j++) m = Math.max(m, val(r, j));
      maxima[r] = m;
    }
    maxima.sort();
    const planMax = Math.max(1, ...result.plan.map((v, j) => v / div[j]));
    if (log) {
      const top = Math.max(planMax, maxima[Math.min(runs - 1, Math.floor(runs * 0.99))]);
      const lowP10 = Math.min(...pct.p10.filter((v) => v > 0), top);
      const yMin = 10 ** Math.floor(Math.log10(Math.max(LOG_FLOOR, lowP10 / 3)));
      const yMax = 10 ** Math.ceil(Math.log10(top));
      const ticks: number[] = [];
      for (let p = yMin; p <= yMax * 1.0001; p *= 10) ticks.push(p);
      if (ticks.length <= 3) {
        const more: number[] = [];
        for (const t of ticks) more.push(t, t * 2, t * 5);
        return { yMin, yMax, ticks: more.filter((t) => t <= yMax) };
      }
      return { yMin, yMax, ticks };
    }
    // Linear: the outer band (90 %) decides the height, so the bulk of the paths stays readable.
    const top = Math.max(planMax, ...pct.p90.map((v) => v * 1.15));
    const step = niceStep(top / 5);
    const yMax = Math.ceil(top / step) * step;
    const ticks: number[] = [];
    for (let t = 0; t <= yMax + step / 2; t += step) ticks.push(t);
    return { yMin: 0, yMax, ticks };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, div, pct, real, runs, Y, log]);
  const clipped = useMemo(() => {
    let n = 0;
    for (let r = 0; r < runs; r++) {
      for (let j = 0; j < Y; j++) if (val(r, j) > scale.yMax) { n++; break; }
    }
    return n / runs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, real, runs, Y, scale]);

  const plotW = Math.max(1, width - M.l - M.r);
  const plotH = HEIGHT - M.t - M.b;
  const px = (j: number) => M.l + (Y > 1 ? (j / (Y - 1)) * plotW : plotW / 2);
  const py = (v: number) => {
    if (log) {
      const lv = Math.log10(Math.max(scale.yMin, v));
      return M.t + plotH * (1 - (lv - Math.log10(scale.yMin)) / (Math.log10(scale.yMax) - Math.log10(scale.yMin)));
    }
    return M.t + plotH * (1 - (v - scale.yMin) / (scale.yMax - scale.yMin));
  };

  // Paths, grid and axes
  useEffect(() => {
    const cv = base.current;
    if (!cv || !width) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = width * dpr;
    cv.height = HEIGHT * dpr;
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, HEIGHT);
    const c = colors();
    ctx.font = '12px ui-sans-serif, system-ui, sans-serif';

    // Grid and y labels
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const t of scale.ticks) {
      const y = Math.round(py(t)) + 0.5;
      ctx.strokeStyle = c.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(M.l, y);
      ctx.lineTo(width - M.r, y);
      ctx.stroke();
      ctx.fillStyle = c.muted;
      ctx.fillText(formatAxis(t), M.l - 8, y);
    }

    // x labels: about one every 70 px
    const every = [1, 2, 5, 10, 20, 50].find((s) => (plotW / Math.max(1, Y - 1)) * s >= 56) ?? 50;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let j = 0; j < Y; j++) {
      if (years[j] % every !== 0 && j !== 0) continue;
      if (j === 0 && Y > 1 && px(1) - px(0) < 30 && years[0] % every !== 0) continue;
      ctx.fillText(String(years[j]), px(j), HEIGHT - M.b + 8);
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(M.l, M.t - 2, plotW, plotH + 4);
    ctx.clip();

    // All paths; successful ones first so failures stay visible on top
    const alpha = Math.min(0.35, 2 / Math.sqrt(runs));
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    for (const pass of [1, 0]) {
      if (!byOutcome && pass === 0) break;
      ctx.strokeStyle = pass === 1 || !byOutcome ? c.good : c.bad;
      ctx.globalAlpha = pass === 1 ? alpha : Math.min(0.5, alpha * 1.6);
      for (let r = 0; r < runs; r++) {
        if (byOutcome && result.success[r] !== pass) continue;
        ctx.beginPath();
        for (let j = 0; j < Y; j++) {
          const x = px(j);
          const y = py(val(r, j));
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    const drawLine = (vals: number[], color: string, w: number, dash: number[], d: number[] = div) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.setLineDash(dash);
      ctx.beginPath();
      vals.forEach((v, j) => (j === 0 ? ctx.moveTo(px(j), py(v / d[j])) : ctx.lineTo(px(j), py(v / d[j]))));
      ctx.stroke();
      ctx.setLineDash([]);
    };
    // A light halo keeps the summary lines readable on top of dense paths
    const ones = new Array(Y).fill(1);
    drawLine(pct.p50, c.surface, 5, [], ones);
    drawLine(pct.p50, c.ink, 2, [], ones);
    drawLine(result.plan, c.surface, 4, []);
    drawLine(result.plan, c.ink2, 1.5, [5, 4]);
    ctx.restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, result, div, scale, byOutcome, theme]);

  // Highlighted path under the pointer
  useEffect(() => {
    const cv = over.current;
    if (!cv || !width) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = width * dpr;
    cv.height = HEIGHT * dpr;
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, HEIGHT);
    if (!hover) return;
    const c = colors();
    const x = px(hover.j);
    ctx.strokeStyle = c.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, M.t);
    ctx.lineTo(Math.round(x) + 0.5, M.t + plotH);
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.rect(M.l, M.t - 2, plotW, plotH + 4);
    ctx.clip();
    const color = byOutcome && !result.success[hover.run] ? c.bad : c.good;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let j = 0; j < Y; j++) {
      if (j === 0) ctx.moveTo(px(j), py(val(hover.run, j)));
      else ctx.lineTo(px(j), py(val(hover.run, j)));
    }
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, py(val(hover.run, hover.j)), 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover, width, result, div, scale, byOutcome, theme]);

  const onMove = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    if (mx < M.l || mx > width - M.r) return setHover(null);
    const j = Y > 1 ? Math.round(((mx - M.l) / plotW) * (Y - 1)) : 0;
    let best = 0;
    let dist = Infinity;
    for (let r = 0; r < runs; r++) {
      const d = Math.abs(py(val(r, j)) - my);
      if (d < dist) {
        dist = d;
        best = r;
      }
    }
    setHover({ j, run: best, x: px(j), y: my });
  };

  const tip = hover && {
    left: hover.x + 230 > width ? hover.x - 230 : hover.x + 14,
    top: Math.min(HEIGHT - 170, Math.max(0, hover.y - 60)),
  };
  const v = (arr: number[], j: number, d: number[] = div) => formatEuro(arr[j] / d[j]);
  const ones = new Array(Y).fill(1);

  return (
    <div ref={box} className="relative w-full select-none" style={{ height: HEIGHT }}>
      <canvas ref={base} className="absolute inset-0" style={{ width: '100%', height: HEIGHT }} />
      <canvas
        ref={over}
        className="absolute inset-0 cursor-crosshair touch-none"
        style={{ width: '100%', height: HEIGHT }}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
        aria-label={`Alle ${runs} simulierten Verläufe`}
        role="img"
      />
      {clipped > 0.005 && (
        <span className="pointer-events-none absolute top-1 right-4 rounded bg-surface/90 px-1.5 py-0.5 text-[11px] text-muted">
          {Math.round(clipped * 100)} % der Verläufe reichen zeitweise über den Rand
        </span>
      )}
      {hover && tip && (
        <div
          className="pointer-events-none absolute z-10 w-[216px] rounded-xl border border-line bg-surface px-3.5 py-3 text-[13px] shadow-card"
          style={{ left: tip.left, top: tip.top }}
        >
          <div className="mb-2 font-semibold text-ink">
            {years[hover.j]} · {result.ages[hover.j]} Jahre
          </div>
          <div className="space-y-1.5">
            <Row
              label={`Verlauf ${hover.run + 1}${byOutcome ? (result.success[hover.run] ? ' ✓' : ' ✗') : ''}`}
              value={formatEuro(val(hover.run, hover.j))}
              strong
            />
            <div className="space-y-1.5 border-t border-line pt-1.5">
              <Row label="Gute 10 %" value={v(pct.p90, hover.j, ones)} />
              <Row label="Median" value={v(pct.p50, hover.j, ones)} />
              <Row label="Schlechte 10 %" value={v(pct.p10, hover.j, ones)} />
              <Row label="Plan" value={v(result.plan, hover.j)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-ink-2">{label}</span>
      <span className={`tnum ${strong ? 'font-semibold text-ink' : 'text-ink-2'}`}>{value}</span>
    </div>
  );
}
