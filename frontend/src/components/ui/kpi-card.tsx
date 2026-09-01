"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type KpiVariant = "emerald" | "sky" | "amber" | "rose" | "orange" | "stone" | "default";

export interface KpiCardProps {
  title: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  description?: string;
  badge?: React.ReactNode;
  badgeClassName?: string;
  variant?: KpiVariant;
  size?: "sm" | "default";
  layout?: "vertical" | "horizontal";
  isLoading?: boolean;
  className?: string;
  onClick?: () => void;
  accentBarColor?: string;
}

const variantStyles: Record<
  KpiVariant,
  {
    card: string;
    iconWrapper: string;
    accentBar: string;
    badgeDefault: string;
  }
> = {
  emerald: {
    card: "border-emerald-900/10 bg-gradient-to-br from-emerald-500/10 via-emerald-50/40 to-white hover:border-emerald-600/30 hover:shadow-md hover:shadow-emerald-900/5",
    iconWrapper: "bg-emerald-100/90 text-emerald-800 border border-emerald-200/60 shadow-2xs",
    accentBar: "bg-emerald-600",
    badgeDefault: "text-emerald-900/70 bg-emerald-950/5 border border-emerald-900/10",
  },
  sky: {
    card: "border-sky-900/10 bg-gradient-to-br from-sky-500/10 via-sky-50/40 to-white hover:border-sky-600/30 hover:shadow-md hover:shadow-sky-900/5",
    iconWrapper: "bg-sky-100/90 text-sky-700 border border-sky-200/60 shadow-2xs",
    accentBar: "bg-sky-500",
    badgeDefault: "text-sky-900/70 bg-sky-950/5 border border-sky-900/10",
  },
  amber: {
    card: "border-amber-900/10 bg-gradient-to-br from-amber-500/10 via-amber-50/40 to-white hover:border-amber-600/30 hover:shadow-md hover:shadow-amber-900/5",
    iconWrapper: "bg-amber-100/90 text-amber-800 border border-amber-200/60 shadow-2xs",
    accentBar: "bg-amber-500",
    badgeDefault: "text-amber-900/70 bg-amber-950/5 border border-amber-900/10",
  },
  rose: {
    card: "border-rose-900/10 bg-gradient-to-br from-rose-500/10 via-rose-50/40 to-white hover:border-rose-600/30 hover:shadow-md hover:shadow-rose-900/5",
    iconWrapper: "bg-rose-100/90 text-rose-800 border border-rose-200/60 shadow-2xs",
    accentBar: "bg-rose-500",
    badgeDefault: "text-rose-900/70 bg-rose-950/5 border border-rose-900/10",
  },
  orange: {
    card: "border-orange-900/10 bg-gradient-to-br from-orange-500/10 via-orange-50/40 to-white hover:border-orange-600/30 hover:shadow-md hover:shadow-orange-900/5",
    iconWrapper: "bg-orange-100/90 text-orange-800 border border-orange-200/60 shadow-2xs",
    accentBar: "bg-orange-500",
    badgeDefault: "text-orange-900/70 bg-orange-950/5 border border-orange-900/10",
  },
  stone: {
    card: "border-stone-900/10 bg-gradient-to-br from-stone-500/10 via-stone-50/40 to-white hover:border-stone-600/30 hover:shadow-md hover:shadow-stone-900/5",
    iconWrapper: "bg-stone-200/90 text-stone-800 border border-stone-300/60 shadow-2xs",
    accentBar: "bg-stone-600",
    badgeDefault: "text-stone-900/70 bg-stone-950/5 border border-stone-900/10",
  },
  default: {
    card: "border-slate-200 bg-gradient-to-br from-slate-500/5 via-slate-50/40 to-white hover:border-slate-300 hover:shadow-md",
    iconWrapper: "bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs",
    accentBar: "bg-slate-600",
    badgeDefault: "text-slate-700 bg-slate-100 border border-slate-200",
  },
};

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  icon,
  description,
  badge,
  badgeClassName,
  variant = "default",
  size = "default",
  layout = "vertical",
  isLoading = false,
  className,
  onClick,
  accentBarColor,
}) => {
  const styles = variantStyles[variant] || variantStyles.default;
  const isSm = size === "sm";

  if (isLoading) {
    if (layout === "horizontal") {
      return (
        <Card className={cn("border-2 border-stone-200/60 bg-white/70 shadow-xs rounded-2xl", className)}>
          <CardContent className="p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
            <Skeleton className="h-4 w-14 rounded-full" />
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className={cn("border-2 border-stone-200/60 bg-white/70 shadow-xs rounded-2xl", isSm ? "p-0" : "", className)}>
        <CardContent className={cn("space-y-2.5", isSm ? "p-3.5" : "p-4 space-y-3")}>
          <div className="flex items-center justify-between">
            <Skeleton className={cn("rounded-xl", isSm ? "size-7" : "size-9")} />
            <Skeleton className="h-4 w-20 rounded-full" />
          </div>
          <Skeleton className="h-3 w-24" />
          <Skeleton className={cn("w-16", isSm ? "h-6" : "h-7")} />
        </CardContent>
      </Card>
    );
  }

  // ── HORIZONTAL COMPACT LAYOUT (~60px height) ──
  if (layout === "horizontal") {
    return (
      <Card
        onClick={onClick}
        className={cn(
          "group relative overflow-hidden rounded-2xl border-2 shadow-2xs transition-all duration-200",
          "hover:-translate-y-0.5 hover:shadow-xs",
          styles.card,
          onClick && "cursor-pointer",
          className
        )}
      >
        {/* Left vertical accent line */}
        {/* <div */}
        {/*   className={cn( */}
        {/*     "absolute left-0 top-0 bottom-0 w-1.5 transition-all duration-300 group-hover:w-2", */}
        {/*     accentBarColor || styles.accentBar */}
        {/*   )} */}
        {/* /> */}

        <CardContent className="p-3 sm:p-3.5 pl-4 sm:pl-4.5 flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div
                className={cn(
                  "p-2 rounded-xl transition-transform duration-200 group-hover:scale-105 shrink-0 flex items-center justify-center [&_svg]:size-4",
                  styles.iconWrapper
                )}
              >
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-stone-600 truncate leading-tight">{title}</p>
              <div className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-tight mt-0.5">
                {value}
              </div>
              {description && (
                <p className="text-[10px] text-stone-500 font-medium truncate mt-0.5">{description}</p>
              )}
            </div>
          </div>

          {badge && (
            <span
              className={cn(
                "font-black uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 self-start text-[9px]",
                badgeClassName || styles.badgeDefault
              )}
            >
              {badge}
            </span>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── STANDARD VERTICAL LAYOUT ──
  return (
    <Card
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border-2 shadow-xs transition-all duration-300",
        "hover:-translate-y-1",
        styles.card,
        onClick && "cursor-pointer",
        className
      )}
    >
      <CardContent className={cn("flex flex-col justify-between h-full relative z-10", isSm ? "p-3.5 sm:p-4" : "p-4 sm:p-5")}>
        <div>
          {/* Header Row: Icon + Badge */}
          <div className={cn("flex items-center justify-between gap-2", isSm ? "mb-2" : "mb-3")}>
            {icon && (
              <div
                className={cn(
                  "transition-transform duration-200 group-hover:scale-105 shrink-0 flex items-center justify-center",
                  isSm ? "p-2 rounded-lg text-sm [&_svg]:w-3.5 [&_svg]:h-3.5" : "p-2.5 rounded-xl",
                  styles.iconWrapper
                )}
              >
                {icon}
              </div>
            )}
            {badge && (
              <span
                className={cn(
                  "font-black uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap",
                  isSm ? "text-[9px]" : "text-[10px] px-2.5 py-1",
                  badgeClassName || styles.badgeDefault
                )}
              >
                {badge}
              </span>
            )}
          </div>

          {/* Title / Label */}
          <p className={cn("font-bold text-stone-600 truncate", isSm ? "text-[11px]" : "text-xs")}>{title}</p>

          {/* Metric Value */}
          <div className={cn("font-black text-slate-900 tracking-tight truncate", isSm ? "text-xl sm:text-2xl mt-0.5" : "text-2xl sm:text-3xl mt-1")}>
            {value}
          </div>

          {/* Optional extra description */}
          {description && (
            <p className={cn("text-stone-500 font-medium truncate", isSm ? "text-[10px] mt-0.5" : "text-[11px] mt-1")}>{description}</p>
          )}
        </div>

        {/* Decorative bottom accent bar */}
        <div
          className={cn(
            "h-1 rounded-full transition-all duration-300",
            isSm ? "w-8 mt-2.5 group-hover:w-14" : "w-12 mt-4 group-hover:w-20",
            accentBarColor || styles.accentBar
          )}
        />
      </CardContent>
    </Card>
  );
};
