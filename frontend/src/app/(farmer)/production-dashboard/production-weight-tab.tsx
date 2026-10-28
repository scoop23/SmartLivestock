"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import api from "@/lib/axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpDown,
  Calculator,
  Calendar,
  CheckCircle2,
  Filter,
  LineChart as LineChartIcon,
  Plus,
  Scale,
  Search,
  Sparkles,
  Tag,
  TrendingUp,
  Weight,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { getAutomaticTutorialsEnabled, startGuidedTutorial } from "@/lib/tutorial-preferences";
import {
CartesianGrid,
Line,
LineChart,
XAxis,
YAxis,
} from "recharts";
import { toast } from "sonner";
import type { LivestockInventoryItem } from "../livestock-inventory/livestock-inventory";
import { LivestockPickerField } from "./select-livestock-dialog";

export interface WeightRecordItem {
  id: number;
  livestock: number;
  tag_number?: string;
  livestock_type_name?: string;
  breed?: string;
  weight: number;
  weighing_date: string;
  notes?: string;
  created_at: string;
}

const chartConfig = {
  weight: { label: "Recorded Weight (kg)", color: "#2D5A27" },
} satisfies ChartConfig;

export default function ProductionWeightTab({
  approvedInventories,
  autoOpen = false,
  selectedSpecies,
}: {
  approvedInventories: LivestockInventoryItem[];
  autoOpen?: boolean;
  selectedSpecies?: string;
}) {
  const queryClient = useQueryClient();
  const [isLogOpen, setIsLogOpen] = useState(autoOpen);
  const [selectedLivestockId, setSelectedLivestockId] = useState<string>("");
  const [weightVal, setWeightVal] = useState<string>("");
  const [weighingDate, setWeighingDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [weightSearchQuery, setWeightSearchQuery] = useState("");
  const [weightSortBy, setWeightSortBy] = useState<string>("newest");
  const [selectedAnimalFilter, setSelectedAnimalFilter] = useState<string>("ALL");

  const startWeightTutorial = useCallback(() => {
    const steps: DriveStep[] = [
      { element: '[data-tour="weight-record-animal"]', popover: { title: "Choose the animal", description: "Select the approved animal or herd whose current weight you measured.", side: "bottom", align: "center" } },
      { element: '[data-tour="weight-record-measurements"]', popover: { title: "Enter weight and date", description: "Add the measured weight in kilograms and the date you took the measurement. Previous logs are used to calculate growth.", side: "bottom", align: "center" } },
      { element: '[data-tour="weight-record-notes"]', popover: { title: "Add optional notes", description: "You can add feeding stage or other context for this measurement.", side: "top", align: "start" } },
      { element: '[data-tour="weight-record-save"]', popover: { title: "Save the weight log", description: "Save the measurement to add it to the animal’s growth history.", side: "top", align: "end" } },
    ];
    startGuidedTutorial({ showProgress: true, animate: true, allowClose: true, nextBtnText: "Next", prevBtnText: "Back", doneBtnText: "Finish", progressText: "{{current}} of {{total}}", steps });
  }, []);

  useEffect(() => {
    if (!isLogOpen || !getAutomaticTutorialsEnabled()) return;
    const timer = window.setTimeout(startWeightTutorial, 500);
    return () => window.clearTimeout(timer);
  }, [isLogOpen, startWeightTutorial]);

  const { data: weightRecords = [], isLoading } = useQuery<WeightRecordItem[]>({
    queryKey: ["weight_records"],
    queryFn: async () => {
      const res = await api.get("production/weights/");
      return res.data;
    },
  });

  const logWeightMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await api.post("production/weights/", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Livestock weight recorded successfully!");
      setIsLogOpen(false);
      setSelectedLivestockId("");
      setWeightVal("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["weight_records"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: () => {
      toast.error("Failed to record weight.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLivestockId) {
      toast.error("Please select an animal.");
      return;
    }
    if (!weightVal || Number(weightVal) <= 0) {
      toast.error("Please enter a valid weight in kg.");
      return;
    }

    logWeightMutation.mutate({
      livestock: Number(selectedLivestockId),
      weight: Number(weightVal),
      weighing_date: weighingDate,
      notes: notes.trim(),
    });
  };

  const approvedIds = useMemo(
    () => new Set(approvedInventories.map((i) => Number(i.id))),
    [approvedInventories]
  );

  const scopedWeightRecords = useMemo(() => {
    if (approvedIds.size === 0) return weightRecords;
    return weightRecords.filter((r) => approvedIds.has(Number(r.livestock)));
  }, [approvedIds, weightRecords]);

  // Auto-calculated weight gains per animal
  const recordsWithGain = useMemo(() => {
    const byAnimal: Record<number, WeightRecordItem[]> = {};
    scopedWeightRecords.forEach((r) => {
      if (!byAnimal[r.livestock]) byAnimal[r.livestock] = [];
      byAnimal[r.livestock].push(r);
    });

    const enriched: (WeightRecordItem & { gainKg?: number; adg?: number; daysElapsed?: number })[] = [];

    Object.values(byAnimal).forEach((logs) => {
      const sorted = [...logs].sort(
        (a, b) => new Date(a.weighing_date).getTime() - new Date(b.weighing_date).getTime()
      );
      sorted.forEach((item, idx) => {
        if (idx === 0) {
          enriched.push(item);
        } else {
          const prev = sorted[idx - 1];
          const diffKg = Number((Number(item.weight) - Number(prev.weight)).toFixed(1));
          const days = Math.max(
            1,
            Math.round(
              (new Date(item.weighing_date).getTime() - new Date(prev.weighing_date).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          );
          const adg = Number((diffKg / days).toFixed(2));
          enriched.push({ ...item, gainKg: diffKg, adg, daysElapsed: days });
        }
      });
    });

    return enriched.sort(
      (a, b) => new Date(b.weighing_date).getTime() - new Date(a.weighing_date).getTime()
    );
  }, [scopedWeightRecords]);

  // Unique animals for filter dropdown
  const uniqueWeighedAnimals = useMemo(() => {
    const map = new Map<number, string>();
    recordsWithGain.forEach((r) => {
      if (!map.has(r.livestock)) {
        map.set(r.livestock, r.tag_number || `ID #${r.livestock}`);
      }
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id: String(id), label }));
  }, [recordsWithGain]);

  // Filtered and sorted records for table list
  const filteredWeightRecords = useMemo(() => {
    const q = weightSearchQuery.toLowerCase().trim();
    let result = recordsWithGain.filter((r) => {
      const matchAnimal = selectedAnimalFilter === "ALL" || String(r.livestock) === selectedAnimalFilter;
      const matchQuery =
        !q ||
        (r.tag_number || "").toLowerCase().includes(q) ||
        (r.livestock_type_name || "").toLowerCase().includes(q) ||
        (r.breed || "").toLowerCase().includes(q) ||
        (r.notes || "").toLowerCase().includes(q) ||
        r.weighing_date.includes(q);
      return matchAnimal && matchQuery;
    });

    result = [...result].sort((a, b) => {
      switch (weightSortBy) {
        case "newest":
          return new Date(b.weighing_date).getTime() - new Date(a.weighing_date).getTime();
        case "oldest":
          return new Date(a.weighing_date).getTime() - new Date(b.weighing_date).getTime();
        case "weight_desc":
          return Number(b.weight) - Number(a.weight);
        case "weight_asc":
          return Number(a.weight) - Number(b.weight);
        case "adg_desc":
          return (b.adg ?? -999) - (a.adg ?? -999);
        default:
          return 0;
      }
    });

    return result;
  }, [recordsWithGain, weightSearchQuery, selectedAnimalFilter, weightSortBy]);

  // KPIs
  const totalLogs = scopedWeightRecords.length;
  const avgWeight =
    scopedWeightRecords.length > 0
      ? (
          scopedWeightRecords.reduce((acc, r) => acc + Number(r.weight), 0) /
          scopedWeightRecords.length
        ).toFixed(1)
      : "—";

  const allAdgs = recordsWithGain.filter((r) => r.adg !== undefined).map((r) => r.adg as number);
  const avgHerdAdg =
    allAdgs.length > 0
      ? (allAdgs.reduce((acc, v) => acc + v, 0) / allAdgs.length).toFixed(2)
      : "+0.65";

  // Growth Trend data (sorted by date)
  const chartData = [...scopedWeightRecords]
    .sort((a, b) => new Date(a.weighing_date).getTime() - new Date(b.weighing_date).getTime())
    .map((r) => ({
      date: r.weighing_date,
      weight: Number(r.weight),
      tag: r.tag_number || `ID #${r.livestock}`,
    }));

  return (
    <div className="space-y-6">
      {/* Top Weight & Calculated Growth KPIs */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          title="Average Herd Weight"
          value={avgWeight !== "—" ? `${avgWeight} kg` : "—"}
          icon={<Scale className="size-4.5" />}
          badge="Live scale baseline"
          variant="emerald"
        />
        <KpiCard
          title="Avg Daily Gain (ADG)"
          value={`${Number(avgHerdAdg) >= 0 ? "+" : ""}${avgHerdAdg} kg/day`}
          icon={<Calculator className="size-4.5" />}
          badge="Calculated growth rate"
          variant="sky"
        />
        <KpiCard
          title="Target Market Weight"
          value="380 - 450 kg"
          icon={<TrendingUp className="size-4.5" />}
          badge="Optimal fattening target"
          variant="amber"
        />
        <KpiCard
          title="Weighing Points"
          value={totalLogs.toString()}
          icon={<Weight className="size-4.5" />}
          badge="Logged measurements"
          variant="orange"
        />
      </div>

      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            {selectedSpecies ? `${selectedSpecies} ` : ""}Weight & Growth Velocity
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Log raw weight measurements. Weight gains and Average Daily Gain (ADG) are <strong>automatically calculated</strong> between weighing dates.
          </p>
        </div>
        <Button
          onClick={() => setIsLogOpen(true)}
          className="bg-emerald-700 hover:bg-[#2D5A27] text-white shadow-sm font-semibold gap-2"
        >
          <Plus className="size-4" /> Log {selectedSpecies ? `${selectedSpecies} ` : ""}Weight
        </Button>
      </div>

      {/* Growth Chart & Calculated Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Growth Curve Chart */}
        <Card className="lg:col-span-2 border-slate-200 shadow-sm rounded-2xl">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <LineChartIcon className="size-4 text-emerald-700" /> {selectedSpecies ? `${selectedSpecies} ` : "Herd "}Weight Progression Curve
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Historical body weight measurements across weighing sessions (kg)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            {chartData.length < 2 ? (
              <div className="h-[240px] flex items-center justify-center border border-dashed rounded-xl border-slate-200 text-center p-6">
                <div>
                  <Scale className="size-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600">Need at least 2 weighing entries</p>
                  <p className="text-xs text-slate-400 mt-0.5">Log weight sessions over time to render growth trend lines.</p>
                </div>
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-[240px] min-w-0 w-full">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={11} unit="kg" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="#2D5A27"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#2D5A27" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Calculated Weight & Gain Log */}
        <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="p-5 pb-2 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center justify-between">
              <span>Recent Measurements</span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                Auto-calculated ADG
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="p-6 text-center text-sm text-slate-500">Loading...</p>
            ) : recordsWithGain.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-400">
                No weight records yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                {recordsWithGain.slice(0, 8).map((record) => (
                  <div
                    key={record.id}
                    className="p-3.5 px-4 flex items-center justify-between hover:bg-slate-50/70 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {record.tag_number || `Tag #${record.livestock}`}
                      </p>
                      <div className="flex items-center gap-2 text-slate-500 text-[11px] mt-0.5">
                        <span>{record.weighing_date}</span>
                        {record.gainKg !== undefined && (
                          <span className={`font-semibold ${record.gainKg >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                            {record.gainKg >= 0 ? `+${record.gainKg}` : record.gainKg} kg ({record.daysElapsed}d)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-slate-900 block">
                        {record.weight} kg
                      </span>
                      {record.adg !== undefined && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          {record.adg >= 0 ? `+${record.adg}` : record.adg} kg/d
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── FULL HISTORICAL WEIGHT RECORDS LIST UNDER THE CHART ── */}
      <Card className="rounded-3xl border border-slate-200 shadow-sm bg-white overflow-hidden">
        <CardHeader className="p-5 sm:p-6 pb-4 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Scale className="size-5 text-emerald-700" />
                <span>{selectedSpecies ? `${selectedSpecies} ` : ""}Weigh-In Records History</span>
                <Badge variant="outline" className="ml-2 font-mono text-xs bg-emerald-50 text-emerald-800 border-emerald-200 font-bold">
                  {filteredWeightRecords.length} {filteredWeightRecords.length === 1 ? "Record" : "Records"}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Complete scale measurements with animal tags, automatic weight gain, and Average Daily Gain (ADG) calculations.
              </CardDescription>
            </div>
            <Button
              onClick={() => setIsLogOpen(true)}
              size="sm"
              className="bg-emerald-700 hover:bg-[#2D5A27] text-white shadow-xs font-semibold gap-1.5 self-start sm:self-auto rounded-xl"
            >
              <Plus className="size-3.5" /> Log Weight
            </Button>
          </div>

          {/* Filter, Search & Sort Toolbar */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 mt-1">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                placeholder="Search tag number, species, breed, notes, or date..."
                value={weightSearchQuery}
                onChange={(e) => setWeightSearchQuery(e.target.value)}
                className="pl-9 bg-slate-50/70 border-slate-200 rounded-xl h-10 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {uniqueWeighedAnimals.length > 1 && (
                <Select value={selectedAnimalFilter} onValueChange={setSelectedAnimalFilter}>
                  <SelectTrigger className="w-full sm:w-[170px] rounded-xl h-10 border-slate-200 bg-slate-50/70 text-xs font-medium">
                    <Filter className="size-3.5 text-slate-400 mr-2 shrink-0" />
                    <SelectValue placeholder="All Animals" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Animals</SelectItem>
                    {uniqueWeighedAnimals.map((animal) => (
                      <SelectItem key={animal.id} value={animal.id}>
                        {animal.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={weightSortBy} onValueChange={setWeightSortBy}>
                <SelectTrigger className="w-full sm:w-[170px] rounded-xl h-10 border-slate-200 bg-slate-50/70 text-xs font-medium">
                  <ArrowUpDown className="size-3.5 text-slate-400 mr-2 shrink-0" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest Date</SelectItem>
                  <SelectItem value="oldest">Oldest Date</SelectItem>
                  <SelectItem value="weight_desc">Heaviest First</SelectItem>
                  <SelectItem value="weight_asc">Lightest First</SelectItem>
                  <SelectItem value="adg_desc">Highest Daily Gain</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-sm text-slate-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-3" />
              Loading weight logs...
            </div>
          ) : filteredWeightRecords.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Scale className="size-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">No weight records found</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {weightSearchQuery || selectedAnimalFilter !== "ALL"
                  ? "Try clearing filters to view all recorded logs."
                  : "Click 'Log Weight' to record your first scale measurement."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/75">
                  <TableRow className="border-slate-100">
                    <TableHead className="font-bold text-xs text-slate-700">Animal / Tag #</TableHead>
                    <TableHead className="font-bold text-xs text-slate-700">Weighing Date</TableHead>
                    <TableHead className="font-bold text-xs text-slate-700">Recorded Weight</TableHead>
                    <TableHead className="font-bold text-xs text-slate-700">Weight Gain</TableHead>
                    <TableHead className="font-bold text-xs text-slate-700">Calculated ADG</TableHead>
                    <TableHead className="font-bold text-xs text-slate-700">Days Elapsed</TableHead>
                    <TableHead className="font-bold text-xs text-slate-700">Field Notes / Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100 text-xs">
                  {filteredWeightRecords.map((record) => (
                    <TableRow key={record.id} className="hover:bg-slate-50/70 transition-colors">
                      <TableCell className="py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/80">
                            {record.tag_number || `ID #${record.livestock}`}
                          </span>
                          {(record.livestock_type_name || record.breed) && (
                            <span className="text-[11px] text-slate-500 font-medium">
                              {[record.livestock_type_name, record.breed].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-slate-700 py-3.5 whitespace-nowrap">
                        {record.weighing_date}
                      </TableCell>
                      <TableCell className="font-black text-slate-900 py-3.5 whitespace-nowrap">
                        <span className="text-sm">{Number(record.weight).toFixed(1)}</span>{" "}
                        <span className="text-[10px] text-slate-500 font-bold">kg</span>
                      </TableCell>
                      <TableCell className="py-3.5 whitespace-nowrap">
                        {record.gainKg !== undefined ? (
                          <span
                            className={`font-bold inline-flex items-center gap-1 ${
                              record.gainKg > 0
                                ? "text-emerald-700"
                                : record.gainKg < 0
                                ? "text-rose-600"
                                : "text-slate-600"
                            }`}
                          >
                            {record.gainKg > 0 ? `+${record.gainKg}` : record.gainKg} kg
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Baseline</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3.5 whitespace-nowrap">
                        {record.adg !== undefined ? (
                          <Badge
                            className={`font-bold text-[10px] px-2 py-0.5 rounded-md ${
                              record.adg >= 0.7
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : record.adg >= 0
                                ? "bg-sky-100 text-sky-800 border-sky-200"
                                : "bg-rose-100 text-rose-800 border-rose-200"
                            }`}
                          >
                            {record.adg >= 0 ? `+${record.adg}` : record.adg} kg/day
                          </Badge>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">First weigh-in</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3.5 text-slate-500 whitespace-nowrap">
                        {record.daysElapsed ? `${record.daysElapsed} days` : "—"}
                      </TableCell>
                      <TableCell className="py-3.5 text-slate-600 max-w-xs truncate">
                        {record.notes ? (
                          <span title={record.notes}>{record.notes}</span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No notes</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Weight Dialog */}
      <Dialog open={isLogOpen} onOpenChange={setIsLogOpen}>
        <DialogContent className="sm:max-w-md p-6 rounded-2xl">
          <DialogHeader className="flex-row items-start justify-between gap-3">
            <div className="space-y-1.5">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Scale className="size-5 text-emerald-700" /> Log Cattle Weight
            </DialogTitle>
            <DialogDescription>
              Record current scale weight. The system will automatically compute weight gain and ADG from previous logs.
            </DialogDescription>
            </div>
            <Button type="button" variant="outline" onClick={startWeightTutorial} className="shrink-0 gap-1.5 rounded-xl">
              <Sparkles className="size-4" aria-hidden="true" /> Tutorial
            </Button>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div data-tour="weight-record-animal">
            <LivestockPickerField
              id="weight-animal"
              label="Select Animal / Tag *"
              placeholder="Choose livestock to weigh"
              items={approvedInventories}
              selectedId={selectedLivestockId}
              onSelect={(item) => setSelectedLivestockId(item.id)}
              warnOnActiveDisease
              dialogTitle="Choose Livestock to Weigh"
              dialogDescription="Choose an approved animal or herd from your inventory. Current weights are shown on each card."
              emptyStateText="No approved livestock is available for weight logging."
            />
            </div>

            <div data-tour="weight-record-measurements" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="weight-input">New Weight (kg) *</Label>
                <Input
                  id="weight-input"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 340.5"
                  value={weightVal}
                  onChange={(e) => setWeightVal(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="weighing-date">Weighing Date *</Label>
                <Input
                  id="weighing-date"
                  type="date"
                  max={new Date().toISOString().split("T")[0]}
                  value={weighingDate}
                  onChange={(e) => setWeighingDate(e.target.value)}
                />
              </div>
            </div>

            <div data-tour="weight-record-notes" className="space-y-1.5">
              <Label htmlFor="weight-notes">Notes / Feeding Stage</Label>
              <Input
                id="weight-notes"
                placeholder="e.g. Napier grass + concentrate diet"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsLogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                data-tour="weight-record-save"
                type="submit"
                disabled={logWeightMutation.isPending}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
              >
                {logWeightMutation.isPending ? "Saving..." : "Save Weight Log"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
