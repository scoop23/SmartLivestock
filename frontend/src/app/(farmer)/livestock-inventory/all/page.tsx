"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Layers, Plus } from "lucide-react";
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
import api from "@/lib/axios";
import { useRouter } from "next/navigation";
import {
  type LivestockInventoryItem,
  useLivestockTypes,
  useUserInventory,
} from "../livestock-inventory";

export default function AllLivestockInventoryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<LivestockInventoryItem | null>(null);
  const [detailTarget, setDetailTarget] = useState<LivestockInventoryItem | null>(null);
  const [editTarget, setEditTarget] = useState<LivestockInventoryItem | null>(null);

  const { data: livestockTypes = {} } = useLivestockTypes();
  const { data: inventories = [], isLoading } = useUserInventory();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/livestock/inventory/${id}/`);
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
      const response = await api.put(`/livestock/inventory/${editTarget.id}/`, payload);
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
        title="All Livestock Registry"
        subtitle="Complete centralized registry of all animal entries across every species."
        variant="farmer"
        maxWidthClass="w-full"
      />

      <div className="p-4 md:p-8 w-full space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/livestock-inventory">
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-slate-300 rounded-xl h-9 px-3.5 font-bold text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            >
              <ArrowLeft className="size-3.5" /> Back to Herd Overview
            </Button>
          </Link>

          <span className="text-xs font-semibold text-slate-500">
            <strong className="text-slate-900 font-bold">{inventories.length}</strong> Registered Animals
          </span>
        </div>

        <LivestockRecordList
          items={inventories}
          isLoading={isLoading}
          livestockTypes={livestockTypes}
          onView={(item) => setDetailTarget(item)}
          onEdit={(item) => setEditTarget(item)}
          onDelete={(item) => setDeleteTarget(item)}
          onAddRecord={() => router.push("/livestock-inventory")}
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
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900">
              Delete Livestock Record
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this record? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm space-y-1">
              <p className="font-bold text-slate-900">
                {deleteTarget.entryType === "INDIVIDUAL"
                  ? deleteTarget.tagNumber || "Un-tagged"
                  : `${deleteTarget.quantity}x ${deleteTarget.livestockTypeName} (Batch)`}
              </p>
              <p className="text-slate-500 text-xs">
                {deleteTarget.livestockTypeName} • {deleteTarget.breed} • {deleteTarget.sex}
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (!deleteTarget) return;
                deleteMutation.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
              className="rounded-xl font-bold"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
