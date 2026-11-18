/**
 * Model of yearly inflation for the Monte Carlo simulation.
 *
 * Inflation follows an AR(1) process around the entered inflation rate: a surprise in one year
 * fades only slowly (half after about three years), so phases of high inflation last several
 * years, as in the 1970s or 2021–2023. Surprises tend to come in weak stock years: they are
 * correlated with the same year's return of the path.
 *
 *   π(t) = μ + φ · (π(t−1) − μ) + σ · (ρ · z(t) + √(1 − ρ²) · ε(t))
 *
 * μ is the entered inflation, z(t) the standardised log return of the path in that calendar year,
 * ε(t) independent noise. The first year starts from μ.
 *
 * Estimated on the German consumer price index (Destatis, VPI, yearly averages 1970–2025, West
 * Germany until 1991) by least squares; ρ is the correlation of the inflation surprises with the
 * calendar-year log return of the MSCI World net return index in EUR 1971–2025 (same data as the
 * return regimes). Standard errors in parentheses.
 */
export const GERMAN_INFLATION = {
  phi: 0.784, // persistence per year (±0,085); half-life about 2,9 years
  sigma: 1.21, // standard deviation of the yearly surprise in percentage points
  rho: -0.22, // correlation of the surprise with the same year's stock return (±0,13)
} as const;

/** Long-run standard deviation of the yearly inflation rate around its mean, in percentage points. */
export function inflationSpread(model = GERMAN_INFLATION): number {
  return model.sigma / Math.sqrt(1 - model.phi ** 2);
}

/**
 * Yearly inflation rates in % for one path.
 * @param mean entered inflation in %
 * @param yearZ standardised log return of the path for each calendar year (0 if unknown)
 * @param normal standard normal random numbers (own stream, so the returns of a path do not change)
 */
export function inflationPath(mean: number, yearZ: ArrayLike<number>, normal: () => number, out = new Float64Array(yearZ.length), model = GERMAN_INFLATION): Float64Array {
  const { phi, sigma, rho } = model;
  const rest = Math.sqrt(1 - rho * rho);
  let prev = mean;
  for (let k = 0; k < yearZ.length; k++) {
    // Prices cannot fall by half in a year; keeps extreme draws finite
    prev = Math.max(-50, mean + phi * (prev - mean) + sigma * (rho * yearZ[k] + rest * normal()));
    out[k] = prev;
  }
  return out;
}
