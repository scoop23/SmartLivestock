"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card,CardContent,CardHeader,CardTitle } from "@/components/ui/card";
import { cowHead } from "@lucide/lab";
import {
Activity,
CheckCircle2,
ChevronRight,
Clock,
Icon,
Milk,
RotateCcw,
Skull,
Stethoscope
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { FarmerActivityItem } from "./farmer-analytics";

interface FarmerActivityFeedProps {
  activities?: FarmerActivityItem[];
  isLoading?: boolean;
}

const TYPE_ICONS = {
  INVENTORY: <Icon iconNode={cowHead} className="size-3.5 text-emerald-700" />,
  PRODUCTION: <Milk className="size-3.5 text-sky-700" />,
  DISEASE: <Stethoscope className="size-3.5 text-amber-700" />,
  MORTALITY: <Skull className="size-3.5 text-rose-700" />,
};

const TYPE_BG = {
  INVENTORY: "bg-emerald-100/80 border-emerald-200",
  PRODUCTION: "bg-sky-100/80 border-sky-200",
  DISEASE: "bg-amber-100/80 border-amber-200",
  MORTALITY: "bg-rose-100/80 border-rose-200",
};

export default function FarmerActivityFeed({
  activities = [],
  isLoading = false,
}: FarmerActivityFeedProps) {
  const router = useRouter();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 font-bold text-[10px] gap-1">
            <CheckCircle2 className="size-3 text-emerald-600" /> MAO Approved
          </Badge>
        );
      case "VERIFIED":
        return (
          <Badge className="bg-sky-50 text-sky-800 border-sky-200 font-bold text-[10px] gap-1">
            <CheckCircle2 className="size-3 text-sky-600" /> SIBAT Verified
          </Badge>
        );
      case "SUBJECT_TO_REVISION":
      case "REJECTED":
        return (
          <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-bold text-[10px] gap-1">
            <RotateCcw className="size-3 text-amber-700" /> Subject to Revision
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-50 text-amber-800 border-amber-200 font-bold text-[10px] gap-1">
            <Clock className="size-3 text-amber-600" /> Pending Review
          </Badge>
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

  return (
    <Card className="border-2 border-emerald-900/10 bg-white shadow-xs rounded-3xl overflow-hidden">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-emerald-100 text-emerald-800">
            <Activity className="size-4" />
          </div>
          Recent Farm Activity
        </CardTitle>
      </CardHeader>

      <CardContent className="p-5 pt-1">
        {activities.length === 0 ? (
          <div className="py-8 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
            <div className="size-10 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-slate-400 mb-2">
              <Activity className="size-5" />
            </div>
            <p className="text-xs font-bold text-slate-700">No activity logged yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Add livestock or record production to see updates here.
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <Button
                size="sm"
                onClick={() => router.push("/livestock-inventory")}
                className="bg-[#2D5A27] hover:bg-[#23471f] text-white text-xs rounded-xl font-bold h-7 px-3 cursor-pointer"
              >
                + Add Livestock
              </Button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto pr-1 [scrollbar-width:thin]">
            {activities.map((item) => {
              const isHealth = item.type === "DISEASE" || item.type === "MORTALITY";
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
                  const productionType = String(item.rawItem && "production_type" in item.rawItem ? item.rawItem.production_type : "").toLowerCase();
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
                  className="py-3 px-2 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all cursor-pointer hover:bg-slate-50/80 border border-transparent hover:border-slate-100 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                  title={isHealth ? "Click to view full health inspection details" : undefined}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`size-8 rounded-xl flex items-center justify-center border shrink-0 mt-0.5 ${
                        TYPE_BG[item.type] || "bg-slate-100 border-slate-200"
                      }`}
                    >
                      {TYPE_ICONS[item.type] || <Activity className="size-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-black text-slate-900 group-hover:text-[#2D5A27] transition-colors whitespace-normal break-words">
                          {item.title}
                        </p>
                        {isHealth && (
                          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded-md">
                            Details ↗
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
                        {item.description}
                      </p>
                      {item.remarks && (
                        <p className="text-[10px] font-semibold text-amber-700 mt-1 bg-amber-50/80 px-2 py-0.5 rounded-md inline-block border border-amber-200/60">
                          Inspector Remark: {item.remarks}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 sm:self-center shrink-0 pl-11 sm:pl-0">
                    <span className="text-[10px] font-semibold text-slate-400">
                      {formatDate(item.date)}
                    </span>
                    <div>{getStatusBadge(item.status)}</div>
                    <ChevronRight className="size-4 text-slate-300 group-hover:text-[#2D5A27] group-hover:translate-x-0.5 transition-all" />
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
