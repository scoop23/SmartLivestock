"use client";

import { FormEvent, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCheck, QrCode, Search } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { MovementLivestockQrDialog } from "../auction-inspections/movement-livestock-qr-dialog";
import type { RegisteredLivestockLookup } from "../auction-inspections/auction-analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import api from "@/lib/axios";
import { toast } from "sonner";

type FarmerOption = { id: number; name: string; username: string; address: string; barangay: string };
type TypeOption = { id: number; name: string };
type CountedAnimal = { id: number; tag: string; species: string; owner: string; certificate: string };

export default function AuctionGatePage() {
  const queryClient = useQueryClient();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [gateSession, setGateSession] = useState("");
  const [animals, setAnimals] = useState<CountedAnimal[]>([]);
  const [certificateInputs, setCertificateInputs] = useState<Record<number, string>>({});
  const [farmerSearch, setFarmerSearch] = useState("");
  const [farmers, setFarmers] = useState<FarmerOption[]>([]);
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerOption | null>(null);
  const [types, setTypes] = useState<TypeOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<TypeOption[]>("livestock/livestock_types/").then((response) => setTypes(response.data)).catch(() => toast.error("Could not load livestock types."));
  }, []);

  useEffect(() => {
    const storageKey = "smartlivestock-gate-session";
    const session = sessionStorage.getItem(storageKey) || crypto.randomUUID();
    sessionStorage.setItem(storageKey, session);
    setGateSession(session);
    api.get<CountedAnimal[]>("livestock/gate-verifications/", { params: { session } })
      .then((response) => setAnimals(response.data))
      .catch(() => toast.error("Could not restore this gate session's verified count."));
  }, []);

  async function searchFarmers() {
    if (farmerSearch.trim().length < 2) return;
    try {
      const response = await api.get<FarmerOption[]>("livestock/gate-registrations/", { params: { search: farmerSearch.trim() } });
      setFarmers(response.data);
    } catch {
      toast.error("Could not search approved Farmer accounts.");
    }
  }

  async function countRegisteredAnimal(animal: RegisteredLivestockLookup) {
    if (animals.some((entry) => entry.id === animal.id)) return "This animal has already been counted in this gate session.";
    if (!gateSession) return "The gate session is still loading. Try again.";
    try {
      const response = await api.post<CountedAnimal>("livestock/gate-verifications/", {
        livestock: animal.id,
        gate_session_id: gateSession,
        certificate_number_checked: animal.ownership_certificate_number,
      });
      setAnimals((current) => current.some((entry) => entry.id === response.data.id) ? current : [...current, response.data]);
    } catch {
      return "The gate scan could not be saved. Recheck the paper certificate and try again.";
    }
    return null;
  }

  async function recordExistingCertificate(animalId: number) {
    const certificate = certificateInputs[animalId]?.trim();
    if (!certificate) return;
    try {
      await api.post("livestock/gate-registrations/", { livestock: animalId, ownership_certificate_number: certificate, gate_session_id: gateSession });
      setAnimals((current) => current.map((animal) => animal.id === animalId ? { ...animal, certificate } : animal));
      setCertificateInputs((current) => ({ ...current, [animalId]: "" }));
      toast.success("Paper certificate number saved to this livestock identity.");
    } catch {
      toast.error("The number could not be recorded. Check it against the paper certificate and existing record.");
    }
  }

  async function registerAtGate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFarmer) {
      toast.error("Select the verified registered Farmer who owns this animal.");
      return;
    }
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    setSaving(true);
    try {
      const response = await api.post<{ id: number; tag_number: string; livestock_type: string; farmer: string; ownership_certificate_number: string }>("livestock/gate-registrations/", {
        ...values,
        farmer: selectedFarmer.id,
      });
      const verified = await api.post<CountedAnimal>("livestock/gate-verifications/", {
        livestock: response.data.id,
        gate_session_id: gateSession,
        certificate_number_checked: response.data.ownership_certificate_number,
      });
      setAnimals((current) => current.some((animal) => animal.id === verified.data.id) ? current : [...current, verified.data]);
      form.reset();
      setSelectedFarmer(null);
      setFarmerSearch("");
      setFarmers([]);
      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Gate certificate recorded and livestock identity created.");
    } catch {
      toast.error("Could not register this animal. Check the owner and certificate details.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <PageHeader title="Main Gate Livestock Check" subtitle="Scan registered animals to verify identity and count each head once." variant="auction" />
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><h2 className="flex items-center gap-2 text-lg font-bold"><QrCode className="size-5 text-violet-700" /> Gate scan count</h2><p className="mt-1 text-sm text-slate-600">Scan the animal QR, inspect the animal, and compare the owner and certificate details shown here with the paper certificate.</p></div>
          <div className="rounded-xl bg-violet-50 px-4 py-3 text-center"><p className="text-2xl font-black text-violet-900">{animals.length}</p><p className="text-xs font-bold uppercase text-violet-800">heads recorded</p></div>
        </div>
          <Button className="mt-5 min-h-11 bg-violet-700 hover:bg-violet-800" disabled={!gateSession} onClick={() => setScannerOpen(true)}><QrCode className="mr-2 size-4" /> Scan livestock QR</Button>
        {animals.length > 0 && <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase text-slate-500"><th className="p-2">Tag / ID</th><th className="p-2">Animal</th><th className="p-2">Registered owner</th><th className="p-2">Paper certificate #</th></tr></thead><tbody>{animals.map((animal) => <tr key={animal.id} className="border-b last:border-0"><td className="p-2 font-mono">{animal.tag}</td><td className="p-2">{animal.species}</td><td className="p-2">{animal.owner}</td><td className="p-2">{animal.certificate === "Not recorded" ? <div className="flex min-w-56 gap-2"><Input aria-label={`Paper certificate number for ${animal.tag}`} value={certificateInputs[animal.id] || ""} onChange={(event) => setCertificateInputs((current) => ({ ...current, [animal.id]: event.target.value }))} placeholder="Certificate number" /><Button type="button" size="sm" disabled={!certificateInputs[animal.id]?.trim()} onClick={() => void recordExistingCertificate(animal.id)}>Save</Button></div> : animal.certificate}</td></tr>)}</tbody></table></div>}
        <p className="mt-4 text-xs text-slate-500">Count is for this browser session. The QR identifies the SmartLivestock record; staff still verify the physical animal and paper document.</p>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ClipboardCheck className="size-5 text-amber-700" /> Issue and record a gate certificate</h2>
        <p className="mt-1 text-sm text-slate-600">For an animal not yet in SmartLivestock, verify the registered Farmer and animal, issue the paper certificate through the office process, then record its certificate number here. This creates its approved active identity and QR.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input value={farmerSearch} onChange={(event) => setFarmerSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchFarmers(); } }} placeholder="Search Farmer name, username, or RSBSA" />
          <Button type="button" variant="outline" onClick={() => void searchFarmers()} className="min-h-10"><Search className="mr-2 size-4" /> Search owner</Button>
        </div>
        {farmers.length > 0 && <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border bg-white">{farmers.map((farmer) => <button key={farmer.id} type="button" onClick={() => { setSelectedFarmer(farmer); setFarmers([]); }} className="block w-full border-b p-3 text-left last:border-0 hover:bg-slate-50"><span className="block font-semibold">{farmer.name} · {farmer.barangay}</span><span className="text-xs text-slate-500">{farmer.address}</span></button>)}</div>}
        {selectedFarmer && <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle2 className="size-4" /> Selected owner: {selectedFarmer.name} ({selectedFarmer.barangay})</p>}
        <form onSubmit={registerAtGate} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="gate-certificate">Paper ownership certificate number</Label><Input id="gate-certificate" name="ownership_certificate_number" required maxLength={100} /></div>
          <div className="space-y-2"><Label htmlFor="gate-type">Livestock type</Label><select id="gate-type" name="livestock_type" required className="h-10 w-full rounded-md border bg-white px-3">{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="gate-tag">Tag number (optional)</Label><Input id="gate-tag" name="tag_number" maxLength={50} /></div>
          <div className="space-y-2"><Label htmlFor="gate-sex">Sex</Label><select id="gate-sex" name="sex" required className="h-10 w-full rounded-md border bg-white px-3"><option value="UNKNOWN">Unknown</option><option value="MALE">Male</option><option value="FEMALE">Female</option></select></div>
          <div className="space-y-2"><Label htmlFor="gate-breed">Breed (optional)</Label><Input id="gate-breed" name="breed" maxLength={50} /></div>
          <div className="flex items-end"><Button type="submit" disabled={saving || !selectedFarmer} className="min-h-10 w-full bg-amber-700 hover:bg-amber-800">{saving ? "Recording…" : "Record gate certificate and animal"}</Button></div>
        </form>
      </section>
    </main>
    <MovementLivestockQrDialog open={scannerOpen} onOpenChange={setScannerOpen} onFound={countRegisteredAnimal} actionLabel="Count verified animal" />
  </>;
}
