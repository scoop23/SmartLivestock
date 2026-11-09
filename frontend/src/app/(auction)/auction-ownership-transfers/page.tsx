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
import { PageHeader } from "@/app/components/page-header";
import { UniversalQrScannerDialog } from "@/components/universal-qr-scanner-dialog";
import { httpError } from "@/lib/http-error";
import api from "@/lib/axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { cowHead } from "@lucide/lab";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Database,
  Eye,
  FileCheck,
  FileText,
  Icon,
  Info,
  Pencil,
  Printer,
  QrCode,
  Save,
  Search,
  Sparkles,
  Truck,
  User,
  X,
} from "lucide-react";
import { OwnershipTransferCertificateDialog } from "@/app/components/ownership-transfer-certificate-dialog";
import { useEffect, useRef, useState, type FormEvent } from "react";
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
type TransferTraits = {
  sex_at_transfer: string; age_at_transfer: string; breed_at_transfer: string;
  weight_at_transfer_kg: string; animal_description: string; municipality_brand: string; owner_brand: string;
};
function recordedTraits(animal: FarmerAnimal): TransferTraits {
  return {
    sex_at_transfer: ["MALE", "FEMALE"].includes(animal.sex?.toUpperCase()) ? animal.sex.toUpperCase() : "",
    age_at_transfer: animal.age || "", breed_at_transfer: animal.breed || "",
    weight_at_transfer_kg: animal.weight || "",
    animal_description: "",
    municipality_brand: "", owner_brand: "",
  };
}
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


const CowHeadIcon = ({ className }: { className?: string }) => (
  <Icon iconNode={cowHead} className={className} />
);

function formatTransferDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Not specified";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
  }
  return dateStr;
}

