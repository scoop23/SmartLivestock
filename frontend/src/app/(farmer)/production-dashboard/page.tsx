"use client";

import { useState } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/app/components/page-header";
import { toast } from "sonner";

import type { ProductionType } from "./production-form-fields";
import ProductionHistory from "./production-history";
import ProductionStats from "./production-stats";
import ProductionWizard from "./production-wizard";
import { LivestockInventoryItem } from '../livestock-inventory/page';
import api from '@/lib/axios';

export type UnitType = "liters" | "pieces" | "kilograms";

export default function ProductionLoggerPage() {
  const [activeTab, setActiveTab] = useState<'log' | 'history'>('log');
  const [productionType, setProductionType] = useState<ProductionType>('milk');
  const [clickedInventory, setClickedInventory] = useState<LivestockInventoryItem | null>(null);
  const [formState, setFormState] = useState<Record<string, string | number>>({});
  const [resetSignal, setResetSignal] = useState(0);


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
      setProductionType('milk');
      setResetSignal((n) => n + 1); // so that the parent will know that the child should reset its form state.
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
      />

      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
        {/* Quick Stats */}
        <ProductionStats />

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
              resetSignal={resetSignal} // do this so the child sends a signal to reset the form when the parent state changes
              onSubmit={(payload) => submitMutation.mutate(payload)}
            />
          </>
        ) : (
          <ProductionHistory />
        )}
      </div>
    </>
  );
}
