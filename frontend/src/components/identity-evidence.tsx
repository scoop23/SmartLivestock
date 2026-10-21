"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AlertCircle, Check, Link2, UserCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DocumentPreviewDialog } from "@/app/(admin)/user-management/document-preview-dialog";
import type { UserDocumentItem } from "@/app/(admin)/user-management/user-management";
import { identityClient, identityError, identityMessage, type IdentityAttempt } from "@/lib/identity-verification";

interface ProviderWarningSession {
  session_number: number | null;
  session_id: string | null;
  user_id: number | null;
  full_name: string;
  status: string;
  portrait_url?: string | null;
}

interface ProviderWarning {
  feature: string;
  risk: string;
  tag_label: string;
  short_description: string;
  long_description: string;
  log_type: string;
  duplicated_sessions: ProviderWarningSession[];
}

interface EvidenceRow {
  user_id: number;
  name: string;
  barangay: string;
  attempts: IdentityAttempt[];
  documents: UserDocumentItem[];
  provider_review?: {
    images: { label: string; url: string }[];
    name_comparison: {
      provided_name: string | null;
      extracted_name: string | null;
      name_match_score: number | null;
      match_type: string | null;
      provider_warning: string | null;
    } | null;
    warnings?: ProviderWarning[];
  };
  provider_review_error?: string;
}

