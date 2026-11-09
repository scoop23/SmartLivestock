"use client";

import {
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  Eye,
  FileCheck2,
  FileText,
  HeartPulse,
  Hourglass,
  Layers,
  LogOut,
  Pencil,
  Printer,
  QrCode,
  Scale,
  Search,
  Shield,
  ShieldAlert,
  Tag,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { AuctionPullOutGatePassDialog, type PullOutGatePassData } from "@/app/components/auction-pull-out-gate-pass-dialog";
import { QrCodePass } from "@/components/qr-code-pass";
import { UniversalQrScannerDialog } from "@/components/universal-qr-scanner-dialog";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axios from "axios";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LivestockBreedField } from "@/components/livestock-breed-field";
import { formatCalendarDate } from "@/lib/livestock-age";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export interface HealthDiagnostic {
  has_active_disease: boolean;
  has_past_disease: boolean;
  active_diseases: Array<{ id: number; name: string; date: string; status: string; clinical_status: string }>;
  past_diseases: Array<{ id: number; name: string; date: string; status: string; clinical_status: string }>;
  quarantine_warning: boolean;
  vaccination_status: "CURRENT" | "OVERDUE" | "UNVACCINATED";
  vaccination_days_ago: number | null;
  previous_weight: number | null;
  weight_delta: number | null;
  weight_delta_percent: number | null;
}

type Registration = {
  id: number;
  reference: string;
  livestock: number;
  tag_number: string;
  livestock_type_name?: string;
  farmer_id: number;
  farmer_name: string;
  farmer_address?: string;
  farmer_contact?: string;
  farmer_rsbsa?: string;
  colc_number?: string;
  gate_pass_number?: string;
  intent: string;
  target_date: string | null;
  target_destination: string;
  notes: string;
  original_certificate_number: string;
  has_document: boolean;
  registration_status: string;
  review_notes: string;
  sale_transfer: number | null;
  weight?: string | number | null;
  birth_date?: string | null;
  breed?: string;
  sex?: string;
  last_vaccination_date?: string | null;
  batch_id?: number | null;
  batch_code?: string | null;
  batch_name?: string | null;
  barangay_name?: string | null;
  livestock_created_at?: string | null;
  age?: { years: number; months: number; total_months: number } | null;
  age_classification?: "CALF" | "YEARLING" | "ADULT" | "UNKNOWN";
  health_diagnostic?: HealthDiagnostic | null;
};

const labels: Record<string, string> = {
  SUBMITTED: "Awaiting document review",
  NEEDS_CORRECTION: "Needs correction",
  READY: "Ready for arrival",
  ARRIVED: "Arrival confirmed",
  CHECKED: "Physical checks completed",
  COMPLETED: "Sale approved",
  RELEASED: "Withdrawn / Released Unsold",
};

function formatDisplayDate(dateStr: string | null): string {
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

function renderStatusBadge(status: string) {
  switch (status) {
    case "SUBMITTED":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/90 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
          <Clock className="size-3 text-amber-600" />
          <span>For Review</span>
        </span>
      );
    case "ARRIVED":
    case "CHECKED":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/90 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
          <Calendar className="size-3 text-blue-600" />
          <span>Arrival Confirmed</span>
        </span>
      );
    case "READY":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/90 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          <Check className="size-3 text-emerald-600" />
          <span>Ready for Sale</span>
        </span>
      );
    case "NEEDS_CORRECTION":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/90 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
          <X className="size-3 text-rose-600" />
          <span>Needs Correction</span>
        </span>
      );
    case "COMPLETED":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          <Check className="size-3 text-slate-600" />
          <span>Sale Approved</span>
        </span>
      );
    case "RELEASED":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200/90 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-800">
          <LogOut className="size-3 text-purple-600" />
          <span>Released / Unsold</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
          <span>{labels[status] || status}</span>
        </span>
      );
  }
}

