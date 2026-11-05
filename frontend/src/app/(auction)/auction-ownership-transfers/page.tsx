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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HeaderNotifications } from "@/app/components/header-notifications";
import { AuctionTelemetryBanner } from "@/app/components/auction-telemetry-banner";
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
  Clock,
  FileCheck,
  FileText,
  Info,
  QrCode,
  Search,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

type OwnerType = "REGISTERED_FARMER" | "EXTERNAL_INDIVIDUAL" | "COMPANY" | "TRADER" | "OTHER";
type LivestockTypeOption = { id: number; name: string };
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
  weight: string | null;
  age: string | null;
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
  breed_at_transfer: string;
  weight_at_transfer_kg: string | null;
  sex_at_transfer: string;
  age_at_transfer: string;
  municipality_brand: string;
  owner_brand: string;
  can_edit: boolean;
};

type OwnershipTransferSubmission = {
  values: Record<string, FormDataEntryValue | null>;
  transferId?: number;
  animalCount: number;
  buyerName: string;
  isCorrection: boolean;
  isOutsideLivestock: boolean;
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

function TransferFieldLabel({
  htmlFor,
  label,
  help,
}: {
  htmlFor: string;
  label: string;
  help: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-semibold text-slate-700">
        {label}
      </Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Help: ${label.replace(/\s*\(optional\)$/i, "")}`}
            className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <Info className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-xs leading-relaxed">
          {help}
        </TooltipContent>
      </Tooltip>
    </div>
  );
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
  const [isAnimalModalOpen, setIsAnimalModalOpen] = useState(false);
  const [originalCertificates, setOriginalCertificates] = useState<Record<number, string>>({});
  const [lookupError, setLookupError] = useState("");
  const [isSearchingFarmers, setIsSearchingFarmers] = useState(false);
  const [isSearchingBuyers, setIsSearchingBuyers] = useState(false);
  const [isLoadingAnimals, setIsLoadingAnimals] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<"seller" | "buyer">("seller");
  const [ownerType, setOwnerType] = useState<OwnerType>("REGISTERED_FARMER");
  const [externalLivestockType, setExternalLivestockType] = useState("");
  const [sexAtTransfer, setSexAtTransfer] = useState<string>("");
  const [ageAtTransfer, setAgeAtTransfer] = useState<string>("");
  const [breedAtTransfer, setBreedAtTransfer] = useState<string>("");
  const [weightAtTransfer, setWeightAtTransfer] = useState<string>("");
  const [editing, setEditing] = useState<Transfer | null>(null);
  const [outsideLivestock, setOutsideLivestock] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState<OwnershipTransferSubmission | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState("");
  const selectedAnimalForTransfer = !outsideLivestock && selectedAnimalIds.length === 1
    ? farmerAnimals.find((animal) => animal.id === selectedAnimalIds[0]) ?? null
    : null;

  const {
    data: externalLivestockTypes = [],
    isLoading: isLoadingExternalLivestockTypes,
    isError: externalLivestockTypesFailed,
  } = useQuery({
    queryKey: ["ownership-transfer-livestock-types"],
    queryFn: async () => {
      const { data } = await api.get<LivestockTypeOption[]>("livestock/livestock_types/");
      return data.filter((type) => !type.name.toLowerCase().includes("swine"));
    },
  });

  function autofillAnimalTraits(animal: FarmerAnimal | null) {
    if (!animal) {
      setSexAtTransfer("");
      setAgeAtTransfer("");
      setBreedAtTransfer("");
      setWeightAtTransfer("");
      return;
    }
    if (animal.sex) {
      const upper = animal.sex.toUpperCase();
      setSexAtTransfer(upper === "MALE" || upper === "FEMALE" ? upper : animal.sex);
    }
    setAgeAtTransfer(animal.age || "");
    setBreedAtTransfer(animal.breed || "");
    setWeightAtTransfer(animal.weight ? String(animal.weight) : "");
  }

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
      if (selectedAnimal?.transfer_eligible) {
        setSelectedAnimalIds([selectedAnimal.id]);
        if (!editing) autofillAnimalTraits(selectedAnimal);
      } else {
        setSelectedAnimalIds([]);
      }
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
      if (!response.data.length) {
        setLookupError("This Farmer has no active individual livestock available to review.");
      } else if (!selectedAnimalId) {
        setIsAnimalModalOpen(true);
      }
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
    mutationFn: async ({ values: submittedValues, transferId }: OwnershipTransferSubmission) => {
      if (!outsideLivestock && (!farmer || !selectedAnimalIds.length)) {
        throw new Error("Select a Farmer and at least one eligible animal first.");
      }
      if (ownerType === "REGISTERED_FARMER" && !buyer) {
        throw new Error("Find and select the registered buyer first.");
      }
      const values: Record<string, FormDataEntryValue | null> = { ...submittedValues };
      if (ownerType === "REGISTERED_FARMER" && buyer) values.new_owner_identifier = buyer.username;
      if (!values.purchase_price) delete values.purchase_price;
      if (!values.weight_at_transfer_kg) values.weight_at_transfer_kg = null;
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
    onSuccess: async (_data, submission) => {
      await queryClient.invalidateQueries({ queryKey: ["auction-ownership-transfers"] });
      await queryClient.invalidateQueries({ queryKey: ["ownership-transfers"] });
      setSubmissionSuccess(
        submission.isCorrection
          ? "Your corrected ownership transfer has been sent to MAO for review."
          : submission.isOutsideLivestock
          ? "The outside-animal transfer has been recorded and sent to MAO. It remains outside local livestock inventory."
          : `The transfer certificate for ${submission.animalCount} animal${submission.animalCount === 1 ? "" : "s"} has been sent to MAO for review.`
      );
      setFarmer(null);
      setFarmerAnimals([]);
      setSelectedAnimalIds([]);
      setFarmerSearch("");
      setBuyerSearch("");
      setBuyer(null);
      setBuyerResults([]);
      setOwnerType("REGISTERED_FARMER");
      setExternalLivestockType("");
      setSexAtTransfer("");
      setAgeAtTransfer("");
      setBreedAtTransfer("");
      setWeightAtTransfer("");
      setEditing(null);
      setOutsideLivestock(false);
    },
    onError: () => toast.error("Could not record this transfer. Check the seller, animals, and certificate details."),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (outsideLivestock && !externalLivestockType.trim()) {
      toast.error("Choose an animal type before recording this outside livestock transfer.");
      return;
    }
    const values: Record<string, FormDataEntryValue | null> = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    setPendingSubmission({
      values,
      transferId: editing?.id,
      animalCount: outsideLivestock ? 1 : selectedAnimalIds.length,
      buyerName: ownerType === "REGISTERED_FARMER" ? buyer?.name || "Registered buyer" : String(values.external_owner_name || "External buyer"),
      isCorrection: Boolean(editing),
      isOutsideLivestock: outsideLivestock,
    });
  }

  function confirmTransferSubmission() {
    if (!pendingSubmission) return;
    submit.mutate(pendingSubmission);
    setPendingSubmission(null);
  }

  async function correctReturnedTransfer(transfer: Transfer) {
    setIsLoadingAnimals(true);
    setLookupError("");
    if (!transfer.livestock || !transfer.previous_owner) {
      setOutsideLivestock(true);
      setEditing(transfer);
      setOwnerType(transfer.owner_type);
      setExternalLivestockType(
        transfer.external_livestock_type.toLowerCase().includes("swine")
          ? ""
          : transfer.external_livestock_type || ""
      );
      setSexAtTransfer(transfer.sex_at_transfer || "");
      setAgeAtTransfer(transfer.age_at_transfer || "");
      setBreedAtTransfer(transfer.breed_at_transfer || "");
      setWeightAtTransfer(transfer.weight_at_transfer_kg ? String(transfer.weight_at_transfer_kg) : "");
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
      setExternalLivestockType("");
      setSexAtTransfer(transfer.sex_at_transfer || "");
      setAgeAtTransfer(transfer.age_at_transfer || "");
      setBreedAtTransfer(transfer.breed_at_transfer || "");
      setWeightAtTransfer(transfer.weight_at_transfer_kg ? String(transfer.weight_at_transfer_kg) : "");
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
    setSelectedAnimalIds((current) => {
      const next = checked ? [...current, animalId] : current.filter((id) => id !== animalId);
      if (next.length === 1) {
        const singleAnimal = farmerAnimals.find((a) => a.id === next[0]);
        if (singleAnimal) autofillAnimalTraits(singleAnimal);
      } else if (next.length === 0) {
        autofillAnimalTraits(null);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-transparent pb-16">
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
          </div>
        </div>
      </div>
      <AuctionTelemetryBanner />

      {/* Main Container */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* Breadcrumb line */}
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Link href="/auction" className="hover:text-slate-800 transition-colors">
            SmartLivestock
          </Link>
          <span className="text-slate-400">/</span>
          <Link href="/auction-ownership-transfers/registry" className="hover:text-slate-800 transition-colors">
            Transfer Records
          </Link>
          <span className="text-slate-400">/</span>
          <span className="text-slate-900 font-bold">Record Transfer</span>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center justify-between gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs h-9 px-3.5 rounded-xl shadow-xs gap-1.5"
          >
            <Link href="/auction-ownership-transfers/registry">
              <ArrowLeft className="size-4" />
              Back to Transfer Records
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

        {/* Emerald Callout Card */}
        <div className="rounded-2xl border border-[#D4F1E1] bg-[#F0FAF4] p-4 flex items-center gap-3.5 shadow-xs">
          <div className="shrink-0 rounded-xl bg-[#E3F6EC] text-[#0F5A38] p-2.5 flex items-center justify-center">
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
            <div className="space-y-1.5">
              <TransferFieldLabel
                htmlFor="farmer-search"
                label="Find the registered seller"
                help="Search for the Farmer who sold the animal by name, email, username, RSBSA number, or Farmer ID."
              />
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
                      setIsAnimalModalOpen(false);
                      autofillAnimalTraits(null);
                    }}
                    className="h-8 text-xs text-slate-600 hover:text-slate-900"
                  >
                    Choose another Farmer
                  </Button>
                )}
              </div>

              {/* Livestock Selection Summary Card */}
              <div className="rounded-xl border border-emerald-200/90 bg-white p-3.5 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800">Farmer livestock and sale intent</h3>
                    <p className="text-[11px] text-slate-500">
                      {isLoadingAnimals
                        ? "Loading this Farmer's eligible livestock…"
                        : selectedAnimalIds.length === 0
                        ? "No livestock selected yet. Choose eligible animals from this farmer."
                        : `${selectedAnimalIds.length} animal${selectedAnimalIds.length === 1 ? "" : "s"} selected for transfer`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setIsAnimalModalOpen(true)}
                    disabled={isLoadingAnimals || farmerAnimals.length === 0}
                    className="h-8 text-xs font-bold bg-[#0F4A2F] text-white hover:bg-[#0B3D26] shadow-xs cursor-pointer"
                  >
                    {selectedAnimalIds.length === 0 ? "Select livestock" : `Change selection (${selectedAnimalIds.length})`}
                  </Button>
                </div>

                {isLoadingAnimals && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                    Loading this Farmer&apos;s eligible livestock…
                  </div>
                )}

                {!isLoadingAnimals && farmerAnimals.length === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 text-center">
                    This Farmer has no active individual livestock available to review.
                  </div>
                )}

                {!isLoadingAnimals && selectedAnimalIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {selectedAnimalIds.map((id) => {
                      const animal = farmerAnimals.find((a) => a.id === id);
                      if (!animal) return null;
                      return (
                        <div
                          key={`selected-chip-${id}`}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-xs text-emerald-950 font-medium"
                        >
                          <span>{animal.livestock_type_name} · {animal.tag_number || `#${animal.id}`}</span>
                          <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-white text-emerald-800 border-emerald-200">
                            {animal.registration_status.replaceAll("_", " ")}
                          </Badge>
                          <button
                            type="button"
                            onClick={() => toggleAnimal(id, false)}
                            className="text-emerald-700 hover:text-emerald-900 ml-0.5 font-bold text-sm leading-none cursor-pointer"
                            aria-label={`Remove ${animal.tag_number || `#${animal.id}`}`}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

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
                        <TransferFieldLabel
                          htmlFor={`original-certificate-${id}`}
                          label={`${animal.livestock_type_name} ${animal.tag_number || `#${id}`} certificate`}
                          help="Enter the number from this animal's original ownership certificate, not the new transfer certificate."
                        />
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
                <TransferFieldLabel
                  htmlFor="owner_type"
                  label="Buyer type"
                  help="Choose Registered SmartLivestock Farmer if the buyer has an approved Farmer account. Choose an external type for a buyer without one."
                />
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
                    <TransferFieldLabel
                      htmlFor="buyer-search"
                      label="Find the registered buyer"
                      help="Search using the buyer's name, email, username, RSBSA number, or Farmer ID, then select the matching approved Farmer."
                    />
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
                    <TransferFieldLabel
                      htmlFor="external_owner_name"
                      label="Buyer / organization name"
                      help="Enter the external buyer's individual or organization name as shown on the transfer certificate."
                    />
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
                <TransferFieldLabel
                  htmlFor="transfer_certificate_number"
                  label="Paper transfer certificate number"
                  help="Enter the number printed on the completed transfer certificate. One certificate may cover several animals."
                />
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
                <TransferFieldLabel
                  htmlFor="transfer_date"
                  label="Transfer date"
                  help="Enter the date the ownership transfer actually happened. Future dates are not allowed."
                />
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
                <TransferFieldLabel
                  htmlFor="purchase_price"
                  label="Agreed price (optional)"
                  help="Enter the recorded sale price for this animal in Philippine pesos. Leave blank if the price is unknown or not documented."
                />
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
                <TransferFieldLabel
                  htmlFor="municipality"
                  label="Municipality / city"
                  help="Enter the municipality or city recorded for this transfer."
                />
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
                <TransferFieldLabel
                  htmlFor="province"
                  label="Province"
                  help="Enter the province recorded for this transfer."
                />
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
                  <TransferFieldLabel
                    htmlFor="sex_at_transfer"
                    label="Sex (optional)"
                    help="Select the animal's sex at the time of transfer. Leave blank if it is not known."
                  />
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
                  <TransferFieldLabel
                    htmlFor="age_at_transfer"
                    label="Age (optional)"
                    help="Enter the animal's age at the time of transfer, using the age stated or verified for the sale."
                  />
                  <Input
                    id="age_at_transfer"
                    name="age_at_transfer"
                    value={ageAtTransfer}
                    onChange={(e) => setAgeAtTransfer(e.target.value)}
                    placeholder="Enter age"
                    className="h-10 bg-white border-slate-200 rounded-xl text-xs placeholder:text-slate-400"
                  />
                </div>
              </div>

              {(outsideLivestock || selectedAnimalIds.length === 1) ? (
                <div
                  key={outsideLivestock ? `external-${editing?.id ?? "new"}` : `animal-${selectedAnimalForTransfer?.id ?? "none"}`}
                  className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3"
                >
                  <div className="space-y-1.5">
                    <TransferFieldLabel
                      htmlFor="breed_at_transfer"
                      label="Breed at transfer (optional)"
                      help="Enter the animal's breed at the time of sale. For a registered animal, correct the prefilled breed if it differed at transfer."
                    />
                    <Input
                      id="breed_at_transfer"
                      name="breed_at_transfer"
                      maxLength={50}
                      value={breedAtTransfer}
                      onChange={(e) => setBreedAtTransfer(e.target.value)}
                      placeholder="e.g. Brahman, Angus, Native"
                      className="h-10 bg-white border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <TransferFieldLabel
                      htmlFor="weight_at_transfer_kg"
                      label="Weight at transfer in kg (optional)"
                      help="Enter the animal's measured weight in kilograms at the time of sale. Leave blank if it was not measured or confirmed."
                    />
                    <Input
                      id="weight_at_transfer_kg"
                      name="weight_at_transfer_kg"
                      type="number"
                      min="0"
                      step="0.01"
                      value={weightAtTransfer}
                      onChange={(e) => setWeightAtTransfer(e.target.value)}
                      placeholder="Enter measured weight"
                      className="h-10 bg-white border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                  <p className="col-span-full text-[11px] leading-relaxed text-slate-500">
                    {outsideLivestock
                      ? "Enter traits known at the sale; leave a field blank if it was not measured or confirmed."
                      : "Values start from the selected animal record. Confirm they match the sale; update them if the animal's traits changed."}
                  </p>
                </div>
              ) : selectedAnimalIds.length > 1 ? (
                <p className="col-span-full rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                  For a same-day multi-animal transfer, each record takes its own breed and weight from its linked animal. For a backdated transfer, record animals individually to enter their sale-time traits.
                </p>
              ) : null}

              {/* Row 5 Left: Description recorded on certificate (optional) */}
              <div className="space-y-1.5">
                <TransferFieldLabel
                  htmlFor="animal_description"
                  label="Description recorded on certificate (optional)"
                  help="Copy any animal description or identifying notes written on the transfer certificate."
                />
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
                  <TransferFieldLabel
                    htmlFor="municipality_brand"
                    label="Municipality brand (optional)"
                    help="Enter the municipality's identifying brand or mark if it appears on the animal or transfer certificate. Leave blank if none is recorded."
                  />
                  <Input
                    id="municipality_brand"
                    name="municipality_brand"
                    defaultValue={editing?.municipality_brand}
                    placeholder="Enter municipality brand"
                    className="h-10 bg-white border-slate-200 rounded-xl text-xs placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <TransferFieldLabel
                    htmlFor="owner_brand"
                    label="Owner brand (optional)"
                    help="Enter the owner's identifying brand or mark if it appears on the animal or transfer certificate. Leave blank if none is recorded."
                  />
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
                    <TransferFieldLabel
                      htmlFor="external_seller_name"
                      label="Outside seller name"
                      help="Enter the person or business that sold the animal. Match the name on the certificate when available."
                    />
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
                    <TransferFieldLabel
                      htmlFor="external_seller_address"
                      label="Seller address"
                      help="Enter the seller's address as shown on the certificate or transaction record."
                    />
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
                    <TransferFieldLabel
                      htmlFor="external_livestock_type"
                      label="Animal type"
                      help="Choose the animal's species from the livestock list. Swine is not available for outside transfers."
                    />
                    <Select
                      value={externalLivestockType}
                      onValueChange={setExternalLivestockType}
                      disabled={
                        isLoadingExternalLivestockTypes ||
                        (externalLivestockTypes.length === 0 && !externalLivestockType)
                      }
                    >
                      <SelectTrigger id="external_livestock_type" className="h-10 bg-white border-slate-200 rounded-xl text-xs">
                        <SelectValue
                          placeholder={
                            isLoadingExternalLivestockTypes ? "Loading animal types..." : "Select animal type"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {externalLivestockTypes.map((type) => (
                          <SelectItem key={type.id} value={type.name}>
                            {type.name}
                          </SelectItem>
                        ))}
                        {editing?.external_livestock_type &&
                          !editing.external_livestock_type.toLowerCase().includes("swine") &&
                          !externalLivestockTypes.some(
                            (type) => type.name.toLowerCase() === editing.external_livestock_type.toLowerCase()
                          ) && (
                            <SelectItem value={editing.external_livestock_type}>
                              {editing.external_livestock_type} (current record)
                            </SelectItem>
                          )}
                      </SelectContent>
                    </Select>
                    <input
                      type="hidden"
                      name="external_livestock_type"
                      value={externalLivestockType}
                    />
                    {externalLivestockTypesFailed && (
                      <p className="text-[11px] text-red-600">Could not load animal types. Please reload and try again.</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <TransferFieldLabel
                      htmlFor="external_livestock_tag_number"
                      label="Seller tag / identifying mark (optional)"
                      help="Enter the seller's ear tag, brand, or other identifying mark if known."
                    />
                    <Input
                      id="external_livestock_tag_number"
                      name="external_livestock_tag_number"
                      defaultValue={editing?.external_livestock_tag_number}
                      placeholder="e.g. Ear tag, Brand"
                      className="h-10 bg-white border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <TransferFieldLabel
                      htmlFor="origin_municipality"
                      label="Animal origin municipality"
                      help="Enter the municipality where the animal came from, as recorded for this transfer."
                    />
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
                    <TransferFieldLabel
                      htmlFor="origin_province"
                      label="Animal origin province"
                      help="Enter the province where the animal came from, as recorded for this transfer."
                    />
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
                  <TransferFieldLabel
                    htmlFor="external_owner_address"
                    label="Buyer address"
                    help="Enter the buyer's complete address as recorded for the transfer."
                  />
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
              <div className="shrink-0 rounded-xl bg-[#E3F6EC] text-[#0F5A38] p-2 flex items-center justify-center">
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
              className="text-xs font-bold text-[#0F5A38] hover:text-[#0c482d] flex items-center gap-1 group transition-colors"
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
                      {(transfer.breed_at_transfer || transfer.weight_at_transfer_kg) && (
                        <p>
                          At transfer: {transfer.breed_at_transfer || "Breed not recorded"} ·{" "}
                          {transfer.weight_at_transfer_kg
                            ? `${Number(transfer.weight_at_transfer_kg).toLocaleString()} kg`
                            : "Weight not recorded"}
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

      {/* Livestock Selection Popup Dialog */}
      <Dialog open={isAnimalModalOpen} onOpenChange={setIsAnimalModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Farmer livestock and sale intent
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Select eligible livestock from {farmer?.name}&apos;s inventory to include in this ownership transfer.
                </DialogDescription>
              </div>
              {farmerAnimals.some((a) => a.transfer_eligible) && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const eligible = farmerAnimals.filter((a) => a.transfer_eligible);
                      const eligibleIds = eligible.map((a) => a.id);
                      setSelectedAnimalIds(eligibleIds);
                      if (eligible.length === 1) {
                        autofillAnimalTraits(eligible[0]);
                      }
                    }}
                    className="h-7 text-[11px] bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-medium"
                  >
                    Select all eligible
                  </Button>
                  {selectedAnimalIds.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedAnimalIds([]);
                        autofillAnimalTraits(null);
                      }}
                      className="h-7 text-[11px] text-slate-600 hover:text-slate-900"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="p-4 sm:p-5 overflow-y-auto space-y-2 flex-1">
            {isLoadingAnimals && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
                Loading this Farmer&apos;s eligible livestock…
              </div>
            )}

            {!isLoadingAnimals && farmerAnimals.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                This Farmer has no active individual livestock available to review.
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
                        {animal.breed ? ` · ${animal.breed}` : ""}{animal.age ? ` · ${animal.age}` : ""}{animal.weight ? ` · ${animal.weight} kg` : ""} · Ownership certificate:{" "}
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
          </div>

          <DialogFooter className="p-3 sm:p-4 px-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between sm:justify-between shrink-0">
            <span className="text-xs text-slate-600 font-medium">
              {selectedAnimalIds.length} animal{selectedAnimalIds.length === 1 ? "" : "s"} selected
            </span>
            <Button
              type="button"
              onClick={() => setIsAnimalModalOpen(false)}
              className="bg-[#0F4A2F] text-white hover:bg-[#0B3D26] text-xs font-bold rounded-xl h-9 px-5 cursor-pointer"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingSubmission !== null} onOpenChange={(open) => {
        if (!open && !submit.isPending) setPendingSubmission(null);
      }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{pendingSubmission?.isCorrection ? "Resubmit this ownership transfer?" : "Submit this ownership transfer?"}</DialogTitle>
            <DialogDescription>
              This record will be sent to MAO for review. It becomes an official ownership record only after approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <p><span className="font-semibold text-slate-500">Seller:</span> <span className="font-bold text-slate-900">{pendingSubmission?.isOutsideLivestock ? String(pendingSubmission.values.external_seller_name || "Outside seller") : farmer?.name || "Selected farmer"}</span></p>
            <p><span className="font-semibold text-slate-500">Buyer:</span> <span className="font-bold text-slate-900">{pendingSubmission?.buyerName || "Selected buyer"}</span></p>
            <p><span className="font-semibold text-slate-500">Animals:</span> <span className="font-bold text-slate-900">{pendingSubmission?.animalCount ?? 0}</span></p>
            <p><span className="font-semibold text-slate-500">Certificate:</span> <span className="font-bold text-slate-900">{String(pendingSubmission?.values.transfer_certificate_number || "Not provided")}</span></p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={submit.isPending} onClick={() => setPendingSubmission(null)} className="rounded-xl">Review details</Button>
            <Button type="button" disabled={submit.isPending} onClick={confirmTransferSubmission} className="rounded-xl bg-[#0F5A38] text-white hover:bg-[#0c482d]">
              {submit.isPending ? "Sending…" : "Confirm and send"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(submissionSuccess)} onOpenChange={(open) => {
        if (!open) setSubmissionSuccess("");
      }}>
        <DialogContent className="max-w-md rounded-2xl text-center">
          <div className="mx-auto flex size-20 animate-[bounce_700ms_ease-in-out_1] items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="size-11" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-center">Ownership transfer submitted</DialogTitle>
            <DialogDescription className="text-center">{submissionSuccess}</DialogDescription>
          </DialogHeader>
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900">
            You can follow its review status in the records list.
          </p>
          <Button type="button" onClick={() => setSubmissionSuccess("")} className="mx-auto min-h-10 rounded-xl bg-[#0F5A38] px-6 text-white hover:bg-[#0c482d]">Done</Button>
        </DialogContent>
      </Dialog>

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

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-1">
              <p className="font-bold text-emerald-950 flex items-center gap-1.5">
                <Info className="size-4 text-emerald-700" />
                Step 3: Verification & Official Record
              </p>
              <p className="text-[11px] text-emerald-900">
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
