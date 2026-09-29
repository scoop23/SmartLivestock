"use client";

import { Button } from "@/components/ui/button";
import { ShieldCheck, X } from "lucide-react";

interface BulkActionDockProps {
  count: number;
  onValidate: () => void;
  onClear: () => void;
}

export function BulkActionDock({ count, onValidate, onClear }: BulkActionDockProps) {
  if (count === 0) return null;

  return (
    <div className="sm:hidden fixed bottom-4 inset-x-3.5 z-40 animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-gray-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl flex items-center justify-between border border-gray-800">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-xl bg-green-500/20 text-green-400 font-black text-xs flex items-center justify-center font-mono">
            {count}
          </span>
          <span className="text-xs font-bold text-gray-200">
            {count === 1 ? "Record Selected" : "Records Selected"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={onValidate}
            className="bg-[#2D5A27] hover:bg-[#23471f] text-white text-xs font-bold py-2.5 px-3.5 rounded-xl shadow-md gap-1.5"
          >
            <ShieldCheck size={14} />
            <span>Validate ({count})</span>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClear}
            className="h-8 w-8 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800"
          >
            <X size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}