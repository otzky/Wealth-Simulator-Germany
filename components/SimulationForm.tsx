import React from 'react';
import { Plus, Trash2, HelpCircle } from 'lucide-react';
import { SimulationConfig, DurationType } from '../types';

interface Props {
  config: SimulationConfig;
  onChange: (c: SimulationConfig) => void;
}

const SimulationForm: React.FC<Props> = ({ config, onChange }) => {
  
  const handleChange = (field: keyof SimulationConfig, value: any) => {
    onChange({ ...config, [field]: value });
  };

  const addSavingsStep = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    onChange({
      ...config,
      savingsSteps: [...config.savingsSteps, { id: newId, yearStart: 5, monthlyAmount: config.baseMonthlySavings + 100 }]
    });
  };

  const addOneTimeInvestment = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    onChange({
      ...config,
      oneTimeInvestments: [...config.oneTimeInvestments, { id: newId, year: 5, amount: 10000 }]
    });
  };

  const removeSavingsStep = (id: string) => {
    onChange({
      ...config,
      savingsSteps: config.savingsSteps.filter(s => s.id !== id)
    });
  };

  const removeOneTimeInvestment = (id: string) => {
    onChange({
      ...config,
      oneTimeInvestments: config.oneTimeInvestments.filter(s => s.id !== id)
    });
  };

  const updateSavingsStep = (id: string, field: 'yearStart' | 'monthlyAmount', value: number) => {
    onChange({
      ...config,
      savingsSteps: config.savingsSteps.map(s => s.id === id ? { ...s, [field]: value } : s)
    });
  };

  const updateOneTimeInvestment = (id: string, field: 'year' | 'amount', value: number) => {
    onChange({
      ...config,
      oneTimeInvestments: config.oneTimeInvestments.map(s => s.id === id ? { ...s, [field]: value } : s)
    });
  };

  // Helper to generate year options
  const getYearOptions = () => {
    const options = [];
    const startYear = new Date(config.simulationStartDate).getFullYear();
    const birthYear = new Date(config.birthDate).getFullYear();
    
    // Determine max years based on duration type
    let maxYears = config.durationYears;
    if (config.durationType === DurationType.TARGET_AGE) {
      const currentAge = new Date().getFullYear() - birthYear;
      maxYears = config.targetAge - currentAge;
    }
    
    // Limit to reasonable amount if calculation is off
    if (maxYears < 1) maxYears = 1;
    if (maxYears > 100) maxYears = 100;

    for (let i = 1; i <= maxYears; i++) {
      const calendarYear = startYear + i - 1; // Year 1 is the start year
      const age = calendarYear - birthYear;
      options.push({
        value: i,
        label: `${calendarYear} (${age})`
      });
    }
    return options;
  };

  const yearOptions = getYearOptions();

  return (
    <div className="space-y-6 text-sm">
      
      {/* 1. Persönliche Daten */}
      <section className="space-y-3">
        <h3 className="font-semibold text-slate-900 border-b pb-1">1. Persönliche Daten</h3>
        <div>
          <label className="block text-slate-600 mb-1">Geburtsdatum</label>
          <input 
            type="date" 
            className="w-full p-2 border rounded border-slate-300 focus:ring-2 focus:ring-accent outline-none"
            value={config.birthDate}
            onChange={(e) => handleChange('birthDate', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-slate-600 mb-1">Startdatum der Simulation</label>
          <input 
            type="date" 
            className="w-full p-2 border rounded border-slate-300 focus:ring-2 focus:ring-accent outline-none"
            value={config.simulationStartDate}
            onChange={(e) => handleChange('simulationStartDate', e.target.value)}
          />
        </div>
        
        <div className="flex space-x-2">
          <button 
            className={`flex-1 py-1.5 px-3 rounded border ${config.durationType === DurationType.FIXED_YEARS ? 'bg-accent text-white border-accent' : 'bg-white text-slate-600 border-slate-300'}`}
            onClick={() => handleChange('durationType', DurationType.FIXED_YEARS)}
          >
            Jahre
          </button>
          <button 
            className={`flex-1 py-1.5 px-3 rounded border ${config.durationType === DurationType.TARGET_AGE ? 'bg-accent text-white border-accent' : 'bg-white text-slate-600 border-slate-300'}`}
            onClick={() => handleChange('durationType', DurationType.TARGET_AGE)}
          >
            Zielalter
          </button>
        </div>

        {config.durationType === DurationType.FIXED_YEARS ? (
          <div>
            <label className="block text-slate-600 mb-1">Laufzeit (Jahre)</label>
            <input 
              type="number" min="1" max="100"
              className="w-full p-2 border rounded border-slate-300 focus:ring-2 focus:ring-accent outline-none"
              value={config.durationYears}
              onChange={(e) => handleChange('durationYears', Number(e.target.value))}
            />
          </div>
        ) : (
          <div>
            <label className="block text-slate-600 mb-1">Zielalter</label>
            <input 
              type="number" min="18" max="120"
              className="w-full p-2 border rounded border-slate-300 focus:ring-2 focus:ring-accent outline-none"
              value={config.targetAge}
              onChange={(e) => handleChange('targetAge', Number(e.target.value))}
            />
          </div>
        )}
      </section>

      {/* 2. Startkapital & Cashflow */}
      <section className="space-y-3">
        <h3 className="font-semibold text-slate-900 border-b pb-1">2. Kapital & Sparrate</h3>
        
        <div>
          <label className="block text-slate-600 mb-1">Startkapital (€)</label>
          <input 
            type="number" step="1000"
            className="w-full p-2 border rounded border-slate-300 focus:ring-2 focus:ring-accent outline-none"
            value={config.initialCapital}
            onChange={(e) => handleChange('initialCapital', Number(e.target.value))}
          />
        </div>

        <div>
          <label className="block text-slate-600 mb-1">Monatliche Sparrate (Start) (€)</label>
          <input 
            type="number" step="50"
            className="w-full p-2 border rounded border-slate-300 focus:ring-2 focus:ring-accent outline-none"
            value={config.baseMonthlySavings}
            onChange={(e) => handleChange('baseMonthlySavings', Number(e.target.value))}
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-600 text-xs font-medium">Dynamik (Sparrate ändern)</span>
            <button onClick={addSavingsStep} className="text-accent hover:text-blue-700 flex items-center text-xs">
              <Plus size={14} className="mr-1"/> Neu
            </button>
          </div>
          <div className="space-y-2">
            {config.savingsSteps.map(step => (
              <div key={step.id} className="flex items-center space-x-2 bg-slate-50 p-2 rounded border border-slate-200">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500">Ab Jahr</label>
                  <select 
                    className="w-full text-xs p-1 border rounded bg-white"
                    value={step.yearStart}
                    onChange={(e) => updateSavingsStep(step.id, 'yearStart', Number(e.target.value))}
                  >
                    {yearOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500">Neue Rate (€)</label>
                  <input 
                    type="number" step="50"
                    className="w-full text-xs p-1 border rounded"
                    value={step.monthlyAmount}
                    onChange={(e) => updateSavingsStep(step.id, 'monthlyAmount', Number(e.target.value))}
                  />
                </div>
                <button onClick={() => removeSavingsStep(step.id)} className="text-red-400 hover:text-red-600 mt-3">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {config.savingsSteps.length === 0 && (
              <p className="text-xs text-slate-400 italic">Keine Anpassungen.</p>
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-600 text-xs font-medium">Einmalzahlungen (z.B. Erbe)</span>
            <button onClick={addOneTimeInvestment} className="text-accent hover:text-blue-700 flex items-center text-xs">
              <Plus size={14} className="mr-1"/> Neu
            </button>
          </div>
          <div className="space-y-2">
            {config.oneTimeInvestments.map(inv => (
              <div key={inv.id} className="flex items-center space-x-2 bg-slate-50 p-2 rounded border border-slate-200">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500">Im Jahr</label>
                  <select 
                    className="w-full text-xs p-1 border rounded bg-white"
                    value={inv.year}
                    onChange={(e) => updateOneTimeInvestment(inv.id, 'year', Number(e.target.value))}
                  >
                    {yearOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500">Betrag (€)</label>
                  <input 
                    type="number" step="1000"
                    className="w-full text-xs p-1 border rounded"
                    value={inv.amount}
                    onChange={(e) => updateOneTimeInvestment(inv.id, 'amount', Number(e.target.value))}
                  />
                </div>
                <button onClick={() => removeOneTimeInvestment(inv.id)} className="text-red-400 hover:text-red-600 mt-3">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {config.oneTimeInvestments.length === 0 && (
              <p className="text-xs text-slate-400 italic">Keine Einmalzahlungen.</p>
            )}
          </div>
        </div>
      </section>

      {/* 3. Rendite & Kosten */}
      <section className="space-y-3">
        <h3 className="font-semibold text-slate-900 border-b pb-1">3. Markterwartung</h3>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-600 mb-1 text-xs">Gesamtrendite (%)</label>
            <input 
              type="number" step="0.1"
              className="w-full p-2 border rounded border-slate-300 outline-none"
              value={config.annualTotalReturn}
              onChange={(e) => handleChange('annualTotalReturn', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-slate-600 mb-1 text-xs">Davon Dividende (%)</label>
            <input 
              type="number" step="0.1"
              className="w-full p-2 border rounded border-slate-300 outline-none"
              value={config.annualDividendYield}
              onChange={(e) => handleChange('annualDividendYield', Number(e.target.value))}
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
           <input 
             type="checkbox" 
             id="reinvest"
             className="rounded text-accent focus:ring-accent"
             checked={config.reinvestDividends}
             onChange={(e) => handleChange('reinvestDividends', e.target.checked)}
           />
           <label htmlFor="reinvest" className="text-slate-700">Dividenden reinvestieren</label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
             <label className="block text-slate-600 mb-1 text-xs">Inflation (%)</label>
            <input 
              type="number" step="0.1"
              className="w-full p-2 border rounded border-slate-300 outline-none"
              value={config.inflationRate}
              onChange={(e) => handleChange('inflationRate', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-slate-600 mb-1 text-xs">TER (Kosten p.a.) (%)</label>
            <input 
              type="number" step="0.05"
              className="w-full p-2 border rounded border-slate-300 outline-none"
              value={config.yearlyTer}
              onChange={(e) => handleChange('yearlyTer', Number(e.target.value))}
            />
          </div>
        </div>
        
         <div>
            <label className="block text-slate-600 mb-1 text-xs">Kaufgebühren (Einmalig) (%)</label>
            <input 
              type="number" step="0.1"
              className="w-full p-2 border rounded border-slate-300 outline-none"
              value={config.entryFee}
              onChange={(e) => handleChange('entryFee', Number(e.target.value))}
            />
          </div>

      </section>

      {/* 4. Steuern */}
      <section className="space-y-3">
        <h3 className="font-semibold text-slate-900 border-b pb-1">4. Steuern (DE)</h3>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-600 mb-1 text-xs">Freibetrag (€)</label>
            <input 
              type="number" step="100"
              className="w-full p-2 border rounded border-slate-300 outline-none"
              value={config.taxAllowance}
              onChange={(e) => handleChange('taxAllowance', Number(e.target.value))}
            />
          </div>
           <div>
            <label className="block text-slate-600 mb-1 text-xs">Kirchensteuer (%)</label>
            <select 
              className="w-full p-2 border rounded border-slate-300 outline-none bg-white"
              value={config.churchTax}
              onChange={(e) => handleChange('churchTax', Number(e.target.value))}
            >
              <option value="0">0% (Keine)</option>
              <option value="8">8% (Bayern/BW)</option>
              <option value="9">9% (Andere)</option>
            </select>
          </div>
        </div>
      </section>

      {/* 5. Back-Calculation */}
      <section className="space-y-3 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
        <div className="flex justify-between items-center border-b border-indigo-200 pb-1">
          <h3 className="font-semibold text-indigo-900 flex items-center gap-2">
            <HelpCircle size={16} />
            Ziel-Berechnung
          </h3>
          <div className="flex items-center">
            <input 
              type="checkbox"
              id="bc-enable"
              className="mr-2"
              checked={config.backCalculation.enabled}
              onChange={(e) => onChange({
                ...config,
                backCalculation: { ...config.backCalculation, enabled: e.target.checked }
              })}
            />
            <label htmlFor="bc-enable" className="text-xs text-indigo-800 font-medium">Aktivieren</label>
          </div>
        </div>

        {config.backCalculation.enabled && (
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-indigo-800 mb-1 text-xs">Ziel-Endvermögen (€)</label>
                <input 
                  type="number" step="10000"
                  className="w-full p-2 border rounded border-indigo-200 focus:ring-2 focus:ring-indigo-400 outline-none bg-white"
                  value={config.backCalculation.targetWealth || ''}
                  onChange={(e) => onChange({
                    ...config,
                    backCalculation: { ...config.backCalculation, targetWealth: Number(e.target.value) }
                  })}
                  placeholder="z.B. 1000000"
                />
              </div>
              <div>
                <label className="block text-indigo-800 mb-1 text-xs">Art</label>
                <select 
                  className="w-full p-2 border rounded border-indigo-200 outline-none bg-white text-sm"
                  value={config.backCalculation.wealthType}
                  onChange={(e) => onChange({
                    ...config,
                    backCalculation: { ...config.backCalculation, wealthType: e.target.value as any }
                  })}
                >
                  <option value="NOMINAL">Nominal</option>
                  <option value="REAL">Real (Kaufkraft)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-indigo-800 mb-1 text-xs">Ziel-Dividende/Monat (€)</label>
                <input 
                  type="number" step="100"
                  className="w-full p-2 border rounded border-indigo-200 focus:ring-2 focus:ring-indigo-400 outline-none bg-white"
                  value={config.backCalculation.targetMonthlyDividend || ''}
                  onChange={(e) => onChange({
                    ...config,
                    backCalculation: { ...config.backCalculation, targetMonthlyDividend: Number(e.target.value) }
                  })}
                  placeholder="z.B. 2000"
                />
              </div>
              <div>
                <label className="block text-indigo-800 mb-1 text-xs">Art</label>
                <select 
                  className="w-full p-2 border rounded border-indigo-200 outline-none bg-white text-sm"
                  value={config.backCalculation.dividendType}
                  onChange={(e) => onChange({
                    ...config,
                    backCalculation: { ...config.backCalculation, dividendType: e.target.value as any }
                  })}
                >
                  <option value="NOMINAL">Nominal</option>
                  <option value="REAL">Real (Kaufkraft)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-indigo-800 mb-1 text-xs font-medium">Was soll berechnet werden?</label>
              <div className="flex flex-wrap gap-2">
                <button 
                  className={`flex-1 py-1.5 px-2 rounded text-xs border whitespace-nowrap ${config.backCalculation.variableToAdjust === 'SAVINGS_RATE' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-800 border-indigo-200'}`}
                  onClick={() => onChange({
                    ...config,
                    backCalculation: { ...config.backCalculation, variableToAdjust: 'SAVINGS_RATE' }
                  })}
                >
                  Sparrate
                </button>
                <button 
                  className={`flex-1 py-1.5 px-2 rounded text-xs border whitespace-nowrap ${config.backCalculation.variableToAdjust === 'INITIAL_CAPITAL' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-800 border-indigo-200'}`}
                  onClick={() => onChange({
                    ...config,
                    backCalculation: { ...config.backCalculation, variableToAdjust: 'INITIAL_CAPITAL' }
                  })}
                >
                  Startkapital
                </button>
                <button 
                  className={`flex-1 py-1.5 px-2 rounded text-xs border whitespace-nowrap ${config.backCalculation.variableToAdjust === 'RETURN' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-800 border-indigo-200'}`}
                  onClick={() => onChange({
                    ...config,
                    backCalculation: { ...config.backCalculation, variableToAdjust: 'RETURN' }
                  })}
                >
                  Rendite
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default SimulationForm;