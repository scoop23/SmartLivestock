"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/app/components/sidebar';
import { PageHeader } from '@/app/components/page-header';
import { Search, Download, MapPin } from 'lucide-react';

type DataTab = 'livestock' | 'production' | 'sales' | 'disease' | 'mortality' | 'slaughter';

export default function DataOverviewPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DataTab>('livestock');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBarangay, setFilterBarangay] = useState('all');

  const barangays = ['All Barangays', 'San Roque', 'Banaba Ibaba', 'Quilo-quilo', 'Castillo', 'Maugat', 'Banaba Ilaya', 'Dayap', 'Tamak'];

  // --- UPDATED DATA SOURCES ---
  const livestockData = [
    { id: 'L-001', farmerName: 'Juan dela Cruz', barangay: 'San Roque', cattleId: 'C-2024-001', breed: 'Brahman', status: 'Healthy', acquisition: 'Local', origin: 'Padre Garcia', destination: 'N/A' },
    { id: 'L-002', farmerName: 'Maria Santos', barangay: 'San Roque', cattleId: 'C-2024-002', breed: 'Holstein', status: 'Healthy', acquisition: 'Import', origin: 'Batangas Port', destination: 'San Roque' },
    { id: 'L-003', farmerName: 'Pedro Reyes', barangay: 'Banaba Ibaba', cattleId: 'C-2024-003', breed: 'Simmental', status: 'Vaccinated', acquisition: 'Local', origin: 'Padre Garcia', destination: 'N/A' },
    { id: 'L-004', farmerName: 'Ana Garcia', barangay: 'Quilo-quilo', cattleId: 'C-2024-004', breed: 'Brahman', status: 'Export', acquisition: 'Export', origin: 'Quilo-quilo', destination: 'Manila Market' },
    { id: 'L-005', farmerName: 'Jose Fernandez', barangay: 'Castillo', cattleId: 'C-2024-005', breed: 'Angus', status: 'Healthy', acquisition: 'Local', origin: 'Padre Garcia', destination: 'N/A' },
  ];

  const productionData = [
    { id: 'P-001', farmerName: 'Juan dela Cruz', barangay: 'San Roque', type: 'Milk', quantity: '45 L', date: '2024-04-20' },
    { id: 'P-002', farmerName: 'Maria Santos', barangay: 'San Roque', type: 'Milk', quantity: '38 L', date: '2024-04-21' },
    { id: 'P-005', farmerName: 'Jose Fernandez', barangay: 'Castillo', type: 'Milk', quantity: '41 L', date: '2024-04-24' },
  ];

  const salesData = [
    { id: 'S-001', farmerName: 'Juan dela Cruz', barangay: 'San Roque', product: 'Milk', quantity: '200 L', amount: '₱12,000', buyer: 'Dairy Co-op' },
    { id: 'S-002', farmerName: 'Maria Santos', barangay: 'San Roque', product: 'Live Cattle', quantity: '1 head', amount: '₱45,000', buyer: 'Local Market' },
  ];

  const diseaseData = [
    { id: 'D-001', farmerName: 'Pedro Reyes', barangay: 'Banaba Ibaba', cattleId: 'C-2024-012', disease: 'FMD', status: 'Under Treatment', veterinarian: 'Dr. Cruz' },
    { id: 'D-002', farmerName: 'Maria Lopez', barangay: 'Banaba Ibaba', cattleId: 'C-2024-018', disease: 'Mastitis', status: 'Recovered', veterinarian: 'Dr. Santos' },
  ];

  const mortalityData = [
    { id: 'M-001', farmerName: 'Ricardo Tan', barangay: 'Castillo', cattleId: 'C-2023-089', cause: 'Old Age', dateOfDeath: '2024-03-15' },
  ];

  const slaughterData = [
    { id: 'SL-001', farmerName: 'Jose Fernandez', barangay: 'Castillo', cattleId: 'C-2023-075', purpose: 'Commercial', status: 'Approved' },
  ];

  const getActiveData = () => {
    switch (activeTab) {
      case 'livestock': return livestockData;
      case 'production': return productionData;
      case 'sales': return salesData;
      case 'disease': return diseaseData;
      case 'mortality': return mortalityData;
      case 'slaughter': return slaughterData;
      default: return [];
    }
  };

  const filteredItems = getActiveData().filter(item => {
    const matchesSearch = searchQuery === '' ||
      Object.values(item).some(val => String(val).toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesBarangay = filterBarangay === 'all' || item.barangay === filterBarangay;
    return matchesSearch && matchesBarangay;
  });

  const handleExport = () => alert(`Exporting ${activeTab} data to Excel...`);
  const handleLogout = () => router.push('/');

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 antialiased">

      <div className='hidden md:block'>
        <Sidebar role="lgu" onLogout={handleLogout} />
      </div>

      <main className="flex-1 overflow-auto">
        <PageHeader
          title="System Data Overview"
          subtitle="Comprehensive view of all livestock records and logistics — Municipal Agriculture Office"
          variant="admin"
        />

        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
          {/* Filters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-3 shadow-xs">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#2D5A27]/30 outline-none transition-all"
                placeholder={`Search records in ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="md:w-64 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2D5A27]/30 bg-white"
              value={filterBarangay}
              onChange={(e) => setFilterBarangay(e.target.value)}
            >
              {barangays.map(b => (
                <option key={b} value={b === 'All Barangays' ? 'all' : b}>{b}</option>
              ))}
            </select>

            <button
              onClick={handleExport}
              className="bg-[#2D5A27] hover:bg-[#23461f] text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </button>
          </div>

          {/* Tabs Navigation */}
          <div className="bg-white border rounded-lg mb-6 overflow-hidden shadow-sm">
            <div className="flex overflow-x-auto">
              {(['livestock', 'production', 'sales', 'disease', 'mortality', 'slaughter'] as DataTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-4 text-sm font-semibold border-b-2 transition-all ${activeTab === tab
                    ? 'border-[#2D5A27] text-[#2D5A27] bg-green-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Table */}
          <div className="overflow-x-auto bg-white rounded-xl border shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
                <tr>
                  <th className="p-4">ID</th>
                  <th className="p-4">Farmer</th>
                  <th className="p-4">Location</th>
                  {activeTab === 'livestock' && (
                    <>
                      <th className="p-4">Cattle Info</th>
                      <th className="p-4">Acquisition</th>
                      <th className="p-4">Route (Origin-Dest)</th>
                      <th className="p-4">Status</th>
                    </>
                  )}
                  {activeTab === 'production' && (
                    <>
                      <th className="p-4">Type</th>
                      <th className="p-4">Quantity</th>
                      <th className="p-4">Date</th>
                    </>
                  )}
                  {activeTab === 'sales' && (
                    <>
                      <th className="p-4">Product</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4">Buyer</th>
                    </>
                  )}
                  {activeTab === 'disease' && (
                    <>
                      <th className="p-4">Disease</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Veterinarian</th>
                    </>
                  )}
                  {activeTab === 'mortality' && (
                    <>
                      <th className="p-4">Cattle ID</th>
                      <th className="p-4">Cause</th>
                      <th className="p-4">Date</th>
                    </>
                  )}
                  {activeTab === 'slaughter' && (
                    <>
                      <th className="p-4">Cattle ID</th>
                      <th className="p-4">Purpose</th>
                      <th className="p-4">Health Status</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredItems.map((item: any) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-bold text-gray-900">{item.id}</td>
                    <td className="p-4">{item.farmerName}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <MapPin className="w-3.5 h-3.5" /> {item.barangay}
                      </div>
                    </td>

                    {/* Livestock Custom Columns */}
                    {activeTab === 'livestock' && (
                      <>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className=" text-xs font-bold text-blue-600">{item.cattleId}</span>
                            <span className="text-gray-500 text-[11px]">{item.breed}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${item.acquisition === 'Import' ? 'bg-blue-100 text-blue-700' :
                            item.acquisition === 'Export' ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                            {item.acquisition}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col text-[11px] text-gray-600 gap-0.5">
                            <span className="flex items-center gap-1">
                              <span className="w-10 text-gray-400 font-bold">FROM:</span> {item.origin}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-10 text-gray-400 font-bold">TO:</span> {item.destination}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-1 rounded-full text-[11px] bg-green-100 text-green-700 font-medium">
                            {item.status}
                          </span>
                        </td>
                      </>
                    )}

                    {/* Production Specific */}
                    {activeTab === 'production' && (
                      <>
                        <td className="p-4">{item.type}</td>
                        <td className="p-4 font-bold text-[#2D5A27]">{item.quantity}</td>
                        <td className="p-4 text-gray-500">{item.date}</td>
                      </>
                    )}

                    {/* Sales Specific */}
                    {activeTab === 'sales' && (
                      <>
                        <td className="p-4">{item.product}</td>
                        <td className="p-4 text-green-700 font-bold">{item.amount}</td>
                        <td className="p-4 font-medium">{item.buyer}</td>
                      </>
                    )}

                    {/* Disease Specific */}
                    {activeTab === 'disease' && (
                      <>
                        <td className="p-4 text-red-600 font-semibold">{item.disease}</td>
                        <td className="p-4 text-orange-600">{item.status}</td>
                        <td className="p-4">{item.veterinarian}</td>
                      </>
                    )}

                    {/* Mortality Specific */}
                    {activeTab === 'mortality' && (
                      <>
                        <td className="p-4 text-xs">{item.cattleId}</td>
                        <td className="p-4 text-gray-700">{item.cause}</td>
                        <td className="p-4 text-gray-500">{item.dateOfDeath}</td>
                      </>
                    )}

                    {/* Slaughter Specific */}
                    {activeTab === 'slaughter' && (
                      <>
                        <td className="p-4 font-mono text-xs">{item.cattleId}</td>
                        <td className="p-4">{item.purpose}</td>
                        <td className="p-4 text-blue-600 font-bold italic">{item.status}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredItems.length === 0 && (
              <div className="p-12 text-center">
                <div className="bg-gray-50 inline-block p-4 rounded-full mb-3">
                  <Search className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium">No records found matching your current filters.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
