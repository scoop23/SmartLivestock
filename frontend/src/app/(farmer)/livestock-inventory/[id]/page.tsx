"use client";

import React, { useState, useMemo, use } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Tag,
  Scale,
  Calendar,
  Activity,
  ShieldCheck,
  TrendingUp,
  Stethoscope,
  QrCode,
  Printer,
  Edit,
  Plus,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  Clock,
  Beef,
  Milk,
  Egg,
  Heart,
  FileText,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useUserInventory, type LivestockInventoryItem, getAvatarById } from "../livestock-inventory";

interface WeightLog {
  date: string;
  weight: number;
  gain: number;
  adg: number;
  notes: string;
}

interface ProductionLog {
  date: string;
  type: string;
  quantity: number;
  unit: string;
  status: string;
  notes: string;
}

export default function LivestockDetailPage() {
  const router = useRouter();
  const params = useParams();
  const rawId = params?.id ? decodeURIComponent(String(params.id)) : "";

  const { data: inventories = [], isLoading } = useUserInventory();

  // Find in user's inventory
  const inventoryMatch = useMemo(() => {
    return inventories.find(
      (item) =>
        String(item.id) === rawId ||
        (item.tagNumber && item.tagNumber.toUpperCase() === rawId.toUpperCase())
    );
  }, [inventories, rawId]);

  // Modals state
  const [isWeighDialogOpen, setIsWeighDialogOpen] = useState(false);
  const [isPassportDialogOpen, setIsPassportDialogOpen] = useState(false);
  const [isProductionDialogOpen, setIsProductionDialogOpen] = useState(false);

  // New weight entry form
  const [newWeight, setNewWeight] = useState("72.0");
  const [weighNotes, setWeighNotes] = useState("Routine weekly weigh check");

  // New production form
  const [prodQuantity, setProdQuantity] = useState("12.5");
  const [prodNotes, setProdNotes] = useState("Morning milking yield");

  // Determine Animal Properties
  const animal = useMemo(() => {
    if (inventoryMatch) {
      const isBatch = inventoryMatch.entryType === "BATCH";
      return {
        id: String(inventoryMatch.id),
        tagNumber: inventoryMatch.tagNumber || `ANIMAL-${inventoryMatch.id}`,
        name: isBatch ? `Batch Cohort #${inventoryMatch.id}` : `Livestock #${inventoryMatch.id}`,
        species: inventoryMatch.livestockTypeName || "Livestock",
        breed: inventoryMatch.breed || "Standard Breed",
        sex: inventoryMatch.sex || "Female",
        currentWeight: inventoryMatch.weight || 68.5,
        targetWeight: inventoryMatch.livestockTypeName.toLowerCase().includes("cattle") ? 420 : 90,
        ageMonths: 4.8,
        birthDate: "2026-04-20",
        entryType: "INDIVIDUAL",
        batchParentCode: inventoryMatch.batchCode || null,
        status: inventoryMatch.status || "APPROVED",
        barangay: "Poblacion, Padre Garcia",
        lastVaccination: inventoryMatch.lastVaccinationDate || "2026-08-15",
        adg: 0.74,
        bcs: 3.5, // Body condition score
      };
    }

    // Default Fallback for Demo & Mock tags (e.g. SWN-01-01 or direct URL param)
    const isSwine = rawId.toLowerCase().includes("swn") || rawId.toLowerCase().includes("pig");
    const isCattle = rawId.toLowerCase().includes("cat") || rawId.toLowerCase().includes("cow");

    return {
      id: rawId || "demo-01",
      tagNumber: rawId || "SWN-2026-01",
      name: `Livestock ${rawId || "SWN-01"}`,
      species: isCattle ? "Cattle" : isSwine ? "Swine" : "Swine",
      breed: isCattle ? "Brahman Cross" : "Large White x Landrace",
      sex: "Female",
      currentWeight: isCattle ? 385 : 68.5,
      targetWeight: isCattle ? 450 : 90,
      ageMonths: isCattle ? 18 : 4.5,
      birthDate: "2026-05-10",
      entryType: "INDIVIDUAL",
      batchParentCode: "BATCH-SWN-2026-01",
      status: "APPROVED",
      barangay: "San Felipe, Padre Garcia",
      lastVaccination: "2026-08-20",
      adg: isCattle ? 0.85 : 0.76,
      bcs: 3.5,
    };
  }, [inventoryMatch, rawId]);

  // Weight History Log
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([
    { date: "2026-07-15", weight: 35.0, gain: 0, adg: 0.65, notes: "Initial cohort arrival" },
    { date: "2026-08-01", weight: 46.2, gain: 11.2, adg: 0.70, notes: "Transition to grower feed" },
    { date: "2026-08-15", weight: 56.5, gain: 10.3, adg: 0.73, notes: "Post-deworming weigh" },
    { date: "2026-09-01", weight: 64.0, gain: 7.5, adg: 0.75, notes: "Healthy appetite" },
    { date: "2026-09-18", weight: animal.currentWeight, gain: 4.5, adg: animal.adg, notes: "Recent official check" },
  ]);

  // Production Logs (Milk or Meat yield)
  const [productionLogs, setProductionLogs] = useState<ProductionLog[]>([
    { date: "2026-09-22", type: "Milk", quantity: 12.5, unit: "L", status: "VERIFIED", notes: "AM: 6.8L / PM: 5.7L" },
    { date: "2026-09-21", type: "Milk", quantity: 13.0, unit: "L", status: "VERIFIED", notes: "AM: 7.0L / PM: 6.0L" },
    { date: "2026-09-20", type: "Milk", quantity: 12.2, unit: "L", status: "VERIFIED", notes: "Normal butterfat consistency" },
  ]);

  // Handle saving new weight
  const handleAddWeight = () => {
    const val = parseFloat(newWeight);
    if (isNaN(val) || val <= 0) {
      toast.error("Please enter a valid weight in kilograms.");
      return;
    }

    const last = weightLogs[weightLogs.length - 1];
    const gain = last ? Math.round((val - last.weight) * 10) / 10 : 0;
    const newAdg = Math.round((gain / 14) * 100) / 100;

    const entry: WeightLog = {
      date: new Date().toISOString().split("T")[0],
      weight: val,
      gain: Math.max(gain, 0),
      adg: newAdg > 0 ? newAdg : animal.adg,
      notes: weighNotes || "Manual weigh check",
    };

    setWeightLogs([...weightLogs, entry]);
    toast.success(`Weight recorded: ${val} kg for ${animal.tagNumber}`);
    setIsWeighDialogOpen(false);
  };

  // Handle adding production yield
  const handleAddProduction = () => {
    const qty = parseFloat(prodQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid yield quantity.");
      return;
    }

    const entry: ProductionLog = {
      date: new Date().toISOString().split("T")[0],
      type: animal.species.toLowerCase().includes("cattle") ? "Milk" : "Meat Yield",
      quantity: qty,
      unit: animal.species.toLowerCase().includes("cattle") ? "L" : "kg",
      status: "PENDING",
      notes: prodNotes,
    };

    setProductionLogs([entry, ...productionLogs]);
    toast.success(`Production record of ${qty} ${entry.unit} submitted for verification.`);
    setIsProductionDialogOpen(false);
  };

  // Projected Dressing Yield for Slaughter
  const meatDressingPct = animal.species.toLowerCase().includes("cattle") ? 58 : 74;
  const projectedCarcassKg = Math.round((animal.currentWeight * (meatDressingPct / 100)) * 10) / 10;

  const localPhoto = typeof window !== "undefined" ? localStorage.getItem(`livestock_photo_${inventoryMatch?.id || animal.tagNumber}`) : null;
  const localAvatar = typeof window !== "undefined" ? localStorage.getItem(`livestock_avatar_${inventoryMatch?.id || animal.tagNumber}`) : null;
  const photoUrl = inventoryMatch?.photoUrl || localPhoto;
  const avatar = getAvatarById(inventoryMatch?.avatarKey || localAvatar, animal.species);

  return (
    <>
      <PageHeader
        title={`Livestock Profile: ${animal.tagNumber}`}
        subtitle={`Official Animal Digital Passport & Biometric Tracking • Padre Garcia LGU`}
        variant="farmer"
        maxWidthClass="w-full"
      />

      <div className="p-4 md:p-8 w-full space-y-6 max-w-7xl mx-auto">
        {/* Navigation & Breadcrumb */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Link href="/livestock-inventory">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-slate-300 font-bold text-xs gap-1.5 text-slate-700 hover:bg-slate-100"
              >
                <ArrowLeft className="size-3.5" /> Back to Herd
              </Button>
            </Link>

            {animal.batchParentCode && (
              <Link href="/livestock-inventory/batches">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-emerald-300 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-100 font-bold text-xs gap-1.5"
                >
                  <Layers className="size-3.5 text-emerald-600" />
                  <span>Batch: {animal.batchParentCode}</span>
                </Button>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={() => setIsPassportDialogOpen(true)}
              variant="outline"
              size="sm"
              className="rounded-xl border-slate-300 font-bold text-xs gap-1.5 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <QrCode className="size-3.5 text-slate-600" /> Print Passport
            </Button>

            <Button
              onClick={() => setIsWeighDialogOpen(true)}
              size="sm"
              className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs gap-1.5 cursor-pointer shadow-sm"
            >
              <Scale className="size-3.5" /> Log Weight
            </Button>
          </div>
        </div>

        {/* ── HERO PASSPORT CARD ──────────────────────────────────────────── */}
        <Card className="rounded-3xl border-slate-200 shadow-md bg-white overflow-hidden">
          <div className="bg-gradient-to-r from-[#1E4D2B] via-[#245833] to-[#1a4425] text-white p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={animal.tagNumber}
                      className="size-16 sm:size-20 rounded-2xl object-cover border-2 border-emerald-400 shadow-md"
                    />
                  ) : (
                    <div
                      className={`size-16 sm:size-20 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl bg-gradient-to-br border-2 border-white/20 shadow-md ${avatar.bgGradient}`}
                      title={`${avatar.name} (${avatar.badge})`}
                    >
                      {avatar.emoji}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {animal.tagNumber}
                    </span>
                    <Badge className="bg-emerald-400 text-emerald-950 font-black text-xs px-2.5 py-0.5">
                      {animal.status}
                    </Badge>
                    <Badge variant="outline" className="text-emerald-100 border-emerald-300/40 text-xs">
                      {animal.species}
                    </Badge>
                    {animal.batchParentCode && (
                      <Link href="/livestock-inventory/batches">
                        <Badge className="bg-teal-500/30 hover:bg-teal-500/50 text-teal-200 border-teal-400/40 font-bold text-xs px-2.5 py-0.5 inline-flex items-center gap-1 transition-colors cursor-pointer">
                          <Layers className="size-3" />
                          <span>Cohort: {animal.batchParentCode}</span>
                        </Badge>
                      </Link>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-emerald-100/90">
                    {animal.name} • {animal.breed}
                  </h3>

                  <p className="text-xs text-emerald-200/70 font-medium">
                    Farm Origin: <strong>{animal.barangay}</strong> • Estimated Age: {animal.ageMonths} months
                  </p>
                </div>
              </div>

              {/* Quick Biometrics Right Panel */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-black/20 p-4 rounded-2xl border border-white/10 text-center">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-emerald-200/60">Live Weight</span>
                  <p className="text-lg font-black text-white">{animal.currentWeight} kg</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-emerald-200/60">Daily Gain</span>
                  <p className="text-lg font-black text-emerald-300">+{animal.adg} kg/d</p>
                </div>
                <div className="space-y-0.5 col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-200/60">Gender</span>
                  <p className="text-lg font-black text-white">{animal.sex}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Info Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100 border-t border-slate-100 text-xs bg-slate-50/50">
            <div className="p-3.5 space-y-0.5">
              <span className="text-[10px] font-bold uppercase text-slate-400">Target Weight</span>
              <p className="font-black text-slate-900">{animal.targetWeight} kg</p>
            </div>
            <div className="p-3.5 space-y-0.5">
              <span className="text-[10px] font-bold uppercase text-slate-400">Body Condition Score</span>
              <p className="font-black text-slate-900">{animal.bcs} / 5.0 (Optimal)</p>
            </div>
            <div className="p-3.5 space-y-0.5">
              <span className="text-[10px] font-bold uppercase text-slate-400">Carcass Yield Projection</span>
              <p className="font-black text-emerald-700">~{projectedCarcassKg} kg meat ({meatDressingPct}%)</p>
            </div>
            <div className="p-3.5 space-y-0.5">
              <span className="text-[10px] font-bold uppercase text-slate-400">Last Vaccination</span>
              <p className="font-black text-slate-900">{animal.lastVaccination}</p>
            </div>
          </div>
        </Card>

        {/* ── TABS: DETAILS, WEIGHT CURVE, PRODUCTION YIELD, HEALTH ───────── */}
        <Tabs defaultValue="growth" className="w-full space-y-6">
          <TabsList className="bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
            <TabsTrigger
              value="growth"
              className="rounded-xl font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-xs px-4"
            >
              <TrendingUp className="size-3.5 mr-1.5 text-emerald-600" /> Growth & Weight Logs
            </TabsTrigger>
            <TabsTrigger
              value="production"
              className="rounded-xl font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-xs px-4"
            >
              <Milk className="size-3.5 mr-1.5 text-sky-600" /> Production & Yield
            </TabsTrigger>
            <TabsTrigger
              value="health"
              className="rounded-xl font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-xs px-4"
            >
              <Stethoscope className="size-3.5 mr-1.5 text-rose-600" /> Health & Vaccines
            </TabsTrigger>
            <TabsTrigger
              value="pedigree"
              className="rounded-xl font-bold text-xs data-[state=active]:bg-white data-[state=active]:shadow-xs px-4"
            >
              <Heart className="size-3.5 mr-1.5 text-purple-600" /> Pedigree & Breeding
            </TabsTrigger>
          </TabsList>

          {/* ── TAB 1: GROWTH & WEIGHT LOGS ───────────────────────────────── */}
          <TabsContent value="growth" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Chart Card */}
              <Card className="lg:col-span-2 rounded-3xl border-slate-200 shadow-sm bg-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-black text-slate-900">
                      Weight Gain & Growth Progression
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Historical body weight recordings compared against target market weight ({animal.targetWeight} kg).
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => setIsWeighDialogOpen(true)}
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-xs font-bold border-slate-300"
                  >
                    <Plus className="size-3.5 mr-1" /> Log Weight
                  </Button>
                </div>

                <div className="h-64 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weightLogs} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} unit="kg" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1E293B",
                          border: "none",
                          borderRadius: "12px",
                          color: "white",
                          fontSize: "12px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke="#10B981"
                        strokeWidth={3}
                        dot={{ r: 4, fill: "#059669", stroke: "#FFFFFF", strokeWidth: 2 }}
                        name="Live Weight (kg)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Feed & Efficiency Card */}
              <Card className="rounded-3xl border-slate-200 shadow-sm bg-white p-5 space-y-4">
                <CardTitle className="text-base font-black text-slate-900">
                  Feed & Growth Metrics
                </CardTitle>

                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-emerald-800">
                      Average Daily Gain (ADG)
                    </span>
                    <p className="text-xl font-black text-emerald-950">+{animal.adg} kg/day</p>
                    <p className="text-slate-600 text-[11px]">Consistent positive weight curve above average.</p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500">
                      Progress to Target
                    </span>
                    <p className="text-base font-black text-slate-900">
                      {Math.round((animal.currentWeight / animal.targetWeight) * 100)}% Completed
                    </p>
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div
                        className="bg-emerald-600 h-1.5 rounded-full"
                        style={{ width: `${Math.min((animal.currentWeight / animal.targetWeight) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500">
                      Feed Intake Guideline
                    </span>
                    <p className="font-black text-slate-900">~2.4 kg / day</p>
                    <p className="text-slate-500 text-[11px]">Recommended finisher blend for maximum carcass yield.</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Weigh-in Table */}
            <Card className="rounded-3xl border-slate-200 shadow-sm bg-white overflow-hidden">
              <CardHeader className="p-5 pb-3 border-b border-slate-100">
                <CardTitle className="text-base font-black text-slate-900">
                  Weigh-In Historical Logs
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50/70">
                    <TableRow>
                      <TableHead className="font-bold text-xs text-slate-600">Recording Date</TableHead>
                      <TableHead className="font-bold text-xs text-slate-600">Weight (kg)</TableHead>
                      <TableHead className="font-bold text-xs text-slate-600">Gain (kg)</TableHead>
                      <TableHead className="font-bold text-xs text-slate-600">Calculated ADG</TableHead>
                      <TableHead className="font-bold text-xs text-slate-600">Field Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weightLogs.map((log, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-bold text-xs text-slate-800">{log.date}</TableCell>
                        <TableCell className="font-black text-xs text-emerald-800">{log.weight} kg</TableCell>
                        <TableCell className="text-xs font-bold text-slate-700">
                          {log.gain > 0 ? `+${log.gain} kg` : "—"}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-emerald-700">
                          +{log.adg} kg/d
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 font-medium">{log.notes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB 2: PRODUCTION & YIELD ─────────────────────────────────── */}
          <TabsContent value="production" className="space-y-6">
            <Card className="rounded-3xl border-slate-200 shadow-sm bg-white p-6 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-black text-slate-900">
                    Animal Production Records (Milk / Meat Yield)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 font-medium">
                    Output records for this individual animal linked directly to the municipal production registry.
                  </CardDescription>
                </div>

                <Button
                  onClick={() => setIsProductionDialogOpen(true)}
                  size="sm"
                  className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs gap-1.5"
                >
                  <Plus className="size-3.5" /> Log New Output
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Total Recorded Yield</span>
                  <p className="text-2xl font-black text-slate-900">
                    {productionLogs.reduce((acc, curr) => acc + curr.quantity, 0).toFixed(1)} {productionLogs[0]?.unit || "L"}
                  </p>
                  <p className="text-slate-500 text-[11px]">Across {productionLogs.length} verified recordings</p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Projected Meat Yield</span>
                  <p className="text-2xl font-black text-emerald-800">~{projectedCarcassKg} kg</p>
                  <p className="text-slate-500 text-[11px]">{meatDressingPct}% dressed carcass ratio</p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Estimated Market Value</span>
                  <p className="text-2xl font-black text-slate-900">
                    ₱{(projectedCarcassKg * 280).toLocaleString()}
                  </p>
                  <p className="text-slate-500 text-[11px]">Based on Padre Garcia Auction benchmark (₱280/kg)</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 overflow-hidden mt-4">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-bold text-xs text-slate-600">Date</TableHead>
                      <TableHead className="font-bold text-xs text-slate-600">Product</TableHead>
                      <TableHead className="font-bold text-xs text-slate-600">Quantity</TableHead>
                      <TableHead className="font-bold text-xs text-slate-600">Inspection Status</TableHead>
                      <TableHead className="font-bold text-xs text-slate-600">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productionLogs.map((log, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-bold text-xs text-slate-800">{log.date}</TableCell>
                        <TableCell className="text-xs font-semibold text-slate-700">{log.type}</TableCell>
                        <TableCell className="font-black text-xs text-slate-900">
                          {log.quantity} {log.unit}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-emerald-100 text-emerald-900 border-emerald-200 text-[10px] font-black">
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 font-medium">{log.notes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* ── TAB 3: HEALTH & VACCINES ──────────────────────────────────── */}
          <TabsContent value="health" className="space-y-6">
            <Card className="rounded-3xl border-slate-200 shadow-sm bg-white p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-black text-slate-900">
                    Veterinary & Biosecurity Record
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 font-medium">
                    Immunization history, disease incident logs, and Padre Garcia municipal vet checks.
                  </CardDescription>
                </div>

                <Link href="/report-observation">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs gap-1.5"
                  >
                    <AlertTriangle className="size-3.5" /> Report Illness
                  </Button>
                </Link>
              </div>

              <div className="space-y-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-start gap-3">
                  <ShieldCheck className="size-5 text-emerald-700 mt-0.5 shrink-0" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-black text-slate-900">
                      Foot-and-Mouth Disease (FMD) Protection — Current
                    </p>
                    <p className="text-[11px] text-slate-600">
                      Administered on <strong>{animal.lastVaccination}</strong> by Accredited SIBAT Inspector. Next booster due: Dec 2026.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                  <CheckCircle2 className="size-5 text-slate-500 mt-0.5 shrink-0" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-black text-slate-900">
                      Broad-Spectrum Deworming (Albendazole)
                    </p>
                    <p className="text-[11px] text-slate-600">
                      Completed on July 10, 2026. Zero negative reactions recorded.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                  <CheckCircle2 className="size-5 text-slate-500 mt-0.5 shrink-0" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-black text-slate-900">
                      Iron & Vitamin B-Complex Injection
                    </p>
                    <p className="text-[11px] text-slate-600">
                      Early growth supplementation given on June 01, 2026.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* ── TAB 4: PEDIGREE & BREEDING ─────────────────────────────────── */}
          <TabsContent value="pedigree" className="space-y-6">
            <Card className="rounded-3xl border-slate-200 shadow-sm bg-white p-6 space-y-4">
              <CardTitle className="text-base font-black text-slate-900">
                Lineage & Parentage Pedigree
              </CardTitle>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-blue-600">Sire (Father)</span>
                  <p className="text-sm font-black text-slate-900">BULL-BAT-2024-99 (Imported Semen)</p>
                  <p className="text-xs text-slate-500 font-medium">Breed: Purebred Landrace Boar • Proven High ADG Lineage</p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-rose-600">Dam (Mother)</span>
                  <p className="text-sm font-black text-slate-900">SOW-BAT-2025-14 (Padre Garcia Registered)</p>
                  <p className="text-xs text-slate-500 font-medium">Breed: Large White F1 • Litter size: 12 healthy piglets</p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── MODAL: LOG WEIGHT ─────────────────────────────────────────────── */}
      <Dialog open={isWeighDialogOpen} onOpenChange={setIsWeighDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-white border-slate-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Scale className="size-5 text-emerald-600" />
              <span>Record New Weight for {animal.tagNumber}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Enter the current scale reading. The system will calculate Average Daily Gain (ADG) and update yield projections.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700">New Weight (kg)</Label>
              <Input
                type="number"
                step="0.1"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                className="rounded-xl border-slate-300 font-black text-lg h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700">Weigh Notes</Label>
              <Input
                value={weighNotes}
                onChange={(e) => setWeighNotes(e.target.value)}
                placeholder="e.g. Weigh before morning feeding"
                className="rounded-xl border-slate-300"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsWeighDialogOpen(false)}
              className="rounded-xl font-bold text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAddWeight}
              className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
            >
              Save Weigh Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: LOG PRODUCTION ─────────────────────────────────────────── */}
      <Dialog open={isProductionDialogOpen} onOpenChange={setIsProductionDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-white border-slate-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Milk className="size-5 text-sky-600" />
              <span>Log Production Output for {animal.tagNumber}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Record individual daily milk yield, egg quantity, or harvest parameters.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700">Yield Quantity ({animal.species.toLowerCase().includes("cattle") ? "Liters" : "kg"})</Label>
              <Input
                type="number"
                step="0.1"
                value={prodQuantity}
                onChange={(e) => setProdQuantity(e.target.value)}
                className="rounded-xl border-slate-300 font-black text-lg h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700">Notes / Remarks</Label>
              <Input
                value={prodNotes}
                onChange={(e) => setProdNotes(e.target.value)}
                placeholder="e.g. Morning milking, healthy animal condition."
                className="rounded-xl border-slate-300"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsProductionDialogOpen(false)}
              className="rounded-xl font-bold text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAddProduction}
              className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
            >
              Submit Yield Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: PRINT LGU PASSPORT ─────────────────────────────────────── */}
      <Dialog open={isPassportDialogOpen} onOpenChange={setIsPassportDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 bg-white border-slate-100 shadow-2xl">
          <DialogHeader className="text-center">
            <div className="mx-auto shrink-0 mb-2">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={animal.tagNumber}
                  className="size-14 rounded-2xl object-cover border-2 border-emerald-600 shadow-md mx-auto"
                />
              ) : (
                <div
                  className={`size-14 rounded-2xl flex items-center justify-center text-2xl bg-gradient-to-br border-2 border-emerald-300 shadow-md mx-auto ${avatar.bgGradient}`}
                >
                  {avatar.emoji}
                </div>
              )}
            </div>
            <DialogTitle className="text-lg font-black text-slate-900">
              Padre Garcia Official Animal Passport
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Municipal Biosecurity & Livestock Traceability Card
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2 text-center">
            <p className="font-black text-base text-slate-900 tracking-wider">{animal.tagNumber}</p>
            <p className="text-slate-600 font-medium">Species: {animal.species} • Breed: {animal.breed}</p>
            <p className="text-slate-500 font-medium">Gender: {animal.sex} • Weight: {animal.currentWeight} kg</p>
            <p className="text-emerald-700 font-bold text-[11px] pt-1 border-t border-slate-200">
              Verified under Municipal Animal Health Ordinance No. 2026-03
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPassportDialogOpen(false)}
              className="rounded-xl font-bold text-xs flex-1"
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                toast.success("Print command sent to local printer / PDF export.");
                setIsPassportDialogOpen(false);
              }}
              className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex-1 gap-1.5"
            >
              <Printer className="size-3.5" /> Print Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
