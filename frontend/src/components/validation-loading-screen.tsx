"use client";

import {
  Activity,
  CheckCircle2,
  CloudOff,
  Database,
  FileSpreadsheet,
  Info,
  Loader2,
  Milk,
  ShieldCheck,
  Tag,
  WifiOff,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useOnlineStatus } from "@/hooks/use-browser-state";

export interface SyncStreamItem {
  id: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  loaded: boolean;
}

export interface ValidationLoadingScreenProps {
  title?: string;
  subtitle?: string;
  badgeLabel?: string;
  authorityText?: string;
  icon?: React.ReactNode;
  items?: SyncStreamItem[];
  // Convenience flags for the standard municipal data streams.
  censusLoaded?: boolean;
  productionLoaded?: boolean;
  inventoryLoaded?: boolean;
  incidentLoaded?: boolean;
  /** False starts the exit animation; the page keeps this component mounted until it finishes. */
  isLoading?: boolean;
  /** Role persona to theme the offline loading experience */
  role?: "FARMER" | "CBAT" | "SIBAT" | "MAO" | "ADMIN";
  /** Explicit override for offline mode (if omitted, automatically detects via navigator.onLine) */
  isOfflineMode?: boolean;
}

/** Hold the loading layer briefly so it can fade away after the data is ready. */
export function useLoadingScreenTransition(isLoading: boolean, exitDurationMs = 500) {
  const [isMounted, setIsMounted] = useState(isLoading);
  const [prevLoading, setPrevLoading] = useState(isLoading);

  if (isLoading && !prevLoading) {
    setPrevLoading(true);
    setIsMounted(true);
  } else if (!isLoading && prevLoading) {
    setPrevLoading(false);
  }

  useEffect(() => {
    if (isLoading || !isMounted) return;
    const timeout = window.setTimeout(() => setIsMounted(false), exitDurationMs);
    return () => window.clearTimeout(timeout);
  }, [isLoading, isMounted, exitDurationMs]);

  return isMounted;
}

export interface UseSeamlessLoadingOptions {
  /** How long the disappearing animation of the loading screen lasts before unmounting (ms). Default: 500ms */
  exitDurationMs?: number;
  /** Split-second pause after loading finishes before content appears (ms). Default: 200ms */
  contentDelayMs?: number;
}

export interface SeamlessLoadingState {
  /** True while the loading screen is either active or in its exit transition */
  keepLoadingScreenMounted: boolean;
  /** True after the split-second delay once loading completes, signaling content to appear */
  showContent: boolean;
  /** True when data has finished loading and the screen is playing its exit transition */
  isExiting: boolean;
}

/**
 * Orchestrates a seamless handoff between the loading screen and page content:
 * 1. While `isLoading` is true, only the loading screen is visible.
 * 2. When `isLoading` becomes false, the loading screen begins dissolving.
 * 3. After a split-second pause (`contentDelayMs`, default 200ms), `showContent` becomes true
 *    so the page content mounts and runs its entrance animation seamlessly under the dissolving overlay.
 * 4. Once `exitDurationMs` finishes (default 500ms), `keepLoadingScreenMounted` becomes false.
 */
export function useSeamlessLoadingState(
  isLoading: boolean,
  options: UseSeamlessLoadingOptions = {}
): SeamlessLoadingState {
  const { exitDurationMs = 500, contentDelayMs = 200 } = options;
  const keepLoadingScreenMounted = useLoadingScreenTransition(isLoading, exitDurationMs);
  const [showContent, setShowContent] = useState(!isLoading);
  const [prevLoading, setPrevLoading] = useState(isLoading);

  if (isLoading && !prevLoading) {
    setPrevLoading(true);
    setShowContent(false);
  } else if (!isLoading && prevLoading) {
    setPrevLoading(false);
  }

  useEffect(() => {
    if (isLoading) return;

    // After loading completes, wait a split second before showing content
    const timeout = window.setTimeout(() => {
      setShowContent(true);
    }, contentDelayMs);

    return () => window.clearTimeout(timeout);
  }, [isLoading, contentDelayMs]);

  return {
    keepLoadingScreenMounted,
    showContent,
    isExiting: keepLoadingScreenMounted && !isLoading,
  };
}

