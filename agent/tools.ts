import { evaluateGoal, solveGoal } from '../src/lib/goal.js';
import { canSolveSafeWithdrawal, quantile, runMonteCarlo, solveSafeWithdrawal, type MonteCarloResult } from '../src/lib/montecarlo.js';
import { runSimulation, solveWithdrawal, withdrawalActive } from '../src/lib/simulation.js';
import { sanitize } from '../src/lib/config.js';
import type { GoalVariable, SimulationConfig, SimulationResult, YearRow } from '../src/types.js';
import { fieldDocs } from './fields.js';
import { MODEL_NOTES } from './model.js';
import { InputError, merge, prepare, ResultCache, type PlanStore, type Prepared } from './scenario.js';
import { readShareLink, shareLink } from './share.js';

/** Euros rounded to whole numbers, shares to one decimal place in %. */
const eur = (v: number) => Math.round(v);
const pct = (share: number) => Math.round(share * 1000) / 10;

export interface ScenarioArgs {
  base?: string;
  changes?: unknown;
}

/** The tools, independent of how they are called (MCP or command line). */
export class AgentTools {
  readonly cache: ResultCache;
  constructor(
    readonly store: PlanStore,
    private readonly linkBase?: string,
    stateless = false,
  ) {
    this.cache = new ResultCache(stateless);
  }

  private link(cfg: SimulationConfig) {
    return shareLink(cfg, this.linkBase);
  }

  private header(p: Prepared, label: string) {
    const id = this.cache.add(p.config, label);
    return {
      result_id: id,
      base: p.base,
      changed: p.changed,
      notes: p.notes,
    };
  }

  // ---------------------------------------------------------------- describe
  describe() {
    return {
      how_to: [
        'Neue Rechnung von Null: einfach rechnen und die persönlichen Eckdaten unter changes angeben – age (oder birthDate), initialCapital, monthlySavings, totalReturn. Alles andere (Steuern, Inflation, Kosten, Ausschüttung, Fondsart) hat sinnvolle Standardwerte und kann später geändert werden. Fehlende Eckdaten nennt die Antwort unter "notes" – diese bei der Person erfragen statt zu raten.',
        'base wählt den Ausgangspunkt: "auto" (Standard: gespeicherter Plan, sonst Standardwerte), "defaults" (immer neue Rechnung ab Standardwerten, auch wenn ein Plan gespeichert ist), "saved", "plan:<name>", "result:<id>" (ein früheres Ergebnis dieser Sitzung weiterdrehen).',
        'changes enthält nur, was abweichen soll, verschachtelt wie die Konfiguration, z. B. { "age": 30, "initialCapital": 20000, "monthlySavings": 800, "withdrawal": { "enabled": true, "startYear": 2060, "monthlyNet": 3000 } }. Objekte werden zusammengeführt, Listen (Ereignisse) ersetzen die bisherige Liste vollständig.',
        'Szenarien durchspielen: compare mit gemeinsamen base/changes (die Eckdaten) und je Szenario nur den Unterschied, z. B. scenarios [{ "name": "5 %", "changes": { "totalReturn": 5 } }, { "name": "7 %", "changes": { "totalReturn": 7 } }]. Oder schrittweise mit base "result:<id>".',
        'Jede Antwort nennt unter "changed" die wirksamen Abweichungen vom Ausgangspunkt und unter "notes" angenommene oder korrigierte Werte – bitte der Person mitteilen.',
        'Beträge in Euro, Renditen in % p. a.; Ereignisse und Entnahmen beziehen sich auf Kalenderjahre (jeweils ab Januar). Die Laufzeit steuern durationMode/durationYears/targetAge.',
        'app_link öffnet das Szenario im Simulator; plans save speichert ein Ergebnis dauerhaft.',
      ],
      fields: fieldDocs(),
      model: MODEL_NOTES,
    };
  }

  // ---------------------------------------------------------------- simulate
  simulate(args: ScenarioArgs & { detail?: 'summary' | 'years' }) {
    const p = prepare(args.base, args.changes, this.store, this.cache);
    const res = runSimulation(p.config);
    return {
      ...this.header(p, 'simulate'),
      ...planReport(p.config, res, args.detail === 'years'),
      app_link: this.link(p.config),
    };
  }

