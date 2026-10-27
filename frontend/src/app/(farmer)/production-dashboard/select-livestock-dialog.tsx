"use client";

import { Button } from "@/components/ui/button";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/components/ui/utils";
import api from "@/lib/axios";
import { useQuery } from "@tanstack/react-query";
import { formatCalendarDate,formatLivestockAge } from "@/lib/livestock-age";
import {
CalendarDays,
Check,
ChevronLeft,
ChevronRight,
Search,
ShieldCheck,
Syringe,
Tag,
Weight,
X,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { useMemo,useState,useSyncExternalStore } from "react";
import { getAvatarById,type LivestockInventoryItem } from "../livestock-inventory/livestock-inventory";
import type { ProductionType } from "./production-analytics";

interface SelectLivestockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: LivestockInventoryItem[];
  selectedId: string | null;
  onSelect: (item: LivestockInventoryItem) => void;
  productionType?: ProductionType;
  title?: string;
  description?: string;
  emptyStateText?: string;
  warnOnActiveDisease?: boolean;
  excludeSibatVerifiedDisease?: boolean;
}

interface LivestockPickerFieldProps {
  items: LivestockInventoryItem[];
  id: string;
  selectedId: string;
  onSelect: (item: LivestockInventoryItem) => void;
  label: string;
  placeholder: string;
  dialogTitle?: string;
  dialogDescription?: string;
  emptyStateText?: string;
  disabled?: boolean;
  warnOnActiveDisease?: boolean;
  excludeSibatVerifiedDisease?: boolean;
}

interface DiseaseReportSummary {
  id: number;
  livestock: number | null;
  batch: number | null;
  name: string;
  status: "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION";
  record_date: string | null;
}

const PAGE_SIZE = 6;
const subscribeToLocalStorage = () => () => undefined;

function useLocalStorageAsset(key: string) {
  return useSyncExternalStore(
    subscribeToLocalStorage,
    () => (typeof window === "undefined" ? null : window.localStorage.getItem(key)),
    () => null,
  );
}

function LivestockPicture({ item, selected }: { item: LivestockInventoryItem; selected: boolean }) {
  const localPhoto = useLocalStorageAsset(`livestock_photo_${item.id}`);
  const localAvatar = useLocalStorageAsset(`livestock_avatar_${item.id}`);
  const photoUrl = item.photoUrl || localPhoto;
  const avatar = getAvatarById(item.avatarKey || localAvatar, item.livestockTypeName);

  return (
    <span className={cn("relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border", selected ? "border-emerald-700 ring-2 ring-emerald-700/20" : "border-slate-200")}>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Livestock photos may require the signed-in browser session.
        <img src={photoUrl} alt={`${item.tagNumber || item.livestockTypeName} livestock`} className="size-full object-cover" />
      ) : (
        <span className={cn("flex size-full items-center justify-center bg-gradient-to-br text-3xl", avatar.bgGradient)} role="img" aria-label={`${avatar.name} illustration`}>
          {avatar.emoji}
        </span>
      )}
      {selected && <span className="absolute bottom-1 right-1 flex size-5 items-center justify-center rounded-full bg-emerald-700 text-white"><Check className="size-3.5" /></span>}
    </span>
  );
}

