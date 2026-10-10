"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, QrCode, Search } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { UniversalQrScannerDialog } from "@/components/universal-qr-scanner-dialog";
import api from "@/lib/axios";
import { toast } from "sonner";

type OwnerType = "REGISTERED_FARMER" | "EXTERNAL_INDIVIDUAL" | "COMPANY" | "TRADER" | "OTHER";
type FarmerLookup = { id: number; name: string; username: string; email: string; rsbsa_number: string; address: string; barangay: string };
type FarmerAnimal = { id: number; tag_number: string; livestock_type_name: string; sex: string; breed: string; ownership_certificate_number: string };
type Transfer = {
  id: number; livestock: number; previous_owner: number; livestock_tag: string; livestock_type_name: string;
  new_owner: number | null;
  previous_owner_name: string; new_owner_name: string; transfer_certificate_number: string; transfer_date: string;
  purchase_price: string | null; status: string; owner_type: OwnerType; external_owner_name: string;
  external_owner_address: string; original_certificate_number: string; municipality: string; province: string;
  animal_description: string; sex_at_transfer: string; age_at_transfer: string; municipality_brand: string;
  owner_brand: string; can_edit: boolean;
};

function getLocalDateInputValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Each certificate submission is scoped to one selected seller and one or more animals from that seller.
export default function AuctionOwnershipTransfersPage() {
  const queryClient = useQueryClient();
  const [farmerSearch, setFarmerSearch] = useState("");
  const [farmerResults, setFarmerResults] = useState<FarmerLookup[]>([]);
  const [farmer, setFarmer] = useState<FarmerLookup | null>(null);
  const [buyerSearch, setBuyerSearch] = useState("");
  const [buyerResults, setBuyerResults] = useState<FarmerLookup[]>([]);
  const [buyer, setBuyer] = useState<FarmerLookup | null>(null);
  const [farmerAnimals, setFarmerAnimals] = useState<FarmerAnimal[]>([]);
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<number[]>([]);
  const [originalCertificates, setOriginalCertificates] = useState<Record<number, string>>({});
  const [lookupError, setLookupError] = useState("");
  const [isSearchingFarmers, setIsSearchingFarmers] = useState(false);
  const [isSearchingBuyers, setIsSearchingBuyers] = useState(false);
  const [isLoadingAnimals, setIsLoadingAnimals] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<"seller" | "buyer">("seller");
  const [ownerType, setOwnerType] = useState<OwnerType>("REGISTERED_FARMER");
  const [editing, setEditing] = useState<Transfer | null>(null);

  const { data: transfers = [], isLoading, isError } = useQuery({
    queryKey: ["auction-ownership-transfers"],
    queryFn: async () => (await api.get<Transfer[]>("livestock/ownership-transfers/")).data,
  });

  async function loadFarmerAnimals(seller: FarmerLookup, selectedAnimalId?: number, originalCertificate?: string) {
    setFarmer(seller);
    setBuyer(null);
    setBuyerResults([]);
    setFarmerResults([]);
    setLookupError("");
    setIsLoadingAnimals(true);
    setFarmerAnimals([]);
    setSelectedAnimalIds([]);
    setOriginalCertificates({});
    try {
      const response = await api.get<FarmerAnimal[]>(`livestock/ownership-transfer-farmers/${seller.id}/livestock/`);
      setFarmerAnimals(response.data);
      setSelectedAnimalIds(selectedAnimalId ? [selectedAnimalId] : []);
      setOriginalCertificates(Object.fromEntries(response.data.map((animal) => [
        animal.id,
        animal.id === selectedAnimalId ? originalCertificate || animal.ownership_certificate_number : animal.ownership_certificate_number,
      ])));
      if (!response.data.length) setLookupError("This Farmer has no approved, active individual livestock available for transfer.");
    } catch {
      setLookupError("Could not load this Farmer’s eligible livestock.");
    } finally {
      setIsLoadingAnimals(false);
    }
  }

  async function searchFarmers() {
    if (farmerSearch.trim().length < 2 && !/^\d+$/.test(farmerSearch.trim())) {
      setLookupError("Enter at least two characters, or scan the Farmer profile QR.");
      return;
    }
    setIsSearchingFarmers(true);
    setLookupError("");
    setFarmer(null);
    setFarmerAnimals([]);
    setSelectedAnimalIds([]);
    try {
      const response = await api.get<FarmerLookup[]>("livestock/ownership-transfer-farmers/", { params: { search: farmerSearch.trim() } });
      setFarmerResults(response.data);
      if (!response.data.length) setLookupError("No approved Farmer matched that name, email, username, RSBSA number, or Farmer ID.");
    } catch {
      setLookupError("Could not search registered Farmers.");
    } finally {
      setIsSearchingFarmers(false);
    }
  }

  async function selectFarmerById(farmerId: number) {
    setLookupError("");
    setIsLoadingAnimals(true);
    try {
      const response = await api.get<FarmerLookup>(`livestock/ownership-transfer-farmers/${farmerId}/`);
      await loadFarmerAnimals(response.data);
    } catch {
      setFarmer(null);
      setLookupError("That QR or Farmer ID does not match an approved Farmer account.");
      setIsLoadingAnimals(false);
    }
  }

  async function searchBuyers() {
    if (buyerSearch.trim().length < 2 && !/^\d+$/.test(buyerSearch.trim())) {
      setLookupError("Enter at least two characters to find the registered buyer.");
      return;
    }
    setIsSearchingBuyers(true);
    setLookupError("");
    try {
      const response = await api.get<FarmerLookup[]>("livestock/ownership-transfer-farmers/", { params: { search: buyerSearch.trim() } });
      const matches = response.data.filter((candidate) => candidate.id !== farmer?.id);
      setBuyerResults(matches);
      if (!matches.length) setLookupError("No other approved Farmer matched that buyer search.");
    } catch {
      setLookupError("Could not search registered Farmers for the buyer.");
    } finally {
      setIsSearchingBuyers(false);
    }
  }

  async function selectBuyerById(farmerId: number) {
    setLookupError("");
    try {
      const response = await api.get<FarmerLookup>(`livestock/ownership-transfer-farmers/${farmerId}/`);
      if (response.data.id === farmer?.id) {
        setLookupError("The buyer must be different from the seller.");
        return;
      }
      setBuyer(response.data);
      setBuyerResults([]);
      setBuyerSearch("");
    } catch {
      setLookupError("That QR or Farmer ID does not match an approved buyer account.");
    }
  }

  const submit = useMutation({
    mutationFn: async ({ form, transferId }: { form: HTMLFormElement; transferId?: number }) => {
      if (!farmer || !selectedAnimalIds.length) throw new Error("Select a Farmer and at least one eligible animal first.");
      if (ownerType === "REGISTERED_FARMER" && !buyer) throw new Error("Find and select the registered buyer first.");
      const values = Object.fromEntries(new FormData(form).entries());
      if (ownerType === "REGISTERED_FARMER" && buyer) values.new_owner_identifier = buyer.username;
      if (!values.purchase_price) delete values.purchase_price;
      if (transferId) {
        const animalId = selectedAnimalIds[0];
        return api.patch(`livestock/ownership-transfers/${transferId}/`, {
          ...values, livestock: animalId, original_certificate_number: originalCertificates[animalId],
        });
      }
      return api.post("livestock/ownership-transfers/", {
        ...values,
        livestock_ids: selectedAnimalIds,
        original_certificate_numbers: Object.fromEntries(selectedAnimalIds.map((id) => [String(id), originalCertificates[id] || ""])),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auction-ownership-transfers"] });
      await queryClient.invalidateQueries({ queryKey: ["ownership-transfers"] });
      toast.success(editing ? "Transfer corrected and sent to MAO." : `Transfer certificate recorded for ${selectedAnimalIds.length} animal${selectedAnimalIds.length === 1 ? "" : "s"} and sent to MAO.`);
      setFarmer(null);
      setFarmerAnimals([]);
      setSelectedAnimalIds([]);
      setFarmerSearch("");
      setBuyerSearch("");
      setBuyer(null);
      setBuyerResults([]);
      setOwnerType("REGISTERED_FARMER");
      setEditing(null);
    },
    onError: () => toast.error("Could not record this transfer. Check the seller, animals, and certificate details."),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit.mutate({ form: event.currentTarget, transferId: editing?.id });
  }

  async function correctReturnedTransfer(transfer: Transfer) {
    setIsLoadingAnimals(true);
    setLookupError("");
    try {
      const response = await api.get<FarmerLookup>(`livestock/ownership-transfer-farmers/${transfer.previous_owner}/`);
      setOwnerType(transfer.owner_type);
      setEditing(transfer);
      await loadFarmerAnimals(response.data, transfer.livestock, transfer.original_certificate_number);
      if (transfer.owner_type === "REGISTERED_FARMER" && transfer.new_owner) {
        const buyerResponse = await api.get<FarmerLookup>(`livestock/ownership-transfer-farmers/${transfer.new_owner}/`);
        setBuyer(buyerResponse.data);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setLookupError("Could not load the original seller and animal for correction.");
      setIsLoadingAnimals(false);
    }
  }

  const toggleAnimal = (animalId: number, checked: boolean) => {
    setSelectedAnimalIds((current) => checked
      ? [...current, animalId]
      : current.filter((id) => id !== animalId));
  };

  return (
    <>
      <PageHeader title="Record Ownership Transfer" subtitle="Find the seller, select their livestock, then record the completed certificate." variant="auction" />
      <main className="mx-auto w-full max-w-6xl space-y-6 p-4 pb-24 sm:p-6 md:pb-6">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-muted p-2"><ArrowLeftRight className="size-5" /></span>
              <div className="space-y-1"><CardTitle>{editing ? "Correct a returned transfer" : "Record a completed sale"}</CardTitle><CardDescription>Identify one registered seller, then select the animals that seller is transferring. One certificate cannot mix sellers.</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {!editing && !farmer ? <div className="space-y-2">
              <Label htmlFor="farmer-search">Find the registered seller</Label>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <Input id="farmer-search" value={farmerSearch} onChange={(event) => setFarmerSearch(event.target.value)} placeholder="Farmer name, email, username, RSBSA, or Farmer ID" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchFarmers(); } }} />
                <Button type="button" variant="outline" onClick={() => void searchFarmers()} disabled={isSearchingFarmers || !farmerSearch.trim()}><Search className="mr-2 size-4" />{isSearchingFarmers ? "Searching…" : "Find Farmer"}</Button>
                <Button type="button" variant="secondary" onClick={() => { setScannerTarget("seller"); setIsScannerOpen(true); }}><QrCode className="mr-2 size-4" />Scan Farmer QR</Button>
              </div>
            </div> : null}

            {lookupError ? <Alert variant="destructive"><AlertDescription>{lookupError}</AlertDescription></Alert> : null}

            {farmerResults.length ? <div className="space-y-2">
              <h3 className="text-sm font-semibold">Select the seller</h3>
              <div className="grid gap-2 md:grid-cols-2">{farmerResults.map((result) => <Button key={result.id} type="button" variant="outline" className="h-auto justify-start whitespace-normal p-3 text-left" onClick={() => void loadFarmerAnimals(result)}>
                <span><span className="block font-semibold">{result.name} <span className="font-normal text-muted-foreground">· Farmer ID {result.id}</span></span><span className="mt-1 block text-xs text-muted-foreground">{result.username} · {result.email || "No email"} · {result.barangay}</span></span>
              </Button>)}</div>
            </div> : null}

            {farmer ? <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-muted/30 p-4">
                <div className="space-y-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">Seller: {farmer.name}</h3><Badge variant="secondary">Farmer ID {farmer.id}</Badge></div><p className="text-sm text-muted-foreground">{farmer.username} · {farmer.email || "No email"} · {farmer.barangay}</p>{farmer.rsbsa_number ? <p className="text-xs text-muted-foreground">RSBSA: {farmer.rsbsa_number}</p> : null}</div>
                {!editing ? <Button type="button" variant="ghost" onClick={() => { setFarmer(null); setFarmerAnimals([]); setSelectedAnimalIds([]); setFarmerResults([]); }}>Choose another Farmer</Button> : null}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Select livestock this Farmer is selling</h3>{farmerAnimals.length ? <Button type="button" variant="outline" size="sm" onClick={() => setSelectedAnimalIds(farmerAnimals.map((animal) => animal.id))}>Select all eligible</Button> : null}</div>
              {isLoadingAnimals ? <p className="rounded-lg border p-4 text-sm text-muted-foreground">Loading this Farmer’s eligible livestock…</p> : null}
              {!isLoadingAnimals && farmerAnimals.length ? <div className="divide-y rounded-lg border">{farmerAnimals.map((animal) => <label key={animal.id} className="flex cursor-pointer items-start gap-3 p-3 hover:bg-muted/40">
                <Checkbox checked={selectedAnimalIds.includes(animal.id)} onCheckedChange={(checked) => toggleAnimal(animal.id, checked === true)} className="mt-1" />
                <span className="min-w-0 flex-1"><span className="block font-medium">{animal.livestock_type_name} · {animal.tag_number || `#${animal.id}`}</span><span className="mt-1 block text-xs text-muted-foreground">{animal.sex || "Sex not recorded"}{animal.breed ? ` · ${animal.breed}` : ""} · Ownership certificate: {originalCertificates[animal.id] || "Enter below"}</span></span>
                {selectedAnimalIds.includes(animal.id) ? <Badge variant="secondary">Selected</Badge> : null}
              </label>)}</div> : null}
              {selectedAnimalIds.length ? <p className="text-sm text-muted-foreground">{selectedAnimalIds.length} animal{selectedAnimalIds.length === 1 ? "" : "s"} selected. Enter or confirm each original ownership certificate below.</p> : null}
              {selectedAnimalIds.map((id) => {
                const animal = farmerAnimals.find((item) => item.id === id);
                if (!animal) return null;
                return <div key={`certificate-${id}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-center"><Label htmlFor={`original-certificate-${id}`}>{animal.livestock_type_name} {animal.tag_number || `#${id}`} certificate</Label><Input id={`original-certificate-${id}`} value={originalCertificates[id] || ""} onChange={(event) => setOriginalCertificates((current) => ({ ...current, [id]: event.target.value }))} placeholder="Original ownership certificate number" required /></div>;
              })}
            </div> : null}

            <Separator />

            <form key={editing?.id ?? "new-transfer"} onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="owner_type">Buyer type</Label><Select value={ownerType} onValueChange={(value) => { setOwnerType(value as OwnerType); setBuyer(null); setBuyerResults([]); }}><SelectTrigger id="owner_type"><SelectValue placeholder="Choose buyer type" /></SelectTrigger><SelectContent><SelectItem value="REGISTERED_FARMER">Registered SmartLivestock Farmer</SelectItem><SelectItem value="EXTERNAL_INDIVIDUAL">External individual</SelectItem><SelectItem value="COMPANY">Company</SelectItem><SelectItem value="TRADER">Trader</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent></Select><input type="hidden" name="owner_type" value={ownerType} /></div>
              {ownerType === "REGISTERED_FARMER" ? <div className="space-y-3 sm:col-span-2">
                <Label htmlFor="buyer-search">Find the registered buyer</Label>
                {buyer ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3"><div><p className="font-medium">{buyer.name} <span className="text-sm font-normal text-muted-foreground">· Farmer ID {buyer.id}</span></p><p className="text-xs text-muted-foreground">{buyer.username} · {buyer.email || "No email"} · {buyer.barangay}</p></div><Button type="button" variant="ghost" onClick={() => setBuyer(null)}>Choose another buyer</Button></div> : <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <Input id="buyer-search" value={buyerSearch} onChange={(event) => setBuyerSearch(event.target.value)} placeholder="Buyer name, email, username, RSBSA, or Farmer ID" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchBuyers(); } }} />
                  <Button type="button" variant="outline" onClick={() => void searchBuyers()} disabled={isSearchingBuyers || !buyerSearch.trim()}><Search className="mr-2 size-4" />{isSearchingBuyers ? "Searching…" : "Find Farmer"}</Button>
                  <Button type="button" variant="secondary" onClick={() => { setScannerTarget("buyer"); setIsScannerOpen(true); }}><QrCode className="mr-2 size-4" />Scan Farmer QR</Button>
                </div>}
                {buyerResults.length ? <div className="grid gap-2 md:grid-cols-2">{buyerResults.map((result) => <Button key={result.id} type="button" variant="outline" className="h-auto justify-start whitespace-normal p-3 text-left" onClick={() => { setBuyer(result); setBuyerResults([]); setBuyerSearch(""); }}><span><span className="block font-semibold">{result.name} <span className="font-normal text-muted-foreground">· Farmer ID {result.id}</span></span><span className="mt-1 block text-xs text-muted-foreground">{result.username} · {result.email || "No email"} · {result.barangay}</span></span></Button>)}</div> : null}
                <input type="hidden" name="new_owner_identifier" value={buyer?.username || ""} />
              </div> : <>
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="external_owner_name">Buyer / organization name</Label><Input id="external_owner_name" name="external_owner_name" required maxLength={255} defaultValue={editing?.external_owner_name} /></div>
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="external_owner_address">Buyer address</Label><Input id="external_owner_address" name="external_owner_address" required defaultValue={editing?.external_owner_address} /></div>
              </>}
              <div className="space-y-2"><Label htmlFor="transfer_certificate_number">Transfer certificate number</Label><Input id="transfer_certificate_number" name="transfer_certificate_number" required defaultValue={editing?.transfer_certificate_number} /></div>
              <div className="space-y-2"><Label htmlFor="transfer_date">Transfer date</Label><Input id="transfer_date" name="transfer_date" type="date" required defaultValue={editing?.transfer_date ?? getLocalDateInputValue()} /></div>
              <div className="space-y-2"><Label htmlFor="purchase_price">Agreed price (optional)</Label><Input id="purchase_price" name="purchase_price" type="number" min="0" step="0.01" defaultValue={editing?.purchase_price ?? ""} /></div>
              <div className="space-y-2"><Label htmlFor="municipality">Municipality / city</Label><Input id="municipality" name="municipality" required defaultValue={editing?.municipality} /></div>
              <div className="space-y-2"><Label htmlFor="province">Province</Label><Input id="province" name="province" required defaultValue={editing?.province} /></div>
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="animal_description">Description recorded on certificate (optional)</Label><Input id="animal_description" name="animal_description" defaultValue={editing?.animal_description} /></div>
              <div className="space-y-2"><Label htmlFor="sex_at_transfer">Sex (optional)</Label><Input id="sex_at_transfer" name="sex_at_transfer" defaultValue={editing?.sex_at_transfer} /></div>
              <div className="space-y-2"><Label htmlFor="age_at_transfer">Age (optional)</Label><Input id="age_at_transfer" name="age_at_transfer" defaultValue={editing?.age_at_transfer} /></div>
              <div className="space-y-2"><Label htmlFor="municipality_brand">Municipality brand (optional)</Label><Input id="municipality_brand" name="municipality_brand" defaultValue={editing?.municipality_brand} /></div>
              <div className="space-y-2"><Label htmlFor="owner_brand">Owner brand (optional)</Label><Input id="owner_brand" name="owner_brand" defaultValue={editing?.owner_brand} /></div>
              <div className="flex justify-end sm:col-span-2"><Button type="submit" disabled={!farmer || !selectedAnimalIds.length || (ownerType === "REGISTERED_FARMER" && !buyer) || submit.isPending || isLoadingAnimals}>{submit.isPending ? "Saving…" : editing ? "Correct and resubmit" : `Record ${selectedAnimalIds.length || ""} animal${selectedAnimalIds.length === 1 ? "" : "s"}`}</Button></div>
            </form>
          </CardContent>
        </Card>

        <section className="space-y-3"><h2 className="text-lg font-semibold">Records entered by your account</h2>
          {isLoading ? <Card><CardContent className="pt-6 text-sm text-muted-foreground">Loading records…</CardContent></Card> : null}
          {isError ? <Alert variant="destructive"><AlertDescription>Could not load your ownership-transfer records.</AlertDescription></Alert> : null}
          {!isLoading && !isError && transfers.length === 0 ? <Card><CardContent className="pt-6 text-center text-sm text-muted-foreground">No ownership transfers have been entered from this account.</CardContent></Card> : null}
          <div className="grid gap-3 md:grid-cols-2">{transfers.map((transfer) => <Card key={transfer.id}><CardContent className="space-y-3 pt-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{transfer.livestock_type_name} · {transfer.livestock_tag || `#${transfer.livestock}`}</h3><p className="mt-1 text-sm text-muted-foreground">{transfer.previous_owner_name} → {transfer.new_owner_name}</p></div><Badge variant="outline">{transfer.status.replaceAll("_", " ")}</Badge></div><p className="text-sm text-muted-foreground">Certificate: {transfer.transfer_certificate_number} · {transfer.transfer_date}</p>{transfer.purchase_price ? <p className="text-sm text-muted-foreground">Agreed price: ₱{Number(transfer.purchase_price).toLocaleString()}</p> : null}{transfer.can_edit ? <Button type="button" variant="outline" disabled={isLoadingAnimals} onClick={() => void correctReturnedTransfer(transfer)}>Correct and resubmit</Button> : null}</CardContent></Card>)}</div>
        </section>
      </main>
      <UniversalQrScannerDialog isOpen={isScannerOpen} onOpenChange={setIsScannerOpen} role="auction" onSelectFarmer={(farmerId) => { if (scannerTarget === "seller") void selectFarmerById(farmerId); else void selectBuyerById(farmerId); }} />
    </>
  );
}
