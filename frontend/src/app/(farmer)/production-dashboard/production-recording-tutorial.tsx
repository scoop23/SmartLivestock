"use client";

import "driver.js/dist/driver.css";
import { useCallback, useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAutomaticTutorialsEnabled } from "@/hooks/use-automatic-tutorials-enabled";
import { markTutorialSeen, shouldAutoStartTutorial, startGuidedTutorial } from "@/lib/tutorial-preferences";

const guides = {
  breeding: [
    ["breeding-dam", "Choose the mother", "Select the eligible female animal involved in this breeding event. Check its ear tag before continuing."],
    ["breeding-date", "Date of breeding", "Record the date the mating or insemination actually happened."],
    ["breeding-method", "Breeding method", "Choose artificial insemination, natural service, or embryo transfer to match the event."],
    ["breeding-sire", "Sire or semen identification", "Record the sire tag or semen code when known. Use the registered sire option when appropriate and record the sire breed when known."],
    ["breeding-technician", "Person who performed the procedure", "Record the technician or inseminator when applicable."],
    ["breeding-due", "Estimated due date", "This estimate uses the breeding date and standard gestation for the selected species. Logging a breeding event does not confirm pregnancy."],
    ["breeding-notes", "Additional observations", "Add any relevant context about the breeding event."],
    ["breeding-save", "Review and save", "Check the animal, method, and date before saving. Record pregnancy confirmation separately when it is known."],
  ],
  feeding: [
    ["feeding-target", "Animal or herd", "Choose whether this feed record is for one animal or an entire herd. Select the correct recipient below."],
    ["feeding-recipient", "Select the recipient", "Select the animal or herd that received this ration. A herd ration records the total given to that group."],
    ["feeding-date", "Date fed", "Enter the date the feed was given."],
    ["feeding-time", "Feeding session", "Choose the session or all-day feeding option that matches the record."],
    ["feeding-type", "Feed category", "Choose the category that best describes the feed supplied."],
    ["feeding-name", "Feed name", "Enter the feed description or brand so you can recognize this ration later."],
    ["feeding-quantity", "Amount in kilograms", "Enter the total kilograms supplied to the selected animal or herd for this entry."],
    ["feeding-cost", "Optional cost", "Record the cost for this feed entry in pesos when known. This helps calculate recorded feed expenses."],
    ["feeding-notes", "Optional notes", "Add context such as ration changes or leftovers when relevant."],
    ["feeding-save", "Check and save", "Review the recipient, date, kilograms, and cost before saving the feeding log."],
  ],
  treatment: [
    ["treatment-animal", "Select the treated animal", "Choose the animal that actually received the treatment. Check the ear tag carefully."],
    ["treatment-date", "Treatment date", "Record when the treatment was administered."],
    ["treatment-category", "Treatment category", "Choose the category that matches the product or care that was provided."],
    ["treatment-product", "Product or medication", "Record the actual product name used."],
    ["treatment-dosage", "Record the administered dose", "Copy the actual dose and units from the treatment record or veterinary instructions. This form records care; it does not calculate or recommend a dose."],
    ["treatment-route", "Administration route", "Select how the treatment was administered, when applicable."],
    ["treatment-provider", "Who administered it", "Record the veterinarian, technician, or person who administered the treatment."],
    ["treatment-reason", "Reason for treatment", "Describe the recorded reason or veterinary diagnosis. Clearly distinguish observations from a confirmed diagnosis."],
    ["treatment-follow-up", "Optional follow-up date", "Record a follow-up date when a check is planned. Saving a date does not book a program appointment."],
    ["treatment-notes", "Additional notes", "Add relevant observations or instructions from the treatment record."],
    ["treatment-save", "Review and save", "Check the animal, product, date, and administered details before saving this treatment record."],
  ],
} as const;

type RecordingGuide = keyof typeof guides;

export function ProductionRecordingTutorial({ kind, open }: { kind: RecordingGuide; open: boolean }) {
  const enabled = useAutomaticTutorialsEnabled();
  const tour = useRef<ReturnType<typeof startGuidedTutorial>>(undefined);
  const key = `smartlivestock-production-recording-${kind}-v1`;
  const start = useCallback(() => {
    const root = document.querySelector(`[data-recording-form="${kind}"]`);
    if (!root || document.querySelector(".driver-overlay")) return;
    const steps = guides[kind].flatMap(([anchor, title, description]) => {
      const element = root.querySelector(`[data-tour="${anchor}"]`);
      return element && element.getClientRects().length ? [{ element, popover: { title, description } }] : [];
    });
    if (!steps.length) return;
    tour.current = startGuidedTutorial({
      showProgress: true, animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      nextBtnText: "Next", prevBtnText: "Back", doneBtnText: "Finish",
      progressText: "{{current}} of {{total}}", steps,
      onDestroyed: () => { tour.current = undefined; },
    });
    if (tour.current) markTutorialSeen(key);
  }, [kind, key]);

  useEffect(() => {
    if (!open || !enabled || !shouldAutoStartTutorial(key)) return;
    const timer = window.setTimeout(start, 650);
    return () => window.clearTimeout(timer);
  }, [open, enabled, key, start]);

  useEffect(() => () => { tour.current?.destroy(); }, [open, kind]);

  if (!enabled) return null;
  return <Button type="button" variant="outline" onClick={start}
    aria-label={`Start ${kind} recording tutorial`} className="min-h-10 shrink-0 gap-1.5 self-start rounded-xl">
    <Sparkles className="size-4" aria-hidden="true" /> Tutorial
  </Button>;
}
