"use client";

import { useState } from "react";
import { CalendarDays, Check, Search, Syringe, Weight, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";
import type { LivestockInventoryItem } from "../livestock-inventory/page";
import { cowHead } from "@lucide/lab";
import { Icon } from 'lucide-react';

interface SelectLivestockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: LivestockInventoryItem[];
  selectedId: string | null;
  onSelect: (item: LivestockInventoryItem) => void;
}

const formatDate = (date: string | null | undefined) => {
  if (!date) return "Unknown date";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (match) {
    const [, y, m, d] = match;
    const month = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "short" });
    return `${month} ${Number(d)}, ${y}`;
  }
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const typeColors: Record<string, string> = {
  Cattle: "bg-emerald-100 text-emerald-700",
  Goat: "bg-amber-100 text-amber-700",
  Swine: "bg-sky-100 text-sky-700",
};

export default function SelectLivestockDialog({
  open,
  onOpenChange,
  items,
  selectedId,
  onSelect,
}: SelectLivestockDialogProps) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter((item) =>
      [item.tagNumber, item.livestockTypeName, item.breed, item.sex, item.id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    )
    : items;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[92vh] flex flex-col p-2 gap-0 overflow-hidden rounded-2xl ">
        <DialogHeader className="p-5 pb-3 border-b border-slate-100 flex-shrink-0">
          <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <div className="p-2.5 rounded-lg bg-[#2D5A27]/10 text-[#2D5A27]">
              <Icon iconNode={cowHead} className="size-5" />
            </div>
            Select Livestock
          </DialogTitle>
          <DialogDescription className="text-base text-slate-500 mt-1.5">
            Choose the batch or animal to link to this production record.
          </DialogDescription>
        </DialogHeader>

        {items.length > 0 && (
          <div className="px-5 pt-3 pb-2 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by tag, batch, breed..."
                className="pl-10 pr-9 h-11 text-base bg-slate-50"
                autoComplete="off"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Showing {filtered.length} of {items.length} approved inventory
              {filtered.length !== items.length ? ` matching "${query.trim()}"` : ""}
            </p>
          </div>
        )}

        <div className="flex-1 justify-center p-4 min-h-0">
          {items.length === 0 ? (
            <p className="text-base text-slate-500 text-center py-12 px-6">
              No approved livestock inventory found. Add livestock in the Livestock Inventory page first.
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-base text-slate-500 text-center py-12 px-6">
              No inventory matches your search.
            </p>
          ) : (
            <ScrollArea className="h-full w-full">
              <div className="flex flex-col divide-y divide-slate-100">
                {filtered.map((item) => {
                  const selected = selectedId === item.id;
                  const color = typeColors[item.livestockTypeName] ?? "bg-slate-100 text-slate-600";
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelect(item);
                        onOpenChange(false);
                      }}
                      className={cn(
                        " text-left px-5 py-4 flex items-center justify-between gap-4 transition-colors rounded-2xl",
                        selected ? "bg-emerald-200" : "hover:bg-slate-50",
                      )}
                    >
                      <div className="min-w-0 flex items-center gap-3.5">
                        <div className={cn("shrink-0 flex items-center justify-center size-11 rounded-xl", color)}>
                          <Icon iconNode={cowHead} className="size-6" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-base font-bold text-slate-900 truncate">
                              {item.entryType === "INDIVIDUAL"
                                ? item.tagNumber || "Un-tagged"
                                : `Batch #${item.id} (${item.quantity} heads)`}
                            </p>
                            <span className={cn(
                              "shrink-0 text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border",
                              item.entryType === "BATCH"
                                ? "bg-sky-50 text-sky-700 border-sky-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200",
                            )}>
                              {item.entryType === "BATCH" ? "Batch" : "Individual"}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 mt-1 truncate">
                            {item.livestockTypeName} • {item.breed || "Standard Breed"} • {item.sex}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                              <CalendarDays className="w-4 h-4 text-slate-400" />
                              Added {formatDate(item.createdAt)}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                              <Syringe className="w-4 h-4 text-slate-400" />
                              {item.lastVaccinationDate
                                ? `Vax ${formatDate(item.lastVaccinationDate)}`
                                : "No vax record"}
                            </span>
                            {item.weight != null && (
                              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                                <Weight className="w-4 h-4 text-slate-400" />
                                {item.weight} kg
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        {selected && (
                          <span className="inline-flex items-center gap-1 text-sm font-bold text-[#2D5A27]">
                            <Check className="w-5 h-5" /> Selected
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
