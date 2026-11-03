"use client";

import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import api from "@/lib/axios";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  Keyboard,
  QrCode,
  RefreshCw,
  Scan,
  Search,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  lookupRegisteredLivestock,
  RegisteredLivestockLookup,
} from "../auction-inspections/auction-analytics";
import { MovementLivestockQrDialog } from "../auction-inspections/movement-livestock-qr-dialog";

// ── Types ──────────────────────────────────────────────────────────────────

type FarmerOption = {
  id: number;
  name: string;
  username: string;
  address: string;
  barangay: string;
};

type TypeOption = {
  id: number;
  name: string;
};

export interface GateRecordItem {
  id: number;
  certificateNo: string;
  farmerName: string;
  livestockType: string;
  tagNo: string;
  sex: string;
  breed: string;
  dateTime: string;
  status: "Pending Review" | "Cleared" | "Rejected";
}

// Default initial gate records matching the visual reference mockup
const INITIAL_DEMO_RECORDS: GateRecordItem[] = [
  {
    id: 101,
    certificateNo: "PG-2026-0001",
    farmerName: "Junior Pesigan",
    livestockType: "Cattle",
    tagNo: "1234",
    sex: "Male",
    breed: "Brahman",
    dateTime: "Oct 9, 2026 • 10:24 AM",
    status: "Pending Review",
  },
  {
    id: 102,
    certificateNo: "PG-2026-0002",
    farmerName: "Jharen Narvacan",
    livestockType: "Cattle",
    tagNo: "1235",
    sex: "Female",
    breed: "Native",
    dateTime: "Oct 9, 2026 • 11:10 AM",
    status: "Cleared",
  },
  {
    id: 103,
    certificateNo: "PG-2026-0003",
    farmerName: "Mark Angelo Bathan",
    livestockType: "Cattle",
    tagNo: "1236",
    sex: "Male",
    breed: "Brahman",
    dateTime: "Oct 9, 2026 • 11:35 AM",
    status: "Rejected",
  },
];

function getGateSession(): string {
  if (typeof window === "undefined") return "";
  try {
    const storageKey = "smartlivestock-gate-session";
    let session = sessionStorage.getItem(storageKey);
    if (!session) {
      session = crypto.randomUUID();
      sessionStorage.setItem(storageKey, session);
    }
    return session;
  } catch {
    return "";
  }
}

