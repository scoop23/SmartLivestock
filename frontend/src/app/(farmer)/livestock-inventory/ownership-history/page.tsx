"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/app/components/page-header";
import { Card } from "@/components/ui/card";
import api from "@/lib/axios";

type Transfer = {
  id: number; livestock: number; livestock_tag: string; livestock_type_name: string;
  owner_type: string; new_owner: number | null; external_owner_name: string; external_owner_address: string;
  previous_owner_name: string; new_owner_name: string; transfer_certificate_number: string;
  original_certificate_number: string; transfer_date: string; municipality: string; province: string;
  status: string; purchase_price: string | null;
};

export default function OwnershipHistoryPage() {
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["ownership-transfers"],
    queryFn: async () => (await api.get<Transfer[]>("livestock/ownership-transfers/")).data,
  });
  return <>
    <PageHeader title="Livestock Ownership History" subtitle="Transfer certificates for livestock linked to your account." variant="farmer" />
    <main className="mx-auto w-full max-w-5xl space-y-4 p-4 sm:p-6">
      {isLoading ? <p className="text-sm text-slate-500">Loading ownership history…</p> : null}
      {isError ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Ownership history could not be loaded. Please try again.</p> : null}
      {!isLoading && !isError && data.length === 0 ? <Card className="border-dashed p-8 text-center text-sm text-slate-500">No ownership transfer records are available for your account.</Card> : null}
      {data.map((transfer) => <Card key={transfer.id} className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0"><h2 className="break-words font-bold text-slate-900">{transfer.livestock_type_name} {transfer.livestock_tag || `#${transfer.livestock}`}</h2>
            <p className="mt-1 text-sm text-slate-600">{transfer.previous_owner_name} → {transfer.new_owner_name}</p></div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{transfer.status.replaceAll("_", " ")}</span>
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p><span className="text-slate-500">Transfer certificate: </span><strong>{transfer.transfer_certificate_number}</strong></p>
          <p><span className="text-slate-500">Original certificate: </span><strong>{transfer.original_certificate_number}</strong></p>
          <p><span className="text-slate-500">Transfer date: </span><strong>{transfer.transfer_date}</strong></p>
          <p><span className="text-slate-500">Location: </span><strong>{transfer.municipality}, {transfer.province}</strong></p>
        </div>
        <p className="text-xs text-slate-500">A historical record only: current inventory and livestock identity remain tied to the backend’s approved ownership state.</p>
      </Card>)}
    </main>
  </>;
}
