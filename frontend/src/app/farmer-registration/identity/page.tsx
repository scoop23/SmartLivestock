"use client";

import { useEffect, useState, useId } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { IdentityChecks } from "@/components/identity-evidence";
import {
  IDENTITY_TOKEN_KEY, identityClient, identityError, identityMessage, providerCaptureUrl,
  type IdentityAttempt, type IdentityConfig,
} from "@/lib/identity-verification";

export default function RegistrationIdentityPage() {
  const [token, setToken] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const pageId = useId();
  // Restore the browser-owned capability; it is not a portal login token.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try { setToken(sessionStorage.getItem(IDENTITY_TOKEN_KEY)); }
    catch { setError("This browser cannot restore the registration session. Contact MAO for assistance."); }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const config = useQuery({ queryKey: ["identity-config"], queryFn: async () =>
    (await identityClient().get<IdentityConfig>("/api/users/identity/config/")).data });
  const status = useQuery({ queryKey: ["registration-identity-status", pageId, Boolean(token)], enabled: Boolean(token),
    retry: false, gcTime: 0,
    queryFn: async () => (await identityClient(token!).get<{ attempt: IdentityAttempt | null }>("/api/users/identity/status/")).data });
  const start = useMutation({
    mutationFn: async (retry: boolean) => (await identityClient(token!).post<{ url?: string }>("/api/users/identity/start/", {
      consent, policy_version: config.data?.policy_version, retry,
    })).data,
    onSuccess: (data) => {
      if (data.url) {
        try { window.location.assign(providerCaptureUrl(data.url)); }
        catch { setError("The verification destination is unavailable. Contact MAO for assistance."); }
      } else void status.refetch();
    },
    onError: (failure) => { setError(identityError(failure)); void status.refetch(); },
  });
  const refresh = useMutation({
    mutationFn: () => identityClient(token!).post("/api/users/identity/refresh/", {}),
    onSuccess: () => { setError(""); void status.refetch(); },
    onError: (failure) => setError(identityError(failure)),
  });
  const attempt = status.data?.attempt ?? null;
  const retry = Boolean(attempt && ["FAILED_TECHNICAL", "RETRY_REQUIRED", "REVIEW_REQUIRED"].includes(attempt.state));

  return <main className="mx-auto min-h-screen w-full max-w-xl space-y-5 px-4 py-8 text-slate-900">
    <h1 className="text-2xl font-bold">Registration identity checks</h1>
    <p className="text-sm">Your registration has been saved. These checks support human review and never approve or reject your account automatically.</p>
    {config.isPending || (token && status.isPending) ? <p role="status">Loading verification information…</p> : null}
    {config.isError || status.isError ? <p role="alert" className="text-sm text-rose-700">{identityError(config.error || status.error)}</p> : null}
    {!token ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm">No active registration session was found. Contact MAO for assistance. Do not register a second account.</p> : null}
    {config.data && !config.data.enabled ? <p className="rounded-xl bg-amber-50 p-4 text-sm">Automated checks are not enabled. The existing MAO document-review process remains required.</p> : null}
    {config.data?.enabled && !config.data.available ? <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm">The provider is not configured for use. No face match or liveness result is available. Ask MAO for manual assistance.</p> : null}
    <IdentityChecks attempt={attempt} />
    <p role="status" className="rounded-xl border p-4 text-sm">{identityMessage(attempt)}</p>
    {config.data?.available && token ? <section className="space-y-4 rounded-2xl border bg-white p-4">
      <h2 className="font-bold">ID and selfie capture with Didit</h2>
      <p className="text-sm">Didit will ask you to present the same government ID and take a selfie to compare with its portrait. The provider performs a separate passive liveness check to help detect spoofing. A selfie alone does not establish liveness or legal identity.</p>
      <p className="text-sm">Capture takes place on Didit’s secure page. Allow camera access only when ready. Use even lighting, keep your face unobstructed, and hold the ID upright with every edge visible. You can retake captures there before submission.</p>
      <p className="text-sm">If camera access is denied, enable it in browser settings and resume. If no face is detected or liveness is incomplete, retake the capture with better lighting. If the device is unsupported or unavailable, try another device or contact MAO. Use a file fallback only if Didit offers it; a photo upload by itself does not complete liveness.</p>
      <div className="space-y-2 text-sm">
        <p>Didit processes ID images, selfie images and biometric check results, potentially outside the Philippines. SmartLivestock keeps the existing private ID uploads and minimal verification metadata, not face templates, selfie frames or raw provider responses. Authorized barangay reviewers and MAO can inspect supporting evidence; MAO retains the approval decision.</p>
        <p>{config.data.retention_notice}</p>
        <p>Assistance and privacy concerns: {config.data.privacy_contact}</p>
        <a href="https://didit.me/terms/privacy-policy/" target="_blank" rel="noreferrer" className="underline">Didit privacy policy</a>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 size-5 shrink-0" />
        <span>I have read this notice and consent to Didit processing my ID, selfie, face comparison and liveness checks for this registration. I understand that inconclusive or unavailable checks require human assessment.</span>
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button disabled={!consent || start.isPending || attempt?.state === "COMPLETED"} onClick={() => { setError(""); start.mutate(retry); }} className="min-h-11 whitespace-normal">
          {start.isPending ? "Starting…" : retry ? "Retry ID and selfie capture" : attempt?.state === "IN_PROGRESS" ? "Resume / retake capture" : "Continue to ID and selfie capture"}
        </Button>
        <Button variant="outline" disabled={!attempt?.provider_reference || refresh.isPending || start.isPending} onClick={() => refresh.mutate()} className="min-h-11">
          {refresh.isPending ? "Checking…" : "Check provider result"}
        </Button>
      </div>
    </section> : null}
    {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
    <Link href="/pending" className="inline-block py-3 text-sm font-semibold underline">View pending registration</Link>
  </main>;
}
