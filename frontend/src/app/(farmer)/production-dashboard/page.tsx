"use client";

import { useState } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/app/components/page-header";
import { Package, Milk, TrendingUp, Calendar, Check } from 'lucide-react';
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import ProductionFormFields, {
  type ProductionType,
} from "./production-form-fields";
import ProductionHistory, {
  type ProductionRecord,
} from "./production-history";
import { LivestockInventoryItem } from '../livestock-inventory/page';
import api from '@/lib/axios';

export type UnitType = "liters" | "pieces" | "kilograms";

const formatDate = (date: string | null | undefined) => {
  if (!date) return "Unknown date";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (match) {
    const [, y, m, d] = match;
    const month = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "short" });
    return `${month} ${Number(d)}, ${y}`;
  }
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

export default function ProductionLoggerPage() {
  const [activeTab, setActiveTab] = useState<'log' | 'history'>('log');
  const [productionType, setProductionType] = useState<ProductionType>('milk');
  const [clickedInventory, setClickedInventory] = useState<LivestockInventoryItem | null>(null);
  const [formState, setFormState] = useState<Record<string, string | number>>({});
  const [records] = useState<ProductionRecord[]>([
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

  const { data: inventories = [], isLoading: isLoading } = useQuery<LivestockInventoryItem[]>({
    queryKey: ["inventory"],
    queryFn: async () => {
      const res = await api.get("livestock/inventory/");
      const result: LivestockInventoryItem[] = [];
      for (const item of res.data) {
        result.push({
          id: item.id,
          farmerName: item.farmer_name,
          livestockTypeName: item.livestock_type_name,
          entryType: item.entry_type,
          quantity: item.quantity,
          tagNumber: item.tag_number,
          breed: item.breed,
          sex: item.sex,
          weight: item.weight,
          lastVaccinationDate: item.last_vaccination_date,
          status: item.status,
          reviewRemarks: item.review_remarks,
          createdAt: item.created_at,
        });
      }
      return result;
    }
  });

  const approvedInventories = inventories.filter((item) => item.status === "APPROVED");

  const { data: livestockTypes = {} } = useQuery<Record<string, number>>({
    queryKey: ["livestockTypes"],
    queryFn: async () => {
      const res = await api.get<{ id: number; name: string }[]>("livestock/livestock_types/");
      const map: Record<string, number> = {};
      res.data.forEach((t) => { map[t.name] = t.id });
      return map;
    },
  });

  const handleFieldChange = (field: string, val: string | number) => {
    setFormState((prev) => ({ ...prev, [field]: val }));
  };

  const handleTypeSelect = (type: ProductionType) => {
    setProductionType(type);
    setClickedInventory(null);
  };

  const submitMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const url =
        productionType === 'milk' ? '/production/milk/create/'
          : productionType === 'slaughter' ? '/production/slaughter/create/'
            : '/production/sale/create/';
      const res = await api.post(url, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Production record submitted for approval');
      setClickedInventory(null);
      setFormState({});
    },
    onError: (err) => {
      console.error(err);
      toast.error('Failed to submit production record');
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!clickedInventory) {
      toast.error('Please select a livestock inventory first.');
      return;
    }

    const payload: Record<string, unknown> = {
      record_date: formState.prodDate ?? new Date().toISOString().split('T')[0],
    };

    /*
     * payload could be something like names : [], quantity : number 
     * thats why unknown
     * */

    if (productionType === 'milk') {
      payload.livestock = clickedInventory.id;
      payload.production_type = 'MILK';
      payload.quantity = Number(formState.milkQty);
      payload.unit = 'LITERS';
    } else if (productionType === 'slaughter') {
      payload.livestock = clickedInventory.id;
      payload.livestock_type = livestockTypes[clickedInventory.livestockTypeName];
      payload.quantity = 1;
      payload.carcass_weight = formState.dressedWt ? Number(formState.dressedWt) : null;
    } else {
      payload.livestock = clickedInventory.id;
      payload.quantity = Number(formState.heads);
      payload.sale_method = 'WEIGHING';
      payload.total_live_weight = formState.totalKg ? Number(formState.totalKg) : null;
      payload.total_price = formState.price ? Number(formState.price) : null;
    }

    submitMutation.mutate(payload); // send payload
  };

  return (
    <>
      <PageHeader
        title="Production Dashboard"
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
                    {/* still not sure if we can get this */}
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
                    onClick={() => handleTypeSelect('milk')}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center ${productionType === 'milk'
                      ? 'border-[#2D5A27] bg-[#2D5A27]/5'
                      : 'border-slate-100 hover:border-slate-300 bg-slate-50'
                      }`}
                  >
                    <Milk className={`w-8 h-8 mb-2 ${productionType === 'milk' ? 'text-[#2D5A27]' : 'text-slate-400'}`} />
                    <p className="text-sm font-bold">Milk</p>
                  </button>

                  <button
                    onClick={() => handleTypeSelect('slaughter')}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center ${productionType === 'slaughter'
                      ? 'border-[#2D5A27] bg-[#2D5A27]/5'
                      : 'border-slate-100 hover:border-slate-300 bg-slate-50'
                      }`}
                  >
                    <Package className={`w-8 h-8 mb-2 ${productionType === 'slaughter' ? 'text-[#2D5A27]' : 'text-slate-400'}`} />
                    <p className="text-sm font-bold">Katay</p>
                  </button>

                  <button
                    onClick={() => handleTypeSelect('sale')}
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

            {/* Inventory Selector */}
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  Select Livestock
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Click an inventory record to link it to this {productionType} record.
                </p>

                {isLoading ? (
                  <p className="text-sm text-slate-500 py-4">Loading inventory...</p>
                ) : approvedInventories.length === 0 ? (
                  <div className="p-6 text-center rounded-xl border border-dashed border-slate-200">
                    <p className="text-sm text-slate-500">
                      No approved livestock inventory found. Add livestock in the Livestock Inventory page first.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <Table className="responsive-table">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Batch / Tag</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Type</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Breed</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sex</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Heads / Wt</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Added</TableHead>
                          <TableHead className="w-20 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Select</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {approvedInventories.map((item) => {
                          const selected = clickedInventory?.id === item.id;
                          return (
                            <TableRow
                              key={item.id}
                              data-state={selected ? "selected" : undefined}
                              onClick={() => setClickedInventory(item)}
                              className="cursor-pointer"
                            >
                              <TableCell data-label="Batch / Tag" className="font-bold text-slate-900 px-5">
                                {item.entryType === "INDIVIDUAL"
                                  ? item.tagNumber || "Un-tagged"
                                  : `Batch #${item.id}`}
                              </TableCell>
                              <TableCell data-label="Type" className="text-slate-600">{item.livestockTypeName}</TableCell>
                              <TableCell data-label="Breed" className="text-slate-600">{item.breed || "Standard Breed"}</TableCell>
                              <TableCell data-label="Sex" className="text-slate-600">{item.sex}</TableCell>
                              <TableCell data-label="Heads / Wt" className="text-slate-600">
                                {item.entryType === "BATCH" && `${item.quantity} heads`}
                                {item.weight != null && `${item.entryType === "BATCH" ? " • " : ""}${item.weight} kg`}
                              </TableCell>
                              <TableCell data-label="Added" className="text-slate-500">{formatDate(item.createdAt)}</TableCell>
                              <TableCell data-label="Select" className="text-right">
                                {selected ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#2D5A27]">
                                    <Check className="w-4 h-4" /> Selected
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400">Click</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
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
                        name="prodDate"
                        type="date"
                        className="pl-10"
                        value={String(formState.prodDate ?? new Date().toISOString().split('T')[0])}
                        onChange={(e) => handleFieldChange('prodDate', e.target.value)}
                      />
                    </div>
                  </div>

                  <ProductionFormFields
                    type={productionType}
                    value={formState}
                    onChange={handleFieldChange}
                  />

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      rows={2}
                      placeholder="Optional details..."
                      value={String(formState.notes ?? "")}
                      onChange={(e) => handleFieldChange('notes', e.target.value)}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={!clickedInventory || submitMutation.isPending}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white gap-2 font-medium shadow-sm"
                  >
                    {submitMutation.isPending ? 'Submitting...' : 'Submit Record'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        ) : (
          <ProductionHistory records={records} />
        )}
      </div>
    </>
  );
}
