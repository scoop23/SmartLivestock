"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { InspectionRecord, fetchInspectionDetail } from "../auction-analytics";
import { NewInspectionForm } from "../movement-log-form";

export default function NewMovementLogRoute({ editId }: { editId: string | null }) {
  const queryClient = useQueryClient();
  const [inspection, setInspection] = useState<InspectionRecord | null>(null);
  const [loading, setLoading] = useState(Boolean(editId));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!editId) return;
    // Existing records are loaded before the shared form is rendered, so its
    // fields and validation stay the same for create and revision workflows.
    let active = true;
    fetchInspectionDetail(Number(editId))
      .then((record) => { if (active) setInspection(record); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [editId]);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm font-semibold text-slate-500"><Loader2 className="size-5 animate-spin" /> Loading movement log…</div>;
  if (error || (editId && !inspection)) return <div role="alert" className="mx-auto mt-10 max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-800">This movement log could not be loaded. It may no longer be available for editing.</div>;

  // No API record is created until the form calls createInspection on submit.
  return <NewInspectionForm
    inspectionToEdit={inspection}
    onSubmitSuccess={() => { void queryClient.invalidateQueries({ queryKey: ["inspections"] }); }}
  />;
}