  // ---------------------------------------------------------------- monte_carlo
  monteCarlo(args: ScenarioArgs & { runs?: 1000 | 5000; volatility?: number; seed?: number; safe_probability?: number }) {
    const p = prepare(args.base, args.changes, this.store, this.cache);
    const cfg: SimulationConfig = sanitize({
      ...p.config,
      monteCarlo: {
        ...p.config.monteCarlo,
        enabled: true,
        ...(args.runs ? { runs: args.runs } : {}),
        ...(args.volatility != null ? { volatility: args.volatility } : {}),
        ...(args.seed != null ? { seed: args.seed } : {}),
      },
    });
    const mc = runMonteCarlo(cfg);
    const plan = runSimulation(cfg);
    const out: Record<string, unknown> = {
      ...this.header({ ...p, config: cfg }, 'monte_carlo'),
      ...mcReport(cfg, plan, mc),
    };
    if (args.safe_probability != null) out.safe_withdrawal = this.safe(cfg, args.safe_probability);
    out.app_link = this.link(cfg);
    return out;
  }

  private safe(cfg: SimulationConfig, probability: number) {
    if (!canSolveSafeWithdrawal(cfg)) {
      return { available: false, reason: 'Nur bei aktiver Entnahmephase mit festem oder berechnetem Betrag (withdrawal.mode "fixed" oder "target").' };
    }
    const s = solveSafeWithdrawal(cfg, Math.min(0.99, Math.max(0.5, probability)))!;
    return {
      available: true,
      probability: s.probability,
      monthly_net_first_year: s.reachable ? s.monthlyNet : null,
      reachable: s.reachable,
      lowest_level_in_bad_paths: s.minLevelP10 != null ? pct(s.minLevelP10) : null,
      note: s.reachable
        ? `Höchster Netto-Betrag pro Monat ab ${cfg.withdrawal.startYear}, bei dem in mindestens ${pct(s.probability)} % der Verläufe alle Entnahmen bezahlt werden${cfg.withdrawal.mode === 'target' ? ' und das Restvermögen übrig bleibt' : ''}. Basis: ${s.runs} Verläufe.` +
          (s.minLevelP10 != null ? ` Mit Leitplanken ist das der Startbetrag; in den schlechtesten 10 % sinkt er zeitweise auf ${pct(s.minLevelP10)} %.` : '')
        : 'Selbst ohne Entnahme in der Entnahmephase hält der Plan nicht oft genug – Ereignisse oder Restvermögen sind zu groß.',
    };
  }

  // ---------------------------------------------------------------- solve
  solve(args: ScenarioArgs & { target: 'withdrawal_for_end_wealth' | 'safe_withdrawal' | 'goal'; probability?: number; variable?: GoalVariable }) {
    if (args.target === 'withdrawal_for_end_wealth') {
      const p = prepare(args.base, mergeChanges(args.changes, { withdrawal: { enabled: true, mode: 'target' } }), this.store, this.cache);
      const t = solveWithdrawal(p.config);
      const res = runSimulation(p.config);
      const w = p.config.withdrawal;
      return {
        ...this.header(p, 'solve withdrawal_for_end_wealth'),
        target: args.target,
        answer: t?.reachable
          ? { monthly_net_first_year: t.monthlyNet, start_year: w.startYear, life_expectancy: w.lifeExpectancy, end_wealth: t.endWealth, end_wealth_basis: t.basis, inflation_adjusted: w.inflationAdjust }
          : { reachable: false, reason: t ? `Das Restvermögen von ${eur(t.endWealth)} € wird selbst ohne Entnahme nicht erreicht.` : 'Die Entnahme liegt außerhalb der Laufzeit.' },
        explanation: 'Ohne Marktschwankungen gerechnet: Mit Schwankungen geht dieser Betrag nur in etwa der Hälfte der Fälle auf. Für einen vorsichtigeren Betrag: solve mit target "safe_withdrawal".',
        plan: planReport(p.config, res, false),
        app_link: this.link(p.config),
      };
    }
    if (args.target === 'safe_withdrawal') {
      const p = prepare(args.base, mergeChanges(args.changes, { withdrawal: { enabled: true } }), this.store, this.cache);
      return {
        ...this.header(p, 'solve safe_withdrawal'),
        target: args.target,
        answer: this.safe(p.config, args.probability ?? 0.9),
        app_link: this.link(p.config),
      };
    }
    if (args.target === 'goal') {
      const variable = args.variable ?? 'savings';
      const p = prepare(args.base, mergeChanges(args.changes, { goal: { enabled: true, solveFor: variable } }), this.store, this.cache);
      const g = p.config.goal;
      if (!((g.wealth ?? 0) > 0 || (g.monthlyDividend ?? 0) > 0)) {
        throw new InputError('Für target "goal" bitte goal.wealth und/oder goal.monthlyDividend unter changes angeben.');
      }
      const required = solveGoal(p.config, variable);
      const res = runSimulation(p.config);
      const ev = evaluateGoal(p.config, res);
      const unit = variable === 'return' ? '% p. a.' : variable === 'savings' ? '€/Monat' : '€';
      return {
        ...this.header(p, 'solve goal'),
        target: args.target,
        answer: {
          variable,
          required: required,
          unit,
          current: ev?.currentValue,
          reachable: required != null,
          reached_with_current_plan: ev?.reachedYear != null ? { year: ev.reachedYear, age: ev.reachedAge } : null,
          measured: ev?.atWithdrawal ? 'am Ende des Jahres vor Entnahmebeginn' : 'am Ende der Laufzeit',
          note: variable === 'savings' && p.config.savingsSteps.length ? 'Gerechnet als eine gleichbleibende Sparrate: geplante Sparraten-Änderungen werden dafür ersetzt.' : undefined,
        },
        app_link: this.link(p.config),
      };
    }
    throw new InputError('target muss "withdrawal_for_end_wealth", "safe_withdrawal" oder "goal" sein.');
  }

