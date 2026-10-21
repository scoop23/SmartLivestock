"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DocumentPreviewDialog } from "@/app/(admin)/user-management/document-preview-dialog";
import type { UserDocumentItem } from "@/app/(admin)/user-management/user-management";
import { identityClient, identityError, identityMessage, type IdentityAttempt } from "@/lib/identity-verification";

interface EvidenceRow {
  user_id: number;
  name: string;
  barangay: string;
  attempts: IdentityAttempt[];
  documents: UserDocumentItem[];
}

export function IdentityChecks({ attempt }: { attempt: IdentityAttempt | null }) {
  return <dl className="grid grid-cols-1 gap-2 rounded-xl border p-3 text-sm sm:grid-cols-3">
    {[["Provider ID check", attempt?.document_result], ["Selfie-to-ID face match", attempt?.face_result], ["Liveness check", attempt?.liveness_result]].map(([label, value]) =>
      <div key={label} className="min-w-0"><dt className="font-semibold">{label}</dt><dd className="break-words">{(value || "NOT_COMPLETED").replaceAll("_", " ")}{attempt?.environment === "sandbox" ? " (sandbox)" : ""}</dd></div>)}
  </dl>;
}

export function IdentityEvidencePanel({ userId, canAssess = false }: { userId: number; canAssess?: boolean }) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<UserDocumentItem | null>(null);
  const query = useQuery({ queryKey: ["identity-evidence", user?.email, user?.role, user?.accessScope, user?.assignedBarangayId, userId], enabled: Boolean(user), retry: false, gcTime: 0,
    queryFn: async () => (await identityClient().get<EvidenceRow>(`/api/users/identity/reviews/${userId}/`)).data });
  const assess = useMutation({ mutationFn: () => identityClient().post(`/api/users/identity/reviews/${userId}/assessment/`, { reason }),
    onSuccess: () => { setReason(""); void query.refetch(); } });
  if (query.isPending) return <p role="status">Loading identity evidence…</p>;
  if (query.isError) return <p role="alert" className="text-sm text-rose-700">{identityError(query.error)}</p>;
  const latest = query.data.attempts[0];
  if (!latest) return <p className="text-xs text-slate-600">This registration was not enrolled in automated identity checks. Existing manual document review applies.</p>;
  return <section className="space-y-3 rounded-xl border bg-slate-50 p-3 text-sm">
    <h3 className="font-bold">Supporting identity evidence</h3>
    <p>{identityMessage(latest)}</p>
    <IdentityChecks attempt={latest} />
    {latest.document_capture === "DIDIT_HOSTED" ? <div className="space-y-2 text-xs">
      <p>The ID was submitted through Didit. No duplicate ID image is stored here. These summaries support human review and do not establish legal identity. If provider capture is incomplete, arrange alternative ID inspection before approval.</p>
      {canAssess && <p>To inspect the captured ID, use the provider reference below in the <a className="underline" href="https://business.didit.me/" target="_blank" rel="noreferrer">Didit Business Console</a>. A separate authorized Didit account is required; SmartLivestock roles do not grant provider access.</p>}
    </div> : <p className="text-xs">The provider captures its own ID image. Compare the applicant’s uploaded registration ID during manual review; these summaries do not prove the files are identical or establish legal identity.</p>}
    <p className="break-all text-xs text-slate-600">Provider reference: {latest.provider_reference || "Not started"} · Updated {new Date(latest.updated_at).toLocaleString()}</p>
    <p className="text-xs">Biometric consent: {latest.consent_at ? `Recorded (${latest.policy_version})` : "Not given; no provider checks started"}</p>
    <div className="flex flex-wrap gap-2">{query.data.documents.map((doc) => <Button key={doc.id} variant="outline" size="sm" onClick={() => setPreview(doc)} className="min-h-10 whitespace-normal">Preview {doc.document_type_display || doc.document_type}</Button>)}</div>
    <details><summary className="cursor-pointer font-semibold">Attempt history ({query.data.attempts.length})</summary>
      {query.data.attempts.map((item) => <div key={item.id} className="mt-2 border-t pt-2 text-xs"><p>{item.state.replaceAll("_", " ")} · {new Date(item.updated_at).toLocaleString()}</p>
        {item.events.map((event, index) => <p key={index}>{event.state.replaceAll("_", " ")} · {new Date(event.created_at).toLocaleString()}</p>)}
      </div>)}
    </details>
    {latest.manual_review_at ? <p className="text-xs">MAO assessment {latest.assessment_current ? "recorded for current evidence" : "needs updating after evidence changed"}: {latest.manual_review_reason}</p> : null}
    {canAssess ? <div className="space-y-2">
      <label htmlFor={`identity-assessment-${userId}`} className="block font-semibold">MAO assessment and manual checks</label>
      <Textarea id={`identity-assessment-${userId}`} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} placeholder="Record your evidence assessment, including alternative checks when automation is unavailable or inconclusive. Do not enter ID numbers." />
      <Button disabled={reason.trim().length < 10 || assess.isPending} onClick={() => assess.mutate()} className="min-h-11 whitespace-normal">{assess.isPending ? "Recording…" : "Record MAO evidence assessment"}</Button>
      {assess.isError ? <p role="alert">The assessment could not be saved. Check your permissions and try again.</p> : null}
      <p className="text-xs">This records your assessment; approve documents and the account using the existing review controls.</p>
    </div> : <p className="text-xs">Read-only field evidence. Final registration approval remains with MAO/Admin.</p>}
    <DocumentPreviewDialog document={preview} open={Boolean(preview)} onOpenChange={(open) => { if (!open) setPreview(null); }}
      getDocTypeLabel={(doc) => doc.document_type_display || doc.document_type}
      getDocStatusBadge={(status) => <span>{status.replaceAll("_", " ")}</span>} />
  </section>;
}

