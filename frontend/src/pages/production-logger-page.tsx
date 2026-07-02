import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Sidebar } from '../components/sidebar';
import { Package, Milk, TrendingUp, Calendar } from 'lucide-react';

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
  const navigate = useNavigate();
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
    // Mock form submission
    alert('Production record logged successfully!');
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <div className="hidden md:block">
        <Sidebar role="farmer" onLogout={() => navigate('/')} />
      </div>

      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        {/* Header */}
        <div className="bg-[#2D5A27] text-white p-4 md:p-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl mb-1 text-white">Production Logger</h1>
            <p className="text-white/90">Record milk, slaughter (katay), and sales</p>
          </div>
        </div>

        <div className="p-4 md:p-6 max-w-4xl mx-auto">
          {/* Tab Selector */}
          <div className="bg-white p-1 rounded-lg shadow-sm border border-gray-200 mb-6 inline-flex">
            <button
              onClick={() => setActiveTab('log')}
              className={`px-6 py-2 rounded-lg transition-colors ${activeTab === 'log'
                  ? 'bg-[#2D5A27] text-white'
                  : 'text-gray-700 hover:bg-gray-100'
                }`}
            >
              Log Production
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-2 rounded-lg transition-colors ${activeTab === 'history'
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
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <Milk className="w-6 h-6 text-blue-600 mb-2" />
                  <p className="text-xl mb-1">450L</p>
                  <p className="text-xs text-gray-600">Today's Milk</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <TrendingUp className="w-6 h-6 text-green-600 mb-2" />
                  <p className="text-xl mb-1">13,500L</p>
                  <p className="text-xs text-gray-600">This Month</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <Package className="w-6 h-6 text-[#2D5A27] mb-2" />
                  <p className="text-xl mb-1">₱45.6k</p>
                  <p className="text-xs text-gray-600">Month Sales</p>
                </div>
              </div>

              {/* Production Type Selector */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
                <h3 className="mb-4">Select Production Type</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => setProductionType('milk')}
                    className={`p-4 rounded-lg border-2 transition-all ${productionType === 'milk'
                        ? 'border-[#2D5A27] bg-[#2D5A27]/5'
                        : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <Milk className={`w-8 h-8 mx-auto mb-2 ${productionType === 'milk' ? 'text-[#2D5A27]' : 'text-gray-400'}`} />
                    <p className="text-sm text-center">Milk Production</p>
                  </button>

                  <button
                    onClick={() => setProductionType('slaughter')}
                    className={`p-4 rounded-lg border-2 transition-all ${productionType === 'slaughter'
                        ? 'border-[#2D5A27] bg-[#2D5A27]/5'
                        : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <Package className={`w-8 h-8 mx-auto mb-2 ${productionType === 'slaughter' ? 'text-[#2D5A27]' : 'text-gray-400'}`} />
                    <p className="text-sm text-center">Katay (Slaughter)</p>
                  </button>

                  <button
                    onClick={() => setProductionType('sale')}
                    className={`p-4 rounded-lg border-2 transition-all ${productionType === 'sale'
                        ? 'border-[#2D5A27] bg-[#2D5A27]/5'
                        : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <TrendingUp className={`w-8 h-8 mx-auto mb-2 ${productionType === 'sale' ? 'text-[#2D5A27]' : 'text-gray-400'}`} />
                    <p className="text-sm text-center">Live Sale</p>
                  </button>
                </div>
              </div>

              {/* Production Form */}
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="mb-4">
                  {productionType === 'milk' ? 'Log Milk Production' :
                    productionType === 'slaughter' ? 'Log Slaughter (Katay)' :
                      'Log Live Cattle Sale'}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block mb-2">Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="date"
                        defaultValue={new Date().toISOString().split('T')[0]}
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] focus:border-transparent outline-none"
                      />
                    </div>
                  </div>

                  {productionType === 'milk' && (
                    <>
                      <div>
                        <label className="block mb-2">Milk Quantity (Liters)</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="e.g., 450"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] focus:border-transparent outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block mb-2">Collection Time</label>
                        <select className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] focus:border-transparent outline-none">
                          <option>Morning</option>
                          <option>Afternoon</option>
                          <option>Evening</option>
                        </select>
                      </div>
                    </>
                  )}

                  {productionType === 'slaughter' && (
                    <>
                      <div>
                        <label className="block mb-2">Cattle Tag Number</label>
                        <input
                          type="text"
                          placeholder="e.g., B-042"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] focus:border-transparent outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block mb-2">Live Weight (kg)</label>
                        <input
                          type="number"
                          placeholder="e.g., 350"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] focus:border-transparent outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block mb-2">Dressed Weight (kg)</label>
                        <input
                          type="number"
                          placeholder="e.g., 210"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] focus:border-transparent outline-none"
                          required
                        />
                      </div>
                    </>
                  )}

                  {productionType === 'sale' && (
                    <>
                      <div>
                        <label className="block mb-2">Number of Cattle</label>
                        <input
                          type="number"
                          placeholder="e.g., 2"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] focus:border-transparent outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block mb-2">Total Weight (kg)</label>
                        <input
                          type="number"
                          placeholder="e.g., 660"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] focus:border-transparent outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block mb-2">Sale Amount (₱)</label>
                        <input
                          type="number"
                          placeholder="e.g., 85000"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] focus:border-transparent outline-none"
                          required
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block mb-2">Notes</label>
                    <textarea
                      rows={3}
                      placeholder="Add any additional notes..."
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] focus:border-transparent outline-none resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-[#2D5A27] text-white rounded-lg hover:bg-[#3d7234] transition-colors"
                  >
                    Submit Record
                  </button>
                </form>
              </div>
            </>
          ) : (
            /* History View */
            <div className="space-y-4">
              {records.map((record) => (
                <div key={record.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs capitalize ${record.type === 'milk'
                            ? 'bg-blue-100 text-blue-800'
                            : record.type === 'slaughter'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                      >
                        {record.type}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(record.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    <p className="text-lg">
                      {record.quantity} {record.unit}
                    </p>
                  </div>
                  {record.amount && (
                    <p className="text-sm mb-2">
                      <span className="text-gray-600">Amount:</span>{' '}
                      <span className="text-green-600 font-medium">₱{record.amount.toLocaleString()}</span>
                    </p>
                  )}
                  <p className="text-sm text-gray-600">{record.notes}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-30">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          <button onClick={() => navigate('/farmer')} className="flex flex-col items-center gap-1 text-gray-600">
            <span className="text-xs">Home</span>
          </button>
          <button onClick={() => navigate('/livestock-inventory')} className="flex flex-col items-center gap-1 text-gray-600">
            <span className="text-xs">Inventory</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-[#2D5A27]">
            <span className="text-xs">Logger</span>
          </button>
          <button onClick={() => navigate('/alerts')} className="flex flex-col items-center gap-1 text-gray-600">
            <span className="text-xs">Alerts</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