const formatDate = (date: string | null | undefined) => {
  if (!date) return "Unknown date";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return new Date(date).toLocaleDateString();
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function SelectLivestockDialog({
  open,
  onOpenChange,
  items,
  selectedId,
  onSelect,
  productionType,
  title = "Choose Production Livestock",
  description,
  emptyStateText,
  warnOnActiveDisease = false,
  excludeSibatVerifiedDisease = false,
}: SelectLivestockDialogProps) {
  const [query, setQuery] = useState("");
  const [species, setSpecies] = useState("ALL");
  const [page, setPage] = useState(1);
  const [isCheckingDiseaseReports, setIsCheckingDiseaseReports] = useState(false);
  const [diseaseWarning, setDiseaseWarning] = useState<{
    item: LivestockInventoryItem;
    reports: DiseaseReportSummary[];
    lookupFailed: boolean;
    blocked: boolean;
  } | null>(null);
  const diseaseReportsQuery = useQuery<DiseaseReportSummary[]>({
    queryKey: ["farmer-disease-reports-for-recording"],
    queryFn: async () => (await api.get<DiseaseReportSummary[]>("diseases/cases/")).data,
    enabled: open && (warnOnActiveDisease || excludeSibatVerifiedDisease),
    staleTime: 0,
  });

  const verifiedReportMatchesItem = (item: LivestockInventoryItem) => {
    if (!excludeSibatVerifiedDisease || !diseaseReportsQuery.data) return false;
    const batchId = item.batchId ?? (item.entryType === "BATCH" ? Number(item.id) : null);
    const animalIds = new Set((item.entryType === "BATCH"
      ? items.filter((candidate) => candidate.batchId === batchId)
      : [item]
    ).map((candidate) => String(candidate.id)));
    return diseaseReportsQuery.data.some((report) => report.status === "VERIFIED" && (
      (report.livestock != null && animalIds.has(String(report.livestock)))
      || (report.batch != null && batchId != null && report.batch === batchId)
    ));
  };
  const diseaseLookupPending = excludeSibatVerifiedDisease && diseaseReportsQuery.isLoading;
  const diseaseLookupFailed = excludeSibatVerifiedDisease && diseaseReportsQuery.isError;
  const eligibleItems = diseaseLookupPending || diseaseLookupFailed
    ? []
    : items.filter((item) => !verifiedReportMatchesItem(item));

  const speciesOptions = useMemo(
    () =>
      Array.from(
        new Set(eligibleItems.map((item) => item.livestockTypeName).filter(Boolean)),
      ).sort(),
    [eligibleItems],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return eligibleItems.filter((item) => {
      const matchesSpecies =
        species === "ALL" || item.livestockTypeName.toLowerCase() === species.toLowerCase();
      const matchesQuery =
        !normalizedQuery ||
        [
          item.tagNumber,
          item.batchCode,
          item.batchName,
          item.livestockTypeName,
          item.breed,
          item.sex,
          item.id,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));
      return matchesSpecies && matchesQuery;
    });
  }, [eligibleItems, query, species]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleItems = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setQuery("");
      setSpecies("ALL");
      setPage(1);
      setDiseaseWarning(null);
    }
    onOpenChange(nextOpen);
  };

  const confirmSelection = (item: LivestockInventoryItem) => {
    onSelect(item);
    handleOpenChange(false);
  };

  const handleSelectItem = async (item: LivestockInventoryItem) => {
    if (!warnOnActiveDisease && !excludeSibatVerifiedDisease) {
      confirmSelection(item);
      return;
    }

    setIsCheckingDiseaseReports(true);
    const result = await diseaseReportsQuery.refetch();
    const reports = result.data;
    const lookupFailed = result.isError || !reports;
    setIsCheckingDiseaseReports(false);

    if (lookupFailed || !reports) {
      setDiseaseWarning({ item, reports: [], lookupFailed: true, blocked: excludeSibatVerifiedDisease });
      return;
    }

    const selectedBatchId = item.batchId ?? (item.entryType === "BATCH" ? Number(item.id) : null);
    const relatedAnimalIds = new Set(
      (item.entryType === "BATCH"
        ? items.filter((candidate) => candidate.batchId === selectedBatchId)
        : [item]
      ).map((candidate) => String(candidate.id)),
    );
    const matchingReports = reports.filter((report) =>
      (warnOnActiveDisease || excludeSibatVerifiedDisease ? ["PENDING", "VERIFIED"] : ["PENDING"]).includes(report.status)
      && (
        (report.livestock != null && relatedAnimalIds.has(String(report.livestock)))
        || (report.batch != null && selectedBatchId != null && report.batch === selectedBatchId)
      ),
    );

    const verifiedMatches = excludeSibatVerifiedDisease
      ? matchingReports.filter((report) => report.status === "VERIFIED")
      : [];
    if (verifiedMatches.length > 0) {
      setDiseaseWarning({ item, reports: verifiedMatches, lookupFailed: false, blocked: true });
      return;
    }

    if (matchingReports.length > 0) {
      setDiseaseWarning({ item, reports: matchingReports, lookupFailed: false, blocked: false });
      return;
    }
    confirmSelection(item);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-1rem)] sm:w-full sm:max-w-4xl sm:max-h-[90dvh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl sm:rounded-3xl border-0 shadow-2xl bg-slate-50">
        <DialogHeader className="relative overflow-hidden shrink-0 px-4 py-4 sm:px-6 sm:py-5 pr-12 sm:pr-14 md:pr-16 bg-gradient-to-r from-[#244a20] via-[#2D5A27] to-[#3E7A36] text-left">
          <div className="absolute -right-12 -top-16 size-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="relative flex items-start gap-3 min-w-0">
            <div className="size-10 sm:size-11 rounded-xl sm:rounded-2xl bg-white/15 border border-white/15 flex items-center justify-center shrink-0">
              <Tag className="size-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg sm:text-xl font-black text-white leading-tight break-words">
                {title}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-white/75 mt-1 break-words">
                {description ?? (productionType === "milk"
                  ? `Showing female livestock of milk-capable species; calves and yearlings are excluded (${eligibleItems.length} eligible).`
                  : `All ${eligibleItems.length} MAO-approved livestock records are available below.`)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="shrink-0 px-3.5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 bg-white space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search tag, herd, breed, or ID..."
                className="pl-9 pr-9 h-10 rounded-xl bg-slate-50 border-slate-200"
                autoComplete="off"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setPage(1);
                  }}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {["ALL", ...speciesOptions].map((option) => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={species === option ? "default" : "outline"}
                  onClick={() => {
                    setSpecies(option);
                    setPage(1);
                  }}
                  className={cn(
                    "h-10 rounded-xl text-xs font-bold shrink-0",
                    species === option && "bg-[#2D5A27] hover:bg-[#244a20]",
                  )}
                >
                  {option === "ALL" ? "All species" : option}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-slate-600">
              {filtered.length === 0
                ? "No matching livestock"
                : `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
              <ShieldCheck className="size-3.5" />
              Approved only
            </span>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-6">
          {diseaseLookupPending ? (
            <EmptyState text="Checking disease reports before showing production livestock…" />
          ) : diseaseLookupFailed ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
              <p className="max-w-md text-sm text-slate-600">Disease reports could not be checked, so production livestock selection is temporarily unavailable.</p>
              <Button type="button" variant="outline" onClick={() => void diseaseReportsQuery.refetch()}>Retry check</Button>
            </div>
          ) : eligibleItems.length === 0 ? (
            <EmptyState text={emptyStateText ?? (productionType === "milk" ? "No approved female livestock of a milk-capable species is available." : "No approved livestock is available for production logging. Livestock with SIBAT-verified disease reports are excluded.")} />
          ) : filtered.length === 0 ? (
            <EmptyState text="No livestock matches the current search and species filter." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {visibleItems.map((item) => {
                const selected = selectedId === item.id;
                const title =
                  item.entryType === "INDIVIDUAL"
                    ? item.tagNumber || `Animal #${item.id}`
                    : item.batchCode || item.batchName || `Herd #${item.id}`;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void handleSelectItem(item)}
                    disabled={isCheckingDiseaseReports}
                    className={cn(
                      "group text-left rounded-2xl border-2 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-md",
                      selected
                        ? "border-[#2D5A27] ring-2 ring-[#2D5A27]/15"
                        : "border-slate-200 hover:border-emerald-300",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <LivestockPicture item={item} selected={selected} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-black text-slate-900 whitespace-normal break-words">{title}</p>
                            <p className="text-xs text-slate-500 mt-0.5 whitespace-normal break-words">
                              {item.livestockTypeName} · {item.breed || "Breed not specified"} · {item.sex || "Sex not specified"}
                            </p>
                          </div>
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                            Approved
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-600">
                          <span className="inline-flex min-w-0 items-center gap-1.5 break-words">
                            <CalendarDays className="size-3.5 text-slate-400" />
                            {item.birthDate ? `Age ${formatLivestockAge(item.age)} · Born ${formatCalendarDate(item.birthDate)}` : "Age unknown · Birth date unknown"}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Weight className="size-3.5 text-slate-400" />
                            {item.weight != null ? `${item.weight} kg` : "No weight"}
                          </span>
                          <span className="inline-flex items-center gap-1.5 col-span-2">
                            <Syringe className="size-3.5 text-slate-400" />
                            {item.lastVaccinationDate
                              ? `Vaccinated ${formatDate(item.lastVaccinationDate)}`
                              : "No vaccination date recorded"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="shrink-0 px-4 sm:px-6 py-3.5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[11px] text-slate-500">
            Page {safePage} of {pageCount} · {eligibleItems.length} eligible record{eligibleItems.length === 1 ? "" : "s"} total
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              className="rounded-xl font-bold gap-1"
            >
              <ChevronLeft className="size-4" /> Previous
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={safePage >= pageCount}
              onClick={() => setPage(safePage + 1)}
              className="rounded-xl bg-[#2D5A27] hover:bg-[#244a20] font-bold gap-1"
            >
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
      <AlertDialog
        open={diseaseWarning !== null}
        onOpenChange={(isOpen) => !isOpen && setDiseaseWarning(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-amber-100 text-amber-800 sm:mx-0">
              <AlertTriangle className="size-5" />
            </div>
            <AlertDialogTitle>Disease report on this livestock</AlertDialogTitle>
            <AlertDialogDescription>
              {diseaseWarning?.lookupFailed
                ? diseaseWarning.blocked
                  ? "Disease report status could not be checked, so this livestock cannot be selected for production right now."
                  : "The disease reports could not be checked right now. Do you still want to continue recording?"
                : diseaseWarning?.blocked
                  ? `A SIBAT-verified disease report is linked to ${diseaseWarning?.item.tagNumber || diseaseWarning?.item.batchCode || "this livestock"}. It cannot be selected for production.`
                  : `A pending disease report is linked to ${diseaseWarning?.item.tagNumber || diseaseWarning?.item.batchCode || "this livestock"}. Continuing does not change or bypass the disease report review.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {diseaseWarning && !diseaseWarning.lookupFailed && (
            <ul className="max-h-36 space-y-2 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
              {diseaseWarning.reports.map((report) => (
                <li key={report.id} className="flex items-start justify-between gap-3">
                  <span className="font-medium text-amber-950">{report.name}</span>
                  <span className="shrink-0 text-xs font-semibold text-amber-800">
                    {report.status === "VERIFIED" ? "SIBAT verified" : "Pending review"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            {!diseaseWarning?.blocked && <AlertDialogAction
              onClick={() => {
                if (diseaseWarning) confirmSelection(diseaseWarning.item);
                setDiseaseWarning(null);
              }}
              className="bg-amber-700 text-white hover:bg-amber-800"
            >
              Yes, continue recording
            </AlertDialogAction>}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function LivestockPickerField({
  items,
  id,
  selectedId,
  onSelect,
  label,
  placeholder,
  dialogTitle = "Choose Livestock",
  dialogDescription = "Choose from your approved livestock records.",
  emptyStateText = "No approved livestock is available.",
  disabled = false,
  warnOnActiveDisease = false,
  excludeSibatVerifiedDisease = false,
}: LivestockPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const selectedItem = items.find((item) => item.id === selectedId);
  const selectedName = selectedItem
    ? selectedItem.entryType === "INDIVIDUAL"
      ? selectedItem.tagNumber || `Animal #${selectedItem.id}`
      : selectedItem.batchCode || selectedItem.batchName || `Herd #${selectedItem.id}`
    : null;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Button
        type="button"
        id={id}
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="h-auto min-h-11 w-full justify-between gap-3 rounded-xl border-slate-200 bg-slate-50 px-3 py-2 text-left font-normal hover:bg-white"
      >
        <span className="flex min-w-0 items-center gap-3">
          {selectedItem ? (
            <LivestockPicture item={selectedItem} selected={false} />
          ) : (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-slate-400">
              <Tag className="size-5" />
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate font-semibold text-slate-900">
              {selectedName ?? placeholder}
            </span>
            {selectedItem && (
              <span className="block truncate text-xs text-slate-500">
                {selectedItem.livestockTypeName} · {selectedItem.breed || "Breed not specified"} · {selectedItem.sex || "Sex not specified"}
              </span>
            )}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-slate-500" />
      </Button>
      <SelectLivestockDialog
        open={open}
        onOpenChange={setOpen}
        items={items}
        selectedId={selectedId || null}
        onSelect={onSelect}
        title={dialogTitle}
        description={dialogDescription}
        emptyStateText={emptyStateText}
        warnOnActiveDisease={warnOnActiveDisease}
        excludeSibatVerifiedDisease={excludeSibatVerifiedDisease}
      />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="min-h-56 rounded-2xl border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-center p-8">
      <Search className="size-8 text-slate-300 mb-3" />
      <p className="text-sm font-bold text-slate-700">{text}</p>
      <p className="text-xs text-slate-400 mt-1">Try clearing the search or selecting another species.</p>
    </div>
  );
}
