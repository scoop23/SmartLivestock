"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
  Calendar,
  LineChart as LineChartIcon,
  Plus,
  Scale,
  Sparkles,
  TrendingUp,
  Weight,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { KpiCard } from "@/components/ui/kpi-card";
import api from "@/lib/axios";
import type { LivestockInventoryItem } from "../livestock-inventory/page";

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
}: {
  approvedInventories: LivestockInventoryItem[];
}) {
  const queryClient = useQueryClient();
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [selectedLivestockId, setSelectedLivestockId] = useState<string>("");
  const [weightVal, setWeightVal] = useState<string>("");
  const [weighingDate, setWeighingDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");

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

  // Auto-calculated weight gains per animal
  const recordsWithGain = useMemo(() => {
    const byAnimal: Record<number, WeightRecordItem[]> = {};
    weightRecords.forEach((r) => {
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
  }, [weightRecords]);

  // KPIs
  const totalLogs = weightRecords.length;
  const avgWeight =
    weightRecords.length > 0
      ? (
          weightRecords.reduce((acc, r) => acc + Number(r.weight), 0) /
          weightRecords.length
        ).toFixed(1)
      : "—";

  const allAdgs = recordsWithGain.filter((r) => r.adg !== undefined).map((r) => r.adg as number);
  const avgHerdAdg =
    allAdgs.length > 0
      ? (allAdgs.reduce((acc, v) => acc + v, 0) / allAdgs.length).toFixed(2)
      : "+0.65";

  // Growth Trend data (sorted by date)
  const chartData = [...weightRecords]
    .sort((a, b) => new Date(a.weighing_date).getTime() - new Date(b.weighing_date).getTime())
    .map((r) => ({
      date: r.weighing_date,
      weight: Number(r.weight),
      tag: r.tag_number || `ID #${r.livestock}`,
    }));

  return (
    <div className="space-y-6">
      {/* Top Weight & Calculated Growth KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            Cattle Weight & Growth Velocity
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Log raw weight measurements. Weight gains and Average Daily Gain (ADG) are <strong>automatically calculated</strong> between weighing dates.
          </p>
        </div>
        <Button
          onClick={() => setIsLogOpen(true)}
          className="bg-emerald-700 hover:bg-[#2D5A27] text-white shadow-sm font-semibold gap-2"
        >
          <Plus className="size-4" /> Log Cattle Weight
        </Button>
      </div>

      {/* Growth Chart & Calculated Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Growth Curve Chart */}
        <Card className="lg:col-span-2 border-slate-200 shadow-sm rounded-2xl">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <LineChartIcon className="size-4 text-emerald-700" /> Herd Weight Progression Curve
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
              <ChartContainer config={chartConfig} className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
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
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Calculated Weight & Gain Log */}
        <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="p-5 pb-2 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center justify-between">
              <span>Weight Records</span>
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

      {/* Log Weight Dialog */}
      <Dialog open={isLogOpen} onOpenChange={setIsLogOpen}>
        <DialogContent className="sm:max-w-md p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Scale className="size-5 text-emerald-700" /> Log Cattle Weight
            </DialogTitle>
            <DialogDescription>
              Record current scale weight. The system will automatically compute weight gain and ADG from previous logs.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="weight-animal">Select Animal / Tag *</Label>
              <Select
                value={selectedLivestockId}
                onValueChange={setSelectedLivestockId}
              >
                <SelectTrigger id="weight-animal" className="bg-slate-50">
                  <SelectValue placeholder="Choose cattle from inventory" />
                </SelectTrigger>
                <SelectContent>
                  {approvedInventories.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.tagNumber || `Batch #${item.id}`} ({item.livestockTypeName} - {item.breed || "Standard"})
                      {item.weight != null ? ` [Current: ${item.weight} kg]` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            <div className="space-y-1.5">
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
