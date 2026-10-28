"use client";

import { Button } from "@/components/ui/button";
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
import {
Dialog,
DialogContent,
DialogDescription,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Label } from "@/components/ui/label";
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";
import api from "@/lib/axios";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
BadgeDollarSign,
Calendar,
Compass,
MapPin,
PhilippinePeso,
Sparkles,
ShoppingBag,
Truck
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { getAutomaticTutorialsEnabled, startGuidedTutorial } from "@/lib/tutorial-preferences";
import { toast } from "sonner";
import type { LivestockInventoryItem } from "../livestock-inventory/livestock-inventory";
import { LivestockPickerField } from "./select-livestock-dialog";

export interface LiveSaleItem {
  id: number;
  livestock: number | null;
  batch?: number | null;
  tag_number?: string;
  livestock_type_name?: string;
  farmer_name?: string;
  quantity: number;
  sale_method: "MATA-MATA" | "WEIGHING" | "OTHER";
  total_live_weight: number | null;
  price_per_head: number | null;
  price_per_kg: number | null;
  total_price: number | null;
  destination: string;
  sale_date: string;
  purpose: "BREEDING" | "FATTENING" | "SLAUGHTER" | "UNKNOWN";
  status: "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION";
  review_remarks?: string;
  created_at: string;
}

export interface DispositionItem {
  id: number;
  livestock: number;
  tag_number?: string;
  livestock_type_name?: string;
  intent: "FOR_SALE" | "FOR_SLAUGHTER" | "FOR_MOVEMENT" | "NONE";
  target_date: string | null;
  target_destination: string;
  notes: string;
  created_at: string;
}

