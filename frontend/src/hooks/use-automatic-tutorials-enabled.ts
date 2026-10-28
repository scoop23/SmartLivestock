"use client";

import { useSyncExternalStore } from "react";
import { getAutomaticTutorialsEnabled } from "@/lib/tutorial-preferences";

const PREFERENCE_EVENT = "smartlivestock:tutorial-preference-change";

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(PREFERENCE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(PREFERENCE_EVENT, onStoreChange);
  };
}

export function useAutomaticTutorialsEnabled() {
  return useSyncExternalStore(
    subscribe,
    getAutomaticTutorialsEnabled,
    () => false,
  );
}
