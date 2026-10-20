"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { useAuth } from "@/contexts/auth-context";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  active?: boolean;
  onClick?: () => void;
}

export interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
  rootLabel?: string;
  rootHref?: string;
}

const ROUTE_LABELS: Record<string, string> = {
  // Roles / Portals
  sibat: "SIBAT",
  farmer: "Farmer",
  admin: "Admin",
  auction: "Auction",
  slaughterhouse: "Slaughterhouse",

  // SIBAT Routes
  batches: "Herds & Batches",
  "livestock-registry": "Livestock Registry",
  "production-records": "Production Records",
  "census-submissions": "Census Submissions",
  census: "Census",
  submit: "Submit Census",
  "sibat-alerts": "Surveillance Alerts",
  "sibat-scheduling": "Health Activities",
  "sibat-monitoring": "GIS Monitoring",
  "sibat-validation": "Field Inspection",
  "sibat-announcement": "Announcements",
  notifications: "Notifications",
  reports: "Reports & Analytics",
  "ownership-transfers": "Ownership Transfers",

  // Farmer Routes
  "livestock-inventory": "Livestock Inventory",
  "farmer-scheduling": "Activities & Events",
  "production-dashboard": "Production Dashboard",
  "report-observation": "Report Health Issue",
  "farmer-analytics": "Farm Analytics",
  "farmer-census": "Quarterly Census",
  "farmer-movement": "Movement Permits",
  "farmer-registration": "Farmer Registration",
  "farmer-announcement": "Announcements",
  alerts: "Health Alerts",
  "gis-user-map": "Farm Map",
  "livestock-record-list": "Livestock Records",

  // Admin Routes
  users: "User Management",
  "user-management": "User Management",
  analytics: "Executive Analytics",
  "disease-surveillance": "Surveillance System",
  "audit-logs": "Audit Logs",
  settings: "System Settings",
  "census-analytics": "Census Analytics",
  "data-overview": "System Data",
  "data-uploads": "Data Uploads",
  "data-validation": "Data Validation",
  "gis-map": "GIS God's-Eye Map",
  "news-announcements": "Activities & News",
  schedules: "Livestock Programs",
  "slaughter-record-review": "Slaughter Record Review",
  "nlp-example-review": "NLP Review",

  // Auction Routes
  "auction-announcement": "Auction Announcements",
  "auction-gate": "Gate Clearance Check",
  "auction-gis": "Trade & Movement GIS",
  "auction-inspections": "Intake Logs",
  "auction-ownership-transfers": "Ownership Transfers",

  // Slaughterhouse Routes
  history: "Slaughter History",
  announcements: "Activities",

  // Subpaths & Common actions
  all: "All Livestock",
  "ownership-history": "Ownership History",
  registry: "Registry Records",
  new: "New Entry",
  create: "Create",
  edit: "Edit",
  details: "Details",
  profile: "User Profile",
  "clearance-verification": "Clearance Verification",
};

function formatSegmentLabel(segment: string): string {
  if (ROUTE_LABELS[segment]) {
    return ROUTE_LABELS[segment];
  }
  // Convert kebab-case or snake_case to Title Case
  return segment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getRoleHome(role?: string | null): string | null {
  if (!role) return null;
  const normalized = role.toUpperCase();
  if (normalized === "MAO" || normalized === "ADMIN") return "/admin";
  if (normalized === "SIBAT" || normalized === "CBAT") return "/sibat";
  if (normalized === "FARMER") return "/farmer";
  if (normalized === "AUCTION") return "/auction";
  if (normalized === "SLAUGHTERHOUSESTAFF" || normalized === "SLAUGHTERHOUSE") return "/slaughterhouse";
  return null;
}

export function Breadcrumbs({
  items,
  className = "",
  rootLabel = "SmartLivestock",
  rootHref,
}: BreadcrumbsProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const resolvedItems: BreadcrumbItem[] = React.useMemo(() => {
    if (items && items.length > 0) {
      return items;
    }

    if (!pathname || pathname === "/") {
      return [{ label: rootLabel, href: "/" }];
    }

    // 1. Detect role prefix directly from current URL path
    let pathRole = "";
    if (pathname.startsWith("/sibat")) pathRole = "sibat";
    else if (pathname.startsWith("/farmer")) pathRole = "farmer";
    else if (pathname.startsWith("/admin")) pathRole = "admin";
    else if (pathname.startsWith("/auction")) pathRole = "auction";
    else if (pathname.startsWith("/slaughterhouse")) pathRole = "slaughterhouse";

    // 2. Resolve portal home URL:
    // Path-based portal takes priority, followed by user's authenticated role home, then explicit rootHref, then "/"
    const userRoleHome = getRoleHome(user?.role);
    const effectiveRootHref = (pathRole ? `/${pathRole}` : null) || userRoleHome || rootHref || "/";
    const effectiveRole = pathRole || (userRoleHome ? userRoleHome.replace("/", "") : "");

    const segments = pathname.split("/").filter(Boolean);

    // If we are at the portal root (e.g. /sibat, /farmer, /admin, /auction, /slaughterhouse)
    if (segments.length === 1 && (segments[0] === pathRole || segments[0] === effectiveRole)) {
      return [
        { label: rootLabel, href: effectiveRootHref },
        { label: "Dashboard", active: true },
      ];
    }

    // If first segment is the portal role itself (e.g. /sibat/batches),
    // then the root breadcrumb already represents the role home, so we skip segments[0]
    // to avoid redundant "SmartLivestock / SIBAT / Herds & Batches"
    const startIdx = pathRole && segments[0] === pathRole ? 1 : 0;
    const subSegments = segments.slice(startIdx);

    const breadcrumbs: BreadcrumbItem[] = [
      {
        label: rootLabel,
        href: effectiveRootHref,
      },
    ];

    let accumulatedPath = startIdx > 0 ? `/${segments[0]}` : "";

    subSegments.forEach((segment, index) => {
      accumulatedPath += `/${segment}`;
      const isLast = index === subSegments.length - 1;

      breadcrumbs.push({
        label: formatSegmentLabel(segment),
        href: isLast ? undefined : accumulatedPath,
        active: isLast,
      });
    });

    return breadcrumbs;
  }, [items, pathname, user?.role, rootLabel, rootHref]);

  if (!resolvedItems || resolvedItems.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-1.5 text-xs font-medium text-slate-500 overflow-x-auto scrollbar-none py-1.5 ${className}`}>
      {resolvedItems.map((item, index) => {
        const isLast = index === resolvedItems.length - 1;

        return (
          <div key={`${item.label}-${index}`} className="flex items-center gap-1.5 shrink-0">
            {index > 0 && (
              <span className="text-slate-300 select-none text-[11px]" aria-hidden="true">
                /
              </span>
            )}

            {item.href && !isLast ? (
              <Link
                href={item.href}
                title={item.label}
                className="hover:text-slate-900 transition-colors text-slate-500 hover:underline underline-offset-2 truncate max-w-[200px]"
              >
                {item.label}
              </Link>
            ) : item.onClick && !isLast ? (
              <button
                type="button"
                onClick={item.onClick}
                title={item.label}
                className="hover:text-slate-900 transition-colors text-slate-500 hover:underline underline-offset-2 truncate max-w-[200px] cursor-pointer"
              >
                {item.label}
              </button>
            ) : (
              <span
                title={item.label}
                className={`truncate max-w-[240px] ${
                  isLast ? "font-bold text-slate-900" : "text-slate-500"
                }`}
                aria-current={isLast ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
