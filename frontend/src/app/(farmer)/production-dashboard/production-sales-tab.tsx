"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BadgeDollarSign,
  Building2,
  Calendar,
  CheckCircle2,
  Compass,
  FileText,
  MapPin,
  PhilippinePeso,
  Plus,
  Scale,
  Send,
  ShoppingBag,
  Tag,
  Truck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KpiCard } from "@/components/ui/kpi-card";
import api from "@/lib/axios";
import type { LivestockInventoryItem } from "../livestock-inventory/page";

export interface LiveSaleItem {
  id: number;
  livestock: number;
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
  status: "PENDING" | "APPROVED" | "REJECTED";
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
  approvedInventories,
}: {
  approvedInventories: LivestockInventoryItem[];
}) {
  const queryClient = useQueryClient();
  const [isSaleOpen, setIsSaleOpen] = useState(false);
  const [isIntentOpen, setIsIntentOpen] = useState(false);

  // Sale form state
  const [saleLivestockId, setSaleLivestockId] = useState("");
  const [saleQty, setSaleQty] = useState(1);
  const [saleMethod, setSaleMethod] = useState<"MATA-MATA" | "WEIGHING" | "OTHER">("MATA-MATA");
  const [totalLiveWeight, setTotalLiveWeight] = useState("");
  const [pricePerHead, setPricePerHead] = useState("");
  const [pricePerKg, setPricePerKg] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [destination, setDestination] = useState("Padre Garcia Auction Market");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split("T")[0]);
  const [salePurpose, setSalePurpose] = useState<"BREEDING" | "FATTENING" | "SLAUGHTER" | "UNKNOWN">("SLAUGHTER");

  // Intent form state
  const [intentLivestockId, setIntentLivestockId] = useState("");
  const [intentType, setIntentType] = useState<"FOR_SALE" | "FOR_SLAUGHTER" | "FOR_MOVEMENT">("FOR_SALE");
  const [targetDate, setTargetDate] = useState("");
  const [targetDestination, setTargetDestination] = useState("");
  const [intentNotes, setIntentNotes] = useState("");

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

  const recordSaleMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await api.post("production/sales/", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Live animal sale record submitted!");
      setIsSaleOpen(false);
      setSaleLivestockId("");
      setPricePerHead("");
      setTotalPrice("");
      queryClient.invalidateQueries({ queryKey: ["live_animal_sales"] });
    },
    onError: () => {
      toast.error("Failed to record cattle sale.");
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
      setTargetDestination("");
      setIntentNotes("");
      queryClient.invalidateQueries({ queryKey: ["animal_dispositions"] });
    },
    onError: () => {
      toast.error("Failed to declare animal intent.");
    },
  });

  const handleSaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleLivestockId) {
      toast.error("Please select an animal.");
      return;
    }

    const computedTotal =
      totalPrice ||
      (pricePerHead ? Number(pricePerHead) * Number(saleQty) : 0) ||
      (pricePerKg && totalLiveWeight ? Number(pricePerKg) * Number(totalLiveWeight) : 0);

    recordSaleMutation.mutate({
      livestock: Number(saleLivestockId),
      quantity: Number(saleQty),
      sale_method: saleMethod,
      total_live_weight: totalLiveWeight ? Number(totalLiveWeight) : null,
      price_per_head: pricePerHead ? Number(pricePerHead) : null,
      price_per_kg: pricePerKg ? Number(pricePerKg) : null,
      total_price: computedTotal || null,
      destination: destination.trim(),
      sale_date: saleDate,
      purpose: salePurpose,
    });
  };

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
  const forSaleCount = dispositions.filter((d) => d.intent === "FOR_SALE").length;

  return (
    <div className="space-y-6">
      {/* Top Sales & Commercial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Live Animals Sold"
          value={`${totalSoldHeads} heads`}
          icon={<ShoppingBag className="size-4.5" />}
          badge="Commercial realization"
          variant="emerald"
        />
        <KpiCard
          title="Total Sales Value"
          value={`₱${totalRevenue.toLocaleString()}`}
          icon={<PhilippinePeso className="size-4.5" />}
          badge="Gross farm proceeds"
          variant="sky"
        />
        <KpiCard
          title="Avg Selling Price"
          value={avgSalePrice !== "—" ? `₱${Number(avgSalePrice).toLocaleString()} / hd` : "—"}
          icon={<BadgeDollarSign className="size-4.5" />}
          badge="Live price realized"
          variant="amber"
        />
        <KpiCard
          title="Declared For Sale"
          value={`${forSaleCount} heads`}
          icon={<Truck className="size-4.5" />}
          badge="Auction / Market pipeline"
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
            Log cattle sold, auction prices, mata-mata vs. scale weighing, and declare animals for sale/slaughter.
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
          <Button
            onClick={() => setIsSaleOpen(true)}
            className="bg-emerald-700 hover:bg-[#2D5A27] text-white shadow-sm font-semibold gap-2"
          >
            <Plus className="size-4" /> Record Cattle Sold
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
              Transaction records of live livestock sold with verified market prices
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isSalesLoading ? (
              <p className="p-8 text-center text-sm text-slate-500">Loading sales records...</p>
            ) : sales.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-semibold text-slate-600">No sales recorded yet</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Record live animal sales to track price per head and municipal auction proceeds.
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
                      <span className="text-base font-black text-emerald-800">
                        {sale.total_price ? `₱${Number(sale.total_price).toLocaleString()}` : "—"}
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
            {dispositions.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-400">
                No active intent declarations.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto">
                {dispositions.map((d) => (
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

      {/* Record Sale Dialog */}
      <Dialog open={isSaleOpen} onOpenChange={setIsSaleOpen}>
        <DialogContent className="sm:max-w-xl p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShoppingBag className="size-5 text-emerald-700" /> Record Live Cattle Sale
            </DialogTitle>
            <DialogDescription>
              Record sale details, auction proceeds, and pricing methods.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="sale-animal">Select Animal / Tag *</Label>
              <Select value={saleLivestockId} onValueChange={setSaleLivestockId}>
                <SelectTrigger id="sale-animal" className="bg-slate-50">
                  <SelectValue placeholder="Choose livestock sold" />
                </SelectTrigger>
                <SelectContent>
                  {approvedInventories.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.tagNumber || `Batch #${item.id}`} ({item.livestockTypeName} - {item.breed || "Standard"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sale-method">Sale Pricing Method *</Label>
                <Select
                  value={saleMethod}
                  onValueChange={(val) => setSaleMethod(val as "MATA-MATA" | "WEIGHING" | "OTHER")}
                >
                  <SelectTrigger id="sale-method" className="bg-slate-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MATA-MATA">Mata-mata (Visual Estimate)</SelectItem>
                    <SelectItem value="WEIGHING">Weighing Scale (Per kg)</SelectItem>
                    <SelectItem value="OTHER">Other Agreement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sale-purpose">Sale Purpose</Label>
                <Select
                  value={salePurpose}
                  onValueChange={(val) => setSalePurpose(val as any)}
                >
                  <SelectTrigger id="sale-purpose" className="bg-slate-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SLAUGHTER">Slaughter / Katay</SelectItem>
                    <SelectItem value="FATTENING">Fattening / Feedlot</SelectItem>
                    <SelectItem value="BREEDING">Breeding / Dairy</SelectItem>
                    <SelectItem value="UNKNOWN">General Trade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="price-head">Price per Head (₱)</Label>
                <Input
                  id="price-head"
                  type="number"
                  placeholder="e.g. 45000"
                  value={pricePerHead}
                  onChange={(e) => setPricePerHead(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="price-kg">Price per kg (₱)</Label>
                <Input
                  id="price-kg"
                  type="number"
                  placeholder="e.g. 180"
                  value={pricePerKg}
                  onChange={(e) => setPricePerKg(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="total-price">Total Proceeds (₱) *</Label>
                <Input
                  id="total-price"
                  type="number"
                  placeholder="e.g. 45000"
                  value={totalPrice}
                  onChange={(e) => setTotalPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sale-dest">Buyer / Market Destination</Label>
                <Input
                  id="sale-dest"
                  placeholder="e.g. Padre Garcia Auction Market / Buyer Name"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sale-date">Sale Date *</Label>
                <Input
                  id="sale-date"
                  type="date"
                  max={new Date().toISOString().split("T")[0]}
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSaleOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={recordSaleMutation.isPending}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
              >
                {recordSaleMutation.isPending ? "Saving..." : "Save Sale Record"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Declare Intent Dialog */}
      <Dialog open={isIntentOpen} onOpenChange={setIsIntentOpen}>
        <DialogContent className="sm:max-w-md p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Compass className="size-5 text-emerald-700" /> Declare Commercial Intent
            </DialogTitle>
            <DialogDescription>
              Flag livestock intended for upcoming auction sale, slaughter, or movement.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleIntentSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="intent-animal">Select Livestock *</Label>
              <Select value={intentLivestockId} onValueChange={setIntentLivestockId}>
                <SelectTrigger id="intent-animal" className="bg-slate-50">
                  <SelectValue placeholder="Choose animal" />
                </SelectTrigger>
                <SelectContent>
                  {approvedInventories.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.tagNumber || `Batch #${item.id}`} ({item.livestockTypeName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="intent-type">Commercial Intent *</Label>
              <Select
                value={intentType}
                onValueChange={(val) => setIntentType(val as any)}
              >
                <SelectTrigger id="intent-type" className="bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FOR_SALE">Intended for Auction / Commercial Sale</SelectItem>
                  <SelectItem value="FOR_SLAUGHTER">Intended for Slaughter / Katay</SelectItem>
                  <SelectItem value="FOR_MOVEMENT">Farm Transfer / Pasture Movement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="intent-dest">Target Destination / Buyer</Label>
              <Input
                id="intent-dest"
                placeholder="e.g. Padre Garcia Livestock Market or Local Slaughterhouse"
                value={targetDestination}
                onChange={(e) => setTargetDestination(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
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
