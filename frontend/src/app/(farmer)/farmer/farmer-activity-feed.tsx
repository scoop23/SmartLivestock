"use client";

import { useRouter } from "next/navigation";
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  ChevronRight,
  Sprout,
  Milk,
  Stethoscope,
  Skull,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FarmerActivityItem } from "./farmer-analytics";

interface FarmerActivityFeedProps {
  activities?: FarmerActivityItem[];
  isLoading?: boolean;
  onSelectActivity?: (activity: FarmerActivityItem) => void;
  onOpenReportIllness?: () => void;
  onOpenReportsList?: () => void;
}

const TYPE_ICONS = {
  INVENTORY: <Sprout className="size-3.5 text-emerald-700" />,
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
  onSelectActivity,
  onOpenReportIllness,
  onOpenReportsList,
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
      <CardHeader className="p-5 pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-emerald-100 text-emerald-800">
            <Activity className="size-4" />
          </div>
          Recent Farm Activity & Review Status
        </CardTitle>
        <div className="flex items-center gap-1.5">
          {onOpenReportsList && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenReportsList}
              className="text-xs font-bold text-slate-700 hover:text-emerald-950 hover:bg-slate-50 rounded-xl h-8 px-2.5 cursor-pointer"
            >
              All Reports
            </Button>
          )}
          {onOpenReportIllness ? (
            <Button
              size="sm"
              onClick={onOpenReportIllness}
              className="text-xs font-black bg-[#2D5A27] text-white hover:bg-[#23471f] rounded-xl h-8 px-3 gap-1 cursor-pointer"
            >
              + Report Sickness
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/report-observation")}
              className="text-xs font-bold text-emerald-800 hover:text-emerald-950 hover:bg-emerald-50 rounded-xl cursor-pointer"
            >
              Surveillance Hub <ChevronRight className="size-3.5 ml-0.5" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-1">
        {activities.length === 0 ? (
          <div className="py-8 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
            <div className="size-10 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-slate-400 mb-2">
              <Activity className="size-5" />
            </div>
            <p className="text-xs font-bold text-slate-700">No activity logged yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Register livestock or log milk production to see live status updates here.
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
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (isHealth && onSelectActivity) {
                      onSelectActivity(item);
                    } else if (item.type === "INVENTORY") {
                      router.push("/livestock-inventory");
                    } else if (item.type === "PRODUCTION") {
                      router.push("/production-dashboard");
                    }
                  }}
                  className={`py-3 px-2 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all cursor-pointer hover:bg-slate-50/80 border border-transparent hover:border-slate-100 group`}
                  title={isHealth ? "Click to view full health inspection dossier" : undefined}
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
                        <p className="text-xs font-black text-slate-900 group-hover:text-[#2D5A27] transition-colors truncate">
                          {item.title}
                        </p>
                        {isHealth && (
                          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded-md">
                            Dossier ↗
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
