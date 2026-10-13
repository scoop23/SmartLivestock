"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Archive, ArrowLeft, CalendarDays, CircleDollarSign, Skull, Truck } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useUserInventory } from "../livestock-inventory";
import type { LivestockInventoryItem, OperationalStatus } from "../livestock-inventory";

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

function HistoryRecord({ animal }: { animal: LivestockInventoryItem }) {
  const status = HISTORY_STATUS[animal.operationalStatus as Exclude<OperationalStatus, "ACTIVE">];
  const StatusIcon = status?.Icon ?? Archive;

  return (
    <Card className="border-slate-200 shadow-xs">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
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
            {animal.batchCode && <p className="mt-1 text-xs text-slate-500">Herd: {animal.batchCode}</p>}
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
          <Button asChild size="sm" variant="outline" className="rounded-lg">
            <Link href={`/livestock-inventory/${animal.id}`}>View record</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LivestockHistoryPage() {
  // includeInactive asks the existing owner-scoped inventory API to include sold,
  // deceased, slaughtered, and moved records alongside active livestock.
  const { data: allAnimals = [], isLoading, isError, refetch, isFetching } = useUserInventory({ includeInactive: true });
  const history = useMemo(
    () => allAnimals.filter((animal) => animal.operationalStatus !== "ACTIVE"),
    [allAnimals],
  );

  return (
    <>
      <PageHeader
        title="Livestock History"
        subtitle="Past livestock records stay here for reference after an animal is sold, deceased, slaughtered, or moved out."
        variant="farmer"
      />
      <main className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="outline" size="sm" className="rounded-lg">
            <Link href="/livestock-inventory"><ArrowLeft className="mr-2 size-4" />Back to livestock</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        {isLoading && <p className="py-10 text-center text-sm text-slate-500">Loading livestock history…</p>}
        {isError && (
          <Card className="border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
            Could not load livestock history. Please refresh and try again.
          </Card>
        )}
        {!isLoading && !isError && history.length === 0 && (
          <Card className="border-dashed border-slate-300 p-8 text-center">
            <Archive className="mx-auto mb-3 size-8 text-slate-400" />
            <p className="font-semibold text-slate-800">No past livestock records yet</p>
            <p className="mt-1 text-sm text-slate-500">Animals marked sold, deceased, slaughtered, or moved out will appear here.</p>
          </Card>
        )}
        {!isLoading && !isError && history.length > 0 && (
          <>
            <p className="text-sm font-semibold text-slate-600">{history.length} past animal record{history.length === 1 ? "" : "s"}</p>
            <div className="space-y-3">{history.map((animal) => <HistoryRecord key={animal.id} animal={animal} />)}</div>
          </>
        )}
      </main>
    </>
  );
}
