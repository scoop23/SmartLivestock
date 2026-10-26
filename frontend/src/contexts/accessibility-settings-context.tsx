"use client";

import { createContext,useContext,useEffect,useSyncExternalStore } from "react";

export type FontScale = "standard" | "comfortable" | "extra-large";
export type FontTheme = "nexus" | "inter";

type AccessibilitySettingsContextValue = {
  fontScale: FontScale;
  setFontScale: (scale: FontScale) => void;
  fontTheme: FontTheme;
  setFontTheme: (theme: FontTheme) => void;
};

const STORAGE_KEY = "smartlivestock-font-scale";
const CHANGE_EVENT = "smartlivestock-font-scale-change";
const THEME_STORAGE_KEY = "smartlivestock-font-theme";
const THEME_CHANGE_EVENT = "smartlivestock-font-theme-change";

let inMemoryFontScale: FontScale = "comfortable";
let inMemoryFontTheme: FontTheme = "nexus";

const AccessibilitySettingsContext =
  createContext<AccessibilitySettingsContextValue | null>(null);

function isFontScale(value: string | null): value is FontScale {
  return value === "standard" || value === "comfortable" || value === "extra-large";
}

function isFontTheme(value: string | null): value is FontTheme {
  return value === "nexus" || value === "inter";
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

function getFontThemeSnapshot(): FontTheme {
  try {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isFontTheme(savedTheme)) return savedTheme;
  } catch {
    // Fall back to in-memory theme
  }
  return inMemoryFontTheme;
}

function subscribeToFontScale(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function subscribeToFontTheme(onChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getServerFontScaleSnapshot(): FontScale {
  return "comfortable";
}

function getServerFontThemeSnapshot(): FontTheme {
  return "nexus";
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

  const fontTheme = useSyncExternalStore(
    subscribeToFontTheme,
    getFontThemeSnapshot,
    getServerFontThemeSnapshot
  );

  useEffect(() => {
    document.documentElement.dataset.fontScale = fontScale;
  }, [fontScale]);

  useEffect(() => {
    document.documentElement.dataset.fontTheme = fontTheme;
  }, [fontTheme]);

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

  const setFontTheme = (theme: FontTheme) => {
    inMemoryFontTheme = theme;
    document.documentElement.dataset.fontTheme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The current page still updates if browser storage is unavailable.
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  return (
    <AccessibilitySettingsContext.Provider
      value={{ fontScale, setFontScale, fontTheme, setFontTheme }}
    >
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
