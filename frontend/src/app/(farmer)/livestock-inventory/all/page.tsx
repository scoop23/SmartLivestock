"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import LivestockDetailsDialog from "../livestock-details-dialog";
import LivestockEditDialog, { type UpdateInventoryPayload } from "../livestock-edit-dialog";
import LivestockRecordList from "../livestock-record-list";
import InventoryStats from "../inventory-stats";
import api from "@/lib/axios";
import type {
  EntryType,
  LivestockInventoryItem,
  LivestockType,
  StatusType,
} from "../page";

interface InventoryApiItem {
  id: string;
  farmer_name: string;
  livestock_type_name: string;
  entry_type: EntryType;
  quantity: number;
  tag_number: string;
  breed: string;
  sex: string;
  weight: number | null;
  last_vaccination_date: string | null;
  status: StatusType;
  review_remarks: string | null;
  created_at: string;
}

export default function AllLivestockInventoryPage() {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<LivestockInventoryItem | null>(null);
  const [detailTarget, setDetailTarget] = useState<LivestockInventoryItem | null>(null);
  const [editTarget, setEditTarget] = useState<LivestockInventoryItem | null>(null);

  const mapInventory = (item: InventoryApiItem): LivestockInventoryItem => ({
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

  const { data: livestockTypes = {} } = useQuery<Record<string, number>>({
    queryKey: ["livestockTypes"],
    queryFn: async () => {
      const res = await api.get<LivestockType[]>("livestock/livestock_types/");
      const map: Record<string, number> = {};
      res.data.forEach((t) => { map[t.name] = t.id });
      return map;
    },
  });

  const { data: inventories = [], isLoading } = useQuery<LivestockInventoryItem[]>({
    queryKey: ["inventory"],
    queryFn: async () => {
      const res = await api.get("livestock/inventory/");
      return res.data.map(mapInventory);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/livestock/inventory_delete/${id}/`, { data: { id } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Livestock record deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete livestock record");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: UpdateInventoryPayload) => {
      if (!editTarget) throw new Error("No record selected");
      const response = await api.put(
        `/livestock/inventory_update/${editTarget.id}`,
        payload
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setEditTarget(null);
      toast.success("Livestock entry updated successfully");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to update livestock entry");
    },
  });

  return (
    <>
      <PageHeader
        title="All Livestock Inventory"
        subtitle="Every livestock record across all types."
        variant="farmer"
        maxWidthClass="max-w-6xl"
      />

      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-2 py-1.5">
          <Link href="/livestock-inventory">
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-slate-300"
            >
              <ArrowLeft className="size-4" /> Back to Inventory
            </Button>
          </Link>
        </div>

        <InventoryStats inventories={inventories} isLoading={isLoading} />

        <LivestockRecordList
          items={inventories}
          isLoading={isLoading}
          livestockTypes={livestockTypes}
          onView={(item) => setDetailTarget(item)}
          onEdit={(item) => setEditTarget(item)}
          onDelete={(item) => setDeleteTarget(item)}
        />
      </div>

      <LivestockDetailsDialog
        livestock={detailTarget}
        open={!!detailTarget}
        onOpenChange={() => setDetailTarget(null)}
      />

      <LivestockEditDialog
        key={editTarget?.id ?? "closed"}
        item={editTarget}
        open={!!editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        livestockTypes={livestockTypes}
        isSubmitting={updateMutation.isPending}
        onSubmit={(payload) => updateMutation.mutate(payload)}
      />

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Livestock Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this record? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm">
              <p><strong>{deleteTarget.entryType === "INDIVIDUAL" ? deleteTarget.tagNumber : `${deleteTarget.quantity}x ${deleteTarget.livestockTypeName} (Batch)`}</strong></p>
              <p className="text-slate-500 mt-1">{deleteTarget.livestockTypeName} • {deleteTarget.breed} • {deleteTarget.sex}</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!deleteTarget) return;
                deleteMutation.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
