"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, CalendarDays, ClipboardList, MapPin, ShieldCheck, X } from "lucide-react";

export default function ReportDetailsExampleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain p-0 rounded-3xl sm:max-w-2xl">
        <DialogHeader className="sticky top-0 z-10 flex-row items-start justify-between gap-3 border-b bg-white p-4 sm:p-5">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <DialogTitle className="text-lg font-black text-slate-900">Example Report Details</DialogTitle>
              <Badge className="border border-amber-200 bg-amber-50 text-amber-900">Mockup · not a real report</Badge>
            </div>
            <DialogDescription>This preview explains the information shown after you open one of your reports.</DialogDescription>
          </div>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Close example report details" className="size-9 shrink-0 rounded-full">
              <X className="size-4" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="space-y-4 p-4 sm:p-6">
          <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
            <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <ShieldCheck className="size-4 text-sky-700" /> Review progress
              <Badge variant="outline" className="ml-auto border-amber-300 bg-amber-50 text-amber-900">Pending SIBAT visit</Badge>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">This status means the farmer submitted the report and it is waiting for field verification. SIBAT verification and MAO approval are separate review steps.</p>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><ClipboardList className="size-4 text-emerald-700" /> Case summary</h3>
            <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
              <ExampleField label="Reference" value="DIS-EXAMPLE" explanation="The report identifier used when staff open or discuss this case." />
              <ExampleField label="Animal" value="CATTLE-EXAMPLE-01 · Cattle" explanation="The livestock tag and type connected to the report." />
              <ExampleField label="Reported" value="Oct 23, 2026 · 1 head" explanation="When the report was recorded and how many animals are affected." />
              <ExampleField label="Status" value="Pending SIBAT visit" explanation="The current review stage. A pending report is not yet verified or approved." />
            </div>
          </section>

          <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><AlertTriangle className="size-4 text-amber-700" /> Reported concern</h3>
            <p className="mt-2 text-sm font-semibold text-slate-800">Example: reduced appetite</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">This is what the farmer reported. It is an observation, not a confirmed diagnosis.</p>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <ExampleField label="CBAT / SIBAT field notes" value="Awaiting field visit" explanation="Staff findings, confirmed signs, and any field instructions appear here after inspection." />
            <ExampleField label="MAO review" value="Awaiting field verification" explanation="Municipal review remarks and approval details appear here when MAO has reviewed the case." />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><CalendarDays className="size-4 text-slate-600" /> Other details</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">Farmer notes and uploaded photo evidence appear when provided. Real reports also include a QR pass for opening the report in SmartLivestock. This sample has no real photo or QR code.</p>
            <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-slate-500"><MapPin className="size-3.5" /> Barangay details appear when available to your account.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExampleField({ label, value, explanation }: { label: string; value: string; explanation: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xs font-bold text-slate-800">{value}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{explanation}</p>
    </div>
  );
}
