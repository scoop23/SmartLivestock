"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";

type Verification = {
  valid: boolean;
  status: string;
  control_number: string;
  date_issued: string | null;
  time_issued: string | null;
  shipper_name: string;
  origin: string;
  destination: string;
  purpose: string;
  items: { livestock_type: string; quantity: number; classification: string }[];
};

export default function ClearanceVerification({ controlNumber }: { controlNumber: string }) {
  const [record, setRecord] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(Boolean(controlNumber));

  useEffect(() => {
    if (!controlNumber) return;
    api.get<Verification>("inspections/verify-clearance/", { params: { control_number: controlNumber } })
      .then((response) => setRecord(response.data))
      .catch(() => setRecord(null))
      .finally(() => setLoading(false));
  }, [controlNumber]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
      <article className="mx-auto max-w-xl rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-800">SmartLivestock · Public verification</p>
        {loading ? <h1 className="mt-4 text-xl font-bold">Checking clearance…</h1> : record ? <>
          <h1 className="mt-4 text-2xl font-black text-emerald-800">Valid approved clearance</h1>
          <p className="mt-1 font-mono text-lg">{record.control_number}</p>
          <dl className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Shipper</dt><dd className="font-semibold">{record.shipper_name}</dd></div>
            <div><dt className="text-slate-500">Issued</dt><dd className="font-semibold">{record.date_issued || "—"} {record.time_issued || ""}</dd></div>
            <div><dt className="text-slate-500">Origin</dt><dd className="font-semibold">{record.origin || "Not recorded"}</dd></div>
            <div><dt className="text-slate-500">Destination</dt><dd className="font-semibold">{record.destination}</dd></div>
            <div><dt className="text-slate-500">Purpose</dt><dd className="font-semibold">{record.purpose}</dd></div>
          </dl>
          <div className="mt-6 border-t pt-4"><h2 className="font-bold">Inspected livestock</h2><ul className="mt-2 space-y-2 text-sm">{record.items.map((item, index) => <li key={`${item.livestock_type}-${index}`}>{item.quantity} × {item.livestock_type} · {item.classification}</li>)}</ul></div>
          <p className="mt-6 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">This clearance number matches an approved record in SmartLivestock.</p>
        </> : <>
          <h1 className="mt-4 text-2xl font-black text-rose-800">Clearance not verified</h1>
          <p className="mt-2 text-sm text-slate-600">No approved clearance matches this QR code. Check the printed number with the issuing office.</p>
        </>}
      </article>
    </main>
  );
}