  // ---------------------------------------------------------------- compare
  compare(args: { base?: string; changes?: unknown; scenarios: { name: string; base?: string; changes?: unknown }[]; monte_carlo?: boolean }) {
    if (!args.scenarios?.length) throw new InputError('scenarios braucht mindestens einen Eintrag.');
    if (args.scenarios.length > 8) throw new InputError('Höchstens 8 Szenarien auf einmal.');
    const rows = args.scenarios.map((s) => {
      // Shared starting point and changes, then what is special about this scenario
      const p = prepare(s.base ?? args.base, merge(args.changes ?? {}, s.changes ?? {}), this.store, this.cache);
      const res = runSimulation(p.config);
      const S = res.summary;
      const ws = S.withdrawal;
      const row: Record<string, unknown> = {
        name: s.name,
        result_id: this.cache.add(p.config, `compare ${s.name}`),
        changed: p.changed,
        notes: p.notes,
        end_year: S.endYear,
        end_age: S.endAge,
        end_value: eur(S.valueNominal),
        end_value_real: eur(S.valueReal),
        end_value_after_sale: eur(S.valueAfterSale),
        invested: eur(S.invested),
        withdrawn_net: eur(S.withdrawnNet),
        withdrawal_monthly_net_first_year: ws ? eur(ws.target?.monthlyNet ?? ws.firstYearMonthlyNet) : null,
        depot_empty: ws?.depletedYear ? { year: ws.depletedYear, age: ws.depletedAge } : null,
        warnings: warnings(p.config, res),
        app_link: this.link(p.config),
      };
      if (args.monte_carlo) {
        const cfg = sanitize({ ...p.config, monteCarlo: { ...p.config.monteCarlo, enabled: true } });
        const mc = runMonteCarlo(cfg);
        row.monte_carlo = {
          success_rate: pct(mc.successRate),
          success_means: mc.metric === 'plan' ? 'alle Entnahmen bezahlt (und Restvermögen erreicht)' : 'mehr als eingezahlt',
          end_value_p10: eur(mc.percentiles.p10.at(-1)!),
          end_value_p50: eur(mc.percentiles.p50.at(-1)!),
          end_value_p90: eur(mc.percentiles.p90.at(-1)!),
          end_value_p50_real: eur(mc.percentilesReal.p50.at(-1)!),
          success_rate_if_return_1pt_lower: pct(mc.successRateLowerReturn),
        };
      }
      return row;
    });
    return {
      scenarios: rows,
      note: args.monte_carlo ? 'Alle Szenarien mit denselben Zufallsverläufen (gleicher Startwert), damit der Vergleich fair ist.' : undefined,
    };
  }

