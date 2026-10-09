"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import api from "@/lib/axios";
import { toast } from "sonner";

type Transfer = {
  id: number; livestock: number; livestock_tag: string; livestock_type_name: string;
  previous_owner_name: string; new_owner_name: string; transfer_certificate_number: string;
  original_certificate_number: string; transfer_date: string; status: string;
  municipality: string; province: string; animal_description: string; sex_at_transfer: string;
  age_at_transfer: string; municipality_brand: string; owner_brand: string; purchase_price: string | null;
};

export function OwnershipTransfersQueue({ reviewer }: { reviewer: "SIBAT" | "MAO" }) {
  const client = useQueryClient();
  const [revisionId, setRevisionId] = useState<number | null>(null);
  const [revisionRemarks, setRevisionRemarks] = useState("");
  const { data = [], isLoading } = useQuery({
    queryKey: ["ownership-transfers"],
    queryFn: async () => (await api.get<Transfer[]>("livestock/ownership-transfers/")).data,
  });
  useEffect(() => {
    if (isLoading) return;
    const transferId = new URLSearchParams(window.location.search).get("transferId");
    if (!transferId) return;
    const transfer = data.find((item) => String(item.id) === transferId);
    if (!transfer) return;

    const card = document.getElementById(`ownership-transfer-${transferId}`);
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    card?.classList.add("ring-2", "ring-emerald-500", "ring-offset-2");
    const url = new URL(window.location.href);
    url.searchParams.delete("transferId");
    window.history.replaceState({}, "", url.toString());
  }, [data, isLoading]);
  const review = useMutation({
    mutationFn: async ({ id, status, remarks = "" }: { id: number; status: "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION"; remarks?: string }) =>
      api.post(`livestock/ownership-transfers/${id}/review/`, { status, remarks }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["ownership-transfers"] });
      await client.invalidateQueries({ queryKey: ["inventory"] });
      setRevisionId(null);
      setRevisionRemarks("");
      toast.success("Transfer review saved.");
    },
    onError: () => toast.error("Unable to update the ownership transfer."),
  });

  return <>
    <PageHeader title="Ownership Transfers" subtitle="Review certificate-backed changes to livestock ownership." variant={reviewer === "SIBAT" ? "sibat" : "admin"} />
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      {isLoading ? <p className="rounded-xl border bg-white p-6 text-sm text-slate-500">Loading transfer records…</p> : null}
      {!isLoading && data.length === 0 ? <p className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">No ownership transfers are awaiting review.</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {data.map((transfer) => <article id={`ownership-transfer-${transfer.id}`} key={transfer.id} className="min-w-0 space-y-4 rounded-2xl border bg-white p-5 shadow-sm transition-shadow">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-bold text-slate-900">{transfer.livestock_type_name} {transfer.livestock_tag || `#${transfer.livestock}`}</h2><p className="mt-1 text-sm text-slate-600">{transfer.previous_owner_name} → {transfer.new_owner_name}</p></div><Badge variant="outline">{transfer.status.replaceAll("_", " ")}</Badge></div>
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Transfer certificate</dt><dd className="break-words font-semibold">{transfer.transfer_certificate_number}</dd></div><div><dt className="text-slate-500">Original certificate</dt><dd className="break-words font-semibold">{transfer.original_certificate_number}</dd></div><div><dt className="text-slate-500">Transfer date</dt><dd className="font-semibold">{transfer.transfer_date}</dd></div><div><dt className="text-slate-500">Location</dt><dd className="font-semibold">{transfer.municipality}, {transfer.province}</dd></div><div><dt className="text-slate-500">Animal description</dt><dd className="break-words font-semibold">{transfer.animal_description || "Not recorded"}</dd></div><div><dt className="text-slate-500">Sex / age</dt><dd className="font-semibold">{transfer.sex_at_transfer || "—"} / {transfer.age_at_transfer || "—"}</dd></div><div><dt className="text-slate-500">Municipality / owner brands</dt><dd className="break-words font-semibold">{transfer.municipality_brand || "—"} / {transfer.owner_brand || "—"}</dd></div><div><dt className="text-slate-500">Purchase price</dt><dd className="font-semibold">{transfer.purchase_price ? `₱${Number(transfer.purchase_price).toLocaleString()}` : "Not recorded"}</dd></div></dl>
          {(reviewer === "SIBAT" && transfer.status === "PENDING") || (reviewer === "MAO" && transfer.status === "VERIFIED") ? <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {reviewer === "SIBAT" ? <Button disabled={review.isPending} onClick={() => review.mutate({ id: transfer.id, status: "VERIFIED" })}>Verify certificate</Button> : <Button disabled={review.isPending} onClick={() => review.mutate({ id: transfer.id, status: "APPROVED" })}>Approve transfer</Button>}
              {revisionId !== transfer.id ? <Button variant="outline" disabled={review.isPending} onClick={() => { setRevisionId(transfer.id); setRevisionRemarks(""); }}>Return for revision</Button> : null}
            </div>
            {revisionId === transfer.id ? <div className="space-y-2">
              <label htmlFor={`ownership-transfer-remarks-${transfer.id}`} className="text-sm font-medium text-slate-700">Reason for return</label>
              <Textarea id={`ownership-transfer-remarks-${transfer.id}`} value={revisionRemarks} onChange={(event) => setRevisionRemarks(event.target.value)} rows={3} maxLength={2000} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setRevisionId(null); setRevisionRemarks(""); }}>Cancel</Button>
                <Button variant="destructive" disabled={review.isPending || !revisionRemarks.trim()} onClick={() => review.mutate({ id: transfer.id, status: "SUBJECT_TO_REVISION", remarks: revisionRemarks.trim() })}>Return with reason</Button>
              </div>
            </div> : null}
          </div> : null}
        </article>)}
      </div>
      <p className="text-xs text-slate-500">Final approval updates the existing livestock record’s owner. It does not create a second animal identity.</p>
    </main>
  </>;
}
