import { Badge } from "@/components/ui/badge";
import type { CalvingRecordItem } from "@/app/(farmer)/production-dashboard/production-calving-tab";
import { formatCalendarDate } from "@/lib/livestock-age";
import { ArrowDown, Dna, HeartPulse, Sprout } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { LivestockInventoryItem } from "../livestock-inventory";

interface LivestockLineageTreeProps {
  animal: LivestockInventoryItem;
  parentRecord: CalvingRecordItem | null;
  offspringRecords: CalvingRecordItem[];
  inventory: LivestockInventoryItem[];
  offspringName: string;
  offspringPlural: string;
}

function findRegisteredOffspring(record: CalvingRecordItem, inventory: LivestockInventoryItem[]) {
  if (record.offspring_inventory) {
    return inventory.find((item) => String(item.id) === String(record.offspring_inventory)) ?? null;
  }

  const tag = record.calf_tag.trim().toUpperCase();
  if (!tag) return null;
  const matches = inventory.filter((item) => item.tagNumber.trim().toUpperCase() === tag);
  return matches.length === 1 ? matches[0] : null;
}

function RecordStatus({ status }: { status?: string }) {
  if (!status) return null;
  const approved = status === "APPROVED" || status === "VERIFIED";
  return (
    <Badge variant="outline" className={approved ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

function TreeNode({
  title,
  tag,
  details,
  status,
  icon,
  href,
  highlight = false,
}: {
  title: string;
  tag: string;
  details?: string;
  status?: string;
  icon: ReactNode;
  href?: string;
  highlight?: boolean;
}) {
  const content = (
    <div className={`h-full min-h-28 rounded-2xl border p-4 text-left shadow-xs transition-colors ${
      highlight
        ? "border-emerald-300 bg-emerald-50/80"
        : href
        ? "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40"
        : "border-slate-200 bg-white"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-500">
          {icon}
          {title}
        </span>
        {status && <RecordStatus status={status} />}
      </div>
      <p className="mt-2 break-words font-mono text-sm font-black text-slate-900">{tag}</p>
      {details && <p className="mt-1 text-xs leading-relaxed text-slate-600">{details}</p>}
      {href && <p className="mt-2 text-[10px] font-bold text-emerald-800">Open animal record ↗</p>}
    </div>
  );

  return href ? <Link href={href} className="block h-full">{content}</Link> : content;
}

export function LivestockLineageTree({
  animal,
  parentRecord,
  offspringRecords,
  inventory,
  offspringName,
  offspringPlural,
}: LivestockLineageTreeProps) {
  const dam = parentRecord
    ? inventory.find((item) => String(item.id) === String(parentRecord.dam)) ?? null
    : null;

  const sireTag = parentRecord?.sire_tag.trim() || "Not recorded";
  const damTag = dam?.tagNumber || parentRecord?.dam_tag || (parentRecord ? `Inventory #${parentRecord.dam}` : "Not recorded");

  return (
    <section aria-labelledby="lineage-tree-title" className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="lineage-tree-title" className="text-sm font-black text-slate-900">Family Tree</h3>
          <p className="mt-1 text-xs text-slate-500">
            Recorded parents and offspring. A sire tag is a text reference unless linked to an inventory record.
          </p>
        </div>
        <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
          {offspringRecords.length} {offspringRecords.length === 1 ? offspringName : offspringPlural}
        </Badge>
      </div>

      <div className="mx-auto flex max-w-4xl flex-col items-center">
        <div className="w-full">
          <p className="mb-2 text-center text-[10px] font-black uppercase tracking-wider text-slate-500">Parents</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TreeNode
              title="Sire · Father"
              tag={sireTag}
              details={parentRecord ? `Breed: ${parentRecord.breed || animal.breed || "Not recorded"}` : "Parentage has not been recorded."}
              status={parentRecord?.status}
              icon={<Dna className="size-3.5 text-blue-600" />}
            />
            <TreeNode
              title="Dam · Mother"
              tag={damTag}
              details={parentRecord ? `Breed: ${dam?.breed || parentRecord.dam_breed || parentRecord.breed || "Not recorded"}` : "Parentage has not been recorded."}
              status={parentRecord?.status}
              icon={<HeartPulse className="size-3.5 text-rose-600" />}
              href={dam ? `/livestock-inventory/${encodeURIComponent(dam.id)}` : undefined}
            />
          </div>
        </div>

        <div aria-hidden="true" className="flex h-10 items-center text-emerald-700">
          <span className="h-5 border-l-2 border-emerald-300" />
          <ArrowDown className="-ml-[9px] mt-5 size-4" />
        </div>

        <div className="w-full max-w-xl">
          <p className="mb-2 text-center text-[10px] font-black uppercase tracking-wider text-emerald-800">Selected animal</p>
          <TreeNode
            title="This animal"
            tag={animal.tagNumber || `Inventory #${animal.id}`}
            details={[animal.breed || "Breed not recorded", animal.sex || "Sex not recorded"].join(" · ")}
            icon={<Sprout className="size-3.5 text-emerald-700" />}
            highlight
          />
        </div>

        <div aria-hidden="true" className="flex h-10 items-center text-emerald-700">
          <span className="h-5 border-l-2 border-emerald-300" />
          <ArrowDown className="-ml-[9px] mt-5 size-4" />
        </div>

        <div className="w-full">
          <p className="mb-2 text-center text-[10px] font-black uppercase tracking-wider text-slate-500">Offspring</p>
          {offspringRecords.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {offspringRecords.map((record) => {
                const registeredAnimal = findRegisteredOffspring(record, inventory);
                const calfTag = record.calf_tag.trim() || `${offspringName} (tag not recorded)`;
                const details = [
                  record.calf_sex ? record.calf_sex.toLowerCase() : null,
                  record.calving_date ? formatCalendarDate(record.calving_date) : null,
                  record.birth_weight ? `${record.birth_weight} kg at birth` : null,
                  record.sire_tag ? `Sire: ${record.sire_tag}` : null,
                ].filter(Boolean).join(" · ");

                return (
                  <TreeNode
                    key={record.id}
                    title={offspringName}
                    tag={registeredAnimal?.tagNumber || calfTag}
                    details={details || "Birth details not recorded."}
                    status={record.status}
                    icon={<Sprout className="size-3.5 text-emerald-700" />}
                    href={registeredAnimal ? `/livestock-inventory/${encodeURIComponent(registeredAnimal.id)}` : undefined}
                  />
                );
              })}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-xs text-slate-500">
              No registered {offspringPlural.toLowerCase()} are linked to this animal yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