  // ---------------------------------------------------------------- plans
  plans(args: { action: 'list' | 'get' | 'save' | 'delete' | 'set_default' | 'import_link'; name?: string; link?: string; base?: string; changes?: unknown; make_default?: boolean }) {
    const need = () => {
      if (!args.name?.trim()) throw new InputError(`Für action "${args.action}" wird name benötigt.`);
      return args.name.trim();
    };
    switch (args.action) {
      case 'list':
        return { plans: this.store.list(), default: this.store.defaultName() };
      case 'get': {
        const name = args.name?.trim() || this.store.defaultName();
        const cfg = name ? this.store.get(name) : null;
        if (!name || !cfg) throw new InputError(name ? `Kein Plan „${name}“.` : 'Es ist noch kein Plan gespeichert.');
        return { name, config: cfg, app_link: this.link(cfg) };
      }
      case 'save': {
        const name = need();
        const p = prepare(args.base, args.changes, this.store, this.cache);
        this.store.save(name, p.config, args.make_default);
        return { saved: name, default: this.store.defaultName(), changed: p.changed, notes: p.notes, app_link: this.link(p.config) };
      }
      case 'import_link': {
        const name = args.name?.trim() || 'Mein Plan';
        if (!args.link) throw new InputError('Für import_link wird link benötigt (aus „Teilen“ in der App).');
        const cfg = sanitize(readShareLink(args.link));
        this.store.save(name, cfg, args.make_default ?? true);
        return {
          saved: name,
          default: this.store.defaultName(),
          summary: planReport(cfg, runSimulation(cfg), false).end,
          notes: prepare(`plan:${name}`, {}, this.store, this.cache).notes,
        };
      }
      case 'delete':
        return { deleted: this.store.remove(need()), default: this.store.defaultName() };
      case 'set_default': {
        const name = need();
        if (!this.store.setDefault(name)) throw new InputError(`Kein Plan „${name}“.`);
        return { default: name };
      }
    }
    throw new InputError('action muss list, get, save, delete, set_default oder import_link sein.');
  }
}

function mergeChanges(changes: unknown, extra: Record<string, Record<string, unknown>>): unknown {
  const c = (changes && typeof changes === 'object' && !Array.isArray(changes) ? { ...(changes as Record<string, unknown>) } : changes ?? {}) as Record<string, unknown>;
  if (typeof c !== 'object') return changes;
  for (const [k, v] of Object.entries(extra)) c[k] = { ...v, ...((c[k] as Record<string, unknown>) ?? {}) };
  return c;
}

/** Problems a person must know about. */
function warnings(cfg: SimulationConfig, res: SimulationResult): string[] {
  const out: string[] = [];
  const S = res.summary;
  const ws = S.withdrawal;
  if (cfg.withdrawal.enabled && !withdrawalActive(cfg)) out.push('Die Entnahme beginnt erst nach dem Ende der Simulation.');
  if (ws?.target && !ws.target.reachable) out.push(`Das Restvermögen von ${eur(ws.target.endWealth)} € wird selbst ohne Entnahme nicht erreicht.`);
  if (ws?.depletedYear && !ws.target?.reachable) out.push(`Das Depot ist ${ws.depletedYear} leer (Alter ${ws.depletedAge}); danach wird nichts mehr ausgezahlt.`);
  else if (ws?.shortfall && !ws.target) out.push('Die Entnahme kann nicht in jedem Monat voll ausgezahlt werden.');
  if (S.eventShortfall) out.push(`Das Depot reicht ${S.eventShortfall.year} nicht für die geplanten Ereignis-Entnahmen: Es fehlen ${eur(S.eventShortfall.missing)} € netto.`);
  return out;
}

function rowOut(r: YearRow) {
  return {
    year: r.year,
    age: r.age,
    value: eur(r.valueEnd),
    value_real: eur(r.realValueEnd),
    invested_total: eur(r.investedTotal),
    contributions: eur(r.contributions),
    withdrawals_net: eur(r.withdrawalNet + r.oneOffNet),
    dividends_paid_out: eur(r.dividendsPaidOut),
    taxes: eur(r.taxes),
  };
}

