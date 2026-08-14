import type { ReactNode } from "react";
import { HeaderMenuButton } from "./header-menu-button";

type PageHeaderVariant = "admin" | "farmer" | "sibat" | "auction";

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
}

const headerClasses: Record<PageHeaderVariant, string> = {
  admin: "bg-white text-gray-900 border-b border-gray-200",
  farmer: "bg-gradient-to-r from-[#2D5A27] to-[#3E7A36] text-white shadow-lg",
  sibat: "bg-gradient-to-r from-[#1A365D] to-[#1E4E8C] text-white shadow-lg",
  auction: "bg-gradient-to-r from-[#7C3AED] to-[#9F67FF] text-white shadow-lg",
};

const glowClasses: Record<PageHeaderVariant, string> = {
  admin: "bg-slate-400/15",
  farmer: "bg-emerald-300/20",
  sibat: "bg-sky-300/20",
  auction: "bg-fuchsia-200/25",
};

const chipClasses: Record<PageHeaderVariant, string> = {
  admin: "bg-slate-900/[0.06] text-gray-900",
  farmer: "bg-white/15 text-white border border-white/20",
  sibat: "bg-white/15 text-white border border-white/20",
  auction: "bg-white/15 text-white border border-white/20",
};

export function PageHeader({
  title,
  icon,
  action,
  variant = "admin",
  maxWidthClass = "max-w-7xl",
  sticky = false,
  className = "",
}: PageHeaderProps) {
  return (
    <header
      className={`relative overflow-hidden ${headerClasses[variant]} ${sticky ? "sticky top-0 z-20" : ""} ${className}`}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full blur-3xl ${glowClasses[variant]}`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute right-32 -bottom-28 h-48 w-48 rounded-full blur-3xl ${glowClasses[variant]}`}
      />
      <div className={`relative ${maxWidthClass} mx-auto px-4 py-5 md:px-6 md:py-7`}>
        <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <HeaderMenuButton className={chipClasses[variant]} />
            {icon ? (
              <div
                className={`shrink-0 flex items-center justify-center w-11 h-11 rounded-2xl ${chipClasses[variant]}`}
              >
                {icon}
              </div>
            ) : null}
            <h1 className="wrap-break-word text-xl font-extrabold tracking-tight leading-snug sm:text-2xl">
              {title}
            </h1>
          </div>
          {action ? <div className="shrink-0 self-start sm:self-center">{action}</div> : null}
        </div>
      </div>
    </header>
  );
}
