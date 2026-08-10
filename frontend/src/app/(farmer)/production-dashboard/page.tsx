"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import type { ProductionType } from "./production-form-fields";
import ProductionHistory from "./production-history";
import ProductionStats from "./production-stats";
import ProductionWizard from "./production-wizard";
import { LivestockInventoryItem } from '../livestock-inventory/page';
import api from '@/lib/axios';

export type UnitType = "liters" | "pieces" | "kilograms";

export default function ProductionLoggerPage() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [productionType, setProductionType] = useState<ProductionType>('milk');
  const [clickedInventory, setClickedInventory] = useState<LivestockInventoryItem | null>(null);
  const [formState, setFormState] = useState<Record<string, string | number>>({});
  const [resetSignal, setResetSignal] = useState(0);

  const queryClient = useQueryClient();

  const { data: inventories = [], isLoading } = useQuery<LivestockInventoryItem[]>({
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
      setIsWizardOpen(false);
      queryClient.invalidateQueries({ queryKey: ["production"] });
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
        action={
          <Button
            type="button"
            onClick={() => setIsWizardOpen(true)}
            className="bg-white text-[#2D5A27] hover:bg-white/90 shadow-sm px-4"
          >
            <Plus className="size-4" /> Log Production
          </Button>
        }
      />

      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
        {/* Quick Stats */}
        <ProductionStats />

        {/* Production History */}
        <ProductionHistory />
      </div>

      {/* Production Entry Wizard (modal) */}
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
        open={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
      />
    </>
  );
}
