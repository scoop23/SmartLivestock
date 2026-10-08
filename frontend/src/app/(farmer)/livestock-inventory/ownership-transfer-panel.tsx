"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import api from "@/lib/axios";
import { toast } from "sonner";

type Transfer = {
  id: number; livestock: number; livestock_tag: string; livestock_type_name: string;
  previous_owner_name: string; new_owner_name: string; transfer_certificate_number: string;
  original_certificate_number: string; transfer_date: string; municipality: string; province: string;
  animal_description: string; sex_at_transfer: string; age_at_transfer: string;
  municipality_brand: string; owner_brand: string; purchase_price: string | null;
  status: string; review_remarks: string;
};

export function OwnershipTransferPanel({
  livestockId,
  eligible,
  open: controlledOpen,
  onOpenChange,
}: {
  livestockId: number;
  eligible: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const client = useQueryClient();
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = onOpenChange ?? setLocalOpen;
  const [editing, setEditing] = useState<Transfer | null>(null);
  // QR resolves the canonical livestock row; ownership history stays in backend records and can change without changing that identity.
  const { data = [], isLoading } = useQuery({
    queryKey: ["ownership-transfers", livestockId],
    queryFn: async () => (await api.get<Transfer[]>("livestock/ownership-transfers/")).data.filter((row) => row.livestock === livestockId),
  });
  const submit = useMutation({
    mutationFn: async ({ form, transferId }: { form: HTMLFormElement; transferId?: number }) => {
      const values = new FormData(form);
      const payload = Object.fromEntries(values.entries());
      if (!payload.purchase_price) delete payload.purchase_price;
      return transferId
        ? api.patch(`livestock/ownership-transfers/${transferId}/`, payload)
        : api.post("livestock/ownership-transfers/", { ...payload, livestock: livestockId });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["ownership-transfers"] });
      toast.success("Transfer request submitted for SIBAT and MAO review.");
      setEditing(null);
      setOpen(false);
    },
    onError: () => toast.error("Transfer request could not be submitted. Check the certificate and registered farmer details."),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit.mutate({ form: event.currentTarget, transferId: editing?.id });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h3 className="font-bold text-slate-900">Ownership History</h3>
          <p className="text-sm text-slate-600">Certificate-backed ownership events stay attached to this same animal identity.</p></div>
        {eligible ? <Button onClick={() => setOpen(true)}>Record Ownership Transfer</Button> : null}
      </div>
      {!eligible ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">A transfer can be recorded for an approved, active individual animal.</p> : null}
      {isLoading ? <p className="text-sm text-slate-500">Loading ownership history…</p> : null}
      {!isLoading && data.length === 0 ? <p className="rounded-xl border border-dashed p-5 text-sm text-slate-500">No ownership transfers are recorded for this animal.</p> : null}
      <ol className="space-y-3">
        {data.map((transfer) => <li key={transfer.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-900">{transfer.previous_owner_name} → {transfer.new_owner_name}</p><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{transfer.status.replaceAll("_", " ")}</span></div>
          <p className="mt-2 text-sm text-slate-600">Transfer date: {transfer.transfer_date} · Certificate: {transfer.transfer_certificate_number}</p>
          <p className="text-sm text-slate-600">Original certificate: {transfer.original_certificate_number} · {transfer.municipality}, {transfer.province}</p>
          {transfer.animal_description ? <p className="text-sm text-slate-600">Animal: {transfer.animal_description} · {transfer.sex_at_transfer || "Sex not recorded"} · {transfer.age_at_transfer || "Age not recorded"}</p> : null}
          {(transfer.municipality_brand || transfer.owner_brand) ? <p className="text-sm text-slate-600">Brands: {transfer.municipality_brand || "—"} / {transfer.owner_brand || "—"}</p> : null}
          {transfer.purchase_price ? <p className="text-sm text-slate-600">Recorded purchase price: ₱{Number(transfer.purchase_price).toLocaleString()}</p> : null}
          {transfer.review_remarks ? <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Review note: {transfer.review_remarks}</p> : null}
          {transfer.status === "SUBJECT_TO_REVISION" ? <Button variant="outline" className="mt-3" onClick={() => { setEditing(transfer); setOpen(true); }}>Correct and resubmit</Button> : null}
        </li>)}
      </ol>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>{editing ? "Correct Ownership Transfer" : "Record Ownership Transfer"}</DialogTitle><DialogDescription>The same animal record stays in place. Current ownership changes only after SIBAT verification and MAO approval.</DialogDescription></DialogHeader>
          <form key={editing?.id || "new-transfer"} id="ownership-transfer-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="new_owner_identifier">New owner’s exact account username or RSBSA number</Label><Input id="new_owner_identifier" name="new_owner_identifier" required autoComplete="off" /><p className="text-xs text-slate-500">Exact match only; the app does not expose a public farmer directory.</p></div>
            <div className="space-y-2"><Label htmlFor="transfer_certificate_number">Transfer certificate number</Label><Input id="transfer_certificate_number" name="transfer_certificate_number" required defaultValue={editing?.transfer_certificate_number} /></div>
            <div className="space-y-2"><Label htmlFor="original_certificate_number">Original ownership certificate number</Label><Input id="original_certificate_number" name="original_certificate_number" required defaultValue={editing?.original_certificate_number} /></div>
            <div className="space-y-2"><Label htmlFor="transfer_date">Transfer date</Label><Input id="transfer_date" name="transfer_date" type="date" required defaultValue={editing?.transfer_date} /></div>
            <div className="space-y-2"><Label htmlFor="municipality">Municipality / city</Label><Input id="municipality" name="municipality" required defaultValue={editing?.municipality} /></div>
            <div className="space-y-2"><Label htmlFor="province">Province</Label><Input id="province" name="province" required defaultValue={editing?.province} /></div>
            <div className="space-y-2"><Label htmlFor="sex_at_transfer">Sex (optional)</Label><Input id="sex_at_transfer" name="sex_at_transfer" defaultValue={editing?.sex_at_transfer} /></div>
            <div className="space-y-2"><Label htmlFor="age_at_transfer">Age (optional)</Label><Input id="age_at_transfer" name="age_at_transfer" defaultValue={editing?.age_at_transfer} /></div>
            <div className="space-y-2"><Label htmlFor="municipality_brand">Municipality brand (optional)</Label><Input id="municipality_brand" name="municipality_brand" defaultValue={editing?.municipality_brand} /></div>
            <div className="space-y-2"><Label htmlFor="owner_brand">Owner brand (optional)</Label><Input id="owner_brand" name="owner_brand" defaultValue={editing?.owner_brand} /></div>
            <div className="space-y-2"><Label htmlFor="purchase_price">Purchase price (optional)</Label><Input id="purchase_price" name="purchase_price" type="number" min="0" step="0.01" defaultValue={editing?.purchase_price || ""} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="animal_description">Animal description (optional)</Label><Input id="animal_description" name="animal_description" defaultValue={editing?.animal_description} /></div>
          </form>
          <DialogFooter><Button type="button" variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Cancel</Button><Button type="submit" form="ownership-transfer-form" disabled={submit.isPending}>{submit.isPending ? "Submitting…" : "Submit for review"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
