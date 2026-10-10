"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Archive, Search } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import api from "@/lib/axios";

type Transfer = {
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

const statusOptions = ["ALL", "PENDING", "VERIFIED", "APPROVED", "SUBJECT_TO_REVISION"] as const;

// MAO and Admin can browse all transfer events; this page is read-only and leaves approvals in the review queue.
export default function OwnershipTransferRegistryPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof statusOptions)[number]>("ALL");
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["ownership-transfer-registry"],
    queryFn: async () => (await api.get<Transfer[]>("livestock/ownership-transfers/")).data,
  });

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return data.filter((transfer) => {
      if (statusFilter !== "ALL" && transfer.status !== statusFilter) return false;
      if (!query) return true;
      return [
        transfer.transfer_certificate_number,
        transfer.original_certificate_number,
        transfer.livestock_tag,
        transfer.livestock_type_name,
        transfer.previous_owner_name,
        transfer.new_owner_name,
        transfer.municipality,
        transfer.province,
      ].some((value) => value?.toLocaleLowerCase().includes(query));
    });
  }, [data, search, statusFilter]);

  const approvedCount = data.filter((transfer) => transfer.status === "APPROVED").length;
  const soldCount = data.filter((transfer) => transfer.livestock_operational_status === "SOLD").length;
  const pendingCount = data.filter((transfer) => transfer.status === "PENDING" || transfer.status === "VERIFIED").length;

  return <>
    <PageHeader title="Ownership Transfer Registry" subtitle="Browse all Auction-recorded transfer certificates and the livestock linked to each record." variant="admin" />
    <main className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">All transfer records</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{data.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Awaiting review</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{pendingCount}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Approved / sold animals</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{approvedCount} / {soldCount}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row">
          <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search seller, buyer, tag, or certificate number" className="pl-9" /></div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as (typeof statusOptions)[number])}>
            <SelectTrigger className="sm:w-56"><SelectValue placeholder="Filter by status" /></SelectTrigger>
            <SelectContent>{statusOptions.map((status) => <SelectItem key={status} value={status}>{status === "ALL" ? "All statuses" : status.replaceAll("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isError ? <Alert variant="destructive"><AlertDescription>Could not load transfer records. Your account may not have registry access.</AlertDescription></Alert> : null}
      {isLoading ? <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Loading transfer registry…</CardContent></Card> : null}
      {!isLoading && !isError && filtered.length === 0 ? <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-center"><Archive className="size-8 text-muted-foreground" /><p className="font-medium">No transfer records found</p><p className="text-sm text-muted-foreground">Try changing the search or status filter.</p></CardContent></Card> : null}

      {!isLoading && !isError && filtered.length > 0 ? <Card>
        <CardContent className="pt-5">
          <Table>
            <TableHeader><TableRow><TableHead>Animal</TableHead><TableHead>Seller → Buyer</TableHead><TableHead>Certificates</TableHead><TableHead>Date / location</TableHead><TableHead>Price</TableHead><TableHead>Transfer</TableHead><TableHead>Animal state</TableHead></TableRow></TableHeader>
            <TableBody>{filtered.map((transfer) => <TableRow key={transfer.id}>
              <TableCell><p className="font-medium">{transfer.livestock_type_name}</p><p className="text-xs text-muted-foreground">{transfer.livestock_tag || `Record #${transfer.livestock}`}</p></TableCell>
              <TableCell><p className="font-medium">{transfer.previous_owner_name}</p><p className="text-xs text-muted-foreground">→ {transfer.new_owner_name}</p></TableCell>
              <TableCell><p className="font-medium">Transfer: {transfer.transfer_certificate_number}</p><p className="text-xs text-muted-foreground">Ownership: {transfer.original_certificate_number}</p></TableCell>
              <TableCell><p>{transfer.transfer_date}</p><p className="text-xs text-muted-foreground">{transfer.municipality}, {transfer.province}</p></TableCell>
              <TableCell>{transfer.purchase_price ? `₱${Number(transfer.purchase_price).toLocaleString()}` : "—"}</TableCell>
              <TableCell><Badge variant="outline">{transfer.status.replaceAll("_", " ")}</Badge></TableCell>
              <TableCell><Badge variant={transfer.livestock_operational_status === "SOLD" ? "secondary" : "outline"}>{transfer.livestock_operational_status.replaceAll("_", " ")}</Badge></TableCell>
            </TableRow>)}</TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">Showing {filtered.length} of {data.length} records. Approved transfers preserve the seller’s original livestock row as SOLD.</p>
        </CardContent>
      </Card> : null}
    </main>
  </>;
}
