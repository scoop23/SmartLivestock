"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Archive, ArrowRightLeft, Truck } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { fetchInspections, type InspectionRecord } from "@/app/(auction)/auction-inspections/auction-analytics";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import api from "@/lib/axios";
import { DataOverviewCards } from "./data-overview-cards";
import { DataOverviewTable } from "./data-overview-table";
import type { DataTab, SalesRecord } from "./data-overview-types";

type OwnershipTransfer = {
  id: number;
  livestock: number;
  livestock_tag: string;
  livestock_type_name: string;
  livestock_operational_status: string;
  previous_owner_name: string;
  new_owner_name: string;
  transfer_certificate_number: string;
  original_certificate_number: string;
  transfer_date: string;
  purchase_price: string | null;
  status: string;
  municipality: string;
  province: string;
};

function matchesFilter(values: (string | number | null | undefined)[], search: string) {
  const query = search.trim().toLocaleLowerCase();
  return !query || values.some((value) => String(value ?? "").toLocaleLowerCase().includes(query));
}

function statusMatches(status: string, filter: string) {
  return filter === "all" || status === filter;
}

function StatusBadge({ status }: { status: string }) {
  return <Badge variant="outline">{status.replaceAll("_", " ")}</Badge>;
}

// These official records are shown alongside trade records, but fetched from their own APIs.
// That keeps ownership changes and movement clearances distinct from ordinary sales entries.
export function ProductionTradeRecords({
  salesRecords,
  viewMode,
  onSelectSalesRecord,
  onResetFilters,
  search,
  statusFilter,
}: {
  salesRecords: SalesRecord[];
  viewMode: "table" | "cards";
  onSelectSalesRecord: (record: any, domain: DataTab) => void;
  onResetFilters: () => void;
  search: string;
  statusFilter: string;
}) {
  const [activeRecordView, setActiveRecordView] = useState<"sales" | "ownership" | "movement">("sales");
  const { user } = useAuth();
  const queryScope = [user?.email, user?.accessScope, user?.assignedBarangayId];
  const transfersQuery = useQuery({
    queryKey: ["admin", "data-overview", "ownership-transfers", ...queryScope],
    queryFn: async () => (await api.get<OwnershipTransfer[]>("livestock/ownership-transfers/")).data,
  });
  const movementsQuery = useQuery({
    queryKey: ["admin", "data-overview", "movement-logs", ...queryScope],
    queryFn: () => fetchInspections(),
  });

  const transfers = useMemo(() => (transfersQuery.data ?? []).filter((record) =>
    statusMatches(record.status, statusFilter) && matchesFilter([
      record.transfer_certificate_number,
      record.original_certificate_number,
      record.livestock_tag,
      record.livestock_type_name,
      record.previous_owner_name,
      record.new_owner_name,
      record.municipality,
      record.province,
    ], search)
  ), [transfersQuery.data, search, statusFilter]);

  const movements = useMemo(() => (movementsQuery.data ?? []).filter((record) =>
    statusMatches(record.status, statusFilter) && matchesFilter([
      record.control_number,
      record.shipper_name,
      record.shipper_address,
      record.origin,
      record.destination,
      record.purpose,
      ...record.items.flatMap((item) => [item.livestock_type_name, item.classification, item.remarks, item.quantity]),
    ], search)
  ), [movementsQuery.data, search, statusFilter]);

  const recordViews = [
    { id: "sales", label: "Auction & Trade", count: salesRecords.length },
    { id: "ownership", label: "Ownership Transfers", count: transfers.length },
    { id: "movement", label: "Movement Logs", count: movements.length },
  ] as const;

  return <section className="space-y-4" aria-label="Auction and trade records">
    <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2" role="tablist" aria-label="Auction and trade record types">
      {recordViews.map((view) => <button
        key={view.id}
        type="button"
        role="tab"
        aria-selected={activeRecordView === view.id}
        onClick={() => setActiveRecordView(view.id)}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${activeRecordView === view.id ? "border-[#184860] bg-[#184860] text-white" : "border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
      >{view.label}<span className={`rounded-full px-2 py-0.5 text-xs ${activeRecordView === view.id ? "bg-white/20" : "bg-slate-100"}`}>{view.count}</span></button>)}
    </div>

    {activeRecordView === "sales" ? viewMode === "table" ? <DataOverviewTable activeTab="sales" items={salesRecords} onSelectRecord={onSelectSalesRecord} onResetFilters={onResetFilters} /> : <DataOverviewCards activeTab="sales" items={salesRecords} onSelectRecord={onSelectSalesRecord} /> : null}

    {activeRecordView === "ownership" ? <Card>
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><ArrowRightLeft className="size-4 text-indigo-700" />Ownership Transfer Records</CardTitle></CardHeader>
      <CardContent>
        {transfersQuery.isError ? <Alert variant="destructive"><AlertDescription>Could not load ownership transfer records.</AlertDescription></Alert> : null}
        {transfersQuery.isLoading ? <p className="py-5 text-center text-sm text-muted-foreground">Loading ownership records…</p> : null}
        {!transfersQuery.isLoading && !transfersQuery.isError && transfers.length === 0 ? <div className="flex flex-col items-center gap-2 py-7 text-center"><Archive className="size-6 text-muted-foreground" /><p className="text-sm font-medium">No ownership records match these filters.</p></div> : null}
        {!transfersQuery.isLoading && !transfersQuery.isError && transfers.length > 0 ? <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Animal</th><th className="px-3 py-2">Seller → Buyer</th><th className="px-3 py-2">Transfer certificate</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Agreed price</th><th className="px-3 py-2">Review</th><th className="px-3 py-2">Animal status</th></tr></thead>
            <tbody className="divide-y">{transfers.map((record) => <tr key={record.id}>
              <td className="px-3 py-3"><span className="font-semibold">{record.livestock_type_name}</span><span className="block text-xs text-muted-foreground">{record.livestock_tag || `Record #${record.livestock}`}</span></td>
              <td className="px-3 py-3"><span>{record.previous_owner_name}</span><span className="block text-xs text-muted-foreground">→ {record.new_owner_name}</span></td>
              <td className="px-3 py-3"><span className="font-medium">{record.transfer_certificate_number}</span><span className="block text-xs text-muted-foreground">Original: {record.original_certificate_number || "Not recorded"}</span></td>
              <td className="px-3 py-3">{record.transfer_date}</td>
              <td className="px-3 py-3">{record.purchase_price ? `₱${Number(record.purchase_price).toLocaleString()}` : "—"}</td>
              <td className="px-3 py-3"><StatusBadge status={record.status} /></td>
              <td className="px-3 py-3"><StatusBadge status={record.livestock_operational_status} /></td>
            </tr>)}</tbody>
          </table>
        </div> : null}
      </CardContent>
    </Card> : null}

    {activeRecordView === "movement" ? <Card>
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Truck className="size-4 text-sky-700" />Livestock Movement Logs</CardTitle></CardHeader>
      <CardContent>
        {movementsQuery.isError ? <Alert variant="destructive"><AlertDescription>Could not load livestock movement logs.</AlertDescription></Alert> : null}
        {movementsQuery.isLoading ? <p className="py-5 text-center text-sm text-muted-foreground">Loading movement logs…</p> : null}
        {!movementsQuery.isLoading && !movementsQuery.isError && movements.length === 0 ? <div className="flex flex-col items-center gap-2 py-7 text-center"><Archive className="size-6 text-muted-foreground" /><p className="text-sm font-medium">No movement logs match these filters.</p></div> : null}
        {!movementsQuery.isLoading && !movementsQuery.isError && movements.length > 0 ? <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Control number</th><th className="px-3 py-2">Shipper</th><th className="px-3 py-2">Route</th><th className="px-3 py-2">Purpose / heads</th><th className="px-3 py-2">Inspection date</th><th className="px-3 py-2">Review</th></tr></thead>
            <tbody className="divide-y">{movements.map((record: InspectionRecord) => <tr key={record.id}>
              <td className="px-3 py-3 font-medium">{record.control_number || `INS-${record.id}`}</td>
              <td className="px-3 py-3">{record.shipper_name || "Not recorded"}</td>
              <td className="px-3 py-3"><span>{record.origin || "Origin not recorded"}</span><span className="block text-xs text-muted-foreground">→ {record.destination || "Destination not recorded"}</span></td>
              <td className="px-3 py-3"><span>{record.purpose.replaceAll("_", " ")}</span><span className="block text-xs text-muted-foreground">{record.items.reduce((sum, item) => sum + item.quantity, 0)} head</span></td>
              <td className="px-3 py-3">{record.inspection_date}</td>
              <td className="px-3 py-3"><StatusBadge status={record.status} /></td>
            </tr>)}</tbody>
          </table>
        </div> : null}
      </CardContent>
    </Card> : null}
  </section>;
}
