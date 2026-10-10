"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Search } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import api from "@/lib/axios";
import { toast } from "sonner";
import { lookupRegisteredLivestock, type RegisteredLivestockLookup } from "../auction-inspections/auction-analytics";

type OwnerType = "REGISTERED_FARMER" | "EXTERNAL_INDIVIDUAL" | "COMPANY" | "TRADER" | "OTHER";
type Transfer = {
  id: number;
  livestock: number;
  livestock_tag: string;
  livestock_type_name: string;
  previous_owner_name: string;
  new_owner_name: string;
  transfer_certificate_number: string;
  transfer_date: string;
  purchase_price: string | null;
  status: string;
  owner_type: OwnerType;
  external_owner_name: string;
  external_owner_address: string;
  original_certificate_number: string;
  municipality: string;
  province: string;
  animal_description: string;
  sex_at_transfer: string;
  age_at_transfer: string;
  municipality_brand: string;
  owner_brand: string;
  can_edit: boolean;
};

// Build YYYY-MM-DD from local date parts so the form does not shift a day across time zones.
function getLocalDateInputValue() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// Auction staff encode the details from the completed paper certificate; the API derives the seller from the animal.
export default function AuctionOwnershipTransfersPage() {
  const queryClient = useQueryClient();
  const [lookupCode, setLookupCode] = useState("");
  const [animal, setAnimal] = useState<RegisteredLivestockLookup | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [ownerType, setOwnerType] = useState<OwnerType>("REGISTERED_FARMER");
  const [editing, setEditing] = useState<Transfer | null>(null);

  const { data: transfers = [], isLoading, isError } = useQuery({
    queryKey: ["auction-ownership-transfers"],
    queryFn: async () => (await api.get<Transfer[]>("livestock/ownership-transfers/")).data,
  });

  // Resolve the market tag/QR through the existing authorized animal lookup before accepting certificate details.
  async function findAnimal() {
    if (!lookupCode.trim()) return;
    setIsLookingUp(true);
    setLookupError("");
    setAnimal(null);
    try {
      const result = await lookupRegisteredLivestock(lookupCode.trim());
      if (!result.eligible) {
        setLookupError(result.ineligibility_reason || "Only approved, active individual animals can be transferred.");
      } else {
        setAnimal(result);
      }
    } catch {
      setLookupError("No eligible registered animal matched that tag or QR value.");
    } finally {
      setIsLookingUp(false);
    }
  }

  // New records are created by Auction; returned records are patched by the same submitting account.
  const submit = useMutation({
    mutationFn: async ({ form, transferId }: { form: HTMLFormElement; transferId?: number }) => {
      if (!animal) throw new Error("Find an eligible animal first.");
      const values = Object.fromEntries(new FormData(form).entries());
      if (!values.purchase_price) delete values.purchase_price;
      return transferId
        ? api.patch(`livestock/ownership-transfers/${transferId}/`, values)
        : api.post("livestock/ownership-transfers/", { ...values, livestock: animal.id });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auction-ownership-transfers"] });
      await queryClient.invalidateQueries({ queryKey: ["ownership-transfers"] });
      toast.success("Transfer certificate recorded and sent for SIBAT review.");
      setAnimal(null);
      setLookupCode("");
      setOwnerType("REGISTERED_FARMER");
      setEditing(null);
    },
    onError: () => toast.error("Could not record this transfer. Check the animal and certificate details."),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit.mutate({ form: event.currentTarget, transferId: editing?.id });
  }

  async function correctReturnedTransfer(transfer: Transfer) {
    // A returned certificate can be edited only after reloading its still-active seller-side animal.
    setIsLookingUp(true);
    setLookupError("");
    try {
      const result = await lookupRegisteredLivestock(`SL-LIVESTOCK:${transfer.livestock}`);
      if (!result.eligible) throw new Error(result.ineligibility_reason || "This animal is no longer eligible for correction.");
      setAnimal(result);
      setLookupCode(result.tag_number);
      setOwnerType(transfer.owner_type);
      setEditing(transfer);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : "Could not load the animal for correction.");
    } finally {
      setIsLookingUp(false);
    }
  }

  return (
    <>
      <PageHeader title="Ownership Transfer Records" subtitle="Record the seller-to-buyer certificate completed at the livestock market." variant="auction" />
      <main className="mx-auto w-full max-w-6xl space-y-6 p-4 pb-24 sm:p-6 md:pb-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="rounded-xl bg-sky-50 p-2.5 text-sky-700"><ArrowLeftRight className="size-5" /></span>
            <div>
              <h2 className="font-bold text-slate-900">Record a completed sale</h2>
              <p className="mt-1 text-sm text-slate-600">Auction is the recorder. Enter the actual seller, buyer, and certificate information; do not enter the auction as buyer unless the certificate names it.</p>
            </div>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="animal-lookup">Seller’s registered livestock tag or QR value</Label>
              <Input id="animal-lookup" value={lookupCode} onChange={(event) => setLookupCode(event.target.value)} placeholder="Scan or enter the animal tag" />
            </div>
            <Button type="button" className="self-end" onClick={findAnimal} disabled={isLookingUp || !lookupCode.trim()}>
              <Search className="mr-2 size-4" />{isLookingUp ? "Looking up…" : "Find animal"}
            </Button>
          </div>
          {lookupError ? <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{lookupError}</p> : null}
          {animal ? <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
            <p className="font-semibold">{animal.livestock_type_name} · {animal.tag_number}</p>
            <p className="mt-1">Seller: {animal.owner_name} · {animal.origin || animal.barangay || "Address not recorded"}</p>
            <p className="mt-1 text-emerald-800">This certificate will be attached to the seller’s existing animal record.</p>
          </div> : null}

          <form key={editing?.id ?? "new-transfer"} onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="owner_type">Buyer type</Label>
              <select id="owner_type" name="owner_type" value={ownerType} onChange={(event) => setOwnerType(event.target.value as OwnerType)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="REGISTERED_FARMER">Registered SmartLivestock Farmer</option>
                <option value="EXTERNAL_INDIVIDUAL">External individual</option>
                <option value="COMPANY">Company</option>
                <option value="TRADER">Trader</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            {ownerType === "REGISTERED_FARMER" ? <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="new_owner_identifier">Buyer’s exact username or RSBSA number</Label>
              <Input id="new_owner_identifier" name="new_owner_identifier" required={!editing} autoComplete="off" />
            </div> : <>
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="external_owner_name">Buyer / organization name</Label><Input id="external_owner_name" name="external_owner_name" required maxLength={255} defaultValue={editing?.external_owner_name} /></div>
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="external_owner_address">Buyer address</Label><Input id="external_owner_address" name="external_owner_address" required defaultValue={editing?.external_owner_address} /></div>
            </>}
            <div className="space-y-2"><Label htmlFor="transfer_certificate_number">Transfer certificate number</Label><Input id="transfer_certificate_number" name="transfer_certificate_number" required defaultValue={editing?.transfer_certificate_number} /></div>
            <div className="space-y-2"><Label htmlFor="original_certificate_number">Original ownership certificate number</Label><Input id="original_certificate_number" name="original_certificate_number" required defaultValue={editing?.original_certificate_number} /></div>
            <div className="space-y-2"><Label htmlFor="transfer_date">Transfer date</Label><Input id="transfer_date" name="transfer_date" type="date" required defaultValue={editing?.transfer_date ?? getLocalDateInputValue()} /></div>
            <div className="space-y-2"><Label htmlFor="purchase_price">Agreed price (optional)</Label><Input id="purchase_price" name="purchase_price" type="number" min="0" step="0.01" defaultValue={editing?.purchase_price ?? ""} /></div>
            <div className="space-y-2"><Label htmlFor="municipality">Municipality / city</Label><Input id="municipality" name="municipality" required defaultValue={editing?.municipality} /></div>
            <div className="space-y-2"><Label htmlFor="province">Province</Label><Input id="province" name="province" required defaultValue={editing?.province} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="animal_description">Description recorded on certificate (optional)</Label><Input id="animal_description" name="animal_description" defaultValue={editing?.animal_description} /></div>
            <div className="space-y-2"><Label htmlFor="sex_at_transfer">Sex (optional)</Label><Input id="sex_at_transfer" name="sex_at_transfer" defaultValue={editing?.sex_at_transfer} /></div>
            <div className="space-y-2"><Label htmlFor="age_at_transfer">Age (optional)</Label><Input id="age_at_transfer" name="age_at_transfer" defaultValue={editing?.age_at_transfer} /></div>
            <div className="space-y-2"><Label htmlFor="municipality_brand">Municipality brand (optional)</Label><Input id="municipality_brand" name="municipality_brand" defaultValue={editing?.municipality_brand} /></div>
            <div className="space-y-2"><Label htmlFor="owner_brand">Owner brand (optional)</Label><Input id="owner_brand" name="owner_brand" defaultValue={editing?.owner_brand} /></div>
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" disabled={!animal || submit.isPending}>
                {submit.isPending ? "Saving…" : editing ? "Correct and resubmit" : "Record certificate"}
              </Button>
            </div>
          </form>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Records entered by your account</h2>
          {isLoading ? <p className="rounded-xl border bg-white p-5 text-sm text-slate-500">Loading records…</p> : null}
          {isError ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">Could not load your ownership-transfer records.</p> : null}
          {!isLoading && !isError && transfers.length === 0 ? <p className="rounded-xl border border-dashed bg-white p-5 text-sm text-slate-500">No ownership transfers have been entered from this account.</p> : null}
          <div className="grid gap-3 md:grid-cols-2">
            {transfers.map((transfer) => <article key={transfer.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{transfer.livestock_type_name} · {transfer.livestock_tag || `#${transfer.livestock}`}</h3><p className="mt-1 text-sm text-slate-600">{transfer.previous_owner_name} → {transfer.new_owner_name}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{transfer.status.replaceAll("_", " ")}</span></div>
              <p className="mt-3 text-sm text-slate-600">Certificate: {transfer.transfer_certificate_number} · {transfer.transfer_date}</p>
              {transfer.purchase_price ? <p className="mt-1 text-sm text-slate-600">Agreed price: ₱{Number(transfer.purchase_price).toLocaleString()}</p> : null}
              {transfer.can_edit ? <Button type="button" variant="outline" className="mt-3" disabled={isLookingUp} onClick={() => correctReturnedTransfer(transfer)}>Correct and resubmit</Button> : null}
            </article>)}
          </div>
        </section>
      </main>
    </>
  );
}
