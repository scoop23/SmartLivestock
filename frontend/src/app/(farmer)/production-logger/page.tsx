"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import MobileNav from "@/app/components/mobilenav";
import { Sidebar } from "@/app/components/sidebar";
import { PageHeader } from "@/app/components/page-header";
import { Package, Milk, TrendingUp, Calendar } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ProductionHistory, {
  type ProductionRecord,
} from "./production-history";

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
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 text-slate-900 antialiased">
      <div className="hidden md:block">
        <Sidebar role="farmer" onLogout={() => router.push('/')} />
      </div>

      <main className="flex-1 overflow-auto pb-24 md:pb-10">
        <PageHeader
          title="Production Logger"
          subtitle="Record milk, slaughter (katay), and sales"
          variant="farmer"
          maxWidthClass="max-w-5xl"
          mobileMenuOffset={false}
        />

        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
          {/* Tab Selector */}
          <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
            <button
              onClick={() => setActiveTab('log')}
              className={`px-6 py-2 rounded-lg transition-colors font-medium ${activeTab === 'log'
                ? 'bg-[#2D5A27] text-white'
                : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              Log Production
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-2 rounded-lg transition-colors font-medium ${activeTab === 'history'
                ? 'bg-[#2D5A27] text-white'
                : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              History
            </button>
          </div>

          {activeTab === 'log' ? (
            <>
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-purple-500" />
                      Avg. Dress Yield
                    </p>
                    <p className="text-2xl font-black text-slate-900 mt-1">58.4%</p>
                    <p className="text-xs text-slate-500 mt-1">
                      <span className="text-green-600 font-bold">↑ 1.2%</span> from last batch
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-blue-500" />
                      Total Dressed (Katay) (MTD)
                    </p>
                    <p className="text-2xl font-black text-slate-900 mt-1">1,240 <span className="text-sm font-normal font-medium text-slate-500">kg</span></p>
                    <p className="text-xs text-slate-500 mt-1">4 heads processed this month</p>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      Market Valuation
                    </p>
                    <p className="text-2xl font-black text-slate-900 mt-1">₱114.5k</p>
                    <p className="text-xs text-slate-500 mt-1">Estimated revenue from inventory</p>
                  </CardContent>
                </Card>
              </div>

              {/* Production Type Selector */}
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-5">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Select Production Type</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      onClick={() => setProductionType('milk')}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center ${productionType === 'milk'
                        ? 'border-[#2D5A27] bg-[#2D5A27]/5'
                        : 'border-slate-100 hover:border-slate-300 bg-slate-50'
                        }`}
                    >
                      <Milk className={`w-8 h-8 mb-2 ${productionType === 'milk' ? 'text-[#2D5A27]' : 'text-slate-400'}`} />
                      <p className="text-sm font-bold">Milk</p>
                    </button>

                    <button
                      onClick={() => setProductionType('slaughter')}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center ${productionType === 'slaughter'
                        ? 'border-[#2D5A27] bg-[#2D5A27]/5'
                        : 'border-slate-100 hover:border-slate-300 bg-slate-50'
                        }`}
                    >
                      <Package className={`w-8 h-8 mb-2 ${productionType === 'slaughter' ? 'text-[#2D5A27]' : 'text-slate-400'}`} />
                      <p className="text-sm font-bold">Katay</p>
                    </button>

                    <button
                      onClick={() => setProductionType('sale')}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center ${productionType === 'sale'
                        ? 'border-[#2D5A27] bg-[#2D5A27]/5'
                        : 'border-slate-100 hover:border-slate-300 bg-slate-50'
                        }`}
                    >
                      <TrendingUp className={`w-8 h-8 mb-2 ${productionType === 'sale' ? 'text-[#2D5A27]' : 'text-slate-400'}`} />
                      <p className="text-sm font-bold">Live Sale</p>
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Production Form */}
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-5">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">
                    {productionType === 'milk' ? 'Log Milk Production' :
                      productionType === 'slaughter' ? 'Log Slaughter (Katay)' :
                        'Log Live Cattle Sale'}
                  </h3>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="prodDate">Date</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                        <Input
                          id="prodDate"
                          type="date"
                          defaultValue={new Date().toISOString().split('T')[0]}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    {productionType === 'milk' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="milkQty">Quantity (Liters)</Label>
                          <Input id="milkQty" type="number" step="0.1" placeholder="0.0" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="milkTime">Time</Label>
                          <Select>
                            <SelectTrigger id="milkTime">
                              <SelectValue placeholder="Select time" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Morning">Morning</SelectItem>
                              <SelectItem value="Afternoon">Afternoon</SelectItem>
                              <SelectItem value="Evening">Evening</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {productionType === 'slaughter' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="tag">Tag #</Label>
                          <Input id="tag" placeholder="B-000" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="liveWt">Live (kg)</Label>
                          <Input id="liveWt" type="number" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dressedWt">Dressed (kg)</Label>
                          <Input id="dressedWt" type="number" required />
                        </div>
                      </div>
                    )}

                    {productionType === 'sale' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="heads">Heads</Label>
                          <Input id="heads" type="number" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="totalKg">Total kg</Label>
                          <Input id="totalKg" type="number" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="price">Price (₱)</Label>
                          <Input id="price" type="number" required />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea id="notes" rows={2} placeholder="Optional details..." />
                    </div>

                    <Button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-800 text-white gap-2 font-medium shadow-sm">
                      Submit Record
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </>
          ) : (
            <ProductionHistory records={records} />
          )}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <MobileNav />
    </div>
  );
}
