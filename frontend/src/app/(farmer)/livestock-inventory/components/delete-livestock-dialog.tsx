"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { LivestockInventoryItem } from "../livestock-inventory";

interface DeleteLivestockDialogProps {
  target: LivestockInventoryItem | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

export function DeleteLivestockDialog({
  target,
  onOpenChange,
  onConfirm,
  isDeleting,
}: DeleteLivestockDialogProps) {
  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black text-slate-900">
            Delete Livestock Record
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to remove this record from your registry? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>

        {target && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm space-y-1">
            <p className="font-bold text-slate-900">
              {target.entryType === "INDIVIDUAL"
                ? target.tagNumber || "Un-tagged"
                : `${target.quantity}x ${target.livestockTypeName} (Batch)`}
            </p>
            <p className="text-slate-500 text-xs">
              {target.livestockTypeName} • {target.breed} • {target.sex}
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isDeleting}
            onClick={onConfirm}
            className="rounded-xl font-bold cursor-pointer"
          >
            {isDeleting ? "Deleting..." : "Delete Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
