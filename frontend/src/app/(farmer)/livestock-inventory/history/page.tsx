"use client";

import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle,Archive,ArrowLeft,CalendarDays,CheckCircle2,CircleDollarSign,Search,ShieldCheck,Skull,Truck } from "lucide-react";
import Link from "next/link";
import { useMemo,useState } from "react";
import type { LivestockInventoryItem,OperationalStatus } from "../livestock-inventory";
import { useUserInventory } from "../livestock-inventory";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";

type ReviewDetails = {
  verifiedBy?: string;
  verifiedAt?: string;
  verifiedRole?: string;
  remarks?: string;
  maoReviewedBy?: string;
  maoReviewedAt?: string;
  maoReviewedRole?: string;
  maoRemarks?: string;
  severity?: string;
  biosecurityAction?: string;
  confirmedSymptoms?: string[];
  confirmedCount?: number;
  tagConfirmed?: boolean;
};

type AnimalHealthReport = {
  id: number;
  livestock: number | string | null;
  batch: number | string | null;
  affected_animals?: Array<{ id: number | string }>;
  name?: string;
  cause?: string;
  status: string;
  record_date: string | null;
  reviewed_by_name?: string | null;
  reviewed_by_role?: string | null;
  reviewed_at?: string | null;
  review_remarks?: string | null;
  inspection_details?: ReviewDetails | null;
};

type HealthReviewEvent = {
  key: string;
  reportLabel: string;
  reviewer: string;
  role: string;
  date: string | null;
  status: string;
  remarks: string;
  severity?: string;
  biosecurityAction?: string;
  confirmedSymptoms?: string[];
  confirmedCount?: number;
};

type HistoryTimelineItem = {
  key: string;
  role: string;
  status: string;
  reviewer: string;
  date: string | null;
  remarks: string;
  reportLabel?: string;
  severity?: string;
  biosecurityAction?: string;
  confirmedSymptoms?: string[];
  confirmedCount?: number;
  isBackfilled?: boolean;
};

const HISTORY_STATUS: Record<Exclude<OperationalStatus, "ACTIVE">, {
  label: string;
  className: string;
  Icon: typeof Archive;
}> = {
  SOLD: { label: "Sold", className: "border-blue-200 bg-blue-50 text-blue-800", Icon: CircleDollarSign },
  DECEASED: { label: "Deceased", className: "border-rose-200 bg-rose-50 text-rose-800", Icon: Skull },
  SLAUGHTERED: { label: "Slaughtered", className: "border-amber-200 bg-amber-50 text-amber-800", Icon: Archive },
  MOVED_OUT: { label: "Moved out", className: "border-violet-200 bg-violet-50 text-violet-800", Icon: Truck },
};

function getHealthReviewEvents(
  animal: LivestockInventoryItem,
  diseaseCases: AnimalHealthReport[],
  mortalityRecords: AnimalHealthReport[],
): HealthReviewEvent[] {
  const disease = diseaseCases.filter((record) =>
    String(record.livestock ?? "") === String(animal.id)
    || (animal.batchId != null && String(record.batch ?? "") === String(animal.batchId)),
  );
  const mortality = mortalityRecords.filter((record) =>
    String(record.livestock ?? "") === String(animal.id)
    || record.affected_animals?.some((affected) => String(affected.id) === String(animal.id))
    || (animal.batchId != null && String(record.batch ?? "") === String(animal.batchId)),
  );
  const events: HealthReviewEvent[] = [];

  for (const [reportType, records] of [["Disease", disease], ["Mortality", mortality]] as const) {
    for (const record of records) {
      const details = record.inspection_details ?? {};
      const reportLabel = reportType === "Disease" ? record.name || "Disease report" : record.cause || "Mortality report";
      const finalStatus = record.status.replaceAll("_", " ").toLowerCase();
      if (details.verifiedBy || details.verifiedAt) {
        events.push({
          key: `${reportType}-${record.id}-sibat`, reportLabel,
          reviewer: details.verifiedBy || "Field reviewer",
          role: details.verifiedRole || (record.status === "VERIFIED" ? record.reviewed_by_role || "Field reviewer" : "Field reviewer"),
          date: details.verifiedAt || null, status: "Verified", remarks: details.remarks || "",
          severity: details.severity,
          biosecurityAction: details.biosecurityAction,
          confirmedSymptoms: details.confirmedSymptoms,
          confirmedCount: details.confirmedCount,
        });
      }
      if (details.maoReviewedBy || details.maoReviewedAt) {
        events.push({
          key: `${reportType}-${record.id}-mao`, reportLabel,
          reviewer: details.maoReviewedBy || "MAO reviewer", role: details.maoReviewedRole || "MAO",
          date: details.maoReviewedAt || null, status: finalStatus, remarks: details.maoRemarks || "",
        });
      } else if (record.reviewed_by_name && record.reviewed_at) {
        events.push({
          key: `${reportType}-${record.id}-latest`, reportLabel,
          reviewer: record.reviewed_by_name, role: record.reviewed_by_role || "Reviewer",
          date: record.reviewed_at, status: finalStatus, remarks: record.review_remarks || "",
        });
      }
      if (!events.some((event) => event.key.startsWith(`${reportType}-${record.id}-`))) {
        const workflowStatus: Record<string, string> = {
          PENDING: "Pending field review",
          VERIFIED: "Field verified; pending MAO review",
          SUBJECT_TO_REVISION: "Returned for revision",
          REJECTED: "Rejected",
          APPROVED: "Approved",
        };
        events.push({
          key: `${reportType}-${record.id}-workflow`, reportLabel,
          reviewer: "Workflow status", role: "Current status",
          date: null, status: workflowStatus[record.status] || record.status.replaceAll("_", " "),
          remarks: record.review_remarks || "No individual reviewer event was retained for this status.",
        });
      }
    }
  }
  return events.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}

