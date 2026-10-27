"use client";

import type { OverviewRecord } from "./data-overview-types";
import { ValidationPagination } from "@/app/(admin)/data-validation/components/validation-pagination";
import { fetchInspections,type InspectionRecord } from "@/app/(auction)/auction-inspections/auction-analytics";
import { Alert,AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableSection } from "@/components/ui/data-table-section";
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useMemo,useState } from "react";
import { DataOverviewCards } from "./data-overview-cards";
import { DataOverviewTable } from "./data-overview-table";
import type { DataTab,SalesRecord } from "./data-overview-types";

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

const RECORDS_PER_PAGE = 10;

function matchesFilter(values: (string | number | null | undefined)[], search: string) {
  const query = search.trim().toLocaleLowerCase();
  return !query || values.some((value) => String(value ?? "").toLocaleLowerCase().includes(query));
}

function statusMatches(status: string, filter: string) {
  return filter === "all" || status === filter;
}

function ReviewStatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.toUpperCase();
  const isApproved = normalizedStatus === "APPROVED";
  const isVerified = normalizedStatus === "VERIFIED";
  const needsRevision = ["REJECTED", "SUBJECT_TO_REVISION", "SUBJECT_FOR_REVISION"].includes(normalizedStatus);
  const label = needsRevision
    ? "Revision Required"
    : isVerified
      ? "SIBAT Verified"
      : isApproved
        ? "MAO Approved"
        : normalizedStatus === "PENDING"
          ? "Awaiting SIBAT"
          : status.replaceAll("_", " ");
  const colorClass = isApproved
    ? "bg-emerald-100 text-emerald-800"
    : isVerified
      ? "border border-sky-200 bg-sky-100 text-sky-800"
      : needsRevision
        ? "border border-rose-200 bg-rose-100 text-rose-800"
        : "border border-amber-200 bg-amber-100 text-amber-800";

  return <Badge className={`border-0 px-2 py-0.5 text-[9px] font-black uppercase ${colorClass}`}>{label}</Badge>;
}

function OperationalStatusBadge({ status }: { status: string }) {
  return <Badge variant="outline">{status.replaceAll("_", " ")}</Badge>;
}

