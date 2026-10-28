"use client";

import { Button } from "@/components/ui/button";
import {
Dialog,
DialogContent,
DialogDescription,
DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";

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
          <div className="relative flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="relative size-7" aria-hidden="true" />
          </div>
        </div>
        <div className="space-y-2 text-center">
          <DialogTitle className="text-xl font-bold text-slate-900">
            Saved to your farm log
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-slate-600">
            Your production entry is in your history. A meat-yield log stays a farmer record; an official slaughter report is created only when you explicitly choose that separate review option.
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
