import React, { useMemo, useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ComposedChart, Bar, Line, Legend, ReferenceLine
} from 'recharts';
import { SimulationResult, YearlyResult, SimulationConfig } from '../types';
import { Euro, TrendingUp, PiggyBank, Scale } from 'lucide-react';

interface Props {
  results: SimulationResult;
  config: SimulationConfig;
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
};

const KPICard: React.FC<{ title: string; value: string; subValue?: string; icon: React.ReactNode; color: string }> = ({ title, value, subValue, icon, color }) => (
  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-slate-500 text-sm font-medium">{title}</p>
        <h4 className="text-2xl font-bold text-slate-800 mt-1">{value}</h4>
        {subValue && <p className="text-xs text-slate-400 mt-1">{subValue}</p>}
      </div>
      <div className={`p-2 rounded-lg ${color} text-white`}>
        {icon}
      </div>
    </div>
  </div>
);

const Dashboard: React.FC<Props> = ({ results, config }) => {
  const [showReal, setShowReal] = useState(false); // Toggle Inflation
  const [viewTable, setViewTable] = useState(false);

  const final = results.finalSummary;
  const data = results.yearlyData;

  const chartData = useMemo(() => {
    return data.map(d => ({
      name: `Jahr ${d.year}`,
      age: d.age,
      "Investiert": Math.round(d.investedCapital),
      "Wert (Nominal)": Math.round(d.nominalValueEnd),
      "Wert (Real)": Math.round(d.realValueEnd),
      "Dividende (Netto)": Math.round(d.nominalDividendsNet),
      "Dividende (Real)": Math.round(d.realDividendsNet),
      "Monatliche Div (Netto)": Math.round(d.nominalDividendsNet / 12),
      "Monatliche Div (Real)": Math.round(d.realDividendsNet / 12),
    }));
  }, [data]);

  const displayValue = showReal ? final.finalValueReal : final.finalValueNominal;
  const valueLabel = showReal ? "Kaufkraft (Real)" : "Depotwert (Nominal)";

  const displayDividends = showReal ? final.totalDividendsReceivedReal : final.totalDividendsReceived;
  const dividendLabel = showReal ? "Netto (Real)" : "Netto (Nominal)";

  // Back Calculation Display
  const bc = results.backCalculationResult;
  const bcConfig = config.backCalculation;
  
  return (
    <div className="space-y-6">
      
      {/* Back Calculation Alert */}
      {bc && bcConfig.enabled && (
        <div className={`p-4 rounded-xl border ${bc.success ? 'bg-indigo-50 border-indigo-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start space-x-3">
            <div className={`p-2 rounded-full ${bc.success ? 'bg-indigo-100 text-indigo-600' : 'bg-red-100 text-red-600'}`}>
              <TrendingUp size={20} />
            </div>
            <div>
              <h4 className={`font-bold ${bc.success ? 'text-indigo-900' : 'text-red-900'}`}>
                {bc.success ? 'Ziel erreichbar' : 'Ziel nicht realistisch erreichbar'}
              </h4>
              <p className={`text-sm mt-1 ${bc.success ? 'text-indigo-700' : 'text-red-700'}`}>
                Um Ihre Ziele zu erreichen, benötigen Sie:
              </p>
              {bc.success && (
                <div className="mt-2 text-2xl font-bold text-indigo-600">
                  {bc.variable === 'SAVINGS_RATE' && `${formatCurrency(bc.requiredValue)} / Monat`}
                  {bc.variable === 'INITIAL_CAPITAL' && `${formatCurrency(bc.requiredValue)} Startkapital`}
                  {bc.variable === 'RETURN' && `${bc.requiredValue.toFixed(2)}% Rendite p.a.`}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="Endvermögen" 
          value={formatCurrency(displayValue)} 
          subValue={showReal ? "Inflationsbereinigt" : "Vor Inflation"}
          icon={<TrendingUp size={20} />}
          color="bg-emerald-500"
        />
        <KPICard 
          title="Summe Einzahlungen" 
          value={formatCurrency(final.totalInvested)}
          icon={<PiggyBank size={20} />}
          color="bg-blue-500"
        />
        <KPICard 
          title="Summe Dividenden" 
          value={formatCurrency(displayDividends)} 
          subValue={dividendLabel}
          icon={<Euro size={20} />}
          color="bg-indigo-500"
        />
        <KPICard 
          title="Steuerlast" 
          value={formatCurrency(final.totalTaxesPaid)}
          subValue="Gezahlt während Laufzeit"
          icon={<Scale size={20} />}
          color="bg-slate-500"
        />
      </div>

      {/* Controls */}
      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-2">
           <label className="text-sm font-medium text-slate-700">Ansicht:</label>
           <button 
             onClick={() => setShowReal(false)}
             className={`px-3 py-1 text-sm rounded transition ${!showReal ? 'bg-emerald-100 text-emerald-800 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
           >
             Nominal
           </button>
           <button 
             onClick={() => setShowReal(true)}
             className={`px-3 py-1 text-sm rounded transition ${showReal ? 'bg-emerald-100 text-emerald-800 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
           >
             Real (Kaufkraft)
           </button>
        </div>
        <div className="flex items-center space-x-2">
           <button 
            onClick={() => setViewTable(!viewTable)}
            className="text-sm text-blue-600 hover:underline"
           >
             {viewTable ? "Diagramme anzeigen" : "Datentabelle anzeigen"}
           </button>
        </div>
      </div>

      {/* Content Area */}
      {!viewTable ? (
        <div className="space-y-6">
          
          {/* Wealth Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Vermögensentwicklung</h3>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorInvest" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="age" label={{ value: 'Alter', position: 'insideBottomRight', offset: -5 }} tick={{fill: '#64748b'}} />
                  <YAxis tickFormatter={(val) => `${val / 1000}k`} tick={{fill: '#64748b'}} />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="top" height={36}/>
                  <Area 
                    type="monotone" 
                    dataKey={showReal ? "Wert (Real)" : "Wert (Nominal)"} 
                    stroke="#10b981" 
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                    name={valueLabel}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="Investiert" 
                    stroke="#3b82f6" 
                    fillOpacity={1} 
                    fill="url(#colorInvest)" 
                    name="Investiertes Kapital"
                  />
                  {/* Target Line for Wealth */}
                  {bcConfig.enabled && bcConfig.targetWealth && (
                    (bcConfig.wealthType === 'NOMINAL' && !showReal) || (bcConfig.wealthType === 'REAL' && showReal)
                  ) && (
                    <ReferenceLine 
                      y={bcConfig.targetWealth} 
                      stroke="#ef4444" 
                      strokeDasharray="3 3" 
                      label={{ value: 'Ziel', position: 'right', fill: '#ef4444', fontSize: 12 }} 
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Dividend Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Dividendenentwicklung (Netto)</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="age" label={{ value: 'Alter', position: 'insideBottomRight', offset: -5 }} tick={{fill: '#64748b'}} />
                  
                  {/* Left Axis: Annual Dividends */}
                  <YAxis 
                    yAxisId="left" 
                    tickFormatter={(val) => `${val}€`} 
                    tick={{fill: '#6366f1'}} 
                    label={{ value: 'Jahr (Summe)', angle: -90, position: 'insideLeft', fill: '#6366f1', fontSize: 12 }} 
                  />
                  
                  {/* Right Axis: Monthly Average */}
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    tickFormatter={(val) => `${val}€`} 
                    tick={{fill: '#f59e0b'}} 
                    label={{ value: 'Ø Monat', angle: 90, position: 'insideRight', fill: '#f59e0b', fontSize: 12 }}
                  />

                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    cursor={{fill: '#f1f5f9'}}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="top" height={36}/>
                  
                  <Bar 
                    yAxisId="left" 
                    dataKey={showReal ? "Dividende (Real)" : "Dividende (Netto)"} 
                    name="Jahresdividende"
                    fill="#6366f1" 
                    radius={[4, 4, 0, 0]} 
                  />
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey={showReal ? "Monatliche Div (Real)" : "Monatliche Div (Netto)"} 
                    name="Ø Monatliche Dividende"
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    dot={false}
                  />
                  
                  {/* Target Line for Monthly Dividend */}
                  {bcConfig.enabled && bcConfig.targetMonthlyDividend && (
                    (bcConfig.dividendType === 'NOMINAL' && !showReal) || (bcConfig.dividendType === 'REAL' && showReal)
                  ) && (
                    <ReferenceLine 
                      yAxisId="right"
                      y={bcConfig.targetMonthlyDividend} 
                      stroke="#ef4444" 
                      strokeDasharray="3 3" 
                      label={{ value: 'Ziel (Monat)', position: 'right', fill: '#ef4444', fontSize: 12 }} 
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Jahr</th>
                  <th className="px-4 py-3">Alter</th>
                  <th className="px-4 py-3">Investiert</th>
                  <th className="px-4 py-3 text-right">Wert (Nominal)</th>
                  <th className="px-4 py-3 text-right">Wert (Real)</th>
                  <th className="px-4 py-3 text-right">Div (Netto)</th>
                  <th className="px-4 py-3 text-right">Ø Monat</th>
                  <th className="px-4 py-3 text-right">Steuern</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((row) => (
                  <tr key={row.year} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{row.year}</td>
                    <td className="px-4 py-3">{row.age}</td>
                    <td className="px-4 py-3">{formatCurrency(row.investedCapital)}</td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-600">{formatCurrency(row.nominalValueEnd)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(row.realValueEnd)}</td>
                    <td className="px-4 py-3 text-right text-indigo-600">{formatCurrency(row.nominalDividendsNet)}</td>
                    <td className="px-4 py-3 text-right text-amber-500">{formatCurrency(row.nominalDividendsNet / 12)}</td>
                    <td className="px-4 py-3 text-right text-slate-400">{formatCurrency(row.nominalTaxesPaid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Footer */}
      <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg text-sm text-blue-800">
         <strong>Hinweis:</strong> Dies ist eine mathematische Simulation. Steuerliche Details sind vereinfacht (z.B. keine Teilfreistellung bei Aktienfonds berücksichtigt, nur Pauschbetrag). Vergangene Wertentwicklungen sind kein Indikator für die Zukunft.
      </div>
    </div>
  );
};

export default Dashboard;