export default function ProductionSalesTab({
  intentInventories,
  autoOpenIntent = false,
}: {
  intentInventories: LivestockInventoryItem[];
  autoOpenIntent?: boolean;
}) {
  const queryClient = useQueryClient();
  const [isIntentOpen, setIsIntentOpen] = useState(autoOpenIntent);
  // Intent form state
  const [intentLivestockId, setIntentLivestockId] = useState("");
  const [intentType, setIntentType] = useState<"FOR_SALE" | "FOR_SLAUGHTER" | "FOR_MOVEMENT">("FOR_SALE");
  const [targetDate, setTargetDate] = useState("");
  const [targetDestination, setTargetDestination] = useState("");
  const [intentNotes, setIntentNotes] = useState("");

  const startIntentTutorial = useCallback(() => {
    const steps: DriveStep[] = [
      { element: '[data-tour="intent-record-livestock"]', popover: { title: "Choose the livestock", description: "Select the active animal or herd this plan is about.", side: "bottom", align: "center" } },
      { element: '[data-tour="intent-record-type"]', popover: { title: "Choose your plan", description: "Declare whether the livestock is intended for sale, slaughter, or movement.", side: "bottom", align: "center" } },
      { element: '[data-tour="intent-record-date"]', popover: { title: "Choose a target date", description: "Add an optional date for the planned sale, slaughter, or movement.", side: "bottom", align: "center" } },
      { element: '[data-tour="intent-record-destination"]', popover: { title: "Add a destination", description: "Add the intended buyer, market, slaughterhouse, or receiving location when known.", side: "bottom", align: "center" } },
      { element: '[data-tour="intent-record-notes"]', popover: { title: "Add optional notes", description: "Include scheduling or other context for the reviewer.", side: "top", align: "start" } },
      { element: '[data-tour="intent-record-save"]', popover: { title: "Save the declaration", description: "This records your plan for review. It does not mark the animal sold or change its inventory status.", side: "top", align: "end" } },
    ];
    startGuidedTutorial({ showProgress: true, animate: true, allowClose: true, nextBtnText: "Next", prevBtnText: "Back", doneBtnText: "Finish", progressText: "{{current}} of {{total}}", steps });
  }, []);

  useEffect(() => {
    if (!isIntentOpen || !getAutomaticTutorialsEnabled()) return;
    const timer = window.setTimeout(startIntentTutorial, 500);
    return () => window.clearTimeout(timer);
  }, [isIntentOpen, startIntentTutorial]);

  const { data: sales = [], isLoading: isSalesLoading } = useQuery<LiveSaleItem[]>({
    queryKey: ["live_animal_sales"],
    queryFn: async () => {
      const res = await api.get("production/sales/");
      return res.data;
    },
  });

  const { data: dispositions = [] } = useQuery<DispositionItem[]>({
    queryKey: ["animal_dispositions"],
    queryFn: async () => {
      const res = await api.get("production/dispositions/");
      return res.data;
    },
  });

  const recordIntentMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await api.post("production/dispositions/", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Animal commercial intent declared!");
      setIsIntentOpen(false);
      setIntentLivestockId("");
      setTargetDate("");
      setTargetDestination("");
      setIntentNotes("");
      queryClient.invalidateQueries({ queryKey: ["animal_dispositions"] });
    },
    onError: () => {
      toast.error("Failed to declare animal intent.");
    },
  });

  const handleIntentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!intentLivestockId) {
      toast.error("Please select an animal.");
      return;
    }

    recordIntentMutation.mutate({
      livestock: Number(intentLivestockId),
      intent: intentType,
      target_date: targetDate || null,
      target_destination: targetDestination.trim(),
      notes: intentNotes.trim(),
    });
  };

  const totalSoldHeads = sales.reduce((acc, s) => acc + (s.quantity || 1), 0);
  const totalRevenue = sales.reduce((acc, s) => acc + (Number(s.total_price) || 0), 0);
  const avgSalePrice =
    totalSoldHeads > 0 ? (totalRevenue / totalSoldHeads).toFixed(0) : "—";
  const activeIntentIds = new Set(intentInventories.map((item) => Number(item.id)));
  const visibleDispositions = dispositions.filter((item) => activeIntentIds.has(item.livestock));
  const forSaleCount = visibleDispositions.filter((d) => d.intent === "FOR_SALE").length;

  return (
    <div className="space-y-6">
      {/* Top Sales & Commercial KPIs */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          title="Total Live Animals Sold"
          value={`${totalSoldHeads} heads`}
          icon={<ShoppingBag className="size-4.5" />}
          badge="Sold animals"
          variant="emerald"
        />
        <KpiCard
          title="Total Sales Value"
          value={`₱${totalRevenue.toLocaleString()}`}
          icon={<PhilippinePeso className="size-4.5" />}
          badge="Total earnings"
          variant="sky"
        />
        <KpiCard
          title="Avg Selling Price"
          value={avgSalePrice !== "—" ? `₱${Number(avgSalePrice).toLocaleString()} / hd` : "—"}
          icon={<BadgeDollarSign className="size-4.5" />}
          badge="Average per head"
          variant="amber"
        />
        <KpiCard
          title="Declared For Sale"
          value={`${forSaleCount} heads`}
          icon={<Truck className="size-4.5" />}
          badge="Ready to sell"
          variant="orange"
        />
      </div>

      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Live Animal Sales & Market Disposition
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Farmers can declare sale intent here. Auction staff records completed sales and movement paperwork.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setIsIntentOpen(true)}
            variant="outline"
            className="border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold gap-1.5"
          >
            <Compass className="size-4 text-slate-500" /> Declare Intent / Movement
          </Button>
        </div>
      </div>

      {/* Sales History & Intent Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Table */}
        <Card className="lg:col-span-2 border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShoppingBag className="size-4 text-emerald-700" /> Live Animal Sales History
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Auction transfer certificates are the official record of completed market sales. See <Link href="/livestock-inventory/ownership-history" className="font-semibold text-emerald-800 underline underline-offset-2">ownership history</Link>.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isSalesLoading ? (
              <p className="p-8 text-center text-sm text-slate-500">Loading sales records...</p>
            ) : sales.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-semibold text-slate-600">No sales recorded yet</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Auction records completed sales in <Link href="/livestock-inventory/ownership-history" className="font-semibold text-emerald-800 underline underline-offset-2">ownership history</Link>.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {sales.map((sale) => (
                  <div
                    key={sale.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900">
                          {sale.tag_number || `Tag #${sale.livestock}`} ({sale.quantity} {sale.quantity === 1 ? "head" : "heads"})
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {sale.sale_method}
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {sale.purpose}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="size-3.5 text-slate-400" />
                          Sold {sale.sale_date}
                        </span>
                        {sale.destination && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3.5 text-slate-400" />
                            {sale.destination}
                          </span>
                        )}
                        {sale.price_per_head && (
                          <span>₱{Number(sale.price_per_head).toLocaleString()}/head</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-600">{sale.status.replaceAll("_", " ")}</p>
                      {sale.status === "SUBJECT_TO_REVISION" && sale.review_remarks ? <p className="mb-2 max-w-48 text-xs text-rose-700">{sale.review_remarks}</p> : null}
                      <span className="text-base font-black text-emerald-800">
                        {sale.total_price != null ? `₱${Number(sale.total_price).toLocaleString()}` : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Intent Declarations & Movement Pipeline */}
        <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Truck className="size-4 text-amber-700" /> Declared Intent & Pipeline
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Livestock marked for sale, slaughter, or movement
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {visibleDispositions.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-400">
                No active intent declarations.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto">
                {visibleDispositions.map((d) => (
                  <div key={d.id} className="p-3.5 px-4 text-xs space-y-1 hover:bg-slate-50/70">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        {d.tag_number || `Animal #${d.livestock}`}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                          d.intent === "FOR_SALE"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : d.intent === "FOR_SLAUGHTER"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-sky-50 text-sky-700 border-sky-200"
                        }`}
                      >
                        {d.intent === "FOR_SALE"
                          ? "For Sale"
                          : d.intent === "FOR_SLAUGHTER"
                          ? "For Slaughter"
                          : "Movement"}
                      </span>
                    </div>
                    {d.target_destination && (
                      <p className="text-slate-500 text-[11px] flex items-center gap-1">
                        <MapPin className="size-3 text-slate-400" /> {d.target_destination}
                      </p>
                    )}
                    {d.notes && <p className="text-slate-500 text-[11px] italic">{d.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Declare Intent Dialog */}
      <Dialog open={isIntentOpen} onOpenChange={setIsIntentOpen}>
        <DialogContent className="sm:max-w-md p-6 rounded-2xl">
          <DialogHeader className="flex-row items-start justify-between gap-3">
            <div className="space-y-1.5">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Compass className="size-5 text-emerald-700" /> Declare Commercial Intent
            </DialogTitle>
            <DialogDescription>
              Tell Auction or your reviewer what you plan to do. This declaration does not mark the animal sold or change its inventory status.
            </DialogDescription>
            </div>
            <Button type="button" variant="outline" onClick={startIntentTutorial} className="shrink-0 gap-1.5 rounded-xl">
              <Sparkles className="size-4" aria-hidden="true" /> Tutorial
            </Button>
          </DialogHeader>

          <form onSubmit={handleIntentSubmit} className="space-y-4 mt-2">
            <div data-tour="intent-record-livestock">
            <LivestockPickerField
              id="intent-animal"
              label="Select Livestock *"
              placeholder="Choose livestock"
              items={intentInventories}
              selectedId={intentLivestockId}
              onSelect={(item) => setIntentLivestockId(item.id)}
              warnOnActiveDisease
              dialogTitle="Choose Livestock for Sale or Movement"
              dialogDescription="Choose the approved animal or herd for this commercial intent."
              emptyStateText="No active livestock is available for sale or movement planning."
            />
            </div>

            <div data-tour="intent-record-type" className="space-y-1.5">
              <Label htmlFor="intent-type">Commercial Intent *</Label>
              <Select
                value={intentType}
                onValueChange={(val) => { if (val === "FOR_SALE" || val === "FOR_SLAUGHTER" || val === "FOR_MOVEMENT") setIntentType(val); }}
              >
                <SelectTrigger id="intent-type" className="bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[var(--z-popover-dialog)]">
                  <SelectItem value="FOR_SALE">Intended for Auction / Commercial Sale</SelectItem>
                  <SelectItem value="FOR_SLAUGHTER">Intended for Slaughter / Katay</SelectItem>
                  <SelectItem value="FOR_MOVEMENT">Farm Transfer / Pasture Movement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div data-tour="intent-record-date" className="space-y-1.5">
              <Label htmlFor="intent-target-date">Target date (optional)</Label>
              <Input
                id="intent-target-date"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>

            <div data-tour="intent-record-destination" className="space-y-1.5">
              <Label htmlFor="intent-dest">Target Destination / Buyer</Label>
              <Input
                id="intent-dest"
                placeholder="e.g. Padre Garcia Livestock Market or Local Slaughterhouse"
                value={targetDestination}
                onChange={(e) => setTargetDestination(e.target.value)}
              />
            </div>

            <div data-tour="intent-record-notes" className="space-y-1.5">
              <Label htmlFor="intent-notes">Notes / Scheduling</Label>
              <Input
                id="intent-notes"
                placeholder="e.g. Ready for Friday auction market"
                value={intentNotes}
                onChange={(e) => setIntentNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsIntentOpen(false)}
              >
                Cancel
              </Button>
              <Button
                data-tour="intent-record-save"
                type="submit"
                disabled={recordIntentMutation.isPending}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
              >
                {recordIntentMutation.isPending ? "Saving..." : "Save Declaration"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
