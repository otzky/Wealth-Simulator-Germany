/**
 * Regime-switching model of monthly stock returns (two-regime lognormal, "RSLN-2", Hardy 2001).
 *
 * The market is either calm or in a crisis. Each month the log return is drawn from a normal
 * distribution with the mean and volatility of the current regime, then the regime switches
 * with a fixed probability. This produces what a single lognormal distribution cannot:
 * crises that last several months, years far below −25 %, long phases below the previous
 * high, and more big losses than big gains.
 *
 * Estimated by maximum likelihood on the MSCI World net total return index in EUR,
 * 12/1969–08/2026 (680 monthly returns). Standard errors in parentheses. In 1.500 simulated
 * histories of the same length the model reproduces the index's worst year, maximum drawdown,
 * longest time below a previous high, yearly volatility and skewness; a single lognormal
 * distribution does not. For comparison, Hardy (2001) found for the S&P 500 1956–1999 a
 * shorter but harsher crisis regime (σ 7,5 %, leaves with 38 % per month).
 */
export const MSCI_WORLD_REGIMES = {
  mu: [0.0163, -0.02168], // mean monthly log return: calm (±0,0019), crisis (±0,0073)
  sigma: [0.03164, 0.05637], // monthly volatility: calm (±0,0016), crisis (±0,0038)
  leave: [0.0593, 0.1803], // probability per month of switching to the other regime (±0,024 / ±0,057)
} as const;

export interface RegimeModel {
  /** Deviation of the mean monthly log return from the long-run mean, per regime */
  dev: [number, number];
  sigma: [number, number];
  leave: [number, number];
  /** Long-run share of time in each regime; also used for the first month */
  share: [number, number];
}

/** Long-run share of time in each regime. */
export function regimeShares(leave: readonly [number, number] | readonly number[]): [number, number] {
  const calm = leave[1] / (leave[0] + leave[1]);
  return [calm, 1 - calm];
}

/**
 * The estimated model scaled to the entered volatility: the monthly volatility of the whole
 * model, annualised with √12 (how fact sheets quote it), equals `volatilityPct`. The expected
 * return is applied separately as the long-run mean, so the typical path follows the plan.
 * With a volatility of 0 every month is exactly average.
 */
export function regimeModel(volatilityPct: number): RegimeModel {
  const { mu, sigma, leave } = MSCI_WORLD_REGIMES;
  const share = regimeShares(leave);
  const mean = share[0] * mu[0] + share[1] * mu[1];
  const variance = share[0] * (sigma[0] ** 2 + (mu[0] - mean) ** 2) + share[1] * (sigma[1] ** 2 + (mu[1] - mean) ** 2);
  const k = Math.max(0, volatilityPct) / 100 / Math.sqrt(12) / Math.sqrt(variance);
  return {
    dev: [k * (mu[0] - mean), k * (mu[1] - mean)],
    sigma: [k * sigma[0], k * sigma[1]],
    leave: [leave[0], leave[1]],
    share,
  };
}
