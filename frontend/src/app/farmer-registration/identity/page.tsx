"use client";

import axios from "axios";
import { useEffect, useState, useId } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Check,
  ExternalLink,
  Icon,
  Loader2,
  MapPin,
  Radio,
  RefreshCw,
  Scan,
  Shield,
  ShieldCheck,
  User,
} from "lucide-react";
import { cowHead } from "@lucide/lab";
import { Button } from "@/components/ui/button";
import { IdentityChecks } from "@/components/identity-evidence";
import { establishDocumentRevisionSession } from "@/lib/registration-documents";
import {
  IDENTITY_TOKEN_KEY,
  identityClient,
  identityError,
  identityMessage,
  isDiditBillingLimit,
  isManualReviewAvailable,
  providerCaptureUrl,
  type IdentityAttempt,
  type IdentityConfig,
} from "@/lib/identity-verification";

const STEPS_LIST = [
  {
    num: 1,
    phase: "01",
    title: "Step 1: Personal Credentials",
    short: "Credentials",
    sub: "Enter your name and secure account details",
    icon: User,
  },
  {
    num: 2,
    phase: "02",
    title: "Step 2: Farm Location & Size",
    short: "Farm Details",
    sub: "Record your livestock holding parcel in Padre Garcia",
    icon: MapPin,
  },
  {
    num: 3,
    phase: "03",
    title: "Step 3: Verification Documents & Agreement",
    short: "Documents",
    sub: "Attach verification IDs and consent under RA 10173",
    icon: Shield,
  },
  {
    num: 4,
    phase: "04",
    title: "Step 4: ID & Selfie Verification",
    short: "ID & Selfie",
    sub: "Complete Didit capture before finishing registration",
    icon: Scan,
  },
] as const;

function registrationRecoveryError(error: unknown): string {
  if (!axios.isAxiosError(error)) return "Could not restore the registration session. Please try again.";
  const status = error.response?.status;
  const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
  if (status === 401) return "That email and password were not accepted. Check the credentials used when registering.";
  if (status === 404) return "This backend does not have the registration recovery endpoint yet. Deploy the latest backend, then try again.";
  if (status === 409 && typeof detail === "string") return detail;
  if (status === 400 && typeof detail === "string") return detail;
  if (!error.response) return "Could not reach the backend. Check your connection and try again.";
  return "Could not restore the registration session. Please try again or contact MAO for assistance.";
}

