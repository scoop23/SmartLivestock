"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

export type FontScale = "standard" | "comfortable" | "extra-large";

type AccessibilitySettingsContextValue = {
  fontScale: FontScale;
  setFontScale: (scale: FontScale) => void;
};

const STORAGE_KEY = "smartlivestock-font-scale";
const CHANGE_EVENT = "smartlivestock-font-scale-change";
let inMemoryFontScale: FontScale = "comfortable";
const AccessibilitySettingsContext =
  createContext<AccessibilitySettingsContextValue | null>(null);

function isFontScale(value: string | null): value is FontScale {
  return value === "standard" || value === "comfortable" || value === "extra-large";
}

function getFontScaleSnapshot(): FontScale {
  try {
    const savedScale = window.localStorage.getItem(STORAGE_KEY);
    if (isFontScale(savedScale)) return savedScale;
  } catch {
    // Use the in-memory value when browser storage is unavailable.
  }
  return inMemoryFontScale;
}

function subscribeToFontScale(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getServerFontScaleSnapshot(): FontScale {
  return "comfortable";
}

export function AccessibilitySettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const fontScale = useSyncExternalStore(
    subscribeToFontScale,
    getFontScaleSnapshot,
    getServerFontScaleSnapshot
  );

  useEffect(() => {
    document.documentElement.dataset.fontScale = fontScale;
  }, [fontScale]);

  const setFontScale = (scale: FontScale) => {
    inMemoryFontScale = scale;
    document.documentElement.dataset.fontScale = scale;
    try {
      window.localStorage.setItem(STORAGE_KEY, scale);
    } catch {
      // The current page still updates if browser storage is unavailable.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  return (
    <AccessibilitySettingsContext.Provider value={{ fontScale, setFontScale }}>
      {children}
    </AccessibilitySettingsContext.Provider>
  );
}

export function useAccessibilitySettings() {
  const context = useContext(AccessibilitySettingsContext);
  if (!context) {
    throw new Error(
      "useAccessibilitySettings must be used within AccessibilitySettingsProvider"
    );
  }
  return context;
}
