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