function HistoryRecord({
  animal,
  healthReviews,
  onOpen,
}: {
  animal: LivestockInventoryItem;
  healthReviews: HealthReviewEvent[];
  onOpen: () => void;
}) {
  const status = HISTORY_STATUS[animal.operationalStatus as Exclude<OperationalStatus, "ACTIVE">];
  const StatusIcon = status?.Icon ?? Archive;

  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <StatusIcon className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words font-bold text-slate-900">
                {animal.tagNumber || `Livestock #${animal.id}`}
              </h2>
              <Badge variant="outline" className={status?.className ?? "border-slate-200 bg-slate-50 text-slate-700"}>
                {status?.label ?? animal.operationalStatus.replaceAll("_", " ")}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {animal.livestockTypeName}{animal.breed ? ` · ${animal.breed}` : ""}
              {animal.sex ? ` · ${animal.sex}` : ""}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {animal.batchCode ? `Herd: ${animal.batchCode} · ` : ""}
              {healthReviews.length + animal.reviewHistory.length} review entr{healthReviews.length + animal.reviewHistory.length === 1 ? "y" : "ies"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <div className="text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              {animal.operationalStatusChangedAt
                ? new Date(animal.operationalStatusChangedAt).toLocaleDateString()
                : "Status date not recorded"}
            </span>
          </div>
          <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={onOpen}>
            View history details
          </Button>
        </div>
    </div>
  );
}