export function IdentityReviewQueue() {
  const { user } = useAuth();
  const params = useSearchParams();
  const requested = params.get("identityReview") === "1";
  const [manuallyOpen, setManuallyOpen] = useState(false);
  const [dismissedRequest, setDismissedRequest] = useState(false);
  const open = manuallyOpen || (requested && !dismissedRequest);
  const setOpen = (nextOpen: boolean) => { setManuallyOpen(nextOpen); if (!nextOpen) setDismissedRequest(true); };
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const query = useQuery({ queryKey: ["scoped-identity-evidence", user?.email, user?.role, user?.accessScope, user?.assignedBarangayId, page], enabled: open && Boolean(user), gcTime: 0, retry: false,
    queryFn: async () => (await identityClient().get<{ results: EvidenceRow[]; next: string | null; previous: string | null }>("/api/users/identity/reviews/", { params: { page } })).data });
  return <>
    <Button variant="outline" className="min-h-11 w-full whitespace-normal" onClick={() => setOpen(true)}>Registration identity evidence</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>Registration identity evidence</DialogTitle><DialogDescription>Read-only supporting checks for farmers in your authorized barangay scope. These are not account approval actions.</DialogDescription></DialogHeader>
      {query.isPending ? <p role="status">Loading evidence…</p> : null}
      {query.isError ? <p role="alert">{identityError(query.error)}</p> : null}
      {query.data?.results.length === 0 ? <p>No enrolled registrations in your scope.</p> : null}
      {query.data?.results.map((row) => <div key={row.user_id} className="space-y-2 border-b pb-3"><Button variant="outline" onClick={() => setSelected(selected === row.user_id ? null : row.user_id)} className="h-auto min-h-11 w-full whitespace-normal">{row.name} · {row.barangay} · View evidence</Button>{selected === row.user_id ? <IdentityEvidencePanel userId={row.user_id} /> : null}</div>)}
      <div className="flex items-center justify-between"><Button variant="outline" disabled={!query.data?.previous} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page}</span><Button variant="outline" disabled={!query.data?.next} onClick={() => setPage(page + 1)}>Next</Button></div>
    </DialogContent></Dialog>
  </>;
}
