"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cowHead } from "@lucide/lab";
import {
  Activity,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Icon,
  Milk,
  RotateCcw,
  ShieldAlert,
  Skull,
  Stethoscope,
  Tag,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { FarmerActivityItem } from "./farmer-analytics";

interface FarmerActivityFeedProps {
  activities?: FarmerActivityItem[];
  isLoading?: boolean;
}

type FilterCategory = "ALL" | "HEALTH" | "INVENTORY" | "PRODUCTION";

const TYPE_CONFIG = {
  DISEASE: {
    label: "Health Observation",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200/90",
    iconBg: "bg-amber-100/80 text-amber-700 border-amber-200",
    icon: <Stethoscope className="size-4" />,
  },
  MORTALITY: {
    label: "Mortality Record",
    badgeClass: "bg-rose-50 text-rose-800 border-rose-200/90",
    iconBg: "bg-rose-100/80 text-rose-700 border-rose-200",
    icon: <Skull className="size-4" />,
  },
  INVENTORY: {
    label: "Livestock Registry",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200/90",
    iconBg: "bg-emerald-100/80 text-emerald-700 border-emerald-200",
    icon: <Icon iconNode={cowHead} className="size-4" />,
  },
  PRODUCTION: {
    label: "Production Record",
    badgeClass: "bg-sky-50 text-sky-800 border-sky-200/90",
    iconBg: "bg-sky-100/80 text-sky-700 border-sky-200",
    icon: <Milk className="size-4" />,
  },
};

function cleanItemTitle(title: string): string {
  return title
    .replace(/^Observation:\s*/i, "")
    .replace(/^Mortality Record:\s*/i, "")
    .replace(/^Production:\s*/i, "")
    .trim();
}

export default function FarmerActivityFeed({
  activities = [],
  isLoading = false,
}: FarmerActivityFeedProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterCategory>("ALL");

  const counts = useMemo(() => {
    return {
      all: activities.length,
      health: activities.filter((a) => a.type === "DISEASE" || a.type === "MORTALITY").length,
      inventory: activities.filter((a) => a.type === "INVENTORY").length,
      production: activities.filter((a) => a.type === "PRODUCTION").length,
    };
  }, [activities]);

  const filteredActivities = useMemo(() => {
    if (filter === "HEALTH") {
      return activities.filter((a) => a.type === "DISEASE" || a.type === "MORTALITY");
    }
    if (filter === "INVENTORY") {
      return activities.filter((a) => a.type === "INVENTORY");
    }
    if (filter === "PRODUCTION") {
      return activities.filter((a) => a.type === "PRODUCTION");
    }
    return activities;
  }, [activities, filter]);

  const getStatusBadge = (status: string, type?: string) => {
    if (type === "PRODUCTION" || status === "RECORDED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
          <CheckCircle2 className="size-3 text-emerald-600" />
          Recorded
        </span>
      );
    }

    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
            <CheckCircle2 className="size-3 text-emerald-600" />
            MAO Approved
          </span>
        );
      case "VERIFIED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200/80 shadow-2xs">
            <CheckCircle2 className="size-3 text-sky-600" />
            SIBAT Verified
          </span>
        );
      case "SUBJECT_TO_REVISION":
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
            <RotateCcw className="size-3 text-amber-700" />
            Subject to Revision
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs">
            <Clock className="size-3 text-slate-500" />
            Pending Review
          </span>
        );
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const renderDescriptionPills = (description: string) => {
    if (!description) return null;
    const parts = description.split("•").map((p) => p.trim()).filter(Boolean);

    return (
      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
        {parts.map((part, idx) => {
          const isTag = /^tag:\s*/i.test(part);
          if (isTag) {
            const tagValue = part.replace(/^tag:\s*/i, "");
            return (
              <span
                key={idx}
                className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100/90 text-slate-800 border border-slate-200/80 shadow-2xs"
              >
                <Tag className="size-3 text-slate-500" />
                {tagValue}
              </span>
            );
          }
          return (
            <span
              key={idx}
              className="text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-md"
            >
              {part}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="border border-slate-200/90 bg-white shadow-xs rounded-3xl overflow-hidden">
      {/* Header with Title and Filter Tabs */}
      <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-slate-100 bg-slate-50/40">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <CardTitle className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2.5">
            <div className="size-9 sm:size-10 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200/70 shadow-2xs shrink-0">
              <Activity className="size-4 sm:size-5 text-[#2D5A27]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span>Recent Farm Activity</span>
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200/70 px-2 py-0.5 rounded-full">
                  {activities.length} total
                </span>
              </div>
              <p className="text-xs font-normal text-slate-500 mt-0.5">
                Submissions, health alerts, and inspector review statuses
              </p>
            </div>
          </CardTitle>

          {/* Quick Category Filter Pills */}
          {activities.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
              <button
                type="button"
                onClick={() => setFilter("ALL")}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  filter === "ALL"
                    ? "bg-[#2D5A27] text-white shadow-2xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70"
                }`}
              >
                All ({counts.all})
              </button>
              {counts.health > 0 && (
                <button
                  type="button"
                  onClick={() => setFilter("HEALTH")}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                    filter === "HEALTH"
                      ? "bg-amber-700 text-white shadow-2xs"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70"
                  }`}
                >
                  Health ({counts.health})
                </button>
              )}
              {counts.inventory > 0 && (
                <button
                  type="button"
                  onClick={() => setFilter("INVENTORY")}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                    filter === "INVENTORY"
                      ? "bg-emerald-700 text-white shadow-2xs"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70"
                  }`}
                >
                  Livestock ({counts.inventory})
                </button>
              )}
              {counts.production > 0 && (
                <button
                  type="button"
                  onClick={() => setFilter("PRODUCTION")}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                    filter === "PRODUCTION"
                      ? "bg-sky-700 text-white shadow-2xs"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70"
                  }`}
                >
                  Production ({counts.production})
                </button>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 rounded-2xl border border-slate-150 bg-slate-50/40 flex items-start gap-3">
                <Skeleton className="size-10 rounded-2xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32 rounded-md" />
                  <Skeleton className="h-5 w-3/4 rounded-md" />
                  <Skeleton className="h-4 w-1/2 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="py-12 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
            <div className="size-12 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-slate-400 mb-2.5">
              <Activity className="size-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">No activity logged yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Add livestock, report health observations, or record daily milk yields to see updates here.
            </p>
            <div className="mt-4 flex justify-center gap-2.5">
              <Button
                size="sm"
                onClick={() => router.push("/livestock-inventory")}
                className="bg-[#2D5A27] hover:bg-[#23471f] text-white text-xs rounded-xl font-bold h-9 px-4 cursor-pointer shadow-2xs"
              >
                + Add Livestock
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push("/report-observation")}
                className="text-xs rounded-xl font-bold h-9 px-4 cursor-pointer border-slate-200 hover:bg-slate-50"
              >
                Report Health Issue
              </Button>
            </div>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="py-8 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
            <p className="text-xs font-bold text-slate-700">No activities match this filter</p>
            <button
              type="button"
              onClick={() => setFilter("ALL")}
              className="mt-2 text-xs font-bold text-[#2D5A27] hover:underline cursor-pointer"
            >
              Reset to all activities
            </button>
          </div>
        ) : (
          <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1 sm:pr-1.5 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            {filteredActivities.map((item) => {
              const isHealth = item.type === "DISEASE" || item.type === "MORTALITY";
              const typeConfig = TYPE_CONFIG[item.type] || TYPE_CONFIG.INVENTORY;
              const displayTitle = cleanItemTitle(item.title);

              const openActivity = () => {
                if (isHealth) {
                  const reportId = String(item.id)
                    .replace(/^dc-/, "DIS-")
                    .replace(/^mort-/, "MOR-");
                  router.push(`/report-observation?reportId=${encodeURIComponent(reportId)}`);
                } else if (item.type === "INVENTORY") {
                  const livestockId = String(item.id).startsWith("inv-")
                    ? String(item.id).slice(4)
                    : null;
                  router.push(
                    livestockId
                      ? `/livestock-inventory?livestockId=${encodeURIComponent(livestockId)}`
                      : "/livestock-inventory",
                  );
                } else if (item.type === "PRODUCTION") {
                  const recordId = String(item.id).replace(/^prod-/, "");
                  const productionType = String(
                    item.rawItem && "production_type" in item.rawItem
                      ? item.rawItem.production_type
                      : ""
                  ).toLowerCase();
                  const params = new URLSearchParams({ recordId });
                  if (["milk", "meat", "eggs", "wool"].includes(productionType)) {
                    params.set("type", productionType);
                  }
                  router.push(`/production-dashboard/history?${params.toString()}`);
                }
              };

              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={openActivity}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openActivity();
                    }
                  }}
                  className="rounded-2xl border border-slate-200/80 bg-white hover:bg-slate-50/60 hover:border-emerald-300 hover:shadow-xs transition-all duration-200 p-3.5 sm:p-4 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                  title={isHealth ? "Click to view full health inspection details" : "Click to view details"}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                    {/* Left: Category Icon + Content */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div
                        className={`size-10 rounded-2xl flex items-center justify-center border shrink-0 mt-0.5 shadow-2xs ${typeConfig.iconBg}`}
                      >
                        {typeConfig.icon}
                      </div>

                      <div className="min-w-0 flex-1">
                        {/* Type Badge & View Details indicator */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${typeConfig.badgeClass}`}
                          >
                            {typeConfig.label}
                          </span>

                          <span className="text-[10px] font-semibold text-slate-400 group-hover:text-emerald-700 group-hover:bg-emerald-50 px-1.5 py-0.5 rounded transition-colors inline-flex items-center gap-1">
                            Details <ExternalLink className="size-2.5" />
                          </span>
                        </div>

                        {/* Primary Activity Title */}
                        <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-[#2D5A27] transition-colors mt-1.5 leading-snug whitespace-normal break-words">
                          {displayTitle}
                        </h4>

                        {/* Structured Metadata Pills */}
                        {renderDescriptionPills(item.description)}

                        {/* Inspector Remark Callout Card */}
                        {item.type !== "PRODUCTION" && item.remarks && (
                          <div className="mt-2.5 rounded-xl border border-amber-200/90 bg-amber-50/70 p-2.5 sm:p-3 text-xs text-amber-950 flex items-start gap-2 shadow-2xs">
                            <ShieldAlert className="size-4 text-amber-700 shrink-0 mt-0.5" />
                            <div className="leading-relaxed">
                              <span className="font-bold text-amber-900">Inspector Feedback: </span>
                              <span className="text-amber-900/90">{item.remarks}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Date, Status Badge & Hover Action */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 sm:gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                          <Calendar className="size-3 text-slate-400" />
                          {formatDate(item.date)}
                        </span>
                        <div>{getStatusBadge(item.status, item.type)}</div>
                      </div>

                      <div className="hidden sm:flex items-center gap-1 text-xs font-bold text-slate-400 group-hover:text-[#2D5A27] transition-colors">
                        <span>View</span>
                        <ChevronRight className="size-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