/** Compact result of the plan without fluctuations. */
export function planReport(cfg: SimulationConfig, res: SimulationResult, allYears: boolean) {
  const S = res.summary;
  const ws = S.withdrawal;
  const keyYears = new Set<number>([res.rows[0].year, S.endYear]);
  for (const r of res.rows) if (r.year % 5 === 0) keyYears.add(r.year);
  if (ws) [ws.startYear - 1, ws.startYear].forEach((y) => keyYears.add(y));
  for (const o of cfg.oneOffWithdrawals) keyYears.add(o.year);
  for (const l of cfg.lumpSums) keyYears.add(l.year);
  const goal = evaluateGoal(cfg, res);
  return {
    horizon: { start: cfg.startDate, end_year: S.endYear, end_age: S.endAge, years: Math.round(S.years * 10) / 10 },
    end: {
      value: eur(S.valueNominal),
      value_real: eur(S.valueReal),
      value_after_sale: eur(S.valueAfterSale),
      value_after_sale_real: eur(S.valueAfterSaleReal),
      invested: eur(S.invested),
      growth: eur(S.growth),
      taxes_paid: eur(S.taxesPaid),
      costs_paid: eur(S.costsPaid),
    },
    dividends: {
      net_total: eur(S.dividendsNet),
      paid_out: eur(S.dividendsPaidOut),
      monthly_net_last_12_months: eur(S.finalMonthlyDividendNet),
    },
    withdrawals:
      S.withdrawnGross > 0.5 || ws
        ? {
            total_net: eur(S.withdrawnNet),
            total_net_real: eur(S.withdrawnNetReal),
            one_off_net: eur(S.oneOffNet),
            taxes: eur(S.withdrawalTaxes),
            phase: ws
              ? {
                  start_year: ws.startYear,
                  start_age: ws.startAge,
                  depot_at_start: eur(ws.startValue),
                  depot_at_start_real: eur(ws.startValueReal),
                  monthly_net_first_year: eur(ws.firstYearMonthlyNet),
                  monthly_net_first_year_real: eur(ws.firstMonthlyNetReal),
                  monthly_dividends_first_year: eur(ws.firstYearMonthlyDividends),
                  calculated_amount: ws.target ? { monthly_net: ws.target.monthlyNet, reachable: ws.target.reachable } : undefined,
                  withdrawal_rate_first_year: Math.round(ws.effectiveRate * 100) / 100,
                  monthly_net_last: eur(ws.lastMonthlyNet),
                  depot_empty: ws.depletedYear ? { year: ws.depletedYear, age: ws.depletedAge } : null,
                }
              : null,
          }
        : null,
    goal: goal
      ? {
          reached: goal.reachedYear != null ? { year: goal.reachedYear, age: goal.reachedAge } : null,
          required: goal.required,
          required_variable: goal.variable,
          current_value: goal.currentValue,
          progress_wealth: goal.wealthProgress != null ? pct(goal.wealthProgress) : null,
          progress_dividend: goal.dividendProgress != null ? pct(goal.dividendProgress) : null,
        }
      : null,
    warnings: warnings(cfg, res),
    [allYears ? 'years' : 'milestones']: res.rows.filter((r) => allYears || keyYears.has(r.year)).map(rowOut),
  };
}

