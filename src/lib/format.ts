const eur0 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

export const formatEuro = (v: number) => eur0.format(Math.round(v) === 0 ? 0 : v);

export const formatNumber = (v: number) => num.format(v);

export const formatPercent = (v: number) => `${pct.format(v)} %`;

/** Short axis/label format: 950 €, 12 Tsd. €, 1,2 Mio. € */
export function formatEuroCompact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${num.format(round(v / 1e9, 1))} Mrd. €`;
  if (a >= 1e6) return `${num.format(round(v / 1e6, a >= 1e7 ? 1 : 2))} Mio. €`;
  if (a >= 1e4) return `${num.format(Math.round(v / 1e3))} Tsd. €`;
  return eur0.format(v);
}

/** Axis ticks: 0, 250k, 1,5 Mio. */
export function formatAxis(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e6) return `${num.format(round(v / 1e6, 1))} Mio.`;
  if (a >= 1e3) return `${num.format(Math.round(v / 1e3))} Tsd.`;
  return num.format(v);
}

function round(v: number, d: number) {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

/** Parses German or English numeric input: "1.234,5", "1234.5", "1 234". */
export function parseNumber(input: string): number | null {
  let s = input.trim().replace(/\s|€|%/g, '');
  if (!s) return null;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (hasComma) {
    s = s.replace(',', '.');
  } else if (hasDot && /^\-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, ''); // "10.000" is a thousands separator
  }
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}
