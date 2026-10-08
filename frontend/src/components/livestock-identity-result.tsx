"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { RegisteredLivestockLookup } from "@/app/(auction)/auction-inspections/auction-analytics";

// Search and QR show the same database identity and server eligibility decision.
export function LivestockIdentityResult({ record, onAdd, error }: {
  record: RegisteredLivestockLookup;
  onAdd: () => void;
  error?: string;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">Registered Livestock Found</h3>
        <Badge className={record.eligible ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-950"}>{record.eligible ? "Eligible to add" : "Cannot add"}</Badge>
      </div>
      <p className="mt-4 text-xs font-bold uppercase text-slate-500">Livestock</p>
      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 break-words text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-slate-500">Tag ID</dt><dd className="font-bold text-slate-900">{record.tag_number || `#${record.id}`}</dd></div>
        <div><dt className="text-xs text-slate-500">Species</dt><dd>{record.livestock_type_name}</dd></div>
        <div><dt className="text-xs text-slate-500">Breed</dt><dd>{record.breed || "Not recorded"}</dd></div>
        <div><dt className="text-xs text-slate-500">Sex</dt><dd>{record.sex || "Not recorded"}</dd></div>
        <div><dt className="text-xs text-slate-500">Birth date</dt><dd>{record.birth_date || "Not recorded"}</dd></div>
        <div><dt className="text-xs text-slate-500">Age / class</dt><dd>{record.age ? `${record.age.years ? `${record.age.years}y ` : ""}${record.age.months}m` : "Unknown"} · {record.age_classification.toLowerCase()}</dd></div>
        <div><dt className="text-xs text-slate-500">Operational status</dt><dd>{record.operational_status}</dd></div>
        <div><dt className="text-xs text-slate-500">Registration</dt><dd>{record.registration_status}</dd></div>
      </dl>
      <p className="mt-4 border-t border-slate-200 pt-3 text-xs font-bold uppercase text-slate-500">Farmer / Owner</p>
      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 break-words text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-slate-500">Name</dt><dd className="font-semibold text-slate-900">{record.owner_name}</dd></div>
        <div><dt className="text-xs text-slate-500">Barangay</dt><dd>{record.barangay || "Not recorded"}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Address / origin</dt><dd>{record.origin || "Not recorded"}</dd></div>
      </dl>
      {!record.eligible && <p role="alert" className="mt-3 text-sm leading-5 text-amber-900">{record.ineligibility_reason || "This livestock is not eligible to be linked."}</p>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2.5 text-sm text-rose-800">{error}</p>}
      <p className="mt-3 text-xs leading-5 text-slate-500">Identity and status come from the registry. MAO reviews the movement separately.</p>
      <Button type="button" disabled={!record.eligible} onClick={onAdd} className="mt-4 min-h-11 w-full bg-violet-700 text-white hover:bg-violet-800">Add to Movement Log</Button>
    </section>
  );
}
