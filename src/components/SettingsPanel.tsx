import { useId, useMemo } from 'react';
import { CalendarClock, Coins, Landmark, Plus, Receipt, Target, Trash2, TrendingUp } from 'lucide-react';
import type { LumpSum, SavingsStep, SimulationConfig } from '../types';
import { PARTIAL_EXEMPTION, effectiveTaxRate, simulationYears } from '../lib/simulation';
import { formatEuro, formatNumber, formatPercent } from '../lib/format';
import { newId } from '../lib/storage';
import { Field, IconButton, NumberField, NumberInput, Section, Segmented, Select, SliderField, Switch, TextInput } from './ui';

interface Props {
  config: SimulationConfig;
  onChange: (patch: Partial<SimulationConfig>) => void;
}

export default function SettingsPanel({ config, onChange }: Props) {
  const years = useMemo(() => simulationYears(config), [config.birthDate, config.startDate, config.durationMode, config.durationYears, config.targetAge]);
  const yearOptions = years.map((y) => ({ value: y.year, label: `${y.year} · ${y.age} J.` }));
  const firstYear = years[0]?.year ?? new Date().getFullYear();
  const pickYear = (offset: number) => years[Math.min(years.length - 1, offset)]?.year ?? firstYear;

  const ids = { birth: useId(), start: useId() };
  const taxRate = effectiveTaxRate(config);
  const setGoal = (patch: Partial<SimulationConfig['goal']>) => onChange({ goal: { ...config.goal, ...patch } });

  const updateStep = (id: string, patch: Partial<SavingsStep>) =>
    onChange({ savingsSteps: config.savingsSteps.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const updateLump = (id: string, patch: Partial<LumpSum>) =>
    onChange({ lumpSums: config.lumpSums.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  const durationSummary =
    config.durationMode === 'years' ? `${config.durationYears} Jahre` : `bis Alter ${config.targetAge}`;

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
        <Segmented
          aria-label="Laufzeit festlegen"
          value={config.durationMode}
          onChange={(v) => onChange({ durationMode: v })}
          options={[
            { value: 'years', label: 'Anzahl Jahre' },
            { value: 'age', label: 'Bis Zielalter' },
          ]}
        />
        {config.durationMode === 'years' ? (
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
      </Section>

      <Section
        icon={<TrendingUp size={16} />}
        title="Markt"
        summary={`${formatPercent(config.totalReturn)} Rendite · ${formatPercent(config.inflation)} Inflation`}
      >
        <SliderField
          label="Gesamtrendite p. a."
          hint="Erwartete jährliche Rendite inklusive Ausschüttungen, vor Kosten und Steuern. Der MSCI World lag historisch bei etwa 7–8 % (nominal)."
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
        <Switch
          label="Ausschüttungen reinvestieren"
          description={config.reinvestDividends ? 'Netto-Dividenden fließen zurück ins Depot.' : 'Netto-Dividenden werden ausgezahlt.'}
          checked={config.reinvestDividends}
          onChange={(v) => onChange({ reinvestDividends: v })}
        />
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
            <Field label="Zielvermögen am Ende">
              <div className="flex gap-2">
                <NumberInput aria-label="Zielvermögen" value={config.goal.wealth} onChange={(v) => setGoal({ wealth: v })} suffix="€" min={0} allowEmpty placeholder="z. B. 1.000.000" className="flex-1" />
                <BasisSelect value={config.goal.wealthBasis} onChange={(v) => setGoal({ wealthBasis: v })} />
              </div>
            </Field>
            <Field label="Netto-Dividende pro Monat" hint="Durchschnitt der letzten 12 Monate der Laufzeit, nach Steuern.">
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
