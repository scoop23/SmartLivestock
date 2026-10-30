"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  History,
  Layers,
  Loader2,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Tag,
  UserMinus,
  Users,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  mapInventory,
  useCreateLivestockBatch,
  useLivestockBatches,
  useLivestockTypes,
  useManageInventoryHerd,
  type InventoryApiItem,
  type LivestockBatchItem,
  type LivestockInventoryItem,
} from "../livestock-inventory";

export type ManageHerdAnimalInput = Omit<Partial<LivestockInventoryItem>, "id" | "tagNumber" | "operationalStatus"> & {
  id: number | string;
  tagNumber?: string | null;
  livestockTypeName: string;
  operationalStatus?: string;
  batchId?: number | null;
  batchCode?: string | null;
  batchName?: string | null;
};

export interface ManageHerdDialogProps {
  item?: ManageHerdAnimalInput | null;
  animal?: ManageHerdAnimalInput | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: "assign" | "move" | "remove" | "history";
  onSuccess?: (updated: LivestockInventoryItem) => void;
}

function extractApiError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as Record<string, unknown> | undefined;
    if (data && typeof data === "object") {
      if (typeof data.error === "string" && data.error.trim()) return data.error;
      if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
      for (const val of Object.values(data)) {
        if (Array.isArray(val) && typeof val[0] === "string") return val[0];
        if (typeof val === "string" && val.trim()) return val;
      }
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function ManageHerdDialog(props: ManageHerdDialogProps) {
  const target = props.item ?? props.animal ?? null;
  return (
    <ManageHerdDialogContent
      key={`${props.open}:${target?.id ?? "none"}:${target?.batchId ?? "unassigned"}:${props.initialMode ?? "auto"}`}
      {...props}
      item={target}
    />
  );
}

function ManageHerdDialogContent({
  item,
  animal,
  open,
  onOpenChange,
  initialMode,
  onSuccess,
}: ManageHerdDialogProps) {
  const resolvedItem = item ?? animal ?? null;
  const {
    data: allBatches = [],
    isLoading: isBatchesLoading,
    isError: isBatchesError,
    refetch: refetchBatches,
  } = useLivestockBatches({ includeRoster: false });
  const { data: livestockTypes = {} } = useLivestockTypes();
  const manageHerdMutation = useManageInventoryHerd();
  const createBatchMutation = useCreateLivestockBatch();

  const animalId = resolvedItem?.id ? Number(resolvedItem.id) : null;
  const { data: freshDetail } = useQuery<InventoryApiItem>({
    queryKey: ["inventory_item", animalId],
    queryFn: async () => {
      const res = await api.get<InventoryApiItem>(`livestock/inventory/${animalId}/`);
      return res.data;
    },
    enabled: open && Boolean(animalId),
  });

  const activeItem = useMemo(() => {
    if (!resolvedItem) return null;
    if (freshDetail) {
      const mapped = mapInventory(freshDetail);
      return {
        ...resolvedItem,
        ...mapped,
      };
    }
    return {
      ...resolvedItem,
      id: Number(resolvedItem.id),
      operationalStatus: (resolvedItem.operationalStatus || "ACTIVE") as LivestockInventoryItem["operationalStatus"],
    };
  }, [resolvedItem, freshDetail]);

  const hasCurrentHerd = Boolean(activeItem?.batchId);

  const defaultTab: "assign" | "move" | "remove" | "history" = useMemo(() => {
    if (initialMode) {
      if (initialMode === "assign" && hasCurrentHerd) return "move";
      if ((initialMode === "move" || initialMode === "remove") && !hasCurrentHerd) return "assign";
      return initialMode;
    }
    return hasCurrentHerd ? "move" : "assign";
  }, [initialMode, hasCurrentHerd]);

  const [mode, setMode] = useState<"assign" | "move" | "remove" | "history">(defaultTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [confirmStep, setConfirmStep] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Inline Herd Creation state when farmer has no herds (or wants a new herd)
  const [isCreatingNewHerd, setIsCreatingNewHerd] = useState(false);
  const [newHerdName, setNewHerdName] = useState("");
  const [newHerdPen, setNewHerdPen] = useState("");
  const [newHerdFeed, setNewHerdFeed] = useState("");

  // Herds of the same species that are active or empty and can be reopened
  const eligibleHerds = useMemo(() => {
    if (!activeItem) return [];
    const targetSpecies = (activeItem.livestockTypeName || "").trim().toLowerCase();
    return allBatches.filter((b) => {
      const isSameSpecies = (b.livestockTypeName || "").trim().toLowerCase() === targetSpecies;
      const isAvailable = b.status === "ACTIVE" || b.totalAnimals === 0;
      const isDifferentFromCurrent = !activeItem.batchId || Number(b.id) !== Number(activeItem.batchId);
      return isSameSpecies && isAvailable && isDifferentFromCurrent;
    });
  }, [allBatches, activeItem]);

  const currentHerdDetails: LivestockBatchItem | null = useMemo(() => {
    if (!activeItem?.batchId) return null;
    return allBatches.find((b) => Number(b.id) === Number(activeItem.batchId)) || null;
  }, [allBatches, activeItem]);

  const filteredHerds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return eligibleHerds;
    return eligibleHerds.filter(
      (b) =>
        (b.batchName || "").toLowerCase().includes(q) ||
        (b.batchCode || "").toLowerCase().includes(q) ||
        (b.housingPen || "").toLowerCase().includes(q) ||
        (b.barangayName || "").toLowerCase().includes(q)
    );
  }, [eligibleHerds, searchQuery]);

  const selectedHerd = useMemo(
    () => eligibleHerds.find((b) => Number(b.id) === Number(selectedBatchId)) || null,
    [eligibleHerds, selectedBatchId]
  );

  if (!activeItem) return null;

  const isBusy = manageHerdMutation.isPending || createBatchMutation.isPending;
  const isInactive = activeItem.operationalStatus !== "ACTIVE";
  const animalLabel = activeItem.tagNumber || `Animal #${activeItem.id}`;
  const currentHerdLabel =
    activeItem.batchName || activeItem.batchCode || (activeItem.batchId ? `Herd #${activeItem.batchId}` : "Unassigned");

  const handleConfirmAddOrMove = async () => {
    if (!selectedHerd || isBusy) return;
    setErrorMessage(null);
    try {
      const actionType = hasCurrentHerd ? "MOVE" : "ADD";
      const updated = await manageHerdMutation.mutateAsync({
        id: activeItem.id,
        action: actionType,
        batch: Number(selectedHerd.id),
        notes: notes.trim() || undefined,
      });

      toast.success(
        actionType === "MOVE"
          ? `${animalLabel} moved to ${selectedHerd.batchName || selectedHerd.batchCode}`
          : `${animalLabel} added to ${selectedHerd.batchName || selectedHerd.batchCode}`,
        {
          description:
            actionType === "MOVE"
              ? `Transferred from ${currentHerdLabel} to ${selectedHerd.batchName || selectedHerd.batchCode} (${selectedHerd.batchCode}).`
              : `Assigned to herd ${selectedHerd.batchName || selectedHerd.batchCode} (${selectedHerd.batchCode}).`,
        }
      );
      onSuccess?.(updated);
      onOpenChange(false);
    } catch (err) {
      const msg = extractApiError(err, "Could not update herd membership. Please try again.");
      setErrorMessage(msg);
      toast.error(msg);
    }
  };

  const handleConfirmRemove = async () => {
    if (!hasCurrentHerd || isBusy) return;
    setErrorMessage(null);
    try {
      const updated = await manageHerdMutation.mutateAsync({
        id: activeItem.id,
        action: "REMOVE",
        batch: null,
        notes: notes.trim() || undefined,
      });

      toast.success(`${animalLabel} removed from ${currentHerdLabel}`, {
        description: `${animalLabel} remains active in your livestock inventory as an unassigned individual animal.`,
      });
      onSuccess?.(updated);
      onOpenChange(false);
    } catch (err) {
      const msg = extractApiError(err, "Could not remove animal from herd. Please try again.");
      setErrorMessage(msg);
      toast.error(msg);
    }
  };

  const handleCreateHerdAndAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy) return;
    setErrorMessage(null);

    const trimmedName = newHerdName.trim();
    if (!trimmedName) {
      setErrorMessage("Please enter a name for the new herd.");
      return;
    }

    const speciesId =
      livestockTypes[activeItem.livestockTypeName] ||
      Object.entries(livestockTypes).find(
        ([name]) => name.toLowerCase() === activeItem.livestockTypeName.toLowerCase()
      )?.[1];

    if (!speciesId) {
      setErrorMessage(`Could not resolve livestock species ID for ${activeItem.livestockTypeName}.`);
      return;
    }

    try {
      const createdBatch = await createBatchMutation.mutateAsync({
        livestock_type: speciesId,
        batch_name: trimmedName,
        housing_pen: newHerdPen.trim() || undefined,
        feed_type: newHerdFeed.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      const updated = await manageHerdMutation.mutateAsync({
        id: activeItem.id,
        action: hasCurrentHerd ? "MOVE" : "ADD",
        batch: Number(createdBatch.id),
        notes: notes.trim() || `Assigned to newly created herd ${trimmedName}.`,
      });

      toast.success(
        `Created herd "${trimmedName}" and assigned ${animalLabel}`,
        {
          description: `${animalLabel} is now a member of ${trimmedName} (${createdBatch.batch_code || "Active Herd"}).`,
        }
      );
      onSuccess?.(updated);
      onOpenChange(false);
    } catch (err) {
      const msg = extractApiError(err, "Could not create herd and assign animal.");
      setErrorMessage(msg);
      toast.error(msg);
    }
  };

  const historyEntries = activeItem.herdMembershipHistory ?? [];

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[90dvh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl sm:max-w-xl">
        {/* Header */}
        <DialogHeader className="border-b border-slate-100 bg-slate-50/70 p-4 sm:p-5 text-left">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Badge className="bg-[#1E4D2B]/10 text-[#1E4D2B] border-[#1E4D2B]/20 text-[10px] font-bold uppercase tracking-wider">
              <Layers className="mr-1 size-3" />
              Individual Herd Management
            </Badge>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="font-mono text-[11px] font-bold text-slate-700 bg-white">
                <Tag className="mr-1 size-3 text-emerald-700" />
                {animalLabel}
              </Badge>
              <Badge className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                {activeItem.livestockTypeName}
              </Badge>
            </div>
          </div>

          <DialogTitle className="mt-1.5 text-base sm:text-lg font-black text-slate-950">
            {hasCurrentHerd ? "Manage Herd Membership" : "Add Livestock to a Herd"}
          </DialogTitle>
          <DialogDescription className="text-xs font-medium text-slate-600">
            {hasCurrentHerd ? (
              <>
                <strong>{animalLabel}</strong> is currently assigned to{" "}
                <strong className="text-emerald-800">
                  {activeItem.batchName || activeItem.batchCode}
                </strong>
                {activeItem.batchCode ? ` (${activeItem.batchCode})` : ""}. You can move this animal to another eligible herd or remove it from this herd.
              </>
            ) : (
              <>
                <strong>{animalLabel}</strong> is currently an unassigned individual animal. Select an active{" "}
                <strong>{activeItem.livestockTypeName}</strong> herd to assign it.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Current Herd Status Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={cn(
                  "size-9 rounded-xl flex items-center justify-center shrink-0",
                  hasCurrentHerd
                    ? "bg-teal-100 text-teal-800 border border-teal-200"
                    : "bg-slate-200/80 text-slate-600"
                )}
              >
                <Layers className="size-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Current Herd Assignment
                </span>
                {hasCurrentHerd ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs sm:text-sm font-bold text-slate-950 truncate">
                      {activeItem.batchName || currentHerdDetails?.batchName || activeItem.batchCode}
                    </span>
                    {activeItem.batchCode && (
                      <span className="rounded bg-teal-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-teal-800 border border-teal-200">
                        {activeItem.batchCode}
                      </span>
                    )}
                    {currentHerdDetails && (
                      <span className="text-[11px] font-semibold text-slate-500">
                        • {currentHerdDetails.totalAnimals}{" "}
                        {currentHerdDetails.totalAnimals === 1 ? "head" : "heads"}
                        {currentHerdDetails.housingPen ? ` • ${currentHerdDetails.housingPen}` : ""}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs sm:text-sm font-bold text-slate-700">
                    Unassigned (Independent Individual Record)
                  </span>
                )}
              </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shrink-0 self-start sm:self-center">
              {!hasCurrentHerd ? (
                <button
                  type="button"
                  onClick={() => {
                    setMode("assign");
                    setConfirmStep(false);
                    setErrorMessage(null);
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                    mode === "assign"
                      ? "bg-[#1E4D2B] text-white shadow-2xs"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  <Plus className="size-3" />
                  <span>Add to Herd</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("move");
                      setConfirmStep(false);
                      setErrorMessage(null);
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                      mode === "move"
                        ? "bg-[#1E4D2B] text-white shadow-2xs"
                        : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <ArrowRightLeft className="size-3" />
                    <span>Move Herd</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("remove");
                      setConfirmStep(false);
                      setErrorMessage(null);
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                      mode === "remove"
                        ? "bg-amber-700 text-white shadow-2xs"
                        : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <UserMinus className="size-3" />
                    <span>Remove</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setMode("history");
                  setConfirmStep(false);
                  setErrorMessage(null);
                }}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer",
                  mode === "history"
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <History className="size-3" />
                <span>History ({historyEntries.length})</span>
              </button>
            </div>
          </div>

          {isInactive && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-medium text-amber-950 flex items-start gap-2">
              <AlertTriangle className="size-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                This animal has operational status <strong>{activeItem.operationalStatus}</strong>. Only active livestock can be added to, moved between, or removed from a herd.
              </span>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs font-semibold text-rose-900 flex items-start gap-2"
            >
              <AlertTriangle className="size-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ── MODE 1 & 2: ADD TO HERD / MOVE TO ANOTHER HERD ── */}
          {(mode === "assign" || mode === "move") && !isInactive && (
            <div className="space-y-3.5">
              {isCreatingNewHerd ? (
                <form onSubmit={handleCreateHerdAndAssign} className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <Plus className="size-3.5 text-emerald-700" />
                      Create New {activeItem.livestockTypeName} Herd & Assign {animalLabel}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewHerd(false)}
                      className="text-[11px] font-bold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                    >
                      Back to existing herds
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="sm:col-span-2 space-y-1">
                      <Label htmlFor="new-herd-name" className="text-xs font-bold text-slate-800">
                        Herd / Cohort Name <span className="text-rose-600">*</span>
                      </Label>
                      <Input
                        id="new-herd-name"
                        value={newHerdName}
                        onChange={(e) => setNewHerdName(e.target.value)}
                        placeholder={`e.g. North Pasture ${activeItem.livestockTypeName} Herd`}
                        className="h-9 bg-white text-xs font-semibold"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="new-herd-pen" className="text-xs font-semibold text-slate-700">
                        Housing Pen / Location (optional)
                      </Label>
                      <Input
                        id="new-herd-pen"
                        value={newHerdPen}
                        onChange={(e) => setNewHerdPen(e.target.value)}
                        placeholder="e.g. Pen A-1 / Barn 2"
                        className="h-9 bg-white text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="new-herd-feed" className="text-xs font-semibold text-slate-700">
                        Feed Regimen (optional)
                      </Label>
                      <Input
                        id="new-herd-feed"
                        value={newHerdFeed}
                        onChange={(e) => setNewHerdFeed(e.target.value)}
                        placeholder="e.g. Napier Grass & Concentrate"
                        className="h-9 bg-white text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCreatingNewHerd(false)}
                      disabled={isBusy}
                      className="h-8 text-xs font-semibold"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isBusy}
                      className="h-8 bg-[#1E4D2B] hover:bg-[#163b21] text-white text-xs font-bold gap-1.5"
                    >
                      {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                      <span>Create Herd & {hasCurrentHerd ? "Move Animal" : "Add Animal"}</span>
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  {/* Search & Create Herd Bar */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                      <Input
                        aria-label="Search eligible herds"
                        placeholder={`Search ${activeItem.livestockTypeName} herds by name, code, or pen...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-9 pl-8 text-xs bg-slate-50/80 border-slate-200 rounded-lg"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCreatingNewHerd(true)}
                      className="h-9 rounded-lg border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-900 text-xs font-bold gap-1.5 shrink-0"
                    >
                      <Plus className="size-3.5 text-emerald-700" />
                      <span>New Herd</span>
                    </Button>
                  </div>

                  {/* Eligible Herds List */}
                  {isBatchesLoading ? (
                    <div className="py-8 text-center space-y-2">
                      <Loader2 className="size-5 animate-spin text-emerald-700 mx-auto" />
                      <p className="text-xs font-semibold text-slate-600">Loading your active herds...</p>
                    </div>
                  ) : isBatchesError ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-center space-y-2">
                      <p className="text-xs font-bold text-rose-900">Unable to load your herds.</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void refetchBatches()}
                        className="h-8 text-xs font-bold"
                      >
                        Retry
                      </Button>
                    </div>
                  ) : eligibleHerds.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-5 text-center space-y-2.5">
                      <div className="size-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
                        <Layers className="size-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                          {hasCurrentHerd
                            ? `No Other Active ${activeItem.livestockTypeName} Herds Found`
                            : `No Active ${activeItem.livestockTypeName} Herds Yet`}
                        </h4>
                        <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                          {hasCurrentHerd
                            ? `You currently have no other active ${activeItem.livestockTypeName.toLowerCase()} herd to move ${animalLabel} into. Create a new herd below to move this animal.`
                            : `You don't have an active ${activeItem.livestockTypeName.toLowerCase()} herd yet. Create one now and ${animalLabel} will be assigned automatically.`}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setIsCreatingNewHerd(true)}
                        className="h-8.5 rounded-lg bg-[#1E4D2B] hover:bg-[#163b21] text-white text-xs font-bold gap-1.5"
                      >
                        <Plus className="size-3.5" />
                        <span>Create {activeItem.livestockTypeName} Herd</span>
                      </Button>
                    </div>
                  ) : filteredHerds.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                      No herds match &ldquo;{searchQuery}&rdquo;.
                    </div>
                  ) : (
                    <div
                      role="radiogroup"
                      aria-label="Select destination herd"
                      className="max-h-56 overflow-y-auto space-y-2 pr-1"
                    >
                      {filteredHerds.map((herd) => {
                        const isSelected = Number(selectedBatchId) === Number(herd.id);
                        return (
                          <button
                            key={herd.id}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => {
                              setSelectedBatchId(Number(herd.id));
                              setConfirmStep(false);
                              setErrorMessage(null);
                            }}
                            className={cn(
                              "w-full text-left rounded-xl border p-3 transition-all flex items-start justify-between gap-3 cursor-pointer",
                              isSelected
                                ? "border-[#1E4D2B] bg-emerald-50/70 ring-2 ring-[#1E4D2B]/20 shadow-xs"
                                : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50/70"
                            )}
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs sm:text-sm font-bold text-slate-950">
                                  {herd.batchName || "Unnamed Herd"}
                                </span>
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 border border-slate-200">
                                  {herd.batchCode}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-slate-600">
                                <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold">
                                  <Users className="size-3 text-emerald-700" />
                                  {herd.totalAnimals} {herd.totalAnimals === 1 ? "animal" : "animals"}
                                </span>
                                {herd.status !== "ACTIVE" && herd.totalAnimals === 0 && (
                                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                    Reopens when assigned
                                  </span>
                                )}
                                {herd.housingPen && (
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin className="size-3 text-slate-400" />
                                    {herd.housingPen.toLowerCase().startsWith("pen")
                                      ? herd.housingPen
                                      : `Pen: ${herd.housingPen}`}
                                  </span>
                                )}
                                {herd.barangayName && (
                                  <span className="text-slate-500">Brgy. {herd.barangayName}</span>
                                )}
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-1.5">
                              {isSelected ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#1E4D2B] px-2.5 py-1 text-[10px] font-bold text-white">
                                  <CheckCircle2 className="size-3" />
                                  Selected
                                </span>
                              ) : (
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                                  Select
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Optional Reason / Notes */}
                  {eligibleHerds.length > 0 && (
                    <div className="space-y-1">
                      <Label htmlFor="herd-change-notes" className="text-xs font-semibold text-slate-700">
                        Reason / Notes (optional)
                      </Label>
                      <Input
                        id="herd-change-notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={
                          mode === "move"
                            ? "e.g. Regrouped by weight class or breeding pen"
                            : "e.g. Added to main grazing cohort"
                        }
                        className="h-9 text-xs bg-white"
                      />
                    </div>
                  )}

                  {/* Confirmation Banner for Move / Add */}
                  {selectedHerd && confirmStep && (
                    <div className="rounded-xl border border-emerald-300 bg-emerald-50/90 p-3.5 space-y-2">
                      <div className="flex items-start gap-2.5">
                        <CheckCircle2 className="size-4.5 text-emerald-700 shrink-0 mt-0.5" />
                        <div className="text-xs text-emerald-950 space-y-1">
                          <p className="font-bold">
                            {mode === "move"
                              ? `Confirm moving ${animalLabel} to ${selectedHerd.batchName || selectedHerd.batchCode}?`
                              : `Confirm adding ${animalLabel} to ${selectedHerd.batchName || selectedHerd.batchCode}?`}
                          </p>
                          <p className="text-emerald-900 leading-relaxed">
                            {mode === "move" ? (
                              <>
                                <strong>{animalLabel}</strong> will be removed from{" "}
                                <strong>{currentHerdLabel}</strong> and assigned to{" "}
                                <strong>{selectedHerd.batchName || selectedHerd.batchCode}</strong> (
                                {selectedHerd.batchCode}) in a single update. All health, production, and review records remain intact.
                              </>
                            ) : (
                              <>
                                <strong>{animalLabel}</strong> will be added to{" "}
                                <strong>{selectedHerd.batchName || selectedHerd.batchCode}</strong> (
                                {selectedHerd.batchCode}).
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── MODE 3: REMOVE FROM HERD ── */}
          {mode === "remove" && hasCurrentHerd && !isInactive && (
            <div className="space-y-3.5">
              <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-3.5 space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="size-5 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-1.5 text-xs text-amber-950">
                    <h4 className="font-bold text-sm">
                      Remove {animalLabel} from {currentHerdLabel}?
                    </h4>
                    <p className="leading-relaxed text-amber-900">
                      Removing this animal from <strong>{currentHerdLabel}</strong> will detach it from the herd roster so it is tracked as an unassigned individual animal.
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] font-medium text-amber-900">
                      <li>
                        <strong>Remains in Inventory:</strong> {animalLabel} will <strong>NOT</strong> be deleted from your livestock inventory.
                      </li>
                      <li>
                        <strong>Active Status Preserved:</strong> It will <strong>NOT</strong> be marked as sold, deceased, slaughtered, or transferred.
                      </li>
                      <li>
                        <strong>History Intact:</strong> All health, vaccination, treatment, weight, production, and breeding records are preserved.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="remove-herd-notes" className="text-xs font-semibold text-slate-700">
                  Reason for removing from herd (optional)
                </Label>
                <Textarea
                  id="remove-herd-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Separated into individual stall for closer monitoring"
                  className="text-xs bg-white resize-none"
                />
              </div>
            </div>
          )}

          {/* ── MODE 4: HERD MEMBERSHIP HISTORY ── */}
          {mode === "history" && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <History className="size-3.5 text-emerald-700" />
                  Herd Assignment & Movement History
                </h4>
                <span className="text-[11px] font-medium text-slate-500">
                  {historyEntries.length} {historyEntries.length === 1 ? "event" : "events"}
                </span>
              </div>

              {historyEntries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center space-y-1.5">
                  <Clock className="size-5 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No Herd Changes Recorded Yet</p>
                  <p className="text-[11px] text-slate-500">
                    When this animal is added to a herd, moved between herds, or removed from a herd, the audit trail will appear here.
                  </p>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {historyEntries.map((entry) => {
                    const badgeStyle =
                      entry.action === "ADDED"
                        ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                        : entry.action === "MOVED"
                        ? "bg-sky-100 text-sky-900 border-sky-300"
                        : "bg-amber-100 text-amber-900 border-amber-300";

                    return (
                      <div
                        key={entry.id}
                        className="rounded-xl border border-slate-200 bg-white p-3 text-xs space-y-1.5 shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <Badge className={cn("text-[10px] font-bold px-2 py-0.5 border", badgeStyle)}>
                            {entry.action_label || entry.action}
                          </Badge>
                          <span className="text-[11px] font-mono text-slate-500">
                            {new Date(entry.created_at).toLocaleString()}
                          </span>
                        </div>

                        <div className="text-xs text-slate-800 font-medium">
                          {entry.action === "ADDED" && (
                            <span>
                              Assigned to herd{" "}
                              <strong className="text-slate-950">
                                {entry.new_batch_name || entry.new_batch_code || `Herd #${entry.new_batch}`}
                              </strong>
                              {entry.new_batch_code ? ` (${entry.new_batch_code})` : ""}
                            </span>
                          )}
                          {entry.action === "MOVED" && (
                            <span>
                              Moved from{" "}
                              <strong className="text-slate-950">
                                {entry.previous_batch_name || entry.previous_batch_code || "Previous Herd"}
                              </strong>{" "}
                              →{" "}
                              <strong className="text-emerald-900">
                                {entry.new_batch_name || entry.new_batch_code || "New Herd"}
                              </strong>
                            </span>
                          )}
                          {entry.action === "REMOVED" && (
                            <span>
                              Removed from herd{" "}
                              <strong className="text-slate-950">
                                {entry.previous_batch_name || entry.previous_batch_code || "Previous Herd"}
                              </strong>{" "}
                              (remains active in inventory)
                            </span>
                          )}
                        </div>

                        {entry.notes && (
                          <p className="text-[11px] text-slate-600 italic bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                            &ldquo;{entry.notes}&rdquo;
                          </p>
                        )}

                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <ShieldCheck className="size-3 text-emerald-600" />
                          <span>Recorded by {entry.acted_by_name}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isCreatingNewHerd && (
          <DialogFooter className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5 flex flex-row items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isBusy}
              className="h-9 rounded-lg text-xs font-semibold"
            >
              {mode === "history" ? "Close" : "Cancel"}
            </Button>

            {(mode === "assign" || mode === "move") && !isInactive && eligibleHerds.length > 0 && (
              <>
                {mode === "move" && !confirmStep ? (
                  <Button
                    type="button"
                    disabled={!selectedHerd || isBusy}
                    onClick={() => setConfirmStep(true)}
                    className="h-9 rounded-lg bg-[#1E4D2B] hover:bg-[#163b21] text-white text-xs font-bold gap-1.5"
                  >
                    <ArrowRightLeft className="size-3.5" />
                    <span>Review Move</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={!selectedHerd || isBusy}
                    onClick={() => void handleConfirmAddOrMove()}
                    className="h-9 rounded-lg bg-[#1E4D2B] hover:bg-[#163b21] text-white text-xs font-bold gap-1.5"
                  >
                    {isBusy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : mode === "move" ? (
                      <ArrowRightLeft className="size-3.5" />
                    ) : (
                      <CheckCircle2 className="size-3.5" />
                    )}
                    <span>
                      {isBusy
                        ? "Saving..."
                        : mode === "move"
                        ? `Confirm Move to ${selectedHerd?.batchCode || "Herd"}`
                        : `Add to ${selectedHerd?.batchCode || "Herd"}`}
                    </span>
                  </Button>
                )}
              </>
            )}

            {mode === "remove" && hasCurrentHerd && !isInactive && (
              <Button
                type="button"
                disabled={isBusy}
                onClick={() => void handleConfirmRemove()}
                className="h-9 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold gap-1.5"
              >
                {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <UserMinus className="size-3.5" />}
                <span>{isBusy ? "Removing..." : "Confirm Remove from Herd"}</span>
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