export function ValidationLoadingScreen({
  title = "Synchronizing Municipal Validation Ledger",
  subtitle = "Retrieving official barangay census records, farmer production yields, individual livestock passports, and health surveillance reports...",
  badgeLabel = "Secure Ledger Sync",
  authorityText = "Municipal Agriculture Office · Padre Garcia, Batangas",
  icon,
  items,
  censusLoaded = false,
  productionLoaded = false,
  inventoryLoaded = false,
  incidentLoaded = false,
  isLoading = true,
  role,
  isOfflineMode,
}: ValidationLoadingScreenProps) {
  const isOnline = useOnlineStatus();
  const isActuallyOffline = isOfflineMode !== undefined ? isOfflineMode : !isOnline;

  const isCbat =
    role === "CBAT" ||
    role === "SIBAT" ||
    Boolean(
      title?.toLowerCase().includes("sibat") ||
      title?.toLowerCase().includes("cbat") ||
      badgeLabel?.toLowerCase().includes("sibat") ||
      badgeLabel?.toLowerCase().includes("cbat") ||
      authorityText?.toLowerCase().includes("sibat") ||
      authorityText?.toLowerCase().includes("cbat")
    );

  const isFarmer =
    role === "FARMER" ||
    (!isCbat &&
      Boolean(
        title?.toLowerCase().includes("farmer") ||
        badgeLabel?.toLowerCase().includes("farmer") ||
        authorityText?.toLowerCase().includes("farmer")
      ));

  // Dynamic titles and subtitles when offline
  const displayTitle = useMemo(() => {
    if (!isActuallyOffline) return title;
    if (title === "Synchronizing Municipal Validation Ledger") {
      if (isCbat) return "Loading Pre-Cached CBAT Workspace";
      if (isFarmer) return "Loading Pre-Cached Farmer Records";
      return "Loading Offline PWA Cache";
    }
    if (/^Loading\s+/i.test(title)) {
      return title.replace(/^Loading\s+/i, "Loading Cached ");
    }
    if (/^Synchronizing\s+/i.test(title)) {
      return title.replace(/^Synchronizing\s+/i, "Loading Cached ");
    }
    return `Cached: ${title}`;
  }, [isActuallyOffline, title, isCbat, isFarmer]);

  const displaySubtitle = useMemo(() => {
    if (!isActuallyOffline) return subtitle;
    if (subtitle.includes("Retrieving official barangay census records")) {
      if (isCbat) {
        return "Your device is working offline in the field. Restoring cached barangay census surveys, livestock queues, and inspection records from device storage...";
      }
      if (isFarmer) {
        return "Your device is working offline on the farm. Restoring cached livestock tags, herds, milk/egg logs, and pending submissions from device storage...";
      }
      return "Your device is currently offline. Restoring cached municipal records and offline forms from browser storage...";
    }
    return subtitle;
  }, [isActuallyOffline, subtitle, isCbat, isFarmer]);

  const displayBadgeLabel = useMemo(() => {
    if (!isActuallyOffline) return badgeLabel;
    if (isCbat) return "CBAT Offline Field Cache";
    if (isFarmer) return "Farmer Offline PWA Cache";
    if (badgeLabel.toLowerCase().includes("offline")) return badgeLabel;
    return `${badgeLabel} (Offline Cache)`;
  }, [isActuallyOffline, badgeLabel, isCbat, isFarmer]);

  const streamItems: SyncStreamItem[] = useMemo(() => {
    if (items) {
      if (!isActuallyOffline) return items;
      return items.map((item) => ({
        ...item,
        sublabel: item.sublabel
          ? item.sublabel
              .replace(/connecting\s+/gi, "Restoring ")
              .replace(/retrieving\s+/gi, "Reading cached ")
              .replace(/checking\s+/gi, "Verifying local ")
          : "Pre-cached local records",
      }));
    }

    if (isActuallyOffline) {
      if (isCbat) {
        return [
          {
            id: "census",
            label: "Barangay Census Records",
            sublabel: "Cached household livestock surveys",
            icon: <FileSpreadsheet className="size-4" />,
            loaded: censusLoaded || !isLoading,
          },
          {
            id: "inventory",
            label: "Livestock Inspection Queue",
            sublabel: "Cached animal tags and herd rosters",
            icon: <Tag className="size-4" />,
            loaded: inventoryLoaded || !isLoading,
          },
          {
            id: "incidents",
            label: "Health & Biosecurity Reports",
            sublabel: "Surveillance declarations & mortality",
            icon: <Activity className="size-4" />,
            loaded: incidentLoaded || !isLoading,
          },
          {
            id: "outbox",
            label: "CBAT Offline Outbox Engine",
            sublabel: "Local indexed database & sync queue",
            icon: <Database className="size-4" />,
            loaded: true,
          },
        ];
      }

      if (isFarmer) {
        return [
          {
            id: "inventory",
            label: "Livestock Inventory & Herds",
            sublabel: "Cached animal tags and herd pens",
            icon: <Tag className="size-4" />,
            loaded: inventoryLoaded || !isLoading,
          },
          {
            id: "production",
            label: "Production Logs & Calving",
            sublabel: "Milk, eggs, and breeding history",
            icon: <Milk className="size-4" />,
            loaded: productionLoaded || !isLoading,
          },
          {
            id: "incidents",
            label: "Field Health Declarations",
            sublabel: "Local disease reports & mortality",
            icon: <Activity className="size-4" />,
            loaded: incidentLoaded || !isLoading,
          },
          {
            id: "outbox",
            label: "Farmer Offline Outbox Engine",
            sublabel: "Pending records sync to MAO on reconnect",
            icon: <Database className="size-4" />,
            loaded: true,
          },
        ];
      }
    }

    // Default online streams
    return [
      {
        id: "census",
        label: "Barangay Census",
        sublabel: "Household livestock surveys",
        icon: <FileSpreadsheet className="size-4" />,
        loaded: censusLoaded,
      },
      {
        id: "production",
        label: "Production Yields",
        sublabel: "Milk, eggs and periodic logs",
        icon: <Milk className="size-4" />,
        loaded: productionLoaded,
      },
      {
        id: "inventory",
        label: "Livestock Inventory",
        sublabel: "Individual tags and herd pens",
        icon: <Tag className="size-4" />,
        loaded: inventoryLoaded,
      },
      {
        id: "incidents",
        label: "Field Declarations",
        sublabel: "Health reports and mortality",
        icon: <Activity className="size-4" />,
        loaded: incidentLoaded,
      },
    ];
  }, [items, isActuallyOffline, isCbat, isFarmer, censusLoaded, productionLoaded, inventoryLoaded, incidentLoaded, isLoading]);

  const loadedCount = streamItems.filter((item) => item.loaded).length;
  const progressPercent = streamItems.length
    ? Math.round((loadedCount / streamItems.length) * 100)
    : 0;
  const activeIndex = streamItems.findIndex((item) => !item.loaded);

  // Left panel gradient theme
  const leftPanelGradient = isActuallyOffline
    ? isCbat
      ? "bg-gradient-to-br from-[#0a1c2d] via-[#112d46] to-[#1a3f60]"
      : isFarmer
      ? "bg-gradient-to-br from-[#092418] via-[#0f3725] to-[#174b33]"
      : "bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155]"
    : isCbat
    ? "bg-gradient-to-br from-[#0c2338] via-[#14324f] to-[#1c476e]"
    : "bg-gradient-to-br from-[#123b32] via-[#174c3d] to-[#1c6046]";

  // Corner ring border theme
  const iconBorderColor = isActuallyOffline
    ? isCbat
      ? "border-[#112d46]"
      : isFarmer
      ? "border-[#0f3725]"
      : "border-[#1e293b]"
    : isCbat
    ? "border-[#14324f]"
    : "border-[#174c3d]";

  return (
    <section
      role="status"
      aria-live="polite"
      aria-label={`${displayTitle}. ${loadedCount} of ${streamItems.length} data sources loaded.`}
      className={`relative isolate flex min-h-[calc(100dvh-10rem)] w-full items-center justify-center overflow-hidden rounded-2xl bg-[#f4f7f5] px-3 py-7 motion-reduce:transition-none sm:px-5 sm:py-10 ${
        isLoading
          ? "animate-in fade-in duration-300 opacity-100"
          : "animate-out fade-out-0 duration-500 fill-mode-forwards pointer-events-none"
      }`}
    >
      {/* Soft background accents give this full-page state depth without competing with the data. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className={`absolute -left-24 top-8 size-64 rounded-full blur-3xl ${
          isActuallyOffline ? "bg-amber-100/50" : isCbat ? "bg-sky-100/60" : "bg-emerald-100/60"
        }`} />
        <div className={`absolute -right-20 bottom-0 size-72 rounded-full blur-3xl ${
          isActuallyOffline ? "bg-orange-100/40" : isCbat ? "bg-indigo-100/50" : "bg-teal-100/50"
        }`} />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      </div>

      <div
        className={`grid w-full max-w-5xl overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_24px_80px_-36px_rgba(15,23,42,0.3)] motion-reduce:transition-none md:grid-cols-[0.82fr_1.18fr] ${
          isLoading
            ? "animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-500"
            : "animate-out fade-out-0 zoom-out-95 slide-out-to-top-2 duration-500 fill-mode-forwards"
        }`}
      >
        <div className={`relative flex min-h-56 flex-col justify-between overflow-hidden p-6 text-white sm:min-h-64 sm:p-8 md:min-h-[26rem] ${leftPanelGradient}`}>
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full border border-white/10" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-4 -top-8 size-40 rounded-full border border-white/10" />
          <div aria-hidden="true" className={`pointer-events-none absolute -bottom-28 -left-20 size-64 rounded-full blur-2xl ${
            isActuallyOffline ? "bg-amber-300/10" : isCbat ? "bg-sky-300/10" : "bg-emerald-300/10"
          }`} />

          <div className="relative flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em]">
            {isActuallyOffline ? (
              <span className="inline-flex items-center gap-2 text-amber-200">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-70 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2 rounded-full bg-amber-400" />
                </span>
                <CloudOff className="size-3.5 text-amber-300" />
                PWA Offline Field Cache
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-emerald-100/80">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-300" />
                </span>
                Live data connection
              </span>
            )}
          </div>

          <div className="relative flex items-center justify-center py-7 sm:py-9">
            <div aria-hidden="true" className="absolute size-44 rounded-full border border-white/10 sm:size-52" />
            <div aria-hidden="true" className={`absolute size-36 rounded-full border border-dashed motion-safe:animate-[spin_24s_linear_infinite] sm:size-44 ${
              isActuallyOffline ? "border-amber-200/25" : isCbat ? "border-sky-200/25" : "border-emerald-100/25"
            }`} />
            <div className={`relative flex size-24 items-center justify-center rounded-[1.8rem] border border-white/20 bg-white/10 shadow-[0_18px_60px_-20px_rgba(0,0,0,0.55)] backdrop-blur-sm sm:size-28 ${
              isActuallyOffline ? "border-amber-300/30 bg-amber-500/10" : ""
            }`}>
              {icon ?? (
                isActuallyOffline ? (
                  <Database className={`size-11 sm:size-12 ${isCbat ? "text-sky-200" : "text-amber-200"}`} strokeWidth={1.5} />
                ) : (
                  <ShieldCheck className={`size-11 sm:size-12 ${isCbat ? "text-sky-100" : "text-emerald-100"}`} strokeWidth={1.5} />
                )
              )}
              <span className={`absolute -bottom-2 -right-2 flex size-9 items-center justify-center rounded-full border-[3px] shadow-lg ${
                isActuallyOffline
                  ? `${iconBorderColor} bg-amber-500 text-slate-950`
                  : isCbat
                  ? `${iconBorderColor} bg-white text-sky-800`
                  : `${iconBorderColor} bg-white text-emerald-800`
              }`}>
                {isActuallyOffline ? (
                  <WifiOff className="size-4 animate-pulse motion-reduce:animate-none" />
                ) : (
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                )}
              </span>
            </div>
          </div>

          <div className="relative flex items-end justify-between gap-4 border-t border-white/15 pt-4">
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${
                isActuallyOffline
                  ? isCbat ? "text-sky-200/80" : "text-amber-200/80"
                  : isCbat ? "text-sky-200/80" : "text-emerald-100/65"
              }`}>
                {isActuallyOffline
                  ? isCbat ? "CBAT Field Biosecurity" : isFarmer ? "Farmer Field Workspace" : "PWA Field Session"
                  : "Secure workspace"}
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {isActuallyOffline ? "Pre-cached offline field session" : "Authorized municipal records"}
              </p>
            </div>
            <span className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 font-mono text-[10px] font-bold tracking-wider text-emerald-50">
              {loadedCount.toString().padStart(2, "0")} / {streamItems.length.toString().padStart(2, "0")}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-center p-5 sm:p-8 md:p-10">
          <div className="mb-5 flex items-center justify-between gap-3">
            <span className={`inline-flex min-w-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${
              isActuallyOffline
                ? "border-amber-300 bg-amber-50 text-amber-900 shadow-xs"
                : isCbat
                ? "border-sky-200 bg-sky-50 text-sky-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}>
              {isActuallyOffline ? (
                <WifiOff className="size-3 text-amber-600 shrink-0" />
              ) : (
                <span className={`size-1.5 shrink-0 rounded-full ${isCbat ? "bg-sky-600" : "bg-emerald-600"}`} />
              )}
              <span className="truncate">{displayBadgeLabel}</span>
            </span>
            <span className="shrink-0 text-xs font-bold tabular-nums text-slate-500">{progressPercent}%</span>
          </div>

          <h2 className="text-xl font-black leading-tight tracking-tight text-slate-950 sm:text-2xl">{displayTitle}</h2>
          {displaySubtitle ? <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">{displaySubtitle}</p> : null}

          <div
            className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-label="Data loading progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-500 ease-out ${
                isActuallyOffline
                  ? isCbat
                    ? "bg-gradient-to-r from-sky-600 via-blue-500 to-amber-500"
                    : "bg-gradient-to-r from-emerald-600 via-teal-500 to-amber-500"
                  : isCbat
                  ? "bg-gradient-to-r from-sky-700 via-blue-500 to-cyan-400"
                  : "bg-gradient-to-r from-emerald-700 via-emerald-500 to-teal-400"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-slate-400">
            <span>
              {isActuallyOffline
                ? loadedCount === streamItems.length
                  ? "All cached records restored"
                  : "Restoring local database cache"
                : loadedCount === streamItems.length
                ? "All sources connected"
                : "Loading requested data sources"}
            </span>
            <span>
              {loadedCount} of {streamItems.length} {isActuallyOffline ? "cached streams ready" : "ready"}
            </span>
          </div>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {streamItems.map((item, index) => {
              const isActive = !item.loaded && index === activeIndex;
              return (
                <div
                  key={item.id}
                  className={`flex min-w-0 items-center gap-3 rounded-xl border px-3 py-3 transition-colors duration-300 ${
                    item.loaded
                      ? isActuallyOffline
                        ? isCbat ? "border-sky-200 bg-sky-50/70" : "border-emerald-200 bg-emerald-50/70"
                        : "border-emerald-200 bg-emerald-50/70"
                      : isActive
                        ? isActuallyOffline
                          ? "border-amber-300 bg-white shadow-sm shadow-amber-900/5"
                          : "border-emerald-300 bg-white shadow-sm shadow-emerald-900/5"
                        : "border-slate-200 bg-slate-50/70"
                  }`}
                >
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                    item.loaded
                      ? isActuallyOffline
                        ? isCbat ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"
                        : "bg-emerald-100 text-emerald-800"
                      : isActive
                        ? isActuallyOffline
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-400"
                  }`}>
                    {item.icon ?? <Tag className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-xs font-bold ${
                      item.loaded
                        ? isActuallyOffline
                          ? isCbat ? "text-sky-950" : "text-emerald-950"
                          : "text-emerald-950"
                        : "text-slate-700"
                    }`}>
                      {item.label}
                    </span>
                    {item.sublabel ? <span className="mt-0.5 block truncate text-[10px] text-slate-500">{item.sublabel}</span> : null}
                  </span>
                  <span className="shrink-0" aria-label={item.loaded ? "Loaded" : isActive ? "Loading" : "Waiting"}>
                    {item.loaded ? (
                      <CheckCircle2 className={`size-4 ${
                        isActuallyOffline
                          ? isCbat ? "text-sky-700" : "text-emerald-700"
                          : "text-emerald-700"
                      }`} />
                    ) : isActive ? (
                      <Loader2 className={`size-4 animate-spin ${
                        isActuallyOffline ? "text-amber-600" : "text-emerald-700"
                      } motion-reduce:animate-none`} />
                    ) : (
                      <span className="block size-2 rounded-full bg-slate-300" />
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Offline Reassurance Callout Banner */}
          {isActuallyOffline && (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200/90 bg-amber-50/90 p-3.5 text-xs text-amber-950 shadow-xs">
              <CloudOff className="size-4 shrink-0 text-amber-700 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold text-amber-900">
                  {isCbat ? "CBAT Field Biosecurity Mode: " : isFarmer ? "Farmer Field Recording Mode: " : "Offline Cache Mode: "}
                </span>
                You can review cached records and record new submissions without an internet connection. Everything is safely preserved on your device and will synchronize with municipal servers automatically when reconnected.
              </div>
            </div>
          )}

          {authorityText ? (
            <div className="mt-6 flex items-center gap-2 border-t border-slate-100 pt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              <ShieldCheck className={`size-4 shrink-0 ${isActuallyOffline ? "text-amber-600" : isCbat ? "text-sky-700" : "text-emerald-700"}`} />
              <span className="min-w-0 truncate">{authorityText}</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