export default function RegistrationIdentityPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [manualReview, setManualReview] = useState(false);
  const [billingFallback, setBillingFallback] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [providerResultNotice, setProviderResultNotice] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [sessionVersion, setSessionVersion] = useState(0);
  const [recoveryError, setRecoveryError] = useState("");
  const pageId = useId();
  // Restore the browser-owned capability; it is not a portal login token.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      setToken(sessionStorage.getItem(IDENTITY_TOKEN_KEY));
    } catch {
      setError("This browser cannot restore the registration session. Contact MAO for assistance.");
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const config = useQuery({
    queryKey: ["identity-config"],
    queryFn: async () => (await identityClient().get<IdentityConfig>("/api/users/identity/config/")).data,
  });

  const status = useQuery({
    queryKey: ["registration-identity-status", pageId, Boolean(token), sessionVersion],
    enabled: Boolean(token),
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.data?.attempt?.state === "IN_PROGRESS" ? 3000 : false),
    queryFn: async () =>
      (await identityClient(token!).get<{ attempt: IdentityAttempt | null }>("/api/users/identity/status/")).data,
  });

  const recoverSession = useMutation({
    mutationFn: async () => {
      const data = await establishDocumentRevisionSession(recoveryEmail, recoveryPassword);
      if (!data.access_token) throw new Error("The server did not return a registration session.");
      return data.access_token;
    },
    onSuccess: (newToken) => {
      setRecoveryPassword("");
      setRecoveryError("");
      setError("");
      setToken(newToken);
      setSessionVersion((version) => version + 1);
    },
    onError: (failure) => setRecoveryError(registrationRecoveryError(failure)),
  });

  const start = useMutation({
    mutationFn: async (retry: boolean) =>
      (
        await identityClient(token!).post<{ url?: string }>("/api/users/identity/start/", {
          consent,
          policy_version: config.data?.policy_version,
          retry,
        })
      ).data,
    onSuccess: (data) => {
      setProviderResultNotice("");
      if (data.url) {
        try {
          window.location.assign(providerCaptureUrl(data.url));
        } catch {
          setError("The verification destination is unavailable. Contact MAO for assistance.");
        }
      } else {
        void status.refetch();
      }
    },
    onError: (failure) => {
      const billingLimit = isDiditBillingLimit(failure);
      const manualReviewAvailable = isManualReviewAvailable(failure);
      setBillingFallback(billingLimit);
      setManualReview(manualReviewAvailable);
      setError(identityError(failure));
      void status.refetch();
    },
  });

  const refresh = useMutation({
    mutationFn: async () =>
      (await identityClient(token!).post<{ attempt: IdentityAttempt }>("/api/users/identity/refresh/", {})).data,
    onSuccess: ({ attempt: refreshedAttempt }) => {
      setError("");
      setProviderResultNotice(
        [refreshedAttempt.document_result, refreshedAttempt.face_result, refreshedAttempt.liveness_result]
          .every((result) => result === "NOT_COMPLETED")
          ? "No provider result is available yet. Complete the ID and selfie steps with Didit, then check again."
          : "",
      );
      void status.refetch();
    },
    onError: (failure) => {
      setProviderResultNotice("");
      setError(identityError(failure));
    },
  });

  const attempt = status.data?.attempt ?? null;
  const identityUnauthorized = axios.isAxiosError(status.error) && status.error.response?.status === 401;
  const registrationSessionInvalid = !token || identityUnauthorized;
  // Restore consent for the same attempt only when its recorded policy is still current.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (attempt?.consent_at && config.data?.policy_version === attempt.policy_version) {
      setConsent(true);
    }
  }, [attempt?.consent_at, attempt?.policy_version, config.data?.policy_version]);
  /* eslint-enable react-hooks/set-state-in-effect */
  // Didit's In Review (and other inconclusive results) requires a human decision.
  // A completed provider check also remains pending until MAO approves the account.
  // Send the farmer to the SmartLivestock pending page after either result is recorded.
  useEffect(() => {
    if (token && status.isSuccess && attempt && ["COMPLETED", "REVIEW_REQUIRED"].includes(attempt.state)) {
      router.replace("/pending");
    }
  }, [attempt, router, status.isSuccess, token]);

  const resultReady = Boolean(attempt && ["COMPLETED", "REVIEW_REQUIRED"].includes(attempt.state));
  const finish = useMutation({
    mutationFn: async () => {
      if (manualReview && !resultReady) await identityClient(token!).post("/api/users/identity/assistance/", {});
    },
    onSuccess: () => router.push("/pending"),
    onError: (failure) => setError(identityError(failure)),
  });

  const retry = Boolean(attempt && ["FAILED_TECHNICAL", "RETRY_REQUIRED"].includes(attempt.state));
  const canFinish = Boolean(
    token &&
      !status.isError &&
      !status.isPending &&
      !start.isPending &&
      !refresh.isPending &&
      (resultReady || manualReview),
  );

  return (
    <div className="min-h-screen bg-[#051408] text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-slate-950 relative overflow-x-hidden">
      {/* ── Background Tech Mesh & Luminous Orbs ── */}
      <div
        aria-hidden
        className="fixed inset-0 bg-[radial-gradient(rgba(16,185,129,0.12)_1px,transparent_1px)] [background-size:28px_28px] pointer-events-none [mask-image:radial-gradient(ellipse_80%_60%_at_50%_40%,#000_40%,transparent_100%)] opacity-80"
      />
      <div
        aria-hidden
        className="fixed -top-40 -left-40 size-[36rem] rounded-full bg-emerald-500/15 blur-[120px] pointer-events-none animate-pulse"
      />
      <div
        aria-hidden
        className="fixed -bottom-40 -right-40 size-[36rem] rounded-full bg-teal-500/12 blur-[120px] pointer-events-none"
      />
      <div
        aria-hidden
        className="fixed top-1/3 left-1/2 -translate-x-1/2 size-[42rem] rounded-full bg-emerald-600/10 blur-[150px] pointer-events-none"
      />

      {/* ── Top Floating Navigation Header ── */}
      <header className="border-b border-emerald-500/15 bg-black/40 backdrop-blur-xl px-4 sm:px-8 py-3.5 sticky top-0 z-50">
        <div className="w-full flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="size-9 sm:size-10 shrink-0 rounded-2xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-700 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-emerald-500/25 border border-emerald-300/30">
              <Icon iconNode={cowHead} className="size-5 text-slate-950" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-sm sm:text-base font-black tracking-tight text-white truncate">
                  SmartLivestock
                </span>
                <span className="shrink-0 whitespace-nowrap font-mono text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                  AGRI-ID
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/70 font-medium hidden sm:block">
                Padre Garcia Municipal Agriculture Office • Livestock Raiser Terminal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-300 font-bold tracking-wider">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full size-2 bg-emerald-400"></span>
              </span>
              LGU NETWORK // ONLINE
            </span>

            <Link
              href="/login"
              className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-white/10 hover:border-emerald-500/40 bg-white/[0.04] hover:bg-emerald-500/10 transition-all shadow-xs"
            >
              <ArrowLeft className="size-3.5 shrink-0" />
              <span>Sign In</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Two-Column Viewport Container ── */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex-1 flex flex-col justify-center relative z-10">
        <div className="lg:grid lg:grid-cols-12 gap-8 xl:gap-12 items-start">
          {/* ═════════════════════════════════════════════════════════════
              LEFT COLUMN: COMMAND & TELEMETRY TERMINAL (Desktop Sticky)
             ═════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 hidden lg:block sticky top-24 space-y-6">
            {/* Holographic Authority Card */}
            <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-2xl p-7 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono font-bold tracking-wider">
                <Radio className="size-3 text-emerald-400 animate-pulse" />
                OFFICIAL MUNICIPAL PORTAL
              </div>

              <p className="text-2xl xl:text-3xl font-black tracking-tight leading-tight mt-3 bg-gradient-to-r from-emerald-100 via-teal-100 to-white bg-clip-text text-transparent">
                Farmer Registration
              </p>

              <p className="text-xs text-slate-300 leading-relaxed mt-2.5 font-normal">
                Create an accredited raiser account with the Municipal Agriculture Office.
              </p>

              {/* Step Navigator */}
              <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
                <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold">
                  REGISTRATION STEPS
                </p>

                <div className="space-y-2.5">
                  {STEPS_LIST.map((item) => {
                    const IconComponent = item.icon;
                    const isCompleted = item.num < 4;
                    const isCurrent = item.num === 4;

                    return (
                      <div
                        key={item.num}
                        className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          isCurrent
                            ? "border-emerald-400/50 bg-emerald-500/15 text-white shadow-lg shadow-emerald-950/40"
                            : "border-emerald-500/20 bg-white/[0.04] text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`size-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                              isCompleted
                                ? "bg-[#1A3D22] text-emerald-300 border border-emerald-500/40"
                                : "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/40"
                            }`}
                          >
                            {isCompleted ? <Check className="size-4 stroke-[3]" /> : <IconComponent className="size-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">
                              <span className="font-mono text-[10px] text-emerald-400/90 mr-1.5">
                                {item.phase} //
                              </span>
                              {item.title}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{item.sub}</p>
                          </div>
                        </div>

                        <span
                          className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            isCompleted
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-emerald-400 text-slate-950 font-black"
                          }`}
                        >
                          {isCompleted ? "DONE" : "ACTIVE"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Network Grid Diagnostics */}
              <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="font-mono text-sm font-black text-emerald-400">17 / 17</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Barangays</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="font-mono text-sm font-black text-teal-400">DA-BAI</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Compliant</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="font-mono text-sm font-black text-emerald-400">256-BIT</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Encrypted</p>
                </div>
              </div>
            </div>

            {/* Municipal Security Stamp */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-[11px] text-slate-400 flex items-center gap-3">
              <ShieldCheck className="size-5 text-emerald-400 shrink-0" />
              <span>
                Accredited under the Padre Garcia Municipal Agriculture Office Livestock Framework & Republic Act
                10173.
              </span>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════
              RIGHT COLUMN: REGISTRATION TERMINAL CARD (Desktop & Mobile)
             ═════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7 w-full max-w-2xl mx-auto lg:max-w-none">
            <div className="rounded-[2rem] border border-emerald-500/25 bg-white text-slate-900 shadow-2xl shadow-black/40 overflow-hidden relative">
              {/* Glowing Top Progress Line (Step 4 of 4 = 100%) */}
              <div className="h-1.5 w-full bg-slate-100 relative overflow-hidden">
                <div
                  className="h-full w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 transition-all duration-500 shadow-sm shadow-emerald-500/50"
                />
              </div>

              {/* Stepper Bar (matches Step 1-3 circular stepper on mobile & accessible nav) */}
              <nav
                aria-label="Registration progress"
                className="lg:hidden px-3 sm:px-6 py-4 bg-slate-50/80 border-b border-slate-100"
              >
                <div className="flex items-start justify-between relative">
                  {STEPS_LIST.map((item, idx) => {
                    const isCompleted = item.num < 4;
                    const isCurrent = item.num === 4;
                    const isLast = idx === STEPS_LIST.length - 1;

                    return (
                      <div
                        key={item.num}
                        aria-current={isCurrent ? "step" : undefined}
                        className="flex-1 flex flex-col items-center relative min-w-0"
                      >
                        {!isLast && (
                          <div
                            aria-hidden
                            className="absolute top-4 left-1/2 w-full h-0.5 bg-emerald-500 transition-colors duration-300"
                          />
                        )}

                        <div className="relative z-10 flex flex-col items-center gap-1.5 w-full px-1">
                          <span
                            className={`size-8 rounded-full flex items-center justify-center font-mono text-xs font-black transition-all border ${
                              isCurrent
                                ? "bg-[#2D5A27] text-white border-[#2D5A27] shadow-sm ring-4 ring-emerald-500/15"
                                : "bg-emerald-50 text-emerald-800 border-emerald-300"
                            }`}
                          >
                            {isCompleted ? <Check className="size-3.5 stroke-[3]" /> : item.phase}
                          </span>

                          <span
                            className={`text-[11px] leading-tight text-center whitespace-nowrap transition-colors ${
                              isCurrent ? "font-extrabold text-[#2D5A27]" : "font-bold text-emerald-800"
                            }`}
                          >
                            {item.short}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </nav>

              {/* Terminal Step Header Banner */}
              <div className="p-5 sm:p-7 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                      Step 4 of 4
                    </span>
                    <span className="text-xs font-semibold text-slate-500">ID & Selfie</span>
                  </div>
                  <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-1.5">
                    Step 4: ID and selfie verification
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Your details and documents have been saved as one pending application. Complete the Didit capture
                    below before finishing registration, or explicitly request manual assistance. These checks support
                    human review and never approve or reject your account automatically.
                  </p>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 sm:p-8 space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
                {config.isPending || (token && status.isPending) ? (
                  <p
                    role="status"
                    className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold text-slate-600"
                  >
                    <Loader2 className="size-4 animate-spin text-[#2D5A27] shrink-0" />
                    <span>Loading verification information…</span>
                  </p>
                ) : null}

                {config.isError || status.isError ? (
                  <p
                    role="alert"
                    className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs font-semibold text-rose-800"
                  >
                    <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{identityError(config.error || status.error)}</span>
                  </p>
                ) : null}

                {registrationSessionInvalid ? (
                  <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
                    <div>
                      <h2 className="font-black">Resume your saved registration</h2>
                      <p className="mt-1 leading-relaxed">
                        Your registration and any Didit attempt are saved. Enter the email and password you registered
                        with to restore access. This will not create another account.
                      </p>
                    </div>
                    <form
                      className="grid gap-3 sm:grid-cols-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        setRecoveryError("");
                        recoverSession.mutate();
                      }}
                    >
                      <label className="grid gap-1 font-semibold">
                        Registered email
                        <input
                          type="email"
                          autoComplete="email"
                          required
                          value={recoveryEmail}
                          onChange={(event) => setRecoveryEmail(event.target.value)}
                          className="h-10 rounded-lg border border-amber-300 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-700/30"
                        />
                      </label>
                      <label className="grid gap-1 font-semibold">
                        Password
                        <input
                          type="password"
                          autoComplete="current-password"
                          required
                          value={recoveryPassword}
                          onChange={(event) => setRecoveryPassword(event.target.value)}
                          className="h-10 rounded-lg border border-amber-300 bg-white px-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-700/30"
                        />
                      </label>
                      {recoveryError ? <p role="alert" className="sm:col-span-2 text-rose-700">{recoveryError}</p> : null}
                      <Button
                        type="submit"
                        disabled={recoverSession.isPending}
                        className="min-h-10 bg-[#2D5A27] font-bold text-white sm:col-span-2"
                      >
                        {recoverSession.isPending ? "Restoring registration…" : "Resume saved registration"}
                      </Button>
                    </form>
                  </section>
                ) : null}

                {config.data && !config.data.enabled ? (
                  <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-900 leading-relaxed">
                    Automated checks are not enabled. The existing MAO document-review process remains required.
                  </p>
                ) : null}

                {config.data?.enabled && !config.data.available ? (
                  <p
                    role="status"
                    className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-900 leading-relaxed"
                  >
                    The provider is not configured for use. No face match or liveness result is available. Ask MAO for
                    manual assistance.
                  </p>
                ) : null}

                {/* Verification Telemetry & Status Summary */}
                <div className="space-y-3">
                  <IdentityChecks attempt={attempt} />
                  <p
                    role="status"
                    className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-4 text-xs font-semibold text-slate-800 leading-relaxed"
                  >
                    {identityMessage(attempt)}
                  </p>
                </div>

                {/* Didit Capture Section */}
                {config.data?.available && token && !registrationSessionInvalid ? (
                  <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-[#2D5A27]">
                        <Scan className="size-4.5" />
                      </span>
                      <div>
                        <h2 className="text-sm font-black text-slate-900">ID and selfie capture with Didit</h2>
                        <p className="text-[11px] font-medium text-slate-500">
                          Automated government ID, portrait face match & passive liveness check
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                      <p>
                        Didit will ask you to capture your government ID and take a selfie to compare with its
                        portrait. The provider performs a separate passive liveness check to help detect spoofing. A
                        selfie alone does not establish liveness or legal identity.
                      </p>
                      <p>
                        Capture takes place on Didit’s secure page. Allow camera access only when ready. Use even
                        lighting, keep your face unobstructed, and hold the ID upright with every edge visible. You can
                        retake captures there before submission.
                      </p>
                      <p>
                        If camera access is denied, enable it in browser settings and resume. If no face is detected or
                        liveness is incomplete, retake the capture with better lighting. If the device is unsupported
                        or unavailable, try another device or contact MAO. Use a file fallback only if Didit offers it;
                        a photo upload by itself does not complete liveness.
                      </p>
                    </div>

                    {/* Biometric Privacy & Retention Notice Box (Matches Step 3 RA 10173 Card) */}
                    <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200/90 space-y-2.5 text-xs text-slate-700 leading-relaxed">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 sm:gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <Shield className="size-4 text-[#2D5A27] shrink-0 mt-0.5" />
                          <span className="text-[11px] font-black uppercase tracking-wider text-[#2D5A27] leading-snug">
                            Biometric Processing & Privacy Notice
                          </span>
                        </div>
                        <a
                          href="https://didit.me/terms/privacy-policy/"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-black text-[#2D5A27] underline hover:text-emerald-900 shrink-0 pl-6 sm:pl-0"
                        >
                          <span>Didit privacy policy</span>
                          <ExternalLink className="size-3 shrink-0" />
                        </a>
                      </div>

                      <p className="text-[11px] text-slate-600 font-medium">
                        Didit processes ID images, selfie images and biometric check results, potentially outside the
                        Philippines. SmartLivestock keeps minimal verification metadata, not Didit ID images, selfie
                        frames, face templates or raw provider responses. Any separately submitted documents remain
                        private. Authorized barangay reviewers and MAO can inspect supporting summaries; authorized
                        Didit-console reviewers can inspect provider-held images. MAO retains the approval decision.
                      </p>
                      <p className="text-[11px] text-slate-600">{config.data.retention_notice}</p>
                      <p className="text-[11px] font-semibold text-slate-700">
                        Assistance and privacy concerns: {config.data.privacy_contact}
                      </p>

                      <label className="flex items-start gap-3 pt-2.5 border-t border-emerald-200/60 text-xs font-bold text-slate-800 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={consent}
                          onChange={(event) => setConsent(event.target.checked)}
                          className="mt-0.5 size-4.5 shrink-0 rounded border-emerald-600 accent-[#2D5A27]"
                        />
                        <span className="leading-relaxed">
                          I have read this notice and consent to Didit processing my ID, selfie, face comparison and
                          liveness checks for this registration. I understand that inconclusive or unavailable checks
                          require human assessment.
                        </span>
                      </label>
                    </div>

                    <div className="flex flex-col gap-2.5 sm:flex-row">
                      <Button
                        disabled={!consent || start.isPending || attempt?.state === "COMPLETED"}
                        onClick={() => {
                          setError("");
                          setProviderResultNotice("");
                          setBillingFallback(false);
                          setManualReview(false);
                          start.mutate(retry);
                        }}
                        className="w-full sm:flex-1 min-h-12 h-auto py-3 px-4 whitespace-normal bg-[#2D5A27] hover:bg-[#23471f] text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-green-900/20 flex items-center justify-center gap-2 text-center leading-tight cursor-pointer"
                      >
                        <Scan className="size-4 shrink-0" />
                        <span>
                          {start.isPending
                            ? "Starting…"
                            : retry
                              ? "Retry ID and selfie capture"
                              : attempt?.state === "IN_PROGRESS"
                                ? "Resume / retake capture"
                                : "Continue to ID and selfie capture"}
                        </span>
                      </Button>
                      <Button
                        variant="outline"
                        disabled={!attempt?.provider_reference || refresh.isPending || start.isPending}
                        onClick={() => refresh.mutate()}
                        className="w-full sm:w-auto min-h-12 h-auto py-3 px-4 border-slate-200 text-slate-700 font-bold rounded-2xl text-xs uppercase cursor-pointer hover:bg-slate-100 flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className={`size-3.5 shrink-0 ${refresh.isPending ? "animate-spin" : ""}`} />
                        <span>{refresh.isPending ? "Checking…" : "Check provider result"}</span>
                      </Button>
                    </div>
                    {!attempt?.provider_reference ? (
                      <p role="status" className="text-xs leading-relaxed text-slate-500">
                        No provider result is available yet. Start or resume the Didit ID and selfie steps first.
                      </p>
                    ) : providerResultNotice ? (
                      <p role="status" className="text-xs leading-relaxed text-amber-800">
                        {providerResultNotice}
                      </p>
                    ) : null}
                  </section>
                ) : null}

                {error ? (
                  <p
                    role="alert"
                    className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs font-semibold text-rose-800"
                  >
                    <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </p>
                ) : null}

                {/* Completion / Manual Assistance Fallback Section */}
                {token && !registrationSessionInvalid && (
                  <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                    {!resultReady && (
                      <label className="flex items-start gap-3 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4.5 shrink-0 rounded border-slate-300 accent-[#2D5A27]"
                          checked={manualReview}
                          onChange={(event) => setManualReview(event.target.checked)}
                        />
                        <span className="leading-relaxed">
                          {billingFallback
                            ? "Didit could not start because of its billing or credit limit. I want MAO to review my existing registration documents manually. My application remains pending; no ID, face-match, or liveness check is marked as passed."
                            : "I cannot complete automated capture and need MAO assistance. I understand my application remains pending and requires a documented human assessment; this does not mark ID, face matching or liveness as passed."}
                        </span>
                      </label>
                    )}

                    <Button
                      disabled={!canFinish || finish.isPending}
                      onClick={() => finish.mutate()}
                      className="min-h-12 h-auto py-3.5 px-4 w-full whitespace-normal bg-[#2D5A27] text-white hover:bg-[#23471f] font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl shadow-green-900/25 flex items-center justify-center gap-2 text-center leading-tight cursor-pointer disabled:opacity-70"
                    >
                      <BadgeCheck className="size-4.5 shrink-0" />
                      <span>
                        {finish.isPending
                          ? "Saving request..."
                          : resultReady
                            ? "Complete Registration"
                            : billingFallback
                              ? "Continue with MAO manual review"
                              : "Complete Registration — Request Manual Review"}
                      </span>
                    </Button>

                    <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                      MAO must review your documents and the current evidence before approving your account. No second
                      account is created.
                    </p>
                  </section>
                )}

                {!token && (
                  <div className="pt-1">
                    <Link
                      href="/pending"
                      className="inline-flex items-center justify-center w-full min-h-12 px-4 py-3 rounded-2xl bg-[#2D5A27] hover:bg-[#23471f] text-white text-xs font-black uppercase tracking-wider transition-colors"
                    >
                      View pending registration
                    </Link>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="bg-slate-50/80 p-4 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-500 font-medium">
                  Already registered?{" "}
                  <Link href="/login" className="text-[#2D5A27] font-black hover:underline">
                    Log In
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="mt-8 border-t border-emerald-500/10 bg-black/30 backdrop-blur-md py-4 text-center text-xs text-slate-400 font-medium relative z-10 space-y-1">
        <p>© {new Date().getFullYear()} Municipal Agriculture Office (MAO) • Padre Garcia, Batangas</p>
        <p className="text-[11px] text-slate-400/80">Cattle & Livestock Information System</p>
      </footer>
    </div>
  );
}
