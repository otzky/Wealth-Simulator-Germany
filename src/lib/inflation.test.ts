import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../defaults';
import { GERMAN_INFLATION, inflationPath, inflationSpread } from './inflation';
import { pathInflation, pathShocks, runMonteCarlo } from './montecarlo';
import { gaussian, mulberry32 } from './random';
import { horizonMonths, simulate } from './simulation';

describe('inflation model', () => {
  const long = (z: (k: number) => number = () => 0, n = 20000) =>
    inflationPath(2, Float64Array.from({ length: n }, (_, k) => z(k)), gaussian(mulberry32(7)));

  it('varies around the entered rate with the estimated spread and persistence', () => {
    const p = long();
    const mean = p.reduce((s, v) => s + v, 0) / p.length;
    const sd = Math.sqrt(p.reduce((s, v) => s + (v - mean) ** 2, 0) / p.length);
    let c = 0;
    for (let k = 1; k < p.length; k++) c += (p[k] - mean) * (p[k - 1] - mean);
    expect(Math.abs(mean - 2)).toBeLessThan(0.15);
    expect(sd).toBeCloseTo(inflationSpread(), 0);
    expect(c / (p.length - 1) / sd ** 2).toBeCloseTo(GERMAN_INFLATION.phi, 1);
  });

  it('surprises come more often in weak stock years', () => {
    const z = new Float64Array(20000);
    const norm = gaussian(mulberry32(3));
    for (let k = 0; k < z.length; k++) z[k] = norm();
    const p = long((k) => z[k]);
    const surprise = Array.from(p, (v, k) => v - 2 - GERMAN_INFLATION.phi * ((k ? p[k - 1] : 2) - 2));
    const corr = (a: number[], b: ArrayLike<number>) => {
      const n = a.length;
      const ma = a.reduce((s, v) => s + v, 0) / n;
      let mb = 0;
      for (let i = 0; i < n; i++) mb += b[i] / n;
      let sab = 0, saa = 0, sbb = 0;
      for (let i = 0; i < n; i++) {
        sab += (a[i] - ma) * (b[i] - mb);
        saa += (a[i] - ma) ** 2;
        sbb += (b[i] - mb) ** 2;
      }
      return sab / Math.sqrt(saa * sbb);
    };
    expect(corr(surprise, z)).toBeCloseTo(GERMAN_INFLATION.rho, 1);
  });

  it('a constant path equal to the entered rate changes nothing', () => {
    const cfg = { ...defaultConfig(), withdrawal: { ...defaultConfig().withdrawal, enabled: true, startYear: 2045, monthlyNet: 2000, inflationAdjust: true } };
    const years = Math.ceil(horizonMonths(cfg) / 12) + 2;
    const a = simulate(cfg);
    const b = simulate(cfg, undefined, undefined, new Float64Array(years).fill(cfg.inflation));
    expect(b.summary.valueNominal).toBeCloseTo(a.summary.valueNominal, 4);
    expect(b.summary.valueReal).toBeCloseTo(a.summary.valueReal, 4);
  });

  it('inflation-adjusted withdrawals follow the inflation that actually happened', () => {
    const base = defaultConfig();
    const cfg = { ...base, initialCapital: 500000, monthlySavings: 0, startDate: '2026-01-01', durationMode: 'years' as const, durationYears: 10, withdrawal: { ...base.withdrawal, enabled: true, startYear: 2026, monthlyNet: 1000, inflationAdjust: true } };
    const path = new Float64Array(12).fill(2);
    path[0] = 10; // 2026: 10 % → withdrawals rise by 10 % in January 2027
    const r = simulate(cfg, undefined, undefined, path);
    const y2027 = r.rows.find((x) => x.year === 2027)!;
    expect(y2027.withdrawalNet / 12).toBeCloseTo(1100, 0);
    // Purchasing power uses the path's inflation
    expect(r.rows.find((x) => x.year === 2026)!.deflator).toBeCloseTo(1.1, 3);
  });

  it('paths keep their returns; inflation uses its own random numbers', () => {
    const cfg = defaultConfig();
    const months = horizonMonths(cfg);
    const s = pathShocks(cfg, 4, months);
    const a = pathInflation(cfg, 4, s, months);
    const b = pathInflation(cfg, 4, pathShocks(cfg, 4, months), months);
    expect([...a]).toEqual([...b]);
    expect(a.length).toBeGreaterThanOrEqual(Math.ceil(months / 12));
  });
});

describe('Monte Carlo with varying inflation', () => {
  const retire = () => {
    const c = defaultConfig();
    return {
      ...c,
      initialCapital: 600000,
      monthlySavings: 0,
      birthDate: '1960-06-01',
      durationMode: 'age' as const,
      targetAge: 95,
      withdrawal: { ...c.withdrawal, enabled: true, startYear: Number(c.startDate.slice(0, 4)), monthlyNet: 2200, inflationAdjust: true },
      monteCarlo: { ...c.monteCarlo, enabled: true, runs: 1000 as const },
    };
  };

  it('reports the success rate with 1 percentage point less return, lower than the plan', () => {
    const mc = runMonteCarlo(retire());
    expect(mc.successRateLowerReturn).toBeLessThan(mc.successRate);
    expect(mc.successRateLowerReturn).toBeGreaterThan(0);
  }, 30000);

  it('purchasing power differs between paths', () => {
    const mc = runMonteCarlo(retire());
    const Y = mc.years.length;
    const ends = new Set(Array.from({ length: 50 }, (_, r) => mc.pathDeflators[r * Y + Y - 1].toFixed(4)));
    expect(ends.size).toBeGreaterThan(40);
    expect(mc.percentilesReal.p50[Y - 1]).toBeGreaterThan(0);
  }, 30000);
});
