'use client';

import React, { useState } from 'react';
import { 
  Play, Save, History, MapPin, 
  Calendar, Layers, CheckCircle2, 
  AlertTriangle, Database, Search,
  Filter, MoreHorizontal, Download,
  Loader2, Info
} from 'lucide-react';

// --- Prediction Record Type ---
interface PredictionRecord {
  id: string;
  barangay: string;
  riskLevel: 'High' | 'Medium' | 'Low';
  type: 'Health' | 'Production';
  category?: 'Meat' | 'Milk' | 'Cattle Heads';
  productionForecast?: number; 
  model: string;
  dateFrom: string;
  dateTo: string;
  createdAt: string;
}

export default function AdminForecastingSystem() {
  const [isRunning, setIsRunning] = useState(false);
  const [currentForecast, setCurrentForecast] = useState<PredictionRecord | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  
  const [records, setRecords] = useState<PredictionRecord[]>([
    { id: '1', barangay: 'Bawi', riskLevel: 'High', model: 'FMD Aerosol v1.2', dateFrom: '2026-04-01', dateTo: '2026-04-15', createdAt: '2026-04-16', type: 'Health' },
    { id: '2', barangay: 'Pansol', riskLevel: 'Low', model: 'FMD Aerosol v1.2', dateFrom: '2026-03-10', dateTo: '2026-03-25', createdAt: '2026-03-26', type: 'Health' },
    { id: '3', barangay: 'Poblacion', riskLevel: 'Medium', model: 'Simple Proximity v1.0', dateFrom: '2026-02-01', dateTo: '2026-02-28', createdAt: '2026-03-01', type: 'Health' },
  ]);

  const [form, setForm] = useState({
    barangay: 'Bawi',
    dateFrom: '2026-04-26',
    dateTo: '2026-05-10',
    model: 'FMD Aerosol v1.2',
    category: 'Cattle Heads'
  });

  const runPrediction = () => {
    setIsRunning(true);
    setIsSaved(false);

    setTimeout(() => {
      const isProductionMode = form.model === 'ARIMA Time-Series v2.0';
      let yieldCount = 0;
      
      if (isProductionMode) {
        const baseValues: Record<string, number> = {
          'Cattle Heads': 850,
          'Meat': 12500,
          'Milk': 6200
        };
        const base = baseValues[form.category] || 800;
        const history = records.filter(r => r.barangay === form.barangay);
        const penalty = history.filter(r => r.riskLevel === 'High').length * (base * 0.05);
        yieldCount = Math.floor(base - penalty + (Math.random() * (base * 0.02)));
      }

      const newForecast: PredictionRecord = {
        id: Math.random().toString(36).substring(2, 9),
        barangay: form.barangay,
        type: isProductionMode ? 'Production' : 'Health',
        category: isProductionMode ? (form.category as any) : undefined,
        riskLevel: isProductionMode ? (yieldCount < 700 ? 'High' : 'Low') : (Math.random() > 0.5 ? 'High' : 'Medium'),
        productionForecast: isProductionMode ? yieldCount : undefined,
        model: form.model,
        dateFrom: form.dateFrom,
        dateTo: form.dateTo,
        createdAt: new Date().toISOString().split('T')[0]
      };

      setCurrentForecast(newForecast);
      setIsRunning(false);
    }, 1500);
  };

  const saveToRecords = () => {
    if (currentForecast) {
      setRecords([currentForecast, ...records]);
      setIsSaved(true);
      setTimeout(() => setCurrentForecast(null), 1000);
    }
  };

  return (
    <div className="space-y-8 p-6 bg-slate-50 min-h-screen font-sans text-slate-900">
      
      {/* SECTION 1: ENGINE & DISPLAY */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-600" /> Model Configuration
          </h3>
          
          <div className="space-y-5">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Model Architecture</label>
              <select 
                className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.model} 
                onChange={(e) => setForm({...form, model: e.target.value})}
              >
                <option>Simple Proximity v1.0</option>
                <option>Weighted Density v1.1</option>
                <option>FMD Aerosol v1.2</option>
                <option>ARIMA Time-Series v2.0</option>
              </select>
            </div>

            {form.model === 'ARIMA Time-Series v2.0' && (
              <div className="animate-in slide-in-from-top-2 duration-300">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Production Metric</label>
                <select 
                  className="w-full mt-1 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-sm font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.category}
                  onChange={(e) => setForm({...form, category: e.target.value as any})}
                >
                  <option>Meat</option>
                  <option>Milk</option>
                  <option>Cattle Heads</option>
                </select>
              </div>
            )}

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Barangay</label>
              <select className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                value={form.barangay} onChange={(e) => setForm({...form, barangay: e.target.value})}>
                <option>Bawi</option><option>Poblacion</option><option>Manggas</option><option>Pansol</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date From</label>
                <input type="date" className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" 
                  value={form.dateFrom} onChange={(e) => setForm({...form, dateFrom: e.target.value})}/>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date To</label>
                <input type="date" className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  value={form.dateTo} onChange={(e) => setForm({...form, dateTo: e.target.value})}/>
              </div>
            </div>

            <button onClick={runPrediction} disabled={isRunning}
              className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100">
              {isRunning ? <><Loader2 className="w-4 h-4 animate-spin" /> Computing...</> : <><Play className="w-4 h-4 fill-white" /> Run Risk Prediction</>}
            </button>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8 bg-slate-900 rounded-3xl p-8 text-white flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:20px_20px]"></div>

          {currentForecast && !isRunning && (
            <div className="w-full text-center animate-in zoom-in duration-300 z-10">
              {currentForecast.type === 'Production' ? (
                <div className="space-y-6">
                  <div className="flex flex-col items-center">
                    <p className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em]">
                      Projected {currentForecast.category} Yield
                    </p>
                    <h1 className="text-8xl font-black text-white tracking-tighter mt-2">
                      {currentForecast.productionForecast?.toLocaleString()}
                      <span className="text-xl text-slate-500 ml-2 font-medium tracking-normal">
                        {currentForecast.category === 'Meat' ? 'kg' : currentForecast.category === 'Milk' ? 'L' : 'Heads'}
                      </span>
                    </h1>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className={`p-6 rounded-full mb-6 border animate-pulse ${currentForecast.riskLevel === 'High' ? 'bg-red-500/10 border-red-500/20' : 'bg-yellow-500/10 border-yellow-500/20'}`}>
                    <AlertTriangle className={`w-16 h-16 ${currentForecast.riskLevel === 'High' ? 'text-red-500' : 'text-yellow-500'}`} />
                  </div>
                  <span className="px-4 py-1 rounded-full text-[10px] font-black uppercase mb-4 border bg-white/10">{currentForecast.riskLevel} Risk</span>
                  <h2 className="text-7xl font-black mb-2 tracking-tight">{currentForecast.barangay}</h2>
                </div>
              )}

              <p className="text-slate-500 font-mono text-[10px] mt-8 mb-8 tracking-[0.2em] uppercase">
                {currentForecast.model} • {currentForecast.dateFrom} to {currentForecast.dateTo}
              </p>

              <button onClick={saveToRecords} disabled={isSaved}
                className={`px-10 py-4 rounded-2xl font-black text-sm flex items-center gap-3 mx-auto transition-all ${isSaved ? 'bg-emerald-500 text-white' : 'bg-white text-slate-900 hover:bg-indigo-50'}`}>
                {isSaved ? <><CheckCircle2 className="w-5 h-5" /> Saved</> : <><Save className="w-5 h-5" /> Commit to Database</>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: PREDICTION LOGS TABLE */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" /> Prediction Logs
            </h3>
            <p className="text-[11px] text-slate-500">Historical archive of all generated assessments and forecasts</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors">
            <Download className="w-3 h-3" /> Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type / Barangay</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Assessment / Yield</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Model</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Window</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-700 text-sm">{rec.barangay}</span>
                      <span className={`text-[9px] font-bold uppercase tracking-tighter ${rec.type === 'Production' ? 'text-indigo-500' : 'text-slate-400'}`}>
                        {rec.type} Prediction
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {rec.type === 'Production' ? (
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-700">
                          {rec.productionForecast?.toLocaleString()} 
                          <span className="text-[10px] font-medium text-slate-400 ml-1">
                            {rec.category === 'Meat' ? 'kg' : rec.category === 'Milk' ? 'L' : 'Heads'}
                          </span>
                        </span>
                        <span className="text-[9px] text-slate-400">{rec.category}</span>
                      </div>
                    ) : (
                      <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border ${
                        rec.riskLevel === 'High' ? 'bg-red-50 text-red-600 border-red-100' : 
                        rec.riskLevel === 'Medium' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                        'bg-emerald-50 text-emerald-600 border-emerald-100'
                      }`}>
                        {rec.riskLevel} Risk
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-[11px] font-mono text-slate-500">{rec.model}</td>
                  <td className="px-6 py-4 text-[11px] text-slate-600">
                    {rec.dateFrom} <span className="text-slate-300">→</span> {rec.dateTo}
                  </td>
                  <td className="px-6 py-4 text-[11px] text-slate-400">{rec.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}