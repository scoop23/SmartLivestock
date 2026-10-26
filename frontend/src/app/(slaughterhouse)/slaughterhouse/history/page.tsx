"use client";

import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card,CardContent,CardHeader,CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Label } from "@/components/ui/label";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from "@/components/ui/table";
import api from "@/lib/axios";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building,
  CalendarDays,
  Clock,
  History,
  Scale,
  Scissors,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type SlaughterRecord = {
  id: number;
  livestock_type: number;
  livestock_type_name: string;
  quantity: number;
  carcass_weight: string | null;
  record_date: string;
  status: "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION";
  review_remarks: string;
  created_by_name: string;
  can_edit: boolean;
};

type LivestockType = { id: number; name: string };

const MONTHS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1).padStart(2, "0"),
  label: new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(2020, index, 1)),
}));

export default function SlaughterhouseHistoryPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState("all");
  const [livestockType, setLivestockType] = useState("all");

  // Live real-time clock updating every second
  const [clockString, setClockString] = useState<string>("");

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const updateTime = () => {
      setClockString(`${formatter.format(new Date())} PHT`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // The API applies date and livestock-type filters before returning records,
  // so the history page only loads the period the staff member selected.
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (year !== "all") {
      const monthNumber = month === "all" ? 12 : Number(month);
      const startMonth = month === "all" ? "01" : month;
      const lastDay = new Date(Number(year), monthNumber, 0).getDate();
      params.set("start_date", `${year}-${startMonth}-01`);
      params.set("end_date", `${year}-${month === "all" ? "12" : month}-${String(lastDay).padStart(2, "0")}`);
    }
    if (livestockType !== "all") params.set("livestock_type", livestockType);
    return params.toString();
  }, [year, month, livestockType]);

  const recordsQuery = useQuery({
    queryKey: ["slaughterhouse-history", year, month, livestockType],
    queryFn: async () => (await api.get<SlaughterRecord[]>(`/production/slaughterhouse/records/${query ? `?${query}` : ""}`)).data,
  });
  const typesQuery = useQuery({
    queryKey: ["slaughterhouse-livestock-types"],
    queryFn: async () => (await api.get<LivestockType[]>("/production/slaughterhouse/livestock-types/")).data,
  });

  // When staff choose All years, the endpoint returns their full authorized
  // history; filter the selected month locally because it spans multiple years.
  const records = useMemo(() => {
    const rows = recordsQuery.data ?? [];
    return year === "all" && month !== "all"
      ? rows.filter((row) => row.record_date.slice(5, 7) === month)
      : rows;
  }, [recordsQuery.data, year, month]);

  // Pending or returned rows remain visible for tracking, but official totals
  // include approved records only, matching the MAO reporting boundary.
  const approved = records.filter((row) => row.status === "APPROVED");
  const summary = useMemo(() => {
    const heads = approved.reduce((sum, row) => sum + row.quantity, 0);
    const weightedHeads = approved.reduce((sum, row) => sum + (row.carcass_weight ? row.quantity : 0), 0);
    const kilograms = approved.reduce((sum, row) => sum + Number(row.carcass_weight ?? 0), 0);
    return { heads, kilograms, weightedHeads, average: weightedHeads ? kilograms / weightedHeads : null };
  }, [approved]);

  const typesById = new Map((typesQuery.data ?? []).map((type) => [type.id, type.name]));
  const years = Array.from({ length: currentYear - 1999 }, (_, index) => String(currentYear - index));

  return (
    <>
      <PageHeader title="Slaughter History" subtitle="Browse previous monthly and yearly slaughter records" variant="slaughterhouse" icon={<History className="size-5" />} maxWidthClass="w-full" />

      {/* Upper Micro-Telemetry Banner with Live Realtime Clock */}
      <div className="border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-4 py-2 sm:px-6 md:px-8">
        <div className="w-full flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] text-slate-500">
          <div className="flex items-center gap-2 font-semibold text-slate-600">
            <Building className="size-3.5 text-rose-600" />
            <span>
              FACILITY:{" "}
              <strong className="font-mono text-slate-900 uppercase">
                PADRE GARCIA MUNICIPAL SLAUGHTERHOUSE
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-slate-700">
              <Clock className="size-3.5 text-slate-400" />
              <span className="tabular-nums font-bold">
                {clockString || "Loading Manila time…"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full space-y-5 p-4 sm:p-6 lg:p-8">
        <Card className="rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-md shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-bold text-slate-900">Choose a period</CardTitle>
            <p className="text-sm text-slate-500">Select a month and year to review past submissions and approved facility totals.</p>
          </CardHeader>
          <CardContent className="grid gap-4 pt-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="history-year">Year</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger id="history-year" className="min-h-10 rounded-xl border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All years</SelectItem>
                  {years.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="history-month">Month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger id="history-month" className="min-h-10 rounded-xl border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All months</SelectItem>
                  {MONTHS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="history-type">Livestock Type</Label>
              <Select value={livestockType} onValueChange={setLivestockType}>
                <SelectTrigger id="history-type" className="min-h-10 rounded-xl border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {(typesQuery.data ?? []).map((type) => <SelectItem key={type.id} value={String(type.id)}>{type.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {recordsQuery.isError ? (
          <Card><CardContent className="py-10 text-center">
            <p className="font-semibold">Unable to load slaughter history.</p>
            <p className="mt-1 text-sm text-muted-foreground">Check your session and connection, then retry.</p>
            <Button className="mt-4" variant="outline" onClick={() => void recordsQuery.refetch()}>Try again</Button>
          </CardContent></Card>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard title="Approved heads" value={recordsQuery.isError ? "—" : summary.heads.toLocaleString()} description="For selected period" variant="rose" icon={<Scissors className="size-4" />} isLoading={recordsQuery.isLoading} />
          <KpiCard title="Recorded weight" value={recordsQuery.isError || !summary.weightedHeads ? "—" : `${summary.kilograms.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`} description="Approved records with weight" variant="amber" icon={<Scale className="size-4" />} isLoading={recordsQuery.isLoading} />
          <KpiCard title="Average per weighed head" value={recordsQuery.isError || summary.average === null ? "—" : `${summary.average.toFixed(2)} kg`} description="Recorded kg ÷ heads with weight" variant="sky" icon={<CalendarDays className="size-4" />} isLoading={recordsQuery.isLoading} />
        </div>

        <Card className="rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-md shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-bold text-slate-900">Records {year === "all" ? "across all years" : `for ${year}`}{month !== "all" ? ` · ${MONTHS[Number(month) - 1]?.label}` : ""}</CardTitle>
            <p className="text-sm text-slate-500">Approved totals appear in the summary cards. Pending and returned records are included below for submission history.</p>
          </CardHeader>
          <CardContent className="pt-4">
            {recordsQuery.isLoading ? <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div> : records.length ? (
              <>
                <div className="hidden overflow-x-auto rounded-xl border border-slate-200/90 bg-white md:block">
                  <Table className="min-w-[700px]">
                    <TableHeader className="bg-slate-50/80"><TableRow><TableHead>Date</TableHead><TableHead>Livestock Type</TableHead><TableHead className="text-right">Heads</TableHead><TableHead className="text-right">Kilograms</TableHead><TableHead>Status</TableHead><TableHead>Submitted by</TableHead></TableRow></TableHeader>
                    <TableBody>{records.map((row) => <TableRow key={row.id}>
                      <TableCell>{row.record_date}</TableCell><TableCell className="font-semibold text-slate-900">{row.livestock_type_name || typesById.get(row.livestock_type) || "Unspecified"}</TableCell>
                      <TableCell className="text-right tabular-nums font-bold">{row.quantity}</TableCell><TableCell className="text-right tabular-nums">{row.carcass_weight ? `${Number(row.carcass_weight).toLocaleString()} kg` : "Not recorded"}</TableCell>
                      <TableCell><StatusBadge status={row.status} /></TableCell><TableCell className="text-slate-600">{row.created_by_name}</TableCell>
                    </TableRow>)}</TableBody>
                  </Table>
                </div>
                <div className="space-y-3 md:hidden">{records.map((row) => <div key={row.id} className="rounded-2xl border border-slate-200/90 bg-white p-4.5 shadow-xs">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{row.livestock_type_name || typesById.get(row.livestock_type) || "Unspecified"}</p><p className="mt-1 text-sm text-slate-500">{row.record_date}</p></div><StatusBadge status={row.status} /></div>
                    <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm"><div><p className="text-xs text-slate-500">Heads</p><p className="font-medium text-slate-900">{row.quantity}</p></div><div><p className="text-xs text-slate-500">Kilograms</p><p className="font-medium text-slate-900">{row.carcass_weight ? `${Number(row.carcass_weight).toLocaleString()} kg` : "Not recorded"}</p></div></div>
                    {row.review_remarks ? <p className="text-sm text-amber-800">MAO remarks: {row.review_remarks}</p> : null}
                  </div>
                </div>)}</div>
              </>
            ) : !recordsQuery.isError ? (
              <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center"><History className="mx-auto size-8 text-slate-400" /><p className="mt-3 font-semibold text-slate-800">No records for this period</p><p className="mt-1 text-sm text-slate-500">Try another month or year. New records appear here after submission.</p></div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: SlaughterRecord["status"] }) {
  switch (status) {
    case "PENDING":
      return (
        <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-bold text-[10px] uppercase tracking-wider">
          <Clock className="w-3 h-3 mr-1" /> Pending MAO Review
        </Badge>
      );
    case "VERIFIED":
      return (
        <Badge className="bg-blue-100 text-blue-900 border-blue-300 font-bold text-[10px] uppercase tracking-wider">
          <ShieldCheck className="w-3 h-3 mr-1" /> SIBAT Verified
        </Badge>
      );
    case "APPROVED":
      return (
        <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-bold text-[10px] uppercase tracking-wider">
          <ShieldCheck className="w-3 h-3 mr-1" /> Approved
        </Badge>
      );
    case "SUBJECT_TO_REVISION":
      return (
        <Badge className="bg-orange-100 text-orange-950 border-orange-400 font-bold text-[10px] uppercase tracking-wider">
          <AlertTriangle className="w-3 h-3 mr-1" /> Subject to Revision
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="font-bold text-[10px] uppercase tracking-wider">
          {String(status).replaceAll("_", " ")}
        </Badge>
      );
  }
}
