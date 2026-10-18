import { KpiCard } from "@/components/ui/kpi-card";
import { CheckCircle2,ClipboardList,Clock,RotateCcw } from "lucide-react";

type TransferKpiRecord = { status: string };

export function OwnershipTransferKpis({
  records,
  isLoading,
}: {
  records: TransferKpiRecord[];
  isLoading: boolean;
}) {
  const awaitingReview = records.filter((record) => ["PENDING", "VERIFIED"].includes(record.status)).length;
  const approved = records.filter((record) => record.status === "APPROVED").length;
  const needsRevision = records.filter((record) => record.status === "SUBJECT_TO_REVISION").length;

  return (
    <section aria-label="Ownership transfer summary" className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard title="Transfer Records" value={records.length} variant="default" icon={<ClipboardList className="size-4" />} badge="All" isLoading={isLoading} />
      <KpiCard title="Awaiting MAO" value={awaitingReview} variant="amber" icon={<Clock className="size-4" />} badge="In review" isLoading={isLoading} />
      <KpiCard title="Approved Transfers" value={approved} variant="emerald" icon={<CheckCircle2 className="size-4" />} badge="Approved" isLoading={isLoading} />
      <KpiCard title="Needs Revision" value={needsRevision} variant="rose" icon={<RotateCcw className="size-4" />} badge="Action needed" isLoading={isLoading} />
    </section>
  );
}