function NoRecordsState({
  recordLabel,
  onResetFilters,
}: {
  recordLabel: string;
  onResetFilters: () => void;
}) {
  return (
    <DataTableSection className="border-0 bg-transparent p-0 shadow-none">
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-2xs">
        <div className="mb-3 inline-block rounded-full border border-slate-100 bg-slate-50 p-4">
          <Search className="size-8 text-slate-300" />
        </div>
        <h4 className="text-base font-bold text-slate-800">No records found</h4>
        <p className="mt-1 max-w-sm text-xs font-medium text-slate-500">
          No {recordLabel} matched your active search query or filter criteria.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onResetFilters}
          className="mt-4 rounded-xl border-slate-300 text-xs font-bold"
        >
          Clear Filters
        </Button>
      </div>
    </DataTableSection>
  );
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
  onSelectSalesRecord: (record: OverviewRecord, domain: DataTab) => void;
  onResetFilters: () => void;
  search: string;
  statusFilter: string;
}) {
  const [activeRecordView, setActiveRecordView] = useState<"sales" | "ownership" | "movement">("sales");
  const filterKey = `${search}\u0000${statusFilter}`;
  const [ownershipPageState, setOwnershipPageState] = useState({ filterKey, page: 1 });
  const [movementPageState, setMovementPageState] = useState({ filterKey, page: 1 });
  const ownershipPage = ownershipPageState.filterKey === filterKey ? ownershipPageState.page : 1;
  const movementPage = movementPageState.filterKey === filterKey ? movementPageState.page : 1;
  const setOwnershipPage = (page: number) => setOwnershipPageState({ filterKey, page });
  const setMovementPage = (page: number) => setMovementPageState({ filterKey, page });
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

  const ownershipTotalPages = Math.max(1, Math.ceil(transfers.length / RECORDS_PER_PAGE));
  const safeOwnershipPage = Math.min(ownershipPage, ownershipTotalPages);
  const paginatedTransfers = useMemo(() => {
    const start = (safeOwnershipPage - 1) * RECORDS_PER_PAGE;
    return transfers.slice(start, start + RECORDS_PER_PAGE);
  }, [transfers, safeOwnershipPage]);

  const movementTotalPages = Math.max(1, Math.ceil(movements.length / RECORDS_PER_PAGE));
  const safeMovementPage = Math.min(movementPage, movementTotalPages);
  const paginatedMovements = useMemo(() => {
    const start = (safeMovementPage - 1) * RECORDS_PER_PAGE;
    return movements.slice(start, start + RECORDS_PER_PAGE);
  }, [movements, safeMovementPage]);

  // The Auction & Trade badge summarizes all record types inside this grouped view.
  const allTradeRecordsCount = salesRecords.length + transfers.length + movements.length;

  const recordViews = [
    { id: "sales", label: "Auction & Trade", count: allTradeRecordsCount },
    { id: "ownership", label: "Live Sales", count: transfers.length },
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

    {activeRecordView === "ownership" ? <div className="space-y-4">
        {transfersQuery.isError ? <Alert variant="destructive"><AlertDescription>Could not load ownership transfer records.</AlertDescription></Alert> : null}
        {transfersQuery.isLoading ? <p className="py-5 text-center text-sm text-muted-foreground">Loading ownership records…</p> : null}
        {!transfersQuery.isLoading && !transfersQuery.isError && transfers.length === 0 ? <NoRecordsState recordLabel="ownership transfers" onResetFilters={onResetFilters} /> : null}
        {!transfersQuery.isLoading && !transfersQuery.isError && transfers.length > 0 ? <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
          <Table className="min-w-[850px]">
          <TableHeader>
            <TableRow className="border-b border-slate-200/80 bg-slate-50/80 hover:bg-slate-50/80">
              <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">Animal</TableHead>
              <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">Seller → Buyer</TableHead>
              <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">Transfer Certificate</TableHead>
              <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">Date</TableHead>
              <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">Agreed Price</TableHead>
              <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">Review</TableHead>
              <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">Animal Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100">
            {paginatedTransfers.map((record) => <TableRow key={record.id} className="hover:bg-slate-50/90 transition-colors">
              <TableCell className="px-3.5 py-2.5"><span className="font-bold text-slate-800 text-xs">{record.livestock_type_name}</span><span className="block font-mono text-xs text-slate-500">{record.livestock_tag || `Record #${record.livestock}`}</span></TableCell>
              <TableCell className="px-3.5 py-2.5 text-xs font-semibold text-slate-700"><span>{record.previous_owner_name}</span><span className="block text-xs text-slate-500">→ {record.new_owner_name}</span></TableCell>
              <TableCell className="px-3.5 py-2.5"><span className="text-xs font-bold text-slate-800">{record.transfer_certificate_number}</span><span className="block text-xs text-slate-500">Original: {record.original_certificate_number || "Not recorded"}</span></TableCell>
              <TableCell className="px-3.5 py-2.5 text-xs font-semibold text-slate-700">{record.transfer_date}</TableCell>
              <TableCell className="px-3.5 py-2.5 text-xs font-semibold text-slate-700">{record.purchase_price ? `₱${Number(record.purchase_price).toLocaleString()}` : "—"}</TableCell>
              <TableCell className="px-3.5 py-2.5"><ReviewStatusBadge status={record.status} /></TableCell>
              <TableCell className="px-3.5 py-2.5"><OperationalStatusBadge status={record.livestock_operational_status} /></TableCell>
            </TableRow>)}
          </TableBody>
          </Table>
          </div>
          {transfers.length > RECORDS_PER_PAGE ? <ValidationPagination
            currentPage={safeOwnershipPage}
            totalPages={ownershipTotalPages}
            totalItems={transfers.length}
            pageSize={RECORDS_PER_PAGE}
            onPageChange={setOwnershipPage}
            pageSizeOptions={[RECORDS_PER_PAGE]}
          /> : null}
        </div> : null}
    </div> : null}

    {activeRecordView === "movement" ? <div className="space-y-4">
        {movementsQuery.isError ? <Alert variant="destructive"><AlertDescription>Could not load livestock movement logs.</AlertDescription></Alert> : null}
        {movementsQuery.isLoading ? <p className="py-5 text-center text-sm text-muted-foreground">Loading movement logs…</p> : null}
        {!movementsQuery.isLoading && !movementsQuery.isError && movements.length === 0 ? <NoRecordsState recordLabel="movement logs" onResetFilters={onResetFilters} /> : null}
        {!movementsQuery.isLoading && !movementsQuery.isError && movements.length > 0 ? <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
          <Table className="min-w-[850px]">
          <TableHeader>
            <TableRow className="border-b border-slate-200/80 bg-slate-50/80 hover:bg-slate-50/80">
              <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">Control Number</TableHead>
              <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">Shipper</TableHead>
              <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">Route</TableHead>
              <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">Purpose / Heads</TableHead>
              <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">Inspection Date</TableHead>
              <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">Review</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100">
            {paginatedMovements.map((record: InspectionRecord) => <TableRow key={record.id} className="hover:bg-slate-50/90 transition-colors">
              <TableCell className="px-3.5 py-2.5 font-mono text-xs font-bold text-slate-900">{record.control_number || `INS-${record.id}`}</TableCell>
              <TableCell className="px-3.5 py-2.5 text-xs font-bold text-slate-800">{record.shipper_name || "Not recorded"}</TableCell>
              <TableCell className="px-3.5 py-2.5 text-xs font-semibold text-slate-700"><span>{record.origin || "Origin not recorded"}</span><span className="block text-xs text-slate-500">→ {record.destination || "Destination not recorded"}</span></TableCell>
              <TableCell className="px-3.5 py-2.5 text-xs font-semibold text-slate-700"><span>{record.purpose.replaceAll("_", " ")}</span><span className="block text-xs text-slate-500">{record.items.reduce((sum, item) => sum + item.quantity, 0)} head</span></TableCell>
              <TableCell className="px-3.5 py-2.5 text-xs font-semibold text-slate-700">{record.inspection_date}</TableCell>
              <TableCell className="px-3.5 py-2.5"><ReviewStatusBadge status={record.status} /></TableCell>
            </TableRow>)}
          </TableBody>
          </Table>
          </div>
          {movements.length > RECORDS_PER_PAGE ? <ValidationPagination
            currentPage={safeMovementPage}
            totalPages={movementTotalPages}
            totalItems={movements.length}
            pageSize={RECORDS_PER_PAGE}
            onPageChange={setMovementPage}
            pageSizeOptions={[RECORDS_PER_PAGE]}
          /> : null}
        </div> : null}
    </div> : null}
  </section>;
}
