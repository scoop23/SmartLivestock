"use client"

import { useState } from 'react';
import { PageHeader } from '@/app/components/page-header';
import { Search, Download, MapPin, ChevronDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type DataTab = 'livestock' | 'production' | 'sales' | 'disease' | 'mortality' | 'slaughter';

export default function DataOverviewPage() {
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

  return (
    <>
      <PageHeader
          title="System Data Overview"
          subtitle="Comprehensive view of all livestock records and logistics — Municipal Agriculture Office"
          variant="admin"
        />

        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
          {/* Controls Area */}
          <div className="bg-white p-4 md:p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
            {/* Top Bar: Category Tabs & Export Action */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DataTab)} className="w-full lg:w-auto">
                <TabsList className="bg-gray-100 p-1 rounded-2xl h-auto flex flex-wrap gap-1">
                  {(['livestock', 'production', 'sales', 'disease', 'mortality', 'slaughter'] as DataTab[]).map((tab) => (
                    <TabsTrigger
                      key={tab}
                      value={tab}
                      className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm text-gray-400 hover:text-gray-700"
                    >
                      {tab}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <Button
                onClick={handleExport}
                className="bg-[#2D5A27] hover:bg-[#23461f] text-white font-bold px-6 py-5 rounded-2xl flex items-center gap-2 shadow-sm transition-all cursor-pointer text-xs uppercase tracking-wider shrink-0 self-end lg:self-auto"
              >
                <Download size={15} />
                Export Excel
              </Button>
            </div>

            {/* Bottom Bar: Search & Location Filter */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between pt-4 border-t border-gray-100">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <Input
                  type="text"
                  placeholder={`Search records in ${activeTab}...`}
                  className="w-full pl-12 pr-4 py-6 bg-gray-50 border-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A27] transition-all text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="relative w-full sm:w-64">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                <select
                  className="w-full pl-10 pr-9 py-3.5 bg-gray-50 border-none rounded-2xl text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-[#2D5A27] transition-all cursor-pointer appearance-none"
                  value={filterBarangay}
                  onChange={(e) => setFilterBarangay(e.target.value)}
                >
                  {barangays.map(b => (
                    <option key={b} value={b === 'All Barangays' ? 'all' : b}>{b}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
              </div>
            </div>
          </div>

          {/* Dynamic Table */}
          <div className="bg-white rounded-2xl md:rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50 hover:bg-gray-50/50 border-b border-gray-100">
                  <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">ID</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Farmer</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Location</TableHead>
                  {activeTab === 'livestock' && (
                    <>
                      <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Cattle Info</TableHead>
                      <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Acquisition</TableHead>
                      <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Route (Origin-Dest)</TableHead>
                      <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</TableHead>
                    </>
                  )}
                  {activeTab === 'production' && (
                    <>
                      <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</TableHead>
                      <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Quantity</TableHead>
                      <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</TableHead>
                    </>
                  )}
                  {activeTab === 'sales' && (
                    <>
                      <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Product</TableHead>
                      <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount</TableHead>
                      <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Buyer</TableHead>
                    </>
                  )}
                  {activeTab === 'disease' && (
                    <>
                      <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Disease</TableHead>
                      <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</TableHead>
                      <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Veterinarian</TableHead>
                    </>
                  )}
                  {activeTab === 'mortality' && (
                    <>
                      <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Cattle ID</TableHead>
                      <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Cause</TableHead>
                      <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</TableHead>
                    </>
                  )}
                  {activeTab === 'slaughter' && (
                    <>
                      <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Cattle ID</TableHead>
                      <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Purpose</TableHead>
                      <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Health Status</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-50">
                {filteredItems.map((item: any) => (
                  <TableRow key={item.id} className="group hover:bg-gray-50/80 transition-all border-none">
                    <TableCell className="px-6 py-4 font-bold text-gray-900">{item.id}</TableCell>
                    <TableCell className="px-6 py-4 font-medium text-gray-800">{item.farmerName}</TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-gray-600 text-xs font-medium">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" /> {item.barangay}
                      </div>
                    </TableCell>

                    {/* Livestock Custom Columns */}
                    {activeTab === 'livestock' && (
                      <>
                        <TableCell className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-blue-600">{item.cattleId}</span>
                            <span className="text-gray-500 text-[11px]">{item.breed}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <Badge
                            variant="outline"
                            className={`border-none text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${
                              item.acquisition === 'Import' ? 'bg-blue-100 text-blue-700' :
                              item.acquisition === 'Export' ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {item.acquisition}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="flex flex-col text-[11px] text-gray-600 gap-0.5">
                            <span className="flex items-center gap-1">
                              <span className="w-10 text-gray-400 font-bold">FROM:</span> {item.origin}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-10 text-gray-400 font-bold">TO:</span> {item.destination}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <Badge
                            variant="outline"
                            className="border-none text-[9px] font-black uppercase px-2.5 py-1 rounded-full bg-green-100 text-green-700"
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                      </>
                    )}

                    {/* Production Specific */}
                    {activeTab === 'production' && (
                      <>
                        <TableCell className="px-6 py-4 font-medium text-gray-800">{item.type}</TableCell>
                        <TableCell className="px-6 py-4 font-black text-[#2D5A27]">{item.quantity}</TableCell>
                        <TableCell className="px-6 py-4 text-xs text-gray-500">{item.date}</TableCell>
                      </>
                    )}

                    {/* Sales Specific */}
                    {activeTab === 'sales' && (
                      <>
                        <TableCell className="px-6 py-4 font-medium text-gray-800">{item.product}</TableCell>
                        <TableCell className="px-6 py-4 text-green-700 font-black">{item.amount}</TableCell>
                        <TableCell className="px-6 py-4 font-medium text-gray-700">{item.buyer}</TableCell>
                      </>
                    )}

                    {/* Disease Specific */}
                    {activeTab === 'disease' && (
                      <>
                        <TableCell className="px-6 py-4 text-red-600 font-bold">{item.disease}</TableCell>
                        <TableCell className="px-6 py-4">
                          <Badge
                            variant="outline"
                            className="border-none text-[9px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-100 text-amber-800"
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-xs text-gray-600">{item.veterinarian}</TableCell>
                      </>
                    )}

                    {/* Mortality Specific */}
                    {activeTab === 'mortality' && (
                      <>
                        <TableCell className="px-6 py-4 font-mono text-xs font-bold text-gray-700">{item.cattleId}</TableCell>
                        <TableCell className="px-6 py-4 text-gray-700 font-medium">{item.cause}</TableCell>
                        <TableCell className="px-6 py-4 text-xs text-gray-500">{item.dateOfDeath}</TableCell>
                      </>
                    )}

                    {/* Slaughter Specific */}
                    {activeTab === 'slaughter' && (
                      <>
                        <TableCell className="px-6 py-4 font-mono text-xs font-bold text-gray-700">{item.cattleId}</TableCell>
                        <TableCell className="px-6 py-4 text-gray-700 font-medium">{item.purpose}</TableCell>
                        <TableCell className="px-6 py-4">
                          <Badge
                            variant="outline"
                            className="border-none text-[9px] font-black uppercase px-2.5 py-1 rounded-full bg-blue-100 text-blue-700"
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredItems.length === 0 && (
              <div className="p-12 text-center">
                <div className="bg-gray-50 inline-block p-4 rounded-full mb-3">
                  <Search className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium text-sm">No records found matching your current filters.</p>
              </div>
            )}
          </div>
        </div>
    </>
  );
}
