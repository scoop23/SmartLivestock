"use client";

import { FarmerRecordsTutorial } from "@/app/components/tutorials/farmer-page-tutorial";


import { QrCodePass } from "@/components/qr-code-pass";
import AuctionPreregistrations from "@/app/components/auction-preregistrations";
import { ValidationPagination } from "@/app/(admin)/data-validation/components/validation-pagination";
import { Button } from "@/components/ui/button";
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
import {
Dialog,
DialogContent,
DialogDescription,
DialogFooter,
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
import { executeOrQueueOffline } from "@/lib/offline-sync-queue";
import axios from "axios";
import { useParams, useSearchParams } from "next/navigation";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
BadgeCheck,
BadgeDollarSign,
Calendar,
Check,
CheckCircle2,
Compass,
Gavel,
Info,
MapPin,
PhilippinePeso,
Plus,
Search,
Sparkles,
ShoppingBag,
Truck,
X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { getAutomaticTutorialsEnabled, startGuidedTutorial } from "@/lib/tutorial-preferences";
import { useAutomaticTutorialsEnabled } from "@/hooks/use-automatic-tutorials-enabled";
import { toast } from "sonner";
import { formatLivestockAge } from "@/lib/livestock-age";
import { type LivestockInventoryItem } from "../livestock-inventory/livestock-inventory";
import { LivestockPicture } from "./select-livestock-dialog";
import MarketPriceReference from "../components/market-price-reference";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

interface MultiLivestockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: LivestockInventoryItem[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  activeDispositions?: DispositionItem[];
  title?: string;
  description?: string;
}

function MultiLivestockDialog({
  open,
  onOpenChange,
  items,
  selectedIds,
  onSelectionChange,
  activeDispositions = [],
  title = "Select Livestock for Intent Declaration",
  description = "Choose one or multiple active animals to include in this plan.",
}: MultiLivestockDialogProps) {
  const [query, setQuery] = useState("");
  const [localSelected, setLocalSelected] = useState<string[]>(selectedIds);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalSelected(selectedIds);
      setQuery("");
    }
  }, [open, selectedIds]);

  const activeDispositionMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const d of activeDispositions) {
      map.set(d.livestock, d.intent);
    }
    return map;
  }, [activeDispositions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
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
        .some((val) => String(val).toLowerCase().includes(q))
    );
  }, [items, query]);

  const eligibleFiltered = useMemo(() => {
    return filtered.filter((item) => !activeDispositionMap.has(Number(item.id)));
  }, [filtered, activeDispositionMap]);

  const toggleItem = (id: string, disabled?: boolean) => {
    if (disabled) return;
    setLocalSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const allEligibleIds = eligibleFiltered.map((item) => item.id);
    setLocalSelected((prev) => Array.from(new Set([...prev, ...allEligibleIds])));
  };

  const handleClearAll = () => {
    setLocalSelected([]);
  };

  const handleApply = () => {
    onSelectionChange(localSelected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-white">
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                {title}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                {description}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={eligibleFiltered.length === 0}
                className="h-7 text-[11px] bg-white border-slate-200 text-slate-700 hover:bg-slate-50 font-medium px-2.5 rounded-lg disabled:opacity-50"
              >
                Select all eligible ({eligibleFiltered.length})
              </Button>
              {localSelected.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="h-7 text-[11px] text-slate-600 hover:text-slate-900 px-2"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          <div className="relative mt-3">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tag number, breed, or animal ID..."
              className="pl-9 h-9 text-xs rounded-xl border-slate-200 bg-slate-50/70"
            />
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-2 flex-1">
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-500">
              No active approved livestock is available for sale or movement planning.
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-500">
              No livestock matches your search &quot;{query}&quot;.
            </div>
          ) : (
            <div className="divide-y divide-emerald-100 rounded-xl border border-emerald-200/80 bg-white overflow-hidden shadow-xs">
              {filtered.map((item) => {
                const isSelected = localSelected.includes(item.id);
                const currentIntent = activeDispositionMap.get(Number(item.id));
                const isAlreadyDeclared = Boolean(currentIntent);
                return (
                  <label
                    key={item.id}
                    className={`flex items-start gap-3 p-3 transition-colors ${
                      isAlreadyDeclared
                        ? "cursor-not-allowed bg-slate-50/80 opacity-60"
                        : isSelected
                        ? "cursor-pointer bg-emerald-50/60"
                        : "cursor-pointer hover:bg-slate-50/70"
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={isAlreadyDeclared}
                      onCheckedChange={() => toggleItem(item.id, isAlreadyDeclared)}
                      className="mt-1 border-emerald-500 data-[state=checked]:bg-[#0F4A2F] data-[state=checked]:border-[#0F4A2F] disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <LivestockPicture
                      item={item}
                      selected={false}
                      className="size-11 rounded-xl text-xl"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 font-bold text-xs text-slate-900">
                        {item.tagNumber || `Animal #${item.id}`}
                        <span className="text-[11px] font-semibold text-slate-500">
                          ({item.livestockTypeName})
                        </span>
                        {currentIntent && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-amber-50 text-amber-800 border-amber-300 font-medium"
                          >
                            Already declared ({currentIntent.replace("FOR_", "").toLowerCase()})
                          </Badge>
                        )}
                      </span>
                      <span className="mt-1 block text-[11px] text-slate-600">
                        {item.breed || "Breed not specified"} · {item.sex || "Sex not specified"}
                        {item.age && formatLivestockAge(item.age) !== "Unknown" ? ` · ${formatLivestockAge(item.age)}` : ""}
                        {item.weight ? ` · ${item.weight} kg` : ""}
                      </span>
                    </span>
                    {isSelected && !isAlreadyDeclared && (
                      <Badge className="bg-emerald-700 text-white text-[10px] shrink-0">
                        Selected
                      </Badge>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="p-3 sm:p-4 px-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between sm:justify-between shrink-0">
          <span className="text-xs text-slate-600 font-medium">
            {localSelected.length} animal{localSelected.length === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              className="h-8 text-xs font-bold rounded-xl bg-[#0F4A2F] hover:bg-[#0B3D26] text-white px-4"
            >
              Apply Selection ({localSelected.length})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductionSalesTab({
  intentInventories,
  autoOpenIntent = false,
  onClose,
}: {
  intentInventories: LivestockInventoryItem[];
  autoOpenIntent?: boolean;
  onClose?: () => void;
}) {
  const route = useParams<{ species?: string }>();
  const species = route.species || "";
  const searchParams = useSearchParams();
  const requestedMarket = searchParams.get("market") === "1";
  const showMarketTabs = species.trim().toLowerCase() === "cattle" && !autoOpenIntent;
  const [salesView, setSalesView] = useState<"sales" | "market">(requestedMarket ? "market" : "sales");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSalesView(requestedMarket ? "market" : "sales");
    if (!requestedMarket) return;
    const frame = window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById("market-price-reference")?.scrollIntoView({block: "start", behavior: reduceMotion ? "auto" : "smooth"});
    });
    return () => window.cancelAnimationFrame(frame);
  }, [requestedMarket]);
  const selectSalesView = (value: string) => {
    if (value !== "sales" && value !== "market") return;
    setSalesView(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value === "market") params.set("market", "1");
    else params.delete("market");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${value === "market" ? "#market-price-reference" : ""}`);
  };
  const tutorialsEnabled = useAutomaticTutorialsEnabled();
  const queryClient = useQueryClient();
  const [submittedRegistration, setSubmittedRegistration] = useState<{ id: number; reference: string; references?: string[]; count?: number } | null>(null);
  const [isIntentOpen, setIsIntentOpen] = useState(autoOpenIntent);
  // Intent form state
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<string[]>([]);
  const [isAnimalSelectorOpen, setIsAnimalSelectorOpen] = useState(false);
  const [intentType, setIntentType] = useState<"FOR_SALE" | "FOR_SLAUGHTER" | "FOR_MOVEMENT">("FOR_SALE");
  const [targetDate, setTargetDate] = useState("");
  const [targetDestination, setTargetDestination] = useState("");
  const [intentNotes, setIntentNotes] = useState("");
  const [intentDocument, setIntentDocument] = useState<File | null>(null);
  const [intentCertificate, setIntentCertificate] = useState("");

  const todayStr = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const selectedAnimals = useMemo(() => {
    return intentInventories.filter((item) => selectedAnimalIds.includes(item.id));
  }, [intentInventories, selectedAnimalIds]);

  const selectedCertificates = useMemo(() => {
    return selectedAnimals.map((item) => {
      if (item.ownershipCertificateNumber && item.ownershipCertificateNumber.trim()) {
        return item.ownershipCertificateNumber.trim();
      }
      const refDate = item.reviewedAt || item.createdAt;
      const year = refDate ? new Date(refDate).getFullYear() : new Date().getFullYear();
      return `COLC-${year}-${String(item.id).padStart(6, "0")}`;
    });
  }, [selectedAnimals]);

  const startIntentTutorial = useCallback(() => {
    const steps: DriveStep[] = [
      { element: '[data-tour="intent-record-livestock"]', popover: { title: "Choose the livestock", description: "Select one or multiple active animals or herds this plan is about.", side: "bottom", align: "center" } },
      { element: '[data-tour="intent-record-date"]', popover: { title: "Target date", description: "Select the date you plan to bring the animal to the auction.", side: "bottom", align: "center" } },
      { element: '[data-tour="intent-record-certificate"]', popover: { title: "Certificate of Ownership", description: "The assigned Certificate of Ownership from MAO is automatically retrieved.", side: "top", align: "center" } },
      { element: '[data-tour="intent-record-save"]', popover: { title: "Declare Intent", description: "Submit your declaration to alert auction staff.", side: "top", align: "end" } },
    ];
    startGuidedTutorial({ showProgress: true, animate: true, allowClose: true, nextBtnText: "Next", prevBtnText: "Back", doneBtnText: "Finish", progressText: "{{current}} of {{total}}", steps });
  }, []);

  useEffect(() => {
    if (!isIntentOpen || !getAutomaticTutorialsEnabled()) return;
    const timer = window.setTimeout(startIntentTutorial, 500);
    return () => window.clearTimeout(timer);
  }, [isIntentOpen, startIntentTutorial]);

  const { data: sales = [], isLoading: isSalesLoading } = useQuery<LiveSaleItem[]>({
    queryKey: ["farmer-approved-transfer-sales", species],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await api.get<Array<{
        id: number; livestock: number; livestock_tag: string; livestock_type_name: string;
        transfer_date: string; purchase_price: string | null; municipality: string; province: string; created_at: string;
      }>>("livestock/ownership-transfers/", { params: { direction: "outgoing", status: "APPROVED", species: species || undefined } });
      // One transfer event represents one sold animal. Use the official event
      // directly instead of copying it into the older LiveAnimalSale table.
      return data.map((transfer): LiveSaleItem => ({
        id: transfer.id, livestock: transfer.livestock, tag_number: transfer.livestock_tag,
        livestock_type_name: transfer.livestock_type_name, quantity: 1, sale_method: "OTHER",
        total_live_weight: null, price_per_head: transfer.purchase_price == null ? null : Number(transfer.purchase_price),
        price_per_kg: null, total_price: transfer.purchase_price == null ? null : Number(transfer.purchase_price),
        destination: [transfer.municipality, transfer.province].filter(Boolean).join(", "),
        sale_date: transfer.transfer_date, purpose: "UNKNOWN", status: "APPROVED", created_at: transfer.created_at,
      }));
    },
  });

  const [salesPage, setSalesPage] = useState(1);
  const [salesPageSize, setSalesPageSize] = useState(8);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSalesPage(1);
  }, [species]);
  const salesTotalPages = Math.max(1, Math.ceil(sales.length / salesPageSize));
  const safeSalesPage = Math.min(salesPage, salesTotalPages);
  const paginatedSales = sales.slice((safeSalesPage - 1) * salesPageSize, safeSalesPage * salesPageSize);

  const { data: dispositions = [] } = useQuery<DispositionItem[]>({
    queryKey: ["animal_dispositions"],
    queryFn: async () => {
      const res = await api.get("production/dispositions/");
      return res.data;
    },
  });

  const recordIntentMutation = useMutation({
    mutationFn: async (payload: {
      livestock_ids: string[];
      intent: string;
      target_date: string | null;
      target_destination: string;
      notes: string;
      original_certificate_number: string;
    }) => {
      const body = new FormData();
      body.append("livestock_ids", payload.livestock_ids.join(","));
      body.append("livestock", payload.livestock_ids[0]);
      body.append("intent", payload.intent);
      if (payload.target_date) body.append("target_date", payload.target_date);
      if (payload.target_destination) body.append("target_destination", payload.target_destination);
      if (payload.notes) body.append("notes", payload.notes);
      if (payload.original_certificate_number) body.append("original_certificate_number", payload.original_certificate_number);
      if (intentDocument && intentType === "FOR_SALE") body.append("supporting_document", intentDocument);
      const res = await executeOrQueueOffline<{ id: number; reference: string; references?: string[]; count?: number }>({
        endpoint: "production/dispositions/",
        method: "POST",
        data: body,
        title: `Auction Preregistration (${payload.intent})`,
        role: "FARMER",
        category: "PRODUCTION",
        fallbackResult: { id: Date.now(), reference: `AP-OFFLINE-${Date.now().toString().slice(-4)}`, count: payload.livestock_ids.length },
      });
      return res;
    },
    onSuccess: (data: { id: number; reference: string; references?: string[]; count?: number }) => {
      const count = data.count || selectedAnimalIds.length || 1;
      if (intentType === "FOR_SALE") {
        setSubmittedRegistration(data);
        toast.success(
          count > 1
            ? `${count} auction preregistrations submitted. Keep your AP references below.`
            : "Auction preregistration submitted. Keep your AP reference below."
        );
      } else {
        toast.success(
          count > 1
            ? `${count} animals declared for ${intentType === "FOR_SLAUGHTER" ? "slaughter" : "movement"}.`
            : "Animal intent declared."
        );
      }
      setIsIntentOpen(false);
      setSelectedAnimalIds([]);
      setTargetDate("");
      setTargetDestination("");
      setIntentNotes("");
      setIntentDocument(null);
      setIntentCertificate("");
      queryClient.invalidateQueries({ queryKey: ["animal_dispositions"] });
      queryClient.invalidateQueries({ queryKey: ["auction-preregistration-list"] });
      queryClient.invalidateQueries({ queryKey: ["livestock-inventory"] });
    },
    onError: (error) => {
      const body: unknown = axios.isAxiosError(error) ? error.response?.data : null;
      const message = body && typeof body === "object" ? Object.values(body).flat().filter(value => typeof value === "string").join(" ") : "Check the details and try again.";
      toast.error("Could not submit your declaration.", { description: message });
    },
  });

  const handleIntentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAnimalIds.length === 0) {
      toast.error("Please select at least one animal.");
      return;
    }

    if (targetDate && targetDate < todayStr) {
      toast.error("Target date cannot be in the past. Please select today or a future date.");
      return;
    }

    recordIntentMutation.mutate({
      livestock_ids: selectedAnimalIds,
      intent: intentType,
      target_date: targetDate || null,
      target_destination: targetDestination.trim(),
      notes: intentNotes.trim(),
      original_certificate_number: selectedAnimalIds.length === 1 ? (selectedCertificates[0] || intentCertificate).trim() : intentCertificate.trim(),
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
      {!autoOpenIntent && <FarmerRecordsTutorial guide="salesRecords" ready={!isSalesLoading} autoStart={!showMarketTabs || salesView === "sales"} />}
      <Tabs id="market-price-reference" value={showMarketTabs ? salesView : "sales"} onValueChange={selectSalesView} className="scroll-mt-24 gap-0">
        {showMarketTabs && <TabsList aria-label="Cattle sales and market prices" className="relative grid h-auto w-full max-w-xl grid-cols-2 rounded-xl border border-slate-200 bg-slate-100 p-1">
          <span aria-hidden="true" className={`pointer-events-none absolute inset-y-1 left-1 rounded-lg bg-emerald-700 shadow-sm transition-transform duration-300 ease-out motion-reduce:transition-none ${salesView === "market" ? "translate-x-full" : "translate-x-0"}`} style={{width: "calc((100% - 0.5rem) / 2)"}} />
          <TabsTrigger value="sales" className="relative z-10 h-10 rounded-lg px-2 text-xs font-semibold text-slate-600 transition-colors duration-200 data-[state=active]:border-transparent data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none motion-reduce:transition-none sm:px-4 sm:text-sm"><ShoppingBag className="size-4" />Your sales records</TabsTrigger>
          <TabsTrigger value="market" className="relative z-10 h-10 rounded-lg px-2 text-xs font-semibold text-slate-600 transition-colors duration-200 data-[state=active]:border-transparent data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none motion-reduce:transition-none sm:px-4 sm:text-sm"><BadgeDollarSign className="size-4" />Market prices</TabsTrigger>
        </TabsList>}
        {showMarketTabs && <TabsContent value="market" className="mt-0 pt-5 data-[state=active]:animate-in data-[state=active]:fade-in data-[state=active]:slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
          <MarketPriceReference />
        </TabsContent>}
        <TabsContent value="sales" aria-label="Your sales records" className="mt-0 space-y-6 pt-5 data-[state=active]:animate-in data-[state=active]:fade-in data-[state=active]:slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
      <div><h2 className="text-lg font-bold text-slate-900">Your sales records</h2><p className="mt-1 text-xs text-slate-500">Your own completed sales and declarations.</p></div>
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
        <Card data-tour="sales-history-panel" className="lg:col-span-2 border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShoppingBag className="size-4 text-emerald-700" /> Live Animal Sales History
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Auction transfer certificates are the official record of completed market sales. See <Link data-tour="sales-ownership-link" href="/livestock-inventory/ownership-history" className="font-semibold text-emerald-800 underline underline-offset-2">ownership history</Link>.
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
                {paginatedSales.map((sale) => (
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
                          Approved ownership transfer
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
            {!isSalesLoading && sales.length > 0 && <div className="px-3 pb-3">
              <ValidationPagination currentPage={safeSalesPage} totalPages={salesTotalPages} totalItems={sales.length} pageSize={salesPageSize} onPageChange={setSalesPage} onPageSizeChange={size => {setSalesPageSize(size); setSalesPage(1);}} pageSizeOptions={[4, 8, 16, 24]} />
            </div>}
          </CardContent>
        </Card>

        {/* Intent Declarations & Movement Pipeline */}
        <Card data-tour="sales-intent-panel" className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
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

      <AuctionPreregistrations />
        </TabsContent>
      </Tabs>

      <Dialog open={submittedRegistration !== null} onOpenChange={open => { if (!open) setSubmittedRegistration(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl bg-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {submittedRegistration && (submittedRegistration.count ?? 1) > 1
                ? `${submittedRegistration.count} Preregistrations submitted`
                : "Preregistration submitted"}
            </DialogTitle>
            <DialogDescription>
              Save your QR and show it to Auction staff at the market. Staff can scan it to open your preregistration for review.
            </DialogDescription>
          </DialogHeader>
          {submittedRegistration && (
            <div className="space-y-4">
              <QrCodePass
                code={submittedRegistration.reference}
                qrPayload={submittedRegistration.reference}
                title="Auction preregistration"
                subtitle="Save this QR for your market visit."
                status="SUBMITTED"
                compact
              />
              {submittedRegistration.references && submittedRegistration.references.length > 1 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs space-y-1.5">
                  <p className="font-bold text-emerald-950">
                    Generated AP References ({submittedRegistration.references.length} heads):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {submittedRegistration.references.map((ref) => (
                      <span
                        key={ref}
                        className="inline-block rounded-md border border-emerald-300 bg-white px-2 py-0.5 font-mono text-xs font-bold text-emerald-800 shadow-2xs"
                      >
                        {ref}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <Button variant="outline" onClick={() => { setSubmittedRegistration(null); if (autoOpenIntent) onClose?.(); }}>Done</Button>
        </DialogContent>
      </Dialog>

      {/* Multi-Livestock Selection Dialog */}
      <MultiLivestockDialog
        open={isAnimalSelectorOpen}
        onOpenChange={setIsAnimalSelectorOpen}
        items={intentInventories}
        selectedIds={selectedAnimalIds}
        onSelectionChange={setSelectedAnimalIds}
        activeDispositions={dispositions}
        title="Choose Livestock for Intent Declaration"
        description="Select one or multiple active animals or herds from your approved inventory."
      />

      {/* Declare Intent Dialog */}
      <Dialog
        open={isIntentOpen}
        onOpenChange={(open) => {
          setIsIntentOpen(open);
          if (!open) onClose?.();
        }}
      >
        <DialogContent
          showCloseButton={true}
          className="sm:max-w-xl p-6 sm:p-7 rounded-3xl max-h-[92vh] overflow-y-auto border-slate-200 shadow-xl"
        >
          {/* Header */}
          <div className="flex items-start gap-3.5 pr-8">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100">
              <Gavel className="size-6 text-emerald-700" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
                Declare Commercial Intent
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                Let us know your plan to bring this animal to the auction market.
              </DialogDescription>
            </div>
          </div>

          <form onSubmit={handleIntentSubmit} className="space-y-4 mt-2">
            {/* Top Info Banner */}
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-3 sm:p-3.5 flex items-center gap-2.5 text-emerald-950">
              <Info className="size-4.5 shrink-0 text-emerald-700" />
              <p className="text-xs sm:text-sm font-medium leading-snug">
                You will be able to add the buyer, destination, and supporting documents after declaring your intent.
              </p>
            </div>

            {/* Select Livestock Section */}
            <div data-tour="intent-record-livestock" className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold text-slate-900">
                  Select Livestock *
                </Label>
                {selectedAnimalIds.length > 0 && (
                  <span className="text-[11px] font-semibold text-slate-500">
                    {selectedAnimalIds.length} {selectedAnimalIds.length === 1 ? "animal" : "animals"} selected
                  </span>
                )}
              </div>

              {selectedAnimalIds.length === 0 ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setIsAnimalSelectorOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setIsAnimalSelectorOpen(true);
                    }
                  }}
                  className="group flex cursor-pointer items-center justify-between p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-emerald-50/50 hover:border-emerald-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-100/70 text-emerald-800 border border-emerald-200 group-hover:bg-emerald-200/80 group-hover:scale-105 transition-all">
                      <Plus className="size-5" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-900 group-hover:text-emerald-950">Choose livestock</p>
                      <p className="text-xs text-slate-500">Select one or multiple animals for this declaration</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAnimalSelectorOpen(true);
                    }}
                    className="h-9 rounded-xl border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs px-3.5"
                  >
                    Browse herd
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <Check className="size-3.5 text-emerald-700" />
                      {selectedAnimalIds.length} {selectedAnimalIds.length === 1 ? "head" : "heads"} selected
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAnimalSelectorOpen(true)}
                      className="h-8 text-xs rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold px-3 shadow-2xs"
                    >
                      Browse herd
                    </Button>
                  </div>

                  {/* Selected animal chips */}
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                    {selectedAnimalIds.map((id) => {
                      const animal = intentInventories.find((item) => item.id === id);
                      const label = animal
                        ? (animal.tagNumber || `Animal #${animal.id}`)
                        : `#${id}`;
                      const sub = animal ? `${animal.livestockTypeName}${animal.breed ? ` · ${animal.breed}` : ""}` : "";
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 shadow-2xs"
                        >
                          <span className="font-bold text-emerald-900">{label}</span>
                          {sub && <span className="text-[10px] text-slate-500">({sub})</span>}
                          <button
                            type="button"
                            onClick={() => setSelectedAnimalIds((prev) => prev.filter((item) => item !== id))}
                            className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            title="Remove animal"
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Target Date Section */}
            <div data-tour="intent-record-date" className="space-y-1.5">
              <Label htmlFor="intent-target-date" className="text-sm font-bold text-slate-900">
                Target date (optional)
              </Label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-800" />
                <Input
                  id="intent-target-date"
                  type="date"
                  min={todayStr}
                  value={targetDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && val < todayStr) {
                      toast.error("Target date cannot be in the past. Please select today or a future date.");
                      setTargetDate("");
                      return;
                    }
                    setTargetDate(val);
                  }}
                  className="pl-10 h-11 rounded-xl border-slate-200 bg-slate-50/60 hover:bg-white focus:bg-white text-slate-900 text-sm font-medium"
                  placeholder="mm/dd/yyyy"
                />
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 pt-0.5">
                <Calendar className="size-3.5 text-slate-500 shrink-0" />
                This is the date you plan to bring the animal to the auction (today or future dates only).
              </p>
            </div>

            {/* Certificate of Ownership (from MAO) Section */}
            <div data-tour="intent-record-certificate" className="rounded-2xl border border-emerald-200/90 bg-[#edf8f1] p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
                <BadgeCheck className="size-4.5 text-emerald-700 shrink-0" />
                <span>Certificate of Ownership (from MAO)</span>
              </div>

              <div className="rounded-xl border border-emerald-200/70 bg-white/80 p-3 sm:p-3.5 flex items-start gap-3">
                <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-xs sm:text-sm font-bold text-emerald-950">
                    {targetDate && selectedCertificates.length > 0
                      ? `Retrieved: ${selectedCertificates.join(", ")}`
                      : "Will be retrieved automatically"}
                  </p>
                  <p className="text-[11px] sm:text-xs text-emerald-800/90 leading-relaxed">
                    {targetDate && selectedCertificates.length > 0
                      ? "Assigned Certificate of Ownership (C.O.) from MAO on record for this livestock."
                      : "Once you set a target date, the system will show the assigned Certificate of Ownership (C.O.) from MAO."}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsIntentOpen(false);
                  onClose?.();
                }}
                className="rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium px-4 h-10 text-sm shadow-2xs"
              >
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsIntentOpen(false);
                    onClose?.();
                  }}
                  className="rounded-xl text-slate-700 hover:bg-slate-100 font-medium px-4 h-10 text-sm"
                >
                  Cancel
                </Button>
                <Button
                  data-tour="intent-record-save"
                  type="submit"
                  disabled={recordIntentMutation.isPending || selectedAnimalIds.length === 0}
                  className="rounded-xl bg-[#14532d] hover:bg-[#0f3f22] text-white font-semibold px-5 h-10 text-sm transition-colors shadow-sm disabled:opacity-50"
                >
                  {recordIntentMutation.isPending ? "Declaring..." : "Declare Intent"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
