import type { ReactNode } from "react";

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

const variantClasses: Record<PageHeaderVariant, string> = {
  admin: "bg-white text-gray-900 border-b border-gray-200",
  farmer: "bg-[#2D5A27] text-white shadow-lg",
  sibat: "bg-[#1A365D] text-white shadow-lg",
  auction: "bg-[#7C3AED] text-white shadow-lg",
};

const subtitleClasses: Record<PageHeaderVariant, string> = {
  admin: "text-gray-600",
  farmer: "text-white/85",
  sibat: "text-white/75",
  auction: "text-white/75",
};

export function PageHeader({
  title,
  subtitle,
  icon,
  action,
  variant = "admin",
  maxWidthClass = "max-w-7xl",
  mobileMenuOffset = true,
  sticky = false,
  className = "",
}: PageHeaderProps) {
  const offsetClass = mobileMenuOffset ? "pl-16 md:pl-6" : "pl-4 md:pl-6";

  return (
    <header className={`${variantClasses[variant]} ${sticky ? "sticky top-0 z-20" : ""} ${className}`}>
      <div className={`${maxWidthClass} mx-auto py-4 pr-4 ${offsetClass} md:py-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              {icon ? <span className="shrink-0">{icon}</span> : null}
              <h1 className="min-w-0 wrap-break-word text-xl font-bold leading-tight sm:text-2xl">{title}</h1>
            </div>
            {subtitle ? (
              <p className={`mt-1 text-sm leading-5 sm:text-base ${subtitleClasses[variant]}`}>
                {subtitle}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0 self-start sm:self-center">{action}</div> : null}
        </div>
      </div>
    </header>
  );
}
