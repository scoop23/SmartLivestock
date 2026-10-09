"use client";

import { useMemo, useState } from "react";
import { Search, UserRound } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { FarmerOptionItem, UnifiedSubmissionItem } from "../sibat-analytics";

interface SibatFarmerFinderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmers: FarmerOptionItem[];
  submissions: UnifiedSubmissionItem[];
  onOpenRecord: (item: UnifiedSubmissionItem) => void;
  isLoading?: boolean;
}

export function SibatFarmerFinderDialog({
  open,
  onOpenChange,
  farmers,
  submissions,
  onOpenRecord,
  isLoading = false,
}: SibatFarmerFinderDialogProps) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return farmers.filter((farmer) =>
      !query || `${farmer.farmerName} ${farmer.barangayName} ${farmer.address}`.toLocaleLowerCase().includes(query),
    );
  }, [farmers, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1rem)] max-w-xl flex-col overflow-hidden rounded-2xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Find a farmer</DialogTitle>
          <DialogDescription>
            Search farmers within your assigned review scope. This list is for field assistance; it does not grant access to personal farm inventory.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, barangay, or address"
            className="min-h-11 pl-9"
          />
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {isLoading ? (
            <p role="status" className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Loading farmers in your assigned scopeâ€¦</p>
          ) : filtered.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              {farmers.length ? "No farmers match this search." : "No farmers are available in this review scope."}
            </p>
          ) : filtered.map((farmer) => {
            const farmerSubmissions = submissions
              .filter((item) => item.farmerName.toLocaleLowerCase() === farmer.farmerName.toLocaleLowerCase() && item.barangayName.toLocaleLowerCase() === farmer.barangayName.toLocaleLowerCase())
              .sort((a, b) => new Date(b.createdAt || b.recordDate).getTime() - new Date(a.createdAt || a.recordDate).getTime());
            const nextRecord = farmerSubmissions.find((item) => item.status === "PENDING") || farmerSubmissions[0];
            return (
              <div key={farmer.farmerId} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="rounded-lg bg-slate-100 p-2 text-slate-700"><UserRound className="size-4" /></span>
                  <div className="min-w-0">
                    <p className="break-words text-sm font-bold text-slate-900">{farmer.farmerName}</p>
                    <p className="break-words text-xs text-slate-600">{farmer.barangayName}{farmer.address ? ` Â· ${farmer.address}` : ""}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {farmerSubmissions.length ? `${farmerSubmissions.length} available submitted record${farmerSubmissions.length === 1 ? "" : "s"}` : "No submitted records in the current queues"}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full shrink-0 sm:w-auto"
                  disabled={!nextRecord}
                  onClick={() => {
                    if (!nextRecord) return;
                    onOpenChange(false);
                    onOpenRecord(nextRecord);
                  }}
                >
                  {nextRecord ? nextRecord.status === "PENDING" ? "Check record" : "View latest record" : "No record to open"}
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
