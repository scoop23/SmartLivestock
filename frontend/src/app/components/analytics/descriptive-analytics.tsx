"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Activity, BarChart3, Beef, CalendarDays, CheckCircle2, ChevronDown, ChevronUp, CircleAlert,
  Download, HeartPulse, Info, Layers, MapPin, Package, RefreshCw, ShieldCheck, ShoppingBag,
  Syringe, type LucideIcon,
} from "lucide-react";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSpeciesColor } from "@/lib/species-colors";

interface SeriesPoint {
  month: string;
  label: string;
  reported_heads: number;
  deaths: number;
}

interface ProductTotal {
  type: string;
  unit: string;
  quantity: number;
  records: number;
}

interface BarangayReportRow {
  barangay_id: number | null;
  barangay: string;
  registered_farmers: number;
  current_heads: number;
  production_outputs: { type: string; unit: string; quantity: number }[];
  farmer_meat_kg: number;
  farmer_meat_records: number;
  slaughter_heads: number;
  slaughter_yield_kg: number | null;
  slaughter_records: number;
  slaughter_yield_records: number;
  animals_sold: number;
  sale_transactions: number;
  recorded_sale_value_php: number | null;
  priced_transactions: number;
  disease_cases: number;
  affected_heads: number;
  mortality_records: number;
  deaths: number;
  vaccinated_heads: number;
  vaccination_coverage_pct: number;
}

interface DescriptiveResponse {
  surveillance_series: SeriesPoint[];
  descriptive: {
    period: { start: string; end: string };
    population: {
      total_heads: number;
      by_barangay: { barangay_id: number | null; barangay: string | null; heads: number; registered_farmers: number }[];
      by_species: { species_id: number; species: string; heads: number }[];
    };
    production: {
      records: number;
      valuation: { estimated_value: number | null; valued_records: number; unvalued_records: number; by_month: { month: string; value: number; records: number }[]; by_type: { production_type: string; value: number; records: number }[]; by_species: { species: string | null; value: number; records: number }[]; by_barangay: { barangay_id: number | null; barangay: string | null; value: number; records: number }[]; by_commodity: { valuation_snapshot__commodity: string; value: number; records: number }[] };
      by_type: ProductTotal[];
      trend: { month: string; type: string; unit: string; quantity: number }[];
      monthly_trend_by_species: { month: string; label: string; species: string; production_type: string; unit: string; quantity: number }[];
      farmer_meat_by_species: { species: string; quantity_kg: number; records: number }[];
      farmer_meat_by_barangay: { barangay_id: number | null; barangay: string | null; quantity_kg: number; records: number }[];
      by_barangay: { barangay_id: number | null; barangay: string | null; type: string; unit: string; quantity: number }[];
    };
    slaughter: {
      yield_by_species: { species: string; carcass_weight_kg: number; heads: number; avg_carcass_weight_kg_per_head: number | null; records: number }[];
    };
    disease: {
      cases: number;
      affected_heads: number;
      by_type: { name: string; cases: number; affected_heads: number }[];
      by_barangay: { barangay_id: number | null; barangay: string | null; cases: number; affected_heads: number }[];
    };
    mortality: {
      records: number;
      deaths: number;
      by_cause: { cause: string; deaths: number }[];
    };
    vaccination: {
      vaccinated: number;
      total: number;
      coverage_pct: number;
      by_barangay: { barangay_id: number | null; barangay: string | null; total: number; vaccinated: number; coverage_pct: number }[];
    };
    sales: {
      sales: number;
      animals: number;
      recorded_value: number | null;
      priced_sales: number;
      by_species: { species: string; animals: number; transactions: number; recorded_value_php: number | null; priced_transactions: number }[];
      monthly_trend_by_species: { month: string; label: string; species: string; animals: number; transactions: number; recorded_value_php: number | null }[];
    };
    per_barangay_report: BarangayReportRow[];
  };
}

const number = (value: number) => value.toLocaleString("en-PH", { maximumFractionDigits: 2 });
const money = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
const dateLabel = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();
const axisStyle = { fontSize: 11, fill: "#64748b" };

function barangayLines(name: string) {
  return name.split(" ").reduce<string[]>((lines, word) => {
    const last = lines.length - 1;
    if (last >= 0 && `${lines[last]} ${word}`.length <= 22) lines[last] += ` ${word}`;
    else lines.push(word);
    return lines;
  }, []);
}

function BarangayAxisTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value: string | null };
}) {
  const lines = barangayLines(payload?.value ?? "Unmapped");
  return (
    <text x={x} y={y} textAnchor="end" fill="#64748b" fontSize={11}>
      {lines.map((line, index) => (
        <tspan key={index} x={x} dy={index === 0 ? -(lines.length - 1) * 7 + 4 : 14}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function Panel({
  title,
  subtitle,
  badge,
  children,
  className = "",
  action,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <Card className={`min-w-0 rounded-xl border border-slate-200/90 bg-white shadow-2xs ${className}`}>
      <CardHeader className="flex flex-col gap-2 border-b border-slate-100/90 px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">{title}</h3>
              {badge}
            </div>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500 font-medium leading-relaxed">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </CardHeader>
      <CardContent className="min-w-0 p-4 sm:p-5">{children}</CardContent>
    </Card>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  accentColor = "text-[#2D5A27] bg-emerald-50",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  accentColor?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${accentColor}`}>
        <Icon className="size-4.5" />
      </div>
      <div>
        <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">{title}</h2>
        <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
      <div className="flex size-9 items-center justify-center rounded-full bg-slate-200/70 text-slate-500">
        <BarChart3 className="size-4.5" />
      </div>
      <p className="max-w-sm text-xs sm:text-sm font-medium text-slate-600">{message}</p>
    </div>
  );
}

interface TooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string;
}

function CustomChartTooltip({
  active,
  payload,
  label,
  unit,
  currency = false,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  unit?: string;
  currency?: boolean;
}) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur-xs text-xs">
      {label && <p className="font-bold text-slate-800 mb-1 border-b border-slate-100 pb-1">{label}</p>}
      <div className="space-y-1">
        {payload.map((entry, idx) => {
          const swatchColor =
            entry.color ||
            (entry as { payload?: { fill?: string } }).payload?.fill ||
            "#2D5A27";
          return (
            <div key={idx} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: swatchColor }} />
                <span>{entry.name || "Value"}:</span>
              </span>
              <span className="font-bold text-slate-900 tabular-nums">
                {typeof entry.value === "number" ? (currency ? money(entry.value) : number(entry.value)) : entry.value}
                {unit ? ` ${unit}` : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LivestockTypeBreakdown({
  title,
  subtitle,
  rows,
  unit,
  metricName,
  currency = false,
}: {
  title: string;
  subtitle: string;
  rows: { species: string; quantity: number }[];
  unit: string;
  metricName: string;
  currency?: boolean;
}) {
  return (
    <Panel title={title} subtitle={subtitle}>
      {rows.length ? (
        <div className="h-64 sm:h-72" role="img" aria-label={`${title} horizontal bar chart`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ left: 8, right: 28, top: 4, bottom: 4 }}>
              <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="species" width={105} tick={axisStyle} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomChartTooltip unit={unit} currency={currency} />} cursor={{ fill: "#f4f8f3" }} />
              <Bar dataKey="quantity" name={metricName} barSize={18} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {rows.map((row) => <Cell key={row.species} fill={getSpeciesColor(row.species)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState message="No approved records with livestock-type details were found for this period." />
      )}
    </Panel>
  );
}

function MonthlySpeciesTrend({
  title,
  subtitle,
  rows,
  months,
  unit,
}: {
  title: string;
  subtitle: string;
  rows: { month: string; label: string; species: string; value: number }[];
  months: { month: string; label: string }[];
  unit: string;
}) {
  const speciesNames = [...new Set(rows.map((row) => row.species))].sort((a, b) => a.localeCompare(b));
  const rowsByMonth = new Map<string, Record<string, number>>();
  rows.forEach((row) => {
    const values = rowsByMonth.get(row.month) ?? {};
    values[row.species] = (values[row.species] ?? 0) + row.value;
    rowsByMonth.set(row.month, values);
  });
  const chartRows = months.map((month) => {
    const values = rowsByMonth.get(month.month) ?? {};
    return { ...month, ...Object.fromEntries(speciesNames.map((speciesName) => [speciesName, values[speciesName] ?? 0])) };
  });

  return (
    <Panel title={title} subtitle={subtitle}>
      {speciesNames.length ? (
        <div className="h-64 sm:h-72" role="img" aria-label={`${title} line chart`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart accessibilityLayer data={chartRows} margin={{ left: -15, right: 12, top: 10, bottom: 0 }}>
              <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} minTickGap={20} interval="preserveStartEnd" tickFormatter={(label: string) => label.slice(0, 3)} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomChartTooltip unit={unit} />} />
              <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 12, paddingBottom: 10 }} />
              {speciesNames.map((speciesName) => (
                <Line key={speciesName} type="monotone" dataKey={speciesName} name={speciesName} stroke={getSpeciesColor(speciesName)} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState message="No approved records by livestock type were found for this period." />
      )}
    </Panel>
  );
}

function csvCell(value: string | number | null) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadBarangayReport(rows: BarangayReportRow[], period: { start: string; end: string }) {
  const headers = [
    "Barangay", "Registered Farmers", "Current Approved Active Heads", "Approved Production Outputs",
    "Farmer Meat (kg)", "Slaughter Heads", "Slaughter Yield (kg)", "Animals Sold",
    "Recorded Sale Value (PHP)", "Disease Cases", "Affected Heads", "Recorded Deaths",
    "Vaccinated Active Heads", "Vaccination Coverage (%)",
  ];
  const records = rows.map((row) => [
    row.barangay,
    row.registered_farmers,
    row.current_heads,
    row.production_outputs.map((output) => `${output.type}: ${number(output.quantity)} ${output.unit.toLowerCase()}`).join("; "),
    row.farmer_meat_records ? row.farmer_meat_kg : null,
    row.slaughter_records ? row.slaughter_heads : null,
    row.slaughter_yield_records ? row.slaughter_yield_kg : null,
    row.sale_transactions ? row.animals_sold : null,
    row.sale_transactions === 0 ? null : row.recorded_sale_value_php === null ? "Not recorded" : row.recorded_sale_value_php,
    row.disease_cases || null,
    row.disease_cases ? row.affected_heads : null,
    row.mortality_records ? row.deaths : null,
    row.vaccinated_heads,
    row.vaccination_coverage_pct,
  ]);
  const csv = [
    `Report period,${csvCell(`${period.start} to ${period.end}`)}`,
    headers.map(csvCell).join(","),
    ...records.map((record) => record.map(csvCell).join(",")),
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `smartlivestock-barangay-report-${period.end}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function DescriptiveAnalytics() {
  const [response, setResponse] = useState<DescriptiveResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [productKey, setProductKey] = useState("");
  const [showMethodology, setShowMethodology] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError("");

    api.get<DescriptiveResponse>("analytics/dashboard/", { signal: controller.signal })
      .then(({ data }) => {
        if (!data.descriptive) throw new Error("Descriptive analytics are unavailable.");
        if (active) setResponse(data);
      })
      .catch(() => {
        if (active) setError("We could not load the municipal analytics. Please check network connectivity and try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt]);

  if (loading) {
    return (
      <div role="status" aria-label="Loading descriptive analytics" className="space-y-6">
        <span className="sr-only">Loading approved municipal records...</span>
        {/* Header Skeleton */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 shadow-2xs">
          <Skeleton className="h-5 w-48 rounded-md" />
          <Skeleton className="h-8 w-72 rounded-md" />
          <Skeleton className="h-4 w-96 rounded-md" />
        </div>
        {/* Executive Telemetry Bar Skeleton */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="flex justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="p-4 space-y-2.5">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-3.5 w-14 rounded-md" />
                  <Skeleton className="size-6 rounded-lg" />
                </div>
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        </div>
        {/* Population Skeleton */}
        <div className="grid gap-5 lg:grid-cols-12">
          <Skeleton className="h-84 rounded-xl lg:col-span-5" />
          <Skeleton className="h-84 rounded-xl lg:col-span-7" />
        </div>
        {/* Production Skeleton */}
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (error || !response) {
    return (
      <Card className="rounded-xl border border-red-200 bg-red-50/40 p-6 text-center shadow-xs" role="alert">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-100 text-red-700">
          <CircleAlert className="size-6" />
        </div>
        <h2 className="mt-3 text-base font-bold text-slate-900">Unable to load descriptive analytics</h2>
        <p className="mx-auto mt-1 max-w-md text-xs sm:text-sm text-slate-600">
          {error || "The municipal analytics service did not return descriptive data."}
        </p>
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            className="h-10 gap-2 border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            onClick={() => setAttempt((value) => value + 1)}
          >
            <RefreshCw className="size-4" />
            Retry Connection
          </Button>
        </div>
      </Card>
    );
  }

  const data = response.descriptive;
  const product =
    data.production.by_type.find((item) => `${item.type}:${item.unit}` === productKey) ??
    data.production.by_type[0];

  const productionMonths = response.surveillance_series.map(({ month, label }) => ({
    month,
    label,
    quantity: product
      ? data.production.trend.find(
          (point) => point.month === month && point.type === product.type && point.unit === product.unit
        )?.quantity ?? 0
      : 0,
  }));
  const productionSpeciesTrend = data.production.monthly_trend_by_species
    .filter((row) => row.production_type === product?.type && row.unit === product?.unit)
    .map((row) => ({ month: row.month, label: row.label, species: row.species, value: row.quantity }));
  const salesSpeciesTrend = data.sales.monthly_trend_by_species.map((row) => ({
    month: row.month,
    label: row.label,
    species: row.species,
    value: row.animals,
  }));

  const species = [...data.population.by_species].sort(
    (a, b) => b.heads - a.heads || a.species.localeCompare(b.species)
  );
  const barangays = [...data.population.by_barangay].sort(
    (a, b) => b.heads - a.heads || (a.barangay ?? "").localeCompare(b.barangay ?? "")
  );
  const productLocations = data.production.by_barangay
    .filter((row) => row.type === product?.type && row.unit === product?.unit)
    .sort((a, b) => b.quantity - a.quantity);

  const leadingSpecies = species[0];
  const share = (heads: number) => (data.population.total_heads ? (heads / data.population.total_heads) * 100 : 0);
  const hasHealth = data.disease.cases > 0 || data.mortality.records > 0;

  // Executive Municipal Telemetry KPIs
  const kpiCards: {
    domain: string;
    label: string;
    value: string;
    description: string;
    icon: LucideIcon;
    accentColor: string;
    tagBg: string;
    tagText: string;
  }[] = [
    {
      domain: "Inventory",
      label: "Active Livestock",
      value: number(data.population.total_heads),
      description: "Approved active heads",
      icon: Beef,
      accentColor: "#2D5A27",
      tagBg: "bg-emerald-50",
      tagText: "text-[#2D5A27]",
    },
    {
      domain: "Output",
      label: "Production Records",
      value: number(data.production.records),
      description: "Approved records in period",
      icon: Layers,
      accentColor: "#4a7c36",
      tagBg: "bg-green-50",
      tagText: "text-green-800",
    },
    {
      domain: "Surveillance",
      label: "Disease Cases",
      value: number(data.disease.cases),
      description: `${number(data.disease.affected_heads)} reported affected heads`,
      icon: Activity,
      accentColor: "#d97706",
      tagBg: "bg-amber-50",
      tagText: "text-amber-800",
    },
    {
      domain: "Mortality",
      label: "Recorded Deaths",
      value: number(data.mortality.deaths),
      description: `${number(data.mortality.records)} approved death records`,
      icon: HeartPulse,
      accentColor: "#e11d48",
      tagBg: "bg-rose-50",
      tagText: "text-rose-800",
    },
    {
      domain: "Vaccination",
      label: "Recorded Coverage",
      value: `${number(data.vaccination.coverage_pct)}%`,
      description: `${number(data.vaccination.vaccinated)} of ${number(data.vaccination.total)} active heads`,
      icon: Syringe,
      accentColor: "#0f766e",
      tagBg: "bg-teal-50",
      tagText: "text-teal-800",
    },
    {
      domain: "Commerce",
      label: "Animals Sold",
      value: number(data.sales.animals),
      description: `${number(data.sales.sales)} approved sale records`,
      icon: ShoppingBag,
      accentColor: "#475569",
      tagBg: "bg-slate-100",
      tagText: "text-slate-800",
    },
  ];

  // Mathematically derived factual snapshot statements
  const validBarangaysCount = barangays.filter((b) => b.barangay_id !== null).length;
  const factualSnapshots: string[] = [
    `${number(data.population.total_heads)} active approved heads are registered across ${validBarangaysCount} barangays in Padre Garcia.`,
    ...(leadingSpecies
      ? [`${leadingSpecies.species} constitutes the largest share at ${number(share(leadingSpecies.heads))}% (${number(leadingSpecies.heads)} heads) of recorded livestock.`]
      : []),
    ...(product
      ? [`${titleCase(product.type)} output totals ${number(product.quantity)} ${product.unit.toLowerCase()} across ${number(product.records)} approved records during this reporting window.`]
      : []),
    `${number(data.disease.cases)} approved disease cases were documented affecting ${number(data.disease.affected_heads)} heads, alongside ${number(data.mortality.deaths)} recorded deaths.`,
  ];

  return (
    <div className="min-w-0 space-y-7 text-slate-800">
      {/* 1. HEADER */}
      <header className="rounded-xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-[#2D5A27]">
                Municipal Agriculture Office · Padre Garcia
              </span>
              <Badge variant="outline" className="gap-1.5 border-emerald-300 bg-emerald-50/80 text-emerald-800 font-bold text-xs">
                <ShieldCheck className="size-3.5 text-emerald-700" />
                Approved records
              </Badge>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 mt-1">
              Descriptive Analytics
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600">
              Overview of approved livestock population, production, animal health, vaccination, and sales records.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 lg:border-t-0 lg:pt-0">
            <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-200/70 text-right">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <CalendarDays className="size-3.5 text-[#2D5A27]" />
                <span>{dateLabel(data.period.start)} – {dateLabel(data.period.end)}</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                12-month rolling assessment window
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAttempt((v) => v + 1)}
              className="h-10 gap-1.5 rounded-lg border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
            >
              <RefreshCw className="size-3.5" />
              Refresh Data
            </Button>
          </div>
        </div>
      </header>

      {/* 2. EXECUTIVE MUNICIPAL TELEMETRY BAR */}
      <section aria-label="Executive Municipal Telemetry" className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-[#2D5A27]" />
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">
              Executive Telemetry · Municipal Livestock Metrics
            </span>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            Official Padre Garcia Records
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          {kpiCards.map(({ domain, label, value, description, icon: Icon, accentColor, tagBg, tagText }) => (
            <div
              key={label}
              className="group relative flex flex-col justify-between p-3.5 sm:p-4.5 transition-colors hover:bg-slate-50/80"
            >
              {/* Colored top accent line */}
              <div
                className="absolute inset-x-0 top-0 h-0.75 transition-opacity opacity-80 group-hover:opacity-100"
                style={{ backgroundColor: accentColor }}
              />

              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${tagBg} ${tagText}`}>
                    {domain}
                  </span>
                  <div
                    className="flex size-6.5 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
                  >
                    <Icon className="size-3.5" />
                  </div>
                </div>

                <p className="text-xs font-bold text-slate-600 truncate">
                  {label}
                </p>

                <p className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-slate-900 tabular-nums">
                  {value}
                </p>
              </div>

              <p className="mt-2.5 text-[11px] font-medium text-slate-500 leading-snug border-t border-slate-100/90 pt-1.5">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. DATA SNAPSHOT / AT A GLANCE (MATHEMATICALLY DERIVED FACTS ONLY) */}
      <section aria-label="Data Snapshot" className="rounded-xl border border-emerald-900/10 bg-emerald-50/50 p-4 sm:p-4.5">
        <div className="flex items-center gap-2 mb-2.5">
          <Info className="size-4 text-[#2D5A27] shrink-0" />
          <h2 className="text-xs font-black uppercase tracking-wider text-[#2D5A27]">
            Municipal Intelligence Snapshot · At a Glance
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-700 font-medium">
          {factualSnapshots.map((fact, index) => (
            <div key={index} className="flex items-start gap-2 bg-white/70 rounded-lg p-2.5 border border-emerald-900/5">
              <CheckCircle2 className="size-3.5 text-[#2D5A27] shrink-0 mt-0.5" />
              <span className="leading-relaxed">{fact}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 4. POPULATION OVERVIEW */}
      <section className="space-y-4" aria-label="Population Overview">
        <SectionHeader
          icon={Beef}
          title="Population Overview"
          description="Current active approved livestock inventory across Padre Garcia barangays, counted in heads."
        />
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Population by Species */}
          <Panel
            title="Population by Species"
            subtitle="Share of approved municipal livestock inventory"
            className="lg:col-span-5"
          >
            {species.length ? (
              <div className="space-y-4">
                <div role="img" aria-label="Species share donut chart" className="relative h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={species}
                        dataKey="heads"
                        nameKey="species"
                        innerRadius={55}
                        outerRadius={82}
                        paddingAngle={species.length > 1 ? 3 : 0}
                        stroke="#ffffff"
                        strokeWidth={2}
                        isAnimationActive={false}
                      >
                        {species.map((row) => (
                          <Cell key={row.species_id} fill={getSpeciesColor(row.species)} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomChartTooltip unit="heads" />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black tracking-tight tabular-nums text-slate-900">
                      {number(data.population.total_heads)}
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Active Heads
                    </span>
                  </div>
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-3">
                  {species.map((row) => {
                    const rowShare = share(row.heads);
                    const color = getSpeciesColor(row.species);
                    return (
                      <div key={row.species_id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-2 font-medium text-slate-700">
                            <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span>{row.species}</span>
                          </span>
                          <span className="tabular-nums">
                            <strong className="font-bold text-slate-900">{number(row.heads)}</strong>
                            <span className="ml-1.5 text-slate-500 font-semibold">{number(rowShare)}%</span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${rowShare}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <EmptyState message="No approved active livestock records found." />
            )}
          </Panel>

          {/* Population by Barangay */}
          <Panel
            title="Population by Barangay"
            subtitle="Geographic distribution ranked by approved head counts"
            badge={
              <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-bold text-xs">
                {barangays.length} Barangays
              </Badge>
            }
            className="lg:col-span-7"
          >
            {barangays.length ? (
              <>
                {/* Mobile / Tablet Progress Bar view */}
                <div className="space-y-3 md:hidden">
                  {barangays.map((row) => (
                    <div key={row.barangay_id ?? "unknown"} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700 break-words pr-2">
                          {row.barangay ?? "Unmapped"}
                        </span>
                        <span className="font-bold text-slate-900 tabular-nums shrink-0">
                          {number(row.heads)} heads
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#2D5A27]"
                          style={{ width: `${barangays[0].heads ? (row.heads / barangays[0].heads) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Horizontal Bar Chart */}
                <div
                  className="hidden md:block"
                  style={{
                    height: Math.max(
                      290,
                      barangays.length * Math.max(38, ...barangays.map((r) => barangayLines(r.barangay ?? "").length * 14 + 14))
                    ),
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart accessibilityLayer data={barangays} layout="vertical" margin={{ left: 10, right: 48, top: 4, bottom: 4 }}>
                      <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="barangay"
                        width={150}
                        tick={<BarangayAxisTick />}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                      />
                      <Tooltip content={<CustomChartTooltip unit="heads" />} cursor={{ fill: "#f4f8f3" }} />
                      <Bar
                        dataKey="heads"
                        name="Heads"
                        fill="#2D5A27"
                        barSize={14}
                        radius={[0, 4, 4, 0]}
                        isAnimationActive={false}
                      >
                        <LabelList
                          dataKey="heads"
                          position="right"
                          style={{ fontSize: 11, fontWeight: 700, fill: "#334155" }}
                          formatter={(v) => number(Number(v))}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <EmptyState message="No approved active livestock records mapped by barangay." />
            )}
          </Panel>
        </div>
      </section>

      <section className="space-y-3" aria-label="Estimated value of recorded production">
        <h2 className="text-base font-semibold">Estimated Value of Recorded Production</h2>
        <p className="text-xl font-semibold">{data.production.valuation.estimated_value == null ? "Not available" : money(data.production.valuation.estimated_value)}</p>
        <p className="text-xs text-slate-500">{data.production.valuation.valued_records} approved records valued using saved PSA references; {data.production.valuation.unvalued_records} records have no applicable reference. Estimates may use the latest earlier reference when a matching-period price is missing; see record details for the reference period. This is not total municipal production value or sales revenue.</p>
        <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><h3 className="mb-2 text-sm font-semibold">By month</h3>{data.production.valuation.by_month.map((row) => <p key={row.month} className="flex justify-between gap-2 text-xs"><span>{row.month.slice(0, 7)}</span><span>{money(row.value)}</span></p>)}</div>
          <div><h3 className="mb-2 text-sm font-semibold">By species</h3>{data.production.valuation.by_species.map((row) => <p key={row.species ?? "unknown"} className="flex justify-between gap-2 text-xs"><span>{row.species ?? "Unmapped"}</span><span>{money(row.value)}</span></p>)}</div>
          <div><h3 className="mb-2 text-sm font-semibold">By production type</h3>{data.production.valuation.by_type.map((row) => <p key={row.production_type} className="flex justify-between gap-2 text-xs"><span>{row.production_type}</span><span>{money(row.value)}</span></p>)}</div>
          <div><h3 className="mb-2 text-sm font-semibold">By barangay</h3>{data.production.valuation.by_barangay.map((row) => <p key={row.barangay_id ?? "unknown"} className="flex justify-between gap-2 text-xs"><span>{row.barangay ?? "Unmapped"}</span><span>{money(row.value)}</span></p>)}</div>
          <div><h3 className="mb-2 text-sm font-semibold">By reference commodity</h3>{data.production.valuation.by_commodity.map((row) => <p key={row.valuation_snapshot__commodity} className="flex justify-between gap-2 text-xs"><span>{row.valuation_snapshot__commodity}</span><span>{money(row.value)}</span></p>)}</div>
        </div>
      </section>

      {/* 5. PRODUCTION SECTION */}
      <section className="space-y-4" aria-label="Production Overview">
        <SectionHeader
          icon={BarChart3}
          title="Recorded Production Overview"
          description="Approved reported output during the period, grouped by type and unit. This does not measure all municipal production."
        />
        <div className="grid gap-5 xl:grid-cols-12">
          {/* Main Trend Chart */}
          <Panel
            title={product ? `Recorded ${titleCase(product.type)} Production Trend` : "Monthly Production Trend"}
            subtitle="12-month timeline of approved production volume; current month reflects partial records"
            action={
              product && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {data.production.by_type.length <= 3 ? (
                    data.production.by_type.map((item) => {
                      const key = `${item.type}:${item.unit}`;
                      const isSelected = `${product.type}:${product.unit}` === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setProductKey(key)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? "bg-[#2D5A27] text-white shadow-2xs"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {titleCase(item.type)} ({item.unit.toLowerCase()})
                        </button>
                      );
                    })
                  ) : (
                    <Select value={`${product.type}:${product.unit}`} onValueChange={setProductKey}>
                      <SelectTrigger aria-label="Select production type" className="h-9 w-48 bg-white text-xs font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {data.production.by_type.map((item) => (
                          <SelectItem key={`${item.type}:${item.unit}`} value={`${item.type}:${item.unit}`}>
                            {titleCase(item.type)} / {titleCase(item.unit)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )
            }
            className="xl:col-span-8"
          >
            {product ? (
              <div className="space-y-5">
                {/* Supporting Summary Tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-lg bg-slate-50/80 p-3.5 border border-slate-200/70">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Total Production
                    </span>
                    <p className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 tabular-nums mt-0.5">
                      {number(product.quantity)}
                      <span className="text-xs font-bold text-slate-500 ml-1">
                        {product.unit.toLowerCase()}
                      </span>
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Approved Records
                    </span>
                    <p className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 tabular-nums mt-0.5">
                      {number(product.records)}
                    </p>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Measurement Unit
                    </span>
                    <p className="text-base sm:text-lg font-bold text-[#2D5A27] mt-1 capitalize">
                      {product.unit.toLowerCase()}
                    </p>
                  </div>
                </div>

                {/* 12-Month Area Trend Chart */}
                <div className="h-64 sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart accessibilityLayer data={productionMonths} margin={{ left: -15, right: 12, top: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="prodColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2D5A27" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#2D5A27" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={axisStyle}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={20}
                        interval="preserveStartEnd"
                        tickFormatter={(l: string) => l.slice(0, 3)}
                      />
                      <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomChartTooltip unit={product.unit.toLowerCase()} />} />
                      <Area
                        type="monotone"
                        dataKey="quantity"
                        name={`${titleCase(product.type)} Output`}
                        stroke="#2D5A27"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#prodColor)"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Note: A zero value indicates no approved production records were registered in that month.
                </p>
              </div>
            ) : (
              <EmptyState message="No approved production records were found for this period." />
            )}
          </Panel>

          {/* Production By Barangay */}
          <Panel
            title="Production by Barangay"
            subtitle={product ? `Recorded ${product.unit.toLowerCase()} of ${product.type.toLowerCase()}` : "Locations of approved output"}
            className="xl:col-span-4"
          >
            {productLocations.length ? (
              <div className="space-y-3.5 max-h-96 overflow-y-auto pr-1">
                {productLocations.map((row) => {
                  const maxQty = productLocations[0]?.quantity || 1;
                  const pct = (row.quantity / maxQty) * 100;
                  return (
                    <div key={`${row.barangay_id ?? "unknown"}:${row.type}:${row.unit}`} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700 break-words pr-2">
                          {row.barangay ?? "Unmapped"}
                        </span>
                        <span className="font-bold text-slate-900 tabular-nums shrink-0">
                          {number(row.quantity)} <span className="font-normal text-slate-500">{row.unit.toLowerCase()}</span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-[#5e8c45]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState message="No approved production records recorded by barangay for this selection." />
            )}
          </Panel>
        </div>

        <MonthlySpeciesTrend
          title="Monthly Production by Livestock Type"
          subtitle={product ? `Approved ${product.type.toLowerCase()} output in ${product.unit.toLowerCase()} by month` : "Choose a production type to view monthly output by livestock type"}
          rows={productionSpeciesTrend}
          months={response.surveillance_series.map(({ month, label }) => ({ month, label }))}
          unit={product?.unit.toLowerCase() ?? "units"}
        />

        <div className="grid gap-5 xl:grid-cols-3">
          <LivestockTypeBreakdown
            title="Slaughter Yield by Livestock Type"
            subtitle="Recorded carcass weight from approved slaughter records"
            rows={data.slaughter.yield_by_species.map((row) => ({ species: row.species, quantity: row.carcass_weight_kg }))}
            unit="kg"
            metricName="Carcass yield"
          />
          <LivestockTypeBreakdown
            title="Farmer-Reported Meat Yield by Livestock Type"
            subtitle="Approved farmer meat production, excluding slaughter-linked outputs"
            rows={data.production.farmer_meat_by_species.map((row) => ({ species: row.species, quantity: row.quantity_kg }))}
            unit="kg"
            metricName="Farmer-reported meat"
          />
          <LivestockTypeBreakdown
            title="Average Slaughter Yield per Head"
            subtitle="Recorded carcass kilograms divided by slaughtered heads with a recorded weight"
            rows={data.slaughter.yield_by_species
              .filter((row) => row.avg_carcass_weight_kg_per_head !== null)
              .map((row) => ({ species: row.species, quantity: row.avg_carcass_weight_kg_per_head ?? 0 }))}
            unit="kg/head"
            metricName="Average carcass weight"
          />
        </div>
      </section>

      {/* 6. ANIMAL HEALTH SECTION */}
      <section className="space-y-4" aria-label="Animal Health">
        <SectionHeader
          icon={HeartPulse}
          title="Animal Health & Mortality"
          description="Approved disease surveillance reports and recorded mortality during the reporting period."
          accentColor="text-rose-700 bg-rose-50"
        />

        {/* Affected Heads vs Deaths (Surveillance Trend) */}
        <Panel
          title="Affected Heads vs Deaths"
          subtitle="Monthly reported counts; independent surveillance measures, not a causal comparison"
          action={
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-amber-50 text-amber-800 font-bold text-xs">
                {number(data.disease.affected_heads)} Affected Heads
              </Badge>
              <Badge variant="secondary" className="bg-rose-50 text-rose-800 font-bold text-xs">
                {number(data.mortality.deaths)} Deaths
              </Badge>
            </div>
          }
        >
          {hasHealth ? (
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart accessibilityLayer data={response.surveillance_series} margin={{ left: -15, right: 12, top: 10, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={axisStyle}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={20}
                    tickFormatter={(l: string) => l.slice(0, 3)}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: 12, paddingBottom: 10 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="reported_heads"
                    name="Affected Heads"
                    stroke="#d97706"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#d97706" }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="deaths"
                    name="Recorded Deaths"
                    stroke="#e11d48"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#e11d48" }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="No approved disease or mortality records were found for this period." />
          )}
        </Panel>

        {/* Distinct Side-by-Side Breakdowns: Disease by Type & Mortality by Cause */}
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Disease by Type */}
          <Panel
            title="Disease Surveillance by Type"
            subtitle="Ranked by total reported affected heads"
          >
            {data.disease.by_type.length ? (
              <Table className="table-fixed text-xs">
                <TableHeader>
                  <TableRow className="border-slate-200">
                    <TableHead className="w-1/2 font-bold text-slate-700">Disease Type</TableHead>
                    <TableHead className="text-right font-bold text-slate-700">Cases</TableHead>
                    <TableHead className="text-right font-bold text-slate-700">Affected Heads</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.disease.by_type.map((row) => {
                    const maxAffected = data.disease.by_type[0]?.affected_heads || 1;
                    const pct = (row.affected_heads / maxAffected) * 100;
                    return (
                      <TableRow key={row.name} className="border-slate-100 hover:bg-amber-50/30">
                        <TableCell className="py-2.5">
                          <span className="font-semibold text-slate-800">{row.name}</span>
                          <div className="mt-1 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium text-slate-600">
                          {number(row.cases)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-bold text-slate-900">
                          {number(row.affected_heads)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <EmptyState message="No approved disease cases were recorded during this period." />
            )}
          </Panel>

          {/* Mortality by Cause */}
          <Panel
            title="Mortality by Recorded Cause"
            subtitle="Ranked by recorded animal deaths; causation is not inferred"
          >
            {data.mortality.by_cause.length ? (
              <div className="space-y-3">
                <Table className="table-fixed text-xs">
                  <TableHeader>
                    <TableRow className="border-slate-200">
                      <TableHead className="w-3/4 font-bold text-slate-700">Recorded Cause</TableHead>
                      <TableHead className="text-right font-bold text-slate-700">Deaths</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.mortality.by_cause.map((row) => {
                      const maxDeaths = data.mortality.by_cause[0]?.deaths || 1;
                      const pct = (row.deaths / maxDeaths) * 100;
                      return (
                        <TableRow key={row.cause} className="border-slate-100 hover:bg-rose-50/30">
                          <TableCell className="py-2.5">
                            <span className="font-semibold text-slate-800">{row.cause || "Unspecified"}</span>
                            <div className="mt-1 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full rounded-full bg-rose-500" style={{ width: `${pct}%` }} />
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-bold text-slate-900">
                            {number(row.deaths)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <p className="text-[11px] text-slate-500 font-medium italic">
                  * Note: Mortality causes reflect observational field records and do not establish pathogen causality.
                </p>
              </div>
            ) : (
              <EmptyState message="No approved mortality records were found for this period." />
            )}
          </Panel>
        </div>

        {/* Disease by Barangay Location Cards */}
        {data.disease.by_barangay.length > 0 && (
          <Panel
            title="Disease Surveillance by Barangay"
            subtitle="Mapped through farmer registrations and active holdings"
          >
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {data.disease.by_barangay.map((row) => (
                <div
                  key={row.barangay_id ?? "unknown"}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 p-3"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <MapPin className="size-4 text-amber-700 shrink-0" />
                    <span className="text-xs font-semibold text-slate-800 truncate">
                      {row.barangay ?? "Unmapped"}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-slate-900 tabular-nums block">
                      {number(row.affected_heads)} heads
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {number(row.cases)} cases
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </section>

      {/* 7. VACCINATION COVERAGE */}
      <section className="space-y-4" aria-label="Vaccination Coverage">
        <SectionHeader
          icon={Syringe}
          title="Vaccination Coverage"
          description="Based on active approved livestock with a recorded vaccination date on or before the reporting cutoff."
          accentColor="text-teal-700 bg-teal-50"
        />
        <Panel
          title="Recorded Vaccination Coverage"
          subtitle="Snapshot based on active inventory dates; does not evaluate subsequent protocol compliance"
        >
          <div className="grid gap-6 lg:grid-cols-12 items-start">
            {/* Primary Coverage Metric Card */}
            <div className="lg:col-span-4 rounded-xl border border-teal-200/80 bg-teal-50/60 p-5 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-800">
                Municipal Vaccination Ratio
              </span>
              <p className="text-4xl sm:text-5xl font-black tracking-tight text-teal-950 tabular-nums">
                {number(data.vaccination.coverage_pct)}%
              </p>
              <div className="h-2.5 w-full rounded-full bg-teal-200/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#2D5A27]"
                  style={{ width: `${Math.min(100, data.vaccination.coverage_pct)}%` }}
                />
              </div>
              <p className="text-xs font-bold text-teal-900">
                {number(data.vaccination.vaccinated)} of {number(data.vaccination.total)} active approved heads
              </p>
              <p className="text-[11px] text-teal-800/90 leading-relaxed font-medium">
                Reflects animals with a recorded vaccination date. Future scheduled dates and unrecorded animals are excluded from the vaccinated count.
              </p>
            </div>

            {/* Barangay Breakdown Progress Bars */}
            <div className="lg:col-span-8 space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Coverage by Barangay
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Vaccinated / Total Active Heads
                </span>
              </div>
              {data.vaccination.by_barangay.length ? (
                <div className="space-y-3 max-h-84 overflow-y-auto pr-1">
                  {data.vaccination.by_barangay.map((row) => (
                    <div key={row.barangay_id ?? "unknown"} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 break-words pr-2">
                          {row.barangay ?? "Unmapped"}
                        </span>
                        <div className="tabular-nums text-right">
                          <strong className="font-bold text-slate-900">{number(row.coverage_pct)}%</strong>
                          <span className="ml-2 text-slate-500 font-medium text-[11px]">
                            ({number(row.vaccinated)} / {number(row.total)})
                          </span>
                        </div>
                      </div>
                      <div
                        role="progressbar"
                        aria-label={`${row.barangay ?? "Unmapped"} recorded vaccination coverage`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={row.coverage_pct}
                        className="h-2 w-full rounded-full bg-slate-100 overflow-hidden"
                      >
                        <div
                          className="h-full rounded-full bg-[#2D5A27]"
                          style={{ width: `${Math.min(100, row.coverage_pct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No approved active livestock records are available for coverage calculation." />
              )}
            </div>
          </div>
        </Panel>
      </section>

      {/* 8. LIVE ANIMAL SALES */}
      <section className="space-y-4" aria-label="Live Animal Sales">
        <SectionHeader
          icon={ShoppingBag}
          title="Live Animal Sales"
          description="Live animals sold through approved municipal sales transactions during the reporting period."
          accentColor="text-indigo-700 bg-indigo-50"
        />
        <Panel
          title="Approved Live Animal Sales Summary"
          subtitle="Monetary value reflects transactions where price was explicitly recorded"
        >
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Animals Sold
              </span>
              <p className="mt-1 text-2xl font-black tracking-tight text-slate-900 tabular-nums">
                {number(data.sales.animals)}
                <span className="text-xs font-semibold text-slate-500 ml-1">heads</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">Approved sales count</p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Approved Sale Records
              </span>
              <p className="mt-1 text-2xl font-black tracking-tight text-slate-900 tabular-nums">
                {number(data.sales.sales)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">Logged transactions</p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Recorded Sales Value
              </span>
              <div className="mt-1">
                {data.sales.recorded_value === null ? (
                  <span className="inline-block rounded-md bg-slate-200/70 px-2 py-1 text-xs font-bold text-slate-700">
                    No sale prices recorded
                  </span>
                ) : (
                  <p className="text-xl sm:text-2xl font-black tracking-tight text-[#2D5A27] tabular-nums">
                    {money(data.sales.recorded_value)}
                  </p>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">Gross reported value</p>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Priced Transactions
              </span>
              <p className="mt-1 text-2xl font-black tracking-tight text-slate-900 tabular-nums">
                {number(data.sales.priced_sales)}
                <span className="text-xs font-semibold text-slate-500 ml-1">
                  of {number(data.sales.sales)}
                </span>
              </p>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">Transactions with price data</p>
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-500 font-medium">
            Note: Recording transaction price is optional in certain livestock sale workflows; unpriced transactions are excluded from currency totals.
          </p>
        </Panel>
        <LivestockTypeBreakdown
          title="Animals Sold by Livestock Type"
          subtitle="Head counts from approved live-animal sale transactions"
          rows={data.sales.by_species.map((row) => ({ species: row.species, quantity: row.animals }))}
          unit="heads"
          metricName="Animals sold"
        />
        <div className="grid gap-5 xl:grid-cols-2">
          <MonthlySpeciesTrend
            title="Monthly Live Animal Sales by Livestock Type"
            subtitle="Approved head counts grouped by sale date and livestock type"
            rows={salesSpeciesTrend}
            months={response.surveillance_series.map(({ month, label }) => ({ month, label }))}
            unit="heads"
          />
          <LivestockTypeBreakdown
            title="Recorded Sales Value by Livestock Type"
            subtitle="Sum of sale records with a saved price; transactions without a price are excluded"
            rows={data.sales.by_species
              .filter((row) => row.recorded_value_php !== null)
              .map((row) => ({ species: row.species, quantity: row.recorded_value_php ?? 0 }))}
            unit=""
            metricName="Recorded value"
            currency
          />
        </div>
      </section>

      <section className="space-y-4" aria-label="Per Barangay Report">
        <SectionHeader
          icon={MapPin}
          title="Per Barangay Report"
          description={`Approved production, health, slaughter, and sales activity for ${dateLabel(data.period.start)} to ${dateLabel(data.period.end)}; active livestock and vaccination are current snapshots.`}
          accentColor="text-sky-700 bg-sky-50"
        />
        <Panel
          title="Barangay Summary"
          subtitle="Download the same municipal aggregates as a CSV report for follow-up and sharing."
          action={<Button type="button" variant="outline" size="sm" onClick={() => downloadBarangayReport(data.per_barangay_report, data.period)} disabled={!data.per_barangay_report.length}>
            <Download className="mr-2 size-4" />Download CSV
          </Button>}
        >
          {data.per_barangay_report.length ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <Table className="min-w-[1450px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Barangay</TableHead><TableHead className="text-right">Farmers</TableHead>
                    <TableHead className="text-right">Current Heads</TableHead><TableHead>Production by Type</TableHead>
                    <TableHead className="text-right">Farmer Meat (kg)</TableHead><TableHead className="text-right">Slaughter Heads</TableHead>
                    <TableHead className="text-right">Carcass Yield (kg)</TableHead><TableHead className="text-right">Sold Heads</TableHead>
                    <TableHead className="text-right">Recorded Sales Value</TableHead><TableHead className="text-right">Disease Cases</TableHead>
                    <TableHead className="text-right">Deaths</TableHead><TableHead className="text-right">Vaccination</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.per_barangay_report.map((row) => (
                    <TableRow key={row.barangay_id ?? `unmapped-${row.barangay}`}>
                      <TableCell className="font-semibold">{row.barangay}</TableCell>
                      <TableCell className="text-right tabular-nums">{number(row.registered_farmers)}</TableCell>
                      <TableCell className="text-right tabular-nums">{number(row.current_heads)}</TableCell>
                      <TableCell className="max-w-[260px] whitespace-normal text-xs">{row.production_outputs.length ? row.production_outputs.map((output) => `${titleCase(output.type)} ${number(output.quantity)} ${output.unit.toLowerCase()}`).join(" · ") : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.farmer_meat_records ? number(row.farmer_meat_kg) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.slaughter_records ? number(row.slaughter_heads) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.slaughter_yield_records && row.slaughter_yield_kg !== null ? number(row.slaughter_yield_kg) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.sale_transactions ? number(row.animals_sold) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.sale_transactions === 0 ? "—" : row.recorded_sale_value_php === null ? "Not recorded" : money(row.recorded_sale_value_php)}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.disease_cases ? `${number(row.disease_cases)} (${number(row.affected_heads)} heads)` : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.mortality_records ? number(row.deaths) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{number(row.vaccination_coverage_pct)}% <span className="text-slate-500">({number(row.vaccinated_heads)})</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState message="No barangay data is available for this report scope." />
          )}
          <p className="mt-3 text-xs text-slate-500">A dash means no approved event records were found for that metric. “Not recorded” means sale records exist but no price was saved. Production commodities keep their original units instead of being combined.</p>
        </Panel>
      </section>

      {/* 9. METHODOLOGY & DATA SCOPE (COLLAPSIBLE / ACCORDION) */}
      <section aria-label="Methodology and Data Scope">
        <div className="rounded-xl border border-slate-200/90 bg-slate-50/80">
          <button
            type="button"
            onClick={() => setShowMethodology(!showMethodology)}
            className="flex w-full items-center justify-between p-4 sm:p-5 text-left font-bold text-slate-800 hover:text-slate-900 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-slate-200/80 text-slate-700">
                <Info className="size-4" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-bold tracking-tight">
                  Data Scope & Reporting Methodology
                </span>
                <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                  Definitions, data inclusion criteria, and municipal governance standards
                </p>
              </div>
            </div>
            {showMethodology ? <ChevronUp className="size-4 text-slate-500" /> : <ChevronDown className="size-4 text-slate-500" />}
          </button>

          {showMethodology && (
            <div className="border-t border-slate-200/80 p-4 sm:p-5 pt-3 text-xs leading-relaxed text-slate-600 space-y-3">
              <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <strong className="font-bold text-slate-900">1. Approved Records Only:</strong>
                  <p>
                    All analytics strictly query records possessing final Municipal Agriculture Office (MAO) approval. Drafts, pending farmer submissions, and returned forms are excluded.
                  </p>
                </div>
                <div className="space-y-1">
                  <strong className="font-bold text-slate-900">2. Active Population Snapshot:</strong>
                  <p>
                    Livestock totals reflect current active approved inventory heads. Herd groups and individual animal records are reconciled to prevent duplicate counts.
                  </p>
                </div>
                <div className="space-y-1">
                  <strong className="font-bold text-slate-900">3. Event-Date Attribution:</strong>
                  <p>
                    Production, disease surveillance, mortality, and sales trends are grouped by their verified event record dates, not the system data entry timestamp.
                  </p>
                </div>
                <div className="space-y-1">
                  <strong className="font-bold text-slate-900">4. Vaccination Coverage Scope:</strong>
                  <p>
                    Measures active heads with a documented vaccination date on or before the cutoff date. This administrative proxy indicates recorded coverage rather than subsequent clinical booster immunity.
                  </p>
                </div>
                <div className="space-y-1">
                  <strong className="font-bold text-slate-900">5. Sales Value Accounting:</strong>
                  <p>
                    Sales currency amounts include only transactions with saved monetary values. Unpriced sales are explicitly isolated and are not imputed as ₱0.
                  </p>
                </div>
                <div className="space-y-1">
                  <strong className="font-bold text-slate-900">6. Livestock Output by Type:</strong>
                  <p>
                    Slaughter yield uses recorded carcass kilograms. Farmer-reported meat excludes slaughter-linked output to avoid double counting. Sold head counts use approved live-animal sales; records without a linked livestock type appear as Unspecified.
                  </p>
                </div>
                <div className="space-y-1">
                  <strong className="font-bold text-slate-900">7. Geographic Aggregation:</strong>
                  <p>
                    Records are mapped using the barangay relationship of the registered owner or holding facility. Unmapped records remain transparently separated.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