/** Compact Monte Carlo result. */
export function mcReport(cfg: SimulationConfig, plan: SimulationResult, r: MonteCarloResult) {
  const Y = r.years.length;
  const target = plan.summary.withdrawal?.target ?? null;
  const pick = (j: number) => ({
    year: r.years[j],
    age: r.ages[j],
    p10: eur(r.percentiles.p10[j]),
    p25: eur(r.percentiles.p25[j]),
    p50: eur(r.percentiles.p50[j]),
    p75: eur(r.percentiles.p75[j]),
    p90: eur(r.percentiles.p90[j]),
    plan: eur(r.plan[j]),
  });
  const idx = r.years.map((y, j) => (j === 0 || j === Y - 1 || y % 5 === 0 ? j : -1)).filter((j) => j >= 0);
  const label = (it: MonteCarloResult['items'][number]) => {
    const w = cfg.withdrawal;
    if (it.kind === 'phase') return `Entnahmephase ab ${w.startYear}`;
    if (it.kind === 'oneOff') {
      const o = cfg.oneOffWithdrawals.find((x) => x.id === it.id);
      return `Einmalige Entnahme ${o?.year}: ${eur(o?.amount ?? 0)} € netto${o?.label ? ` (${o.label})` : ''}`;
    }
    const p = cfg.withdrawalPhases.find((x) => x.id === it.id);
    return `Befristete Entnahme ${p?.startYear}–${p?.endYear}: ${eur(p?.monthlyNet ?? 0)} € netto/Monat`;
  };
  const depleted = [...r.depletedAge].filter((a) => a >= 0).sort((a, b) => a - b);

  let breakdown: Record<string, unknown> | undefined;
  if (target && target.endWealth > 0) {
    const ends = Float64Array.from(r.endValues, (v, i) => (target.basis === 'real' ? v / r.endDeflators[i] : v));
    const c = { reached: 0, near: 0, below: 0, failed: 0 };
    ends.forEach((v, i) => {
      if (!r.paidAll[i]) c.failed++;
      else if (v >= target.endWealth) c.reached++;
      else if (v >= 0.75 * target.endWealth) c.near++;
      else c.below++;
    });
    ends.sort();
    breakdown = {
      wanted: eur(target.endWealth),
      basis: target.basis,
      reached: pct(c.reached / r.runs),
      narrowly_missed_75pct: pct(c.near / r.runs),
      clearly_below: pct(c.below / r.runs),
      withdrawal_failed: pct(c.failed / r.runs),
      left_in_90pct_of_paths: eur(quantile(ends, 0.1)),
      median_left: eur(quantile(ends, 0.5)),
    };
  }
  const g = r.guardrails;
  return {
    model: {
      returns: 'Regime-Modell (ruhig/Krise), geschätzt auf MSCI World Net Return EUR 1970–2026',
      expected_return: cfg.totalReturn,
      volatility: r.volatility,
      runs: r.runs,
      seed: cfg.monteCarlo.seed,
      inflation: `schwankt um ${cfg.inflation} % (AR(1), deutsche Inflation 1970–2025, an schwache Börsenjahre gekoppelt)`,
      note: 'Im Durchschnitt (geometrisch) wachsen die Verläufe mit expected_return; der Median liegt etwas darüber. Kosten, Steuern und Ereignisse wie im Plan; Kaufkraft-Werte je Verlauf mit dessen eigener Inflation.',
    },
    success: {
      rate: pct(r.successRate),
      rate_if_return_1pt_lower: pct(r.successRateLowerReturn),
      sensitivity_note: 'Dieselben Verläufe mit 1 Prozentpunkt weniger erwarteter Rendite. Die erwartete Rendite ist selbst nur auf etwa ±2 Prozentpunkte bekannt – die Erfolgsquote daher als Orientierung nennen, nicht als genaue Wahrscheinlichkeit.',
      means:
        r.metric === 'plan'
          ? `Anteil der Verläufe, in denen jede Entnahme voll bezahlt wird${target ? ' und das Restvermögen übrig bleibt' : ''}`
          : 'Anteil der Verläufe, in denen das Depot nach Verkauf und Steuern mehr wert ist als die Einzahlungen',
    },
    goal_reached_rate: r.goalRate != null ? pct(r.goalRate) : null,
    end_wealth_breakdown: breakdown,
    withdrawals_paid: r.items.map((it) => ({ what: label(it), paid_in_full: pct(it.paidRate) })),
    depot_empty: r.metric === 'plan' ? { share: pct(depleted.length / r.runs), median_age: depleted.length ? depleted[Math.floor(depleted.length / 2)] : null } : undefined,
    guardrails: g
      ? {
          direction: g.direction,
          planned_monthly_net: eur(g.plannedMonthly),
          success_always_as_planned: pct(g.successNoCut),
          success_with_years_below_plan: pct(g.successWithCut),
          success_without_guardrails: pct(g.successWithout),
          share_with_cuts: pct(g.cutShare),
          years_below_plan: { never: pct(g.yearsBelowBuckets[0]), '1-2': pct(g.yearsBelowBuckets[1]), '3-5': pct(g.yearsBelowBuckets[2]), '6-10': pct(g.yearsBelowBuckets[3]), 'over_10': pct(g.yearsBelowBuckets[4]) },
          years_below_plan_in_90pct: g.yearsBelowP90,
          longest_run_below_plan_in_90pct: g.longestBelowP90,
          lowest_level_in_90pct: pct(g.minLevelP10),
          buffer_for_all_cuts_in_90pct: eur(g.missingP90),
          buffer_money: g.inflationAdjust ? `Euro von ${g.startYear}` : 'nominal',
        }
      : null,
    value_percentiles: idx.map(pick),
    end_value_real: {
      p10: eur(r.percentilesReal.p10[Y - 1]),
      p50: eur(r.percentilesReal.p50[Y - 1]),
      p90: eur(r.percentilesReal.p90[Y - 1]),
    },
  };
}
