"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Baby,
  Calendar,
  CheckCircle2,
  Clock,
  Dna,
  HeartPulse,
  Layers,
  Milk,
  Scale,
  ShieldCheck,
  Tag,
  Weight,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import api from "@/lib/axios";
import type { LivestockInventoryItem } from "./page";

interface ProductionRecordItem {
  id: number;
  livestockId?: number;
  livestock?: number;
  productionType: string;
  quantity: number;
  unit: string;
  recordDate: string;
  status: string;
  notes?: string;
}

interface WeightRecordItem {
  id: number;
  livestock: number;
  weight: number;
  weighing_date: string;
  notes?: string;
}

interface CalvingRecordItem {
  id: number;
  dam: number;
  calf_tag: string;
  calf_sex: string;
  birth_weight: number | null;
  calving_date: string;
  breed: string;
  calving_ease: string;
  notes?: string;
}

interface LivestockDetailsDialogProps {
  livestock: LivestockInventoryItem | null;
  open: boolean;
  onOpenChange: () => void;
}

const getStatusBadge = (status?: string) => {
  switch (status) {
    case "APPROVED":
      return (
        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 flex items-center gap-1 font-bold text-xs uppercase tracking-wider">
          <CheckCircle2 className="size-3 text-emerald-600" />
          Approved
        </Badge>
      );
    case "VERIFIED":
      return (
        <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100 border-sky-200 flex items-center gap-1 font-bold text-xs uppercase tracking-wider">
          <ShieldCheck className="size-3 text-sky-600" />
          Verified by SIBAT
        </Badge>
      );
    case "PENDING":
      return (
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 flex items-center gap-1 font-bold text-xs uppercase tracking-wider">
          <Clock className="size-3 text-amber-600" />
          Pending Review
        </Badge>
      );
    case "SUBJECT_TO_REVISION":
    case "REJECTED":
      return (
        <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 border-amber-300 flex items-center gap-1 font-bold text-xs uppercase tracking-wider">
          <RotateCcw className="size-3 text-amber-700" />
          Subject to Revision
        </Badge>
      );
    default:
      return <Badge variant="outline">{status ?? "Unknown"}</Badge>;
  }
};

