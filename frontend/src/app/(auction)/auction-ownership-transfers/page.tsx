"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { HeaderNotifications } from "@/app/components/header-notifications";
import { UniversalQrScannerDialog } from "@/components/universal-qr-scanner-dialog";
import { httpError } from "@/lib/http-error";
import api from "@/lib/axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  FileCheck,
  FileText,
  Info,
  QrCode,
  Search,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

type OwnerType = "REGISTERED_FARMER" | "EXTERNAL_INDIVIDUAL" | "COMPANY" | "TRADER" | "OTHER";
type FarmerLookup = {
  id: number;
  name: string;
  username: string;
  email: string;
  rsbsa_number: string;
  address: string;
  barangay: string;
};
type FarmerAnimal = {
  id: number;
  tag_number: string;
  livestock_type_name: string;
  sex: string;
  breed: string;
  ownership_certificate_number: string;
  registration_status: "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION" | "REJECTED";
  transfer_eligible: boolean;
  sale_intent: { target_date: string | null; target_destination: string; notes: string } | null;
};
type Transfer = {
  id: number;
  livestock: number | null;
  previous_owner: number | null;
  livestock_tag: string;
  livestock_type_name: string;
  new_owner: number | null;
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
  external_seller_name: string;
  external_seller_address: string;
  external_livestock_type: string;
  external_livestock_tag_number: string;
  origin_municipality: string;
  origin_province: string;
  animal_description: string;
  sex_at_transfer: string;
  age_at_transfer: string;
  municipality_brand: string;
  owner_brand: string;
  can_edit: boolean;
};

function getLocalDateInputValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getOwnershipTransferLoadError(error: unknown, fallback: string) {
  const requestError = httpError(error);
  const status = requestError?.response?.status;
  const detail = requestError?.response?.data?.detail || requestError?.response?.data?.error;

  if (status === 401) return "Your session has expired. Sign in again, then reload this page.";
  if (status === 403) return "Your account is missing Auction access for this request. Ask an administrator to verify its role.";
  if (status === 404) return detail || "The Farmer or livestock record could not be found.";
  if (status && status >= 500) return `${fallback} The server returned an error (HTTP ${status}); check the Django logs and database migrations.`;
  if (detail) return typeof detail === "string" ? detail : fallback;
  if (!requestError?.response) return "Could not reach the livestock server. Check that the backend is running and try again.";
  return `${fallback} (HTTP ${status}).`;
}

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
  const [sexAtTransfer, setSexAtTransfer] = useState<string>("");
  const [editing, setEditing] = useState<Transfer | null>(null);
  const [outsideLivestock, setOutsideLivestock] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);

  // Realtime clock display in header
  const [clock, setClock] = useState({
    date: "Oct 27, 2026",
    time: "7:32 PM",
  });

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClock({
        date: now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
      });
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const farmerIdParam = params.get("farmerId");
    if (farmerIdParam && /^\d+$/.test(farmerIdParam)) {
      void selectFarmerById(Number(farmerIdParam));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: transfers = [], isLoading, isError, error: transfersError } = useQuery({
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
      const selectedAnimal = response.data.find((animal) => animal.id === selectedAnimalId);
      setSelectedAnimalIds(selectedAnimal?.transfer_eligible ? [selectedAnimal.id] : []);
      setOriginalCertificates(
        Object.fromEntries(
          response.data.map((animal) => [
            animal.id,
            animal.id === selectedAnimalId
              ? originalCertificate || animal.ownership_certificate_number
              : animal.ownership_certificate_number,
          ])
        )
      );
      if (!response.data.length) setLookupError("This Farmer has no active individual livestock available to review.");
    } catch (error) {
      setLookupError(getOwnershipTransferLoadError(error, "Could not load this Farmer's eligible livestock."));
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
      const response = await api.get<FarmerLookup[]>("livestock/ownership-transfer-farmers/", {
        params: { search: farmerSearch.trim() },
      });
      setFarmerResults(response.data);
      if (!response.data.length) setLookupError("No approved Farmer matched that name, email, username, RSBSA number, or Farmer ID.");
    } catch (error) {
      setLookupError(getOwnershipTransferLoadError(error, "Could not search registered Farmers."));
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
      const response = await api.get<FarmerLookup[]>("livestock/ownership-transfer-farmers/", {
        params: { search: buyerSearch.trim() },
      });
      const matches = response.data.filter((candidate) => candidate.id !== farmer?.id);
      setBuyerResults(matches);
      if (!matches.length) setLookupError("No other approved Farmer matched that buyer search.");
    } catch (error) {
      setLookupError(getOwnershipTransferLoadError(error, "Could not search registered Farmers for the buyer."));
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
      if (!outsideLivestock && (!farmer || !selectedAnimalIds.length)) {
        throw new Error("Select a Farmer and at least one eligible animal first.");
      }
      if (ownerType === "REGISTERED_FARMER" && !buyer) {
        throw new Error("Find and select the registered buyer first.");
      }
      const values = Object.fromEntries(new FormData(form).entries());
      if (ownerType === "REGISTERED_FARMER" && buyer) values.new_owner_identifier = buyer.username;
      if (!values.purchase_price) delete values.purchase_price;
      if (outsideLivestock) {
        return transferId
          ? api.patch(`livestock/ownership-transfers/${transferId}/`, values)
          : api.post("livestock/ownership-transfers/", values);
      }
      if (transferId) {
        const animalId = selectedAnimalIds[0];
        return api.patch(`livestock/ownership-transfers/${transferId}/`, {
          ...values,
          livestock: animalId,
          original_certificate_number: originalCertificates[animalId],
        });
      }
      return api.post("livestock/ownership-transfers/", {
        ...values,
        livestock_ids: selectedAnimalIds,
        original_certificate_numbers: Object.fromEntries(
          selectedAnimalIds.map((id) => [String(id), originalCertificates[id] || ""])
        ),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auction-ownership-transfers"] });
      await queryClient.invalidateQueries({ queryKey: ["ownership-transfers"] });
      toast.success(
        editing
          ? "Transfer corrected and sent to MAO."
          : outsideLivestock
          ? "Outside livestock transfer recorded and sent to MAO. It remains outside local inventory."
          : `Transfer certificate recorded for ${selectedAnimalIds.length} animal${selectedAnimalIds.length === 1 ? "" : "s"} and sent to MAO.`
      );
      setFarmer(null);
      setFarmerAnimals([]);
      setSelectedAnimalIds([]);
      setFarmerSearch("");
      setBuyerSearch("");
      setBuyer(null);
      setBuyerResults([]);
      setOwnerType("REGISTERED_FARMER");
      setSexAtTransfer("");
      setEditing(null);
      setOutsideLivestock(false);
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
    if (!transfer.livestock || !transfer.previous_owner) {
      setOutsideLivestock(true);
      setEditing(transfer);
      setOwnerType(transfer.owner_type);
      setSexAtTransfer(transfer.sex_at_transfer || "");
      setIsLoadingAnimals(false);
      if (transfer.owner_type === "REGISTERED_FARMER" && transfer.new_owner) {
        try {
          const buyerResponse = await api.get<FarmerLookup>(`livestock/ownership-transfer-farmers/${transfer.new_owner}/`);
          setBuyer(buyerResponse.data);
        } catch {
          setLookupError("Could not load the registered buyer for correction.");
        }
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    try {
      const response = await api.get<FarmerLookup>(`livestock/ownership-transfer-farmers/${transfer.previous_owner}/`);
      setOwnerType(transfer.owner_type);
      setSexAtTransfer(transfer.sex_at_transfer || "");
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
    setSelectedAnimalIds((current) =>
      checked ? [...current, animalId] : current.filter((id) => id !== animalId)
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Top Banner Header: Dark Forest Green with Cattle Watermark */}
      <div className="relative overflow-hidden bg-[#073827] text-white">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-overlay pointer-events-none"
          style={{ backgroundImage: `url('/images/species-cattle.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#073827] via-[#0A4530]/95 to-[#073827]/85 pointer-events-none" />

        <div className="relative w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Record Ownership Transfer
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 font-normal">
              Record a completed certificate for registered livestock or an outside animal brought to the market.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <HeaderNotifications variant="auction" />
            <div className="flex items-center gap-3 bg-white/10 hover:bg-white/15 transition-colors border border-white/20 rounded-2xl px-4 py-2 text-white shadow-xs backdrop-blur-xs">
              <Calendar className="size-5 text-emerald-200 shrink-0" />
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold leading-tight tracking-wide">{clock.date}</span>
                <span className="text-[11px] font-medium text-emerald-200/90 leading-tight">{clock.time}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* Breadcrumb line */}
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Link href="/auction" className="hover:text-slate-800 transition-colors">
            SmartLivestock
          </Link>
          <span className="text-slate-400">/</span>
          <span className="text-slate-900 font-bold">Ownership Transfers</span>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center justify-between gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs h-9 px-3.5 rounded-xl shadow-xs gap-1.5"
          >
            <Link href="/auction">
              <ArrowLeft className="size-4" />
              Back to Auction
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowUserGuide(true)}
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs h-9 px-3.5 rounded-xl shadow-xs gap-1.5"
          >
            <BookOpen className="size-4 text-slate-600" />
            User Guide
          </Button>
        </div>

        {/* Purple Callout Card */}
        <div className="rounded-2xl border border-[#E9DDFD] bg-[#F8F5FF] p-4 flex items-center gap-3.5 shadow-xs">
          <div className="shrink-0 rounded-xl bg-[#EDE4FF] text-[#7C3AED] p-2.5 flex items-center justify-center">
            <ArrowLeftRight className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-slate-900 leading-tight">
              {editing ? "Correct a returned transfer" : "Record a completed sale"}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Choose a registered SmartLivestock animal or record an outside animal with its seller and origin. Outside animals stay out of local farmer inventory.
            </p>
          </div>
        </div>

        {/* Segmented Tab Pills */}
        {!editing && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setOutsideLivestock(false);
                  setFarmer(null);
                  setFarmerAnimals([]);
                  setSelectedAnimalIds([]);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                  !outsideLivestock
                    ? "bg-[#0F4A2F] text-white hover:bg-[#0B3D26]"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                Registered SmartLivestock animal
              </button>
              <button
                type="button"
                onClick={() => {
                  setOutsideLivestock(true);
                  setFarmer(null);
                  setFarmerAnimals([]);
                  setSelectedAnimalIds([]);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                  outsideLivestock
                    ? "bg-[#0F4A2F] text-white hover:bg-[#0B3D26]"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                Outside livestock
              </button>
            </div>
            <p className="text-xs text-slate-500 font-normal">
              Outside livestock is recorded for the market transaction only and is not added to a Padre Garcia Farmer&apos;s inventory.
            </p>
          </div>
        )}

        {/* Step 1 Card: Light emerald background */}
        <div className="rounded-2xl border border-emerald-200/90 bg-[#F0FAF4] p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-xl bg-[#10B981] text-white p-2 flex items-center justify-center">
              <FileCheck className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">
                1. Find the registered seller
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {outsideLivestock
                  ? "Outside livestock mode active: Seller and origin details will be specified below."
                  : "Search and select the farmer who sold the animal."}
              </p>
            </div>
          </div>

          {!outsideLivestock && !editing && !farmer && (
            <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                <Input
                  id="farmer-search"
                  value={farmerSearch}
                  onChange={(e) => setFarmerSearch(e.target.value)}
                  placeholder="Farmer name, email, username, RSBSA, or Farmer ID"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void searchFarmers();
                    }
                  }}
                  className="pl-10 h-10 bg-white border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus-visible:ring-emerald-500"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void searchFarmers()}
                disabled={isSearchingFarmers || !farmerSearch.trim()}
                className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs h-10 px-4 rounded-xl shadow-xs shrink-0 gap-1.5"
              >
                <Search className="size-4" />
                {isSearchingFarmers ? "Searching…" : "Find Farmer"}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setScannerTarget("seller");
                  setIsScannerOpen(true);
                }}
                className="bg-[#E3F6EC] hover:bg-[#D4F1E1] border border-[#BCE8D3] text-[#0D6843] font-bold text-xs h-10 px-4 rounded-xl shadow-xs shrink-0 gap-1.5"
              >
                <QrCode className="size-4 text-[#0D6843]" />
                Scan Farmer QR
              </Button>
            </div>
          )}

          {lookupError && (
            <Alert variant="destructive" className="rounded-xl">
              <AlertDescription>{lookupError}</AlertDescription>
            </Alert>
          )}

          {/* Seller Search Results */}
          {!outsideLivestock && farmerResults.length > 0 && (
            <div className="space-y-2 pt-1">
              <h3 className="text-xs font-bold text-slate-700">Select the seller</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {farmerResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => void loadFarmerAnimals(result)}
                    className="h-auto text-left p-3 rounded-xl border border-emerald-200 bg-white hover:bg-emerald-50/50 transition-colors shadow-xs"
                  >
                    <span className="block font-bold text-xs text-slate-900">
                      {result.name}{" "}
                      <span className="font-normal text-slate-500">· Farmer ID {result.id}</span>
                    </span>
                    <span className="mt-1 block text-[11px] text-slate-600">
                      {result.username} · {result.email || "No email"} · {result.barangay}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selected Seller & Animals Checklist */}
          {!outsideLivestock && farmer && (
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-emerald-200/90 bg-white p-3.5 shadow-xs">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-xs text-slate-900">Seller: {farmer.name}</h3>
                    <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-200">
                      Farmer ID {farmer.id}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600">
                    {farmer.username} · {farmer.email || "No email"} · {farmer.barangay}
                  </p>
                  {farmer.rsbsa_number && (
                    <p className="text-[11px] text-slate-500">RSBSA: {farmer.rsbsa_number}</p>
                  )}
                </div>
                {!editing && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFarmer(null);
                      setFarmerAnimals([]);
                      setSelectedAnimalIds([]);
                      setFarmerResults([]);
                    }}
                    className="h-8 text-xs text-slate-600 hover:text-slate-900"
                  >
                    Choose another Farmer
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <h3 className="text-xs font-bold text-slate-800">Farmer livestock and sale intent</h3>
                {farmerAnimals.some((a) => a.transfer_eligible) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSelectedAnimalIds(
                        farmerAnimals.filter((a) => a.transfer_eligible).map((a) => a.id)
                      )
                    }
                    className="h-7 text-[11px] bg-white border-slate-200 text-slate-700"
                  >
                    Select all eligible
                  </Button>
                )}
              </div>

              {isLoadingAnimals && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
                  Loading this Farmer&apos;s eligible livestock…
                </div>
              )}

              {!isLoadingAnimals && farmerAnimals.length > 0 && (
                <div className="divide-y divide-emerald-100 rounded-xl border border-emerald-200/80 bg-white overflow-hidden shadow-xs">
                  {farmerAnimals.map((animal) => (
                    <label
                      key={animal.id}
                      className={`flex items-start gap-3 p-3 transition-colors ${
                        animal.transfer_eligible
                          ? "cursor-pointer hover:bg-emerald-50/40"
                          : "cursor-not-allowed bg-slate-50/70 opacity-70"
                      }`}
                    >
                      <Checkbox
                        checked={selectedAnimalIds.includes(animal.id)}
                        disabled={!animal.transfer_eligible}
                        onCheckedChange={(checked) => toggleAnimal(animal.id, checked === true)}
                        className="mt-0.5 border-emerald-400 data-[state=checked]:bg-[#0F4A2F] data-[state=checked]:border-[#0F4A2F]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 font-bold text-xs text-slate-900">
                          {animal.livestock_type_name} · {animal.tag_number || `#${animal.id}`}
                          <Badge
                            variant={animal.transfer_eligible ? "secondary" : "outline"}
                            className="text-[10px]"
                          >
                            {animal.registration_status.replaceAll("_", " ")}
                          </Badge>
                        </span>
                        <span className="mt-1 block text-[11px] text-slate-600">
                          {animal.sex || "Sex not recorded"}
                          {animal.breed ? ` · ${animal.breed}` : ""} · Ownership certificate:{" "}
                          {originalCertificates[animal.id] || "Not recorded"}
                        </span>
                        {animal.sale_intent && (
                          <span className="mt-1 block text-[11px] font-medium text-emerald-800">
                            Sale intent declared
                            {animal.sale_intent.target_date ? ` for ${animal.sale_intent.target_date}` : ""}
                            {animal.sale_intent.target_destination ? ` · ${animal.sale_intent.target_destination}` : ""}
                            {animal.sale_intent.notes ? ` · ${animal.sale_intent.notes}` : ""}
                          </span>
                        )}
                        {!animal.transfer_eligible && (
                          <span className="mt-1 block text-[11px] text-amber-800">
                            {animal.registration_status === "REJECTED"
                              ? "Resolve the rejected registration before recording a transfer."
                              : "Transfer can be recorded after inventory approval."}
                          </span>
                        )}
                      </span>
                      {selectedAnimalIds.includes(animal.id) && (
                        <Badge className="bg-emerald-700 text-white text-[10px]">Selected</Badge>
                      )}
                    </label>
                  ))}
                </div>
              )}

              {selectedAnimalIds.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-emerald-200">
                  <p className="text-xs font-semibold text-slate-700">
                    {selectedAnimalIds.length} animal{selectedAnimalIds.length === 1 ? "" : "s"} selected. Confirm each original ownership certificate number:
                  </p>
                  {selectedAnimalIds.map((id) => {
                    const animal = farmerAnimals.find((item) => item.id === id);
                    if (!animal) return null;
                    return (
                      <div
                        key={`certificate-${id}`}
                        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-center bg-white p-2.5 rounded-xl border border-emerald-200 shadow-xs"
                      >
                        <Label htmlFor={`original-certificate-${id}`} className="text-xs font-bold text-slate-800">
                          {animal.livestock_type_name} {animal.tag_number || `#${id}`} certificate
                        </Label>
                        <Input
                          id={`original-certificate-${id}`}
                          value={originalCertificates[id] || ""}
                          onChange={(e) =>
                            setOriginalCertificates((cur) => ({ ...cur, [id]: e.target.value }))
                          }
                          placeholder="Original ownership certificate number"
                          required
                          className="h-9 bg-white border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 2 Card: Light blue background with exact 2-column input grid */}
        <div className="rounded-2xl border border-blue-200/90 bg-[#F2F8FE] p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-xl bg-[#3B82F6] text-white p-2 flex items-center justify-center">
              <FileText className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">
                2. Transfer details
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Enter the certificate information and market details.
              </p>
            </div>
          </div>

          <form key={editing?.id ?? "new-transfer"} onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              {/* Row 1 Left: Buyer type */}
              <div className="space-y-1.5">
                <Label htmlFor="owner_type" className="text-xs font-semibold text-slate-700">
                  Buyer type
                </Label>
                <Select
                  value={ownerType}
                  onValueChange={(val) => {
                    setOwnerType(val as OwnerType);
                    setBuyer(null);
                    setBuyerResults([]);
                  }}
                >
                  <SelectTrigger id="owner_type" className="h-10 bg-white border-slate-200 rounded-xl text-xs">
                    <SelectValue placeholder="Choose buyer type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REGISTERED_FARMER">Registered SmartLivestock Farmer</SelectItem>
                    <SelectItem value="EXTERNAL_INDIVIDUAL">External individual</SelectItem>
                    <SelectItem value="COMPANY">Company</SelectItem>
                    <SelectItem value="TRADER">Trader</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
                <input type="hidden" name="owner_type" value={ownerType} />
              </div>

              {/* Row 1 Right: Find the registered buyer (or buyer name) */}
              <div className="space-y-1.5">
                {ownerType === "REGISTERED_FARMER" ? (
                  <>
                    <Label htmlFor="buyer-search" className="text-xs font-semibold text-slate-700">
                      Find the registered buyer
                    </Label>
                    {buyer ? (
                      <div className="flex items-center justify-between gap-2 h-10 px-3 bg-white border border-emerald-300 rounded-xl text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                          <span className="font-bold text-slate-900">{buyer.name}</span>
                          <span className="text-slate-500 font-normal">· {buyer.barangay}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setBuyer(null)}
                          className="h-7 text-xs text-slate-500 hover:text-red-600"
                        >
                          Change
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                          <Input
                            id="buyer-search"
                            value={buyerSearch}
                            onChange={(e) => setBuyerSearch(e.target.value)}
                            placeholder="Buyer name, email, username, RSBSA, or Farmer ID"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void searchBuyers();
                              }
                            }}
                            className="pl-9 h-10 bg-white border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus-visible:ring-blue-500"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void searchBuyers()}
                          disabled={isSearchingBuyers || !buyerSearch.trim()}
                          className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs h-10 px-3 rounded-xl shadow-xs shrink-0 gap-1.5"
                        >
                          <Search className="size-3.5" />
                          Find Farmer
                        </Button>
                        <Button
                          type="button"
                          onClick={() => {
                            setScannerTarget("buyer");
                            setIsScannerOpen(true);
                          }}
                          className="bg-[#E3F6EC] hover:bg-[#D4F1E1] border border-[#BCE8D3] text-[#0D6843] font-bold text-xs h-10 px-3 rounded-xl shadow-xs shrink-0 gap-1.5"
                        >
                          <QrCode className="size-3.5 text-[#0D6843]" />
                          Scan Farmer QR
                        </Button>
                      </div>
                    )}
                    {buyerResults.length > 0 && (
                      <div className="mt-2 grid gap-1.5 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl p-2 shadow-md">
                        {buyerResults.map((result) => (
                          <button
                            key={result.id}
                            type="button"
                            onClick={() => {
                              setBuyer(result);
                              setBuyerResults([]);
                              setBuyerSearch("");
                            }}
                            className="text-left p-2 rounded-lg hover:bg-blue-50 transition-colors text-xs flex items-center justify-between"
                          >
                            <div>
                              <p className="font-bold text-slate-900">
                                {result.name}{" "}
                                <span className="font-normal text-slate-500">· ID {result.id}</span>
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {result.username} · {result.barangay}
                              </p>
                            </div>
                            <span className="text-[11px] font-bold text-blue-600">Select</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <input type="hidden" name="new_owner_identifier" value={buyer?.username || ""} />
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="external_owner_name" className="text-xs font-semibold text-slate-700">
                      Buyer / organization name
                    </Label>
                    <Input
                      id="external_owner_name"
                      name="external_owner_name"
                      required
                      maxLength={255}
                      defaultValue={editing?.external_owner_name}
                      placeholder="Enter buyer or organization name"
                      className="h-10 bg-white border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Row 2 Left: Paper transfer certificate number */}
              <div className="space-y-1.5">
                <Label htmlFor="transfer_certificate_number" className="text-xs font-semibold text-slate-700">
                  Paper transfer certificate number
                </Label>
                <Input
                  id="transfer_certificate_number"
                  name="transfer_certificate_number"
                  required
                  defaultValue={editing?.transfer_certificate_number}
                  placeholder="Enter certificate number"
                  className="h-10 bg-white border-slate-200 rounded-xl text-xs placeholder:text-slate-400"
                />
                <p className="text-[11px] text-slate-500">
                  Enter the number printed on the completed paper certificate. SmartLivestock stores a digital record separately.
                </p>
              </div>

              {/* Row 2 Right: Transfer date */}
              <div className="space-y-1.5">
                <Label htmlFor="transfer_date" className="text-xs font-semibold text-slate-700">
                  Transfer date
                </Label>
                <Input
                  id="transfer_date"
                  name="transfer_date"
                  type="date"
                  required
                  defaultValue={editing?.transfer_date ?? getLocalDateInputValue()}
                  className="h-10 bg-white border-slate-200 rounded-xl text-xs"
                />
              </div>

              {/* Row 3 Left: Agreed price (optional) */}
              <div className="space-y-1.5">
                <Label htmlFor="purchase_price" className="text-xs font-semibold text-slate-700">
                  Agreed price (optional)
                </Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs pointer-events-none">
                    ₱
                  </span>
                  <Input
                    id="purchase_price"
                    name="purchase_price"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={editing?.purchase_price ?? ""}
                    placeholder="Enter agreed price"
                    className="pl-8 h-10 bg-white border-slate-200 rounded-xl text-xs placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Row 3 Right: Municipality / city */}
              <div className="space-y-1.5">
                <Label htmlFor="municipality" className="text-xs font-semibold text-slate-700">
                  Municipality / city
                </Label>
                <Input
                  id="municipality"
                  name="municipality"
                  required
                  defaultValue={editing?.municipality ?? "Padre Garcia"}
                  placeholder="Enter municipality or city"
                  className="h-10 bg-white border-slate-200 rounded-xl text-xs placeholder:text-slate-400"
                />
              </div>

              {/* Row 4 Left: Province */}
              <div className="space-y-1.5">
                <Label htmlFor="province" className="text-xs font-semibold text-slate-700">
                  Province
                </Label>
                <Input
                  id="province"
                  name="province"
                  required
                  defaultValue={editing?.province ?? "Batangas"}
                  placeholder="Enter province"
                  className="h-10 bg-white border-slate-200 rounded-xl text-xs placeholder:text-slate-400"
                />
              </div>

              {/* Row 4 Right: Sex & Age in 2 sub-columns */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sex_at_transfer" className="text-xs font-semibold text-slate-700">
                    Sex (optional)
                  </Label>
                  <Select
                    value={sexAtTransfer}
                    onValueChange={(val) => setSexAtTransfer(val)}
                  >
                    <SelectTrigger id="sex_at_transfer" className="h-10 bg-white border-slate-200 rounded-xl text-xs">
                      <SelectValue placeholder="Select sex" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="sex_at_transfer" value={sexAtTransfer} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="age_at_transfer" className="text-xs font-semibold text-slate-700">
                    Age (optional)
                  </Label>
                  <Input
                    id="age_at_transfer"
                    name="age_at_transfer"
                    defaultValue={editing?.age_at_transfer}
                    placeholder="Enter age"
                    className="h-10 bg-white border-slate-200 rounded-xl text-xs placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Row 5 Left: Description recorded on certificate (optional) */}
              <div className="space-y-1.5">
                <Label htmlFor="animal_description" className="text-xs font-semibold text-slate-700">
                  Description recorded on certificate (optional)
                </Label>
                <Input
                  id="animal_description"
                  name="animal_description"
                  defaultValue={editing?.animal_description}
                  placeholder="Enter description from certificate"
                  className="h-10 bg-white border-slate-200 rounded-xl text-xs placeholder:text-slate-400"
                />
              </div>

              {/* Row 5 Right: Municipality brand & Owner brand in 2 sub-columns */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="municipality_brand" className="text-xs font-semibold text-slate-700">
                    Municipality brand (optional)
                  </Label>
                  <Input
                    id="municipality_brand"
                    name="municipality_brand"
                    defaultValue={editing?.municipality_brand}
                    placeholder="Enter municipality brand"
                    className="h-10 bg-white border-slate-200 rounded-xl text-xs placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="owner_brand" className="text-xs font-semibold text-slate-700">
                    Owner brand (optional)
                  </Label>
                  <Input
                    id="owner_brand"
                    name="owner_brand"
                    defaultValue={editing?.owner_brand}
                    placeholder="Enter owner brand"
                    className="h-10 bg-white border-slate-200 rounded-xl text-xs placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Outside livestock extra fields */}
              {outsideLivestock && (
                <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-3 border-t border-blue-200/70">
                  <div className="space-y-1.5">
                    <Label htmlFor="external_seller_name" className="text-xs font-semibold text-slate-700">
                      Outside seller name
                    </Label>
                    <Input
                      id="external_seller_name"
                      name="external_seller_name"
                      required
                      maxLength={255}
                      defaultValue={editing?.external_seller_name}
                      placeholder="Enter seller name"
                      className="h-10 bg-white border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="external_seller_address" className="text-xs font-semibold text-slate-700">
                      Seller address
                    </Label>
                    <Input
                      id="external_seller_address"
                      name="external_seller_address"
                      required
                      defaultValue={editing?.external_seller_address}
                      placeholder="Enter seller address"
                      className="h-10 bg-white border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="external_livestock_type" className="text-xs font-semibold text-slate-700">
                      Animal type
                    </Label>
                    <Input
                      id="external_livestock_type"
                      name="external_livestock_type"
                      required
                      placeholder="e.g. Cattle, Carabao, Goat"
                      defaultValue={editing?.external_livestock_type}
                      className="h-10 bg-white border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="external_livestock_tag_number" className="text-xs font-semibold text-slate-700">
                      Seller tag / identifying mark (optional)
                    </Label>
                    <Input
                      id="external_livestock_tag_number"
                      name="external_livestock_tag_number"
                      defaultValue={editing?.external_livestock_tag_number}
                      placeholder="e.g. Ear tag, Brand"
                      className="h-10 bg-white border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="origin_municipality" className="text-xs font-semibold text-slate-700">
                      Animal origin municipality
                    </Label>
                    <Input
                      id="origin_municipality"
                      name="origin_municipality"
                      required
                      defaultValue={editing?.origin_municipality}
                      placeholder="Enter origin municipality"
                      className="h-10 bg-white border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="origin_province" className="text-xs font-semibold text-slate-700">
                      Animal origin province
                    </Label>
                    <Input
                      id="origin_province"
                      name="origin_province"
                      required
                      defaultValue={editing?.origin_province}
                      placeholder="Enter origin province"
                      className="h-10 bg-white border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Non-registered buyer address */}
              {ownerType !== "REGISTERED_FARMER" && (
                <div className="col-span-full space-y-1.5">
                  <Label htmlFor="external_owner_address" className="text-xs font-semibold text-slate-700">
                    Buyer address
                  </Label>
                  <Input
                    id="external_owner_address"
                    name="external_owner_address"
                    required
                    defaultValue={editing?.external_owner_address}
                    placeholder="Enter complete buyer address"
                    className="h-10 bg-white border-slate-200 rounded-xl text-xs"
                  />
                </div>
              )}
            </div>

            {/* Bottom Right Submit Button */}
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={
                  (!outsideLivestock && (!farmer || !selectedAnimalIds.length)) ||
                  (ownerType === "REGISTERED_FARMER" && !buyer) ||
                  submit.isPending ||
                  isLoadingAnimals
                }
                className="bg-[#0F5A3B] hover:bg-[#0B482E] text-white font-bold text-xs h-10 px-5 rounded-xl shadow-xs gap-2"
              >
                <FileText className="size-4" />
                {submit.isPending
                  ? "Saving…"
                  : editing
                  ? "Correct and resubmit"
                  : outsideLivestock
                  ? "Record outside animal transfer"
                  : `Record animals`}
              </Button>
            </div>
          </form>
        </div>

        {/* Bottom Card: Records entered by your account */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="shrink-0 rounded-xl bg-[#EDE4FF] text-[#7C3AED] p-2 flex items-center justify-center">
                <FileText className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 leading-tight">
                  Records entered by your account
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  List of ownership transfers you have encoded.
                </p>
              </div>
            </div>
            <Link
              href="/auction-ownership-transfers/registry"
              className="text-xs font-bold text-[#7C3AED] hover:text-[#6D28D9] flex items-center gap-1 group transition-colors"
            >
              <span>View All Records</span>
              <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {isLoading && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
              Loading records…
            </div>
          )}

          {isError && (
            <Alert variant="destructive" className="rounded-xl">
              <AlertDescription>
                {getOwnershipTransferLoadError(transfersError, "Could not load your ownership-transfer records.")}
              </AlertDescription>
            </Alert>
          )}

          {!isLoading && !isError && transfers.length === 0 && (
            <div className="rounded-xl border border-slate-200/70 bg-slate-50/50 p-6 flex items-center justify-center gap-2.5 text-slate-500 text-xs font-medium">
              <FileText className="size-4 text-slate-400" />
              <span>No ownership transfers have been entered from this account.</span>
            </div>
          )}

          {!isLoading && !isError && transfers.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {transfers.slice(0, 6).map((transfer) => (
                <Card
                  key={transfer.id}
                  className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden"
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-xs text-slate-900">
                          {transfer.livestock_type_name} ·{" "}
                          {transfer.livestock_tag ||
                            (transfer.livestock ? `#${transfer.livestock}` : "Outside livestock")}
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {transfer.previous_owner_name} → {transfer.new_owner_name}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {transfer.status.replaceAll("_", " ")}
                      </Badge>
                    </div>

                    <div className="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-slate-100">
                      <p>Certificate: {transfer.transfer_certificate_number} · Date: {transfer.transfer_date}</p>
                      {transfer.purchase_price && (
                        <p className="font-semibold text-emerald-800">
                          Agreed price: ₱{Number(transfer.purchase_price).toLocaleString()}
                        </p>
                      )}
                    </div>

                    {transfer.can_edit && (
                      <div className="pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isLoadingAnimals}
                          onClick={() => void correctReturnedTransfer(transfer)}
                          className="h-8 text-xs border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                        >
                          Correct and resubmit
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* User Guide Dialog */}
      <Dialog open={showUserGuide} onOpenChange={setShowUserGuide}>
        <DialogContent className="max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-2.5 text-[#0F4A2F]">
              <BookOpen className="size-5" />
              <DialogTitle className="text-base font-bold text-slate-900">
                Ownership Transfers Guide
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              How to encode official ownership transfers at Padre Garcia Livestock Auction Market.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 pt-2 text-xs text-slate-700">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-1">
              <p className="font-bold text-emerald-950 flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-700" />
                Step 1: Identify the Seller & Animals
              </p>
              <p className="text-[11px] text-emerald-900">
                Use <strong>Find Farmer</strong> or <strong>Scan Farmer QR</strong> to locate the seller. Select the animals sold and confirm each original certificate number. For non-resident sellers, choose <em>Outside livestock</em>.
              </p>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-1">
              <p className="font-bold text-blue-950 flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-blue-700" />
                Step 2: Enter Certificate & Buyer Details
              </p>
              <p className="text-[11px] text-blue-900">
                Choose the buyer type (Registered SmartLivestock Farmer or External). Fill out the paper certificate number, transaction date, agreed purchase price, and physical markings.
              </p>
            </div>

            <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3 space-y-1">
              <p className="font-bold text-purple-950 flex items-center gap-1.5">
                <Info className="size-4 text-purple-700" />
                Step 3: Verification & Official Record
              </p>
              <p className="text-[11px] text-purple-900">
                Click <strong>Record animals</strong>. Once recorded, the transfer is submitted to MAO for approval, updating the official registry and livestock inventory upon confirmation.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Scanner Dialog */}
      <UniversalQrScannerDialog
        isOpen={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        role="auction"
        onSelectFarmer={(farmerId) => {
          if (scannerTarget === "seller") void selectFarmerById(farmerId);
          else void selectBuyerById(farmerId);
        }}
      />
    </div>
  );
}
