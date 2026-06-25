"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation'; // Updated for Next.js
import { Sidebar } from '../components/sidebar';
import { PageHeader } from '../components/page-header';
import { Package, Milk, TrendingUp, Calendar } from 'lucide-react';
import { Sprout, AlertTriangle, Bell,  } from 'lucide-react';
import MobileNav from '../components/mobilenav';
interface ProductionRecord {
  id: string;
  date: string;
  type: 'milk' | 'slaughter' | 'sale';
  quantity: number;
  unit: string;
  amount?: number;
  notes: string;
}

export default function ProductionLoggerPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'log' | 'history'>('log');
  const [productionType, setProductionType] = useState<'milk' | 'slaughter' | 'sale'>('milk');

  const [records, setRecords] = useState<ProductionRecord[]>([
    {
      id: '1',
      date: '2026-04-23',
      type: 'milk',
      quantity: 450,
      unit: 'liters',
      notes: 'Morning collection',
    },
    {
      id: '2',
      date: '2026-04-22',
      type: 'milk',
      quantity: 445,
      unit: 'liters',
      notes: 'Morning collection',
    },
    {
      id: '3',
      date: '2026-04-20',
      type: 'sale',
      quantity: 2,
      unit: 'heads',
      amount: 85000,
      notes: 'Live cattle sale - 320kg and 340kg',
    },
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, you'd handle the form data here
    alert('Production record logged successfully!');
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <div className="hidden md:block">
        <Sidebar role="farmer" onLogout={() => router.push('/')} />
      </div>
      
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <PageHeader
          title="Production Logger"
          subtitle="Record milk, slaughter (katay), and sales"
          variant="farmer"
          maxWidthClass="max-w-4xl"
          mobileMenuOffset={false}
        />

        <div className="p-4 md:p-6 max-w-4xl mx-auto">
          {/* Tab Selector */}
          <div className="bg-white p-1 rounded-lg shadow-sm border border-gray-200 mb-6 inline-flex">
            <button
              onClick={() => setActiveTab('log')}
              className={`px-6 py-2 rounded-lg transition-colors font-medium ${
                activeTab === 'log'
                  ? 'bg-[#2D5A27] text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Log Production
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-2 rounded-lg transition-colors font-medium ${
                activeTab === 'history'
                  ? 'bg-[#2D5A27] text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              History
            </button>
          </div>

          {activeTab === 'log' ? (
            <>
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* KPI 1: Yield Efficiency */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                  <div className="flex items-center gap-2 mb-2 text-purple-600">
                    <TrendingUp className="w-5 h-5" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Avg. Dress Yield</p>
                  </div>
                  <p className="text-2xl font-black text-gray-800">58.4%</p>
                  <p className="text-xs text-gray-500 mt-1">
                    <span className="text-green-600 font-bold">↑ 1.2%</span> from last batch
                  </p>
                </div>

                {/* KPI 2: Total Meat Produced */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                  <div className="flex items-center gap-2 mb-2 text-blue-600">
                    <Package className="w-5 h-5" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Total Dressed (Katay) (MTD)</p>
                  </div>
                  <p className="text-2xl font-black text-gray-800">1,240 <span className="text-sm font-normal">kg</span></p>
                  <p className="text-xs text-gray-500 mt-1">4 heads processed this month</p>
                </div>

                {/* KPI 3: Market Value */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
                  <div className="flex items-center gap-2 mb-2 text-[#2D5A27]">
                    <TrendingUp className="w-5 h-5" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Market Valuation</p>
                  </div>
                  <p className="text-2xl font-black text-gray-800">₱114.5k</p>
                  <p className="text-xs text-gray-500 mt-1">Estimated revenue from inventory</p>
                </div>
                </div>

              {/* Production Type Selector */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
                <h3 className="text-lg font-bold mb-4">Select Production Type</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => setProductionType('milk')}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center ${
                      productionType === 'milk'
                        ? 'border-[#2D5A27] bg-[#2D5A27]/5'
                        : 'border-gray-100 hover:border-gray-300 bg-gray-50'
                    }`}
                  >
                    <Milk className={`w-8 h-8 mb-2 ${productionType === 'milk' ? 'text-[#2D5A27]' : 'text-gray-400'}`} />
                    <p className="text-sm font-bold">Milk</p>
                  </button>
                  
                  <button
                    onClick={() => setProductionType('slaughter')}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center ${
                      productionType === 'slaughter'
                        ? 'border-[#2D5A27] bg-[#2D5A27]/5'
                        : 'border-gray-100 hover:border-gray-300 bg-gray-50'
                    }`}
                  >
                    <Package className={`w-8 h-8 mb-2 ${productionType === 'slaughter' ? 'text-[#2D5A27]' : 'text-gray-400'}`} />
                    <p className="text-sm font-bold">Katay</p>
                  </button>
                  
                  <button
                    onClick={() => setProductionType('sale')}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center ${
                      productionType === 'sale'
                        ? 'border-[#2D5A27] bg-[#2D5A27]/5'
                        : 'border-gray-100 hover:border-gray-300 bg-gray-50'
                    }`}
                  >
                    <TrendingUp className={`w-8 h-8 mb-2 ${productionType === 'sale' ? 'text-[#2D5A27]' : 'text-gray-400'}`} />
                    <p className="text-sm font-bold">Live Sale</p>
                  </button>
                </div>
              </div>

              {/* Production Form */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold mb-4">
                  {productionType === 'milk' ? 'Log Milk Production' : 
                   productionType === 'slaughter' ? 'Log Slaughter (Katay)' : 
                   'Log Live Cattle Sale'}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="date"
                        defaultValue={new Date().toISOString().split('T')[0]}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] outline-none"
                      />
                    </div>
                  </div>

                  {productionType === 'milk' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Quantity (Liters)</label>
                        <input type="number" step="0.1" placeholder="0.0" className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] outline-none" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Time</label>
                        <select className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] outline-none">
                          <option>Morning</option>
                          <option>Afternoon</option>
                          <option>Evening</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {productionType === 'slaughter' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Tag #</label>
                        <input type="text" placeholder="B-000" className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] outline-none" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Live (kg)</label>
                        <input type="number" className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] outline-none" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Dressed (kg)</label>
                        <input type="number" className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] outline-none" required />
                      </div>
                    </div>
                  )}

                  {productionType === 'sale' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Heads</label>
                        <input type="number" className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] outline-none" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Total kg</label>
                        <input type="number" className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] outline-none" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Price (₱)</label>
                        <input type="number" className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] outline-none" required />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-1">Notes</label>
                    <textarea rows={2} placeholder="Optional details..." className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] outline-none resize-none" />
                  </div>

                  <button type="submit" className="w-full py-4 bg-[#2D5A27] text-white rounded-lg hover:bg-[#3d7234] transition-colors font-bold shadow-lg">
                    Submit Record
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {records.map((record) => (
                <div key={record.id} className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        record.type === 'milk' ? 'bg-blue-100 text-blue-800' : 
                        record.type === 'slaughter' ? 'bg-purple-100 text-purple-800' : 
                        'bg-green-100 text-green-800'
                      }`}>
                        {record.type}
                      </span>
                      <span className="text-sm text-gray-500 font-medium">
                        {new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">
                      {record.quantity} <span className="text-sm font-normal text-gray-500">{record.unit}</span>
                    </p>
                  </div>
                  {record.amount && (
                    <p className="text-sm font-medium text-green-700 mb-1">
                      Sale Value: ₱{record.amount.toLocaleString()}
                    </p>
                  )}
                  <p className="text-sm text-gray-600 italic">"{record.notes}"</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <MobileNav />
    </div>
  );
}