function HistoryDetails({ animal, healthReviews }: { animal: LivestockInventoryItem; healthReviews: HealthReviewEvent[] }) {
  const status = HISTORY_STATUS[animal.operationalStatus as Exclude<OperationalStatus, "ACTIVE">];
  const timeline: HistoryTimelineItem[] = [
    ...animal.reviewHistory.map((review) => ({
      key: `inventory-review-${review.id}`,
      role: review.reviewer_role,
      status: review.status.replaceAll("_", " "),
      reviewer: review.reviewer_name,
      date: review.reviewed_at,
      remarks: review.remarks,
      isBackfilled: review.is_backfilled,
    })),
    ...healthReviews.map((review) => ({
      key: review.key,
      role: review.role,
      status: review.status,
      reviewer: review.reviewer,
      date: review.date,
      remarks: review.remarks,
      reportLabel: review.reportLabel,
      severity: review.severity,
      biosecurityAction: review.biosecurityAction,
      confirmedSymptoms: review.confirmedSymptoms,
      confirmedCount: review.confirmedCount,
    })),
  ].sort((a, b) => (a.date ? new Date(a.date).getTime() : 0) - (b.date ? new Date(b.date).getTime() : 0));

  return (
    <div className="space-y-5">
      <section className="grid gap-x-5 gap-y-4 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-100 via-sky-50 to-blue-50 p-4 sm:grid-cols-2 sm:p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Lifecycle status</p>
          <Badge variant="outline" className={`mt-1.5 font-bold ${status?.className ?? ""}`}>{status?.label ?? animal.operationalStatus.replaceAll("_", " ")}</Badge>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Status date</p>
          <p className="mt-1.5 font-medium text-slate-950">{animal.operationalStatusChangedAt ? new Date(animal.operationalStatusChangedAt).toLocaleString() : "Not recorded"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Type / breed</p>
          <p className="mt-1.5 font-semibold text-slate-950">{animal.livestockTypeName}{animal.breed ? ` · ${animal.breed}` : ""}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Sex / weight</p>
          <p className="mt-1.5 font-semibold text-slate-950">{animal.sex || "Not recorded"}{animal.weight != null ? ` · ${animal.weight} kg` : ""}</p>
        </div>
        {animal.batchCode && (
          <div className="sm:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Herd</p>
            <p className="mt-1.5 font-semibold text-slate-950">{animal.batchCode}</p>
          </div>
        )}
      </section>
      <section>
        <p className="text-sm font-bold text-slate-800">Linked health reports and SIBAT / MAO review history</p>
        {timeline.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">No livestock registration or health review details were retained.</p>
        ) : (
          <ol className="relative mt-4 space-y-3 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-0.5 before:bg-slate-200">
            {timeline.map((event) => {
              const isWarning = /pending|revision|rejected/i.test(event.status);
              const isMao = /mao|approved/i.test(`${event.role} ${event.status}`);
              const Marker = isWarning ? AlertTriangle : isMao ? CheckCircle2 : ShieldCheck;
              const cardStyle = isWarning
                ? "border-amber-300 bg-amber-50"
                : isMao
                  ? "border-sky-200 bg-sky-50"
                  : "border-slate-200 bg-slate-100/90";
              const markerStyle = isWarning
                ? "bg-amber-100 text-amber-700"
                : isMao
                  ? "bg-sky-100 text-sky-700"
                  : "bg-emerald-100 text-emerald-700";
              return (
                <li key={event.key} className="relative pl-10">
                  <span className={`absolute left-0 top-2 z-10 flex size-8 items-center justify-center rounded-full border-2 border-white shadow-xs ${markerStyle}`}>
                    <Marker className="size-4" aria-hidden="true" />
                  </span>
                  <article className={`rounded-xl border px-3 py-2.5 shadow-xs ${cardStyle}`}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="text-sm font-bold text-slate-900">{event.role}</h3>
                      <Badge variant="outline" className={`text-[10px] ${isWarning ? "border-amber-400 bg-amber-100 text-amber-900" : isMao ? "border-sky-300 bg-sky-100 text-sky-900" : "border-emerald-300 bg-emerald-100 text-emerald-900"}`}>
                        {event.status}
                      </Badge>
                    </div>
                    {event.reportLabel && <p className="mt-1 text-sm font-medium text-slate-800">{event.reportLabel}</p>}
                    <p className="mt-1 text-xs text-slate-700">
                      {event.reviewer}{event.date ? ` · ${new Date(event.date).toLocaleString()}` : ""}
                    </p>
                    {event.confirmedSymptoms?.length ? <p className="mt-1 text-xs text-slate-800">{event.confirmedSymptoms.join(", ")}</p> : null}
                    {event.confirmedCount != null && <p className="mt-1 text-xs text-slate-800">Confirmed animals: {event.confirmedCount}</p>}
                    {event.remarks && <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-800">{event.remarks}</p>}
                    {(event.severity || event.biosecurityAction) && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                        {event.severity && <span className="rounded-md bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900">Severity: {event.severity}</span>}
                        {event.biosecurityAction && <span className="rounded-md bg-sky-100 px-1.5 py-0.5 font-medium text-sky-900">Action: {event.biosecurityAction.replaceAll("_", " ")}</span>}
                      </div>
                    )}
                    {event.isBackfilled && <p className="mt-1 text-[11px] text-amber-800">Earlier review stages were not retained in the old record.</p>}
                  </article>
                </li>
              );
            })}
          </ol>
        )}
      </section>
      <Button asChild variant="outline" className="rounded-lg">
        <Link href={`/livestock-inventory/${animal.id}`}>Open full livestock record</Link>
      </Button>
    </div>
  );
}