export function IdentityChecks({ attempt }: { attempt: IdentityAttempt | null }) {
  return (
    <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
      {(
        [
          ["Provider ID check", attempt?.document_result],
          ["Selfie-to-ID face match", attempt?.face_result],
          ["Liveness check", attempt?.liveness_result],
        ] as const
      ).map(([label, value]) => {
        const raw = value || "NOT_COMPLETED";
        const isPassed = raw === "PASSED" || raw === "APPROVED";
        const isWarning = raw === "INCONCLUSIVE" || raw === "REVIEW_REQUIRED" || raw === "RETRY_REQUIRED";
        const isFailed = raw === "FAILED" || raw === "DECLINED" || raw === "REJECTED";
        const cardStyle = isPassed
          ? "border-emerald-200 bg-emerald-50/70 text-emerald-950"
          : isWarning
            ? "border-amber-200 bg-amber-50/70 text-amber-950"
            : isFailed
              ? "border-rose-200 bg-rose-50/70 text-rose-950"
              : "border-slate-200 bg-slate-50/80 text-slate-800";
        const dotStyle = isPassed
          ? "bg-emerald-500"
          : isWarning
            ? "bg-amber-500"
            : isFailed
              ? "bg-rose-500"
              : "bg-slate-400";

        return (
          <div
            key={label}
            className={`min-w-0 rounded-2xl border p-3.5 transition-colors ${cardStyle}`}
          >
            <dt className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              {label}
            </dt>
            <dd className="mt-1.5 flex items-center gap-2 break-words font-mono text-xs font-black uppercase tracking-tight">
              <span className={`size-2 shrink-0 rounded-full ${dotStyle}`} aria-hidden />
              <span>
                {raw.replaceAll("_", " ")}
                {attempt?.environment === "sandbox" ? " (sandbox)" : ""}
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function IdentityEvidencePanel({
  userId,
  canAssess = false,
  onSelectUserId,
}: {
  userId: number;
  canAssess?: boolean;
  onSelectUserId?: (targetUserId: number) => void;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<UserDocumentItem | null>(null);
  const [activeWarningIndex, setActiveWarningIndex] = useState<number | null>(0);
  const query = useQuery({ queryKey: ["identity-evidence", user?.email, user?.role, user?.accessScope, user?.assignedBarangayId, userId], enabled: Boolean(user), retry: false, gcTime: 0,
    queryFn: async () => (await identityClient().get<EvidenceRow>(`/api/users/identity/reviews/${userId}/`)).data });
  const assess = useMutation({ mutationFn: () => identityClient().post(`/api/users/identity/reviews/${userId}/assessment/`, { reason }),
    onSuccess: () => { setReason(""); void query.refetch(); } });
  if (query.isPending) return <p role="status">Loading identity evidence…</p>;
  if (query.isError) return <p role="alert" className="text-sm text-rose-700">{identityError(query.error)}</p>;
  const latest = query.data.attempts[0];
  if (!latest) return <p className="text-xs text-slate-600">This registration was not enrolled in automated identity checks. Existing manual document review applies.</p>;
  const warnings = query.data.provider_review?.warnings ?? [];
  const selectedWarning = activeWarningIndex !== null ? warnings[activeWarningIndex] ?? null : null;
  return <section className="space-y-3 rounded-xl border bg-slate-50 p-3 text-sm">
    <h3 className="font-bold">Supporting identity evidence</h3>
    <p>{identityMessage(latest)}</p>
    <IdentityChecks attempt={latest} />
    {canAssess && warnings.length > 0 ? (
      <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0d1113] p-4 text-slate-100 shadow-lg space-y-3.5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-6 flex size-28 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500/30"
        >
          <Check className="size-16 stroke-[3]" />
        </div>

        <div className="relative z-10 space-y-2.5">
          <h4 className="text-base font-extrabold tracking-tight text-white">Warnings</h4>
          {warnings.map((warning, idx) => {
            const isSelected = activeWarningIndex === idx;
            return (
              <div key={`${warning.risk}-${idx}`} className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {warning.feature || "ID VERIFICATION"}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveWarningIndex(isSelected ? null : idx)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                    isSelected
                      ? "border-white/25 bg-white/[0.12] text-white"
                      : "border-white/15 bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]"
                  }`}
                >
                  <span>{warning.tag_label}</span>
                  <AlertCircle className="size-3.5 shrink-0 text-slate-300" />
                </button>
              </div>
            );
          })}
        </div>

        {selectedWarning ? (
          <div className="relative z-10 space-y-3 rounded-xl border border-white/15 bg-[#15191d] p-3.5 sm:p-4 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="size-4 shrink-0 text-slate-300" />
                <p className="text-xs sm:text-sm font-bold text-white">
                  {selectedWarning.short_description}
                </p>
              </div>
              <span className="shrink-0 rounded-md border border-white/15 bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                {selectedWarning.feature || "ID VERIFICATION"}
              </span>
            </div>

            {selectedWarning.long_description ? (
              <p className="text-xs leading-relaxed text-slate-400">
                {selectedWarning.long_description}
              </p>
            ) : null}

            {selectedWarning.duplicated_sessions.length > 0 ? (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-300">
                  <UserCircle2 className="size-3.5 text-slate-400" />
                  <span>SESSION INFORMATION</span>
                </div>

                <div className="space-y-2">
                  {selectedWarning.duplicated_sessions.map((dup, dupIdx) => {
                    const canJump = Boolean(dup.user_id && onSelectUserId && dup.user_id !== userId);
                    const isReview = dup.status.includes("REVIEW") || dup.status.includes("PENDING");
                    const isApproved = dup.status.includes("APPROVED") || dup.status.includes("COMPLETED");
                    const badgeClasses = isReview
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                      : isApproved
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                        : "border-slate-500/40 bg-slate-500/15 text-slate-300";

                    const content = (
                      <>
                        <div className="flex min-w-0 items-center gap-3">
                          {dup.portrait_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={dup.portrait_url}
                              alt={dup.full_name}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              className="size-11 shrink-0 rounded-lg border border-white/15 object-cover bg-slate-800"
                            />
                          ) : (
                            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-slate-800 text-slate-300">
                              <UserCircle2 className="size-6" />
                            </div>
                          )}

                          <div className="min-w-0 space-y-1">
                            <p className="text-xs sm:text-sm font-bold text-sky-400 truncate">
                              Duplicate session #{dup.session_number ?? dupIdx + 1}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${badgeClasses}`}
                              >
                                <AlertCircle className="size-3 shrink-0" />
                                <span>{dup.status}</span>
                              </span>
                              <span className="truncate text-xs font-medium text-slate-300">
                                {dup.full_name}
                              </span>
                            </div>
                          </div>
                        </div>

                        <Link2 className="size-4 shrink-0 text-slate-400" />
                      </>
                    );

                    return canJump ? (
                      <button
                        key={dup.session_id || `${dup.user_id}-${dupIdx}`}
                        type="button"
                        onClick={() => onSelectUserId?.(dup.user_id!)}
                        title={`Inspect ${dup.full_name}'s registration profile`}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0f1317] p-3 text-left transition-colors hover:border-sky-400/40 hover:bg-[#141a20] cursor-pointer"
                      >
                        {content}
                      </button>
                    ) : (
                      <div
                        key={dup.session_id || `${dup.user_id}-${dupIdx}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0f1317] p-3"
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    ) : null}
    {canAssess && query.data.provider_review?.name_comparison ? <section className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <h4 className="font-semibold">Name read from the ID</h4>
      <dl className="grid gap-2 sm:grid-cols-2">
        <div><dt className="text-xs text-slate-600">Registration information</dt><dd className="font-medium">{query.data.provider_review.name_comparison.provided_name || "Not provided"}</dd></div>
        <div><dt className="text-xs text-slate-600">Extracted from ID</dt><dd className="font-medium">{query.data.provider_review.name_comparison.extracted_name || "Not available"}</dd></div>
      </dl>
      {query.data.provider_review.name_comparison.provider_warning ? <p className="font-medium text-amber-900">Didit warning: {query.data.provider_review.name_comparison.provider_warning}</p> : null}
      {query.data.provider_review.name_comparison.match_type ? <p>Didit match type: {query.data.provider_review.name_comparison.match_type.replaceAll("_", " ")}</p> : null}
      {query.data.provider_review.name_comparison.name_match_score !== null ? <p>Didit name match score: {query.data.provider_review.name_comparison.name_match_score}/100</p> : null}
      <p className="text-xs text-slate-700">Compare spelling and name order with the ID. A mismatch needs human review; it does not automatically reject the registration.</p>
    </section> : null}
    {canAssess && query.data.provider_review?.images.length ? <section className="space-y-2">
      <h4 className="font-semibold">ID and selfie captured by Didit</h4>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {query.data.provider_review.images.map((image) => <figure key={image.label} className="space-y-1 rounded-lg border bg-white p-2">
          {/* Didit supplies short-lived signed URLs; use native img to avoid persisting or optimizing biometric media. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt={image.label} loading="lazy" referrerPolicy="no-referrer" className="h-48 w-full rounded object-contain" />
          <figcaption className="text-center text-xs font-medium">{image.label}</figcaption>
        </figure>)}
      </div>
      <p className="text-xs text-slate-600">These temporary Didit images are shown to MAO/Admin for this review and are not saved by SmartLivestock.</p>
    </section> : null}
    {canAssess && query.data.provider_review && !query.data.provider_review.images.length ? <p className="text-xs text-slate-600">No Didit capture images are available for this attempt yet. Use the uploaded registration ID for manual inspection.</p> : null}
    {canAssess && query.data.provider_review_error ? <p role="status" className="text-xs text-amber-800">{query.data.provider_review_error}</p> : null}
    {latest.document_capture === "DIDIT_HOSTED" ? <div className="space-y-2 text-xs">
      <p>The ID was submitted through Didit. These provider results and images support human review and do not establish legal identity. If images are unavailable, arrange alternative ID inspection before approval.</p>
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
