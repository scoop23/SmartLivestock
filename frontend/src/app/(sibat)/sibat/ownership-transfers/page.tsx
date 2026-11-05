import { OwnershipTransfersQueue } from "@/app/components/ownership-transfers-queue";
import { Suspense } from "react";
import { RefreshCw } from "lucide-react";

export default function SibatOwnershipTransfersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAF9] p-8 flex items-center justify-center">
          <div className="flex items-center gap-2 text-slate-500 text-sm font-bold">
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
            <span>Loading Ownership Transfers...</span>
          </div>
        </div>
      }
    >
      <OwnershipTransfersQueue reviewer="SIBAT" />
    </Suspense>
  );
}
