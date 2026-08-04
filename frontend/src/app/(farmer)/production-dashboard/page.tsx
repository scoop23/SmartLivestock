"use client";

import { useState } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/app/components/page-header";
import { TrendingUp } from 'lucide-react';
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";

import type { ProductionType } from "./production-form-fields";
import ProductionHistory, {
  type ProductionRecord,
} from "./production-history";
import ProductionWizard from "./production-wizard";
import { LivestockInventoryItem } from '../livestock-inventory/page';
import api from '@/lib/axios';

export type UnitType = "liters" | "pieces" | "kilograms";

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

  const handleFieldChange = (field: string, val: string | number) => {
    setFormState((prev) => ({ ...prev, [field]: val }));
  };

  const handleTypeSelect = (type: ProductionType) => {
    setProductionType(type);
    setClickedInventory(null);
  };

  const submitMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await api.post('/production/create/', payload);
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

  return (
    <>
      <PageHeader
        title="Production Dashboard"
        subtitle="Record milk, eggs, and wool production"
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
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    Market Valuation
                  </p>
                  <p className="text-2xl font-black text-slate-900 mt-1">₱114.5k</p>
                  <p className="text-xs text-slate-500 mt-1">Estimated revenue from inventory</p>
                </CardContent>
              </Card>
            </div>

            {/* Production Entry Wizard */}
            <ProductionWizard
              productionType={productionType}
              onTypeChange={handleTypeSelect}
              clickedInventory={clickedInventory}
              onSelectInventory={setClickedInventory}
              formState={formState}
              onFieldChange={handleFieldChange}
              approvedInventories={approvedInventories}
              isLoading={isLoading}
              isSubmitting={submitMutation.isPending}
              onSubmit={(payload) => submitMutation.mutate(payload)}
            />
          </>
        ) : (
          <ProductionHistory records={records} />
        )}
      </div>
    </>
  );
}
