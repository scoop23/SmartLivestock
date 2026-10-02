"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus,
  Trash2,
  Calendar,
  MapPin,
  FileSpreadsheet,
  CheckCircle2,
  Users,
  Layers,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { useAuth } from "@/contexts/auth-context";
import {
  CensusSubmissionRecord,
  CensusItemEntry,
  CreateCensusPayload,
  LIVESTOCK_TYPES,
  SAMPLE_CENSUS_ENTRIES as SAMPLE_ENTRIES,
  useGetBarangays,
  useFarmersByBarangay,
  LivestockTypeOption,
} from "./sibat-analytics";

export type { CensusItemEntry };

import { useMutation } from "@tanstack/react-query";
import { useLivestockTypes } from "@/app/(farmer)/livestock-inventory/livestock-inventory";

interface CensusSubmissionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmissionSuccess?: () => void;
  submissionToRevise?: CensusSubmissionRecord | null;
}

const createEmptyCensusItem = (): CensusItemEntry => ({
  id: "item-" + Date.now() + "-" + Math.random(),
  farmerId: null,
  livestockTypeId: null,
  farmerName: "",
  purok: "Purok 1",
  livestockType: "Cattle (Baka)",
  numberOfHeads: 1,
  remarks: "",
});

export default function CensusSubmissionForm({
  open,
  onOpenChange,
  onSubmissionSuccess,
  submissionToRevise = null,
}: CensusSubmissionFormProps) {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const initialQuarter = Math.ceil(currentMonth / 3);

  const [barangay, setBarangay] = useState<number | null>(null);
  const [reportYear, setReportYear] = useState<number>(currentYear);
  const [reportQuarter, setReportQuarter] = useState<number>(initialQuarter);
  const [remarks, setRemarks] = useState("");
  const [isCertified, setIsCertified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [items, setItems] = useState<CensusItemEntry[]>([createEmptyCensusItem()]);
  const isRevision = submissionToRevise?.status === "SUBJECT_TO_REVISION";
  const draftLoaded = useRef(false);
  const draftKey = "smartlivestock:census-draft:" + (submissionToRevise?.id ?? "new");

  useEffect(() => {
    if (!open) return;
    draftLoaded.current = false;
    const savedDraft = window.localStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        setBarangay(draft.barangay ?? null);
        setReportYear(draft.reportYear ?? currentYear);
        setReportQuarter(draft.reportQuarter ?? initialQuarter);
        setRemarks(draft.remarks ?? "");
        setItems(Array.isArray(draft.items) && draft.items.length ? draft.items : [createEmptyCensusItem()]);
        setIsCertified(false);
        draftLoaded.current = true;
        return;
      } catch {
        window.localStorage.removeItem(draftKey);
      }
    }
    if (submissionToRevise) {
      setBarangay(submissionToRevise.barangayId);
      setReportYear(submissionToRevise.reportYear);
      setReportQuarter(submissionToRevise.reportQuarter);
      setRemarks(submissionToRevise.remarks || "");
      setItems(submissionToRevise.items.map((item) => ({
        ...item,
        id: String(item.id),
        farmerId: item.farmerId ?? null,
        livestockTypeId: item.livestockTypeId ?? null,
      })));
    } else {
      setBarangay(null);
      setReportYear(currentYear);
      setReportQuarter(initialQuarter);
      setRemarks("");
      setItems([createEmptyCensusItem()]);
    }
    setIsCertified(false);
    draftLoaded.current = true;
  }, [open, submissionToRevise, currentYear, initialQuarter, draftKey]);

  useEffect(() => {
    if (!open || !draftLoaded.current) return;
    const timeout = window.setTimeout(() => {
      window.localStorage.setItem(
        draftKey,
        JSON.stringify({ barangay, reportYear, reportQuarter, remarks, items })
      );
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [open, draftKey, barangay, reportYear, reportQuarter, remarks, items]);

  // Derived summaries
  const totalHeads = items.reduce((sum, item) => sum + (Number(item.numberOfHeads) || 0), 0);
  const uniqueFarmers = new Set(
    items.map((i) => i.farmerName.trim().toLowerCase()).filter(Boolean)
  ).size;

  // Breakdown by animal type
  const breakdown = LIVESTOCK_TYPES.map((type: LivestockTypeOption) => {
    const count = items
      .filter((i) => i.livestockType === type.name)
      .reduce((sum, i) => sum + (Number(i.numberOfHeads) || 0), 0);
    return { ...type, count };
  }).filter((t: LivestockTypeOption & { count: number }) => t.count > 0);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      createEmptyCensusItem(),
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      toast.info("At least one census item is required.");
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof CensusItemEntry, value: any) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleLoadSample = () => {
    setItems(SAMPLE_ENTRIES);
    toast.success("Sample quarterly census records populated!");
  };


  const submitMutation = useMutation({
    mutationFn: async (payload: CreateCensusPayload) => {
      if (isRevision && submissionToRevise) {
        const response = await api.patch(
          "livestock/census/" + submissionToRevise.id + "/",
          payload
        );
        return response.data;
      }
      const response = await api.post("livestock/census/", payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success(
        isRevision
          ? "Corrected Census Q" + reportQuarter + " " + reportYear + " resubmitted to MAO."
          : "Quarterly Census Q" + reportQuarter + " " + reportYear + " submitted to MAO."
      );
      window.localStorage.removeItem(draftKey);
      onSubmissionSuccess?.();
      onOpenChange(false);
      setItems([createEmptyCensusItem()]);
      setRemarks("");
      setIsCertified(false);
    },
    onError: (err: any) => {
      const apiError = err?.response?.data?.error || err?.response?.data?.detail ||
        "The census could not be saved. Please review the entries and try again.";
      toast.error(isRevision ? "Census resubmission failed" : "Census submission failed", {
        description: apiError,
      });
    },
    onSettled: () => setIsSubmitting(false),
  });


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!barangay) {
      toast.error("Please select a Barangay.");
      return;
    }

    const invalidItem = items.find(
      (item) =>
        !item.farmerId ||
        !(item.livestockTypeId ?? livestockById[item.livestockType]) ||
        Number(item.numberOfHeads) <= 0
    );

    if (invalidItem) {
      toast.error("Please select a farmer, livestock type, and positive head count for every row.");
      return;
    }

    if (!isCertified) {
      toast.error("Please certify the accuracy of the census data before submitting.");
      return;
    }

    setIsSubmitting(true);


    const submissionPayload: CreateCensusPayload = {
      barangay: barangay,
      report_year: reportYear,
      report_quarter: reportQuarter,
      remarks: remarks.trim() || undefined,
      items: items.map((item) => ({
        farmer: item.farmerId!,
        livestock_type: item.livestockTypeId ?? livestockById[item.livestockType],
        number_of_heads: Number(item.numberOfHeads),
        remarks: item.remarks,
      })),
    };
    submitMutation.mutate(submissionPayload);
  };

  const { data: barangays } = useGetBarangays();
  const { data: livestockRecords } = useLivestockTypes();
  const { data: farmersByBarangay } = useFarmersByBarangay(barangay);


  const livestockById = useMemo(() => {
    const array = Object.fromEntries(Object.entries(livestockRecords ?? {}).map(([key, id]) => {
      const livestockType = LIVESTOCK_TYPES.find((type: LivestockTypeOption) => type.name.toLowerCase().includes(key.toLowerCase()));
      return [livestockType?.name ?? key, id];
    }));
    return array;
  }, [livestockRecords]);


  if (!open) return null;

  return (
    <div className="w-full text-slate-900">
      <form onSubmit={handleSubmit} className="space-y-6">
          {isRevision && submissionToRevise?.reviewRemarks && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-rose-700">MAO correction request</p>
              <p className="mt-1 text-sm font-semibold text-rose-950">{submissionToRevise.reviewRemarks}</p>
            </div>
          )}
          {/* Section 1: Period and Jurisdiction */}
          <Card className="border-0 bg-white shadow-sm ring-1 ring-slate-200/80 rounded-2xl overflow-hidden">
            <CardContent className="p-5 sm:p-6 space-y-5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-sky-50 text-sky-800">
                  <MapPin className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Survey Period & Jurisdiction</h3>
                  <p className="text-xs text-slate-500">Choose the barangay and quarter covered by this census.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Barangay */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">
                    Barangay <span className="text-rose-500">*</span>
                  </Label>
                  <Select
                    value={barangay ? String(barangay) : undefined}
                    onValueChange={(val) => setBarangay(Number(val))}
                  >
                    <SelectTrigger className="h-10 rounded-xl bg-slate-50/70 border-slate-200 font-semibold text-sm">
                      <SelectValue placeholder="Select Barangay" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 rounded-xl">
                      {barangays?.filter((brgy) => user?.role !== "SIBAT" || brgy.id === user.assignedBarangayId).map((brgy) => (
                        <SelectItem key={brgy.id} value={String(brgy.id)} className="text-xs font-medium">
                          Brgy. {brgy.barangayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Report Year */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">
                    Report Year <span className="text-rose-500">*</span>
                  </Label>
                  <Select
                    value={reportYear.toString()}
                    onValueChange={(v) => setReportYear(Number(v))}
                  >
                    <SelectTrigger className="h-10 rounded-xl bg-slate-50/70 border-slate-200 font-semibold text-sm">
                      <SelectValue placeholder="Select Year" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map((y) => (
                        <SelectItem key={y} value={y.toString()} className="text-xs font-medium">
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Report Quarter */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">
                    Report Quarter <span className="text-rose-500">*</span>
                  </Label>
                  <Select
                    value={reportQuarter.toString()}
                    onValueChange={(v) => setReportQuarter(Number(v))}
                  >
                    <SelectTrigger className="h-10 rounded-xl bg-slate-50/70 border-slate-200 font-semibold text-sm">
                      <SelectValue placeholder="Select Quarter" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="1" className="text-xs font-medium">
                        Q1 (Jan – Mar)
                      </SelectItem>
                      <SelectItem value="2" className="text-xs font-medium">
                        Q2 (Apr – Jun)
                      </SelectItem>
                      <SelectItem value="3" className="text-xs font-medium">
                        Q3 (Jul – Sep)
                      </SelectItem>
                      <SelectItem value="4" className="text-xs font-medium">
                        Q4 (Oct – Dec)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Farmer & Livestock Entries */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Users className="size-4 text-sky-800" />
                  Farmer Head Count
                  <Badge className="border-0 bg-slate-200 text-slate-700">{items.length} rows</Badge>
                </h3>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Add one row for each surveyed farmer and livestock type.
                </p>
              </div>

              <div className="flex items-center gap-2 self-stretch sm:self-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLoadSample}
                  className="rounded-xl border-slate-200 bg-white text-xs font-bold gap-1 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Load Sample Batch
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddItem}
                  className="bg-sky-800 hover:bg-sky-900 text-white rounded-xl text-xs font-bold gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Farmer Row
                </Button>
              </div>
            </div>

            {/* Line items list */}
            <div className="space-y-3">
              {items.map((item, index) => (
                <Card
                  key={item.id}
                  className="border-0 bg-white rounded-2xl shadow-sm ring-1 ring-slate-200/80 overflow-hidden transition-all hover:ring-sky-300"
                >
                  <CardContent className="p-3.5 sm:p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 pb-1">
                      <span className="text-xs font-black text-slate-500">
                        Farmer row <span className="text-slate-900">{String(index + 1).padStart(2, "0")}</span>
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded-md hover:bg-rose-50"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                      {/* Farmer Name */}
                      <div className="sm:col-span-4 space-y-1">
                        <Label className="text-[11px] font-bold text-slate-600">
                          Farmer Name <span className="text-rose-500">*</span>
                        </Label>
                        <Select
                          disabled={!barangay}
                          value={item.farmerId ? String(item.farmerId) : undefined}
                          onValueChange={(val) => {
                            const farmerIdNum = Number(val);
                            const selected = farmersByBarangay?.find((f) => f.farmerId === farmerIdNum);
                            handleUpdateItem(item.id, "farmerId", farmerIdNum);
                            if (selected) {
                              handleUpdateItem(item.id, "farmerName", selected.farmerName);
                            }
                          }}
                        >
                          <SelectTrigger className="h-10 rounded-xl bg-slate-50/70 border-slate-200 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                            <SelectValue
                              placeholder={!barangay ? "Select a Barangay first" : "Select Farmer Name"}
                            />
                          </SelectTrigger>
                          <SelectContent className="max-h-60 rounded-xl">
                            {(farmersByBarangay ?? []).length === 0 ? (
                              <div className="p-3 text-xs text-slate-500 text-center font-medium">
                                No registered farmers found in this barangay.
                              </div>
                            ) : (
                              (farmersByBarangay ?? []).map((f) => (
                                <SelectItem key={f.farmerId} value={String(f.farmerId)} className="text-xs font-medium">
                                  {f.farmerName}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>

                        {/* <Input */}
                        {/*   placeholder="e.g. Juan Dela Cruz" */}
                        {/*   value={item.farmerName} */}
                        {/*   onChange={(e) => */}
                        {/*     handleUpdateItem(item.id, "farmerName", e.target.value) */}
                        {/*   } */}
                        {/*   className="h-9 text-xs rounded-xl bg-slate-50/70 border-slate-200 font-medium" */}
                        {/*   required */}
                        {/* /> */}
                      </div>

                      {/* Purok / Sitio */}
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-[11px] font-bold text-slate-600">Sitio / Purok</Label>
                        <Input
                          placeholder="Purok 1"
                          value={item.purok}
                          onChange={(e) => handleUpdateItem(item.id, "purok", e.target.value)}
                          className="h-9 text-xs rounded-xl bg-slate-50/70 border-slate-200 font-medium"
                        />
                      </div>

                      {/* Livestock Type */}
                      <div className="sm:col-span-4 space-y-1">
                        <Label className="text-[11px] font-bold text-slate-600">
                          Livestock Type <span className="text-rose-500">*</span>
                        </Label>
                        <Select
                          value={item.livestockType || undefined}
                          onValueChange={(val) => {
                            handleUpdateItem(item.id, "livestockType", val);
                            handleUpdateItem(item.id, "livestockTypeId", livestockById[val] ?? null);
                          }}
                        >
                          <SelectTrigger className="h-10 rounded-xl bg-slate-50/70 border-slate-200 font-semibold text-sm">
                            <SelectValue placeholder="Select Animal Type" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60 rounded-xl">
                            {LIVESTOCK_TYPES.map((lt: LivestockTypeOption) => (
                              <SelectItem key={lt.name} value={lt.name} className="text-xs font-medium">
                                <span className="mr-1.5">{lt.emoji}</span>
                                {lt.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Number of Heads */}
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-[11px] font-bold text-slate-600">
                          No. of Heads <span className="text-rose-500">*</span>
                        </Label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="1"
                            max="9999"
                            value={item.numberOfHeads || ""}
                            onChange={(e) =>
                              handleUpdateItem(
                                item.id,
                                "numberOfHeads",
                                parseInt(e.target.value, 10) || 0
                              )
                            }
                            className="h-9 text-xs rounded-xl bg-slate-50/70 border-slate-200 font-black tabular-nums text-center"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleAddItem}
              className="w-full h-11 border-slate-300 rounded-xl text-xs font-extrabold text-sky-900 hover:bg-sky-50 hover:border-sky-300"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Add Another Farmer Entry
            </Button>
          </div>

          {/* Section 3: Live Summary Cards */}
          <div className="rounded-2xl bg-[#173b5e] p-5 text-white shadow-sm sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black tracking-tight flex items-center gap-2">
                <Layers className="size-4 text-emerald-300" />
                Live Census Summary
              </span>
              <span className="text-[11px] font-semibold text-sky-100/70">Updates as you edit</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white/10 rounded-xl p-3.5 ring-1 ring-white/10">
                <p className="text-[10px] uppercase font-bold text-sky-100/70">Total Animals</p>
                <p className="text-2xl font-black text-white tabular-nums">{totalHeads}</p>
                <p className="text-[10px] text-sky-100/60">head count total</p>
              </div>

              <div className="bg-white/10 rounded-xl p-3.5 ring-1 ring-white/10">
                <p className="text-[10px] uppercase font-bold text-sky-100/70">Total Farmers</p>
                <p className="text-2xl font-black text-white tabular-nums">{uniqueFarmers}</p>
                <p className="text-[10px] text-sky-100/60">surveyed households</p>
              </div>

              <div className="bg-white/10 rounded-xl p-3.5 ring-1 ring-white/10 col-span-2">
                <p className="text-[10px] uppercase font-bold text-sky-100/70 mb-1.5">
                  Species Breakdown
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {breakdown.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">No entries yet</span>
                  ) : (
                    breakdown.map((b: LivestockTypeOption & { count: number }) => (
                      <Badge
                        key={b.name}
                        className="bg-white/15 text-white hover:bg-white/20 border-white/20 text-[10px] font-bold"
                      >
                        {b.emoji} {b.name.split(" ")[0]}: {b.count}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Remarks and Certification */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Technologist Field Remarks / Notes (Optional)
              </Label>
              <Textarea
                placeholder="e.g. Complete quarterly house-to-house sweep in Purok 1-4. All animals inspected in good health."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                className="text-xs rounded-xl bg-white border-slate-200 font-medium"
              />
            </div>

            <div className="flex items-start gap-3 p-4 rounded-xl bg-sky-50 ring-1 ring-sky-100">
              <Checkbox
                id="certify"
                checked={isCertified}
                onCheckedChange={(checked) => setIsCertified(checked === true)}
                className="mt-0.5 border-sky-700 data-[state=checked]:bg-sky-800 data-[state=checked]:border-sky-800"
              />
              <label
                htmlFor="certify"
                className="text-xs font-semibold text-slate-800 leading-snug cursor-pointer select-none"
              >
                {isRevision
                  ? "I certify that the requested corrections have been applied and this census is ready for MAO review again."
                  : "I certify under oath that this quarterly census represents actual, field-verified livestock counts and is ready for MAO review."}
              </label>
            </div>
          </div>
        </form>

        {/* Footer actions */}
        <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-slate-200/80 pt-5 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="rounded-xl font-bold text-xs"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !isCertified}
            className="rounded-xl font-extrabold text-xs px-6 bg-sky-800 hover:bg-sky-900 text-white gap-2"
          >
            {isSubmitting ? (
              <>{isRevision ? "Resubmitting Census..." : "Submitting Census..."}</>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {isRevision ? "Resubmit Corrections to MAO" : "Submit Census to MAO"}
              </>
            )}
          </Button>
        </div>
    </div>
  );
}