export default function LivestockHistoryPage() {
  // includeInactive asks the existing owner-scoped inventory API to include sold,
  // deceased, slaughtered, and moved records alongside active livestock.
  const { data: allAnimals = [], isLoading, isError, refetch, isFetching } = useUserInventory({ includeInactive: true });
  const { data: diseaseCases = [], isError: diseaseHistoryError } = useQuery({
    queryKey: ["farmer-disease-cases", "livestock-history"],
    queryFn: async () => {
      const response = await api.get<AnimalHealthReport[]>("diseases/cases/");
      return Array.isArray(response.data) ? response.data : [];
    },
  });
  const { data: mortalityRecords = [], isError: mortalityHistoryError } = useQuery({
    queryKey: ["farmer-mortality-records", "livestock-history"],
    queryFn: async () => {
      const response = await api.get<AnimalHealthReport[]>("diseases/mortality/");
      return Array.isArray(response.data) ? response.data : [];
    },
  });
  const [searchQuery,setSearchQuery] = useState("");
  const [statusFilter,setStatusFilter] = useState<OperationalStatus | "ALL">("ALL");
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);
  const pastAnimals = useMemo(
    () => allAnimals.filter((animal) => animal.operationalStatus !== "ACTIVE"),
    [allAnimals],
  );
  const history = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return pastAnimals.filter((animal) => {
      const matchesStatus = statusFilter === "ALL" || animal.operationalStatus === statusFilter;
      const searchable = [
        animal.tagNumber,
        animal.livestockTypeName,
        animal.breed,
        animal.batchCode,
        animal.operationalStatus.replaceAll("_", " "),
      ].filter(Boolean).join(" ").toLowerCase();
      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [pastAnimals,searchQuery,statusFilter]);
  const healthReviewsByAnimal = useMemo(
    () => new Map(history.map((animal) => [
      String(animal.id),
      getHealthReviewEvents(animal, diseaseCases, mortalityRecords),
    ])),
    [history,diseaseCases,mortalityRecords],
  );
  const selectedAnimal = history.find((animal) => String(animal.id) === selectedAnimalId) ?? null;
  const selectedHealthReviews = selectedAnimal
    ? healthReviewsByAnimal.get(String(selectedAnimal.id)) ?? []
    : [];

  return (
    <>
      <PageHeader
        title="Livestock History"
        subtitle="Past livestock records stay here for reference after an animal is sold, deceased, slaughtered, or moved out."
        variant="farmer"
        maxWidthClass="w-full"
      />
      <main className="w-full space-y-5 p-4 sm:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both ease-out motion-reduce:animate-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="outline" size="sm" className="rounded-lg">
            <Link href="/livestock-inventory"><ArrowLeft className="mr-2 size-4" />Back to livestock</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by tag, type, breed, or status"
              aria-label="Search livestock history"
              className="h-10 rounded-xl border-slate-200 bg-white pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as OperationalStatus | "ALL")}
            aria-label="Filter livestock history by status"
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <option value="ALL">All history statuses</option>
            {Object.entries(HISTORY_STATUS).map(([value,config]) => (
              <option key={value} value={value}>{config.label}</option>
            ))}
          </select>
        </div>

        {isLoading && <p className="py-10 text-center text-sm text-slate-500">Loading livestock history…</p>}
        {isError && (
          <Card className="border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
            Could not load livestock history. Please refresh and try again.
          </Card>
        )}
        {!isLoading && !isError && pastAnimals.length === 0 && (
          <Card className="border-dashed border-slate-300 p-8 text-center">
            <Archive className="mx-auto mb-3 size-8 text-slate-400" />
            <p className="font-semibold text-slate-800">No past livestock records yet</p>
            <p className="mt-1 text-sm text-slate-500">Animals marked sold, deceased, slaughtered, or moved out will appear here.</p>
          </Card>
        )}
        {!isLoading && !isError && pastAnimals.length > 0 && history.length === 0 && (
          <Card className="border-dashed border-slate-300 p-8 text-center">
            <Search className="mx-auto mb-3 size-8 text-slate-400" />
            <p className="font-semibold text-slate-800">No past livestock matches that filter</p>
            <p className="mt-1 text-sm text-slate-500">Try another tag or status, or clear the filters.</p>
            <Button type="button" variant="outline" className="mt-4 rounded-lg" onClick={() => { setSearchQuery(""); setStatusFilter("ALL"); }}>
              Clear filters
            </Button>
          </Card>
        )}
        {!isLoading && !isError && history.length > 0 && (
          <>
            {(diseaseHistoryError || mortalityHistoryError) && (
              <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Livestock status history loaded, but some linked health review details could not be loaded.
              </Card>
            )}
            <p className="text-sm font-semibold text-slate-600">{history.length} past animal record{history.length === 1 ? "" : "s"}</p>
            <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {history.map((animal) => (
                <HistoryRecord
                  key={animal.id}
                  animal={animal}
                  healthReviews={healthReviewsByAnimal.get(String(animal.id)) ?? []}
                  onOpen={() => setSelectedAnimalId(String(animal.id))}
                />
              ))}
            </div>
          </>
        )}
      </main>
      <Dialog open={Boolean(selectedAnimal)} onOpenChange={(open) => { if (!open) setSelectedAnimalId(null); }}>
        {selectedAnimal && (
          <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] overflow-y-auto rounded-2xl p-5 sm:max-w-3xl sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight sm:text-2xl">{selectedAnimal.tagNumber || `Livestock #${selectedAnimal.id}`} history</DialogTitle>
              <DialogDescription>Lifecycle information and retained SIBAT / MAO review events for this animal.</DialogDescription>
            </DialogHeader>
            <HistoryDetails animal={selectedAnimal} healthReviews={selectedHealthReviews} />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
