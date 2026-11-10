"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import {
  ArrowUpRight,
  CheckCircle2,
  Download,
  Share,
  Smartphone,
  X,
} from "lucide-react";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const TRIGGER_PWA_INSTALL_EVENT = "smartlivestock:trigger-pwa-install";

export function PwaInstaller() {
  const { user } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosDialog, setShowIosDialog] = useState(false);

  // 1. Register Service Worker on client mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect if already installed and running standalone
    const standaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    setIsStandalone(standaloneMode);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIos(isIosDevice);

    // Register Service Worker
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .then((reg) => {
            // Check for service worker updates
            reg.addEventListener("updatefound", () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener("statechange", () => {
                  if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                    console.log("[SmartLivestock PWA] New update cached and ready.");
                  }
                });
              }
            });
          })
          .catch((err) => {
            console.warn("[SmartLivestock PWA] SW registration:", err);
          });
      });
    }

    // 2. Capture beforeinstallprompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);

      // Check if dismissed within the last 7 days
      const lastDismissed = localStorage.getItem("smartlivestock_pwa_dismissed");
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const isRecentlyDismissed = lastDismissed && Date.now() - Number(lastDismissed) < sevenDays;

      if (!standaloneMode && !isRecentlyDismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // 3. Listen for manual trigger from sidebar or mobile navigation
    const handleManualTrigger = () => {
      if (standaloneMode) {
        toast.info("SmartLivestock is already installed and running in app mode!");
        return;
      }
      if (deferredPrompt) {
        triggerInstall();
      } else if (isIosDevice) {
        setShowIosDialog(true);
      } else {
        setShowBanner(true);
      }
    };

    window.addEventListener(TRIGGER_PWA_INSTALL_EVENT, handleManualTrigger);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener(TRIGGER_PWA_INSTALL_EVENT, handleManualTrigger);
    };
  }, [deferredPrompt]);

  // Also check if iOS user hasn't dismissed yet and is farmer/sibat
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone) return;

    if (isIos) {
      const lastDismissed = localStorage.getItem("smartlivestock_pwa_dismissed");
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (!lastDismissed || Date.now() - Number(lastDismissed) >= sevenDays) {
        setShowBanner(true);
      }
    }
  }, [isIos, isStandalone]);

  const triggerInstall = async () => {
    if (!deferredPrompt) {
      if (isIos) {
        setShowIosDialog(true);
      } else {
        toast.info("To install on Chrome/Edge: tap the install icon in the address bar or browser menu.");
      }
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        toast.success("Installing SmartLivestock to your home screen…");
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.error("[PWA] Installation prompt error:", err);
    }
  };

  const dismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem("smartlivestock_pwa_dismissed", String(Date.now()));
  };

  // If already installed as standalone app, don't display
  if (isStandalone) return null;

  const role = user?.role?.toUpperCase();
  const isTargetAudience = !user || role === "FARMER" || role === "SIBAT" || role === "CBAT";

  return (
    <>
      {/* Floating Install App Banner */}
      {showBanner && isTargetAudience && (
        <aside
          role="region"
          aria-label="Install SmartLivestock application"
          className="fixed bottom-3 sm:bottom-5 left-3 right-3 sm:left-auto sm:right-5 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300"
        >
          <div className="rounded-2xl border border-emerald-700/30 bg-[#0F2E1E]/95 text-white p-4 shadow-2xl backdrop-blur-md flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-xl bg-emerald-600/30 border border-emerald-500/40 p-1 flex items-center justify-center shrink-0">
                  <Image
                    src="/icons/icon-192x192.png"
                    alt="SmartLivestock logo"
                    width={36}
                    height={36}
                    className="rounded-lg object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs sm:text-sm font-extrabold text-white tracking-tight">
                      Install SmartLivestock
                    </h4>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                      PWA
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-100/70 leading-snug line-clamp-2">
                    Faster loading &amp; offline field access for Farmer &amp; SIBAT/CBAT roles in Padre Garcia.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={dismissBanner}
                className="size-7 rounded-lg text-emerald-200/60 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                aria-label="Dismiss install banner"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                onClick={triggerInstall}
                className="flex-1 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950/40 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Download className="size-3.5" />
                <span>Install Mobile App</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={dismissBanner}
                className="h-9 px-3 rounded-xl text-emerald-200/80 hover:text-white hover:bg-white/10 text-xs font-semibold cursor-pointer"
              >
                Maybe later
              </Button>
            </div>
          </div>
        </aside>
      )}

      {/* iOS Instructions Modal */}
      <Dialog open={showIosDialog} onOpenChange={setShowIosDialog}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="size-9 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
                <Smartphone className="size-5" />
              </div>
              <DialogTitle className="text-base font-bold text-white">
                Install on iPhone or iPad
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-400">
              Apple iOS requires adding the app directly from Safari using these 2 simple steps:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
              <div className="size-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <Share className="size-4" />
              </div>
              <div>
                <span className="font-bold text-slate-200">1. Tap the Share button</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Located at the bottom of Safari on iPhone, or top bar on iPad.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60">
              <div className="size-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <ArrowUpRight className="size-4" />
              </div>
              <div>
                <span className="font-bold text-slate-200">2. Tap &quot;Add to Home Screen&quot;</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Scroll down the share sheet and tap the &quot;Add to Home Screen&quot; icon, then tap &quot;Add&quot;.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-1 text-[11px] text-emerald-300">
              <CheckCircle2 className="size-3.5 shrink-0" />
              <span>SmartLivestock will appear as a standalone app on your home screen!</span>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => setShowIosDialog(false)}
            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-10 mt-1 cursor-pointer"
          >
            Got it
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
