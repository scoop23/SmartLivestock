"use client";

import { PageHeader } from "@/app/components/page-header";
import { Alert,AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card,CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from "@/components/ui/table";
import api from "@/lib/axios";
import { useQuery } from "@tanstack/react-query";
import { Archive,Search } from "lucide-react";
import Link from "next/link";
import { useMemo,useState } from "react";
import { OwnershipTransferKpis } from "../ownership-transfer-kpis";

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

// This read-only registry uses the Auction-scoped endpoint, so it lists this officer's submissions.
export default function AuctionOwnershipTransferRegistryPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof statusOptions)[number]>("ALL");
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["auction-ownership-transfer-registry"],
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

  return <>
    <PageHeader
      title="Ownership Transfer Records"
      subtitle="Review the transfer certificates entered by your Auction account and their MAO review status."
      variant="auction"
      maxWidthClass="w-full"
      action={<Button asChild variant="secondary"><Link href="/auction-ownership-transfers">Record a transfer</Link></Button>}
    />
    <div className="w-full space-y-6 px-4 sm:px-6 lg:px-8 py-6">
      <OwnershipTransferKpis records={data} isLoading={isLoading} />

      <Card className="rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-xs shadow-holo-card"><CardContent className="flex flex-col gap-3 pt-5 sm:flex-row">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search seller, buyer, tag, or certificate number" className="pl-9" /></div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as (typeof statusOptions)[number])}>
          <SelectTrigger className="sm:w-56"><SelectValue placeholder="Filter by status" /></SelectTrigger>
          <SelectContent>{statusOptions.map((status) => <SelectItem key={status} value={status}>{status === "ALL" ? "All statuses" : status.replaceAll("_", " ")}</SelectItem>)}</SelectContent>
        </Select>
      </CardContent></Card>

      {isError ? <Alert variant="destructive"><AlertDescription>Could not load your transfer records. Refresh or contact an administrator if access is unexpected.</AlertDescription></Alert> : null}
      {isLoading ? <Card className="rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-xs shadow-holo-card"><CardContent className="py-10 text-center text-sm text-muted-foreground">Loading transfer records…</CardContent></Card> : null}
      {!isLoading && !isError && filtered.length === 0 ? <Card className="rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-xs shadow-holo-card"><CardContent className="flex flex-col items-center gap-2 py-12 text-center"><Archive className="size-8 text-muted-foreground" /><p className="font-medium">No transfer records found</p><p className="text-sm text-muted-foreground">Try changing the search or status filter.</p></CardContent></Card> : null}

      {!isLoading && !isError && filtered.length > 0 ? <Card className="rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-xs shadow-holo-card overflow-hidden"><CardContent className="overflow-x-auto pt-5">
        <Table>
          <TableHeader><TableRow><TableHead>Animal</TableHead><TableHead>Seller → Buyer</TableHead><TableHead>Certificates</TableHead><TableHead>Date / location</TableHead><TableHead>Price</TableHead><TableHead>Transfer status</TableHead><TableHead>Animal state</TableHead></TableRow></TableHeader>
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
        <p className="mt-3 text-xs text-muted-foreground">Showing {filtered.length} of {data.length} records. MAO approval marks the seller’s original livestock row as SOLD.</p>
      </CardContent></Card> : null}
    </div>
  </>;
}
