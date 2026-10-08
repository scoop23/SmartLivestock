"use client";

import { Menu } from "lucide-react";
import { openMobileNav } from "./mobile-nav-open";

export function HeaderMenuButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openMobileNav}
      aria-label="Open menu"
      className={`lg:hidden shrink-0 flex size-11 items-center justify-center rounded-full shadow-sm ${className}`}
    >
      <Menu className="size-5" />
    </button>
  );
}
