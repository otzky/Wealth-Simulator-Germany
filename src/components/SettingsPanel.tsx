import { useId, useMemo } from 'react';
import { CalendarClock, Coins, HandCoins, Landmark, Milestone, Plus, Receipt, Target, Trash2, TrendingUp } from 'lucide-react';
import type { LumpSum, OneOffWithdrawal, SavingsStep, SimulationConfig, WithdrawalPhase } from '../types';
import { PARTIAL_EXEMPTION, effectiveTaxRate, parseDate, reinvestsIn, simulationYears, solveWithdrawal, usesLifeExpectancy } from '../lib/simulation';
import { formatEuro, formatNumber, formatPercent } from '../lib/format';
import { newId } from '../lib/storage';
import { cx, Field, IconButton, NumberField, NumberInput, Section, Segmented, Select, SliderField, Switch, TextInput } from './ui';

interface Props {
  config: SimulationConfig;
  onChange: (patch: Partial<SimulationConfig>) => void;
}

export default function SettingsPanel({ config, onChange }: Props) {
  const years = useMemo(() => simulationYears(config), [config.birthDate, config.startDate, config.durationMode, config.durationYears, config.targetAge, config.withdrawal.enabled, config.withdrawal.mode, config.withdrawal.lifeExpectancy]);
  const yearOptions = years.map((y) => ({ value: y.year, label: `${y.year} · ${y.age} J.` }));
  const shortYearOptions = years.map((y) => ({ value: y.year, label: `${y.year} · ${y.age}` })); // for narrow selects
  const firstYear = years[0]?.year ?? new Date().getFullYear();
  const pickYear = (offset: number) => years[Math.min(years.length - 1, offset)]?.year ?? firstYear;

  const ids = { birth: useId(), start: useId() };
  const taxRate = effectiveTaxRate(config);
  const setMc = (patch: Partial<SimulationConfig['monteCarlo']>) => onChange({ monteCarlo: { ...config.monteCarlo, ...patch } });
  const setGoal = (patch: Partial<SimulationConfig['goal']>) => onChange({ goal: { ...config.goal, ...patch } });

  const updateStep = (id: string, patch: Partial<SavingsStep>) =>
    onChange({ savingsSteps: config.savingsSteps.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const updateLump = (id: string, patch: Partial<LumpSum>) =>
    onChange({ lumpSums: config.lumpSums.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  const byLifeExpectancy = usesLifeExpectancy(config);
  const updateOneOff = (id: string, patch: Partial<OneOffWithdrawal>) =>
    onChange({ oneOffWithdrawals: config.oneOffWithdrawals.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const updatePhase = (id: string, patch: Partial<WithdrawalPhase>) =>
    onChange({ withdrawalPhases: config.withdrawalPhases.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const eventCount = config.savingsSteps.length + config.lumpSums.length + config.oneOffWithdrawals.length + config.withdrawalPhases.length;

  const durationSummary = byLifeExpectancy
    ? `bis Alter ${config.withdrawal.lifeExpectancy}`
    : config.durationMode === 'years'
      ? `${config.durationYears} Jahre`
      : `bis Alter ${config.targetAge}`;

  return (
    <div>
      <Section
        icon={<CalendarClock size={16} />}
        title="Zeitraum"
        summary={`${durationSummary} · ab ${years[0]?.year ?? ''}`}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Geburtsdatum" htmlFor={ids.birth}>
            <TextInput id={ids.birth} type="date" value={config.birthDate} onChange={(e) => e.target.value && onChange({ birthDate: e.target.value })} />
          </Field>
          <Field label="Start" htmlFor={ids.start}>
            <TextInput id={ids.start} type="date" value={config.startDate} onChange={(e) => e.target.value && onChange({ startDate: e.target.value })} />
          </Field>
        </div>
        {!byLifeExpectancy && (
          <Segmented
            aria-label="Laufzeit festlegen"
            value={config.durationMode}
            onChange={(v) => onChange({ durationMode: v })}
            options={[
              { value: 'years', label: 'Anzahl Jahre' },
              { value: 'age', label: 'Bis Zielalter' },
            ]}
          />
        )}
        {byLifeExpectancy ? (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs leading-snug text-ink-2">
            Die Laufzeit richtet sich nach der Lebenserwartung aus dem Abschnitt „Entnahme“: Die Simulation läuft bis zum Alter {config.withdrawal.lifeExpectancy}.
          </p>
        ) : config.durationMode === 'years' ? (
          <SliderField label="Laufzeit" value={config.durationYears} onChange={(v) => onChange({ durationYears: Math.round(v) })} min={1} max={60} step={1} suffix="J." inputMax={100} />
        ) : (
          <SliderField label="Zielalter" value={config.targetAge} onChange={(v) => onChange({ targetAge: Math.round(v) })} min={20} max={100} step={1} suffix="J." />
        )}
      </Section>

      <Section
        icon={<Coins size={16} />}
        title="Einzahlungen"
        summary={`${formatEuro(config.initialCapital)} Start · ${formatEuro(config.monthlySavings)}/Monat`}
      >
        <NumberField label="Startkapital" value={config.initialCapital} onChange={(v) => onChange({ initialCapital: v ?? 0 })} suffix="€" min={0} />
        <SliderField
          label="Sparrate pro Monat"
          value={config.monthlySavings}
          onChange={(v) => onChange({ monthlySavings: v })}
          min={0}
          max={5000}
          step={25}
          suffix="€"
          inputMax={1_000_000}
        />
        <SliderField
          label="Jährliche Erhöhung"
          hint="Dynamik: Die Sparrate steigt jedes Jahr um diesen Prozentsatz, z. B. passend zu Gehaltserhöhungen."
          value={config.savingsGrowth}
          onChange={(v) => onChange({ savingsGrowth: v })}
          min={0}
          max={10}
          step={0.5}
          suffix="%"
          inputMax={50}
        />

      </Section>

      <Section
        icon={<Milestone size={16} />}
        title="Ereignisse"
        summary={eventCount ? `${eventCount} geplant` : 'Keine geplant'}
      >
        <p className="text-xs leading-snug text-muted">
          Alles, was vom gleichmäßigen Sparplan abweicht: mehr oder weniger sparen, Geld einzahlen oder herausnehmen. Einmalige Beträge gelten jeweils im Januar des Jahres.
        </p>
        <ListBlock
          title="Sparrate ändern"
          hint="Ab dem gewählten Jahr gilt die neue monatliche Rate (die jährliche Erhöhung startet von dort neu)."
          empty="Keine Änderungen geplant."
          onAdd={() =>
            onChange({
              savingsSteps: [
                ...config.savingsSteps,
                { id: newId(), year: pickYear(5), monthlyAmount: Math.round(config.monthlySavings * 1.5) || 250 },
              ],
            })
          }
        >
          {config.savingsSteps.map((s) => (
            <ListRow key={s.id} onRemove={() => onChange({ savingsSteps: config.savingsSteps.filter((x) => x.id !== s.id) })}>
              <Select aria-label="Ab Jahr" size="sm" value={s.year} onChange={(v) => updateStep(s.id, { year: v })} options={withValue(yearOptions, s.year)} className="flex-1" />
              <NumberInput aria-label="Neue Rate pro Monat" size="sm" value={s.monthlyAmount} onChange={(v) => updateStep(s.id, { monthlyAmount: v ?? 0 })} suffix="€" min={0} className="w-28" />
            </ListRow>
          ))}
        </ListBlock>

        <ListBlock
          title="Einmalzahlungen"
          hint="Zum Beispiel Bonus, Erbschaft oder Bausparvertrag. Wird im Januar des Jahres investiert."
          empty="Keine Einmalzahlungen."
          onAdd={() => onChange({ lumpSums: [...config.lumpSums, { id: newId(), year: pickYear(5), amount: 10_000 }] })}
        >
          {config.lumpSums.map((s) => (
            <ListRow key={s.id} onRemove={() => onChange({ lumpSums: config.lumpSums.filter((x) => x.id !== s.id) })}>
              <Select aria-label="Jahr" size="sm" value={s.year} onChange={(v) => updateLump(s.id, { year: v })} options={withValue(yearOptions, s.year)} className="flex-1" />
              <NumberInput aria-label="Betrag" size="sm" value={s.amount} onChange={(v) => updateLump(s.id, { amount: v ?? 0 })} suffix="€" min={0} className="w-28" />
            </ListRow>
          ))}
        </ListBlock>

        <ListBlock
          title="Einmalige Entnahmen"
          hint="Zum Beispiel Eigenkapital für eine Immobilie. Der Betrag ist netto: So viel kommt im Januar des Jahres auf deinem Konto an. Verkauft wird entsprechend mehr, weil Kursgewinne versteuert werden."
          empty="Keine einmaligen Entnahmen."
          onAdd={() => onChange({ oneOffWithdrawals: [...config.oneOffWithdrawals, { id: newId(), year: pickYear(5), amount: 50_000 }] })}
        >
          {config.oneOffWithdrawals.map((s) => (
            <ListRow key={s.id} onRemove={() => onChange({ oneOffWithdrawals: config.oneOffWithdrawals.filter((x) => x.id !== s.id) })}>
              <Select aria-label="Jahr" size="sm" value={s.year} onChange={(v) => updateOneOff(s.id, { year: v })} options={withValue(yearOptions, s.year)} className="flex-1" />
              <NumberInput aria-label="Netto-Betrag" size="sm" value={s.amount} onChange={(v) => updateOneOff(s.id, { amount: v ?? 0 })} suffix="€" min={0} className="w-28" />
            </ListRow>
          ))}
        </ListBlock>

        <ListBlock
          title="Befristete Entnahmen"
          hint="Ein monatlicher Netto-Betrag für einen begrenzten Zeitraum, z. B. um Teilzeit oder ein Sabbatical auszugleichen. Gilt von Januar des ersten bis Dezember des letzten Jahres. Die Sparrate läuft dabei weiter – solange du noch sparst, ist es günstiger, zuerst die Sparrate zu senken, weil dann keine Steuer anfällt. Die dauerhafte Entnahme im Ruhestand stellst du unter „Entnahme“ ein."
          empty="Keine befristeten Entnahmen."
          onAdd={() =>
            onChange({
              withdrawalPhases: [
                ...config.withdrawalPhases,
                { id: newId(), startYear: pickYear(10), endYear: pickYear(14), monthlyNet: 500, inflationAdjust: true },
              ],
            })
          }
        >
          {config.withdrawalPhases.map((p) => (
            <div key={p.id} className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Select
                    aria-label="Von Jahr"
                    size="sm"
                    value={p.startYear}
                    onChange={(v) => updatePhase(p.id, { startYear: v, endYear: Math.max(v, p.endYear) })}
                    options={withValue(shortYearOptions, p.startYear)}
                    className="min-w-0 flex-1"
                  />
                  <span className="text-xs text-muted">bis</span>
                  <Select
                    aria-label="Bis Jahr"
                    size="sm"
                    value={p.endYear}
                    onChange={(v) => updatePhase(p.id, { endYear: v, startYear: Math.min(v, p.startYear) })}
                    options={withValue(shortYearOptions, p.endYear)}
                    className="min-w-0 flex-1"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <NumberInput aria-label="Netto-Betrag pro Monat" size="sm" value={p.monthlyNet} onChange={(v) => updatePhase(p.id, { monthlyNet: v ?? 0 })} suffix="€/Mon." min={0} className="w-32" />
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-2" title="Der Betrag steigt jedes Jahr mit der Inflationsrate.">
                    <input type="checkbox" className="size-3.5 accent-(--accent)" checked={p.inflationAdjust} onChange={(e) => updatePhase(p.id, { inflationAdjust: e.target.checked })} />
                    mit Inflation
                  </label>
                </div>
              </div>
              <IconButton label="Entfernen" variant="danger" onClick={() => onChange({ withdrawalPhases: config.withdrawalPhases.filter((x) => x.id !== p.id) })}>
                <Trash2 size={15} />
              </IconButton>
            </div>
          ))}
        </ListBlock>
      </Section>

      <WithdrawalSection config={config} onChange={onChange} yearOptions={yearOptions} />

      <Section
        icon={<TrendingUp size={16} />}
        title="Markt"
        summary={`${formatPercent(config.totalReturn)} Rendite · ${formatPercent(config.inflation)} Inflation${config.monteCarlo.enabled ? ' · Monte Carlo' : ''}`}
      >
        <SliderField
          label="Gesamtrendite p. a."
          hint="Durchschnittliche jährliche Rendite, wie sie für Indizes angegeben wird – der MSCI World lag historisch bei etwa 7–8 % (nominal). Inklusive Ausschüttungen, vor Kosten und Steuern."
          value={config.totalReturn}
          onChange={(v) => onChange({ totalReturn: v })}
          min={0}
          max={12}
          step={0.1}
          suffix="%"
          inputMin={-20}
          inputMax={50}
        />
        <SliderField
          label="Davon Ausschüttung"
          hint="Anteil der Rendite, der als Dividende ausgeschüttet wird. Bei thesaurierenden ETFs 0 % eintragen."
          value={config.dividendYield}
          onChange={(v) => onChange({ dividendYield: v })}
          min={0}
          max={8}
          step={0.1}
          suffix="%"
          inputMax={30}
        />
        <Field
          label="Ausschüttungen"
          hint="Reinvestierte Dividenden lassen das Depot weiter wachsen. Ausgezahlte Dividenden landen auf deinem Konto und stehen dir als Einkommen zur Verfügung."
        >
          <Select
            aria-label="Umgang mit Ausschüttungen"
            value={config.dividendStrategy}
            onChange={(v) => onChange({ dividendStrategy: v })}
            options={[
              { value: 'reinvest', label: 'Immer reinvestieren' },
              { value: 'payout', label: 'Immer auszahlen' },
              { value: 'withWithdrawal', label: 'Ab Entnahmebeginn auszahlen' },
              { value: 'fromYear', label: 'Ab einem Jahr auszahlen' },
            ]}
          />
        </Field>
        {config.dividendStrategy === 'fromYear' && (
          <Field label="Auszahlen ab">
            <Select
              aria-label="Dividenden auszahlen ab"
              value={config.dividendPayoutYear}
              onChange={(v) => onChange({ dividendPayoutYear: v })}
              options={withValue(yearOptions, config.dividendPayoutYear)}
            />
          </Field>
        )}
        {config.dividendStrategy === 'withWithdrawal' && !config.withdrawal.enabled && (
          <p className="-mt-2 text-xs text-muted">Keine Entnahme geplant – Dividenden werden durchgehend reinvestiert.</p>
        )}
        <SliderField
          label="Inflation p. a."
          hint="Damit wird die Kaufkraft berechnet: Was ist das Vermögen in heutigem Geld wert?"
          value={config.inflation}
          onChange={(v) => onChange({ inflation: v })}
          min={0}
          max={8}
          step={0.1}
          suffix="%"
          inputMin={-5}
          inputMax={30}
        />
        <SliderField
          label="Bandbreite im Chart"
          hint="Zeigt zusätzlich ein pessimistisches und ein optimistisches Szenario mit Rendite minus/plus diesem Wert."
          value={config.returnSpread}
          onChange={(v) => onChange({ returnSpread: v })}
          min={0}
          max={5}
          step={0.5}
          suffix="± %"
          inputMax={10}
        />
        <div className="space-y-3 rounded-xl border border-line p-3">
          <Switch
            label="Schwankungen simulieren (Monte Carlo)"
            description="Spielt den Plan tausendfach mit zufälligen Renditen durch und zeigt im Tab „Monte Carlo“, wie oft er aufgeht. Der Plan selbst bleibt unverändert."
            checked={config.monteCarlo.enabled}
            onChange={(v) => setMc({ enabled: v })}
          />
          {config.monteCarlo.enabled && (
            <>
              <SliderField
                label="Volatilität p. a."
                hint="Die Schwankung, wie Factsheets sie angeben (aus Monatsrenditen aufs Jahr hochgerechnet). Der MSCI World liegt historisch bei etwa 15 %, Mischfonds deutlich darunter. Weil sich Krisen im Modell wie in der Realität über Monate hinziehen, schwanken ganze Kalenderjahre stärker – beim MSCI World um rund 19 %."
                value={config.monteCarlo.volatility}
                onChange={(v) => setMc({ volatility: v })}
                min={0}
                max={30}
                step={0.5}
                suffix="%"
                inputMax={100}
              />
              <Field label="Anzahl Verläufe" hint="Mehr Verläufe machen die Wahrscheinlichkeiten genauer (bei 1.000 etwa ± 1,5 Prozentpunkte, bei 5.000 etwa ± 0,7), rechnen aber länger.">
                <Segmented
                  aria-label="Anzahl Verläufe"
                  size="sm"
                  value={String(config.monteCarlo.runs) as '1000' | '5000'}
                  onChange={(v) => setMc({ runs: Number(v) })}
                  options={[
                    { value: '1000', label: '1.000' },
                    { value: '5000', label: '5.000 (genauer)' },
                  ]}
                />
              </Field>
            </>
          )}
        </div>
      </Section>

      <Section
        icon={<Receipt size={16} />}
        title="Kosten"
        summary={`${formatPercent(config.ter)} TER · ${formatPercent(config.purchaseFee)} Kauf`}
        defaultOpen={false}
      >
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Laufende Kosten"
            hint="TER bzw. Depotgebühren pro Jahr, in % des Depotwerts."
            value={config.ter}
            onChange={(v) => onChange({ ter: v ?? 0 })}
            suffix="%"
            min={0}
            max={10}
          />
          <NumberField
            label="Kaufgebühr"
            hint="Ordergebühr in % jeder Einzahlung (Sparplan, Einmalzahlung, Startkapital)."
            value={config.purchaseFee}
            onChange={(v) => onChange({ purchaseFee: v ?? 0 })}
            suffix="%"
            min={0}
            max={10}
          />
        </div>
      </Section>

      <Section
        icon={<Landmark size={16} />}
        title="Steuern"
        summary={`${formatPercent(taxRate * 100)} effektiv · ${formatEuro(config.allowance)} Freibetrag`}
        defaultOpen={false}
      >
        <Field label="Fondsart" hint="Bestimmt die Teilfreistellung: Bei Aktienfonds (≥ 51 % Aktien) sind 30 % der Erträge steuerfrei, bei Mischfonds 15 %.">
          <Segmented
            aria-label="Fondsart"
            size="sm"
            value={config.fundType}
            onChange={(v) => onChange({ fundType: v })}
            options={[
              { value: 'equity', label: 'Aktien-ETF' },
              { value: 'mixed', label: 'Mischfonds' },
              { value: 'other', label: 'Sonstige' },
            ]}
          />
        </Field>
        <p className="-mt-2 text-xs text-muted">Teilfreistellung: {formatNumber(PARTIAL_EXEMPTION[config.fundType] * 100)} % der Erträge steuerfrei</p>

        <Field label="Sparerpauschbetrag">
          <div className="flex gap-2">
            <Segmented
              aria-label="Veranlagung"
              size="sm"
              className="shrink-0"
              value={config.allowance === 1000 ? 'single' : config.allowance === 2000 ? 'joint' : 'custom'}
              onChange={(v) => v !== 'custom' && onChange({ allowance: v === 'single' ? 1000 : 2000 })}
              options={[
                { value: 'single', label: 'Single' },
                { value: 'joint', label: 'Paar' },
              ]}
            />
            <NumberInput aria-label="Sparerpauschbetrag" size="sm" value={config.allowance} onChange={(v) => onChange({ allowance: v ?? 0 })} suffix="€" min={0} className="flex-1" />
          </div>
        </Field>

        <Field label="Kirchensteuer">
          <Segmented
            aria-label="Kirchensteuer"
            size="sm"
            value={String(config.churchTax) as '0' | '8' | '9'}
            onChange={(v) => onChange({ churchTax: Number(v) as 0 | 8 | 9 })}
            options={[
              { value: '0', label: 'Keine' },
              { value: '8', label: '8 % (BY, BW)' },
              { value: '9', label: '9 %' },
            ]}
          />
        </Field>
        <p className="-mt-2 text-xs text-muted">
          Abgeltungsteuer + Soli{config.churchTax ? ' + Kirchensteuer' : ''} = {formatPercent(taxRate * 100)} effektiv
        </p>

        <div className="space-y-3 rounded-xl border border-line p-3">
          <Switch
            label="Vorabpauschale berücksichtigen"
            description="Jährliche Pauschalbesteuerung, wenn ein Fonds weniger ausschüttet als der Basisertrag (Basiszins × 70 %)."
            checked={config.applyAdvanceLumpSum}
            onChange={(v) => onChange({ applyAdvanceLumpSum: v })}
          />
          {config.applyAdvanceLumpSum && (
            <NumberField
              label="Basiszins"
              hint="Wird jedes Jahr vom Bundesfinanzministerium festgelegt (2025: 2,53 %, 2026: 3,20 %). Hier für die gesamte Laufzeit angenommen."
              value={config.baseRate}
              onChange={(v) => onChange({ baseRate: v ?? 0 })}
              suffix="%"
              min={0}
              max={20}
            />
          )}
        </div>
      </Section>

      <Section icon={<Target size={16} />} title="Ziel" summary={config.goal.enabled ? 'Aktiv' : 'Aus'} defaultOpen={false}>
        <Switch
          label="Zielrechner aktivieren"
          description="Berechnet, was du brauchst, um dein Wunschvermögen oder deine Wunschdividende zu erreichen."
          checked={config.goal.enabled}
          onChange={(v) => setGoal({ enabled: v })}
        />
        {config.goal.enabled && (
          <>
            <Field label={config.withdrawal.enabled ? 'Zielvermögen bei Entnahmebeginn' : 'Zielvermögen am Ende'}>
              <div className="flex gap-2">
                <NumberInput aria-label="Zielvermögen" value={config.goal.wealth} onChange={(v) => setGoal({ wealth: v })} suffix="€" min={0} allowEmpty placeholder="z. B. 1.000.000" className="flex-1" />
                <BasisSelect value={config.goal.wealthBasis} onChange={(v) => setGoal({ wealthBasis: v })} />
              </div>
            </Field>
            <Field
              label="Netto-Dividende pro Monat"
              hint={
                config.withdrawal.enabled
                  ? 'Durchschnitt im Jahr vor Entnahmebeginn, nach Steuern.'
                  : 'Durchschnitt der letzten 12 Monate der Laufzeit, nach Steuern.'
              }
            >
              <div className="flex gap-2">
                <NumberInput aria-label="Ziel-Dividende" value={config.goal.monthlyDividend} onChange={(v) => setGoal({ monthlyDividend: v })} suffix="€" min={0} allowEmpty placeholder="z. B. 2.000" className="flex-1" />
                <BasisSelect value={config.goal.dividendBasis} onChange={(v) => setGoal({ dividendBasis: v })} />
              </div>
            </Field>
            <Field label="Was soll berechnet werden?">
              <Segmented
                aria-label="Zu berechnende Größe"
                size="sm"
                value={config.goal.solveFor}
                onChange={(v) => setGoal({ solveFor: v })}
                options={[
                  { value: 'savings', label: 'Sparrate' },
                  { value: 'initial', label: 'Startkapital' },
                  { value: 'return', label: 'Rendite' },
                ]}
              />
            </Field>
          </>
        )}
      </Section>
    </div>
  );
}

function WithdrawalSection({
  config,
  onChange,
  yearOptions,
}: Props & { yearOptions: { value: number; label: string }[] }) {
  const w = config.withdrawal;
  const setW = (patch: Partial<SimulationConfig['withdrawal']>) => onChange({ withdrawal: { ...w, ...patch } });
  const lastYear = yearOptions[yearOptions.length - 1]?.value ?? 0;
  const outside = w.enabled && w.startYear > lastYear;
  const startAge = w.startYear - parseDate(config.birthDate).y;
  const yearsUntil = Math.max(0, w.startYear - parseDate(config.startDate).y);
  const todayValue = w.monthlyNet / Math.pow(1 + config.inflation / 100, yearsUntil);
  const paysOutAtStart = config.dividendYield > 0 ? !reinvestsIn({ ...config, withdrawal: { ...w, enabled: true } }, w.startYear) : false;
  const amountMode = w.mode !== 'rate'; // a net amount per month: entered ('fixed') or calculated ('target')
  const countsDividends = amountMode && w.countDividends && paysOutAtStart;
  const isTarget = w.enabled && w.mode === 'target';
  const target = useMemo(() => (isTarget ? solveWithdrawal(config) : null), [isTarget, config]);
  const targetToday = target ? target.monthlyNet / Math.pow(1 + config.inflation / 100, yearsUntil) : 0;

  const enable = (on: boolean) => {
    if (!on) return setW({ enabled: false });
    // Sensible defaults: start at 67 (or two thirds into the plan) and make sure the plan
    // runs long enough to show the withdrawal phase.
    const birthY = parseDate(config.birthDate).y;
    const startY = parseDate(config.startDate).y;
    const at67 = birthY + 67;
    const startYear = at67 > startY ? at67 : startY + Math.max(1, Math.round((lastYear - startY) * (2 / 3)));
    const patch: Partial<SimulationConfig> = { withdrawal: { ...w, enabled: true, startYear } };
    if (lastYear - startYear < 10) {
      patch.durationMode = 'age';
      patch.targetAge = Math.max(config.targetAge, startYear - birthY + 23, 90);
    }
    onChange(patch);
  };

  const summary = !w.enabled
    ? 'Aus'
    : `ab ${w.startYear} · ${
        w.mode === 'fixed'
          ? `${formatEuro(w.monthlyNet)}/Monat`
          : w.mode === 'rate'
            ? `${formatPercent(w.rate)} p. a.`
            : `${formatEuro(w.endWealth)} mit ${w.lifeExpectancy} J.`
      }`;

  return (
    <Section icon={<HandCoins size={16} />} title="Entnahme" summary={summary} defaultOpen={w.enabled}>
      <Switch
        label="Entnahmephase planen"
        description="Ab einem bestimmten Jahr dauerhaft Geld aus dem Depot entnehmen, z. B. als Zusatzrente. Einmalige und befristete Entnahmen findest du unter „Ereignisse“."
        checked={w.enabled}
        onChange={enable}
      />
      {w.enabled && (
        <>
          <Field label="Beginn" hint={
              isTarget
                ? 'Die Entnahme startet im Januar des gewählten Jahres und läuft bis zur Lebenserwartung.'
                : 'Die Entnahme startet im Januar des gewählten Jahres und läuft bis zum Ende der Simulation.'
            }
          >
            <Select aria-label="Beginn der Entnahme" value={w.startYear} onChange={(v) => setW({ startYear: v })} options={withValue(yearOptions, w.startYear)} />
          </Field>
          {outside && (
            <p className="rounded-lg bg-critical-soft px-3 py-2 text-xs leading-snug text-critical">
              {isTarget
                ? `Der Entnahmebeginn (${startAge} J.) liegt nach der Lebenserwartung. Wähle einen früheren Beginn oder erhöhe die Lebenserwartung.`
                : `Die Simulation endet vor dem Entnahmebeginn (${startAge} J.). Verlängere die Laufzeit im Abschnitt „Zeitraum“.`}
            </p>
          )}
          <Segmented
            aria-label="Art der Entnahme"
            size="sm"
            value={w.mode}
            onChange={(v) => setW({ mode: v })}
            options={[
              { value: 'fixed', label: 'Fester Betrag' },
              { value: 'rate', label: 'Entnahmerate' },
              { value: 'target', label: 'Berechnen' },
            ]}
          />
          {w.mode === 'target' ? (
            <>
              <p className="-mt-1 text-xs leading-snug text-muted">
                Berechnet, wie viel du pro Monat entnehmen kannst, damit bis zu deiner Lebenserwartung genau das gewünschte Restvermögen übrig bleibt.
              </p>
              <SliderField
                label="Lebenserwartung"
                hint="Bis zu diesem Alter soll das Depot reichen. Die Simulation läuft dann genau bis zu diesem Geburtstag."
                value={w.lifeExpectancy}
                onChange={(v) => setW({ lifeExpectancy: Math.round(v) })}
                min={60}
                max={110}
                step={1}
                suffix="J."
                inputMin={Math.max(1, parseDate(config.startDate).y - parseDate(config.birthDate).y + 1)}
                inputMax={120}
              />
              <Field
                label="Restvermögen am Ende"
                hint="Depotwert, der mit der Lebenserwartung noch vorhanden sein soll, z. B. zum Vererben. 0 € bedeutet: Das Depot wird vollständig aufgebraucht. Gemeint ist der Depotwert vor Steuern – Erben übernehmen die Anteile samt Einstandskursen."
              >
                <div className="flex gap-2">
                  <NumberInput aria-label="Restvermögen am Ende" value={w.endWealth} onChange={(v) => setW({ endWealth: v ?? 0 })} suffix="€" min={0} className="flex-1" />
                  <BasisSelect value={w.endWealthBasis} onChange={(v) => setW({ endWealthBasis: v })} />
                </div>
              </Field>
              {target && (
                <div className={cx('rounded-xl px-3.5 py-3', target.reachable ? 'bg-accent-soft' : 'bg-critical-soft')}>
                  {target.reachable ? (
                    <>
                      <p className="text-xs text-ink-2">{countsDividends ? 'Mögliches Netto-Einkommen pro Monat' : 'Mögliche Netto-Entnahme pro Monat'}</p>
                      <p className="tnum mt-0.5 text-[20px] leading-tight font-semibold text-ink">{formatEuro(target.monthlyNet)}</p>
                      <p className="mt-1 text-xs leading-snug text-muted">
                        {w.inflationAdjust && config.inflation > 0 ? `Im ersten Jahr (${w.startYear}), danach jährlich an die Inflation angepasst.` : `Gleichbleibend ab ${w.startYear}.`}
                        {yearsUntil > 0 && config.inflation > 0 ? ` Entspricht heute etwa ${formatEuro(targetToday)} Kaufkraft.` : ''}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs leading-snug text-critical">
                      Das Restvermögen von {formatEuro(target.endWealth)} wird selbst ohne Entnahme nicht erreicht. Senke das Restvermögen oder erhöhe Sparrate, Rendite oder Lebenserwartung.
                    </p>
                  )}
                </div>
              )}
            </>
          ) : w.mode === 'fixed' ? (
            <NumberField
              label={countsDividends ? 'Netto-Einkommen pro Monat' : 'Netto-Entnahme pro Monat'}
              hint={
                countsDividends
                  ? 'Gesamtbetrag aus ausgezahlten Dividenden und Verkäufen, der nach Steuern auf deinem Konto ankommt. Verkauft wird nur, was die Dividenden nicht abdecken.'
                  : 'Betrag aus Verkäufen, der nach Steuern auf deinem Konto ankommt. Verkauft wird entsprechend mehr, da Kursgewinne versteuert werden.'
              }
              value={w.monthlyNet}
              onChange={(v) => setW({ monthlyNet: v ?? 0 })}
              suffix="€"
              min={0}
            />
          ) : (
            <SliderField
              label="Entnahmerate p. a."
              hint="Prozent des Depotwerts zu Beginn, vor Steuern (z. B. 4 %-Regel). Der Euro-Betrag wird danach festgehalten und optional an die Inflation angepasst."
              value={w.rate}
              onChange={(v) => setW({ rate: v })}
              min={0}
              max={10}
              step={0.1}
              suffix="%"
              inputMax={100}
            />
          )}
          {w.mode === 'fixed' && yearsUntil > 0 && config.inflation > 0 && (
            <p className="-mt-2 text-xs text-muted">Entspricht heute etwa {formatEuro(todayValue)} Kaufkraft.</p>
          )}
          {config.dividendYield > 0 && <Switch
            label="Dividenden ab Beginn auszahlen"
            description={
              config.dividendStrategy === 'fromYear'
                ? `Aktuell: Auszahlung ab ${config.dividendPayoutYear} (siehe „Markt“).`
                : 'Statt zu reinvestieren, fließen die Netto-Dividenden ab Entnahmebeginn auf dein Konto.'
            }
            checked={paysOutAtStart}
            onChange={(v) => onChange({ dividendStrategy: v ? 'withWithdrawal' : 'reinvest' })}
          />}
          {amountMode && paysOutAtStart && (
            <Switch
              label="Dividenden auf den Betrag anrechnen"
              description={
                w.countDividends
                  ? 'Es wird nur verkauft, was die Dividenden nicht abdecken. Das schont das Depot.'
                  : 'Der Betrag wird zusätzlich zu den Dividenden verkauft.'
              }
              checked={w.countDividends}
              onChange={(v) => setW({ countDividends: v })}
            />
          )}
          <Switch
            label="Jährlich an Inflation anpassen"
            description="Der Betrag steigt jedes Jahr mit der Inflationsrate, damit die Kaufkraft erhalten bleibt."
            checked={w.inflationAdjust}
            onChange={(v) => setW({ inflationAdjust: v })}
          />
          {amountMode && (
            <p className="-mt-1 text-xs leading-snug text-muted">
              Wie gut der Betrag schwankende Märkte übersteht – und ob Leitplanken helfen, die in schlechten Jahren kürzen – zeigt der Tab „Monte Carlo“.
            </p>
          )}
          <Switch
            label="Sparrate ab Beginn stoppen"
            description="Keine monatlichen Einzahlungen mehr während der Entnahme. Einmalzahlungen bleiben bestehen."
            checked={w.stopContributions}
            onChange={(v) => setW({ stopContributions: v })}
          />
        </>
      )}
    </Section>
  );
}

function BasisSelect({ value, onChange }: { value: 'nominal' | 'real'; onChange: (v: 'nominal' | 'real') => void }) {
  return (
    <Select
      aria-label="Betrachtung"
      value={value}
      onChange={onChange}
      className="w-32"
      options={[
        { value: 'nominal', label: 'Nominal' },
        { value: 'real', label: 'Kaufkraft' },
      ]}
    />
  );
}

/** Keeps a stored year selectable even if it is outside the current horizon. */
function withValue(options: { value: number; label: string }[], year: number) {
  if (options.some((o) => o.value === year)) return options;
  return [{ value: year, label: `${year} (außerhalb)` }, ...options];
}

function ListBlock({ title, hint, empty, onAdd, children }: { title: string; hint: string; empty: string; onAdd: () => void; children: React.ReactNode[] }) {
  return (
    <div className="space-y-2 rounded-xl border border-line p-3">
      <Field
        label={title}
        hint={hint}
        trailing={
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-accent transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Plus size={14} /> Hinzufügen
          </button>
        }
      >
        {children.length ? <div className="space-y-2">{children}</div> : <p className="text-xs text-muted">{empty}</p>}
      </Field>
    </div>
  );
}

function ListRow({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2">
      {children}
      <IconButton label="Entfernen" variant="danger" onClick={onRemove}>
        <Trash2 size={15} />
      </IconButton>
    </div>
  );
}