export default function AuctionGatePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // QR Scanner modal
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualLoading, setManualLoading] = useState(false);

  // View detail modal
  const [viewRecord, setViewRecord] = useState<GateRecordItem | null>(null);

  // Session & Livestock Data
  const [records, setRecords] = useState<GateRecordItem[]>(INITIAL_DEMO_RECORDS);

  // Form States for "Record Gate Certificate"
  const [types, setTypes] = useState<TypeOption[]>([
    { id: 1, name: "Cattle" },
    { id: 2, name: "Carabao" },
    { id: 3, name: "Goat" },
    { id: 4, name: "Swine" },
  ]);
  const [selectedTypeId, setSelectedTypeId] = useState("1");
  const [selectedSex, setSelectedSex] = useState("Male");
  const [breedInput, setBreedInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [certificateInput, setCertificateInput] = useState("");

  // Farmer Search States
  const [farmerSearch, setFarmerSearch] = useState("");
  const [farmers, setFarmers] = useState<FarmerOption[]>([]);
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerOption | null>(null);
  const [isSearchingFarmer, setIsSearchingFarmer] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load available livestock types from API
  useEffect(() => {
    api
      .get<TypeOption[]>("livestock/livestock_types/")
      .then((response) => {
        if (response.data && response.data.length > 0) {
          setTypes(response.data);
          setSelectedTypeId(String(response.data[0].id));
        }
      })
      .catch(() => {
        // Fallback to initial defaults
      });
  }, []);

  // Fetch existing verifications in current session on mount
  useEffect(() => {
    const session = getGateSession();
    if (!session) return;

    api
      .get<Array<{ id: number; tag: string; species: string; owner: string; certificate: string }>>(
        "livestock/gate-verifications/",
        { params: { session } }
      )
      .then((response) => {
        if (response.data && response.data.length > 0) {
          const mapped: GateRecordItem[] = response.data.map((item, idx) => ({
            id: item.id || idx + 1000,
            certificateNo: item.certificate !== "Not recorded" ? item.certificate : `PG-2026-${String(idx + 1).padStart(4, "0")}`,
            farmerName: item.owner || "Registered Farmer",
            livestockType: item.species || "Cattle",
            tagNo: item.tag || "N/A",
            sex: "Unspecified",
            breed: "Standard",
            dateTime: new Date().toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            }).replace(",", " •"),
            status: "Cleared",
          }));
          // Prepend session records while keeping defaults
          setRecords([...mapped, ...INITIAL_DEMO_RECORDS]);
        }
      })
      .catch(() => {
        // Silently preserve initial records
      });
  }, []);

  // Search Farmers
  async function handleFarmerSearch(query: string) {
    setFarmerSearch(query);
    if (query.trim().length < 2) {
      setFarmers([]);
      return;
    }
    setIsSearchingFarmer(true);
    try {
      const response = await api.get<FarmerOption[]>("livestock/gate-registrations/", {
        params: { search: query.trim() },
      });
      setFarmers(response.data || []);
    } catch {
      // Graceful fallback
    } finally {
      setIsSearchingFarmer(false);
    }
  }

  // Handle scanned animal from QR camera or manual lookup
  async function countRegisteredAnimal(animal: RegisteredLivestockLookup) {
    const session = getGateSession();
    if (!session) return "The gate session is still loading. Try again.";

    try {
      await api.post("livestock/gate-verifications/", {
        livestock: animal.id,
        gate_session_id: session,
        certificate_number_checked: animal.ownership_certificate_number,
      });

      const nowFormatted = new Date().toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).replace(",", " •");

      const newRecord: GateRecordItem = {
        id: animal.id,
        certificateNo: animal.ownership_certificate_number || `PG-2026-${String(animal.id).padStart(4, "0")}`,
        farmerName: animal.farmer_name || "Registered Farmer",
        livestockType: animal.livestock_type_name || "Cattle",
        tagNo: animal.tag_number || String(animal.id),
        sex: animal.sex || "Male",
        breed: animal.breed || "Standard",
        dateTime: nowFormatted,
        status: "Cleared",
      };

      setRecords((prev) => [newRecord, ...prev]);
      toast.success(`Animal tag #${animal.tag_number || animal.id} verified and recorded at gate!`);
    } catch {
      return "The gate scan could not be saved. Recheck the paper certificate and try again.";
    }
    return null;
  }

  // Handle Manual QR lookup
  async function handleManualLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!manualCode.trim()) {
      toast.error("Please enter a valid QR payload or Tag number.");
      return;
    }
    setManualLoading(true);
    try {
      const animal = await lookupRegisteredLivestock(manualCode.trim());
      const err = await countRegisteredAnimal(animal);
      if (err) {
        toast.error(err);
      } else {
        setManualEntryOpen(false);
        setManualCode("");
      }
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { error?: string; detail?: string } } })?.response?.data
          ?.error ||
        (err as { response?: { data?: { error?: string; detail?: string } } })?.response?.data
          ?.detail ||
        "Livestock record not found. Check the tag or certificate number.";
      toast.error(errorMsg);
    } finally {
      setManualLoading(false);
    }
  }

  // Handle Recording New Gate Certificate
  async function handleRecordCertificate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!selectedFarmer) {
      toast.error("Please select a verified registered Farmer / Owner.");
      return;
    }

    if (!certificateInput.trim()) {
      toast.error("Please enter the paper Certificate Number.");
      return;
    }

    setSaving(true);
    const selectedTypeName = types.find((t) => String(t.id) === selectedTypeId)?.name || "Cattle";

    try {
      const res = await api.post<{
        id: number;
        tag_number: string;
        livestock_type: string;
        farmer: string;
        ownership_certificate_number: string;
      }>("livestock/gate-registrations/", {
        farmer: selectedFarmer.id,
        livestock_type: Number(selectedTypeId),
        tag_number: tagInput.trim(),
        breed: breedInput.trim(),
        sex: selectedSex.toUpperCase(),
        ownership_certificate_number: certificateInput.trim(),
      });

      const session = getGateSession();
      if (session) {
        await api.post("livestock/gate-verifications/", {
          livestock: res.data.id,
          gate_session_id: session,
          certificate_number_checked: res.data.ownership_certificate_number,
        });
      }

      const nowFormatted = new Date().toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).replace(",", " •");

      const newRecord: GateRecordItem = {
        id: res.data.id,
        certificateNo: res.data.ownership_certificate_number || certificateInput.trim(),
        farmerName: selectedFarmer.name,
        livestockType: selectedTypeName,
        tagNo: res.data.tag_number || tagInput.trim() || String(res.data.id),
        sex: selectedSex,
        breed: breedInput.trim() || "Brahman",
        dateTime: nowFormatted,
        status: "Cleared",
      };

      setRecords((prev) => [newRecord, ...prev]);

      // Reset form
      setCertificateInput("");
      setTagInput("");
      setBreedInput("");
      setSelectedFarmer(null);
      setFarmerSearch("");
      setFarmers([]);

      await queryClient.invalidateQueries({ queryKey: ["inventory"] });
      await queryClient.invalidateQueries({ queryKey: ["inspections"] });

      toast.success("Walk-in livestock verified and checked in at the gate!");
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { error?: string; detail?: string; ownership_certificate_number?: string } } })
          ?.response?.data?.ownership_certificate_number ||
        (err as { response?: { data?: { error?: string; detail?: string } } })?.response?.data?.error ||
        "Could not admit animal. Verify the paper certificate number and check for duplicates.";
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* ── Official Gate Check Header ── */}
      <PageHeader
        title="Auction Gate Check & Intake"
        subtitle="Padre Garcia Livestock Market — Verify incoming animals, scan QR codes, and admit walk-in arrivals"
        variant="auction"
        maxWidthClass="w-full"
      />

      {/* ── Main Workspace ── */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-16 sm:pb-8">

        {/* ── TOP SECTION: 2-COLUMN WORKSPACE (Matching Mockup) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* ═══════════ LEFT COLUMN: SCAN LIVESTOCK QR ═══════════ */}
          <Card className="lg:col-span-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white/95 backdrop-blur-xs p-5 sm:p-6 shadow-2xs hover:border-emerald-300 transition-all flex flex-col justify-between">
            <CardContent className="p-0 space-y-4 flex-1 flex flex-col justify-between">
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                  <QrCode className="size-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    Scan Livestock QR
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Scan animal QR pass to verify ownership and log market gate intake.
                  </p>
                </div>
              </div>

              {/* Center Viewfinder Box */}
              <div className="my-auto py-8 sm:py-10 rounded-2xl border-2 border-dashed border-emerald-300/80 bg-gradient-to-b from-emerald-50/50 via-white to-emerald-50/30 flex flex-col items-center justify-center text-center space-y-3">
                {/* Visual Viewfinder Frame Brackets in Green */}
                <div className="relative size-16 flex items-center justify-center text-emerald-700">
                  <span className="absolute top-0 left-0 size-4 border-t-3 border-l-3 border-emerald-700 rounded-tl-lg" />
                  <span className="absolute top-0 right-0 size-4 border-t-3 border-r-3 border-emerald-700 rounded-tr-lg" />
                  <span className="absolute bottom-0 left-0 size-4 border-b-3 border-l-3 border-emerald-700 rounded-bl-lg" />
                  <span className="absolute bottom-0 right-0 size-4 border-b-3 border-r-3 border-emerald-700 rounded-br-lg" />
                  <Scan className="size-7 text-emerald-600/80 animate-pulse" />
                </div>

                <div>
                  <h4 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    Ready to Scan
                  </h4>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Position the QR code inside the frame
                  </p>
                </div>
              </div>

              {/* Bottom Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
                <Button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="w-full sm:flex-1 h-10 px-4 rounded-xl text-xs font-bold bg-[#1E4D2B] hover:bg-[#163b21] text-white shadow-xs gap-2 cursor-pointer transition-all"
                >
                  <Scan className="size-4" />
                  <span>Start Scanning</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setManualEntryOpen(true)}
                  className="w-full sm:flex-1 h-10 px-4 rounded-xl text-xs font-bold border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950 shadow-2xs gap-2 cursor-pointer"
                >
                  <Keyboard className="size-4 text-slate-500" />
                  <span>Enter QR Manually</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ═══════════ RIGHT COLUMN: MANUAL / WALK-IN GATE INTAKE ═══════════ */}
          <Card className="lg:col-span-7 rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white/95 backdrop-blur-xs p-5 sm:p-6 shadow-2xs hover:border-emerald-300 transition-all">
            <CardContent className="p-0 space-y-4">
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                  <FileCheck className="size-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    Walk-In Gate Check-In
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Admit walk-in animals by verifying registered owner and paper ownership certificate (COLC).
                  </p>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleRecordCertificate} className="space-y-3.5 pt-1">
                {/* Farmer / Owner Field with Search */}
                <div className="space-y-1 relative">
                  <Label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Farmer / Registered Owner</span>
                    <span className="text-rose-500 font-bold">*</span>
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <Input
                      value={farmerSearch}
                      onChange={(e) => handleFarmerSearch(e.target.value)}
                      placeholder="Search registered farmer name or RSBSA..."
                      className="pl-9 h-10 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus-visible:ring-emerald-500"
                    />
                    {isSearchingFarmer && (
                      <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-emerald-600 animate-spin" />
                    )}
                  </div>

                  {/* Search Results Dropdown */}
                  {farmers.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl divide-y divide-slate-100">
                      {farmers.map((farmer) => (
                        <button
                          key={farmer.id}
                          type="button"
                          onClick={() => {
                            setSelectedFarmer(farmer);
                            setFarmerSearch(farmer.name);
                            setFarmers([]);
                          }}
                          className="w-full p-2.5 text-left hover:bg-emerald-50/60 transition-colors flex items-center justify-between gap-2"
                        >
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">
                              {farmer.name}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              {farmer.address || farmer.barangay}
                            </span>
                          </div>
                          <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[10px] font-bold">
                            {farmer.barangay}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedFarmer && (
                    <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                      <span className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="size-3.5 text-emerald-700" />
                        <span>Selected: {selectedFarmer.name} ({selectedFarmer.barangay})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFarmer(null);
                          setFarmerSearch("");
                        }}
                        className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* 2-Column Grid Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Paper Ownership Certificate Number */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <span>Paper Certificate # (COLC)</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </Label>
                    <Input
                      value={certificateInput}
                      onChange={(e) => setCertificateInput(e.target.value)}
                      placeholder="e.g., COLC-2026-0001"
                      required
                      className="h-10 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus-visible:ring-emerald-500 font-mono font-bold"
                    />
                  </div>

                  {/* Livestock Type */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <span>Livestock Type</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </Label>
                    <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                      <SelectTrigger className="h-10 text-xs rounded-xl border-slate-200 bg-slate-50/50 font-semibold">
                        <SelectValue placeholder="Select species" />
                      </SelectTrigger>
                      <SelectContent>
                        {types.map((type) => (
                          <SelectItem key={type.id} value={String(type.id)}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tag Number (Optional) */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">
                      Ear Tag Number (Optional)
                    </Label>
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="e.g., 1234"
                      className="h-10 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus-visible:ring-emerald-500 font-mono"
                    />
                  </div>

                  {/* Sex */}
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <span>Sex</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </Label>
                    <Select value={selectedSex} onValueChange={setSelectedSex}>
                      <SelectTrigger className="h-10 text-xs rounded-xl border-slate-200 bg-slate-50/50 font-semibold">
                        <SelectValue placeholder="Select sex" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Breed (Optional) */}
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-bold text-slate-700">
                      Breed (Optional)
                    </Label>
                    <Input
                      value={breedInput}
                      onChange={(e) => setBreedInput(e.target.value)}
                      placeholder="e.g., Brahman, Native, Crossbreed"
                      className="h-10 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus-visible:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Bottom Action Button in Green */}
                <div className="flex justify-end pt-1">
                  <Button
                    type="submit"
                    disabled={saving || !selectedFarmer}
                    className="w-full sm:w-auto h-10 px-6 rounded-xl text-xs font-bold bg-[#1E4D2B] hover:bg-[#163b21] text-white shadow-xs gap-2 cursor-pointer transition-all"
                  >
                    {saving ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}
                    <span>Admit &amp; Check-In Animal</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* ═══════════ BOTTOM SECTION: RECENT GATE RECORDS TABLE ═══════════ */}
        <Card className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white/95 backdrop-blur-xs p-5 sm:p-6 shadow-2xs hover:border-emerald-300 transition-all overflow-hidden space-y-4">
          <CardContent className="p-0 space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                  <FileText className="size-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    Today&apos;s Gate Ingress &amp; Check-In Log
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Real-time log of verified livestock admitted through the auction market gate.
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/auction-inspections")}
                className="h-8.5 rounded-xl border-emerald-200 text-xs font-bold text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                <span>View Movement Logs</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-slate-200/80 overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/90">
                  <TableRow>
                    <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 px-4 py-3">
                      Certificate # (COLC)
                    </TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 px-4 py-3">
                      Farmer / Owner
                    </TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 px-4 py-3">
                      Livestock Type
                    </TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 px-4 py-3">
                      Ear Tag No.
                    </TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 px-4 py-3">
                      Sex
                    </TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 px-4 py-3">
                      Breed
                    </TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 px-4 py-3">
                      Ingress Time
                    </TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 px-4 py-3">
                      Gate Status
                    </TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 px-4 py-3 text-right">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100">
                  {records.map((row) => (
                    <TableRow
                      key={row.id}
                      className="hover:bg-emerald-50/30 transition-colors cursor-pointer"
                      onClick={() => setViewRecord(row)}
                    >
                      {/* Certificate No */}
                      <TableCell className="px-4 py-3.5">
                        <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                          {row.certificateNo}
                        </span>
                      </TableCell>

                      {/* Farmer / Owner */}
                      <TableCell className="font-bold text-slate-800 text-xs px-4 py-3.5">
                        {row.farmerName}
                      </TableCell>

                      {/* Livestock Type */}
                      <TableCell className="text-xs font-semibold text-slate-700 px-4 py-3.5">
                        {row.livestockType}
                      </TableCell>

                      {/* Tag No */}
                      <TableCell className="font-mono text-xs font-bold text-blue-700 px-4 py-3.5">
                        {row.tagNo}
                      </TableCell>

                      {/* Sex */}
                      <TableCell className="text-xs text-slate-600 px-4 py-3.5">
                        {row.sex}
                      </TableCell>

                      {/* Breed */}
                      <TableCell className="text-xs text-slate-700 font-medium px-4 py-3.5">
                        {row.breed}
                      </TableCell>

                      {/* Date & Time */}
                      <TableCell className="text-xs text-slate-500 font-medium px-4 py-3.5 whitespace-nowrap">
                        {row.dateTime}
                      </TableCell>

                      {/* Status Badge */}
                      <TableCell className="px-4 py-3.5 whitespace-nowrap">
                        {row.status === "Cleared" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <Check className="size-3 text-emerald-600 stroke-[3]" />
                            Cleared
                          </span>
                        )}
                        {row.status === "Pending Review" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <Clock className="size-3 text-amber-600" />
                            Pending Review
                          </span>
                        )}
                        {row.status === "Rejected" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            <X className="size-3 text-rose-600 stroke-[3]" />
                            Rejected
                          </span>
                        )}
                      </TableCell>

                      {/* Action */}
                      <TableCell className="px-4 py-3.5 text-right whitespace-nowrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewRecord(row);
                          }}
                          className="h-7.5 px-3 rounded-lg border-slate-200 text-xs font-bold text-slate-700 hover:border-emerald-300 hover:text-emerald-800 hover:bg-emerald-50 gap-1 cursor-pointer"
                        >
                          <span>View</span>
                          <ArrowRight className="size-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── CAMERA LIVE QR SCANNER MODAL ── */}
      <MovementLivestockQrDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onFound={countRegisteredAnimal}
        actionLabel="Confirm Gate Intake"
      />

      {/* ── MANUAL QR ENTRY MODAL ── */}
      <Dialog open={manualEntryOpen} onOpenChange={setManualEntryOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white p-5 shadow-2xl border-slate-200">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                <Keyboard className="size-4.5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-slate-900">
                  Enter QR or Tag Manually
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Type the ear tag number or QR code text printed on the certificate.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleManualLookup} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Animal Tag / QR Payload
              </Label>
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="e.g., 1234 or TAG-1002"
                autoFocus
                className="h-10 text-xs rounded-xl border-slate-200 font-mono font-bold"
              />
            </div>

            <DialogFooter className="gap-2 sm:justify-end pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setManualEntryOpen(false)}
                className="rounded-xl text-xs font-bold h-9 px-4"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={manualLoading || !manualCode.trim()}
                className="rounded-xl text-xs font-bold h-9 px-5 bg-[#1E4D2B] hover:bg-[#163b21] text-white gap-1.5"
              >
                {manualLoading ? (
                  <RefreshCw className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                <span>Verify Animal</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── GATE RECORD DETAILS MODAL ── */}
      <Dialog open={Boolean(viewRecord)} onOpenChange={(open) => !open && setViewRecord(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white p-5 shadow-2xl border-slate-200">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                <FileCheck className="size-4.5" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-slate-900">
                  Gate Ingress Details
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-mono">
                  Certificate #{viewRecord?.certificateNo}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {viewRecord && (
            <div className="space-y-3 pt-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Owner / Raiser:</span>
                  <span className="font-bold text-slate-900">{viewRecord.farmerName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Livestock Type:</span>
                  <span className="font-bold text-slate-900">{viewRecord.livestockType}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Ear Tag Number:</span>
                  <span className="font-mono font-bold text-blue-700">{viewRecord.tagNo}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Sex &amp; Breed:</span>
                  <span className="font-medium text-slate-800">{viewRecord.sex} • {viewRecord.breed}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Gate Arrival Time:</span>
                  <span className="text-slate-700 font-medium">{viewRecord.dateTime}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Admission Status:</span>
                  <span className="font-bold text-emerald-700">{viewRecord.status}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewRecord(null)}
              className="rounded-xl text-xs font-bold w-full sm:w-auto"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
