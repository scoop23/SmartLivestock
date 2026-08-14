export const MOBILE_NAV_EVENT = "smartlivestock:open-nav";

export function openMobileNav() {
  window.dispatchEvent(new CustomEvent(MOBILE_NAV_EVENT));
}
