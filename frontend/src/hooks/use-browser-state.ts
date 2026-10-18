"use client";

import { useSyncExternalStore } from "react";

const subscribeReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

/** Keep server markup stable until browser-only values are available. */
export function useClientReady() {
  return useSyncExternalStore(subscribeReady, clientReady, serverReady);
}

function subscribeLocation(notify: () => void) {
  window.addEventListener("popstate", notify);
  return () => window.removeEventListener("popstate", notify);
}

const browserSearch = () => window.location.search;
const serverSearch = () => "";

export function useBrowserSearch() {
  return useSyncExternalStore(subscribeLocation, browserSearch, serverSearch);
}

function subscribeOnline(notify: () => void) {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
}

const browserOnline = () => navigator.onLine;
const serverOnline = () => true;

export function useOnlineStatus() {
  return useSyncExternalStore(subscribeOnline, browserOnline, serverOnline);
}
