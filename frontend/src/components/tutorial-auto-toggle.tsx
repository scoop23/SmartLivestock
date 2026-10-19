"use client";

import { Switch } from "@/components/ui/switch";
import { getAutomaticTutorialsEnabled, setAutomaticTutorialsEnabled } from "@/lib/tutorial-preferences";
import { useEffect, useState } from "react";

export function TutorialAutoToggle({ dark = false }: { dark?: boolean }) {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const syncPreference = () => setEnabled(getAutomaticTutorialsEnabled());
    syncPreference();
    window.addEventListener("storage", syncPreference);
    window.addEventListener("smartlivestock:tutorial-preference-change", syncPreference);
    return () => {
      window.removeEventListener("storage", syncPreference);
      window.removeEventListener("smartlivestock:tutorial-preference-change", syncPreference);
    };
  }, []);

  return (
    <label className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-xl px-2.5 text-xs font-semibold ${dark ? "border border-white/20 bg-white/10 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>
      <span>Tutorials</span>
      <Switch
        checked={enabled}
        onCheckedChange={(nextEnabled) => {
          setEnabled(nextEnabled);
          setAutomaticTutorialsEnabled(nextEnabled);
        }}
        aria-label={`Tutorials ${enabled ? "on" : "off"}`}
        className={dark ? "data-[state=checked]:bg-emerald-300" : ""}
      />
    </label>
  );
}
