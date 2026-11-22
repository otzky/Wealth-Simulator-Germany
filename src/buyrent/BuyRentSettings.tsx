import { useMemo } from 'react';
import { Banknote, CalendarRange, Home, KeyRound, Receipt, TrendingUp, Wrench } from 'lucide-react';
import { formatEuro, formatPercent } from '../lib/format';
import { Field, NumberField, Section, Select, SliderField, Switch } from '../components/ui';
import type { ChurchTax, FundType } from '../types';
import { STATES, transferTaxRate } from './defaults';
import type { BuyRentConfig, InvestSettings, StateCode } from './types';

interface Props {
  config: BuyRentConfig;
  onChange: (patch: Partial<BuyRentConfig>) => void;
}

export default function BuyRentSettings({ config: c, onChange }: Props) {
  const setInvest = (patch: Partial<InvestSettings>) => onChange({ invest: { ...c.invest, ...patch } });
  const costs = useMemo(() => {
    const pct = transferTaxRate(c.state) + c.notary + c.broker;
    const total = (c.price * pct) / 100;
    const loan = Math.max(0, c.price + total - c.equity);
    return { pct, total, loan, payment: (loan * (c.interest + c.repayment)) / 100 / 12 };
  }, [c.state, c.notary, c.broker, c.price, c.equity, c.interest, c.repayment]);
  const maintenanceMonthly = (c.price * c.maintenance) / 100 / 12;

  return (
    <div>
      <Section icon={<Home size={16} />} title="Immobilie" summary={`${formatEuro(c.price)} · ${formatPercent(c.appreciation)} Wertsteigerung`}>
        <NumberField label="Kaufpreis" value={c.price} onChange={(v) => onChange({ price: v ?? 0 })} min={0} suffix="€" />
        <SliderField
          label="Wertsteigerung p. a."
          hint="Wie viel die Immobilie jährlich an Wert gewinnt, nominal und nach Alterung des Gebäudes. 2 % entspricht der eingestellten Inflation, also real gleichbleibenden Preisen; langfristig sind deutsche Wohnimmobilien real kaum gestiegen, zwischen 2010 und 2022 dagegen stark. Einer der wichtigsten Regler – die Kipppunkte zeigen, ab wann Kaufen vorn liegt."
          value={c.appreciation}
          onChange={(v) => onChange({ appreciation: v })}
          min={-2}
          max={6}
          step={0.1}
          suffix="%"
          inputMin={-20}
          inputMax={30}
        />
      </Section>

      <Section icon={<Receipt size={16} />} title="Kaufnebenkosten" summary={`${formatPercent(costs.pct)} · ${formatEuro(costs.total)}`}>
        <Field label="Bundesland" hint="Bestimmt die Grunderwerbsteuer: 3,5 % in Bayern bis 6,5 % in Brandenburg, NRW, Saarland und Schleswig-Holstein (Stand November 2026).">
          <Select<StateCode>
            aria-label="Bundesland"
            value={c.state}
            onChange={(v) => onChange({ state: v })}
            options={STATES.map((s) => ({ value: s.code, label: `${s.name} · ${formatPercent(s.transferTax)}` }))}
          />
        </Field>
        <SliderField
          label="Notar und Grundbuch"
          hint="Gebühren für Beurkundung, Grundschuld und Eintragung; üblich sind 1,5 bis 2 % des Kaufpreises."
          value={c.notary}
          onChange={(v) => onChange({ notary: v })}
          min={0}
          max={3}
          step={0.1}
          suffix="%"
          inputMax={10}
        />
        <SliderField
          label="Makler (Käuferanteil)"
          hint="Seit 2020 teilen sich Käufer und Verkäufer die Provision; üblich sind 3,57 % inklusive Mehrwertsteuer je Seite. 0 % ohne Makler."
          value={c.broker}
          onChange={(v) => onChange({ broker: v })}
          min={0}
          max={7.14}
          step={0.01}
          suffix="%"
          inputMax={10}
        />
        <p className="text-xs text-muted">
          Zusammen {formatEuro(costs.total)}. Sie sind beim Kauf weg und zählen nicht zum Wert der Immobilie.
        </p>
      </Section>

      <Section icon={<Banknote size={16} />} title="Finanzierung" summary={`${formatEuro(c.equity)} Eigenkapital · ${formatPercent(c.interest)} Zins`}>
        <NumberField
          label="Eigenkapital"
          hint="Geld, das du in den Kauf steckst. Beim Mieten wird genau dieser Betrag am Anfang angelegt."
          value={c.equity}
          onChange={(v) => onChange({ equity: v ?? 0 })}
          min={0}
          suffix="€"
        />
        <SliderField label="Sollzins p. a." value={c.interest} onChange={(v) => onChange({ interest: v })} min={0} max={8} step={0.05} suffix="%" inputMax={30} />
        <SliderField
          label="Anfängliche Tilgung"
          hint="Anteil des Kredits, der im ersten Jahr zurückgezahlt wird. Die Rate bleibt gleich, die Tilgung wächst mit jeder Rate, weil die Zinsen sinken."
          value={c.repayment}
          onChange={(v) => onChange({ repayment: v })}
          min={0}
          max={8}
          step={0.1}
          suffix="%"
          inputMax={30}
        />
        <SliderField label="Zinsbindung" value={c.fixedYears} onChange={(v) => onChange({ fixedYears: Math.round(v) })} min={5} max={30} step={1} suffix="J." inputMin={1} inputMax={40} />
        <Switch
          checked={c.followUpRate == null}
          onChange={(same) => onChange({ followUpRate: same ? null : c.interest })}
          label="Anschlusszins wie Sollzins"
          hint="Nach der Zinsbindung gilt für die Restschuld ein neuer Zins, den heute niemand kennt. Ausschalten, um einen höheren oder niedrigeren anzunehmen. Die Rate bleibt gleich; deckt sie Zinsen plus 1 % Tilgung nicht mehr, steigt sie."
        />
        {c.followUpRate != null && (
          <SliderField label="Anschlusszins" value={c.followUpRate} onChange={(v) => onChange({ followUpRate: v })} min={0} max={10} step={0.05} suffix="%" inputMax={30} />
        )}
        <p className="text-xs text-muted">
          Kredit {formatEuro(costs.loan)} · Rate {formatEuro(costs.payment)} im Monat
        </p>
      </Section>

      <Section icon={<Wrench size={16} />} title="Laufende Kosten" summary={`${formatPercent(c.maintenance)} vom Kaufpreis p. a.`}>
        <SliderField
          label="Instandhaltung und nicht umlegbare Kosten"
          hint="Reparaturen, Rücklage und bei Wohnungen die Verwaltung. Übliche Faustregeln: 0,8 bis 1 % des Kaufpreises im Jahr, oder 1 bis 1,5 % des Gebäudewerts; bei Altbauten mehr. Heizung, Grundsteuer und Müll zahlen Mieter und Eigentümer gleichermaßen und fehlen deshalb. Steigt jedes Jahr mit der Inflation."
          value={c.maintenance}
          onChange={(v) => onChange({ maintenance: v })}
          min={0}
          max={3}
          step={0.05}
          suffix="%"
          inputMax={10}
        />
        <p className="text-xs text-muted">Anfangs {formatEuro(maintenanceMonthly)} im Monat.</p>
      </Section>

      <Section icon={<KeyRound size={16} />} title="Miete" summary={`${formatEuro(c.rent)} kalt · +${formatPercent(c.rentIncrease)} p. a.`}>
        <NumberField
          label="Kaltmiete pro Monat"
          hint="Die Miete für eine vergleichbare Wohnung – gleiche Lage, Größe und Ausstattung wie die, die du kaufen würdest."
          value={c.rent}
          onChange={(v) => onChange({ rent: v ?? 0 })}
          min={0}
          suffix="€"
        />
        <SliderField
          label="Mietsteigerung p. a."
          hint="Die Nettokaltmieten in Deutschland sind von 1995 bis 2024 im Schnitt um etwa 1,4 % im Jahr gestiegen (Verbraucherpreisindex, Destatis). Neuvertragsmieten in Großstädten steigen oft schneller."
          value={c.rentIncrease}
          onChange={(v) => onChange({ rentIncrease: v })}
          min={0}
          max={5}
          step={0.1}
          suffix="%"
          inputMin={-10}
          inputMax={20}
        />
      </Section>

      <Section
        icon={<TrendingUp size={16} />}
        title="Geldanlage"
        summary={`${formatPercent(c.invest.totalReturn)} Rendite · ${formatPercent(c.invest.ter)} TER`}
        defaultOpen={false}
      >
        <p className="text-xs leading-snug text-muted">
          Was nicht ins Wohnen fließt, wird in einen Fonds angelegt – beim Mieten das Eigenkapital und die Differenz zur Kreditrate, beim Kaufen die Differenz, sobald Wohnen günstiger ist. Gerechnet mit deutschen Steuern wie im Vermögens-Simulator.
        </p>
        <SliderField label="Rendite p. a." value={c.invest.totalReturn} onChange={(v) => setInvest({ totalReturn: v, dividendYield: Math.min(c.invest.dividendYield, Math.max(0, v)) })} min={0} max={12} step={0.1} suffix="%" inputMin={-10} inputMax={30} />
        <SliderField label="Davon Ausschüttung" value={c.invest.dividendYield} onChange={(v) => setInvest({ dividendYield: Math.min(v, Math.max(0, c.invest.totalReturn)) })} min={0} max={6} step={0.1} suffix="%" />
        <SliderField label="Laufende Kosten (TER)" value={c.invest.ter} onChange={(v) => setInvest({ ter: v })} min={0} max={2} step={0.01} suffix="%" inputMax={5} />
        <SliderField label="Kaufgebühr" value={c.invest.purchaseFee} onChange={(v) => setInvest({ purchaseFee: v })} min={0} max={2} step={0.05} suffix="%" inputMax={10} />
        <Field label="Fondsart" hint="Bestimmt die Teilfreistellung: Aktienfonds 30 %, Mischfonds 15 %, sonst 0 %.">
          <Select<FundType>
            aria-label="Fondsart"
            value={c.invest.fundType}
            onChange={(v) => setInvest({ fundType: v })}
            options={[
              { value: 'equity', label: 'Aktienfonds (30 % steuerfrei)' },
              { value: 'mixed', label: 'Mischfonds (15 % steuerfrei)' },
              { value: 'other', label: 'Sonstiger Fonds' },
            ]}
          />
        </Field>
        <Field label="Kirchensteuer">
          <Select<ChurchTax>
            aria-label="Kirchensteuer"
            value={c.invest.churchTax}
            onChange={(v) => setInvest({ churchTax: v })}
            options={[
              { value: 0, label: 'Keine' },
              { value: 8, label: '8 % (Bayern, Baden-Württemberg)' },
              { value: 9, label: '9 % (übrige Länder)' },
            ]}
          />
        </Field>
        <NumberField label="Sparerpauschbetrag" value={c.invest.allowance} onChange={(v) => setInvest({ allowance: v ?? 0 })} min={0} suffix="€" />
      </Section>

      <Section icon={<CalendarRange size={16} />} title="Zeitraum und Allgemeines" summary={`${c.years} Jahre ab ${c.startYear} · ${formatPercent(c.inflation)} Inflation`}>
        <NumberField label="Kaufjahr" value={c.startYear} onChange={(v) => v != null && onChange({ startYear: Math.round(v) })} min={1950} max={2200} />
        <SliderField label="Betrachtungszeitraum" value={c.years} onChange={(v) => onChange({ years: Math.round(v) })} min={5} max={50} step={1} suffix="J." inputMin={1} inputMax={60} />
        <SliderField
          label="Verkaufskosten am Ende"
          hint="Damit beide Wege fair verglichen werden, gilt am Ende jedes Jahres: als ob alles verkauft würde. Beim Depot fallen dann Steuern an, bei der Immobilie Makler und Notar. 0 %, wenn du davon ausgehst, dass du sie behältst."
          value={c.sellCost}
          onChange={(v) => onChange({ sellCost: v })}
          min={0}
          max={7.14}
          step={0.01}
          suffix="%"
          inputMax={20}
        />
        <SliderField label="Inflation p. a." hint="Für Werte in heutiger Kaufkraft und die steigenden Instandhaltungskosten." value={c.inflation} onChange={(v) => onChange({ inflation: v })} min={0} max={6} step={0.1} suffix="%" inputMin={-5} inputMax={20} />
      </Section>
    </div>
  );
}
