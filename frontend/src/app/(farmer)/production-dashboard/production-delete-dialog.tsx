"use client";

import { CalendarDays, Egg, Milk, Package, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  PRODUCTION_TYPE_LABELS,
  PRODUCTION_TYPE_UNITS,
  formatRecordDate,
  type ProductionRecordItem,
} from "./production-analytics";

const typeIcons = {
  milk: Milk,
  eggs: Egg,
  wool: Package,
};

interface ProductionDeleteDialogProps {
  record: ProductionRecordItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export default function ProductionDeleteDialog({
  record,
  open,
  onOpenChange,
  onConfirm,
  isDeleting = false,
}: ProductionDeleteDialogProps) {
  if (!record) return null;

  const TypeIcon = typeIcons[record.productionType] ?? Package;
  const unitLabel = PRODUCTION_TYPE_UNITS[record.productionType] ?? record.unit.toLowerCase();

  return (
    <Dialog open={open} onOpenChange={(val) => !isDeleting && onOpenChange(val)}>
      <DialogContent className="sm:max-w-md p-6 gap-5 rounded-2xl">
        <DialogHeader className="flex flex-col sm:flex-row items-start gap-4 space-y-0 text-left">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <Trash2 className="size-5" />
          </div>
          <div className="space-y-1">
            <DialogTitle className="text-lg font-semibold text-slate-900">
              Delete Production Record
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 leading-normal">
              Are you sure you want to delete this {record.productionType} record of{" "}
              <span className="font-semibold text-slate-800">
                {record.quantity.toLocaleString()} {record.unit.toLowerCase()}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Record preview card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-white shadow-xs border border-slate-200">
                <TypeIcon className="size-4 text-emerald-700" />
              </div>
              <span className="font-semibold text-slate-900">
                {PRODUCTION_TYPE_LABELS[record.productionType] ?? record.productionType}
              </span>
            </div>
            <Badge variant="outline" className="bg-white border-slate-200 font-bold text-slate-800">
              {record.quantity.toLocaleString()} {unitLabel}
            </Badge>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-200/60">
            <span>{record.livestockTypeName ?? `Livestock ID #${record.livestockId}`}</span>
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3.5" />
              {formatRecordDate(record.recordDate)}
            </span>
          </div>

          {record.notes ? (
            <p className="text-xs text-slate-600 italic bg-white/70 rounded-md px-2.5 py-1.5 border border-slate-200/50 truncate">
              &quot;{record.notes}&quot;
            </p>
          ) : null}
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={isDeleting}
            onClick={() => onOpenChange(false)}
            className="rounded-xl border-slate-200 hover:bg-slate-100"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isDeleting}
            onClick={onConfirm}
            className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white gap-2 font-medium"
          >
            {isDeleting ? (
              <>
                <Spinner className="size-4" /> Deleting...
              </>
            ) : (
              <>
                <Trash2 className="size-4" /> Delete Record
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