export default function LivestockDetailsDialog({
  livestock,
  open,
  onOpenChange,
}: LivestockDetailsDialogProps) {
  const animalId = livestock?.id ? Number(livestock.id) : null;

  // Real production records
  const { data: productionRecords = [] } = useQuery<ProductionRecordItem[]>({
    queryKey: ["production"],
    queryFn: async () => {
      const res = await api.get("production/records/");
      return (res.data || []).map((r: any) => ({
        id: r.id,
        livestockId: r.livestock,
        productionType: r.production_type?.toLowerCase() || "milk",
        quantity: Number(r.quantity) || 0,
        unit: r.unit || "LITERS",
        recordDate: r.record_date,
        status: r.status,
        notes: r.notes,
      }));
    },
    enabled: open && !!animalId,
  });

  // Real weight records
  const { data: weightRecords = [] } = useQuery<WeightRecordItem[]>({
    queryKey: ["weight_records"],
    queryFn: async () => {
      const res = await api.get("production/weights/");
      return res.data || [];
    },
    enabled: open && !!animalId,
  });

  // Real calving records
  const { data: calvingRecords = [] } = useQuery<CalvingRecordItem[]>({
    queryKey: ["calving_records"],
    queryFn: async () => {
      const res = await api.get("production/calving/");
      return res.data || [];
    },
    enabled: open && !!animalId,
  });

  // Filter for this specific animal
  const animalProductions = productionRecords.filter(
    (p) => p.livestockId === animalId
  );
  const animalWeights = weightRecords
    .filter((w) => w.livestock === animalId)
    .sort((a, b) => new Date(b.weighing_date).getTime() - new Date(a.weighing_date).getTime());
  const animalCalves = calvingRecords.filter((c) => c.dam === animalId);

  const titleText =
    livestock?.entryType === "INDIVIDUAL"
      ? livestock.tagNumber || `Tagged #${livestock.id}`
      : `${livestock?.quantity}x ${livestock?.livestockTypeName} (Batch)`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-[95vw] h-[600px] flex flex-col p-0 gap-0 overflow-hidden rounded-3xl border-slate-200 shadow-2xl">
        {/* Header Ribbon */}
        <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-100/80 text-emerald-800">
                <Layers className="size-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-slate-900 leading-tight">
                  {titleText}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800">{livestock?.livestockTypeName}</span>
                  <span>•</span>
                  <span>{livestock?.breed || "Standard Breed"}</span>
                  <span>•</span>
                  <span>{livestock?.sex}</span>
                </DialogDescription>
              </div>
            </div>
            {getStatusBadge(livestock?.status)}
          </div>
        </DialogHeader>

        {/* Tabbed Profile & Live Activity */}
        {livestock && (
          <Tabs defaultValue="profile" className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="px-5 sm:px-6 py-2 bg-slate-50 border-b border-slate-100 shrink-0">
              <ScrollArea className="w-full">
                <TabsList className="bg-slate-200/70 p-1 h-auto inline-flex gap-1 rounded-xl">
                  <TabsTrigger value="profile" className="px-3.5 py-1.5 text-xs font-bold rounded-lg">
                    Overview Profile
                  </TabsTrigger>
                  <TabsTrigger value="production" className="px-3.5 py-1.5 text-xs font-bold rounded-lg">
                    Yields ({animalProductions.length})
                  </TabsTrigger>
                  <TabsTrigger value="weights" className="px-3.5 py-1.5 text-xs font-bold rounded-lg">
                    Weight Logs ({animalWeights.length})
                  </TabsTrigger>
                  <TabsTrigger value="calving" className="px-3.5 py-1.5 text-xs font-bold rounded-lg">
                    Calves ({animalCalves.length})
                  </TabsTrigger>
                </TabsList>
              </ScrollArea>
            </div>

            <div className="flex-1 min-h-0 relative">
              {/* Tab 1: Profile & Registry Details */}
              <TabsContent value="profile" className="m-0 h-full focus-visible:outline-none">
                <ScrollArea className="h-full w-full">
                  <div className="p-5 sm:p-6 space-y-4">
                    {/* Quick Specs Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Entry Mode</span>
                        <p className="font-bold text-slate-900 text-sm mt-0.5">{livestock.entryType}</p>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Head Count</span>
                        <p className="font-bold text-slate-900 text-sm mt-0.5">{livestock.quantity} head{livestock.quantity > 1 ? "s" : ""}</p>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Scale Weight</span>
                        <p className="font-bold text-slate-900 text-sm mt-0.5">
                          {livestock.weight != null ? `${livestock.weight} kg` : "Not weighed"}
                        </p>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vaccination Status</span>
                        <p className="font-bold text-slate-900 text-sm mt-0.5">
                          {livestock.lastVaccinationDate ? `Vaccinated (${livestock.lastVaccinationDate})` : "Unvaccinated"}
                        </p>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Registration Date</span>
                        <p className="font-bold text-slate-900 text-sm mt-0.5">
                          {livestock.createdAt ? new Date(livestock.createdAt).toLocaleDateString() : "—"}
                        </p>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Internal ID</span>
                        <p className="font-bold text-slate-900 text-sm mt-0.5">#{livestock.id}</p>
                      </div>
                    </div>

                    {/* Official Review Remarks */}
                    {livestock.reviewRemarks && (
                      <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-950 mb-1">
                          <ShieldCheck className="size-4 text-emerald-700" />
                          <span>Municipal SIBAT / MAO Review Remarks</span>
                        </div>
                        <p className="text-emerald-900 leading-relaxed italic">
                          &ldquo;{livestock.reviewRemarks}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Tab 2: Production Records */}
              <TabsContent value="production" className="m-0 h-full focus-visible:outline-none">
                <ScrollArea className="h-full w-full">
                  <div className="p-5 sm:p-6">
                    {animalProductions.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        <Milk className="size-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-600">No production records for this animal</p>
                        <p className="mt-0.5">Daily milk yields or outputs will appear here when logged.</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {animalProductions.map((p) => (
                          <div
                            key={p.id}
                            className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                          >
                            <div>
                              <p className="font-bold text-slate-900 capitalize">{p.productionType} Output</p>
                              <p className="text-slate-500 text-[11px] mt-0.5">
                                {p.recordDate} {p.notes ? `• "${p.notes}"` : ""}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="font-black text-slate-900 block text-sm">
                                {p.quantity} {p.unit === "LITERS" ? "L" : p.unit}
                              </span>
                              <span className="text-[10px] font-semibold text-emerald-700">{p.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Tab 3: Weight History */}
              <TabsContent value="weights" className="m-0 h-full focus-visible:outline-none">
                <ScrollArea className="h-full w-full">
                  <div className="p-5 sm:p-6">
                    {animalWeights.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        <Scale className="size-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-600">No weight records logged</p>
                        <p className="mt-0.5">Log scale weight in the Production Hub to calculate ADG velocity.</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {animalWeights.map((w, idx) => {
                          const prev = animalWeights[idx + 1];
                          const gainKg = prev ? Number((w.weight - prev.weight).toFixed(1)) : null;
                          return (
                            <div
                              key={w.id}
                              className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                            >
                              <div>
                                <p className="font-bold text-slate-900">{w.weighing_date}</p>
                                <p className="text-slate-500 text-[11px] mt-0.5">
                                  {w.notes || "Periodic weighing measurement"}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="font-black text-slate-900 block text-sm">
                                  {w.weight} kg
                                </span>
                                {gainKg !== null && (
                                  <span
                                    className={`text-[10px] font-bold ${
                                      gainKg >= 0 ? "text-emerald-700" : "text-rose-600"
                                    }`}
                                  >
                                    {gainKg >= 0 ? `+${gainKg}` : gainKg} kg gain
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Tab 4: Calving / Offspring */}
              <TabsContent value="calving" className="m-0 h-full focus-visible:outline-none">
                <ScrollArea className="h-full w-full">
                  <div className="p-5 sm:p-6">
                    {animalCalves.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        <Baby className="size-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-600">No calving records on file</p>
                        <p className="mt-0.5">Newborn calves linked to this dam will appear here.</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {animalCalves.map((c) => (
                          <div
                            key={c.id}
                            className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                          >
                            <div>
                              <p className="font-bold text-slate-900">{c.calf_tag || `Calf #${c.id}`}</p>
                              <p className="text-slate-500 text-[11px] mt-0.5">
                                Born {c.calving_date} • {c.calf_sex} • {c.breed}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-slate-900 block">
                                {c.birth_weight ? `${c.birth_weight} kg` : "No birth weight"}
                              </span>
                              <span className="text-[10px] text-slate-400">{c.calving_ease}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