export default function AuctionPreregistrations({
  staff = false,
  onRecordSale,
  requestedRegistrationId,
}: {
  staff?: boolean;
  requestedRegistrationId?: string | null;
  onRecordSale?: (registration: Registration) => Promise<void>;
}) {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState<Registration | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [gatePassTarget, setGatePassTarget] = useState<PullOutGatePassData | null>(null);
  const [showReleaseConfirmDialog, setShowReleaseConfirmDialog] = useState<Registration | null>(null);
  const [releaseNotes, setReleaseNotes] = useState("");

  // Specifications editing state
  const [isEditingSpecs, setIsEditingSpecs] = useState(false);
  const [editTagNumber, setEditTagNumber] = useState("");
  const [editBreed, setEditBreed] = useState("");
  const [editSex, setEditSex] = useState("Female");
  const [editWeight, setEditWeight] = useState("");
  const [editLastVaccinationDate, setEditLastVaccinationDate] = useState("");
  const [editBatchId, setEditBatchId] = useState<number | null>(null);
  const [savingSpecs, setSavingSpecs] = useState(false);

  const { data: availableBatches = [] } = useQuery({
    queryKey: ["livestock-batches-options"],
    queryFn: async () => {
      const res = await api.get<{ results?: Array<{ id: number; batch_code: string; batch_name?: string }> } | Array<{ id: number; batch_code: string; batch_name?: string }>>("livestock/batches/");
      const data = res.data;
      if (Array.isArray(data)) return data;
      return data?.results ?? [];
    },
    enabled: staff,
    staleTime: 60_000,
  });

  function startEditingSpecs(row: Registration) {
    setEditTagNumber(row.tag_number || "");
    setEditBreed(row.breed || "");
    setEditSex(row.sex || "Female");
    setEditWeight(row.weight != null ? String(row.weight) : "");
    setEditLastVaccinationDate(row.last_vaccination_date || "");
    setEditBatchId(row.batch_id ?? null);
    setIsEditingSpecs(true);
  }

  async function handleSaveSpecs(row: Registration) {
    setSavingSpecs(true);
    try {
      const payload = {
        animal_specs: {
          tag_number: editTagNumber,
          breed: editBreed,
          sex: editSex,
          weight: editWeight ? Number(editWeight) : null,
          last_vaccination_date: editLastVaccinationDate || null,
          batch_id: editBatchId,
        },
      };
      const response = await api.patch<Registration>(`production/auction-preregistrations/${row.id}/`, payload);
      toast.success("Animal specifications updated successfully.");
      setSelected(response.data);
      setIsEditingSpecs(false);
      void client.invalidateQueries({ queryKey: ["auction-preregistration-list"] });
    } catch {
      toast.error("Failed to update animal specifications.");
    } finally {
      setSavingSpecs(false);
    }
  }

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  async function viewDocument(row: Registration) {
    setPreview(null);
    setPreviewLoading(true);
    try {
      const response = await api.get<Blob>(`production/dispositions/${row.id}/document/`, { responseType: "blob" });
      setPreview({ url: URL.createObjectURL(response.data), type: response.data.type });
    } catch {
      toast.error("The document could not be opened. Try downloading it instead.");
    } finally {
      setPreviewLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isPending, isError, isFetching } = useQuery({
    queryKey: ["auction-preregistration-list", debouncedSearch, statusFilter, plannedDate, page, pageSize],
    queryFn: async () =>
      (
        await api.get<{ count: number; page: number; pages: number; results: Registration[] }>(
          "production/dispositions/",
          {
            params: {
              paginated: "1",
              search: debouncedSearch,
              status: statusFilter || undefined,
              target_date: plannedDate || undefined,
              page,
              page_size: pageSize,
            },
          }
        )
      ).data,
  });

  async function openRegistration(id: number) {
    setScannerOpen(false);
    setSelected(null);
    setOpeningId(id);
    try {
      const response = await api.get<Registration>(`production/dispositions/${id}/`);
      const registration = response.data;
      // A scan must find its row even when today's filters or pagination hide it.
      setStatusFilter("");
      setPlannedDate("");
      setPage(1);
      setSearch(registration.reference);
      setDebouncedSearch(registration.reference);
      setHighlightedId(registration.id);
      void client
        .fetchQuery({
          queryKey: ["auction-preregistration-list", registration.reference, "", "", 1, pageSize],
          queryFn: async () =>
            (
              await api.get<{ count: number; page: number; pages: number; results: Registration[] }>(
                "production/dispositions/",
                {
                  params: { paginated: "1", search: registration.reference, page: 1, page_size: pageSize },
                }
              )
            ).data,
        })
        .catch(() => toast.error("The review opened, but its list row could not be refreshed."));
      setPreview(null);
      setSelected(registration);
    } catch {
      toast.error("Preregistration not found or unavailable to this account.");
    } finally {
      setOpeningId(null);
    }
  }

  useEffect(() => {
    if (!staff) return;
    const id = requestedRegistrationId || new URLSearchParams(window.location.search).get("registration");
    if (!id || !/^\d+$/.test(id)) return;
    let cancelled = false;
    void api
      .get<Registration>(`production/dispositions/${id}/`)
      .then(response => {
        if (!cancelled) {
          setSearch(response.data.reference);
          setDebouncedSearch(response.data.reference);
          setHighlightedId(response.data.id);
          setSelected(response.data);
        }
      })
      .catch(() => {
        if (!cancelled) toast.error("Preregistration not found or unavailable to this account.");
      });
    return () => {
      cancelled = true;
    };
  }, [staff, requestedRegistrationId]);

  const errorMessage = (error: unknown) => {
    const body: unknown = axios.isAxiosError(error) ? error.response?.data : null;
    return body && typeof body === "object"
      ? Object.values(body)
          .flat()
          .filter(value => typeof value === "string")
          .join(" ")
      : "Please try again.";
  };

  async function update(row: Registration, form: HTMLFormElement, status?: string) {
    if (busy !== null) return;
    if (status === "CHECKED") {
      const findings = form.elements.namedItem("review_notes") as HTMLTextAreaElement | null;
      if (!findings?.value.trim()) {
        findings?.setCustomValidity("Enter the inspection reference and physical checks completed.");
        findings?.reportValidity();
        findings?.focus();
        return;
      }
    }
    setBusy(row.id);
    try {
      const payload = new FormData(form);
      const file = payload.get("supporting_document");
      if (file instanceof File && !file.size) payload.delete("supporting_document");
      if (status) payload.set("registration_status", status);
      const response = await api.patch<Registration>(`production/dispositions/${row.id}/`, payload);
      setSelected(response.data);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["animal_dispositions"] }),
        client.invalidateQueries({ queryKey: ["auction-preregistration-list"] }),
      ]);
      toast.success("Preregistration updated.");
    } catch (error) {
      toast.error("Could not update preregistration.", { description: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  async function handleConfirmRelease() {
    if (!showReleaseConfirmDialog) return;
    const row = showReleaseConfirmDialog;
    setBusy(row.id);
    try {
      const response = await api.patch<Registration>(`production/dispositions/${row.id}/`, {
        registration_status: "RELEASED",
        review_notes: releaseNotes.trim() || "Unsold at auction; gate pass clearance issued for withdrawal by registered owner.",
      });
      await Promise.all([
        client.invalidateQueries({ queryKey: ["animal_dispositions"] }),
        client.invalidateQueries({ queryKey: ["auction-preregistration-list"] }),
      ]);
      toast.success(`Animal ${row.tag_number || row.reference} released. Gate pass ready.`);
      setShowReleaseConfirmDialog(null);
      setReleaseNotes("");
      setSelected(null);
      setGatePassTarget(response.data || row);
    } catch (error) {
      toast.error("Could not release this animal.", { description: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  async function download(row: Registration, kind: "document" | "certificate") {
    try {
      const response = await api.get(`production/dispositions/${row.id}/${kind}/`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      const type = response.data.type;
      link.download = `${row.reference}-${kind}.${kind === "certificate" || type.includes("pdf") ? "pdf" : type.includes("png") ? "png" : "jpg"}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("The document could not be downloaded.");
    }
  }

  const rows = data?.results || [];

  return (
    <section className="space-y-6 rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-7 shadow-xs">
      {/* Header with Title, Subtitle, and Scan QR Button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#EAF5EC] text-[#1E4D2B] shadow-2xs">
            <ClipboardList className="size-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Pre-Registration Records
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
              {staff
                ? "Review advance paperwork, request corrections, then confirm the animal's arrival."
                : "Show your AP reference at the market. Ready for arrival means the advance paperwork was reviewed."}
            </p>
          </div>
        </div>

        {staff && (
          <Button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="h-10 shrink-0 gap-2 rounded-xl bg-[#1E4D2B] px-4 font-semibold text-white shadow-xs transition-colors hover:bg-[#163b21]"
          >
            <QrCode className="size-4" />
            <span>Scan Pre-Registration QR</span>
          </Button>
        )}
      </div>

      {/* Scanned row banner */}
      {highlightedId !== null && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900"
        >
          <div className="flex items-center gap-2">
            <Check className="size-4 text-emerald-600" />
            <span>Scanned preregistration found. Its row is highlighted below.</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-emerald-800 hover:bg-emerald-100"
            onClick={() => {
              setHighlightedId(null);
              setSearch("");
              setDebouncedSearch("");
              setPage(1);
            }}
          >
            Show all preregistrations
          </Button>
        </div>
      )}

      {/* Filter toolbar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1.6fr_1.1fr_1.1fr_0.8fr]">
        <label className="space-y-1.5 text-xs font-semibold text-slate-700">
          <span>Search</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              aria-label="Find a preregistration"
              placeholder="AP reference, animal tag, or farmer name"
              value={search}
              onChange={event => setSearch(event.target.value)}
              className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-sm placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-[#1E4D2B]"
            />
          </div>
        </label>

        <label className="space-y-1.5 text-xs font-semibold text-slate-700">
          <span>Status</span>
          <div className="relative">
            <select
              aria-label="Filter by status"
              className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-8 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1E4D2B]"
              value={statusFilter}
              onChange={event => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="SUBMITTED">For Review</option>
              <option value="ARRIVED">Arrival Confirmed</option>
              <option value="READY">Ready for Sale</option>
              <option value="NEEDS_CORRECTION">Needs Correction</option>
              <option value="COMPLETED">Sale Approved</option>
              <option value="RELEASED">Released / Unsold (Pull-Out)</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          </div>
        </label>

        <label className="space-y-1.5 text-xs font-semibold text-slate-700">
          <span>Planned Arrival Date</span>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="date"
              aria-label="Filter by planned arrival date"
              value={plannedDate}
              onChange={event => {
                setPlannedDate(event.target.value);
                setPage(1);
              }}
              className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-sm text-slate-800 focus-visible:ring-1 focus-visible:ring-[#1E4D2B]"
            />
          </div>
        </label>

        <label className="space-y-1.5 text-xs font-semibold text-slate-700">
          <span>Rows per page</span>
          <div className="relative">
            <select
              aria-label="Rows per page"
              className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-8 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1E4D2B]"
              value={pageSize}
              onChange={event => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {[10, 25, 50, 100].map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          </div>
        </label>
      </div>

      {isPending && (
        <p role="status" className="py-8 text-center text-sm text-slate-500">
          Loading preregistrations...
        </p>
      )}
      {isError && (
        <p role="alert" className="py-8 text-center text-sm text-rose-700">
          Preregistrations could not be loaded.
        </p>
      )}
      {!isPending && !isError && (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200/90 shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-[#EAF5EC]">
                  <tr>
                    <th scope="col" className="px-4 py-3.5 text-xs font-bold tracking-tight text-[#1E4D2B]">
                      Reference
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-xs font-bold tracking-tight text-[#1E4D2B]">
                      Farmer
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-xs font-bold tracking-tight text-[#1E4D2B]">
                      Animal
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-xs font-bold tracking-tight text-[#1E4D2B]">
                      Planned Date
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-xs font-bold tracking-tight text-[#1E4D2B]">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-xs font-bold tracking-tight text-[#1E4D2B]">
                      Documents
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-xs font-bold tracking-tight text-[#1E4D2B]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.map(row => {
                    const fileCount = row.has_document ? 1 : 0;
                    const fileLabel = fileCount === 1 ? "1 file" : "0 files";

                    return (
                      <tr
                        key={row.id}
                        aria-selected={highlightedId === row.id}
                        className={
                          highlightedId === row.id
                            ? "bg-emerald-50/90 ring-2 ring-inset ring-emerald-500"
                            : "hover:bg-slate-50/60 transition-colors"
                        }
                      >
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <span className="inline-block rounded-lg bg-[#D7EEDD] px-2.5 py-1 font-mono text-xs font-bold text-[#1E4D2B]">
                            {row.reference}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-900">
                          {row.farmer_name || "Not recorded"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-slate-800">
                          {row.livestock_type_name ? `${row.livestock_type_name} (1 head)` : "Cattle (1 head)"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="size-3.5 text-slate-500" />
                            <span>{formatDisplayDate(row.target_date)}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5">
                          {renderStatusBadge(row.registration_status)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <FileText className="size-3.5 text-slate-500" />
                            <span>{fileLabel}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setPreview(null);
                                setSelected(row);
                              }}
                              className="h-8 rounded-xl border-[#1E4D2B] bg-white px-3 text-xs font-bold text-[#1E4D2B] shadow-2xs transition-colors hover:bg-[#EAF5EC] hover:text-[#163b21] gap-1.5"
                            >
                              <Eye className="size-3.5" />
                              <span>View</span>
                            </Button>
                            {row.registration_status === "RELEASED" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setGatePassTarget(row)}
                                className="h-8 rounded-xl border-amber-300 bg-amber-50 px-2.5 text-xs font-bold text-amber-900 shadow-2xs transition-colors hover:bg-amber-100 gap-1.5"
                                title="Print Official Gate Pass (Katibayan sa Paglalabas)"
                              >
                                <Printer className="size-3.5 text-amber-700" />
                                <span>Gate Pass</span>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!rows.length && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        No matching sale preregistrations.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 pt-1">
            <span>
              {data?.count
                ? `Showing ${(data.page - 1) * pageSize + 1}–${Math.min(data.page * pageSize, data.count)} of ${data.count}`
                : "0 preregistrations"}
            </span>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-xl"
                disabled={isFetching || (data?.page || 1) <= 1}
                onClick={() => setPage((data?.page || 1) - 1)}
              >
                Previous
              </Button>
              <span className="font-medium text-slate-700">
                Page {data?.page || 1} of {data?.pages || 1}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-xl"
                disabled={isFetching || (data?.page || 1) >= (data?.pages || 1)}
                onClick={() => setPage((data?.page || 1) + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Review Dialog */}
      <Dialog
        open={selected !== null || openingId !== null}
        onOpenChange={open => {
          if (!open && busy === null && openingId === null) {
            setSelected(null);
            setPreview(null);
            setIsEditingSpecs(false);
          }
        }}
      >
        <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1rem)] min-w-0 flex-col gap-0 overflow-y-auto overflow-x-hidden rounded-2xl border-slate-200 bg-white p-0 shadow-2xl sm:max-w-4xl">
          <DialogHeader className="shrink-0 border-b border-emerald-100 bg-emerald-50 px-5 py-5 pr-12 sm:px-7">
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-emerald-700">
              Auction preregistration
            </p>
            <DialogTitle className="text-xl font-bold text-slate-900">
              {selected?.reference || `AP-${String(openingId || "").padStart(6, "0")}`}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              Check the farmer details, supporting paperwork, and next step.
            </DialogDescription>
          </DialogHeader>
          {!selected && openingId !== null && (
            <div role="status" className="p-10 text-center text-sm text-emerald-800">
              Opening preregistration for review...
            </div>
          )}
          {(selected ? [selected] : []).map(row => (
            <article key={row.id} className="min-w-0 space-y-5 p-5 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900">
                  {labels[row.registration_status] || row.registration_status}
                </span>
                <span className="text-xs text-slate-500">Advance paperwork and arrival review</span>
              </div>
              <ol className="flex flex-wrap gap-2" aria-label="Preregistration progress">
                {(row.registration_status === "RELEASED"
                  ? ["SUBMITTED", "READY", "ARRIVED", "CHECKED", "RELEASED"]
                  : ["SUBMITTED", "READY", "ARRIVED", "CHECKED", "COMPLETED"]
                ).map((step, index) => {
                  const steps = row.registration_status === "RELEASED"
                    ? ["SUBMITTED", "READY", "ARRIVED", "CHECKED", "RELEASED"]
                    : ["SUBMITTED", "READY", "ARRIVED", "CHECKED", "COMPLETED"];
                  const current = steps.indexOf(row.registration_status);
                  const isReleased = step === "RELEASED" && row.registration_status === "RELEASED";
                  return (
                    <li
                      key={step}
                      aria-current={step === row.registration_status ? "step" : undefined}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                        isReleased
                          ? "bg-purple-700 text-white"
                          : index <= current
                          ? "bg-emerald-700 text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {index + 1}.{" "}
                      {
                        (
                          {
                            SUBMITTED: "Submitted",
                            READY: "Ready",
                            ARRIVED: "Arrived",
                            CHECKED: "Checked",
                            COMPLETED: "Sale approved",
                            RELEASED: "Released Unsold",
                          } as Record<string, string>
                        )[step]
                      }
                    </li>
                  );
                })}
              </ol>
              {/* ── ANIMAL SPECIFICATIONS & DETAILS ── */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                      <Tag className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {isEditingSpecs ? "Edit Animal Specifications" : "Animal Specifications & Details"}
                      </h3>
                      <p className="text-[11px] text-slate-500 truncate">
                        {isEditingSpecs
                          ? "Modify verified ear tag, scale weight, herd, breed, sex, and vaccination"
                          : "Physical attributes and verified measurements for this livestock entry."}
                      </p>
                    </div>
                  </div>

                  {staff && (
                    <Button
                      type="button"
                      variant={isEditingSpecs ? "outline" : "ghost"}
                      size="sm"
                      onClick={() => {
                        if (isEditingSpecs) {
                          setIsEditingSpecs(false);
                        } else {
                          startEditingSpecs(row);
                        }
                      }}
                      className={`h-7 text-xs font-semibold gap-1.5 px-2.5 rounded-lg shrink-0 cursor-pointer ${
                        isEditingSpecs
                          ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      }`}
                    >
                      {isEditingSpecs ? (
                        <>
                          <X className="size-3 text-amber-700" />
                          Cancel Edit
                        </>
                      ) : (
                        <>
                          <Pencil className="size-3 text-emerald-800" />
                          Edit Specs
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* ── BIOSECURITY & HEALTH DIAGNOSTIC ALERT ── */}
                {row.health_diagnostic?.has_active_disease ? (
                  <div className="flex items-start gap-3 rounded-xl border border-rose-300 bg-rose-50/90 p-3 text-rose-950 shadow-2xs">
                    <div className="size-8 rounded-lg bg-rose-200/80 text-rose-800 flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldAlert className="size-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-rose-800">
                          Biosecurity & Disease Hazard Alert
                        </span>
                        <span className="rounded-full bg-rose-200 px-2 py-0.2 text-[10px] font-black uppercase text-rose-900">
                          Active Case
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-rose-900 leading-relaxed">
                        This livestock has an active disease case on record:{" "}
                        <strong className="font-bold text-rose-950">
                          {row.health_diagnostic.active_diseases.map(d => `${d.name} (${d.status}${d.date ? ` • ${d.date}` : ""})`).join(", ")}
                        </strong>
                        . Requires immediate physical clinical assessment and possible quarantine isolation before pen admission.
                      </p>
                    </div>
                  </div>
                ) : row.health_diagnostic?.has_past_disease ? (
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-amber-950 shadow-2xs">
                    <div className="size-8 rounded-lg bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                      <HeartPulse className="size-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-amber-800">
                          Past Health & Disease History
                        </span>
                        <span className="rounded-full bg-amber-200 px-2 py-0.2 text-[10px] font-black uppercase text-amber-900">
                          Resolved
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-amber-900 leading-relaxed">
                        Past medical history:{" "}
                        <strong className="font-semibold text-amber-950">
                          {row.health_diagnostic.past_diseases.map(d => `${d.name} (${d.clinical_status === "RECOVERED" ? "Recovered" : "Closed"}${d.date ? ` • ${d.date}` : ""})`).join(", ")}
                        </strong>
                        . Inspect for secondary symptoms, respiratory sounds, or gait abnormalities.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-3 py-2 text-xs font-medium text-emerald-900">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                      <span>Cross-Check Diagnostic: Clean biosecurity status (no reported disease cases on file)</span>
                    </div>
                    <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-200/60">
                      Biosecurity Cleared
                    </span>
                  </div>
                )}

                {isEditingSpecs ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                      {/* 1. Ear Tag Input */}
                      <div className="flex flex-col justify-between rounded-xl border border-emerald-300 bg-emerald-50/20 p-2.5 sm:p-3 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-800">
                            Ear Tag #
                          </Label>
                          <Tag className="size-3.5 text-emerald-600" />
                        </div>
                        <Input
                          value={editTagNumber}
                          onChange={e => setEditTagNumber(e.target.value)}
                          placeholder="e.g. SALLIY-001"
                          className="h-8 text-xs font-bold rounded-lg mt-1.5 bg-white border-slate-200 focus-visible:ring-emerald-600"
                        />
                        <span className="mt-1 text-[9.5px] font-mono text-slate-400">
                          Ear tag confirmed on inspection
                        </span>
                      </div>

                      {/* 2. Assigned Herd Select */}
                      <div className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                            Assigned Herd
                          </Label>
                          <Layers className="size-3.5 text-slate-400" />
                        </div>
                        <select
                          value={editBatchId ?? ""}
                          onChange={e => setEditBatchId(e.target.value ? Number(e.target.value) : null)}
                          className="h-8 w-full text-xs font-medium rounded-lg border border-slate-200 bg-white px-2 mt-1.5"
                        >
                          <option value="">None (Individual Animal)</option>
                          {availableBatches.map(b => (
                            <option key={b.id} value={b.id}>
                              {b.batch_code} {b.batch_name ? `(${b.batch_name})` : ""}
                            </option>
                          ))}
                        </select>
                        <span className="mt-1 text-[9.5px] font-mono text-slate-400">
                          Optional herd enrollment
                        </span>
                      </div>

                      {/* 3. Scale Weight Input */}
                      <div className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                            Scale Weight
                          </Label>
                          <Scale className="size-3.5 text-slate-400" />
                        </div>
                        <div className="relative mt-1.5">
                          <Input
                            type="number"
                            step="0.01"
                            value={editWeight}
                            onChange={e => setEditWeight(e.target.value)}
                            placeholder="0.00"
                            className="h-8 text-xs font-bold rounded-lg pr-8 bg-white border-slate-200"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                            kg
                          </span>
                        </div>
                        <span className="mt-1 text-[9.5px] font-mono text-slate-400">
                          Recorded scale weight
                        </span>
                      </div>

                      {/* 4. Breed & Sex */}
                      <div className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                            Breed & Sex
                          </Label>
                          <Hourglass className="size-3.5 text-slate-400" />
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                          <select
                            value={editSex}
                            onChange={e => setEditSex(e.target.value)}
                            className="h-8 w-full text-xs font-medium rounded-lg border border-slate-200 bg-white px-2"
                          >
                            <option value="Female">Female</option>
                            <option value="Male">Male</option>
                          </select>
                          <LivestockBreedField
                            id="auction-review-breed"
                            species={row.livestock_type_name}
                            value={editBreed}
                            onChange={setEditBreed}
                            placeholder="Breed"
                            controlClassName="h-8 rounded-lg text-xs"
                          />
                        </div>
                        <span className="mt-1 text-[9.5px] font-mono text-slate-400">
                          Physical classification
                        </span>
                      </div>

                      {/* 5. Vaccination Status Input */}
                      <div className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                            Last Vaccination
                          </Label>
                          <Shield className="size-3.5 text-slate-400" />
                        </div>
                        <Input
                          type="date"
                          value={editLastVaccinationDate}
                          onChange={e => setEditLastVaccinationDate(e.target.value)}
                          max={new Date().toISOString().split("T")[0]}
                          className="h-8 text-xs rounded-lg mt-1.5 bg-white border-slate-200"
                        />
                        <span className="mt-1 text-[9.5px] font-mono text-slate-400">
                          Leave blank if unrecorded
                        </span>
                      </div>
                    </div>

                    {/* Save / Cancel buttons */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingSpecs(false)}
                        disabled={savingSpecs}
                        className="h-8 px-3 text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleSaveSpecs(row)}
                        disabled={savingSpecs}
                        className="h-8 px-4 text-xs bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg cursor-pointer shadow-xs"
                      >
                        {savingSpecs ? "Saving..." : "Save Specifications"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* View Mode: 5 Cards Grid */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                    {/* 1. Ear Tag ID */}
                    <div className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                          EAR TAG ID
                        </span>
                        <Tag className="size-3.5 text-slate-400" />
                      </div>
                      <div className="mt-2">
                        <p className="text-base sm:text-lg font-bold font-mono tracking-tight text-slate-900 break-words">
                          {row.tag_number || "Unassigned"}
                        </p>
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                          <Check className="size-3 stroke-[2.5]" />
                          <span>Standard Tag & Barcode Confirmed</span>
                        </div>
                      </div>
                    </div>

                    {/* 2. Assigned Herd */}
                    <div className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                          ASSIGNED HERD
                        </span>
                        <Layers className="size-3.5 text-slate-400" />
                      </div>
                      <div className="mt-2">
                        <p className="text-base sm:text-lg font-bold tracking-tight text-slate-900 truncate">
                          {row.batch_name
                            ? `${row.batch_code} (${row.batch_name})`
                            : row.batch_code || "None (Individual)"}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {row.batch_id ? "Enrolled in herd batch" : "Not grouped in a herd"}
                        </p>
                      </div>
                    </div>

                    {/* 3. Scale Weight */}
                    <div className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                          SCALE WEIGHT
                        </span>
                        <div className="flex items-center gap-1.5">
                          {row.health_diagnostic?.weight_delta != null && row.health_diagnostic.weight_delta !== 0 && (
                            <span
                              className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                row.health_diagnostic.weight_delta > 0
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-rose-50 text-rose-700 border border-rose-200"
                              }`}
                            >
                              {row.health_diagnostic.weight_delta > 0 ? (
                                <TrendingUp className="size-2.5" />
                              ) : (
                                <TrendingDown className="size-2.5" />
                              )}
                              {row.health_diagnostic.weight_delta > 0 ? "+" : ""}
                              {row.health_diagnostic.weight_delta} kg
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              row.weight != null
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {row.weight != null ? "Weighed" : "Unweighed"}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
                          {row.weight != null
                            ? `${Number(row.weight).toLocaleString("en-US", {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 2,
                              })} kg`
                            : "—"}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {row.health_diagnostic?.previous_weight != null && row.weight != null && Number(row.weight) !== row.health_diagnostic.previous_weight
                            ? `Baseline: ${row.health_diagnostic.previous_weight} kg (${row.health_diagnostic.weight_delta_percent && row.health_diagnostic.weight_delta_percent > 0 ? `+` : ``}${row.health_diagnostic.weight_delta_percent}% delta)`
                            : row.livestock_created_at
                            ? `Registered: ${formatCalendarDate(row.livestock_created_at)}`
                            : "Verified on-site weight"}
                        </p>
                      </div>
                    </div>

                    {/* 4. Breed & Sex */}
                    <div className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                          BREED & SEX
                        </span>
                        <Hourglass className="size-3.5 text-slate-400" />
                      </div>
                      <div className="mt-2">
                        <p className="text-base sm:text-lg font-bold tracking-tight text-slate-900 truncate">
                          {row.breed || "Standard"} • {row.sex || "Unspecified"}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500 truncate">
                          Species: {row.livestock_type_name || "Livestock"}
                        </p>
                      </div>
                    </div>

                    {/* 5. Vaccination Status */}
                    <div className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                          VACCINATION STATUS
                        </span>
                        <Shield className="size-3.5 text-slate-400" />
                      </div>
                      <div className="mt-2">
                        <p className="text-base sm:text-lg font-bold tracking-tight text-slate-900 truncate">
                          {row.last_vaccination_date
                            ? `Vaccinated: ${formatCalendarDate(row.last_vaccination_date)}`
                            : "Unvaccinated / Pending"}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                          {row.health_diagnostic?.vaccination_status === "CURRENT" ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] border border-emerald-200">
                              <Check className="size-2.5" />
                              Current ({row.health_diagnostic.vaccination_days_ago}d ago)
                            </span>
                          ) : row.health_diagnostic?.vaccination_status === "OVERDUE" ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] border border-amber-200">
                              <Clock className="size-2.5" />
                              Overdue ({row.health_diagnostic.vaccination_days_ago}d ago)
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">
                              No vaccination record on file
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── VISIT AND PAPERWORK ── */}
              <section className="space-y-3 rounded-xl border border-slate-200 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Visit and paperwork
                </h3>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-slate-500">Farmer / Owner</dt>
                    <dd className="mt-1 break-words font-semibold text-slate-900">
                      {row.farmer_name || "Not recorded"}
                      {row.barangay_name && (
                        <span className="ml-1.5 text-xs font-normal text-slate-500">
                          (Brgy. {row.barangay_name})
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Planned arrival</dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      {row.target_date || "Not specified"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Destination</dt>
                    <dd className="mt-1 break-words text-slate-900">
                      {row.target_destination || "Not specified"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Original certificate number</dt>
                    <dd className="mt-1 break-words font-mono text-slate-900">
                      {row.original_certificate_number || "Not provided"}
                    </dd>
                  </div>
                </dl>
              </section>
              {!staff && (
                <QrCodePass
                  code={row.reference}
                  qrPayload={row.reference}
                  title="Auction preregistration"
                  subtitle="Save this QR and show it to Auction staff to open your submission."
                  ownerName={row.farmer_name}
                  status={row.registration_status}
                  compact
                />
              )}
              {row.notes && (
                <section className="rounded-xl bg-slate-50 p-4">
                  <h3 className="mb-1 text-xs font-semibold text-slate-500">Farmer notes</h3>
                  <p className="whitespace-pre-wrap break-words text-sm text-slate-700">
                    {row.notes}
                  </p>
                </section>
              )}
              {row.review_notes && (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  Staff feedback: {row.review_notes}
                </p>
              )}
              {row.has_document && (
                <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Supporting document</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      View the submitted copy and compare it with the animal details.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={previewLoading}
                      onClick={() => void viewDocument(row)}
                    >
                      {previewLoading ? "Opening..." : "View document"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void download(row, "document")}
                    >
                      Download document
                    </Button>
                  </div>
                </section>
              )}
              {preview && (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                    <h3 className="text-sm font-semibold">Submitted document</h3>
                    <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>
                      Hide preview
                    </Button>
                  </div>
                  {preview.type.includes("pdf") ? (
                    <iframe
                      title={`Supporting document for ${row.reference}`}
                      src={preview.url}
                      className="h-[60dvh] w-full bg-white"
                    />
                  ) : (
                    // Uploaded evidence is a private authenticated blob, not a public image URL.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={preview.url}
                      alt={`Supporting document for ${row.reference}`}
                      className="mx-auto max-h-[60dvh] max-w-full object-contain p-3"
                    />
                  )}
                  <p className="px-3 pb-3 text-xs text-slate-500">
                    If your browser cannot preview the document, use Download document.
                  </p>
                </div>
              )}
              {staff && ["SUBMITTED", "READY", "ARRIVED"].includes(row.registration_status) && (
                <form className="space-y-4" onSubmit={event => event.preventDefault()}>
                  <label className={`block space-y-2 text-sm font-semibold ${row.registration_status === "ARRIVED" ? "rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-amber-950" : "text-slate-800"}`}>
                    <span className="flex items-center justify-between gap-2">
                      {row.registration_status === "ARRIVED"
                        ? "Physical inspection findings"
                        : "Review notes"}
                      {row.registration_status === "ARRIVED" && <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">Required *</span>}
                    </span>
                    <textarea
                      name="review_notes"
                      rows={3}
                      required={row.registration_status === "ARRIVED"}
                      aria-required={row.registration_status === "ARRIVED"}
                      aria-label={`${row.registration_status === "ARRIVED" ? "Physical inspection findings" : "Review notes"} for ${row.reference}`}
                      onInput={event => event.currentTarget.setCustomValidity("")}
                      placeholder={
                        row.registration_status === "ARRIVED"
                          ? "Enter the inspection reference and physical checks completed."
                          : "Explain any missing information or corrections needed."}
                      className={`w-full resize-y rounded-xl border bg-white px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 ${row.registration_status === "ARRIVED" ? "border-amber-400 focus:border-amber-600 focus:ring-amber-200" : "border-slate-200 focus:border-emerald-500 focus:ring-emerald-100"}`}
                    />
                    <span className="block text-xs font-normal text-slate-500">
                      {row.registration_status === "ARRIVED"
                        ? "Required before confirming physical checks."
                        : "Required when returning the submission for correction."}
                    </span>
                  </label>
                  <DialogFooter className="sticky -bottom-5 z-10 gap-3 border-t border-slate-200 bg-white py-4 sm:-bottom-7 sm:justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => {
                        setSelected(null);
                        setPreview(null);
                        setIsEditingSpecs(false);
                      }}
                      className="h-auto min-h-11 rounded-xl px-5"
                    >
                      Close
                    </Button>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      {row.registration_status !== "ARRIVED" && (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busy !== null}
                          onClick={event => void update(row, event.currentTarget.form!, "NEEDS_CORRECTION")}
                          className="h-auto min-h-11 whitespace-normal rounded-xl border-rose-200 px-5 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                        >
                          Return for Correction
                        </Button>
                      )}
                      <Button
                        type="button"
                        disabled={busy !== null}
                        onClick={event =>
                          void update(
                            row,
                            event.currentTarget.form!,
                            row.registration_status === "SUBMITTED"
                              ? "READY"
                              : row.registration_status === "READY"
                              ? "ARRIVED"
                              : "CHECKED"
                          )
                        }
                        className="h-auto min-h-11 whitespace-normal rounded-xl bg-emerald-700 px-5 text-white hover:bg-emerald-800"
                      >
                        {busy === row.id
                          ? "Saving..."
                          : row.registration_status === "SUBMITTED"
                          ? "Mark Ready for Arrival"
                          : row.registration_status === "READY"
                          ? "Confirm Arrival"
                          : "Confirm Physical Checks"}
                      </Button>
                    </div>
                  </DialogFooter>
                </form>
              )}
              {!staff && row.registration_status === "NEEDS_CORRECTION" && (
                <form
                  className="space-y-2"
                  onSubmit={event => {
                    event.preventDefault();
                    void update(row, event.currentTarget);
                  }}
                >
                  <label className="block text-xs font-medium">
                    Planned date
                    <Input
                      type="date"
                      name="target_date"
                      min={new Date().toISOString().split("T")[0]}
                      defaultValue={row.target_date || ""}
                    />
                  </label>
                  <label className="block text-xs font-medium">
                    Destination
                    <Input name="target_destination" defaultValue={row.target_destination} />
                  </label>
                  <label className="block text-xs font-medium">
                    Original certificate number
                    <Input
                      name="original_certificate_number"
                      defaultValue={row.original_certificate_number}
                    />
                  </label>
                  <label className="block text-xs font-medium">
                    Notes
                    <Input name="notes" defaultValue={row.notes} maxLength={255} />
                  </label>
                  <label className="block text-xs font-medium">
                    Replace supporting document (PDF, JPG, PNG; up to 5 MB)
                    <Input
                      type="file"
                      name="supporting_document"
                      accept=".pdf,.jpg,.jpeg,.png"
                    />
                  </label>
                  <Button size="sm" type="submit" disabled={busy !== null}>
                    {busy === row.id ? "Sending..." : "Resubmit for document review"}
                  </Button>
                </form>
              )}
              {(!staff || !["SUBMITTED", "READY", "ARRIVED"].includes(row.registration_status)) && (
                <DialogFooter className="sticky -bottom-5 z-10 gap-3 border-t border-slate-200 bg-white py-4 sm:-bottom-7 sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => {
                      setSelected(null);
                      setPreview(null);
                      setIsEditingSpecs(false);
                    }}
                    className="min-h-11 rounded-xl px-5"
                  >
                    Close
                  </Button>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {staff && (row.registration_status === "CHECKED" || row.registration_status === "ARRIVED") && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy !== null}
                        onClick={() => {
                          setShowReleaseConfirmDialog(row);
                          setReleaseNotes("Unsold at auction; gate pass clearance issued for withdrawal by registered owner.");
                        }}
                        className="h-auto min-h-12 gap-2 rounded-xl border-amber-300 bg-amber-50 px-4 text-xs font-bold text-amber-900 hover:bg-amber-100 shadow-2xs"
                      >
                        <LogOut className="size-4 text-amber-700" />
                        <span>Release Unsold (Pull-Out)</span>
                      </Button>
                    )}

                    {row.registration_status === "RELEASED" && (
                      <Button
                        type="button"
                        onClick={() => setGatePassTarget(row)}
                        className="h-auto min-h-12 gap-2 rounded-xl bg-amber-700 px-5 text-sm font-bold text-white shadow-xs hover:bg-amber-800"
                      >
                        <Printer className="size-4.5" />
                        <span>Print Gate Pass Clearance</span>
                      </Button>
                    )}

                    {staff && row.registration_status === "CHECKED" && onRecordSale && (
                      <Button
                        disabled={busy !== null}
                        onClick={async () => {
                          setBusy(row.id);
                          try {
                            await onRecordSale(row);
                          } catch {
                            toast.error("Could not open the sale form.");
                          } finally {
                            setBusy(null);
                          }
                        }}
                        className="h-auto min-h-12 gap-3 whitespace-normal rounded-xl border border-emerald-600 bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:ring-emerald-500 disabled:opacity-60"
                      >
                        <FileCheck2 aria-hidden="true" className="size-5 shrink-0" />
                        <span>{busy === row.id ? "Opening..." : "Record Completed Sale"}</span>
                        <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                      </Button>
                    )}
                  </div>
                </DialogFooter>
              )}
            </article>
          ))}
        </DialogContent>
      </Dialog>

      {/* Release / Pull-Out Confirmation Dialog */}
      <Dialog open={showReleaseConfirmDialog !== null} onOpenChange={(open) => !open && setShowReleaseConfirmDialog(null)}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                <LogOut className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Release Unsold Animal (Pull-Out)
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  {showReleaseConfirmDialog?.reference} · Tag: {showReleaseConfirmDialog?.tag_number}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs text-slate-700">
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 leading-relaxed text-amber-900">
              The animal will be marked as <strong>UNSOLD / RELEASED</strong> and cleared to return to its registered farm in <strong>{showReleaseConfirmDialog?.barangay_name || "Padre Garcia"}</strong>. An official <strong>Auction Gate Pass Clearance</strong> will be generated immediately.
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Remarks / Reason for Withdrawal</Label>
              <textarea
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                placeholder="Unsold at auction; gate pass clearance issued for withdrawal by registered owner."
                className="w-full min-h-[70px] rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-600"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() => setShowReleaseConfirmDialog(null)}
              className="h-9 rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy !== null}
              onClick={() => void handleConfirmRelease()}
              className="h-9 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold px-4 gap-1.5 shadow-xs"
            >
              <LogOut className="size-3.5" />
              {busy !== null ? "Releasing..." : "Confirm Release & Open Gate Pass"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Official Auction Pull-Out Gate Pass Dialog */}
      <AuctionPullOutGatePassDialog
        open={Boolean(gatePassTarget)}
        onOpenChange={(open) => !open && setGatePassTarget(null)}
        record={gatePassTarget}
        allRecords={rows}
      />

      {staff && (
        <UniversalQrScannerDialog
          isOpen={scannerOpen}
          onOpenChange={setScannerOpen}
          role="auction"
          onSelectPreregistration={id => void openRegistration(id)}
        />
      )}
    </section>
  );
}
