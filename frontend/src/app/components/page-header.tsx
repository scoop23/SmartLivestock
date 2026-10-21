"use client";

import type { ReactNode } from "react";
import { TutorialAutoToggle } from "@/components/tutorial-auto-toggle";
import { HeaderMenuButton } from "./header-menu-button";
import { HeaderNotifications } from "./header-notifications";
import { Breadcrumbs, type BreadcrumbItem } from "./breadcrumbs";

type PageHeaderVariant = "admin" | "farmer" | "sibat" | "auction" | "slaughterhouse";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  variant?: PageHeaderVariant;
  maxWidthClass?: string;
  mobileMenuOffset?: boolean;
  sticky?: boolean;
  className?: string;
  showNotifications?: boolean;
  showTutorialToggle?: boolean;
  wrapSubtitleOnMobile?: boolean;
  mobileActionsRow?: boolean;
  hideIconOnMobile?: boolean;
  mobileActionsInline?: boolean;
  showBreadcrumbs?: boolean;
  breadcrumbs?: BreadcrumbItem[];
  rootHref?: string;
}

const headerClasses: Record<PageHeaderVariant, string> = {
  admin: "bg-white text-gray-900 border-b border-gray-200",
  farmer: "bg-gradient-to-r from-[#2D5A27] to-[#3E7A36] text-white shadow-lg",
  sibat: "bg-gradient-to-r from-[#1A365D] to-[#1E4E8C] text-white shadow-lg",
  auction: "bg-gradient-to-r from-[#7C3AED] to-[#9F67FF] text-white shadow-lg",
  slaughterhouse: "bg-gradient-to-r from-[#9F1239] to-[#E11D48] text-white shadow-lg",
};

const glowClasses: Record<PageHeaderVariant, string> = {
  admin: "bg-slate-400/15",
  farmer: "bg-emerald-300/20",
  sibat: "bg-sky-300/20",
  auction: "bg-fuchsia-200/25",
  slaughterhouse: "bg-rose-200/25",
};

const chipClasses: Record<PageHeaderVariant, string> = {
  admin: "bg-slate-900/[0.06] text-gray-900",
  farmer: "bg-white/15 text-white border border-white/20",
  sibat: "bg-white/15 text-white border border-white/20",
  auction: "bg-white/15 text-white border border-white/20",
  slaughterhouse: "bg-white/15 text-white border border-white/20",
};

