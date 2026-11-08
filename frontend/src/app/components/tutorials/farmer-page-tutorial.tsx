"use client";

import { useCallback, useEffect, useRef } from "react";
import "driver.js/dist/driver.css";
import type { DriveStep } from "driver.js";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAutomaticTutorialsEnabled } from "@/hooks/use-automatic-tutorials-enabled";
import { markTutorialSeen, shouldAutoStartTutorial, startGuidedTutorial } from "@/lib/tutorial-preferences";
import { farmerPageGuides, type FarmerPageGuide } from "./farmer-page-guides";

export function FarmerPageTutorial({ guide, ready = true, autoStart = true, className }: {
  guide: FarmerPageGuide;
  ready?: boolean;
  autoStart?: boolean;
  className?: string;
}) {
  const enabled = useAutomaticTutorialsEnabled();
  const button = useRef<HTMLButtonElement>(null);
  const activeTour = useRef<ReturnType<typeof startGuidedTutorial>>(undefined);
  const key = `smartlivestock-farmer-guide-${guide}-v1`;
  const start = useCallback(() => {
    if (!button.current?.getClientRects().length) return;
    // A deep-linked form or another tutorial owns the user's attention already.
    if (document.querySelector('[role="dialog"][data-state="open"], .driver-overlay')) return;
    const definition = farmerPageGuides[guide];
    const steps: DriveStep[] = [{ popover: { title: definition.title, description: definition.description } }];
    for (const step of definition.steps) {
      const element = Array.from(document.querySelectorAll(step.element)).find((candidate) =>
        candidate.getClientRects().length > 0 && window.getComputedStyle(candidate).visibility !== "hidden",
      );
      if (element) steps.push({ element, popover: { title: step.title, description: step.description, side: "bottom", align: "center" } });
    }
    activeTour.current = startGuidedTutorial({
      showProgress: true, animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches, allowClose: true,
      nextBtnText: "Next", prevBtnText: "Back", doneBtnText: "Finish",
      progressText: "{{current}} of {{total}}", steps,
      onDestroyed: () => { activeTour.current = undefined; },
    });
    if (activeTour.current) markTutorialSeen(key);
  }, [guide, key]);

  useEffect(() => {
    if (!enabled || !ready || !autoStart || !shouldAutoStartTutorial(key)) return;
    const timer = window.setTimeout(start, 800);
    return () => window.clearTimeout(timer);
  }, [enabled, ready, autoStart, key, start]);

  useEffect(() => () => { activeTour.current?.destroy(); }, [guide]);

  if (!enabled) return null;
  return <Button ref={button} type="button" variant="outline" onClick={start} disabled={!ready}
    aria-label={`Start ${farmerPageGuides[guide].title.toLowerCase()} tutorial`}
    className={className ?? "min-h-11 shrink-0 gap-1.5 rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"}>
    <Sparkles className="size-4" aria-hidden="true" /> Tutorial
  </Button>;
}

/** Surface-styled replay control for production record lists and their embedded views. */
export function FarmerRecordsTutorial({ guide, ready = true, autoStart = true }: {
  guide: FarmerPageGuide; ready?: boolean; autoStart?: boolean;
}) {
  return <div className="flex justify-end">
    <FarmerPageTutorial guide={guide} ready={ready} autoStart={autoStart}
      className="min-h-11 shrink-0 gap-1.5 rounded-xl border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50" />
  </div>;
}