function renderTransferStatus(status: string) {
  const norm = (status || "").toUpperCase();
  if (norm === "APPROVED" || norm === "COMPLETED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <Check className="size-3 text-emerald-600" />
        <span>Approved</span>
      </span>
    );
  }
  if (norm.includes("PENDING") || norm === "SUBMITTED" || norm === "FOR_REVIEW") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
        <Clock className="size-3 text-amber-600" />
        <span>Pending MAO Review</span>
      </span>
    );
  }
  if (norm.includes("REJECT") || norm.includes("RETURN")) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
        <X className="size-3 text-rose-600" />
        <span>Returned / Rejected</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
      <span>{status.replaceAll("_", " ")}</span>
    </span>
  );
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
  const [animalDescription, setAnimalDescription] = useState("");
  const [animalTraits, setAnimalTraits] = useState<Record<number, TransferTraits>>({});
  const [editing, setEditing] = useState<Transfer | null>(null);
  const [outsideLivestock, setOutsideLivestock] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);
  const [viewTransfer, setViewTransfer] = useState<Transfer | null>(null);
  const [certificateTarget, setCertificateTarget] = useState<Transfer | null>(null);
  const [pendingSubmission, setPendingSubmission] = useState<OwnershipTransferSubmission | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState("");
  const sellerAnimalRef = useRef<HTMLDivElement>(null);
  const [isPreregistrationHighlighted, setIsPreregistrationHighlighted] = useState(false);
  const [showOutsideConfirmModal, setShowOutsideConfirmModal] = useState(false);
  const selectedAnimalForTransfer = !outsideLivestock && selectedAnimalIds.length === 1
    ? farmerAnimals.find((animal) => animal.id === selectedAnimalIds[0]) ?? null
    : null;

  function handleSelectOutsideLivestock() {
    if (outsideLivestock) return;
    const hasSelectedData = Boolean(
      farmer || selectedAnimalIds.length > 0 || preregistrationReference
    );
    if (hasSelectedData) {
      setShowOutsideConfirmModal(true);
      return;
    }
    confirmSwitchToOutside();
  }

  function confirmSwitchToOutside() {
    setOutsideLivestock(true);
    setFarmer(null);
    setFarmerAnimals([]);
    setSelectedAnimalIds([]);
    setAnimalTraits({});
    setPreregistrationReference("");
    setIsPreregistrationHighlighted(false);
    setShowOutsideConfirmModal(false);
    setShowAdditionalDetails(true);
  }

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
      setAnimalDescription("");
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
    setAnimalDescription(recordedTraits(animal).animal_description);
    setSexAtTransfer(recordedTraits(animal).sex_at_transfer);
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

  const { data: nextCertData, refetch: refetchNextCert } = useQuery({
    queryKey: ["next-transfer-certificate-number"],
    queryFn: async () => (await api.get<{ certificate_number: string }>("livestock/ownership-transfers/next-certificate-number/")).data,
    staleTime: 10000,
  });

  const [usePaperBooklet, setUsePaperBooklet] = useState(false);
  const [manualCertNumber, setManualCertNumber] = useState("");
  const [preregistrationReference, setPreregistrationReference] = useState("");
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("preregistration");
    if (!id || !/^\d+$/.test(id)) return;
    setIsPreregistrationHighlighted(true);
    let cancelled = false;
    void (async () => {
      try {
        const { data: registration } = await api.get<{ reference: string; farmer_id: number; livestock: number; original_certificate_number: string; registration_status: string }>(`production/dispositions/${id}/`);
        if (cancelled) return;
        if (registration.registration_status !== "CHECKED") {
          setLookupError("Complete the arrival and physical checks on the preregistration page first.");
          return;
        }
        const { data: seller } = await api.get<FarmerLookup>(`livestock/ownership-transfer-farmers/${registration.farmer_id}/`);
        if (cancelled) return;
        setOutsideLivestock(false);
        setPreregistrationReference(registration.reference);
        await loadFarmerAnimals(seller, registration.livestock, registration.original_certificate_number, true);
        if (!cancelled) {
          setTimeout(() => {
            sellerAnimalRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 400);
        }
      } catch {
        if (!cancelled) setLookupError("Could not load the preregistration. Return to Auction Preregistrations and try again.");
      }
    })();
    return () => { cancelled = true; };
    // This is an initial route handoff, not a response to form edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadFarmerAnimals(seller: FarmerLookup, selectedAnimalId?: number, originalCertificate?: string, forceNew = false) {
    setFarmer(seller);
    setBuyer(null);
    setBuyerResults([]);
    setFarmerResults([]);
    setLookupError("");
    setIsLoadingAnimals(true);
    setFarmerAnimals([]);
    setSelectedAnimalIds([]);
    setAnimalTraits({});
    setOriginalCertificates({});
    try {
      const response = await api.get<FarmerAnimal[]>(`livestock/ownership-transfer-farmers/${seller.id}/livestock/`);
      setFarmerAnimals(response.data);
      const selectedAnimal = response.data.find((animal) => animal.id === selectedAnimalId);
      if (selectedAnimal?.transfer_eligible) {
        setSelectedAnimalIds([selectedAnimal.id]);
        if (!editing || forceNew) autofillAnimalTraits(selectedAnimal);
      } else {
        setSelectedAnimalIds([]);
    setAnimalTraits({});
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
    setAnimalTraits({});
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
        animal_details: selectedAnimalIds.length > 1 ? Object.fromEntries(selectedAnimalIds.map(id => {
          const animal = farmerAnimals.find(item => item.id === id);
          if (!animal) throw new Error("Reload the selected animals before submitting.");
          const traits = animalTraits[id] || recordedTraits(animal);
          return [String(id), { ...traits, weight_at_transfer_kg: traits.weight_at_transfer_kg || null }];
        })) : undefined,
        original_certificate_numbers: Object.fromEntries(
          selectedAnimalIds.map((id) => [String(id), originalCertificates[id] || ""])
        ),
      });
    },
    onSuccess: async (_data, submission) => {
      await queryClient.invalidateQueries({ queryKey: ["auction-ownership-transfers"] });
      await queryClient.invalidateQueries({ queryKey: ["ownership-transfers"] });
      await queryClient.invalidateQueries({ queryKey: ["next-transfer-certificate-number"] });
      void refetchNextCert();
      setUsePaperBooklet(false);
      setManualCertNumber("");
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
    setAnimalTraits({});
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
    onError: (error: unknown) => {
      const data = httpError(error)?.response?.data;
      const messages = (value: unknown, path = ""): string[] => {
        if (typeof value === "string") return [path ? `${path}: ${value}` : value];
        if (Array.isArray(value)) return value.flatMap(item => messages(item, path));
        if (value && typeof value === "object") return Object.entries(value).flatMap(([key, item]) => messages(item, path ? `${path}.${key}` : key.replaceAll("_", " ")));
        return [];
      };
      toast.error("Could not record this transfer", { description: messages(data).join("; ") || (error instanceof Error ? error.message : "Please try again."), duration: 10000 });
      setShowAdditionalDetails(true);
    },
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
      setAnimalDescription(transfer.animal_description || "");
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
      setAnimalDescription(transfer.animal_description || "");
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
    if (checked) {
      const animal = farmerAnimals.find(item => item.id === animalId);
      setOriginalCertificates(current => ({ ...current, [animalId]: current[animalId] ?? animal?.ownership_certificate_number ?? "" }));
    }
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
      <PageHeader
        title="Record Ownership Transfer"
        subtitle="Record a completed certificate for registered livestock or an outside animal brought to the market."
        variant="auction"
        maxWidthClass="w-full"
        breadcrumbs={[
          { label: "SmartLivestock", href: "/auction" },
          { label: "Transfer Records", href: "/auction-ownership-transfers/registry" },
          { label: "Record Transfer", active: true },
        ]}
      />
      {preregistrationReference && <div className="mx-4 mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 sm:mx-6 lg:mx-8">
        <strong>Loaded from {preregistrationReference}.</strong> Farmer, animal, recorded animal traits, and original certificate number are filled in. Add the actual buyer, final sale price, sale date, and issued transfer certificate details.
        <Link href="/auction-preregistrations" className="ml-2 font-semibold underline">Back to preregistrations</Link>
      </div>}


      {/* Main Container */}
      <div id="auction-transfer-form-start" className="w-full px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* Action Buttons Row */}
        <div className="flex items-center justify-between gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs h-9 px-3.5 rounded-xl shadow-xs gap-1.5 active:scale-95 hover:-translate-y-0.5 transition-all duration-200"
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
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs h-9 px-3.5 rounded-xl shadow-xs gap-1.5 active:scale-95 hover:-translate-y-0.5 transition-all duration-200"
          >
            <BookOpen className="size-4 text-slate-600" />
            User Guide
          </Button>
        </div>

        {/* 3-Step Horizontal Workflow Progress Banner */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Step 1: Select Animal */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-1 bg-[#0F4A2F] rounded-full hidden sm:block shrink-0" />
              <div className="size-8 rounded-full bg-[#0F4A2F] text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                1
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900 leading-tight">Select Animal</h2>
                <p className="text-xs text-slate-500 leading-tight mt-0.5">
                  Choose the seller and animal to transfer.
                </p>
              </div>
            </div>

            <div className="flex-1 h-px bg-slate-200 mx-2 hidden md:block" />

            {/* Step 2: Transfer Details */}
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`size-8 rounded-full font-bold text-sm flex items-center justify-center shrink-0 transition-colors ${
                  (farmer && selectedAnimalIds.length > 0) || outsideLivestock
                    ? "bg-[#EAF5EC] border border-emerald-300 text-[#0F4A2F]"
                    : "bg-white border-2 border-slate-200 text-slate-600"
                }`}
              >
                2
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900 leading-tight">Transfer Details</h2>
                <p className="text-xs text-slate-500 leading-tight mt-0.5">
                  Enter buyer, certificate, and sale information.
                </p>
              </div>
            </div>

            <div className="flex-1 h-px bg-slate-200 mx-2 hidden md:block" />

            {/* Step 3: Review & Submit */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-8 rounded-full bg-white border-2 border-slate-200 text-slate-600 font-bold text-sm flex items-center justify-center shrink-0">
                3
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900 leading-tight">Review &amp; Submit</h2>
                <p className="text-xs text-slate-500 leading-tight mt-0.5">
                  Confirm details and submit to MAO.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT COLUMN: Cards 1 and 2 (lg:col-span-5) */}
          <div className="lg:col-span-5 space-y-5">
            {/* 1. Animal Source Card */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-[#EAF5EC] text-[#1E4D2B] flex items-center justify-center shrink-0 shadow-2xs">
                  <CowHeadIcon className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">1. Animal Source</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Select the source of the animal for this transfer.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option A: Registered Animal */}
                <button
                  type="button"
                  onClick={() => {
                    if (!outsideLivestock) return;
                    setOutsideLivestock(false);
                    setFarmer(null);
                    setFarmerAnimals([]);
                    setSelectedAnimalIds([]);
    setAnimalTraits({});
                  }}
                  className={`relative flex flex-col justify-between p-3.5 rounded-2xl text-left transition-all cursor-pointer ${
                    !outsideLivestock
                      ? "border-2 border-emerald-600 bg-[#EAF5EC]/60 shadow-xs ring-1 ring-emerald-500/20"
                      : "border border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  {!outsideLivestock && (
                    <div className="absolute top-2.5 right-2.5 size-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-2xs">
                      <Check className="size-3 stroke-[3]" />
                    </div>
                  )}
                  <Database className={`size-6 ${!outsideLivestock ? "text-[#1E4D2B]" : "text-slate-500"}`} />
                  <div className="mt-3">
                    <p className="font-bold text-xs sm:text-sm text-slate-900">Registered Animal</p>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                      Existing in SmartLivestock (Padre Garcia inventory).
                    </p>
                  </div>
                </button>

                {/* Option B: Outside Livestock */}
                <button
                  type="button"
                  onClick={handleSelectOutsideLivestock}
                  className={`relative flex flex-col justify-between p-3.5 rounded-2xl text-left transition-all cursor-pointer ${
                    outsideLivestock
                      ? "border-2 border-emerald-600 bg-[#EAF5EC]/60 shadow-xs ring-1 ring-emerald-500/20"
                      : "border border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  {outsideLivestock && (
                    <div className="absolute top-2.5 right-2.5 size-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-2xs">
                      <Check className="size-3 stroke-[3]" />
                    </div>
                  )}
                  <Truck className={`size-6 ${outsideLivestock ? "text-[#1E4D2B]" : "text-slate-500"}`} />
                  <div className="mt-3">
                    <p className="font-bold text-xs sm:text-sm text-slate-900">Outside Livestock</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Market transaction only (not added to local inventory).
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* 2. Seller & Animal Card */}
            <div
              ref={sellerAnimalRef}
              className={`rounded-2xl border p-5 shadow-xs space-y-4 transition-all duration-500 ${
                isPreregistrationHighlighted
                  ? "border-emerald-500 ring-4 ring-emerald-500/20 bg-gradient-to-b from-emerald-50/20 via-white to-white shadow-md"
                  : "border-slate-200/90 bg-white"
              }`}
            >
              {preregistrationReference && (
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-900 shadow-2xs animate-in fade-in slide-in-from-top-1 duration-300">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Sparkles className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-emerald-950 truncate">
                        Pre-registered Livestock Loaded
                      </p>
                      <p className="text-[11px] text-emerald-700 truncate">
                        Reference: <span className="font-mono font-bold">{preregistrationReference}</span> · Verified at auction arrival
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 border-none text-[10px] font-bold shrink-0">
                    Auto-filled
                  </Badge>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-[#EAF5EC] text-[#1E4D2B] flex items-center justify-center shrink-0 shadow-2xs">
                  <User className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">2. Seller &amp; Animal</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Verify the seller and select the animal to transfer.</p>
                </div>
              </div>

              {/* Seller section */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-700">
                  {outsideLivestock ? "Seller (Outside Seller)" : "Seller (Registered Farmer)"}
                </p>

                {!outsideLivestock && farmer && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                        <User className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-xs sm:text-sm text-slate-900">{farmer.name}</p>
                        <p className="truncate text-[11px] text-slate-500">
                          RSBSA: {farmer.rsbsa_number || "Not recorded"} · Farmer ID: FG-{String(farmer.id).padStart(6, "0")}
                        </p>
                      </div>
                    </div>
                    {!editing && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFarmer(null);
                          setFarmerAnimals([]);
                          setSelectedAnimalIds([]);
    setAnimalTraits({});
                          setFarmerResults([]);
                          setIsAnimalModalOpen(false);
                          autofillAnimalTraits(null);
                        }}
                        className="h-8 rounded-xl border-emerald-600 px-3 text-xs font-bold text-emerald-800 hover:bg-emerald-50 gap-1.5 shadow-2xs shrink-0"
                      >
                        <Pencil className="size-3.5" />
                        <span>Change</span>
                      </Button>
                    )}
                  </div>
                )}

                {!outsideLivestock && !farmer && (
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row items-stretch gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                        <Input
                          value={farmerSearch}
                          onChange={(e) => setFarmerSearch(e.target.value)}
                          placeholder="Farmer name, email, username, or RSBSA..."
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void searchFarmers();
                            }
                          }}
                          className="pl-9 h-10 bg-white border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus-visible:ring-emerald-500"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void searchFarmers()}
                        disabled={isSearchingFarmers || !farmerSearch.trim()}
                        className="h-10 px-3.5 rounded-xl border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 gap-1.5 shrink-0"
                      >
                        <Search className="size-3.5" />
                        <span>{isSearchingFarmers ? "Searching…" : "Find"}</span>
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          setScannerTarget("seller");
                          setIsScannerOpen(true);
                        }}
                        className="h-10 px-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-800 hover:bg-emerald-100 gap-1.5 shrink-0"
                      >
                        <QrCode className="size-3.5 text-emerald-700" />
                        <span>Scan QR</span>
                      </Button>
                    </div>
                    {lookupError && (
                      <Alert variant="destructive" className="rounded-xl py-2 text-xs">
                        <AlertDescription>{lookupError}</AlertDescription>
                      </Alert>
                    )}
                    {farmerResults.length > 0 && (
                      <div className="grid gap-1.5 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xs">
                        {farmerResults.map((result) => (
                          <button
                            key={result.id}
                            type="button"
                            onClick={() => void loadFarmerAnimals(result)}
                            className="flex items-center justify-between rounded-lg p-2 text-left text-xs hover:bg-emerald-50/60 transition-colors"
                          >
                            <div>
                              <p className="font-bold text-slate-900">{result.name} <span className="font-normal text-slate-500">· ID {result.id}</span></p>
                              <p className="text-[11px] text-slate-500">{result.barangay} · {result.username}</p>
                            </div>
                            <span className="text-[11px] font-bold text-emerald-700">Select</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {outsideLivestock && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    Outside seller and origin details are entered directly under Transfer Details.
                  </div>
                )}
              </div>

              {/* Animal to transfer section */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-700">{selectedAnimalIds.length > 1 ? "Animals to Transfer" : "Animal to Transfer"}</p>

                {!outsideLivestock && selectedAnimalIds.length > 0 && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-[#EAF5EC]/40 p-3 shadow-2xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#D7EEDD] text-[#1E4D2B]">
                        <CowHeadIcon className="size-5" />
                      </div>
                      <div className="min-w-0">
                        {selectedAnimalIds.length > 1 ? <>
                          <p className="text-sm font-bold text-emerald-950">{selectedAnimalIds.length} animals selected</p>
                          <p className="mt-1 text-[11px] text-slate-600">Multiple animals from this seller. Review each animal's details below.</p>
                          <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto" aria-label="Selected animals">
                            {selectedAnimalIds.map(id => {
                              const animal = farmerAnimals.find(item => item.id === id);
                              return <span key={id} className="break-all rounded-lg border border-emerald-200 bg-white px-2 py-1 text-[11px] font-semibold text-emerald-900">{animal?.tag_number || `Animal #${id}`}{animal?.livestock_type_name ? ` - ${animal.livestock_type_name}` : ""}</span>;
                            })}
                          </div>
                        </> : <>
                        <p className="truncate font-bold text-xs sm:text-sm text-slate-900">
                          {selectedAnimalForTransfer?.livestock_type_name || "Cattle"} – {selectedAnimalForTransfer?.tag_number || `#${selectedAnimalIds[0]}`}
                        </p>
                        <p className="truncate text-[11px] text-slate-600">
                          Breed: {selectedAnimalForTransfer?.breed || "Not recorded"} | Sex: {selectedAnimalForTransfer?.sex || "Not recorded"} | Age: {selectedAnimalForTransfer?.age || "Not recorded"}
                        </p>
                        </>}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAnimalModalOpen(true)}
                      className="h-8 rounded-xl border-emerald-600 px-3 text-xs font-bold text-emerald-800 hover:bg-emerald-50 gap-1.5 shadow-2xs shrink-0"
                    >
                      <Pencil className="size-3.5" />
                      <span>Change</span>
                    </Button>
                  </div>
                )}

                {!outsideLivestock && selectedAnimalIds.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center">
                    {farmer ? (
                      <>
                        <p className="text-xs text-slate-600 mb-2">No animal selected from {farmer.name}&apos;s inventory yet.</p>
                        <Button
                          type="button"
                          onClick={() => setIsAnimalModalOpen(true)}
                          disabled={isLoadingAnimals || farmerAnimals.length === 0}
                          className="h-8 px-4 rounded-xl bg-[#0F4A2F] text-white hover:bg-[#0B3D26] text-xs font-bold shadow-xs"
                        >
                          {isLoadingAnimals ? "Loading animals…" : "Select Animal"}
                        </Button>
                      </>
                    ) : (
                      <p className="text-xs text-slate-500">Select a registered seller above first to choose their animals.</p>
                    )}
                  </div>
                )}

                {outsideLivestock && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    Outside animal species and details are specified in Transfer Details below.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: 3. Transfer Details (lg:col-span-7) */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-[#EAF5EC] text-[#1E4D2B] flex items-center justify-center shrink-0 shadow-2xs">
                  <FileText className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">3. Transfer Details</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Enter the buyer, certificate, and sale information.</p>
                </div>
              </div>

              <form key={editing?.id ?? "new-transfer"} onSubmit={handleSubmit} onInvalidCapture={() => setShowAdditionalDetails(true)} className="space-y-4 pt-1">
                {/* Row 1: Buyer Type & Find Registered Buyer */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                  <div className="md:col-span-5 space-y-1.5">
                    <TransferFieldLabel
                      htmlFor="owner_type"
                      label="Buyer Type *"
                      help="Choose Registered SmartLivestock Farmer if the buyer has an approved Farmer account. Choose an external type for an unregistered buyer."
                    />
                    <Select
                      value={ownerType}
                      onValueChange={(val) => {
                        setOwnerType(val as OwnerType);
                        setBuyer(null);
                        setBuyerResults([]);
                      }}
                    >
                      <SelectTrigger id="owner_type" className="h-10 bg-white border-slate-200 rounded-xl text-xs sm:text-sm">
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

                  <div className="md:col-span-7 space-y-1.5">
                    {ownerType === "REGISTERED_FARMER" ? (
                      <>
                        <TransferFieldLabel
                          htmlFor="buyer-search"
                          label="Find the Registered Buyer *"
                          help="Search using the buyer's name, email, username, RSBSA number, or Farmer ID, then select the matching approved Farmer."
                        />
                        {buyer ? (
                          <div className="flex items-center justify-between gap-2 min-h-10 px-3 py-1 bg-white border border-emerald-300 rounded-xl text-xs sm:text-sm">
                            <div className="flex items-center gap-2 truncate">
                              <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                              <span className="font-bold text-slate-900 truncate">{buyer.name}</span>
                              <span className="text-slate-500 font-normal truncate">· {buyer.barangay}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setBuyer(null)}
                              className="h-7 text-xs text-slate-500 hover:text-red-600 shrink-0"
                            >
                              Change
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                            <div className="relative flex-1 min-w-[160px]">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                              <Input
                                id="buyer-search"
                                value={buyerSearch}
                                onChange={(e) => setBuyerSearch(e.target.value)}
                                placeholder="Buyer name, email, or RSBSA..."
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    void searchBuyers();
                                  }
                                }}
                                className="pl-9 h-10 bg-white border-slate-200 rounded-xl text-xs sm:text-sm placeholder:text-slate-400 focus-visible:ring-emerald-500"
                              />
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => void searchBuyers()}
                                disabled={isSearchingBuyers || !buyerSearch.trim()}
                                className="h-10 px-3 rounded-xl border-slate-200 bg-white text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 gap-1.5 shrink-0"
                              >
                                <Search className="size-3.5" />
                                <span>Find</span>
                              </Button>
                              <Button
                                type="button"
                                onClick={() => {
                                  setScannerTarget("buyer");
                                  setIsScannerOpen(true);
                                }}
                                className="h-10 px-3 rounded-xl border border-emerald-200 bg-[#EAF5EC] text-xs sm:text-sm font-bold text-[#1E4D2B] hover:bg-emerald-100 gap-1.5 shrink-0"
                              >
                                <QrCode className="size-3.5 text-[#1E4D2B]" />
                                <span>Scan QR</span>
                              </Button>
                            </div>
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
                                className="text-left p-2 rounded-lg hover:bg-emerald-50 transition-colors text-xs flex items-center justify-between"
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
                                <span className="text-[11px] font-bold text-emerald-700">Select</span>
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
                          label="Buyer / Organization Name *"
                          help="Enter the external buyer's individual or organization name as shown on the transfer certificate."
                        />
                        <Input
                          id="external_owner_name"
                          name="external_owner_name"
                          required
                          maxLength={255}
                          defaultValue={editing?.external_owner_name}
                          placeholder="Enter buyer or organization name"
                          className="h-10 bg-white border-slate-200 rounded-xl text-xs sm:text-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 2: Certificate No, Transfer Date, Agreed Price */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                  <div className="md:col-span-5 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <TransferFieldLabel
                          htmlFor="transfer_certificate_number"
                          label="Transfer Certificate No. *"
                          help="SmartLivestock automatically generates the official sequential NO. BTG certificate number according to Batangas Provincial Treasury standards. Toggle to enter a physical paper booklet number if encoding an older booklet."
                        />
                        {!usePaperBooklet && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                            <Sparkles className="size-3 text-emerald-600" />
                            Auto NO. BTG
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextState = !usePaperBooklet;
                          setUsePaperBooklet(nextState);
                          if (!nextState) setManualCertNumber("");
                        }}
                        className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 underline transition-colors cursor-pointer shrink-0"
                      >
                        {usePaperBooklet ? "Use auto-generated" : "Paper booklet override"}
                      </button>
                    </div>
                    {usePaperBooklet ? (
                      <Input
                        id="transfer_certificate_number"
                        name="transfer_certificate_number"
                        required
                        value={manualCertNumber}
                        onChange={(e) => setManualCertNumber(e.target.value)}
                        placeholder="e.g., BTG 1942301"
                        className="h-10 bg-white border-slate-200 rounded-xl text-xs sm:text-sm placeholder:text-slate-400 font-mono font-bold"
                      />
                    ) : (
                      <Input
                        id="transfer_certificate_number"
                        name="transfer_certificate_number"
                        readOnly
                        value={editing?.transfer_certificate_number || nextCertData?.certificate_number || "BTG-2026-000001"}
                        className="h-10 bg-emerald-50/60 border-emerald-300 rounded-xl text-xs sm:text-sm font-mono font-bold text-emerald-950 px-3 cursor-not-allowed select-all"
                      />
                    )}
                  </div>

                  <div className="md:col-span-3 space-y-1.5">
                    <TransferFieldLabel
                      htmlFor="transfer_date"
                      label="Transfer Date *"
                      help="Enter the date the ownership transfer actually happened. Future dates are not allowed."
                    />
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                      <Input
                        id="transfer_date"
                        name="transfer_date"
                        type="date"
                        required
                        defaultValue={editing?.transfer_date ?? getLocalDateInputValue()}
                        className="h-10 pl-9 bg-white border-slate-200 rounded-xl text-xs sm:text-sm"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-4 space-y-1.5">
                    <TransferFieldLabel
                      htmlFor="purchase_price"
                      label="Agreed Price (Optional)"
                      help="Enter the recorded sale price in Philippine pesos."
                    />
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs sm:text-sm font-bold text-slate-400">
                        ₱
                      </span>
                      <Input
                        id="purchase_price"
                        name="purchase_price"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={editing?.purchase_price ?? ""}
                        placeholder="e.g. 15,000.00"
                        className="h-10 pl-7 bg-white border-slate-200 rounded-xl text-xs sm:text-sm placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 3: Additional Details (Optional) Accordion */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAdditionalDetails(!showAdditionalDetails)}
                    className="w-full flex items-center justify-between rounded-xl border border-emerald-200/80 bg-[#EAF5EC]/60 px-4 py-3 text-left transition-colors hover:bg-[#EAF5EC]"
                  >
                    <div className="flex items-center gap-2.5">
                      <ChevronDown
                        className={`size-4 text-[#1E4D2B] transition-transform ${showAdditionalDetails ? "rotate-180" : ""}`}
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {outsideLivestock ? "Outside Seller & Animal Details *" : "Additional Details (Optional)"}
                        </p>
                        <p className="text-[11px] text-slate-600">
                          {outsideLivestock
                            ? "Enter the outside seller name, address, animal species, and certificate details."
                            : "Add other information from the certificate (e.g., municipality, brand, etc.)."}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-[#1E4D2B]">
                      {showAdditionalDetails ? "Hide" : "Show"}
                    </span>
                  </button>

                  {/* Expandable Additional Details content */}
                  {(
                    <div hidden={!showAdditionalDetails} className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                        {!outsideLivestock && selectedAnimalIds.length > 1 ? (
                          <div className="space-y-3 sm:col-span-2">
                            <p className="text-xs text-slate-600">Each animal keeps its own transfer details. Prefilled values reflect the current inventory; verify them against the sale date and paper certificate. Blank means not recorded.</p>
                            {selectedAnimalIds.map(id => {
                              const animal = farmerAnimals.find(item => item.id === id);
                              if (!animal) return null;
                              const traits = animalTraits[id] || recordedTraits(animal);
                              const update = (field: keyof TransferTraits, value: string) => setAnimalTraits(previous => ({ ...previous, [id]: { ...traits, [field]: value } }));
                              return <details key={id} className="group space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/30 p-3">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg text-sm font-bold text-emerald-950 focus-visible:outline-2 focus-visible:outline-emerald-600 [&::-webkit-details-marker]:hidden">
                                  <span>{animal.tag_number || `Animal #${id}`} - {animal.livestock_type_name}</span>
                                  <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
                                </summary>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <label className="space-y-1 text-xs font-semibold">Sex
                                    <Select value={traits.sex_at_transfer || "NOT_RECORDED"} onValueChange={value => update("sex_at_transfer", value === "NOT_RECORDED" ? "" : value)}>
                                      <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
                                      <SelectContent><SelectItem value="NOT_RECORDED">Not recorded</SelectItem><SelectItem value="MALE">Male</SelectItem><SelectItem value="FEMALE">Female</SelectItem></SelectContent>
                                    </Select>
                                  </label>
                                  {([
                                    ["age_at_transfer", "Age at transfer"], ["breed_at_transfer", "Breed at transfer"],
                                    ["weight_at_transfer_kg", "Weight (kg)"], ["animal_description", "Description recorded on certificate"],
                                    ["municipality_brand", "Municipality brand"], ["owner_brand", "Owner brand"],
                                  ] as const).map(([field, label]) => <label key={field} className="space-y-1 text-xs font-semibold">{label}<Input value={traits[field]} onChange={event => update(field, event.target.value)} type={field === "weight_at_transfer_kg" ? "number" : "text"} min={field === "weight_at_transfer_kg" ? "0" : undefined} step={field === "weight_at_transfer_kg" ? "0.01" : undefined} placeholder="Not recorded" className="bg-white" /></label>)}
                                </div>
                              </details>;
                            })}
                          </div>
                        ) : <>
                        <div className="space-y-1.5">
                          <TransferFieldLabel
                            htmlFor="sex_at_transfer"
                            label="Sex (optional)"
                            help="Select the animal's sex at the time of transfer."
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
                            help="Enter the animal's age at the time of transfer."
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

                        <div className="space-y-1.5">
                          <TransferFieldLabel
                            htmlFor="breed_at_transfer"
                            label="Breed at transfer (optional)"
                            help="Enter the animal's breed at the time of sale."
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
                            help="Enter the animal's measured weight in kilograms."
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

                        <div className="space-y-1.5 sm:col-span-2">
                          <TransferFieldLabel
                            htmlFor="animal_description"
                            label="Description recorded on certificate (optional)"
                            help="Copy any animal description or identifying notes written on the transfer certificate."
                          />
                          <Input
                            id="animal_description"
                            name="animal_description"
                            value={animalDescription}
                            onChange={event => setAnimalDescription(event.target.value)}
                            placeholder="Enter description from certificate"
                            className="h-10 bg-white border-slate-200 rounded-xl text-xs placeholder:text-slate-400"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <TransferFieldLabel
                            htmlFor="municipality_brand"
                            label="Municipality brand (optional)"
                            help="Enter the municipality's identifying brand or mark."
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
                            help="Enter the owner's identifying brand or mark."
                          />
                          <Input
                            id="owner_brand"
                            name="owner_brand"
                            defaultValue={editing?.owner_brand}
                            placeholder="Enter owner brand"
                            className="h-10 bg-white border-slate-200 rounded-xl text-xs placeholder:text-slate-400"
                          />
                        </div>

                        </>}

                        {/* Non-registered buyer address */}
                        {ownerType !== "REGISTERED_FARMER" && (
                          <div className="space-y-1.5 sm:col-span-2">
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

                        {/* Outside Livestock Fields */}
                        {outsideLivestock && (
                          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200">
                            <div className="space-y-1.5">
                              <TransferFieldLabel
                                htmlFor="external_seller_name"
                                label="Outside seller name *"
                                help="Enter the person or business that sold the animal."
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
                                label="Seller address *"
                                help="Enter the seller's address."
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
                                label="Animal type *"
                                help="Choose the animal's species from the livestock list."
                              />
                              <Select
                                value={externalLivestockType}
                                onValueChange={setExternalLivestockType}
                                disabled={isLoadingExternalLivestockTypes || (externalLivestockTypes.length === 0 && !externalLivestockType)}
                              >
                                <SelectTrigger id="external_livestock_type" className="h-10 bg-white border-slate-200 rounded-xl text-xs">
                                  <SelectValue placeholder={isLoadingExternalLivestockTypes ? "Loading animal types..." : "Select animal type"} />
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
                              <input type="hidden" name="external_livestock_type" value={externalLivestockType} />
                            </div>
                            <div className="space-y-1.5">
                              <TransferFieldLabel
                                htmlFor="external_livestock_tag_number"
                                label="Seller tag / identifying mark (optional)"
                                help="Enter the seller's ear tag, brand, or other identifying mark."
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
                                label="Animal origin municipality *"
                                help="Enter the municipality where the animal came from."
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
                                label="Animal origin province *"
                                help="Enter the province where the animal came from."
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

                        {/* Original Certificate Numbers for selected animals */}
                        {!outsideLivestock && selectedAnimalIds.length > 0 && (
                          <div className="sm:col-span-2 space-y-2 pt-3 border-t border-slate-200">
                            <p className="text-xs font-semibold text-slate-700">
                              Confirm original ownership certificate (COLC) number:
                            </p>
                            {selectedAnimalIds.map((id) => {
                              const animal = farmerAnimals.find((item) => item.id === id);
                              if (!animal) return null;
                              return (
                                <div
                                  key={`certificate-${id}`}
                                  className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-center bg-white p-2.5 rounded-xl border border-emerald-200 shadow-2xs"
                                >
                                  <TransferFieldLabel
                                    htmlFor={`original-certificate-${id}`}
                                    label={`${animal.livestock_type_name} ${animal.tag_number || `#${id}`} certificate`}
                                    help="Filled from the livestock's recorded COLC when available. Verify it against the original certificate."
                                  />
                                  <Input
                                    id={`original-certificate-${id}`}
                                    value={originalCertificates[id] ?? animal.ownership_certificate_number ?? ""}
                                    onChange={(e) =>
                                      setOriginalCertificates((cur) => ({ ...cur, [id]: e.target.value }))
                                    }
                                    placeholder="COLC number (not recorded)"
                                    required
                                    className="h-9 bg-white border-slate-200 rounded-lg text-xs"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Action Buttons */}
                <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => toast.info("Draft preserved in current session.")}
                    className="min-h-10 rounded-xl border-slate-300 bg-white px-5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 gap-2 shadow-2xs"
                  >
                    <Save className="size-4 text-slate-500" />
                    <span>Save as Draft</span>
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      (!outsideLivestock && (!farmer || !selectedAnimalIds.length)) ||
                      (ownerType === "REGISTERED_FARMER" && !buyer) ||
                      submit.isPending ||
                      isLoadingAnimals
                    }
                    className="min-h-10 rounded-xl bg-[#0F4A2F] px-6 text-xs sm:text-sm font-bold text-white hover:bg-[#0B3D26] shadow-sm gap-2 transition-colors disabled:opacity-50"
                  >
                    <span>{submit.isPending ? "Submitting…" : "Review & Submit"}</span>
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Bottom Card: Recent Transfer Records (Entered by Your Account) */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-[#EAF5EC] text-[#1E4D2B] flex items-center justify-center shrink-0 shadow-2xs">
                <FileText className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 leading-tight">
                  Recent Transfer Records (Entered by Your Account)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Latest ownership transfers you have encoded.
                </p>
              </div>
            </div>
            <Link
              href="/auction-ownership-transfers/registry"
              className="text-xs font-bold text-[#0F4A2F] hover:text-[#0B3D26] flex items-center gap-1 group transition-colors"
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
            <div className="overflow-hidden rounded-xl border border-slate-200/90 shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-[#EAF5EC]">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-xs font-bold tracking-tight text-[#1E4D2B]">Animal</th>
                      <th scope="col" className="px-4 py-3 text-xs font-bold tracking-tight text-[#1E4D2B]">Seller</th>
                      <th scope="col" className="px-4 py-3 text-xs font-bold tracking-tight text-[#1E4D2B]">Buyer</th>
                      <th scope="col" className="px-4 py-3 text-xs font-bold tracking-tight text-[#1E4D2B]">Certificate No.</th>
                      <th scope="col" className="px-4 py-3 text-xs font-bold tracking-tight text-[#1E4D2B]">Transfer Date</th>
                      <th scope="col" className="px-4 py-3 text-xs font-bold tracking-tight text-[#1E4D2B]">Agreed Price</th>
                      <th scope="col" className="px-4 py-3 text-xs font-bold tracking-tight text-[#1E4D2B]">Status</th>
                      <th scope="col" className="px-4 py-3 text-xs font-bold tracking-tight text-[#1E4D2B]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {transfers.slice(0, 10).map((transfer) => (
                      <tr key={transfer.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-xs text-slate-900">
                          {transfer.livestock_type_name} –{" "}
                          {transfer.livestock_tag ||
                            (transfer.livestock ? `#${transfer.livestock}` : "Outside livestock")}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-800">
                          {transfer.previous_owner_name}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-800">
                          {transfer.new_owner_name}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-800">
                          {transfer.transfer_certificate_number}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">
                          {formatTransferDate(transfer.transfer_date)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-xs text-emerald-800">
                          {transfer.purchase_price ? `₱${Number(transfer.purchase_price).toLocaleString()}` : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {renderTransferStatus(transfer.status)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setViewTransfer(transfer)}
                              className="h-7 rounded-xl border-[#1E4D2B] bg-white px-2.5 text-xs font-bold text-[#1E4D2B] shadow-2xs transition-colors hover:bg-[#EAF5EC] hover:text-[#163b21] gap-1"
                            >
                              <Eye className="size-3.5" />
                              <span>View</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setCertificateTarget(transfer)}
                              className="h-7 rounded-xl border-pink-200 bg-pink-50 px-2.5 text-xs font-bold text-pink-900 shadow-2xs transition-colors hover:bg-pink-100 gap-1"
                              title="Print Certificate (NO. BTG)"
                            >
                              <Printer className="size-3.5 text-pink-700" />
                              <span>Certificate</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transfer Detail View Dialog */}
      <Dialog open={viewTransfer !== null} onOpenChange={(open) => { if (!open) setViewTransfer(null); }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Transfer Record Details
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Certificate: {viewTransfer?.transfer_certificate_number}
            </DialogDescription>
          </DialogHeader>
          {viewTransfer && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-700">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="font-semibold text-slate-500">Animal:</span>
                <span className="font-bold text-slate-900">
                  {viewTransfer.livestock_type_name} ({viewTransfer.livestock_tag || `#${viewTransfer.livestock || "Outside"}`})
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="font-semibold text-slate-500">Seller:</span>
                <span className="font-medium text-slate-900">{viewTransfer.previous_owner_name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="font-semibold text-slate-500">Buyer:</span>
                <span className="font-medium text-slate-900">{viewTransfer.new_owner_name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="font-semibold text-slate-500">Transfer Date:</span>
                <span>{formatTransferDate(viewTransfer.transfer_date)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="font-semibold text-slate-500">Agreed Price:</span>
                <span className="font-bold text-emerald-800">
                  {viewTransfer.purchase_price ? `₱${Number(viewTransfer.purchase_price).toLocaleString()}` : "Not recorded"}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="font-semibold text-slate-500">Status:</span>
                <span>{renderTransferStatus(viewTransfer.status)}</span>
              </div>
            </div>
          )}
          <DialogFooter className="flex items-center justify-between sm:justify-between pt-2 gap-2">
            <div className="flex items-center gap-2">
              {viewTransfer?.can_edit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const t = viewTransfer;
                    setViewTransfer(null);
                    void correctReturnedTransfer(t);
                  }}
                  className="h-8 text-xs border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 rounded-xl"
                >
                  Correct and resubmit
                </Button>
              )}
              <Button
                type="button"
                onClick={() => {
                  const t = viewTransfer;
                  setViewTransfer(null);
                  setCertificateTarget(t);
                }}
                className="h-8 text-xs rounded-xl bg-pink-700 text-white hover:bg-pink-800 px-3 gap-1.5 shadow-xs"
              >
                <Printer className="size-3.5" />
                <span>Print Certificate</span>
              </Button>
            </div>
            <Button
              type="button"
              onClick={() => setViewTransfer(null)}
              className="h-8 text-xs rounded-xl bg-[#0F4A2F] text-white hover:bg-[#0B3D26] px-4"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    setAnimalTraits({});
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

      {/* Switch to Outside Livestock Confirmation Dialog */}
      <Dialog open={showOutsideConfirmModal} onOpenChange={setShowOutsideConfirmModal}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <div className="flex items-start gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <AlertTriangle className="size-6 stroke-[2.2]" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-base font-bold text-slate-900">
                Switch to Outside Livestock?
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                You currently have a registered seller and livestock selected.
              </DialogDescription>
            </div>
          </div>

          <div className="my-2 space-y-2 rounded-xl border border-amber-200/80 bg-amber-50/60 p-3.5 text-xs text-slate-700">
            <p className="font-semibold text-amber-950">
              Switching will clear your current seller and animal selection:
            </p>
            <div className="space-y-1.5 pl-1">
              {farmer && (
                <div className="flex items-center gap-1.5 text-slate-700">
                  <span className="font-semibold text-slate-500">Seller:</span>
                  <span className="font-bold text-slate-900">{farmer.name}</span>
                  <span className="text-slate-400">({farmer.barangay || "Registered Farmer"})</span>
                </div>
              )}
              {selectedAnimalForTransfer ? (
                <div className="flex items-center gap-1.5 text-slate-700">
                  <span className="font-semibold text-slate-500">Animal:</span>
                  <span className="font-bold text-slate-900">
                    {selectedAnimalForTransfer.livestock_type_name} ({selectedAnimalForTransfer.tag_number || `#${selectedAnimalForTransfer.id}`})
                  </span>
                </div>
              ) : selectedAnimalIds.length > 0 ? (
                <div className="flex items-center gap-1.5 text-slate-700">
                  <span className="font-semibold text-slate-500">Selected:</span>
                  <span className="font-bold text-slate-900">{selectedAnimalIds.length} animal(s)</span>
                </div>
              ) : null}
              {preregistrationReference && (
                <div className="flex items-center gap-1.5 text-slate-700">
                  <span className="font-semibold text-slate-500">Preregistration:</span>
                  <span className="font-mono font-bold text-emerald-800">{preregistrationReference}</span>
                </div>
              )}
            </div>
            <p className="text-[11px] text-amber-900/80 pt-1.5 border-t border-amber-200/60">
              Outside livestock transactions are recorded for market clearance only and will not be linked to SmartLivestock local inventory.
            </p>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowOutsideConfirmModal(false)}
              className="rounded-xl border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 h-9"
            >
              Cancel, Keep Selection
            </Button>
            <Button
              type="button"
              onClick={confirmSwitchToOutside}
              className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold h-9 shadow-xs"
            >
              Yes, Switch to Outside
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

      {/* Official Accountable Form No. 52 Certificate Dialog */}
      <OwnershipTransferCertificateDialog
        open={Boolean(certificateTarget)}
        onOpenChange={(open) => !open && setCertificateTarget(null)}
        transfer={certificateTarget}
        allTransfers={transfers}
      />
    </div>
  );
}