export function PageHeader({
  title,
  subtitle,
  icon,
  action,
  variant = "admin",
  maxWidthClass = "w-full",
  sticky = false,
  className = "",
  showNotifications = true,
  showTutorialToggle = true,
  wrapSubtitleOnMobile = false,
  mobileActionsRow = false,
  hideIconOnMobile = false,
  mobileActionsInline = false,
  showBreadcrumbs = true,
  breadcrumbs,
  rootHref,
}: PageHeaderProps) {
  const breadcrumbsSubBar = showBreadcrumbs ? (
    <div className="border-b border-slate-200/80 bg-white/95 backdrop-blur-xs">
      <div className={`${maxWidthClass} mx-auto px-4 py-1.5 sm:px-6`}>
        <Breadcrumbs
          items={breadcrumbs}
          rootHref={rootHref}
        />
      </div>
    </div>
  ) : null;

  if (mobileActionsInline) {
    return (
      <div className={sticky ? "sticky top-0 z-20" : ""}>
        <header
          className={`relative overflow-hidden ${headerClasses[variant]} ${className}`}
        >
          <div
            aria-hidden
            className={`pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full blur-3xl transform-gpu [contain:paint] ${glowClasses[variant]}`}
          />
          <div
            aria-hidden
            className={`pointer-events-none absolute right-32 -bottom-28 h-48 w-48 rounded-full blur-3xl transform-gpu [contain:paint] ${glowClasses[variant]}`}
          />
          <div className={`relative ${maxWidthClass} mx-auto px-4 py-3 sm:py-5 md:px-6 md:py-7`}>
            {/* Mobile Layout (sm:hidden) */}
            <div className="sm:hidden flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <HeaderMenuButton className={chipClasses[variant]} />
                  {icon && !hideIconOnMobile ? (
                    <div
                      className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-xl ${chipClasses[variant]}`}
                    >
                      {icon}
                    </div>
                  ) : null}
                  <h1 className="min-w-0 truncate text-base font-extrabold tracking-tight leading-snug">
                    {title}
                  </h1>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {showNotifications && <HeaderNotifications variant={variant} />}
                  {variant === "farmer" && showTutorialToggle && <TutorialAutoToggle dark />}
                  {action ? action : null}
                </div>
              </div>
              {subtitle && (
                <p className="text-xs font-medium opacity-90 leading-relaxed whitespace-normal break-words pl-0.5">
                  {subtitle}
                </p>
              )}
            </div>

            {/* Desktop Layout (hidden sm:flex) */}
            <div className="hidden sm:flex sm:items-center sm:justify-between sm:gap-3">
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <HeaderMenuButton className={chipClasses[variant]} />
                {icon ? (
                  <div
                    className={`shrink-0 flex items-center justify-center w-11 h-11 rounded-2xl ${chipClasses[variant]}`}
                  >
                    {icon}
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <h1 className="min-w-0 break-words text-xl md:text-2xl font-extrabold tracking-tight leading-snug">
                    {title}
                  </h1>
                  {subtitle && (
                    <p className="text-xs sm:text-sm font-medium opacity-90 mt-1 leading-relaxed">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2.5 ml-2">
                <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2.5">
                  {showNotifications && <HeaderNotifications variant={variant} />}
                  {variant === "farmer" && showTutorialToggle && <TutorialAutoToggle dark />}
                  {action ? action : null}
                </div>
              </div>
            </div>
          </div>
        </header>
        {breadcrumbsSubBar}
      </div>
    );
  }
  return (
    <div className={sticky ? "sticky top-0 z-20" : ""}>
      <header
        className={`relative overflow-hidden ${headerClasses[variant]} ${className}`}
      >
        <div
          aria-hidden
          className={`pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full blur-3xl transform-gpu [contain:paint] ${glowClasses[variant]}`}
        />
        <div
          aria-hidden
          className={`pointer-events-none absolute right-32 -bottom-28 h-48 w-48 rounded-full blur-3xl transform-gpu [contain:paint] ${glowClasses[variant]}`}
        />
        <div className={`relative ${maxWidthClass} mx-auto px-4 py-3.5 sm:py-5 md:px-6 md:py-7`}>
          <div className={`flex gap-2.5 sm:gap-3 ${variant === "farmer" || variant === "sibat" || Boolean(action) || mobileActionsRow ? "flex-col sm:flex-row sm:items-center sm:justify-between" : "items-center justify-between"}`}>
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
              <HeaderMenuButton className={chipClasses[variant]} />
              {icon ? (
                <div
                  className={`shrink-0 ${hideIconOnMobile ? "hidden sm:flex" : "flex"} items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl ${chipClasses[variant]}`}
                >
                  {icon}
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <h1 className="min-w-0 break-words text-base sm:text-2xl font-extrabold tracking-tight leading-snug">
                  {title}
                </h1>
                {subtitle && (
                  <p className={`text-xs sm:text-sm font-medium opacity-90 mt-0.5 sm:mt-1 leading-relaxed ${variant === "farmer" || variant === "sibat" || Boolean(action) || wrapSubtitleOnMobile ? "whitespace-normal break-words" : "truncate"}`}>
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            <div className={`shrink-0 flex gap-2 sm:gap-2.5 ${
              variant === "farmer"
                ? (mobileActionsRow || Boolean(action)
                    ? "w-full items-center justify-end border-t border-white/15 pt-2.5 sm:ml-2 sm:w-auto sm:border-0 sm:pt-0"
                    : "ml-0 items-center justify-end sm:ml-2")
                : variant === "sibat"
                  ? "w-full items-center justify-end border-t border-white/15 pt-2.5 sm:ml-2 sm:w-auto sm:border-0 sm:pt-0"
                  : Boolean(action) || mobileActionsRow
                    ? `w-full items-center justify-end border-t ${variant === "admin" ? "border-slate-200/80" : "border-white/15"} pt-2.5 sm:ml-2 sm:w-auto sm:border-0 sm:pt-0`
                    : "ml-2 items-center"
            }`}>
              <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2.5">
                {showNotifications && <HeaderNotifications variant={variant} />}
                {variant === "farmer" && showTutorialToggle && <TutorialAutoToggle dark />}
                {action ? action : null}
              </div>
            </div>
          </div>
        </div>
      </header>
      {breadcrumbsSubBar}
    </div>
  );
}
