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
import { cn } from "@/components/ui/utils";
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
}: SelectLivestockDialogProps) {
  const [query, setQuery] = useState("");
  const [species, setSpecies] = useState("ALL");
  const [page, setPage] = useState(1);

  const eligibleItems = items;

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
    }
    onOpenChange(nextOpen);
  };

  return (
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
                Choose Production Livestock
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-white/75 mt-1 break-words">
                {productionType === "milk"
                  ? `Showing female livestock of milk-capable species; calves and yearlings are excluded (${eligibleItems.length} eligible).`
                  : `All ${eligibleItems.length} MAO-approved livestock records are available below.`}
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
          {eligibleItems.length === 0 ? (
            <EmptyState text={productionType === "milk" ? "No approved female livestock of a milk-capable species is available." : "No approved livestock is available for production logging."} />
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
                    onClick={() => {
                      onSelect(item);
                      handleOpenChange(false);
                    }}
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
