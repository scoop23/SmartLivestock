"use client";

import { Baby, Calendar, Dna, HeartPulse, PencilLine, Scale, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { BirthingSpeciesTerminology } from "../production-calving-tab";
import type { CalvingRecordItem } from "../production-calving-tab";
import Link from "next/link";
import { formatCalendarDate } from "@/lib/livestock-age";

interface BirthingRecordsTableProps {
  records: CalvingRecordItem[];
  terms: BirthingSpeciesTerminology;
  isLoading: boolean;
  onOpenNew: () => void;
  onEditResubmit?: (record: CalvingRecordItem) => void;
}

export default function BirthingRecordsTable({
  records,
  terms,
  isLoading,
  onOpenNew,
  onEditResubmit,
}: BirthingRecordsTableProps) {
  if (isLoading) {
    return (
      <Card className="border-slate-200 shadow-xs rounded-2xl overflow-hidden bg-white">
        <CardContent className="p-8 text-center text-sm text-slate-500">
          Loading {terms.eventName.toLowerCase()} records...
        </CardContent>
      </Card>
    );
  }

  if (records.length === 0) {
    return (
      <Card className="border-slate-200 shadow-xs rounded-2xl overflow-hidden bg-white">
        <CardContent className="p-12 text-center space-y-3">
          <div className="size-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
            <Baby className="size-6" />
          </div>
          <h4 className="text-base font-bold text-slate-800">
            No {terms.eventName} Records Logged Yet
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            eeep an accurate maternal registry of births, pedigree lineage, and birth weights for municipal reporting.
          </p>
          <button
            type="button"
            onClick={onOpenNew}
            className="text-xs text-emerald-700 font-bold hover:underline pt-1 inline-block"
          >
            + Record the first {terms.eventName.toLowerCase()}
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 shadow-xs rounded-2xl overflow-hidden bg-white">
      <CardContent className="p-0">
        <div className="space-y-3 p-3 md:hidden">
          {records.map((record) => (
            <article key={record.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words font-bold text-slate-900">{record.calf_tag || `Event #${record.id}`}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{record.calf_sex} · {record.breed || "Breed not recorded"}</p>
                </div>
                <Badge variant="outline" className="shrink-0">{record.status || "PENDING"}</Badge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
                <div><dt className="text-slate-500">Calving / Birth Date</dt><dd className="font-semibold">{formatCalendarDate(record.calving_date)}</dd></div>
                <div><dt className="text-slate-500">Birth Weight</dt><dd className="font-semibold">{record.birth_weight != null ? `${record.birth_weight} kg` : "Not recorded"}</dd></div>
                <div className="col-span-2"><dt className="text-slate-500">Dam</dt><dd className="font-semibold">{record.dam_tag ? `Tag #${record.dam_tag}` : `Dam #${record.dam}`}</dd></div>
              </dl>
              {record.offspring_inventory != null && (
                <Link href={`/livestock-inventory/${record.offspring_inventory}`} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-900">
                  Open official inventory #{record.offspring_inventory}
                </Link>
              )}
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">{terms.offspringName} Tag / ID</th>
                <th className="py-3 px-4">{terms.damName}</th>
                <th className="py-3 px-4">Gender</th>
                <th className="py-3 px-4">Birth Weight</th>
                <th className="py-3 px-4">Birth Date</th>
                <th className="py-3 px-4">{terms.sireName}</th>
                <th className="py-3 px-4">Delivery Ease</th>
                <th className="py-3 px-4">Field Status</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((record) => {
                const status = record.status || "PENDING";
                return (
                  <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                          <Tag className="size-3.5" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">
                            {record.calf_tag || `ID #${record.id}`}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {record.breed || "Standard"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                        <HeartPulse className="size-3.5 text-rose-500 shrink-0" />
                        <span>{record.dam_tag ? `Tag #${record.dam_tag}` : `Dam #${record.dam}`}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {record.calf_sex === "FEMALE" ? (
                        <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-bold">
                          {terms.femaleOffspring}
                        </Badge>
                      ) : (
                        <Badge className="bg-sky-50 text-sky-700 border-sky-200 text-[10px] font-bold">
                          {terms.maleOffspring}
                        </Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {record.birth_weight ? (
                        <div className="flex items-center gap-1 font-semibold text-slate-800">
                          <Scale className="size-3.5 text-slate-400" />
                          <span>{record.birth_weight} kg</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1 text-slate-600">
                        <Calendar className="size-3.5 text-slate-400" />
                        <span>{formatCalendarDate(record.calving_date)}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {record.sire_tag ? (
                        <div className="flex items-center gap-1 text-purple-700 font-medium text-[11px]">
                          <Dna className="size-3.5 text-purple-500" />
                          <span>{record.sire_tag}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {record.calving_ease || "Normal"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {status === "APPROVED" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          Certified (MAO)
                        </span>
                      ) : status === "VERIFIED" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-50 text-sky-800 border border-sky-200">
                          <span className="size-1.5 rounded-full bg-sky-500" />
                          SIBAT Verified
                        </span>
                      ) : status === "SUBJECT_TO_REVISION" || status === "SUBJECT_FOR_REVISION" ? (
                        <span className="inline-flex flex-col items-start gap-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="size-1.5 rounded-full bg-rose-500" />
                            For Revision
                          </span>
                          {record.review_remarks && (
                            <span className="text-[10px] font-medium text-rose-600 max-w-[180px] line-clamp-2">
                              {record.review_remarks}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200">
                          <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Awaiting SIBAT
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 max-w-[180px] truncate text-slate-500 text-[11px]">
                      {record.notes || "—"}
                    </td>
                    <td className="py-3.5 px-4">
                      {record.offspring_inventory != null && (
                        <Link href={`/livestock-inventory/${record.offspring_inventory}`} className="mb-2 block text-emerald-800 underline">Inventory #{record.offspring_inventory}</Link>
                      )}
                      {status === "SUBJECT_TO_REVISION" || status === "SUBJECT_FOR_REVISION" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onEditResubmit?.(record)}
                          className="text-[10px] font-bold text-rose-700 border-rose-200 hover:bg-rose-50 gap-1 rounded-lg cursor-pointer"
                        >
                          <PencilLine className="size-3.5" />
                          Correct & Resubmit
                        </Button>
                      ) : (
                        <span className="text-slate-200 select-none">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
