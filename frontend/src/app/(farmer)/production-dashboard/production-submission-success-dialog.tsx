"use client";

import { useRouter } from "next/navigation";
import { Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

interface ProductionSubmissionSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: number | string | null;
}

export default function ProductionSubmissionSuccessDialog({
  open,
  onOpenChange,
  recordId,
}: ProductionSubmissionSuccessDialogProps) {
  const router = useRouter();

  const openSubmittedRecord = () => {
    onOpenChange(false);
    const historyUrl = recordId
      ? `/production-dashboard/history?recordId=${encodeURIComponent(String(recordId))}`
      : "/production-dashboard/history";
    router.push(historyUrl);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl p-6">
        <div className="mx-auto flex size-16 items-center justify-center">
          <div className="relative flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-800">
            <span className="absolute inset-0 animate-ping rounded-full bg-amber-300/40 motion-reduce:animate-none" aria-hidden="true" />
            <Clock3 className="relative size-7 animate-pulse motion-reduce:animate-none" aria-hidden="true" />
          </div>
        </div>
        <div className="space-y-2 text-center">
          <DialogTitle className="text-xl font-bold text-slate-900">
            Your production is now pending for review
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-slate-600">
            Your record was submitted. It will appear in your production history with its current review status.
          </DialogDescription>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            type="button"
            className="min-h-11 rounded-xl bg-emerald-700 font-semibold text-white hover:bg-emerald-800"
            onClick={openSubmittedRecord}
          >
            View Production History
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
