"use client";

import {
Activity,
CheckCircle2,
FileSpreadsheet,
Loader2,
Milk,
ShieldCheck,
Tag,
} from "lucide-react";
import React,{ useEffect,useState } from "react";

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
}

/** Hold the loading layer briefly so it can fade away after the data is ready. */
export function useLoadingScreenTransition(isLoading: boolean, exitDurationMs = 420) {
  const [isMounted, setIsMounted] = useState(isLoading);

  useEffect(() => {
    if (isLoading || !isMounted) return;
    const timeout = window.setTimeout(() => setIsMounted(false), exitDurationMs);
    return () => window.clearTimeout(timeout);
  }, [isLoading, isMounted, exitDurationMs]);

  return isMounted;
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
}: ValidationLoadingScreenProps) {
  // Callers can describe their own requests, or use the standard ledger streams.
  const streamItems: SyncStreamItem[] = items ?? [
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

  const loadedCount = streamItems.filter((item) => item.loaded).length;
  const progressPercent = streamItems.length
    ? Math.round((loadedCount / streamItems.length) * 100)
    : 0;
  const activeIndex = streamItems.findIndex((item) => !item.loaded);

  return (
    <section
      role="status"
      aria-live="polite"
      aria-label={`${title}. ${loadedCount} of ${streamItems.length} data sources loaded.`}
      className={`relative isolate flex min-h-[calc(100dvh-10rem)] w-full items-center justify-center overflow-hidden rounded-2xl bg-[#f4f7f5] px-3 py-7 transition-[opacity,transform] duration-[420ms] ease-out motion-reduce:transition-none sm:px-5 sm:py-10 ${isLoading ? "animate-in fade-in duration-300 opacity-100" : "pointer-events-none scale-[1.01] opacity-0"}`}
    >
      {/* Soft background accents give this full-page state depth without competing with the data. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 top-8 size-64 rounded-full bg-emerald-100/60 blur-3xl" />
        <div className="absolute -right-20 bottom-0 size-72 rounded-full bg-teal-100/50 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      </div>

      <div className={`grid w-full max-w-5xl overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_24px_80px_-36px_rgba(15,23,42,0.3)] transition-transform duration-500 ease-out motion-reduce:transition-none md:grid-cols-[0.82fr_1.18fr] ${isLoading ? "animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-500" : "scale-[0.985]"}`}>
        <div className="relative flex min-h-56 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#123b32] via-[#174c3d] to-[#1c6046] p-6 text-white sm:min-h-64 sm:p-8 md:min-h-[26rem]">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full border border-white/10" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-4 -top-8 size-40 rounded-full border border-white/10" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -left-20 size-64 rounded-full bg-emerald-300/10 blur-2xl" />

          <div className="relative flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-100/80">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-300" />
            </span>
            Live data connection
          </div>

          <div className="relative flex items-center justify-center py-7 sm:py-9">
            <div aria-hidden="true" className="absolute size-44 rounded-full border border-white/10 sm:size-52" />
            <div aria-hidden="true" className="absolute size-36 rounded-full border border-dashed border-emerald-100/25 motion-safe:animate-[spin_24s_linear_infinite] sm:size-44" />
            <div className="relative flex size-24 items-center justify-center rounded-[1.8rem] border border-white/20 bg-white/10 shadow-[0_18px_60px_-20px_rgba(0,0,0,0.55)] backdrop-blur-sm sm:size-28">
              {icon ?? <ShieldCheck className="size-11 text-emerald-100 sm:size-12" strokeWidth={1.5} />}
              <span className="absolute -bottom-2 -right-2 flex size-9 items-center justify-center rounded-full border-[3px] border-[#174c3d] bg-white text-emerald-800 shadow-lg">
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
              </span>
            </div>
          </div>

          <div className="relative flex items-end justify-between gap-4 border-t border-white/15 pt-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100/65">Secure workspace</p>
              <p className="mt-1 text-sm font-semibold text-white">Authorized municipal records</p>
            </div>
            <span className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 font-mono text-[10px] font-bold tracking-wider text-emerald-50">
              {loadedCount.toString().padStart(2, "0")} / {streamItems.length.toString().padStart(2, "0")}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-center p-5 sm:p-8 md:p-10">
          <div className="mb-5 flex items-center justify-between gap-3">
            <span className="inline-flex min-w-0 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-900">
              <span className="size-1.5 shrink-0 rounded-full bg-emerald-600" />
              <span className="truncate">{badgeLabel}</span>
            </span>
            <span className="shrink-0 text-xs font-bold tabular-nums text-slate-500">{progressPercent}%</span>
          </div>

          <h2 className="text-xl font-black leading-tight tracking-tight text-slate-950 sm:text-2xl">{title}</h2>
          {subtitle ? <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">{subtitle}</p> : null}

          <div
            className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-label="Data loading progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-700 via-emerald-500 to-teal-400 transition-[width] duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-slate-400">
            <span>{loadedCount === streamItems.length ? "All sources connected" : "Loading requested data sources"}</span>
            <span>{loadedCount} of {streamItems.length} ready</span>
          </div>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {streamItems.map((item, index) => {
              const isActive = !item.loaded && index === activeIndex;
              return (
                <div
                  key={item.id}
                  className={`flex min-w-0 items-center gap-3 rounded-xl border px-3 py-3 transition-colors duration-300 ${
                    item.loaded
                      ? "border-emerald-200 bg-emerald-50/70"
                      : isActive
                        ? "border-emerald-300 bg-white shadow-sm shadow-emerald-900/5"
                        : "border-slate-200 bg-slate-50/70"
                  }`}
                >
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                    item.loaded
                      ? "bg-emerald-100 text-emerald-800"
                      : isActive
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-400"
                  }`}>
                    {item.icon ?? <Tag className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-xs font-bold ${item.loaded ? "text-emerald-950" : "text-slate-700"}`}>{item.label}</span>
                    {item.sublabel ? <span className="mt-0.5 block truncate text-[10px] text-slate-500">{item.sublabel}</span> : null}
                  </span>
                  <span className="shrink-0" aria-label={item.loaded ? "Loaded" : isActive ? "Loading" : "Waiting"}>
                    {item.loaded ? (
                      <CheckCircle2 className="size-4 text-emerald-700" />
                    ) : isActive ? (
                      <Loader2 className="size-4 animate-spin text-emerald-700 motion-reduce:animate-none" />
                    ) : (
                      <span className="block size-2 rounded-full bg-slate-300" />
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {authorityText ? (
            <div className="mt-6 flex items-center gap-2 border-t border-slate-100 pt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              <ShieldCheck className="size-4 shrink-0 text-emerald-700" />
              <span className="min-w-0 truncate">{authorityText}</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
